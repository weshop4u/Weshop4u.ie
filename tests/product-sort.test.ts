import { describe, it, expect } from "vitest";

// Test the sorting logic used in the store detail screen
type Product = { name: string; price: string; description?: string; stockStatus?: string };

function sortProducts(products: Product[], sortBy: "az" | "za" | "price_low" | "price_high"): Product[] {
  const sorted = [...products];
  switch (sortBy) {
    case "az":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "za":
      sorted.sort((a, b) => b.name.localeCompare(a.name));
      break;
    case "price_low":
      sorted.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
      break;
    case "price_high":
      sorted.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
      break;
  }
  return sorted;
}

function filterProducts(products: Product[], query: string): Product[] {
  if (!query.trim()) return products;
  const q = query.toLowerCase().trim();
  return products.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      (p.description?.toLowerCase().includes(q) || false)
  );
}

const sampleProducts: Product[] = [
  { name: "OKF Protein Chocolate", price: "3.50", description: "Chocolate protein drink" },
  { name: "OKF Protein Coffee", price: "3.50", description: "Coffee protein drink" },
  { name: "Apple", price: "0.50", description: "Fresh green apple" },
  { name: "Banana", price: "0.30", description: "Ripe banana" },
  { name: "Zebra Cake", price: "5.99", description: "Striped cake snack" },
  { name: "Milk 2L", price: "2.19", description: "Full fat milk" },
  { name: "Bread White", price: "1.49", description: "Sliced white bread" },
];

describe("Product Sorting", () => {
  it("sorts A-Z alphabetically", () => {
    const sorted = sortProducts(sampleProducts, "az");
    expect(sorted[0].name).toBe("Apple");
    expect(sorted[1].name).toBe("Banana");
    expect(sorted[2].name).toBe("Bread White");
    expect(sorted[sorted.length - 1].name).toBe("Zebra Cake");
  });

  it("sorts Z-A reverse alphabetically", () => {
    const sorted = sortProducts(sampleProducts, "za");
    expect(sorted[0].name).toBe("Zebra Cake");
    expect(sorted[sorted.length - 1].name).toBe("Apple");
  });

  it("sorts by price low to high", () => {
    const sorted = sortProducts(sampleProducts, "price_low");
    expect(sorted[0].name).toBe("Banana"); // 0.30
    expect(sorted[1].name).toBe("Apple"); // 0.50
    expect(sorted[sorted.length - 1].name).toBe("Zebra Cake"); // 5.99
  });

  it("sorts by price high to low", () => {
    const sorted = sortProducts(sampleProducts, "price_high");
    expect(sorted[0].name).toBe("Zebra Cake"); // 5.99
    expect(sorted[sorted.length - 1].name).toBe("Banana"); // 0.30
  });

  it("handles products with same price", () => {
    const sorted = sortProducts(sampleProducts, "price_low");
    const proteinProducts = sorted.filter((p) => p.price === "3.50");
    expect(proteinProducts.length).toBe(2);
    // Both should be present
    expect(proteinProducts.map((p) => p.name).sort()).toEqual([
      "OKF Protein Chocolate",
      "OKF Protein Coffee",
    ]);
  });

  it("handles empty product list", () => {
    const sorted = sortProducts([], "az");
    expect(sorted).toEqual([]);
  });

  it("handles single product", () => {
    const sorted = sortProducts([{ name: "Solo", price: "1.00" }], "az");
    expect(sorted.length).toBe(1);
    expect(sorted[0].name).toBe("Solo");
  });

  it("does not mutate original array", () => {
    const original = [...sampleProducts];
    sortProducts(sampleProducts, "price_low");
    expect(sampleProducts).toEqual(original);
  });
});

describe("Product Filtering", () => {
  it("returns all products when query is empty", () => {
    const result = filterProducts(sampleProducts, "");
    expect(result.length).toBe(sampleProducts.length);
  });

  it("returns all products when query is whitespace", () => {
    const result = filterProducts(sampleProducts, "   ");
    expect(result.length).toBe(sampleProducts.length);
  });

  it("filters by product name", () => {
    const result = filterProducts(sampleProducts, "OKF");
    expect(result.length).toBe(2);
    expect(result.every((p) => p.name.includes("OKF"))).toBe(true);
  });

  it("filters by description", () => {
    const result = filterProducts(sampleProducts, "chocolate");
    expect(result.length).toBe(1);
    expect(result[0].name).toBe("OKF Protein Chocolate");
  });

  it("is case insensitive", () => {
    const result = filterProducts(sampleProducts, "APPLE");
    expect(result.length).toBe(1);
    expect(result[0].name).toBe("Apple");
  });

  it("returns empty when no match", () => {
    const result = filterProducts(sampleProducts, "xyz123");
    expect(result.length).toBe(0);
  });

  it("handles partial matches", () => {
    const result = filterProducts(sampleProducts, "pro");
    // "OKF Protein Chocolate" and "OKF Protein Coffee" match in name
    expect(result.length).toBe(2);
  });
});

describe("Combined Filter and Sort", () => {
  it("filters then sorts correctly", () => {
    const filtered = filterProducts(sampleProducts, "protein");
    const sorted = sortProducts(filtered, "az");
    expect(sorted.length).toBe(2);
    expect(sorted[0].name).toBe("OKF Protein Chocolate");
    expect(sorted[1].name).toBe("OKF Protein Coffee");
  });

  it("filters then sorts by price", () => {
    const filtered = filterProducts(sampleProducts, "a");
    // Matches: Apple (0.50), Banana (0.30), Zebra Cake (5.99), OKF Protein Chocolate (3.50 - "chocolate" has 'a')
    const sorted = sortProducts(filtered, "price_low");
    expect(sorted[0].name).toBe("Banana");
  });
});
