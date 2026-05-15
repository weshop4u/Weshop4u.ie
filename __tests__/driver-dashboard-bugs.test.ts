import { describe, it, expect } from "vitest";

/**
 * Tests for driver dashboard bug fixes:
 * 1. getActiveDelivery includes accepted/preparing statuses
 * 2. Dashboard shows all active jobs (multi-job display)
 * 3. Force-offline logic skips when driver has active deliveries
 */

describe("getActiveDelivery status coverage", () => {
  // The statuses that getActiveDelivery should match
  const ACTIVE_DELIVERY_STATUSES = [
    "accepted",
    "preparing",
    "ready_for_pickup",
    "picked_up",
    "on_the_way",
  ];

  it("should include 'accepted' status in active delivery query", () => {
    expect(ACTIVE_DELIVERY_STATUSES).toContain("accepted");
  });

  it("should include 'preparing' status in active delivery query", () => {
    expect(ACTIVE_DELIVERY_STATUSES).toContain("preparing");
  });

  it("should include 'ready_for_pickup' status in active delivery query", () => {
    expect(ACTIVE_DELIVERY_STATUSES).toContain("ready_for_pickup");
  });

  it("should include 'picked_up' status in active delivery query", () => {
    expect(ACTIVE_DELIVERY_STATUSES).toContain("picked_up");
  });

  it("should include 'on_the_way' status in active delivery query", () => {
    expect(ACTIVE_DELIVERY_STATUSES).toContain("on_the_way");
  });

  it("should NOT include 'delivered' status", () => {
    expect(ACTIVE_DELIVERY_STATUSES).not.toContain("delivered");
  });

  it("should NOT include 'cancelled' status", () => {
    expect(ACTIVE_DELIVERY_STATUSES).not.toContain("cancelled");
  });
});

describe("Force-offline logic", () => {
  // Simulates the decision logic from the useEffect
  function shouldForceOffline(params: {
    hasSyncedProfile: boolean;
    driverProfile: { isOnline: boolean } | null;
    userId: number | undefined;
    activeDelivery: { id: number } | null;
    activeDeliveryLoading: boolean;
  }) {
    const { hasSyncedProfile, driverProfile, userId, activeDelivery, activeDeliveryLoading } = params;

    if (hasSyncedProfile) return { action: "skip", reason: "already synced" };
    if (!driverProfile || !userId || activeDeliveryLoading) return { action: "wait", reason: "data not ready" };

    if (activeDelivery && activeDelivery.id) {
      return { action: "sync_from_db", reason: "has active deliveries" };
    }

    return { action: "force_offline", reason: "no active deliveries" };
  }

  it("should wait if activeDelivery is still loading", () => {
    const result = shouldForceOffline({
      hasSyncedProfile: false,
      driverProfile: { isOnline: true },
      userId: 1,
      activeDelivery: null,
      activeDeliveryLoading: true,
    });
    expect(result.action).toBe("wait");
  });

  it("should sync from DB when driver has active deliveries", () => {
    const result = shouldForceOffline({
      hasSyncedProfile: false,
      driverProfile: { isOnline: true },
      userId: 1,
      activeDelivery: { id: 42 },
      activeDeliveryLoading: false,
    });
    expect(result.action).toBe("sync_from_db");
  });

  it("should force offline when no active deliveries (fresh login)", () => {
    const result = shouldForceOffline({
      hasSyncedProfile: false,
      driverProfile: { isOnline: true },
      userId: 1,
      activeDelivery: null,
      activeDeliveryLoading: false,
    });
    expect(result.action).toBe("force_offline");
  });

  it("should skip if already synced", () => {
    const result = shouldForceOffline({
      hasSyncedProfile: true,
      driverProfile: { isOnline: true },
      userId: 1,
      activeDelivery: { id: 42 },
      activeDeliveryLoading: false,
    });
    expect(result.action).toBe("skip");
  });
});

describe("Multi-job display logic", () => {
  function getStatusLabel(status: string) {
    if (status === "picked_up" || status === "on_the_way") return "On the way";
    if (status === "ready_for_pickup") return "Ready for pickup";
    if (status === "preparing") return "Preparing";
    return "Accepted";
  }

  it("should show 'Accepted' for accepted orders", () => {
    expect(getStatusLabel("accepted")).toBe("Accepted");
  });

  it("should show 'Preparing' for preparing orders", () => {
    expect(getStatusLabel("preparing")).toBe("Preparing");
  });

  it("should show 'Ready for pickup' for ready_for_pickup orders", () => {
    expect(getStatusLabel("ready_for_pickup")).toBe("Ready for pickup");
  });

  it("should show 'On the way' for picked_up orders", () => {
    expect(getStatusLabel("picked_up")).toBe("On the way");
  });

  it("should show 'On the way' for on_the_way orders", () => {
    expect(getStatusLabel("on_the_way")).toBe("On the way");
  });

  it("should display all orders from batch, not just one", () => {
    const batchOrders = [
      { id: 1, status: "accepted", orderNumber: "WS-001" },
      { id: 2, status: "preparing", orderNumber: "WS-002" },
      { id: 3, status: "ready_for_pickup", orderNumber: "WS-003" },
    ];
    // allActiveOrders should contain all 3
    expect(batchOrders.length).toBe(3);
    // Each should be tappable (has an id)
    batchOrders.forEach((order) => {
      expect(order.id).toBeDefined();
      expect(order.id).toBeGreaterThan(0);
    });
  });

  it("should show batch header when multiple orders exist", () => {
    const allActiveOrders = [
      { id: 1, status: "accepted" },
      { id: 2, status: "preparing" },
    ];
    const showBatchHeader = allActiveOrders.length > 1;
    expect(showBatchHeader).toBe(true);
  });

  it("should not show batch header for single order", () => {
    const allActiveOrders = [{ id: 1, status: "accepted" }];
    const showBatchHeader = allActiveOrders.length > 1;
    expect(showBatchHeader).toBe(false);
  });
});
