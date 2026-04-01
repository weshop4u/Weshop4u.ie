import { describe, it, expect } from "vitest";

// Test the category priority sorting logic used in the categories management page
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

interface Category {
  id: number;
  name: string;
  icon: string | null;
  productCount: number;
}

function sortCategories(categories: Category[]): Category[] {
  return [...categories].sort((a, b) => {
    const aIdx = CATEGORY_PRIORITY_ORDER.findIndex(
      (p) => p.toLowerCase() === a.name.toLowerCase().trim()
    );
    const bIdx = CATEGORY_PRIORITY_ORDER.findIndex(
      (p) => p.toLowerCase() === b.name.toLowerCase().trim()
    );
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.name.localeCompare(b.name);
  });
}

describe("Category Images Management", () => {
  it("should sort categories in priority order", () => {
    const cats: Category[] = [
      { id: 1, name: "Wines", icon: null, productCount: 84 },
      { id: 2, name: "Deli", icon: null, productCount: 10 },
      { id: 3, name: "Animal Food/Items", icon: null, productCount: 49 },
      { id: 4, name: "Energy Drinks", icon: null, productCount: 93 },
      { id: 5, name: "Biscuits and Cookies", icon: null, productCount: 131 },
    ];
    const sorted = sortCategories(cats);
    expect(sorted[0].name).toBe("Deli");
    expect(sorted[1].name).toBe("Energy Drinks");
    expect(sorted[2].name).toBe("Biscuits and Cookies");
    expect(sorted[3].name).toBe("Wines");
    expect(sorted[4].name).toBe("Animal Food/Items"); // alphabetical after priority
  });

  it("should separate categories with and without images", () => {
    const cats: Category[] = [
      { id: 1, name: "Deli", icon: "https://example.com/deli.jpg", productCount: 10 },
      { id: 2, name: "Wines", icon: null, productCount: 84 },
      { id: 3, name: "Spirits", icon: "https://example.com/spirits.jpg", productCount: 46 },
      { id: 4, name: "Fish", icon: null, productCount: 16 },
    ];
    const withImage = cats.filter((c) => c.icon);
    const withoutImage = cats.filter((c) => !c.icon);
    expect(withImage).toHaveLength(2);
    expect(withoutImage).toHaveLength(2);
    expect(withImage.map((c) => c.name)).toContain("Deli");
    expect(withImage.map((c) => c.name)).toContain("Spirits");
    expect(withoutImage.map((c) => c.name)).toContain("Wines");
    expect(withoutImage.map((c) => c.name)).toContain("Fish");
  });

  it("should filter categories by search query", () => {
    const cats: Category[] = [
      { id: 1, name: "Deli", icon: null, productCount: 10 },
      { id: 2, name: "Fizzy Drinks", icon: null, productCount: 103 },
      { id: 3, name: "Energy Drinks", icon: null, productCount: 93 },
      { id: 4, name: "Chocolate Bars", icon: null, productCount: 78 },
    ];
    const query = "drink";
    const filtered = cats.filter((c) =>
      c.name.toLowerCase().includes(query.toLowerCase())
    );
    expect(filtered).toHaveLength(2);
    expect(filtered.map((c) => c.name)).toContain("Fizzy Drinks");
    expect(filtered.map((c) => c.name)).toContain("Energy Drinks");
  });

  it("should handle empty icon as needing image", () => {
    const cats: Category[] = [
      { id: 1, name: "Deli", icon: "", productCount: 10 },
      { id: 2, name: "Wines", icon: null, productCount: 84 },
      { id: 3, name: "Spirits", icon: "https://example.com/spirits.jpg", productCount: 46 },
    ];
    // Empty string is falsy, so treated as no image
    const withImage = cats.filter((c) => c.icon);
    const withoutImage = cats.filter((c) => !c.icon);
    expect(withImage).toHaveLength(1);
    expect(withoutImage).toHaveLength(2);
  });
});
