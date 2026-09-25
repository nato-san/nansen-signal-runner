const DAY_MS = 24 * 60 * 60 * 1000;

export function selectRollingWindow(rows, rollingDays = 183) {
  const datedRows = rows.filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(String(row.gate_date)));
  const dates = datedRows.map((row) => row.gate_date).sort();
  if (!dates.length) {
    return { rows: [], earliestDate: null, latestDate: null, cutoffDate: null, rollingDays };
  }

  const latestDate = dates.at(-1);
  const latestMs = Date.parse(`${latestDate}T00:00:00Z`);
  const cutoffDate = new Date(latestMs - rollingDays * DAY_MS).toISOString().slice(0, 10);
  const selected = datedRows.filter((row) => row.gate_date >= cutoffDate && row.gate_date <= latestDate);
  const selectedDates = selected.map((row) => row.gate_date).sort();

  return {
    rows: selected,
    earliestDate: selectedDates[0],
    latestDate,
    cutoffDate,
    rollingDays
  };
}
