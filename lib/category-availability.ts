/**
 * Category availability utilities for time-restricted categories (e.g., alcohol).
 * Used to determine if a category's products can be ordered right now.
 */

type DaySchedule = { open: string; close: string };
type AvailabilitySchedule = {
  mon?: DaySchedule;
  tue?: DaySchedule;
  wed?: DaySchedule;
  thu?: DaySchedule;
  fri?: DaySchedule;
  sat?: DaySchedule;
  sun?: DaySchedule;
};

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Parse an availability schedule from a string or object.
 */
export function parseSchedule(raw: string | AvailabilitySchedule | null | undefined): AvailabilitySchedule | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw;
}

/**
 * Check if a category is currently available based on its schedule.
 * Returns true if no schedule is set (always available).
 */
export function isCategoryAvailable(scheduleRaw: string | AvailabilitySchedule | null | undefined): boolean {
  const schedule = parseSchedule(scheduleRaw);
  if (!schedule) return true; // No schedule = always available

  const now = new Date();
  const dayKey = DAY_KEYS[now.getDay()];
  const daySchedule = schedule[dayKey];

  if (!daySchedule) return false; // Day not in schedule = not available today

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = parseTime(daySchedule.open);
  const closeMinutes = parseTime(daySchedule.close);

  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
}

/**
 * Get a human-readable message about when the category becomes available.
 * Returns null if the category is currently available or has no schedule.
 */
export function getAvailabilityMessage(scheduleRaw: string | AvailabilitySchedule | null | undefined): string | null {
  const schedule = parseSchedule(scheduleRaw);
  if (!schedule) return null;

  if (isCategoryAvailable(scheduleRaw)) return null;

  const now = new Date();
  const dayKey = DAY_KEYS[now.getDay()];
  const daySchedule = schedule[dayKey];

  if (daySchedule) {
    // Today has hours but we're outside them
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const openMinutes = parseTime(daySchedule.open);

    if (currentMinutes < openMinutes) {
      return `Available from ${daySchedule.open} today`;
    } else {
      // After closing time, find next available day
      return getNextAvailableMessage(schedule, now);
    }
  } else {
    // Today is not available at all
    return getNextAvailableMessage(schedule, now);
  }
}

/**
 * Get today's availability hours for a category.
 */
export function getTodayAvailability(scheduleRaw: string | AvailabilitySchedule | null | undefined): string | null {
  const schedule = parseSchedule(scheduleRaw);
  if (!schedule) return null;

  const dayKey = DAY_KEYS[new Date().getDay()];
  const daySchedule = schedule[dayKey];

  if (!daySchedule) return "Not available today";
  return `${daySchedule.open} - ${daySchedule.close}`;
}

function getNextAvailableMessage(schedule: AvailabilitySchedule, now: Date): string {
  // Look ahead up to 7 days
  for (let i = 1; i <= 7; i++) {
    const nextDate = new Date(now);
    nextDate.setDate(nextDate.getDate() + i);
    const nextDayKey = DAY_KEYS[nextDate.getDay()];
    const nextDaySchedule = schedule[nextDayKey];

    if (nextDaySchedule) {
      if (i === 1) {
        return `Available tomorrow from ${nextDaySchedule.open}`;
      }
      return `Available ${DAY_LABELS[nextDate.getDay()]} from ${nextDaySchedule.open}`;
    }
  }
  return "Currently unavailable";
}

function parseTime(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + (minutes || 0);
}
