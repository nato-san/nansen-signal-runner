import assert from "node:assert/strict";
import test from "node:test";
import { generateStage, groupBy, signalsFor } from "../lib/stage-generator.mjs";

function row(date, symbol, index) {
  return {
    gate_date: date,
    token_symbol: symbol,
    token_address: `address-${index}`,
    chain: index % 2 ? "solana" : "ethereum",
    price_usd: index + 1,
    source_trader_type: index % 3 === 0 ? "sm" : "all",
    netflow: index % 2 ? 1_000_000 : -500_000,
    price_change: index % 2 ? 8 : -4
  };
}

function fixture() {
  return Array.from({ length: 6 }, (_, dateIndex) => {
    const date = `2026-0${dateIndex + 1}-15`;
    return [row(date, `TOKEN${dateIndex}A`, dateIndex * 2), row(date, `TOKEN${dateIndex}B`, dateIndex * 2 + 1)];
  }).flat();
}

test("a stage uses five distinct dates and ten distinct tokens", () => {
  const stage = generateStage(fixture(), () => 0.25, new Date("2026-09-25T00:00:00Z"));
  const dates = stage.gates.map((gate) => gate.date);
  const symbols = stage.gates.flatMap((gate) => [gate.left.symbol, gate.right.symbol]);

  assert.equal(stage.gates.length, 5);
  assert.equal(new Set(dates).size, 5);
  assert.equal(new Set(symbols).size, 10);
  assert.deepEqual(dates, [...dates].sort());
  assert.equal(stage.goalDate, "2026-09-25");
});

test("stage generation rejects fewer than five eligible dates", () => {
  assert.throws(() => generateStage(fixture().slice(0, 8)), /Need 5 distinct historical dates/);
});

test("signals preserve point-in-time trader and direction context", () => {
  assert.deepEqual(signalsFor({ source_trader_type: "sm", netflow: -1, price_change: 2 }), [
    "SMART_MONEY_SELL",
    "PRICE_MOMENTUM_UP"
  ]);
});

test("groupBy keeps every candidate in its historical date bucket", () => {
  const grouped = groupBy(fixture(), (candidate) => candidate.gate_date);
  assert.equal(grouped.size, 6);
  assert.ok([...grouped.values()].every((rows) => rows.length === 2));
});
