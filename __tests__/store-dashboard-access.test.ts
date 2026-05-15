import { describe, it, expect } from "vitest";

/**
 * Tests for store dashboard scoping and access control logic.
 * These test the business logic that determines which features
 * store staff can see based on their store's category.
 */

// Replicate the showDeliView logic from store/index.tsx
function shouldShowDeliView(storeCategory: string): boolean {
  return storeCategory === "convenience" || storeCategory === "grocery";
}

// Replicate the admin access check from admin/_layout.tsx
function shouldBlockAdminAccess(userRole: string): boolean {
  return userRole === "store_staff";
}

// Replicate the storeId resolution logic
function resolveStoreId(params: { storeId?: string }, fallback: number | null): number | null {
  if (params.storeId) return Number(params.storeId);
  return fallback;
}

// Simulate the getMyStore response enrichment
function enrichMyStoreResponse(store: { id: number; name: string; category: string }, staffRole: string) {
  return {
    storeId: store.id,
    storeName: store.name,
    storeCategory: store.category,
    staffRole,
  };
}

describe("Store Dashboard - Deli View Visibility", () => {
  it("shows Deli View for convenience stores", () => {
    expect(shouldShowDeliView("convenience")).toBe(true);
  });

  it("shows Deli View for grocery stores", () => {
    expect(shouldShowDeliView("grocery")).toBe(true);
  });

  it("hides Deli View for restaurant stores (e.g. Treasure Bowl)", () => {
    expect(shouldShowDeliView("restaurant")).toBe(false);
  });

  it("hides Deli View for hardware stores", () => {
    expect(shouldShowDeliView("hardware")).toBe(false);
  });

  it("hides Deli View for pharmacy stores", () => {
    expect(shouldShowDeliView("pharmacy")).toBe(false);
  });

  it("hides Deli View for electrical stores", () => {
    expect(shouldShowDeliView("electrical")).toBe(false);
  });

  it("hides Deli View for clothing stores", () => {
    expect(shouldShowDeliView("clothing")).toBe(false);
  });

  it("hides Deli View for 'other' category stores", () => {
    expect(shouldShowDeliView("other")).toBe(false);
  });
});

describe("Store Dashboard - Admin Access Control", () => {
  it("blocks store_staff from accessing admin routes", () => {
    expect(shouldBlockAdminAccess("store_staff")).toBe(true);
  });

  it("allows admin to access admin routes", () => {
    expect(shouldBlockAdminAccess("admin")).toBe(false);
  });

  it("allows customer role (no admin access but not blocked)", () => {
    expect(shouldBlockAdminAccess("customer")).toBe(false);
  });

  it("allows driver role (no admin access but not blocked)", () => {
    expect(shouldBlockAdminAccess("driver")).toBe(false);
  });
});

describe("Store Dashboard - StoreId Resolution", () => {
  it("uses storeId from URL params when available", () => {
    expect(resolveStoreId({ storeId: "6" }, null)).toBe(6);
  });

  it("falls back to myStore storeId when no URL param", () => {
    expect(resolveStoreId({}, 6)).toBe(6);
  });

  it("returns null when no param and no store link", () => {
    expect(resolveStoreId({}, null)).toBeNull();
  });

  it("prefers URL param over fallback", () => {
    expect(resolveStoreId({ storeId: "3" }, 6)).toBe(3);
  });
});

describe("Store Dashboard - getMyStore Response Enrichment", () => {
  it("includes storeCategory in response for convenience store", () => {
    const result = enrichMyStoreResponse(
      { id: 1, name: "Spar Balbriggan", category: "convenience" },
      "manager"
    );
    expect(result).toEqual({
      storeId: 1,
      storeName: "Spar Balbriggan",
      storeCategory: "convenience",
      staffRole: "manager",
    });
  });

  it("includes storeCategory in response for restaurant store", () => {
    const result = enrichMyStoreResponse(
      { id: 6, name: "Treasure Bowl Balbriggan", category: "restaurant" },
      "manager"
    );
    expect(result).toEqual({
      storeId: 6,
      storeName: "Treasure Bowl Balbriggan",
      storeCategory: "restaurant",
      staffRole: "manager",
    });
  });

  it("works for any future store category", () => {
    const result = enrichMyStoreResponse(
      { id: 99, name: "New Pharmacy", category: "pharmacy" },
      "staff"
    );
    expect(result.storeCategory).toBe("pharmacy");
    expect(result.staffRole).toBe("staff");
  });
});

describe("Store Dashboard - Future Store Compatibility", () => {
  it("new convenience store automatically gets Deli View", () => {
    const store = enrichMyStoreResponse(
      { id: 7, name: "Spar Swords", category: "convenience" },
      "manager"
    );
    expect(shouldShowDeliView(store.storeCategory)).toBe(true);
  });

  it("new restaurant store automatically hides Deli View", () => {
    const store = enrichMyStoreResponse(
      { id: 8, name: "Pizza Palace", category: "restaurant" },
      "manager"
    );
    expect(shouldShowDeliView(store.storeCategory)).toBe(false);
  });

  it("store staff for new store is blocked from admin", () => {
    expect(shouldBlockAdminAccess("store_staff")).toBe(true);
  });

  it("store staff gets correct storeId from store_staff link", () => {
    const store = enrichMyStoreResponse(
      { id: 7, name: "Spar Swords", category: "convenience" },
      "manager"
    );
    expect(store.storeId).toBe(7);
    // Products, categories, hours all use this storeId automatically
  });
});
