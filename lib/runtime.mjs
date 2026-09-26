import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { selectRollingWindow } from "./dataset.mjs";
import { generatePool, generateStage, groupBy, tokenFrom } from "./stage-generator.mjs";

const cacheMs = 10 * 60 * 1000;
const endpoint = process.env.NANSEN_API_BASE_URL || "https://api.nansen.ai/api/v1/tgm/token-ohlcv";
const dataRoot = fileURLToPath(new URL("../data", import.meta.url));
const excludedSymbolParts = ["USD", "WETH", "WEETH", "OSETH", "WBTC", "CBBTC", "CBETH", "WSTETH", "JUPSOL", "JITOSOL", "IETH"];

function findDiscoveryFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findDiscoveryFiles(path);
    return entry.name.endsWith(".json") ? [path] : [];
  });
}

const discoveryFiles = findDiscoveryFiles(dataRoot);
const discoveryDocuments = discoveryFiles.map((path) => JSON.parse(readFileSync(path, "utf8")));
const allDiscoveryRows = discoveryDocuments.flatMap((document) => document.rows || []);
const rollingDataset = selectRollingWindow(allDiscoveryRows);
const candidateKeys = new Set();
const candidates = rollingDataset.rows.filter((row) => {
  const symbol = String(row.token_symbol || "").toUpperCase();
  const key = `${row.gate_date}:${row.chain}:${String(row.token_address).toLowerCase()}`;
  const eligible = ["solana", "ethereum", "base"].includes(row.chain)
    && row.token_address && Number(row.price_usd) > 0
    && Number(row.liquidity) >= 500_000 && Number(row.market_cap_usd) >= 5_000_000
    && !excludedSymbolParts.some((part) => symbol.includes(part)) && !candidateKeys.has(key);
  if (eligible) candidateKeys.add(key);
  return eligible;
});
const candidatesByDate = groupBy(candidates, (row) => row.gate_date);
const priceCache = new Map();
let poolCache;

export function getPublicRunError() {
  return {
    mode: "unavailable",
    code: "LIVE_PRICE_UNAVAILABLE",
    message: "Live Nansen prices are temporarily unavailable.",
    retryable: true
  };
}

async function fetchChainPrices(chain, tokens, apiKey, from, to) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { apikey: apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ chain, token_addresses: tokens.map(([, address]) => address), timeframe: "5m", date: { from, to } })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || `Nansen returned HTTP ${response.status}`);
  const symbols = new Map(tokens.map(([symbol, address]) => [address.toLowerCase(), symbol]));
  const prices = {};
  for (const row of Array.isArray(payload.tokens) ? payload.tokens : []) {
    const symbol = symbols.get(String(row.token_address).toLowerCase());
    const latest = [...(Array.isArray(row.data) ? row.data : [])].reverse().find((candle) => Number.isFinite(candle.close));
    if (symbol && latest) prices[symbol] = Number(latest.close);
  }
  return {
    prices,
    creditsUsed: Number(response.headers.get("x-nansen-credits-used") || 0)
  };
}

export function getAdminStatus() {
  const latestSnapshotMs = rollingDataset.latestDate ? Date.parse(`${rollingDataset.latestDate}T00:00:00Z`) : Number.NaN;
  const ageDays = Number.isFinite(latestSnapshotMs)
    ? Math.max(0, Math.floor((Date.now() - latestSnapshotMs) / (24 * 60 * 60 * 1000))) : null;
  const generatedAt = discoveryDocuments.map((document) => document.generated_at).filter(Boolean).sort().at(-1) || null;
  const historicalCalls = discoveryDocuments.flatMap((document) => document.api_call_summary || [])
    .filter((call) => call.status >= 200 && call.status < 300).length;
  return {
    mode: "read-only", generatedAt,
    historicalWindow: {
      earliestDate: rollingDataset.earliestDate, latestDate: rollingDataset.latestDate,
      cutoffDate: rollingDataset.cutoffDate, rollingDays: rollingDataset.rollingDays,
      ageDays, stale: ageDays === null || ageDays > 45
    },
    inventory: {
      files: discoveryFiles.length, snapshotDates: candidatesByDate.size,
      eligibleTokens: new Set(candidates.map((row) => `${row.chain}:${row.token_address}`)).size,
      chains: [...new Set(candidates.map((row) => row.chain))].sort()
    },
    api: {
      historicalSuccessfulCalls: historicalCalls, livePricingConfigured: Boolean(process.env.NANSEN_API_KEY),
      liveEndpoint: "POST /api/v1/tgm/token-ohlcv",
      historicalEndpoint: "POST /api/v1beta1/token-screener/historical"
    }
  };
}

export async function getRunData() {
  const nowMs = Date.now();
  if (!poolCache || nowMs - poolCache.cachedAt >= cacheMs) poolCache = { rows: generatePool(candidatesByDate), cachedAt: nowMs };
  const poolTokens = poolCache.rows.map(tokenFrom);
  const freshPrices = {};
  const staleByChain = {};
  for (const token of poolTokens) {
    const key = `${token.chain}:${token.address.toLowerCase()}`;
    const cached = priceCache.get(key);
    if (cached && nowMs - cached.cachedAt < cacheMs) freshPrices[token.symbol] = cached.price;
    else (staleByChain[token.chain] ||= []).push([token.symbol, token.address]);
  }
  const apiKey = process.env.NANSEN_API_KEY;
  if (!apiKey) throw new Error("NANSEN_API_KEY is not configured on the server");
  const now = new Date();
  const results = await Promise.all(Object.entries(staleByChain).map(([chain, chainTokens]) => fetchChainPrices(
    chain, chainTokens, apiKey, new Date(now.getTime() - 30 * 60 * 1000).toISOString(), now.toISOString()
  )));
  const prices = Object.assign(freshPrices, ...results.map((result) => result.prices));
  for (const token of poolTokens) {
    const price = prices[token.symbol];
    if (Number.isFinite(price)) priceCache.set(`${token.chain}:${token.address.toLowerCase()}`, { price, cachedAt: nowMs });
  }
  const availableRows = poolCache.rows.filter((row) => Number.isFinite(prices[row.token_symbol]));
  const stages = Array.from({ length: 20 }, () => generateStage(availableRows));
  return {
    mode: "live", asOf: now.toISOString(), prices, stage: stages[0], stages,
    cacheHit: Object.keys(staleByChain).length === 0,
    creditsUsed: results.reduce((sum, result) => sum + result.creditsUsed, 0),
    skippedTokens: poolCache.rows.filter((row) => !Number.isFinite(prices[row.token_symbol])).map((row) => row.token_symbol),
    historicalDataset: getAdminStatus().historicalWindow,
    source: "POST /api/v1/tgm/token-ohlcv"
  };
}
