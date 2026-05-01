import { startOfDay, subDays } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

/**
 * Returns the UTC instant corresponding to midnight (00:00:00) of "today"
 * in the tenant's timezone. Use this whenever you need to bucket orders/sales
 * by calendar day for the tenant — `startOfDay(new Date())` would otherwise
 * use the server's local timezone (UTC on Vercel), giving wrong boundaries
 * for IST tenants.
 */
export function startOfTenantDay(now: Date, timeZone: string): Date {
  const wall = toZonedTime(now, timeZone);
  const wallStart = startOfDay(wall);
  return fromZonedTime(wallStart, timeZone);
}

/** UTC instant corresponding to N days ago at 00:00:00 in the given timezone. */
export function startOfTenantDayMinus(now: Date, daysAgo: number, timeZone: string): Date {
  return subDays(startOfTenantDay(now, timeZone), daysAgo);
}
