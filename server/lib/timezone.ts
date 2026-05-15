/**
 * Irish Timezone Utility (Server-side)
 * 
 * All user-facing timestamps should display in Irish local time (Europe/Dublin).
 * Ireland uses GMT in winter and IST (Irish Standard Time, UTC+1) in summer.
 */

const IRISH_TIMEZONE = "Europe/Dublin";
const IRISH_LOCALE = "en-IE";

/**
 * Format a date/time value to Irish local time string.
 * Returns time only, e.g. "12:42"
 */
export function formatIrishTime(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "";
  const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(IRISH_LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: IRISH_TIMEZONE,
  });
}

/**
 * Format a date to short Irish format for receipts.
 * Returns e.g. "20/02/2026"
 */
export function formatIrishDateShort(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "";
  const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(IRISH_LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: IRISH_TIMEZONE,
  });
}

/**
 * Format for admin/store: "Today 12:42" or "20 Feb 12:42"
 */
export function formatIrishSmartDateTime(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "—";
  const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  const time = formatIrishTime(dateStr);
  const now = new Date();
  const dateInIreland = d.toLocaleDateString(IRISH_LOCALE, { timeZone: IRISH_TIMEZONE });
  const todayInIreland = now.toLocaleDateString(IRISH_LOCALE, { timeZone: IRISH_TIMEZONE });
  if (dateInIreland === todayInIreland) return `Today ${time}`;
  const dayMonth = d.toLocaleDateString(IRISH_LOCALE, {
    day: "numeric",
    month: "short",
    timeZone: IRISH_TIMEZONE,
  });
  return `${dayMonth} ${time}`;
}
