import { describe, it, expect } from "vitest";

interface Category {
  id: number;
  name: string;
  productCount: number;
}

// Simulate the filtering logic from getAllWithCounts
function filterCategoriesByStore(
  allCategories: Category[],
  storeId: number | undefined
): Category[] {
  if (storeId) {
    return allCategories.filter((cat) => cat.productCount > 0);
  }
  return allCategories;
}

const mockCategories: Category[] = [
  { id: 90001, name: "Fruit n Veg", productCount: 5 },
  { id: 90002, name: "Wines", productCount: 84 },
  { id: 90003, name: "Cans and Bottles", productCount: 112 },
  { id: 150004, name: "Salt n Chili Delight", productCount: 0 },
  { id: 150005, name: "Fruity Chicken", productCount: 0 },
  { id: 150006, name: "Roast Duck Dishes", productCount: 0 },
  { id: 150007, name: "Chefs Recommendation", productCount: 0 },
  { id: 60001, name: "Deli", productCount: 10 },
  { id: 150024, name: "Chow Mein Dishes", productCount: 0 },
  { id: 150025, name: "Fried Rice Dishes", productCount: 0 },
];

describe("Category Store Filtering", () => {
  it("should filter out categories with 0 products when storeId is provided", () => {
    const result = filterCategoriesByStore(mockCategories, 1);
    expect(result.every((cat) => cat.productCount > 0)).toBe(true);
  });

  it("should keep all Spar categories that have products", () => {
    const result = filterCategoriesByStore(mockCategories, 1);
    const names = result.map((c) => c.name);
    expect(names).toContain("Fruit n Veg");
    expect(names).toContain("Wines");
    expect(names).toContain("Cans and Bottles");
    expect(names).toContain("Deli");
  });

  it("should remove Treasure Bowl categories with 0 products from Spar view", () => {
    const result = filterCategoriesByStore(mockCategories, 1);
    const names = result.map((c) => c.name);
    expect(names).not.toContain("Salt n Chili Delight");
    expect(names).not.toContain("Fruity Chicken");
    expect(names).not.toContain("Roast Duck Dishes");
    expect(names).not.toContain("Chefs Recommendation");
    expect(names).not.toContain("Chow Mein Dishes");
    expect(names).not.toContain("Fried Rice Dishes");
  });

  it("should return correct count of filtered categories", () => {
    const result = filterCategoriesByStore(mockCategories, 1);
    expect(result.length).toBe(4); // Only 4 categories have products
  });

  it("should return ALL categories when no storeId is provided", () => {
    const result = filterCategoriesByStore(mockCategories, undefined);
    expect(result.length).toBe(mockCategories.length);
  });

  it("should include 0-product categories when no storeId filter", () => {
    const result = filterCategoriesByStore(mockCategories, undefined);
    const zeroProductCats = result.filter((c) => c.productCount === 0);
    expect(zeroProductCats.length).toBe(6);
  });
});
