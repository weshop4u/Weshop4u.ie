import { describe, it, expect } from "vitest";

const CATEGORY_PRIORITY_ORDER = [
  "Deli",
  "Fizzy Drinks",
  "Energy Drinks",
  "Water and Flavoured Water",
  "Chocolate Bars",
  "Chocolates Multi packs and Boxes",
  "Crisps and Nuts",
  "Biscuits and Cookies",
  "Tobacco and Cigars and Papers",
  "Vapes and Vape Oils",
  "Spirits",
  "Cans and Bottles",
  "Flavored Alcohol",
  "Wines",
  "Nicotine Products",
];

function sortCategories(cats: { name: string; count: number }[]) {
  return [...cats].sort((a, b) => {
    const aIdx = CATEGORY_PRIORITY_ORDER.indexOf(a.name);
    const bIdx = CATEGORY_PRIORITY_ORDER.indexOf(b.name);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.name.localeCompare(b.name);
  });
}

describe("Category Priority Sorting", () => {
  it("puts Deli first", () => {
    const cats = [
      { name: "Zebra Snacks", count: 5 },
      { name: "Deli", count: 10 },
      { name: "Apple Juice", count: 3 },
    ];
    const sorted = sortCategories(cats);
    expect(sorted[0].name).toBe("Deli");
  });

  it("maintains priority order for all priority categories", () => {
    const cats = [
      { name: "Wines", count: 20 },
      { name: "Deli", count: 5 },
      { name: "Fizzy Drinks", count: 100 },
      { name: "Spirits", count: 30 },
      { name: "Energy Drinks", count: 50 },
    ];
    const sorted = sortCategories(cats);
    expect(sorted.map((c) => c.name)).toEqual([
      "Deli",
      "Fizzy Drinks",
      "Energy Drinks",
      "Spirits",
      "Wines",
    ]);
  });

  it("puts non-priority categories after priority ones, sorted alphabetically", () => {
    const cats = [
      { name: "Zebra Snacks", count: 5 },
      { name: "Deli", count: 10 },
      { name: "Apple Juice", count: 3 },
      { name: "Bread", count: 7 },
    ];
    const sorted = sortCategories(cats);
    expect(sorted.map((c) => c.name)).toEqual([
      "Deli",
      "Apple Juice",
      "Bread",
      "Zebra Snacks",
    ]);
  });

  it("sorts all non-priority categories alphabetically when no priority categories present", () => {
    const cats = [
      { name: "Zebra Snacks", count: 5 },
      { name: "Apple Juice", count: 3 },
      { name: "Bread", count: 7 },
    ];
    const sorted = sortCategories(cats);
    expect(sorted.map((c) => c.name)).toEqual([
      "Apple Juice",
      "Bread",
      "Zebra Snacks",
    ]);
  });

  it("handles full priority list in correct order", () => {
    const cats = CATEGORY_PRIORITY_ORDER.map((name, i) => ({ name, count: 100 - i }));
    // Shuffle them
    const shuffled = [...cats].reverse();
    const sorted = sortCategories(shuffled);
    expect(sorted.map((c) => c.name)).toEqual(CATEGORY_PRIORITY_ORDER);
  });

  it("handles mix of priority and non-priority with correct boundary", () => {
    const cats = [
      { name: "Nicotine Products", count: 5 }, // last priority
      { name: "Animal Food", count: 100 },     // non-priority, should come after
      { name: "Deli", count: 2 },              // first priority
    ];
    const sorted = sortCategories(cats);
    expect(sorted.map((c) => c.name)).toEqual([
      "Deli",
      "Nicotine Products",
      "Animal Food",
    ]);
  });

  it("ignores count for priority ordering (count doesn't matter)", () => {
    const cats = [
      { name: "Fizzy Drinks", count: 1 },
      { name: "Deli", count: 1000 },
      { name: "Energy Drinks", count: 500 },
    ];
    const sorted = sortCategories(cats);
    // Should follow priority order regardless of count
    expect(sorted[0].name).toBe("Deli");
    expect(sorted[1].name).toBe("Fizzy Drinks");
    expect(sorted[2].name).toBe("Energy Drinks");
  });
});
