import { describe, it, expect } from "vitest";

const API_BASE = "http://127.0.0.1:3000/api/trpc";

async function searchProducts(query: string) {
  const res = await fetch(
    `${API_BASE}/stores.searchProducts?input=${encodeURIComponent(JSON.stringify({ json: { query } }))}`
  );
  const data = await res.json();
  return data.result.data.json;
}

describe("Product search results include categoryId for navigation", () => {
  it("should include categoryId in search results", async () => {
    const results = await searchProducts("pepsi");
    expect(results.length).toBeGreaterThan(0);
    // Every product should have a categoryId field
    for (const r of results) {
      expect(r).toHaveProperty("categoryId");
    }
    // At least some should have a non-null categoryId
    const withCategory = results.filter((r: any) => r.categoryId !== null);
    expect(withCategory.length).toBeGreaterThan(0);
  });

  it("should include storeId and categoryId for building navigation URL", async () => {
    const results = await searchProducts("curry");
    expect(results.length).toBeGreaterThan(0);
    const first = results[0];
    expect(first).toHaveProperty("storeId");
    expect(first).toHaveProperty("categoryId");
    expect(first).toHaveProperty("storeName");
    expect(first).toHaveProperty("categoryName");
    // Navigation URL would be: /store/${storeId}?categoryId=${categoryId}
    const url = `/store/${first.storeId}?categoryId=${first.categoryId}`;
    expect(url).toMatch(/^\/store\/\d+\?categoryId=\d+$/);
  });
});
