import { describe, it, expect } from "vitest";

const API_BASE = "http://127.0.0.1:3000/api/trpc";

async function searchProducts(query: string) {
  const res = await fetch(
    `${API_BASE}/stores.searchProducts?input=${encodeURIComponent(JSON.stringify({ json: { query } }))}`
  );
  const data = await res.json();
  return data.result.data.json;
}

describe("Product search - case insensitive", () => {
  it("should find products with lowercase 'pepsi'", async () => {
    const results = await searchProducts("pepsi");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r: any) => r.name.toLowerCase().includes("pepsi"))).toBe(true);
  });

  it("should find products with uppercase 'Pepsi'", async () => {
    const results = await searchProducts("Pepsi");
    expect(results.length).toBeGreaterThan(0);
  });

  it("should find products with mixed case 'pEpSi'", async () => {
    const results = await searchProducts("pEpSi");
    expect(results.length).toBeGreaterThan(0);
  });

  it("should find coca cola products with lowercase 'coca'", async () => {
    const results = await searchProducts("coca");
    expect(results.length).toBeGreaterThan(0);
  });

  it("should find curry products from multiple stores", async () => {
    const results = await searchProducts("curry");
    expect(results.length).toBeGreaterThan(0);
    // Should include results from multiple stores
    const storeIds = new Set(results.map((r: any) => r.storeId));
    expect(storeIds.size).toBeGreaterThanOrEqual(2);
  });

  it("should return results with required fields", async () => {
    const results = await searchProducts("pepsi");
    expect(results.length).toBeGreaterThan(0);
    const first = results[0];
    expect(first).toHaveProperty("id");
    expect(first).toHaveProperty("name");
    expect(first).toHaveProperty("price");
    expect(first).toHaveProperty("storeId");
    expect(first).toHaveProperty("storeName");
  });

  it("should return empty array for nonsense query", async () => {
    const results = await searchProducts("xyzzyplugh123");
    expect(results).toEqual([]);
  });
});
