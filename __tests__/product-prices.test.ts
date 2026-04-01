import { describe, it, expect } from "vitest";

// Test the image URL extraction logic
function getFirstImageUrl(images: any): string | null {
  if (!images) return null;
  if (Array.isArray(images) && images.length > 0 && typeof images[0] === "string") {
    return images[0];
  }
  if (typeof images === "string") {
    try {
      const arr = JSON.parse(images);
      if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === "string") {
        return arr[0];
      }
    } catch {}
  }
  return null;
}

// Test the category priority sorting logic
const CATEGORY_PRIORITY_ORDER = [
  "Deli", "Fizzy Drinks", "Energy Drinks", "Water and Flavoured Water",
  "Chocolate Bars", "Chocolates Multi packs and Boxes", "Crisps and Nuts",
  "Biscuits and Cookies", "Tobacco and Cigars and Papers", "Vapes and Vape Oils",
  "Spirits", "Cans and Bottles", "Flavored Alcohol", "Wines", "Nicotine Products",
];

function sortCategories(cats: { id: number | null; name: string; count: number }[]) {
  return [...cats].sort((a, b) => {
    const aIdx = CATEGORY_PRIORITY_ORDER.findIndex(p => a.name?.toLowerCase().includes(p.toLowerCase()));
    const bIdx = CATEGORY_PRIORITY_ORDER.findIndex(p => b.name?.toLowerCase().includes(p.toLowerCase()));
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return (a.name || "").localeCompare(b.name || "");
  });
}

// Test the price change tracking logic
function handlePriceChange(
  prev: Record<number, { price?: string; salePrice?: string }>,
  productId: number,
  field: "price" | "salePrice",
  value: string,
  originalValue: string
): Record<number, { price?: string; salePrice?: string }> {
  const existing = prev[productId] || {};
  const updated = { ...existing, [field]: value };

  if (value === originalValue) {
    delete updated[field];
  }

  if (Object.keys(updated).length === 0) {
    const { [productId]: _, ...rest } = prev;
    return rest;
  }

  return { ...prev, [productId]: updated };
}

describe("Product Prices - Image URL extraction", () => {
  it("returns null for null/undefined images", () => {
    expect(getFirstImageUrl(null)).toBeNull();
    expect(getFirstImageUrl(undefined)).toBeNull();
  });

  it("extracts first URL from array (API pre-parsed)", () => {
    const images = ["https://example.com/img1.jpg", "https://example.com/img2.jpg"];
    expect(getFirstImageUrl(images)).toBe("https://example.com/img1.jpg");
  });

  it("extracts first URL from JSON string", () => {
    const images = '["https://example.com/img1.jpg"]';
    expect(getFirstImageUrl(images)).toBe("https://example.com/img1.jpg");
  });

  it("returns null for empty array", () => {
    expect(getFirstImageUrl([])).toBeNull();
  });

  it("returns null for invalid JSON string", () => {
    expect(getFirstImageUrl("not-json")).toBeNull();
  });
});

describe("Product Prices - Category priority sorting", () => {
  it("sorts priority categories before non-priority ones", () => {
    const cats = [
      { id: 1, name: "Zebra Items", count: 5 },
      { id: 2, name: "Deli", count: 50 },
      { id: 3, name: "Apple Juice", count: 10 },
    ];
    const sorted = sortCategories(cats);
    expect(sorted[0].name).toBe("Deli");
    expect(sorted[1].name).toBe("Apple Juice");
    expect(sorted[2].name).toBe("Zebra Items");
  });

  it("sorts priority categories in correct order", () => {
    const cats = [
      { id: 1, name: "Spirits", count: 20 },
      { id: 2, name: "Fizzy Drinks", count: 30 },
      { id: 3, name: "Deli", count: 50 },
      { id: 4, name: "Energy Drinks", count: 15 },
    ];
    const sorted = sortCategories(cats);
    expect(sorted[0].name).toBe("Deli");
    expect(sorted[1].name).toBe("Fizzy Drinks");
    expect(sorted[2].name).toBe("Energy Drinks");
    expect(sorted[3].name).toBe("Spirits");
  });

  it("sorts non-priority categories alphabetically", () => {
    const cats = [
      { id: 1, name: "Zebra Items", count: 5 },
      { id: 2, name: "Apple Items", count: 10 },
      { id: 3, name: "Mango Items", count: 8 },
    ];
    const sorted = sortCategories(cats);
    expect(sorted[0].name).toBe("Apple Items");
    expect(sorted[1].name).toBe("Mango Items");
    expect(sorted[2].name).toBe("Zebra Items");
  });
});

describe("Product Prices - Price change tracking", () => {
  it("tracks a new price change", () => {
    const result = handlePriceChange({}, 1, "price", "5.99", "4.99");
    expect(result).toEqual({ 1: { price: "5.99" } });
  });

  it("removes change when value matches original", () => {
    const prev = { 1: { price: "5.99" } };
    const result = handlePriceChange(prev, 1, "price", "4.99", "4.99");
    expect(result).toEqual({});
  });

  it("tracks both price and salePrice changes", () => {
    let state: Record<number, any> = {};
    state = handlePriceChange(state, 1, "price", "5.99", "4.99");
    state = handlePriceChange(state, 1, "salePrice", "3.99", "");
    expect(state).toEqual({ 1: { price: "5.99", salePrice: "3.99" } });
  });

  it("removes only one field when it matches original", () => {
    const prev = { 1: { price: "5.99", salePrice: "3.99" } };
    const result = handlePriceChange(prev, 1, "price", "4.99", "4.99");
    expect(result).toEqual({ 1: { salePrice: "3.99" } });
  });

  it("tracks changes for multiple products independently", () => {
    let state: Record<number, any> = {};
    state = handlePriceChange(state, 1, "price", "5.99", "4.99");
    state = handlePriceChange(state, 2, "price", "10.99", "9.99");
    expect(state).toEqual({
      1: { price: "5.99" },
      2: { price: "10.99" },
    });
  });

  it("counts changes correctly", () => {
    let state: Record<number, any> = {};
    state = handlePriceChange(state, 1, "price", "5.99", "4.99");
    state = handlePriceChange(state, 2, "price", "10.99", "9.99");
    state = handlePriceChange(state, 3, "salePrice", "1.99", "");
    expect(Object.keys(state).length).toBe(3);
  });
});

describe("Product Prices - Bulk update payload", () => {
  it("builds correct update payload from changes", () => {
    const priceChanges: Record<number, { price?: string; salePrice?: string }> = {
      1: { price: "5.99" },
      2: { salePrice: "3.99" },
      3: { price: "10.99", salePrice: "8.99" },
    };

    const products = [
      { id: 1, price: "4.99", salePrice: null },
      { id: 2, price: "6.99", salePrice: null },
      { id: 3, price: "12.99", salePrice: null },
    ];

    const updates = Object.entries(priceChanges).map(([id, changes]) => ({
      productId: parseInt(id),
      price: changes.price || products.find(p => p.id === parseInt(id))?.price || "0",
      salePrice: changes.salePrice !== undefined ? changes.salePrice : undefined,
    }));

    expect(updates).toHaveLength(3);
    expect(updates[0]).toEqual({ productId: 1, price: "5.99", salePrice: undefined });
    expect(updates[1]).toEqual({ productId: 2, price: "6.99", salePrice: "3.99" });
    expect(updates[2]).toEqual({ productId: 3, price: "10.99", salePrice: "8.99" });
  });
});
