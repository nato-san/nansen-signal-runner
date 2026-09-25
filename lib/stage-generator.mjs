export function groupBy(values, keyFor) {
  const grouped = new Map();
  for (const value of values) {
    const key = keyFor(value);
    const group = grouped.get(key) || [];
    group.push(value);
    grouped.set(key, group);
  }
  return grouped;
}

export function shuffle(values, random = Math.random) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

export function signalsFor(row) {
  const signals = [];
  const flow = Number(row.netflow || 0);
  if (row.source_trader_type === "sm") signals.push(flow >= 0 ? "SMART_MONEY_BUY" : "SMART_MONEY_SELL");
  else if (row.source_trader_type === "whale") signals.push(flow >= 0 ? "WHALE_BUY" : "WHALE_SELL");
  else signals.push(flow >= 0 ? "MARKET_NETFLOW_POSITIVE" : "MARKET_NETFLOW_NEGATIVE");
  const change = Number(row.price_change);
  if (Number.isFinite(change)) signals.push(change >= 0 ? "PRICE_MOMENTUM_UP" : "PRICE_MOMENTUM_DOWN");
  return signals;
}

export function tokenFrom(row) {
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

export function generatePool(candidatesByDate, random = Math.random) {
  const pool = [];
  const chainCounts = new Map();
  const usedSymbols = new Set();
  for (const date of shuffle([...candidatesByDate.keys()], random)) {
    const dateRows = shuffle(candidatesByDate.get(date) || [], random).filter((row) => {
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

export function generateStage(pool, random = Math.random, now = new Date()) {
  const poolByDate = groupBy(pool, (row) => row.gate_date);
  const dates = [...poolByDate.entries()]
    .filter(([, rows]) => rows.length >= 2)
    .map(([date]) => date)
    .sort();
  if (dates.length < 5) {
    throw new Error(`Need 5 distinct historical dates, but only ${dates.length} are eligible`);
  }
  const distributedDates = Array.from({ length: 5 }, (_, index) => {
    const start = Math.floor(index * dates.length / 5);
    const end = Math.max(start + 1, Math.floor((index + 1) * dates.length / 5));
    const bucket = dates.slice(start, end);
    return bucket[Math.floor(random() * bucket.length)];
  });
  const usedSymbols = new Set();
  const gates = [];
  for (const date of distributedDates) {
    const available = shuffle(poolByDate.get(date) || [], random).filter((row) => !usedSymbols.has(row.token_symbol));
    if (available.length < 2) continue;
    const [leftRow, rightRow] = available;
    usedSymbols.add(leftRow.token_symbol);
    usedSymbols.add(rightRow.token_symbol);
    const featured = random() < 0.5 ? leftRow : rightRow;
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
    goalDate: now.toISOString().slice(0, 10),
    source: "Nansen historical screener + live OHLCV",
    gates
  };
}
