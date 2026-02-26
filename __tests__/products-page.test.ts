import { describe, it, expect } from "vitest";

/** Parse the images JSON string and return the first image URL or null */
function getFirstImageUrl(images: string | null | undefined): string | null {
  if (!images) return null;
  try {
    const arr = JSON.parse(images);
    if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === "string") {
      return arr[0];
    }
  } catch {}
  return null;
}

describe("Products Page - Image Parsing", () => {
  it("parses a valid JSON array with one URL", () => {
    const result = getFirstImageUrl('["https://weshop4u.ie/storage/products/test.jpg"]');
    expect(result).toBe("https://weshop4u.ie/storage/products/test.jpg");
  });

  it("parses a valid JSON array with multiple URLs and returns the first", () => {
    const result = getFirstImageUrl('["https://example.com/a.jpg","https://example.com/b.jpg"]');
    expect(result).toBe("https://example.com/a.jpg");
  });

  it("returns null for null input", () => {
    expect(getFirstImageUrl(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(getFirstImageUrl(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(getFirstImageUrl("")).toBeNull();
  });

  it("returns null for empty array", () => {
    expect(getFirstImageUrl("[]")).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(getFirstImageUrl("not json")).toBeNull();
  });

  it("returns null for array of non-strings", () => {
    expect(getFirstImageUrl("[123, 456]")).toBeNull();
  });
});

describe("Products Page - Category Filtering", () => {
  const mockProducts = [
    { id: 1, name: "Milk", categoryId: 10, stockStatus: "in_stock", isActive: true },
    { id: 2, name: "Bread", categoryId: 20, stockStatus: "in_stock", isActive: true },
    { id: 3, name: "Butter", categoryId: 10, stockStatus: "out_of_stock", isActive: true },
    { id: 4, name: "Deleted Item", categoryId: 10, stockStatus: "in_stock", isActive: false },
    { id: 5, name: "Cheese", categoryId: 10, stockStatus: "in_stock", isActive: true },
  ];

  const mockCategories = [
    { id: 10, name: "Dairy" },
    { id: 20, name: "Bakery" },
    { id: 30, name: "Snacks" },
  ];

  it("filters active products only", () => {
    const active = mockProducts.filter((p) => p.isActive !== false);
    expect(active.length).toBe(4);
    expect(active.find((p) => p.name === "Deleted Item")).toBeUndefined();
  });

  it("filters by category", () => {
    const active = mockProducts.filter((p) => p.isActive !== false);
    const dairy = active.filter((p) => p.categoryId === 10);
    expect(dairy.length).toBe(3);
  });

  it("filters by stock status", () => {
    const active = mockProducts.filter((p) => p.isActive !== false);
    const outOfStock = active.filter((p) => p.stockStatus === "out_of_stock");
    expect(outOfStock.length).toBe(1);
    expect(outOfStock[0].name).toBe("Butter");
  });

  it("computes categories with product count", () => {
    const active = mockProducts.filter((p) => p.isActive !== false);
    const withCount = mockCategories.map((cat) => ({
      ...cat,
      count: active.filter((p) => p.categoryId === cat.id).length,
    })).filter((c) => c.count > 0).sort((a, b) => b.count - a.count);

    expect(withCount.length).toBe(2); // Snacks has 0 products
    expect(withCount[0].name).toBe("Dairy");
    expect(withCount[0].count).toBe(3);
    expect(withCount[1].name).toBe("Bakery");
    expect(withCount[1].count).toBe(1);
  });
});
