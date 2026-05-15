import { describe, it, expect } from "vitest";
import {
  formatIrishTime,
  formatIrishDate,
  formatIrishDateTime,
  formatIrishDateShort,
  formatIrishDateFull,
  formatIrishDateDayMonth,
  formatIrishTimeAgo,
  isIrishToday,
  formatIrishSmartDateTime,
} from "../lib/timezone";

describe("Irish Timezone Utilities", () => {
  // Use a fixed UTC date: 2026-02-20T12:42:00Z
  // In Ireland (Europe/Dublin, GMT in February), this should be 12:42 PM
  const testDateStr = "2026-02-20T12:42:00.000Z";
  const testDate = new Date(testDateStr);

  // Summer date: 2026-07-15T12:00:00Z
  // In Ireland (IST = UTC+1 in summer), this should be 13:00 (1:00 PM)
  const summerDateStr = "2026-07-15T12:00:00.000Z";

  describe("formatIrishTime", () => {
    it("returns empty string for null/undefined", () => {
      expect(formatIrishTime(null)).toBe("");
      expect(formatIrishTime(undefined)).toBe("");
    });

    it("formats time in Irish timezone (winter/GMT)", () => {
      const result = formatIrishTime(testDateStr);
      expect(result).toContain("12");
      expect(result).toContain("42");
    });

    it("formats time in Irish timezone (summer/IST = UTC+1)", () => {
      const result = formatIrishTime(summerDateStr);
      // 12:00 UTC = 13:00 IST
      expect(result).toContain("13");
      expect(result).toContain("00");
    });

    it("accepts Date objects", () => {
      const result = formatIrishTime(testDate);
      expect(result).toContain("12");
      expect(result).toContain("42");
    });
  });

  describe("formatIrishDate", () => {
    it("returns empty string for null/undefined", () => {
      expect(formatIrishDate(null)).toBe("");
      expect(formatIrishDate(undefined)).toBe("");
    });

    it("formats date with day, month, year", () => {
      const result = formatIrishDate(testDateStr);
      expect(result).toContain("20");
      expect(result).toContain("Feb");
      expect(result).toContain("2026");
    });
  });

  describe("formatIrishDateTime", () => {
    it("returns empty string for null/undefined", () => {
      expect(formatIrishDateTime(null)).toBe("");
      expect(formatIrishDateTime(undefined)).toBe("");
    });

    it("includes both date and time", () => {
      const result = formatIrishDateTime(testDateStr);
      expect(result).toContain("20");
      expect(result).toContain("Feb");
      expect(result).toContain("2026");
      expect(result).toContain("12");
      expect(result).toContain("42");
    });
  });

  describe("formatIrishDateShort", () => {
    it("formats as DD/MM/YYYY", () => {
      const result = formatIrishDateShort(testDateStr);
      expect(result).toContain("20");
      expect(result).toContain("02");
      expect(result).toContain("2026");
    });
  });

  describe("formatIrishDateFull", () => {
    it("includes weekday", () => {
      const result = formatIrishDateFull(testDateStr);
      // Feb 20, 2026 is a Friday
      expect(result).toContain("Fri");
      expect(result).toContain("20");
      expect(result).toContain("Feb");
    });
  });

  describe("formatIrishDateDayMonth", () => {
    it("formats as day month", () => {
      const result = formatIrishDateDayMonth(testDateStr);
      expect(result).toContain("20");
      expect(result).toContain("Feb");
      // Should NOT contain year
      expect(result).not.toContain("2026");
    });
  });

  describe("formatIrishTimeAgo", () => {
    it("returns empty string for null/undefined", () => {
      expect(formatIrishTimeAgo(null)).toBe("");
      expect(formatIrishTimeAgo(undefined)).toBe("");
    });

    it("returns 'Just now' for very recent dates", () => {
      const now = new Date();
      const result = formatIrishTimeAgo(now);
      expect(result).toBe("Just now");
    });

    it("returns minutes ago for recent dates", () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      const result = formatIrishTimeAgo(fiveMinAgo);
      expect(result).toContain("m ago");
    });

    it("returns hours ago for older dates", () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const result = formatIrishTimeAgo(twoHoursAgo);
      expect(result).toContain("h");
      expect(result).toContain("m ago");
    });
  });

  describe("isIrishToday", () => {
    it("returns false for null/undefined", () => {
      expect(isIrishToday(null)).toBe(false);
      expect(isIrishToday(undefined)).toBe(false);
    });

    it("returns true for today's date", () => {
      expect(isIrishToday(new Date())).toBe(true);
    });

    it("returns false for a date in the past", () => {
      expect(isIrishToday("2020-01-01T12:00:00Z")).toBe(false);
    });
  });

  describe("formatIrishSmartDateTime", () => {
    it("returns dash for null/undefined", () => {
      expect(formatIrishSmartDateTime(null)).toBe("—");
      expect(formatIrishSmartDateTime(undefined)).toBe("—");
    });

    it("shows 'Today' prefix for today's dates", () => {
      const now = new Date();
      const result = formatIrishSmartDateTime(now);
      expect(result).toContain("Today");
    });

    it("shows date for older dates", () => {
      const result = formatIrishSmartDateTime("2020-06-15T10:30:00Z");
      expect(result).not.toContain("Today");
      expect(result).toContain("Jun");
    });
  });

  describe("Summer time (IST) handling", () => {
    it("correctly applies UTC+1 offset in summer", () => {
      // July 15, 2026 at 12:00 UTC should be 13:00 IST
      const time = formatIrishTime(summerDateStr);
      expect(time).toContain("13");
    });

    it("correctly keeps GMT in winter", () => {
      // Feb 20, 2026 at 12:42 UTC should be 12:42 GMT
      const time = formatIrishTime(testDateStr);
      expect(time).toContain("12");
      expect(time).toContain("42");
    });
  });
});
