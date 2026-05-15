import { describe, it, expect } from "vitest";

/**
 * Tests for the featured stores feature:
 * - Database schema has isFeatured column
 * - API returns featured stores
 * - Admin can toggle featured status
 */

const API_BASE = `http://127.0.0.1:${process.env.API_PORT || 3000}`;

describe("Featured Stores", () => {
  it("should have stores.getFeatured endpoint that returns featured stores", async () => {
    const res = await fetch(`${API_BASE}/api/trpc/stores.getFeatured`);
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.result).toBeDefined();
    expect(data.result.data).toBeDefined();
    const stores = data.result.data.json;
    expect(Array.isArray(stores)).toBe(true);
    // Spar and Open All Ours should be featured
    expect(stores.length).toBeGreaterThanOrEqual(2);
    // All returned stores should be active and featured
    for (const store of stores) {
      expect(store.isActive).toBe(true);
      expect(store.isFeatured).toBe(true);
    }
  });

  it("should return featured stores sorted by sortPosition", async () => {
    const res = await fetch(`${API_BASE}/api/trpc/stores.getFeatured`);
    const data = await res.json();
    const stores = data.result.data.json;
    // Check they are sorted by position
    for (let i = 1; i < stores.length; i++) {
      expect(stores[i].sortPosition).toBeGreaterThanOrEqual(stores[i - 1].sortPosition);
    }
  });

  it("should have stores.list endpoint that returns active stores including new ones", async () => {
    const res = await fetch(`${API_BASE}/api/trpc/stores.list`);
    expect(res.ok).toBe(true);
    const data = await res.json();
    const stores = data.result.data.json;
    expect(Array.isArray(stores)).toBe(true);
    // Should include AppleGreen and Treasure Bowl now
    const names = stores.map((s: any) => s.name);
    expect(names).toContain("AppleGreen Balbriggan");
    expect(names).toContain("Treasure Bowl Balbriggan");
  });

  it("should have admin.toggleStoreFeatured endpoint", async () => {
    // Toggle featured off for store 2, then back on
    const toggleOff = await fetch(`${API_BASE}/api/trpc/admin.toggleStoreFeatured`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: { storeId: 2, isFeatured: false } }),
    });
    expect(toggleOff.ok).toBe(true);
    const offData = await toggleOff.json();
    expect(offData.result.data.json.success).toBe(true);

    // Verify it's no longer featured
    const res = await fetch(`${API_BASE}/api/trpc/stores.getFeatured`);
    const data = await res.json();
    const stores = data.result.data.json;
    const store2 = stores.find((s: any) => s.id === 2);
    expect(store2).toBeUndefined(); // Should not be in featured list

    // Toggle back on
    const toggleOn = await fetch(`${API_BASE}/api/trpc/admin.toggleStoreFeatured`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: { storeId: 2, isFeatured: true } }),
    });
    expect(toggleOn.ok).toBe(true);

    // Verify it's featured again
    const res2 = await fetch(`${API_BASE}/api/trpc/stores.getFeatured`);
    const data2 = await res2.json();
    const stores2 = data2.result.data.json;
    const store2Again = stores2.find((s: any) => s.id === 2);
    expect(store2Again).toBeDefined();
    expect(store2Again.isFeatured).toBe(true);
  });
});
