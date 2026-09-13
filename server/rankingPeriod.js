const DAY = 86400000;
export function rankingPeriod(value = "all", now = Date.now()) {
  if (!["all", "day", "week"].includes(value)) return null;
  if (value === "all") return { period: value, periodStart: null, periodEnd: null };
  return { period: value, periodStart: new Date(now - DAY * (value === "week" ? 7 : 1)).toISOString(), periodEnd: new Date(now).toISOString() };
}
export function periodFilter(period) {
  // Normalize both historical SQLite timestamps and ISO timestamps.
  return period.periodStart ? {
    sql: " AND julianday(created_at) >= julianday(?) AND julianday(created_at) <= julianday(?)",
    params: [period.periodStart, period.periodEnd],
  } : { sql: "", params: [] };
}
