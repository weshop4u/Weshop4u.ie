/**
 * Irish Timezone Utility
 * 
 * All user-facing timestamps in the WeShop4U platform should display
 * in Irish local time (Europe/Dublin). Ireland uses GMT in winter
 * and IST (Irish Standard Time, UTC+1) in summer.
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
 * Format a date value to Irish local date string.
 * Returns date only, e.g. "20 Feb 2026"
 */
export function formatIrishDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "";
  const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(IRISH_LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: IRISH_TIMEZONE,
  });
}

/**
 * Format a date/time value to Irish local date+time string.
 * Returns e.g. "20 Feb 2026, 12:42"
 */
export function formatIrishDateTime(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "";
  const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString(IRISH_LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
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
 * Format a date with weekday for receipt display.
 * Returns e.g. "Fri, 20 Feb 2026, 12:42"
 */
export function formatIrishDateFull(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "";
  const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(IRISH_LOCALE, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: IRISH_TIMEZONE,
  });
}

/**
 * Format a date with day and short month.
 * Returns e.g. "20 Feb"
 */
export function formatIrishDateDayMonth(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "";
  const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(IRISH_LOCALE, {
    day: "numeric",
    month: "short",
    timeZone: IRISH_TIMEZONE,
  });
}

/**
 * Get "time ago" string relative to now, using Irish timezone for display.
 * Returns e.g. "2m ago", "1h 30m ago", or the formatted date/time for older entries.
 */
export function formatIrishTimeAgo(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "";
  const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  return formatIrishDateTime(dateStr);
}

/**
 * Check if a date is today in Irish timezone.
 */
export function isIrishToday(dateStr: string | Date | null | undefined): boolean {
  if (!dateStr) return false;
  const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  const dateInIreland = d.toLocaleDateString(IRISH_LOCALE, { timeZone: IRISH_TIMEZONE });
  const todayInIreland = now.toLocaleDateString(IRISH_LOCALE, { timeZone: IRISH_TIMEZONE });
  return dateInIreland === todayInIreland;
}

/**
 * Format for admin/store dashboard: "Today 12:42" or "20 Feb 12:42"
 */
export function formatIrishSmartDateTime(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "—";
  const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  const time = formatIrishTime(dateStr);
  if (isIrishToday(dateStr)) return `Today ${time}`;
  return `${formatIrishDateDayMonth(dateStr)} ${time}`;
}
