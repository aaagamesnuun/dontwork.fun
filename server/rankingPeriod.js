const DAY = 86400000, JST = 9 * 3600000;
export function rankingPeriod(value = "all", now = Date.now()) {
  if (!["all", "day", "week"].includes(value)) return null;
  if (value === "all") return { period: value, periodStart: null, periodEnd: null };
  const shifted = new Date(now + JST);
  let start = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - JST;
  if (value === "week") start -= ((shifted.getUTCDay() + 6) % 7) * DAY;
  return { period: value, periodStart: new Date(start).toISOString(), periodEnd: new Date(start + DAY * (value === "week" ? 7 : 1)).toISOString() };
}
export function periodFilter(period) {
  // Historical SQLite timestamps and newer ISO timestamps use different separators.
  return period.periodStart ? {
    sql: " AND julianday(created_at) >= julianday(?) AND julianday(created_at) < julianday(?)",
    params: [period.periodStart, period.periodEnd],
  } : { sql: "", params: [] };
}
