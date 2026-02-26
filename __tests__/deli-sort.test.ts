import { describe, it, expect } from "vitest";

/**
 * Replicates the Deli category sorting logic from [id].tsx:
 * In the Deli category, chicken wings products are pushed to the bottom.
 */
function sortDeliProducts(products: { name: string; price: string }[], sortBy: string, isDeli: boolean) {
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

  if (isDeli) {
    const isWings = (name: string) => name.toLowerCase().includes("chicken wings");
    const nonWings = sorted.filter((p) => !isWings(p.name));
    const wings = sorted.filter((p) => isWings(p.name));
    return [...nonWings, ...wings];
  }

  return sorted;
}

describe("Deli Category - Chicken Wings at Bottom", () => {
  const deliProducts = [
    { name: "Chicken Wings x6", price: "5.99" },
    { name: "Create Your Own", price: "4.50" },
    { name: "Sausage Roll Large", price: "3.00" },
    { name: "Ham and Cheese Jambon", price: "3.50" },
    { name: "Spicy Wedges", price: "3.50" },
    { name: "Spicy Wedges Roll", price: "4.49" },
  ];

  it("puts chicken wings last when sorting A-Z in Deli", () => {
    const sorted = sortDeliProducts(deliProducts, "az", true);
    expect(sorted[sorted.length - 1].name).toBe("Chicken Wings x6");
    // First items should be alphabetical (excluding wings)
    expect(sorted[0].name).toBe("Create Your Own");
  });

  it("puts chicken wings last when sorting Z-A in Deli", () => {
    const sorted = sortDeliProducts(deliProducts, "za", true);
    expect(sorted[sorted.length - 1].name).toBe("Chicken Wings x6");
    // First item should be the last alphabetically (excluding wings)
    expect(sorted[0].name).toBe("Spicy Wedges Roll");
  });

  it("puts chicken wings last when sorting by price low-high in Deli", () => {
    const sorted = sortDeliProducts(deliProducts, "price_low", true);
    expect(sorted[sorted.length - 1].name).toBe("Chicken Wings x6");
  });

  it("puts chicken wings last when sorting by price high-low in Deli", () => {
    const sorted = sortDeliProducts(deliProducts, "price_high", true);
    expect(sorted[sorted.length - 1].name).toBe("Chicken Wings x6");
  });

  it("does NOT push chicken wings to bottom in non-Deli categories", () => {
    const sorted = sortDeliProducts(deliProducts, "az", false);
    // Normal A-Z: Chicken Wings x6 should be first
    expect(sorted[0].name).toBe("Chicken Wings x6");
  });

  it("handles multiple chicken wings products", () => {
    const products = [
      ...deliProducts,
      { name: "Chicken Wings x12", price: "9.99" },
    ];
    const sorted = sortDeliProducts(products, "az", true);
    const lastTwo = sorted.slice(-2);
    expect(lastTwo.every((p) => p.name.toLowerCase().includes("chicken wings"))).toBe(true);
  });

  it("handles no chicken wings in Deli (no change)", () => {
    const noWings = deliProducts.filter((p) => !p.name.includes("Chicken Wings"));
    const sorted = sortDeliProducts(noWings, "az", true);
    // Should just be normal A-Z
    expect(sorted[0].name).toBe("Create Your Own");
    expect(sorted[sorted.length - 1].name).toBe("Spicy Wedges Roll");
  });
});
