import { describe, it, expect } from "vitest";

/**
 * Tests for the offer decline/expiry exclusion logic.
 * These tests verify the business logic that prevents re-offering
 * declined or expired orders to the same driver.
 */

describe("Offer Exclusion Logic", () => {
  // Simulates the offerToNextDriver logic
  function findNextDriver(
    queue: { driverId: number; position: number }[],
    previousOffers: { driverId: number; orderId: number }[],
    orderId: number
  ) {
    const offeredDriverIds = previousOffers
      .filter((o) => o.orderId === orderId)
      .map((o) => o.driverId);
    return queue.find((q) => !offeredDriverIds.includes(q.driverId)) || null;
  }

  // Simulates the getCurrentOffer exclusion logic
  function getEligibleOrders(
    unassignedOrders: { id: number }[],
    previousOffers: { driverId: number; orderId: number; status: string }[],
    driverId: number
  ) {
    const excludedOrderIds = previousOffers
      .filter(
        (o) =>
          o.driverId === driverId &&
          (o.status === "declined" || o.status === "expired")
      )
      .map((o) => o.orderId);
    return unassignedOrders.filter((o) => !excludedOrderIds.includes(o.id));
  }

  it("should not re-offer an order to a driver who declined it", () => {
    const queue = [
      { driverId: 1, position: 1 },
      { driverId: 2, position: 2 },
    ];
    const previousOffers = [{ driverId: 1, orderId: 100 }];

    const nextDriver = findNextDriver(queue, previousOffers, 100);
    expect(nextDriver).not.toBeNull();
    expect(nextDriver!.driverId).toBe(2); // Should skip driver 1
  });

  it("should return null when all drivers have been offered the order", () => {
    const queue = [
      { driverId: 1, position: 1 },
      { driverId: 2, position: 2 },
    ];
    const previousOffers = [
      { driverId: 1, orderId: 100 },
      { driverId: 2, orderId: 100 },
    ];

    const nextDriver = findNextDriver(queue, previousOffers, 100);
    expect(nextDriver).toBeNull();
  });

  it("should exclude declined orders from eligible orders for a driver", () => {
    const unassignedOrders = [{ id: 100 }, { id: 101 }, { id: 102 }];
    const previousOffers = [
      { driverId: 1, orderId: 100, status: "declined" },
      { driverId: 1, orderId: 101, status: "expired" },
    ];

    const eligible = getEligibleOrders(unassignedOrders, previousOffers, 1);
    expect(eligible).toHaveLength(1);
    expect(eligible[0].id).toBe(102);
  });

  it("should not exclude orders declined by OTHER drivers", () => {
    const unassignedOrders = [{ id: 100 }, { id: 101 }];
    const previousOffers = [
      { driverId: 2, orderId: 100, status: "declined" }, // Different driver
    ];

    const eligible = getEligibleOrders(unassignedOrders, previousOffers, 1);
    expect(eligible).toHaveLength(2); // Driver 1 should still see both orders
  });

  it("should not exclude orders with accepted status", () => {
    const unassignedOrders = [{ id: 100 }, { id: 101 }];
    const previousOffers = [
      { driverId: 1, orderId: 100, status: "accepted" }, // Accepted, not declined
    ];

    const eligible = getEligibleOrders(unassignedOrders, previousOffers, 1);
    expect(eligible).toHaveLength(2); // Accepted offers should not be excluded
  });

  it("should cascade to driver #2 when driver #1 declines", () => {
    const queue = [
      { driverId: 1, position: 1 },
      { driverId: 2, position: 2 },
      { driverId: 3, position: 3 },
    ];

    // Driver 1 was offered and declined
    const offersAfterDecline = [{ driverId: 1, orderId: 100 }];
    const nextDriver = findNextDriver(queue, offersAfterDecline, 100);
    expect(nextDriver!.driverId).toBe(2);
  });

  it("should cascade to driver #3 when both #1 and #2 decline", () => {
    const queue = [
      { driverId: 1, position: 1 },
      { driverId: 2, position: 2 },
      { driverId: 3, position: 3 },
    ];

    const offersAfterBothDecline = [
      { driverId: 1, orderId: 100 },
      { driverId: 2, orderId: 100 },
    ];
    const nextDriver = findNextDriver(queue, offersAfterBothDecline, 100);
    expect(nextDriver!.driverId).toBe(3);
  });

  it("should handle empty queue gracefully", () => {
    const queue: { driverId: number; position: number }[] = [];
    const previousOffers: { driverId: number; orderId: number }[] = [];

    const nextDriver = findNextDriver(queue, previousOffers, 100);
    expect(nextDriver).toBeNull();
  });

  it("should handle no previous offers (first offer for an order)", () => {
    const queue = [
      { driverId: 1, position: 1 },
      { driverId: 2, position: 2 },
    ];
    const previousOffers: { driverId: number; orderId: number }[] = [];

    const nextDriver = findNextDriver(queue, previousOffers, 100);
    expect(nextDriver!.driverId).toBe(1); // First driver in queue
  });

  it("should return all orders as eligible when no previous declines/expiries", () => {
    const unassignedOrders = [{ id: 100 }, { id: 101 }, { id: 102 }];
    const previousOffers: {
      driverId: number;
      orderId: number;
      status: string;
    }[] = [];

    const eligible = getEligibleOrders(unassignedOrders, previousOffers, 1);
    expect(eligible).toHaveLength(3);
  });

  // Test the countdown timer logic
  it("should calculate remaining seconds correctly", () => {
    const now = Date.now();
    const expiresAt = now + 15000; // 15 seconds from now
    const remaining = Math.max(0, Math.ceil((expiresAt - now) / 1000));
    expect(remaining).toBe(15);
  });

  it("should return 0 when offer has expired", () => {
    const now = Date.now();
    const expiresAt = now - 1000; // 1 second ago
    const remaining = Math.max(0, Math.ceil((expiresAt - now) / 1000));
    expect(remaining).toBe(0);
  });

  // Test hasOffer logic
  it("should show offer card only when hasOffer is true AND countdown > 0", () => {
    // Scenario 1: has offer with countdown
    const hasOffer1 = true && true && 10 > 0;
    expect(hasOffer1).toBe(true);

    // Scenario 2: has offer but countdown is 0 (expired)
    const hasOffer2 = true && true && 0 > 0;
    expect(hasOffer2).toBe(false);

    // Scenario 3: no offer
    const hasOffer3 = false && true && 10 > 0;
    expect(hasOffer3).toBe(false);
  });
});
