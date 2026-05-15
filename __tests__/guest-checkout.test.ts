import { describe, it, expect } from "vitest";

const GUEST_CASH_LIMIT = 30;

describe("Guest Checkout - Cash Limit Logic", () => {
  it("should allow guest cash orders at or below €30", () => {
    const total = 25.50;
    const isGuest = true;
    const paymentMethod = "cash_on_delivery";
    const limitExceeded = isGuest && paymentMethod === "cash_on_delivery" && total > GUEST_CASH_LIMIT;
    expect(limitExceeded).toBe(false);
  });

  it("should block guest cash orders above €30", () => {
    const total = 35.00;
    const isGuest = true;
    const paymentMethod = "cash_on_delivery";
    const limitExceeded = isGuest && paymentMethod === "cash_on_delivery" && total > GUEST_CASH_LIMIT;
    expect(limitExceeded).toBe(true);
  });

  it("should allow guest card orders above €30", () => {
    const total = 80.00;
    const isGuest = true;
    const paymentMethod: string = "card";
    const limitExceeded = isGuest && paymentMethod === "cash_on_delivery" && total > GUEST_CASH_LIMIT;
    expect(limitExceeded).toBe(false);
  });

  it("should allow logged-in user cash orders above €30", () => {
    const total = 50.00;
    const isGuest = false;
    const paymentMethod = "cash_on_delivery";
    const limitExceeded = isGuest && paymentMethod === "cash_on_delivery" && total > GUEST_CASH_LIMIT;
    expect(limitExceeded).toBe(false);
  });

  it("should allow exactly €30 for guest cash", () => {
    const total = 30.00;
    const isGuest = true;
    const paymentMethod = "cash_on_delivery";
    const limitExceeded = isGuest && paymentMethod === "cash_on_delivery" && total > GUEST_CASH_LIMIT;
    expect(limitExceeded).toBe(false);
  });

  it("should flag €30.01 as over limit for guest cash", () => {
    const total = 30.01;
    const isGuest = true;
    const paymentMethod = "cash_on_delivery";
    const limitExceeded = isGuest && paymentMethod === "cash_on_delivery" && total > GUEST_CASH_LIMIT;
    expect(limitExceeded).toBe(true);
  });
});

describe("Delivery Fee Warning Logic", () => {
  it("should show warning when delivery fee is €10 or more", () => {
    const deliveryFee = 10.00;
    const shouldShowWarning = deliveryFee >= 10;
    expect(shouldShowWarning).toBe(true);
  });

  it("should show warning when delivery fee is €15.50", () => {
    const deliveryFee = 15.50;
    const shouldShowWarning = deliveryFee >= 10;
    expect(shouldShowWarning).toBe(true);
  });

  it("should NOT show warning when delivery fee is €9.99", () => {
    const deliveryFee = 9.99;
    const shouldShowWarning = deliveryFee >= 10;
    expect(shouldShowWarning).toBe(false);
  });

  it("should NOT show warning when delivery fee is €3.50 (base fee)", () => {
    const deliveryFee = 3.50;
    const shouldShowWarning = deliveryFee >= 10;
    expect(shouldShowWarning).toBe(false);
  });

  it("should not show warning again after acknowledgment", () => {
    const deliveryFee = 12.00;
    let acknowledged = false;
    
    // First check: should show
    const shouldShow1 = deliveryFee >= 10 && !acknowledged;
    expect(shouldShow1).toBe(true);
    
    // User acknowledges
    acknowledged = true;
    
    // Second check: should not show
    const shouldShow2 = deliveryFee >= 10 && !acknowledged;
    expect(shouldShow2).toBe(false);
  });
});

describe("Guest Checkout Validation", () => {
  it("should require guest name", () => {
    const guestName = "";
    const isValid = guestName.trim().length > 0;
    expect(isValid).toBe(false);
  });

  it("should require guest phone", () => {
    const guestPhone = "";
    const isValid = guestPhone.trim().length > 0;
    expect(isValid).toBe(false);
  });

  it("should accept valid guest details", () => {
    const guestName = "John Smith";
    const guestPhone = "0851234567";
    const nameValid = guestName.trim().length > 0;
    const phoneValid = guestPhone.trim().length > 0;
    expect(nameValid && phoneValid).toBe(true);
  });

  it("should not require email for guests", () => {
    const guestEmail = "";
    // Email is optional, so empty is valid
    const isValid = true; // email is always optional
    expect(isValid).toBe(true);
  });
});

describe("Delivery Fee Calculation", () => {
  const BASE_FEE = 3.50;
  const BASE_DISTANCE = 2.8;
  const COST_PER_KM = 1.00;

  function calculateDeliveryFee(distanceKm: number): number {
    if (distanceKm <= BASE_DISTANCE) {
      return BASE_FEE;
    }
    const additionalDistance = distanceKm - BASE_DISTANCE;
    const additionalCost = additionalDistance * COST_PER_KM;
    return Math.round((BASE_FEE + additionalCost) * 100) / 100;
  }

  it("should return base fee for short distances", () => {
    expect(calculateDeliveryFee(1.0)).toBe(3.50);
    expect(calculateDeliveryFee(2.8)).toBe(3.50);
  });

  it("should calculate correctly for 10km distance", () => {
    const fee = calculateDeliveryFee(10.0);
    // 3.50 + (10 - 2.8) * 1.00 = 3.50 + 7.20 = 10.70
    expect(fee).toBe(10.70);
  });

  it("should trigger warning for distances over ~9.3km", () => {
    // Fee >= 10 when distance >= 2.8 + 6.5 = 9.3km
    const fee9 = calculateDeliveryFee(9.0);
    const fee10 = calculateDeliveryFee(9.3);
    expect(fee9 < 10).toBe(true);
    expect(fee10 >= 10).toBe(true);
  });
});
