import { describe, it, expect } from "vitest";

/**
 * Tests for the product reorder feature.
 * Tests the sort logic that uses sortOrder as primary sort, then falls back to user-selected sort.
 */

type MockProduct = {
  id: number;
  name: string;
  price: string;
  sortOrder: number | null;
};

// Replicate the customer-facing sort logic from [id].tsx
function sortProducts(products: MockProduct[], sortBy: string): MockProduct[] {
  const sorted = [...products];
  sorted.sort((a, b) => {
    const aOrder = a.sortOrder ?? 999;
    const bOrder = b.sortOrder ?? 999;
    // If both have custom sort orders (not default 999), respect them
    if (aOrder !== 999 || bOrder !== 999) {
      if (aOrder !== bOrder) return aOrder - bOrder;
    }
    // Then apply user-selected sort
    switch (sortBy) {
      case "az":
        return a.name.localeCompare(b.name);
      case "za":
        return b.name.localeCompare(a.name);
      case "price_low":
        return parseFloat(a.price) - parseFloat(b.price);
      case "price_high":
        return parseFloat(b.price) - parseFloat(a.price);
      default:
        return a.name.localeCompare(b.name);
    }
  });
  return sorted;
}

describe("Product Reorder Sort Logic", () => {
  const products: MockProduct[] = [
    { id: 1, name: "Coca Cola 2L", price: "3.49", sortOrder: 999 },
    { id: 2, name: "7UP Zero 2L", price: "3.99", sortOrder: 1 },
    { id: 3, name: "Fanta Orange 2L", price: "3.49", sortOrder: 2 },
    { id: 4, name: "Pepsi Max 2L", price: "3.29", sortOrder: 999 },
    { id: 5, name: "Sprite 2L", price: "3.49", sortOrder: 3 },
  ];

  it("should sort by custom sortOrder first, then A-Z for default products", () => {
    const result = sortProducts(products, "az");
    // Products with custom order (1, 2, 3) come first, then default (999) sorted A-Z
    expect(result[0].name).toBe("7UP Zero 2L"); // sortOrder 1
    expect(result[1].name).toBe("Fanta Orange 2L"); // sortOrder 2
    expect(result[2].name).toBe("Sprite 2L"); // sortOrder 3
    // Remaining default-order products sorted A-Z
    expect(result[3].name).toBe("Coca Cola 2L"); // sortOrder 999, alphabetically before Pepsi
    expect(result[4].name).toBe("Pepsi Max 2L"); // sortOrder 999
  });

  it("should sort by custom sortOrder first, then Z-A for default products", () => {
    const result = sortProducts(products, "za");
    expect(result[0].name).toBe("7UP Zero 2L"); // sortOrder 1
    expect(result[1].name).toBe("Fanta Orange 2L"); // sortOrder 2
    expect(result[2].name).toBe("Sprite 2L"); // sortOrder 3
    // Remaining default-order products sorted Z-A
    expect(result[3].name).toBe("Pepsi Max 2L"); // sortOrder 999
    expect(result[4].name).toBe("Coca Cola 2L"); // sortOrder 999
  });

  it("should sort by custom sortOrder first, then price low for default products", () => {
    const result = sortProducts(products, "price_low");
    expect(result[0].name).toBe("7UP Zero 2L"); // sortOrder 1
    expect(result[1].name).toBe("Fanta Orange 2L"); // sortOrder 2
    expect(result[2].name).toBe("Sprite 2L"); // sortOrder 3
    // Remaining default-order products sorted by price low
    expect(result[3].name).toBe("Pepsi Max 2L"); // 3.29
    expect(result[4].name).toBe("Coca Cola 2L"); // 3.49
  });

  it("should handle all products with default sortOrder (999)", () => {
    const defaultProducts: MockProduct[] = [
      { id: 1, name: "Coca Cola", price: "3.49", sortOrder: 999 },
      { id: 2, name: "7UP", price: "3.99", sortOrder: 999 },
      { id: 3, name: "Fanta", price: "3.49", sortOrder: 999 },
    ];
    const result = sortProducts(defaultProducts, "az");
    expect(result[0].name).toBe("7UP");
    expect(result[1].name).toBe("Coca Cola");
    expect(result[2].name).toBe("Fanta");
  });

  it("should handle all products with custom sortOrder", () => {
    const customProducts: MockProduct[] = [
      { id: 1, name: "Coca Cola", price: "3.49", sortOrder: 3 },
      { id: 2, name: "7UP", price: "3.99", sortOrder: 1 },
      { id: 3, name: "Fanta", price: "3.49", sortOrder: 2 },
    ];
    const result = sortProducts(customProducts, "az");
    expect(result[0].name).toBe("7UP"); // sortOrder 1
    expect(result[1].name).toBe("Fanta"); // sortOrder 2
    expect(result[2].name).toBe("Coca Cola"); // sortOrder 3
  });

  it("should handle null sortOrder as default (999)", () => {
    const mixedProducts: MockProduct[] = [
      { id: 1, name: "Coca Cola", price: "3.49", sortOrder: null },
      { id: 2, name: "7UP", price: "3.99", sortOrder: 1 },
    ];
    const result = sortProducts(mixedProducts, "az");
    expect(result[0].name).toBe("7UP"); // sortOrder 1
    expect(result[1].name).toBe("Coca Cola"); // sortOrder null -> 999
  });
});

describe("Reorder List Swap Logic", () => {
  it("should swap two adjacent items correctly (move up)", () => {
    const list = [
      { id: 1, name: "A" },
      { id: 2, name: "B" },
      { id: 3, name: "C" },
    ];
    const index = 1; // Move B up
    const newList = [...list];
    [newList[index - 1], newList[index]] = [newList[index], newList[index - 1]];
    expect(newList[0].name).toBe("B");
    expect(newList[1].name).toBe("A");
    expect(newList[2].name).toBe("C");
  });

  it("should swap two adjacent items correctly (move down)", () => {
    const list = [
      { id: 1, name: "A" },
      { id: 2, name: "B" },
      { id: 3, name: "C" },
    ];
    const index = 1; // Move B down
    const newList = [...list];
    [newList[index], newList[index + 1]] = [newList[index + 1], newList[index]];
    expect(newList[0].name).toBe("A");
    expect(newList[1].name).toBe("C");
    expect(newList[2].name).toBe("B");
  });

  it("should generate correct productIds array for save", () => {
    const reorderList = [
      { id: 5, name: "E" },
      { id: 2, name: "B" },
      { id: 8, name: "H" },
    ];
    const productIds = reorderList.map((p) => p.id);
    expect(productIds).toEqual([5, 2, 8]);
  });
});
