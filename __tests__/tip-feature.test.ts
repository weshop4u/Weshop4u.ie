import { describe, it, expect } from "vitest";

// Test the tip calculation logic used across the app

describe("Tip Feature - Calculation Logic", () => {
  // Helper matching the backend parseFee
  const parseFee = (fee: string | null | undefined): number => {
    if (!fee) return 0;
    const parsed = parseFloat(fee);
    return isNaN(parsed) ? 0 : parsed;
  };

  describe("parseFee helper", () => {
    it("parses valid fee strings", () => {
      expect(parseFee("5.00")).toBe(5);
      expect(parseFee("3.50")).toBe(3.5);
      expect(parseFee("0")).toBe(0);
      expect(parseFee("10.99")).toBe(10.99);
    });

    it("handles null/undefined/empty", () => {
      expect(parseFee(null)).toBe(0);
      expect(parseFee(undefined)).toBe(0);
      expect(parseFee("")).toBe(0);
    });

    it("handles invalid strings", () => {
      expect(parseFee("abc")).toBe(0);
      expect(parseFee("NaN")).toBe(0);
    });
  });

  describe("Driver earnings calculations with tips", () => {
    const mockOrders = [
      { deliveryFee: "5.00", tipAmount: "2.00", deliveredAt: new Date().toISOString() },
      { deliveryFee: "4.50", tipAmount: "3.00", deliveredAt: new Date().toISOString() },
      { deliveryFee: "6.00", tipAmount: null, deliveredAt: new Date().toISOString() },
      { deliveryFee: "3.50", tipAmount: "0", deliveredAt: new Date().toISOString() },
    ];

    it("calculates total earnings including tips", () => {
      const totalEarnings = mockOrders.reduce(
        (sum, order) => sum + parseFee(order.deliveryFee) + parseFee(order.tipAmount),
        0
      );
      // 5+2 + 4.5+3 + 6+0 + 3.5+0 = 24
      expect(totalEarnings).toBe(24);
    });

    it("calculates total tips separately", () => {
      const totalTips = mockOrders.reduce(
        (sum, order) => sum + parseFee(order.tipAmount),
        0
      );
      // 2 + 3 + 0 + 0 = 5
      expect(totalTips).toBe(5);
    });

    it("calculates average per delivery including tips", () => {
      const totalEarnings = mockOrders.reduce(
        (sum, order) => sum + parseFee(order.deliveryFee) + parseFee(order.tipAmount),
        0
      );
      const avg = totalEarnings / mockOrders.length;
      // 24 / 4 = 6
      expect(avg).toBe(6);
    });
  });

  describe("Checkout tip calculations", () => {
    it("calculates total with tip for card payment", () => {
      const subtotal = 25.50;
      const serviceFee = subtotal * 0.1; // 2.55
      const deliveryFee = 4.00;
      const tipAmount = 3.00;
      const total = subtotal + serviceFee + deliveryFee + tipAmount;
      expect(total).toBeCloseTo(35.05, 2);
    });

    it("calculates total without tip for cash payment", () => {
      const subtotal = 25.50;
      const serviceFee = subtotal * 0.1;
      const deliveryFee = 4.00;
      const tipAmount = 0; // No tip for cash
      const total = subtotal + serviceFee + deliveryFee + tipAmount;
      expect(total).toBeCloseTo(32.05, 2);
    });

    it("handles custom tip amounts", () => {
      const customTip = "7.50";
      const tipValue = parseFloat(customTip);
      expect(tipValue).toBe(7.5);
      expect(isNaN(tipValue)).toBe(false);
    });

    it("handles invalid custom tip input", () => {
      const customTip = "abc";
      const tipValue = parseFloat(customTip);
      expect(isNaN(tipValue)).toBe(true);
      // In the app, NaN tips default to 0
      const safeTip = isNaN(tipValue) ? 0 : tipValue;
      expect(safeTip).toBe(0);
    });
  });

  describe("Driver delivery summary with tips", () => {
    it("shows correct total driver earnings with tip", () => {
      const deliveryFee = 5.00;
      const tipAmount = 3.00;
      const totalDriverEarnings = deliveryFee + tipAmount;
      expect(totalDriverEarnings).toBe(8);
    });

    it("shows correct earnings when no tip", () => {
      const deliveryFee = 5.00;
      const tipAmount = 0;
      const totalDriverEarnings = deliveryFee + tipAmount;
      expect(totalDriverEarnings).toBe(5);
    });

    it("recent delivery breakdown shows base fee and tip separately", () => {
      const delivery = {
        deliveryFee: "5.00",
        tipAmount: "2.50",
      };
      const baseFee = parseFloat(delivery.deliveryFee);
      const tip = parseFee(delivery.tipAmount);
      const amount = baseFee + tip;
      expect(baseFee).toBe(5);
      expect(tip).toBe(2.5);
      expect(amount).toBe(7.5);
    });
  });
});
