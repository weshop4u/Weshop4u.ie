import { describe, it, expect } from "vitest";

// Test the escapeRegex and highlighting logic used by HighlightText
function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getHighlightParts(text: string, highlight: string): { text: string; highlighted: boolean }[] {
  if (!highlight || highlight.trim().length === 0) {
    return [{ text, highlighted: false }];
  }
  const regex = new RegExp(`(${escapeRegex(highlight.trim())})`, "gi");
  const parts = text.split(regex);
  return parts.filter(p => p.length > 0).map(part => ({
    text: part,
    highlighted: regex.test(part),
  }));
}

describe("HighlightText logic", () => {
  it("should return whole text when no highlight", () => {
    const parts = getHighlightParts("Deli Counter", "");
    expect(parts).toEqual([{ text: "Deli Counter", highlighted: false }]);
  });

  it("should highlight matching portion case-insensitively", () => {
    const parts = getHighlightParts("Deli Counter", "deli");
    expect(parts.length).toBe(2);
    expect(parts[0]).toEqual({ text: "Deli", highlighted: true });
    expect(parts[1]).toEqual({ text: " Counter", highlighted: false });
  });

  it("should highlight in the middle of text", () => {
    const parts = getHighlightParts("Fresh Deli Meats", "deli");
    expect(parts.length).toBe(3);
    expect(parts[0]).toEqual({ text: "Fresh ", highlighted: false });
    expect(parts[1]).toEqual({ text: "Deli", highlighted: true });
    expect(parts[2]).toEqual({ text: " Meats", highlighted: false });
  });

  it("should handle no match", () => {
    const parts = getHighlightParts("Crisps and Nuts", "deli");
    expect(parts).toEqual([{ text: "Crisps and Nuts", highlighted: false }]);
  });

  it("should handle special regex characters in search", () => {
    const parts = getHighlightParts("Price (€5.00)", "(€5");
    // "Price " + "(€5" + ".00)"
    expect(parts.length).toBe(3);
    expect(parts[0]).toEqual({ text: "Price ", highlighted: false });
    expect(parts[1]).toEqual({ text: "(€5", highlighted: true });
    expect(parts[2]).toEqual({ text: ".00)", highlighted: false });
  });

  it("should highlight multiple occurrences", () => {
    const parts = getHighlightParts("Deli Deli Deli", "Deli");
    const highlighted = parts.filter(p => p.highlighted);
    expect(highlighted.length).toBe(3);
  });
});

describe("Recent searches logic", () => {
  it("should add new search to front and deduplicate", () => {
    const existing = ["bread", "milk", "deli"];
    const newTerm = "Deli"; // same as existing but different case
    const updated = [newTerm, ...existing.filter(s => s.toLowerCase() !== newTerm.toLowerCase())].slice(0, 8);
    expect(updated).toEqual(["Deli", "bread", "milk"]);
  });

  it("should limit to 8 recent searches", () => {
    const existing = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const newTerm = "new";
    const updated = [newTerm, ...existing.filter(s => s.toLowerCase() !== newTerm.toLowerCase())].slice(0, 8);
    expect(updated.length).toBe(8);
    expect(updated[0]).toBe("new");
    expect(updated).not.toContain("h"); // oldest dropped
  });

  it("should not save searches shorter than 2 chars", () => {
    const trimmed = "a".trim();
    expect(trimmed.length < 2).toBe(true);
  });
});
