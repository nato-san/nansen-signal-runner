import assert from "node:assert/strict";
import test from "node:test";
import { selectRollingWindow } from "../lib/dataset.mjs";

test("rolling dataset follows the newest administrative snapshot", () => {
  const rows = [
    { gate_date: "2026-01-01", token_symbol: "OLD" },
    { gate_date: "2027-08-01", token_symbol: "RECENT" },
    { gate_date: "2028-01-01", token_symbol: "NEWEST" }
  ];
  const selected = selectRollingWindow(rows, 183);

  assert.equal(selected.latestDate, "2028-01-01");
  assert.equal(selected.cutoffDate, "2027-07-02");
  assert.deepEqual(selected.rows.map((row) => row.token_symbol), ["RECENT", "NEWEST"]);
});
