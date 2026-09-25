import { createReadStream, existsSync, readFileSync, readdirSync } from "node:fs";
import { access, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { selectRollingWindow } from "./lib/dataset.mjs";
import { generatePool, generateStage, groupBy, tokenFrom } from "./lib/stage-generator.mjs";

const root = fileURLToPath(new URL("./dist", import.meta.url));
const port = Number(process.env.PORT || 4173);
const cacheMs = 10 * 60 * 1000;
const endpoint = process.env.NANSEN_API_BASE_URL || "https://api.nansen.ai/api/v1/tgm/token-ohlcv";
const dataRoot = fileURLToPath(new URL("./data", import.meta.url));
function findDiscoveryFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findDiscoveryFiles(path);
    return entry.name.endsWith(".json") ? [path] : [];
  });
}
const discoveryFiles = findDiscoveryFiles(dataRoot);
const allDiscoveryRows = discoveryFiles.flatMap((path) => JSON.parse(readFileSync(path, "utf8")).rows || []);
const rollingDataset = selectRollingWindow(allDiscoveryRows);
const discoveryRows = rollingDataset.rows;
const excludedSymbolParts = ["USD", "WETH", "WEETH", "OSETH", "WBTC", "CBBTC", "CBETH", "WSTETH", "JUPSOL", "JITOSOL", "IETH"];
const candidateKeys = new Set();
const candidates = discoveryRows.filter((row) => {
  const symbol = String(row.token_symbol || "").toUpperCase();
  const key = `${row.gate_date}:${row.chain}:${String(row.token_address).toLowerCase()}`;
  const eligible = ["solana", "ethereum", "base"].includes(row.chain)
    && row.token_address
    && Number(row.price_usd) > 0
    && Number(row.liquidity) >= 500_000
    && Number(row.market_cap_usd) >= 5_000_000
    && !excludedSymbolParts.some((part) => symbol.includes(part))
    && !candidateKeys.has(key);
  if (eligible) candidateKeys.add(key);
  return eligible;
});
const candidatesByDate = groupBy(candidates, (row) => row.gate_date);
const priceCache = new Map();
let poolCache;

function json(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}

async function fetchChainPrices(chain, tokens, apiKey, from, to) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: apiKey,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      chain,
      token_addresses: tokens.map(([, address]) => address),
      timeframe: "5m",
      date: { from, to }
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || `Nansen returned HTTP ${response.status}`);
  }

  const rows = Array.isArray(payload.tokens) ? payload.tokens : [];
  const symbols = new Map(tokens.map(([symbol, address]) => [address.toLowerCase(), symbol]));
  const prices = {};
  for (const row of rows) {
    const symbol = symbols.get(String(row.token_address).toLowerCase());
    const candles = Array.isArray(row.data) ? row.data : [];
    const latest = [...candles].reverse().find((candle) => Number.isFinite(candle.close));
    if (symbol && latest) prices[symbol] = Number(latest.close);
  }

  return {
    prices,
    creditsUsed: Number(response.headers.get("x-nansen-credits-used") || 0),
    creditsRemaining: response.headers.get("x-nansen-credits-remaining")
  };
}

async function getRunData() {
  const nowMs = Date.now();
  if (!poolCache || nowMs - poolCache.cachedAt >= cacheMs) {
    poolCache = { rows: generatePool(candidatesByDate), cachedAt: nowMs };
  }
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
  const from = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
  const to = now.toISOString();
  const results = await Promise.all(Object.entries(staleByChain).map(([chain, chainTokens]) => {
    return fetchChainPrices(chain, chainTokens, apiKey, from, to);
  }));
  const prices = Object.assign(freshPrices, ...results.map((result) => result.prices));
  for (const token of poolTokens) {
    const price = prices[token.symbol];
    if (Number.isFinite(price)) {
      priceCache.set(`${token.chain}:${token.address.toLowerCase()}`, { price, cachedAt: nowMs });
    }
  }
  const availableRows = poolCache.rows.filter((row) => Number.isFinite(prices[row.token_symbol]));
  const missingSymbols = poolCache.rows
    .filter((row) => !Number.isFinite(prices[row.token_symbol]))
    .map((row) => row.token_symbol);
  const stage = generateStage(availableRows);

  return {
    mode: "live",
    asOf: now.toISOString(),
    prices,
    stage,
    cacheHit: Object.keys(staleByChain).length === 0,
    creditsUsed: results.reduce((sum, result) => sum + result.creditsUsed, 0),
    creditsRemaining: results.map((result) => result.creditsRemaining).filter(Boolean).at(-1) || null,
    skippedTokens: missingSymbols,
    historicalDataset: {
      earliestDate: rollingDataset.earliestDate,
      latestDate: rollingDataset.latestDate,
      cutoffDate: rollingDataset.cutoffDate,
      rollingDays: rollingDataset.rollingDays,
      files: discoveryFiles.length
    },
    source: "POST /api/v1/tgm/token-ohlcv"
  };
}

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

async function serveStatic(request, response) {
  const requestPath = new URL(request.url, `http://${request.headers.host}`).pathname;
  const safePath = normalize(requestPath).replace(/^(\.\.(\/|\\|$))+/, "");
  let filePath = join(root, safePath === "/" ? "index.html" : safePath);
  try {
    await access(filePath);
    if ((await stat(filePath)).isDirectory()) filePath = join(filePath, "index.html");
  } catch {
    filePath = join(root, "index.html");
  }
  response.writeHead(200, { "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream" });
  createReadStream(filePath).pipe(response);
}

createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/api/run-data") {
    try {
      json(response, 200, await getRunData());
    } catch (error) {
      json(response, 503, { mode: "unavailable", message: error instanceof Error ? error.message : "Live prices unavailable" });
    }
    return;
  }
  if (request.method === "GET" || request.method === "HEAD") {
    await serveStatic(request, response);
    return;
  }
  json(response, 405, { message: "Method not allowed" });
}).listen(port, "127.0.0.1", () => {
  console.log(`Nansen Runner: http://127.0.0.1:${port}`);
  console.log(process.env.NANSEN_API_KEY ? "Live pricing enabled (10 minute cache)." : "Live pricing disabled: NANSEN_API_KEY is not set.");
});
