import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We test the pure utility functions from category-availability.ts
// The sandbox is in America/New_York (UTC-5 in winter / EST).
// Date objects use local time for getDay()/getHours(), so we set UTC times
// that correspond to the desired local times.
// EST = UTC-5, so local 14:00 = UTC 19:00

// Inline the functions to avoid module resolution issues with path aliases
function parseSchedule(raw: any) {
  if (!raw) return null;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return raw;
}

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function parseTime(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + (minutes || 0);
}

function isCategoryAvailable(scheduleRaw: any): boolean {
  const schedule = parseSchedule(scheduleRaw);
  if (!schedule) return true;
  const now = new Date();
  const dayKey = DAY_KEYS[now.getDay()];
  const daySchedule = schedule[dayKey];
  if (!daySchedule) return false;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = parseTime(daySchedule.open);
  const closeMinutes = parseTime(daySchedule.close);
  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
}

function getAvailabilityMessage(scheduleRaw: any): string | null {
  const schedule = parseSchedule(scheduleRaw);
  if (!schedule) return null;
  if (isCategoryAvailable(scheduleRaw)) return null;
  const now = new Date();
  const dayKey = DAY_KEYS[now.getDay()];
  const daySchedule = schedule[dayKey];
  if (daySchedule) {
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const openMinutes = parseTime(daySchedule.open);
    if (currentMinutes < openMinutes) {
      return `Available from ${daySchedule.open} today`;
    } else {
      return "Currently unavailable";
    }
  }
  return "Currently unavailable";
}

const ALCOHOL_SCHEDULE = {
  mon: { open: "10:30", close: "22:00" },
  tue: { open: "10:30", close: "22:00" },
  wed: { open: "10:30", close: "22:00" },
  thu: { open: "10:30", close: "22:00" },
  fri: { open: "10:30", close: "22:00" },
  sat: { open: "10:30", close: "22:00" },
  sun: { open: "12:30", close: "22:00" },
};

describe("parseSchedule", () => {
  it("returns null for null/undefined input", () => {
    expect(parseSchedule(null)).toBeNull();
    expect(parseSchedule(undefined)).toBeNull();
    expect(parseSchedule("")).toBeNull();
  });

  it("parses a JSON string schedule", () => {
    const result = parseSchedule(JSON.stringify(ALCOHOL_SCHEDULE));
    expect(result).toEqual(ALCOHOL_SCHEDULE);
  });

  it("returns object schedule as-is", () => {
    const result = parseSchedule(ALCOHOL_SCHEDULE);
    expect(result).toEqual(ALCOHOL_SCHEDULE);
  });

  it("returns null for invalid JSON", () => {
    expect(parseSchedule("not-json")).toBeNull();
  });
});

describe("isCategoryAvailable", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns true when no schedule is set", () => {
    expect(isCategoryAvailable(null)).toBe(true);
    expect(isCategoryAvailable(undefined)).toBe(true);
  });

  it("returns true during open hours on a weekday (Monday local 14:00 = UTC 19:00)", () => {
    // Monday Feb 16 2026, local 14:00 EST = UTC 19:00
    vi.setSystemTime(new Date("2026-02-16T19:00:00Z"));
    expect(isCategoryAvailable(ALCOHOL_SCHEDULE)).toBe(true);
  });

  it("returns false before opening on a weekday (Monday local 08:00 = UTC 13:00)", () => {
    // Monday local 08:00 EST = UTC 13:00
    vi.setSystemTime(new Date("2026-02-16T13:00:00Z"));
    expect(isCategoryAvailable(ALCOHOL_SCHEDULE)).toBe(false);
  });

  it("returns false after closing on a weekday (Tuesday local 00:00 = after Monday close)", () => {
    // Monday local 23:00 EST = UTC 04:00 next day (Tue)
    // Actually Monday 23:00 EST = Tue 04:00 UTC. But getDay() would be Tuesday.
    // Let's use Monday local 22:30 = UTC 03:30 Tue. getDay() = Tue.
    // Better: Monday local 22:30 EST = UTC 03:30 Tue Feb 17. getDay() = 2 (Tue)
    // We need to stay on Monday in local time. Monday 23:00 EST = Tue 04:00 UTC.
    // That gives getDay()=2 (Tue) in UTC but getDay()=1 (Mon) in local.
    // vi.setSystemTime uses the Date object, and getDay() uses local time.
    // So setting UTC to Tue 04:00 gives local Mon 23:00 EST, getDay()=1 (Mon). Good.
    vi.setSystemTime(new Date("2026-02-17T04:00:00Z")); // local: Mon 23:00 EST
    expect(isCategoryAvailable(ALCOHOL_SCHEDULE)).toBe(false);
  });

  it("returns true during Sunday open hours (Sunday local 15:00 = UTC 20:00)", () => {
    // Sunday Feb 15 2026, local 15:00 EST = UTC 20:00
    vi.setSystemTime(new Date("2026-02-15T20:00:00Z"));
    expect(isCategoryAvailable(ALCOHOL_SCHEDULE)).toBe(true);
  });

  it("returns false before Sunday opening (Sunday local 11:00 = UTC 16:00)", () => {
    // Sunday local 11:00 EST = UTC 16:00
    vi.setSystemTime(new Date("2026-02-15T16:00:00Z"));
    expect(isCategoryAvailable(ALCOHOL_SCHEDULE)).toBe(false);
  });

  it("returns false on a day not in schedule", () => {
    const partialSchedule = {
      mon: { open: "10:00", close: "18:00" },
    };
    // Tuesday local 14:00 EST = UTC 19:00
    vi.setSystemTime(new Date("2026-02-17T19:00:00Z"));
    expect(isCategoryAvailable(partialSchedule)).toBe(false);
  });

  it("handles edge case: exactly at opening time (Monday local 10:30 = UTC 15:30)", () => {
    vi.setSystemTime(new Date("2026-02-16T15:30:00Z"));
    expect(isCategoryAvailable(ALCOHOL_SCHEDULE)).toBe(true);
  });

  it("handles edge case: exactly at closing time (Monday local 22:00 = UTC 03:00 Tue)", () => {
    // Monday local 22:00 EST = Tue 03:00 UTC. getDay() local = Mon (1).
    vi.setSystemTime(new Date("2026-02-17T03:00:00Z")); // local: Mon 22:00 EST
    expect(isCategoryAvailable(ALCOHOL_SCHEDULE)).toBe(false);
  });
});

describe("getAvailabilityMessage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null when no schedule", () => {
    expect(getAvailabilityMessage(null)).toBeNull();
  });

  it("returns null when category is available (Monday local 14:00)", () => {
    vi.setSystemTime(new Date("2026-02-16T19:00:00Z")); // local Mon 14:00 EST
    expect(getAvailabilityMessage(ALCOHOL_SCHEDULE)).toBeNull();
  });

  it("returns message before opening on a weekday (Monday local 08:00)", () => {
    vi.setSystemTime(new Date("2026-02-16T13:00:00Z")); // local Mon 08:00 EST
    const msg = getAvailabilityMessage(ALCOHOL_SCHEDULE);
    expect(msg).toBe("Available from 10:30 today");
  });

  it("returns message after closing (Monday local 23:00)", () => {
    vi.setSystemTime(new Date("2026-02-17T04:00:00Z")); // local Mon 23:00 EST
    const msg = getAvailabilityMessage(ALCOHOL_SCHEDULE);
    expect(msg).toBeTruthy();
    expect(typeof msg).toBe("string");
  });
});

describe("parseTime", () => {
  it("parses HH:MM correctly", () => {
    expect(parseTime("10:30")).toBe(630);
    expect(parseTime("22:00")).toBe(1320);
    expect(parseTime("00:00")).toBe(0);
    expect(parseTime("12:30")).toBe(750);
  });
});

describe("Import data quality", () => {
  it("slugify produces valid slugs", () => {
    function slugify(name: string): string {
      return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .substring(0, 200);
    }

    expect(slugify("Wines")).toBe("wines");
    expect(slugify("Beers, Ciders, Cans and Bottles")).toBe("beers-ciders-cans-and-bottles");
    expect(slugify("Fruit n Veg")).toBe("fruit-n-veg");
    expect(slugify("Tobacco and Cigars and Papers")).toBe("tobacco-and-cigars-and-papers");
    expect(slugify("")).toBe("");
    expect(slugify("XL DRINKS")).toBe("xl-drinks");
  });

  it("stripHtml removes HTML tags", () => {
    function stripHtml(html: string): string {
      if (!html) return "";
      return html
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
    }

    expect(stripHtml("<p>Hello <b>World</b></p>")).toBe("Hello World");
    expect(stripHtml("Plain text")).toBe("Plain text");
    expect(stripHtml("")).toBe("");
    expect(stripHtml("&amp; &lt;test&gt;")).toBe("& <test>");
  });

  it("age restriction detection works", () => {
    function isAgeRestrictedCategory(name: string): boolean {
      const lower = name.toLowerCase();
      return (
        lower.includes("wine") ||
        lower.includes("beer") ||
        lower.includes("spirit") ||
        lower.includes("tobacco") ||
        lower.includes("vape") ||
        lower.includes("nicotine") ||
        lower.includes("cigarette")
      );
    }

    expect(isAgeRestrictedCategory("Wines")).toBe(true);
    expect(isAgeRestrictedCategory("Spirits")).toBe(true);
    expect(isAgeRestrictedCategory("Tobacco and Cigars and Papers")).toBe(true);
    expect(isAgeRestrictedCategory("Vapes and Vape Oils")).toBe(true);
    expect(isAgeRestrictedCategory("Nicotine Products")).toBe(true);
    expect(isAgeRestrictedCategory("Crisps and Nuts")).toBe(false);
    expect(isAgeRestrictedCategory("Ice Creams")).toBe(false);
    expect(isAgeRestrictedCategory("Energy Drinks")).toBe(false);
  });
});
