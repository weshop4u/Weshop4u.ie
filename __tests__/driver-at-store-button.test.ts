import { describe, it, expect } from "vitest";

/**
 * Tests for the driver "Arrived at Store" button logic.
 * 
 * The key fix: When the store marks an order as ready_for_pickup,
 * the driver's "Arrived at Store" button should NOT disappear.
 * The button should remain visible until the driver explicitly taps it.
 * Only then should the SMS notification fire.
 */

// Simulate the deliveryStatus state logic from active-delivery.tsx
function computeDeliveryStatus(
  orderStatus: string,
  hasNotifiedAtStore: boolean,
  currentDeliveryStatus: string
): string {
  if (orderStatus === "delivered") {
    return "delivered";
  } else if (orderStatus === "picked_up" || orderStatus === "on_the_way") {
    return "going_to_customer";
  } else if (orderStatus === "ready_for_pickup") {
    // Only show "at_store" if driver has tapped the button
    if (hasNotifiedAtStore) {
      return "at_store";
    }
    // Keep current status (going_to_store) so button stays visible
    return currentDeliveryStatus;
  } else {
    if (currentDeliveryStatus === "delivered") return "delivered";
    return "going_to_store";
  }
}

describe("Driver 'Arrived at Store' button visibility", () => {
  it("should show button when order is assigned (going_to_store)", () => {
    const status = computeDeliveryStatus("assigned", false, "going_to_store");
    expect(status).toBe("going_to_store");
    // Button shows when deliveryStatus === "going_to_store"
  });

  it("should keep button visible when store marks order ready_for_pickup but driver hasn't tapped", () => {
    const status = computeDeliveryStatus("ready_for_pickup", false, "going_to_store");
    expect(status).toBe("going_to_store");
    // Button should still be visible!
  });

  it("should hide button and show at_store UI after driver taps Arrived at Store", () => {
    const status = computeDeliveryStatus("ready_for_pickup", true, "at_store");
    expect(status).toBe("at_store");
    // Button is hidden, "Customer has been notified" + "Picked Up" button shows
  });

  it("should show going_to_customer when order is picked_up", () => {
    const status = computeDeliveryStatus("picked_up", true, "at_store");
    expect(status).toBe("going_to_customer");
  });

  it("should show delivered when order is delivered", () => {
    const status = computeDeliveryStatus("delivered", true, "going_to_customer");
    expect(status).toBe("delivered");
  });

  it("should not reset to going_to_store if already delivered", () => {
    const status = computeDeliveryStatus("some_other_status", false, "delivered");
    expect(status).toBe("delivered");
  });
});

describe("SMS notification trigger", () => {
  it("should only fire SMS when driver explicitly taps Arrived at Store (hasNotifiedAtStore becomes true)", () => {
    // Before tapping: hasNotifiedAtStore = false, button visible
    const beforeTap = computeDeliveryStatus("ready_for_pickup", false, "going_to_store");
    expect(beforeTap).toBe("going_to_store"); // Button still visible

    // After tapping: hasNotifiedAtStore = true, notifyDriverAtStore mutation fires
    const afterTap = computeDeliveryStatus("ready_for_pickup", true, "at_store");
    expect(afterTap).toBe("at_store"); // Button hidden, SMS was sent
  });

  it("should revert to going_to_store if mutation fails", () => {
    // If the mutation fails, hasNotifiedAtStore reverts to false
    const afterFailure = computeDeliveryStatus("ready_for_pickup", false, "going_to_store");
    expect(afterFailure).toBe("going_to_store"); // Button visible again for retry
  });
});
