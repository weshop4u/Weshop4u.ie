/**
 * Store Hours Utility
 *
 * Handles parsing openingHours JSON, checking if a store is currently open,
 * and formatting hours for display.
 *
 * Expected openingHours JSON format:
 * {
 *   "monday":    { "open": "08:00", "close": "22:00", "closed": false },
 *   "tuesday":   { "open": "14:00", "close": "22:00", "closed": true  },
 *   "wednesday": { "open": "08:00", "close": "22:00", "closed": false },
 *   "thursday":  { "open": "08:00", "close": "22:00", "closed": false },
 *   "friday":    { "open": "08:00", "close": "23:00", "closed": false },
 *   "saturday":  { "open": "09:00", "close": "23:00", "closed": false },
 *   "sunday":    { "open": "10:00", "close": "21:00", "closed": false }
 * }
 *
 * A day is closed when any of these are true:
 *   - the day is missing or null
 *   - "closed": true  (the admin panel writes this and LEAVES THE OLD TIMES
 *                      in place, so the flag must be checked, not the times)
 *   - open or close is null
 */

export type DayHours = {
  open: string | null;
  close: string | null;
  closed?: boolean | null;
} | null;

export type WeeklyHours = {
  monday?: DayHours;
  tuesday?: DayHours;
  wednesday?: DayHours;
  thursday?: DayHours;
  friday?: DayHours;
  saturday?: DayHours;
  sunday?: DayHours;
};

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_LABELS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Parse the openingHours JSON string from the database.
 */
export function parseOpeningHours(openingHoursJson: string | null | undefined): WeeklyHours | null {
  if (!openingHoursJson) return null;
  try {
    const parsed = JSON.parse(openingHoursJson);
    const normalised: any = {};
    for (const key of Object.keys(parsed)) {
      normalised[key.toLowerCase()] = parsed[key];
    }
    return normalised as WeeklyHours;
  } catch {
    return null;
  }
}

/**
 * A day counts as closed when it is missing, explicitly flagged closed by the
 * admin panel, or has no open/close times. The admin writes `closed: true` and
 * leaves the previous times in place, so the flag must be checked first —
 * checking only the times would read a flagged-closed day as open.
 */
function isDayClosed(dayHours: DayHours | undefined): boolean {
  if (!dayHours) return true;
  if (dayHours.closed === true) return true;
  return !dayHours.open || !dayHours.close;
}

/**
 * Convert "HH:MM" string to minutes since midnight.
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Get the current day name (lowercase).
 */
function getCurrentDayName(): string {
  const now = new Date();
  return DAY_NAMES[now.getDay()];
}

/**
 * Get current time in minutes since midnight (Irish time approximation).
 * Uses local device time.
 */
function getCurrentMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

/**
 * Check if a store is currently open.
 */
export function isStoreOpen(store: { isOpen247?: boolean | null; openingHours?: string | null }): boolean {
  // 24/7 stores are always open
  if (store.isOpen247) return true;

  const hours = parseOpeningHours(store.openingHours);
  if (!hours) {
    // No hours set — assume open (backwards compatible)
    return true;
  }

  const dayName = getCurrentDayName();
  const dayHours = hours[dayName as keyof WeeklyHours];

  // Day missing, flagged closed, or without times = closed
  if (isDayClosed(dayHours)) {
    return false;
  }

  const currentMinutes = getCurrentMinutes();
  const openMinutes = timeToMinutes(dayHours!.open!);
  const closeMinutes = timeToMinutes(dayHours!.close!);

  // Handle overnight hours (e.g., open 22:00, close 02:00)
  if (closeMinutes < openMinutes) {
    return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
  }

  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
}

/**
 * Get today's opening hours as a formatted string.
 * Returns null if store is 24/7 or no hours are set.
 */
export function getTodayHours(store: { isOpen247?: boolean | null; openingHours?: string | null }): string | null {
  if (store.isOpen247) return "Open 24/7";

  const hours = parseOpeningHours(store.openingHours);
  if (!hours) return null;

  const dayName = getCurrentDayName();
  const dayHours = hours[dayName as keyof WeeklyHours];

  if (isDayClosed(dayHours)) {
    return "Closed today";
  }

  return `${formatTime12h(dayHours!.open!)} – ${formatTime12h(dayHours!.close!)}`;
}

/**
 * Get the next opening time if the store is currently closed.
 */
export function getNextOpenTime(store: { isOpen247?: boolean | null; openingHours?: string | null }): string | null {
  if (store.isOpen247) return null;

  const hours = parseOpeningHours(store.openingHours);
  if (!hours) return null;

  const now = new Date();
  const currentDayIndex = now.getDay();
  const currentMinutes = getCurrentMinutes();

  // Check today first — only if today is actually an open day and we are
  // before opening time
  const todayName = DAY_NAMES[currentDayIndex];
  const todayHours = hours[todayName as keyof WeeklyHours];
  if (!isDayClosed(todayHours)) {
    const openMinutes = timeToMinutes(todayHours!.open!);
    if (currentMinutes < openMinutes) {
      return `Opens at ${formatTime12h(todayHours!.open!)} today`;
    }
  }

  // Check next 7 days, skipping any day flagged closed
  for (let i = 1; i <= 7; i++) {
    const nextDayIndex = (currentDayIndex + i) % 7;
    const nextDayName = DAY_NAMES[nextDayIndex];
    const nextDayHours = hours[nextDayName as keyof WeeklyHours];
    if (!isDayClosed(nextDayHours)) {
      if (i === 1) {
        return `Opens at ${formatTime12h(nextDayHours!.open!)} tomorrow`;
      }
      return `Opens ${DAY_LABELS_FULL[nextDayIndex]} at ${formatTime12h(nextDayHours!.open!)}`;
    }
  }

  return null;
}

/**
 * Format "HH:MM" (24h) to 12h format.
 */
function formatTime12h(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "pm" : "am";
  const displayHours = hours % 12 || 12;
  if (minutes === 0) {
    return `${displayHours}${period}`;
  }
  return `${displayHours}:${minutes.toString().padStart(2, "0")}${period}`;
}

/**
 * Get a summary of the weekly hours for display.
 */
export function getWeeklyHoursSummary(store: { isOpen247?: boolean | null; openingHours?: string | null }): { day: string; hours: string }[] {
  if (store.isOpen247) {
    return DAY_LABELS.map(day => ({ day, hours: "24 Hours" }));
  }

  const weeklyHours = parseOpeningHours(store.openingHours);
  if (!weeklyHours) return [];

  return DAY_NAMES.map((dayName, index) => {
    const dayHours = weeklyHours[dayName as keyof WeeklyHours];
    if (isDayClosed(dayHours)) {
      return { day: DAY_LABELS[index], hours: "Closed" };
    }
    return {
      day: DAY_LABELS[index],
      hours: `${formatTime12h(dayHours!.open!)} – ${formatTime12h(dayHours!.close!)}`,
    };
  });
}
