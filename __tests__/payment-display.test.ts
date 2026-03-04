import { describe, it, expect } from "vitest";

describe("Admin Payment Display", () => {
  // Simulates the logic from admin/index.tsx
  function getPaymentLabel(paymentMethod: string): string {
    return paymentMethod === "cash_on_delivery" || paymentMethod === "cash" ? "Cash" : "Card";
  }

  function getPaymentStatus(paymentMethod: string, paymentStatus: string, orderStatus: string): string {
    const isCashDelivered = (paymentMethod === "cash_on_delivery" || paymentMethod === "cash") && orderStatus === "delivered";
    return paymentStatus === "completed" ? "Paid" : isCashDelivered ? "Collected" : paymentStatus === "paid" ? "Paid" : paymentStatus === "pending" ? "Pending" : paymentStatus;
  }

  it("should show 'Cash' for cash_on_delivery orders", () => {
    expect(getPaymentLabel("cash_on_delivery")).toBe("Cash");
  });

  it("should show 'Card' for card orders", () => {
    expect(getPaymentLabel("card")).toBe("Card");
  });

  it("should show 'Cash' for legacy 'cash' value", () => {
    expect(getPaymentLabel("cash")).toBe("Cash");
  });

  it("should show 'Collected' for delivered cash orders", () => {
    expect(getPaymentStatus("cash_on_delivery", "pending", "delivered")).toBe("Collected");
  });

  it("should show 'Pending' for non-delivered cash orders", () => {
    expect(getPaymentStatus("cash_on_delivery", "pending", "preparing")).toBe("Pending");
  });

  it("should show 'Paid' for completed card orders", () => {
    expect(getPaymentStatus("card", "completed", "delivered")).toBe("Paid");
  });

  it("should show 'Paid' for completed cash orders (marked as paid)", () => {
    expect(getPaymentStatus("cash_on_delivery", "completed", "delivered")).toBe("Paid");
  });

  it("should show 'Pending' for pending card orders", () => {
    expect(getPaymentStatus("card", "pending", "pending")).toBe("Pending");
  });

  it("should pass through unknown payment statuses", () => {
    expect(getPaymentStatus("card", "refunded", "cancelled")).toBe("refunded");
  });
});
