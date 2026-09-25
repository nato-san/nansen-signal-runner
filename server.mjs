import { createReadStream, existsSync, readFileSync } from "node:fs";
import { access, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("./dist", import.meta.url));
const port = Number(process.env.PORT || 4173);
const cacheMs = 10 * 60 * 1000;
const endpoint = process.env.NANSEN_API_BASE_URL || "https://api.nansen.ai/api/v1/tgm/token-ohlcv";
const discoveryPath = fileURLToPath(new URL("./data/discovery.json", import.meta.url));
const expandedDiscoveryPath = fileURLToPath(new URL("./data/expanded-discovery.json", import.meta.url));
const discoveryFiles = [discoveryPath, expandedDiscoveryPath].filter(existsSync);
const discoveryRows = discoveryFiles.flatMap((path) => JSON.parse(readFileSync(path, "utf8")).rows || []);
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
function groupBy(values, keyFor) {
  const grouped = new Map();
  for (const value of values) {
    const key = keyFor(value);
    const group = grouped.get(key) || [];
    group.push(value);
    grouped.set(key, group);
  }
  return grouped;
}

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

function shuffle(values) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function signalsFor(row) {
  const signals = [];
  const flow = Number(row.netflow || 0);
  if (row.source_trader_type === "sm") signals.push(flow >= 0 ? "SMART_MONEY_BUY" : "SMART_MONEY_SELL");
  else if (row.source_trader_type === "whale") signals.push(flow >= 0 ? "WHALE_BUY" : "WHALE_SELL");
  else signals.push(flow >= 0 ? "MARKET_NETFLOW_POSITIVE" : "MARKET_NETFLOW_NEGATIVE");
  const change = Number(row.price_change);
  if (Number.isFinite(change)) signals.push(change >= 0 ? "PRICE_MOMENTUM_UP" : "PRICE_MOMENTUM_DOWN");
  return signals;
}

function tokenFrom(row) {
  return {
    symbol: row.token_symbol,
    chain: row.chain,
    address: row.token_address,
    buyPriceUsd: Number(row.price_usd),
    goalPriceUsd: Number(row.price_usd),
    goalValueUsd: 10,
    roi: 0,
    sceneType: "D_WIN",
    signals: signalsFor(row)
  };
}

function signalContextFor(row) {
  return {
    traderType: row.source_trader_type || "all",
    netflowUsd: Number(row.netflow || 0),
    priceChangePercent: Number(row.price_change || 0),
    endpoint: "/api/v1beta1/token-screener/historical"
  };
}

function generatePool() {
  const pool = [];
  const chainCounts = new Map();
  const usedSymbols = new Set();
  for (const date of shuffle([...candidatesByDate.keys()])) {
    const dateRows = shuffle(candidatesByDate.get(date) || []).filter((row) => {
      return !usedSymbols.has(row.token_symbol) && (chainCounts.get(row.chain) || 0) < 10;
    });
    const selected = [];
    for (const row of dateRows) {
      const pendingOnChain = selected.filter((item) => item.chain === row.chain).length;
      if ((chainCounts.get(row.chain) || 0) + pendingOnChain >= 10) continue;
      selected.push(row);
      if (selected.length === 3) break;
    }
    if (selected.length < 2) continue;
    for (const row of selected) {
      pool.push(row);
      usedSymbols.add(row.token_symbol);
      chainCounts.set(row.chain, (chainCounts.get(row.chain) || 0) + 1);
    }
    if (pool.length >= 24) break;
  }
  return pool;
}

function generateStage(pool) {
  const poolByDate = groupBy(pool, (row) => row.gate_date);
  const dates = shuffle(
    [...poolByDate.entries()]
      .filter(([, rows]) => rows.length >= 2)
      .map(([date]) => date)
  );
  if (dates.length < 5) {
    throw new Error(`Need 5 distinct historical dates, but only ${dates.length} are eligible`);
  }
  const usedSymbols = new Set();
  const gates = [];
  for (const date of dates) {
    const available = shuffle(poolByDate.get(date) || []).filter((row) => !usedSymbols.has(row.token_symbol));
    if (available.length < 2) continue;
    const [leftRow, rightRow] = available;
    usedSymbols.add(leftRow.token_symbol);
    usedSymbols.add(rightRow.token_symbol);
    const featured = Math.random() < 0.5 ? leftRow : rightRow;
    gates.push({
      date,
      left: tokenFrom(leftRow),
      right: tokenFrom(rightRow),
      featuredSymbol: featured.token_symbol,
      featuredSignals: signalsFor(featured),
      featuredContext: signalContextFor(featured)
    });
    if (gates.length === 5) break;
  }
  if (gates.length < 5) throw new Error("Not enough unique tokens across 5 distinct historical dates");
  gates.sort((a, b) => a.date.localeCompare(b.date));
  return {
    goalDate: new Date().toISOString().slice(0, 10),
    source: "Nansen historical screener + live OHLCV",
    gates
  };
}

async function getRunData() {
  const nowMs = Date.now();
  if (!poolCache || nowMs - poolCache.cachedAt >= cacheMs) {
    poolCache = { rows: generatePool(), cachedAt: nowMs };
  }
  const stage = generateStage(poolCache.rows);
  const stageTokens = stage.gates.flatMap((gate) => [gate.left, gate.right]);
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
  const expectedSymbols = stageTokens.map((token) => token.symbol);
  const missing = expectedSymbols.filter((symbol) => !Number.isFinite(prices[symbol]));
  if (missing.length) throw new Error(`No recent Nansen price for: ${missing.join(", ")}`);

  return {
    mode: "live",
    asOf: now.toISOString(),
    prices,
    stage,
    cacheHit: Object.keys(staleByChain).length === 0,
    creditsUsed: results.reduce((sum, result) => sum + result.creditsUsed, 0),
    creditsRemaining: results.map((result) => result.creditsRemaining).filter(Boolean).at(-1) || null,
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
