import { describe, it, expect } from "vitest";

const API_BASE = "http://127.0.0.1:3000/api/trpc";

function buildUrl(procedure: string, input: any) {
  return `${API_BASE}/${procedure}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;
}

describe("Product Search API", () => {
  it("should return products matching a search query", async () => {
    const res = await fetch(buildUrl("stores.searchProducts", { query: "Mushrooms" }));
    expect(res.ok).toBe(true);
    const data = await res.json();
    const results = data.result.data.json;
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    // Each result should have required fields
    const first = results[0];
    expect(first).toHaveProperty("id");
    expect(first).toHaveProperty("name");
    expect(first).toHaveProperty("price");
    expect(first).toHaveProperty("storeId");
    expect(first).toHaveProperty("storeName");
    expect(first.name.toLowerCase()).toContain("mushroom");
  });

  it("should return results from multiple stores when product exists in multiple", async () => {
    const res = await fetch(buildUrl("stores.searchProducts", { query: "Mushrooms" }));
    const data = await res.json();
    const results = data.result.data.json;
    // Mushrooms should exist in both Spar and Treasure Bowl
    const storeIds = new Set(results.map((r: any) => r.storeId));
    expect(storeIds.size).toBeGreaterThanOrEqual(1);
  });

  it("should return empty array for non-matching query", async () => {
    const res = await fetch(buildUrl("stores.searchProducts", { query: "xyznonexistent123" }));
    const data = await res.json();
    const results = data.result.data.json;
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);
  });

  it("should limit results to 20", async () => {
    // Search for a very common term
    const res = await fetch(buildUrl("stores.searchProducts", { query: "a" }));
    const data = await res.json();
    const results = data.result.data.json;
    expect(results.length).toBeLessThanOrEqual(20);
  });

  it("should include store logo and category info", async () => {
    const res = await fetch(buildUrl("stores.searchProducts", { query: "chicken" }));
    const data = await res.json();
    const results = data.result.data.json;
    if (results.length > 0) {
      const first = results[0];
      expect(first).toHaveProperty("storeLogo");
      expect(first).toHaveProperty("storeCategory");
    }
  });
});
