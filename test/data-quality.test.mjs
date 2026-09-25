import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { generatePool, generateStage, groupBy } from "../lib/stage-generator.mjs";

const excludedSymbolParts = ["USD", "WETH", "WEETH", "OSETH", "WBTC", "CBBTC", "CBETH", "WSTETH", "JUPSOL", "JITOSOL", "IETH"];

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function loadCandidates() {
  const files = ["data/discovery.json", "data/expanded-discovery.json"];
  const seen = new Set();
  return files.flatMap((path) => JSON.parse(readFileSync(path, "utf8")).rows || []).filter((row) => {
    const symbol = String(row.token_symbol || "").toUpperCase();
    const key = `${row.gate_date}:${row.chain}:${String(row.token_address).toLowerCase()}`;
    const eligible = ["solana", "ethereum", "base"].includes(row.chain)
      && row.token_address
      && Number(row.price_usd) > 0
      && Number(row.liquidity) >= 500_000
      && Number(row.market_cap_usd) >= 5_000_000
      && !excludedSymbolParts.some((part) => symbol.includes(part))
      && !seen.has(key);
    if (eligible) seen.add(key);
    return eligible;
  });
}

test("bundled Nansen snapshots sustain replay diversity", () => {
  const candidatesByDate = groupBy(loadCandidates(), (row) => row.gate_date);
  const usedDates = new Set();
  const usedSymbols = new Set();

  for (let run = 1; run <= 100; run += 1) {
    const random = seededRandom(run);
    const stage = generateStage(generatePool(candidatesByDate, random), random);
    for (const gate of stage.gates) {
      usedDates.add(gate.date);
      usedSymbols.add(gate.left.symbol);
      usedSymbols.add(gate.right.symbol);
    }
  }

  assert.ok(usedDates.size >= 8, `expected at least 8 dates, got ${usedDates.size}`);
  assert.ok(usedSymbols.size >= 50, `expected at least 50 tokens, got ${usedSymbols.size}`);
});
