import { describe, it, expect } from "vitest";

// ============================================================
// Settlement Calculation Logic Tests
// ============================================================

// Replicate the core settlement calculation from the endShift endpoint
function calculateSettlement(orders: Array<{
  deliveryFee: string | null;
  tipAmount: string | null;
  total: string | null;
  paymentMethod: string | null;
}>) {
  let cashCollected = 0;
  let deliveryFeesEarned = 0;
  let cardTipsEarned = 0;

  for (const order of orders) {
    const fee = parseFloat(order.deliveryFee || "0");
    const tip = parseFloat(order.tipAmount || "0");
    const total = parseFloat(order.total || "0");

    deliveryFeesEarned += fee;

    if (order.paymentMethod === "cash_on_delivery") {
      cashCollected += total;
    } else {
      cardTipsEarned += tip;
    }
  }

  const netOwed = Math.round((cashCollected - (deliveryFeesEarned + cardTipsEarned)) * 100) / 100;

  return {
    cashCollected: Math.round(cashCollected * 100) / 100,
    deliveryFeesEarned: Math.round(deliveryFeesEarned * 100) / 100,
    cardTipsEarned: Math.round(cardTipsEarned * 100) / 100,
    netOwed,
  };
}

describe("Settlement Calculation - calculateSettlement", () => {
  it("should return zeroes for empty order list", () => {
    const result = calculateSettlement([]);
    expect(result.cashCollected).toBe(0);
    expect(result.deliveryFeesEarned).toBe(0);
    expect(result.cardTipsEarned).toBe(0);
    expect(result.netOwed).toBe(0);
  });

  it("should calculate correctly for a single cash order", () => {
    const result = calculateSettlement([
      { deliveryFee: "3.50", tipAmount: "0.00", total: "25.50", paymentMethod: "cash_on_delivery" },
    ]);
    expect(result.cashCollected).toBe(25.50);
    expect(result.deliveryFeesEarned).toBe(3.50);
    expect(result.cardTipsEarned).toBe(0);
    // Driver collected 25.50 in cash, earned 3.50 in fees
    // Net owed = 25.50 - 3.50 = 22.00 (driver owes admin)
    expect(result.netOwed).toBe(22.00);
  });

  it("should calculate correctly for a single card order", () => {
    const result = calculateSettlement([
      { deliveryFee: "3.50", tipAmount: "2.00", total: "25.50", paymentMethod: "card" },
    ]);
    expect(result.cashCollected).toBe(0);
    expect(result.deliveryFeesEarned).toBe(3.50);
    expect(result.cardTipsEarned).toBe(2.00);
    // Driver collected no cash, earned 3.50 fees + 2.00 tips
    // Net owed = 0 - (3.50 + 2.00) = -5.50 (admin owes driver)
    expect(result.netOwed).toBe(-5.50);
  });

  it("should calculate correctly for mixed cash and card orders", () => {
    const result = calculateSettlement([
      { deliveryFee: "3.50", tipAmount: "0.00", total: "30.00", paymentMethod: "cash_on_delivery" },
      { deliveryFee: "3.50", tipAmount: "1.50", total: "20.00", paymentMethod: "card" },
      { deliveryFee: "3.50", tipAmount: "0.00", total: "15.00", paymentMethod: "cash_on_delivery" },
    ]);
    // Cash collected: 30.00 + 15.00 = 45.00
    expect(result.cashCollected).toBe(45.00);
    // Delivery fees: 3.50 * 3 = 10.50
    expect(result.deliveryFeesEarned).toBe(10.50);
    // Card tips: 1.50 (only from card order)
    expect(result.cardTipsEarned).toBe(1.50);
    // Net owed: 45.00 - (10.50 + 1.50) = 33.00
    expect(result.netOwed).toBe(33.00);
  });

  it("should handle null/empty values gracefully", () => {
    const result = calculateSettlement([
      { deliveryFee: null, tipAmount: null, total: null, paymentMethod: "cash_on_delivery" },
      { deliveryFee: "", tipAmount: "", total: "", paymentMethod: "card" },
    ]);
    expect(result.cashCollected).toBe(0);
    expect(result.deliveryFeesEarned).toBe(0);
    expect(result.cardTipsEarned).toBe(0);
    expect(result.netOwed).toBe(0);
  });

  it("should handle scenario where admin owes driver (all card orders)", () => {
    const result = calculateSettlement([
      { deliveryFee: "4.00", tipAmount: "3.00", total: "40.00", paymentMethod: "card" },
      { deliveryFee: "4.00", tipAmount: "2.00", total: "35.00", paymentMethod: "card" },
    ]);
    expect(result.cashCollected).toBe(0);
    expect(result.deliveryFeesEarned).toBe(8.00);
    expect(result.cardTipsEarned).toBe(5.00);
    // Net owed: 0 - (8 + 5) = -13.00 (admin owes driver)
    expect(result.netOwed).toBe(-13.00);
  });

  it("should handle exact break-even scenario", () => {
    // Driver collects 10 in cash, earns 10 in fees
    const result = calculateSettlement([
      { deliveryFee: "10.00", tipAmount: "0.00", total: "10.00", paymentMethod: "cash_on_delivery" },
    ]);
    expect(result.netOwed).toBe(0);
  });

  it("should handle floating point precision correctly", () => {
    const result = calculateSettlement([
      { deliveryFee: "3.33", tipAmount: "0.00", total: "10.10", paymentMethod: "cash_on_delivery" },
      { deliveryFee: "3.33", tipAmount: "0.00", total: "10.10", paymentMethod: "cash_on_delivery" },
      { deliveryFee: "3.33", tipAmount: "0.00", total: "10.10", paymentMethod: "cash_on_delivery" },
    ]);
    // Cash: 30.30, Fees: 9.99
    // Net: 30.30 - 9.99 = 20.31
    expect(result.cashCollected).toBe(30.30);
    expect(result.deliveryFeesEarned).toBe(9.99);
    expect(result.netOwed).toBe(20.31);
  });
});

// ============================================================
// Unsettled Balance Aggregation Tests
// ============================================================

function calculateUnsettledBalance(shifts: Array<{ netOwed: string | null }>) {
  return Math.round(
    shifts.reduce((sum, s) => sum + parseFloat(s.netOwed || "0"), 0) * 100
  ) / 100;
}

describe("Unsettled Balance Aggregation", () => {
  it("should return 0 for empty shifts", () => {
    expect(calculateUnsettledBalance([])).toBe(0);
  });

  it("should sum positive net owed values", () => {
    const shifts = [
      { netOwed: "22.00" },
      { netOwed: "15.50" },
    ];
    expect(calculateUnsettledBalance(shifts)).toBe(37.50);
  });

  it("should sum mixed positive and negative values", () => {
    const shifts = [
      { netOwed: "22.00" },  // driver owes
      { netOwed: "-5.50" },  // admin owes
    ];
    expect(calculateUnsettledBalance(shifts)).toBe(16.50);
  });

  it("should handle null values", () => {
    const shifts = [
      { netOwed: null },
      { netOwed: "10.00" },
    ];
    expect(calculateUnsettledBalance(shifts)).toBe(10.00);
  });

  it("should handle all negative values (admin owes driver)", () => {
    const shifts = [
      { netOwed: "-13.00" },
      { netOwed: "-7.50" },
    ];
    expect(calculateUnsettledBalance(shifts)).toBe(-20.50);
  });
});

// ============================================================
// Shift Start Time Determination Tests
// ============================================================

describe("Shift Start Time Logic", () => {
  it("should use last shift endedAt when available", () => {
    const lastShiftEndedAt = "2026-03-02T18:00:00Z";
    const shiftStart = new Date(lastShiftEndedAt);
    expect(shiftStart.toISOString()).toBe("2026-03-02T18:00:00.000Z");
  });

  it("should use start of today when no previous shift exists", () => {
    const shiftStart = new Date();
    shiftStart.setHours(0, 0, 0, 0);
    expect(shiftStart.getHours()).toBe(0);
    expect(shiftStart.getMinutes()).toBe(0);
    expect(shiftStart.getSeconds()).toBe(0);
  });
});

// ============================================================
// Net Owed Display Logic Tests
// ============================================================

describe("Net Owed Display Logic", () => {
  it("should show 'You owe the store' for positive net owed", () => {
    const netOwed = 22.00;
    const label = netOwed > 0 ? "You owe the store" : netOwed < 0 ? "The store owes you" : "Settled";
    expect(label).toBe("You owe the store");
  });

  it("should show 'The store owes you' for negative net owed", () => {
    const netOwed = -5.50;
    const label = netOwed > 0 ? "You owe the store" : netOwed < 0 ? "The store owes you" : "Settled";
    expect(label).toBe("The store owes you");
  });

  it("should show 'Settled' for zero net owed", () => {
    const netOwed = 0;
    const label = netOwed > 0 ? "You owe the store" : netOwed < 0 ? "The store owes you" : "Settled";
    expect(label).toBe("Settled");
  });

  it("should format absolute value correctly", () => {
    const netOwed = -5.50;
    const formatted = `\u20AC${Math.abs(netOwed).toFixed(2)}`;
    expect(formatted).toBe("\u20AC5.50");
  });
});

// ============================================================
// Admin Settlement Summary Tests
// ============================================================

describe("Admin Settlement Summary", () => {
  function buildDriverSettlement(shifts: Array<{ netOwed: string; cashCollected: string; deliveryFeesEarned: string; cardTipsEarned: string; totalJobs: number }>) {
    const totalUnsettled = shifts.reduce((sum, s) => sum + parseFloat(s.netOwed), 0);
    const totalCashCollected = shifts.reduce((sum, s) => sum + parseFloat(s.cashCollected), 0);
    const totalFeesEarned = shifts.reduce((sum, s) => sum + parseFloat(s.deliveryFeesEarned), 0);
    const totalCardTips = shifts.reduce((sum, s) => sum + parseFloat(s.cardTipsEarned), 0);
    const totalJobs = shifts.reduce((sum, s) => sum + s.totalJobs, 0);

    return {
      totalUnsettled: Math.round(totalUnsettled * 100) / 100,
      totalCashCollected: Math.round(totalCashCollected * 100) / 100,
      totalFeesEarned: Math.round(totalFeesEarned * 100) / 100,
      totalCardTips: Math.round(totalCardTips * 100) / 100,
      totalJobs,
      unsettledShiftCount: shifts.length,
    };
  }

  it("should aggregate multiple shifts correctly", () => {
    const result = buildDriverSettlement([
      { netOwed: "22.00", cashCollected: "25.50", deliveryFeesEarned: "3.50", cardTipsEarned: "0.00", totalJobs: 1 },
      { netOwed: "-5.50", cashCollected: "0.00", deliveryFeesEarned: "3.50", cardTipsEarned: "2.00", totalJobs: 1 },
    ]);
    expect(result.totalUnsettled).toBe(16.50);
    expect(result.totalCashCollected).toBe(25.50);
    expect(result.totalFeesEarned).toBe(7.00);
    expect(result.totalCardTips).toBe(2.00);
    expect(result.totalJobs).toBe(2);
    expect(result.unsettledShiftCount).toBe(2);
  });

  it("should filter drivers with no unsettled shifts", () => {
    const driverSettlements = [
      { unsettledShiftCount: 2, totalUnsettled: 16.50 },
      { unsettledShiftCount: 0, totalUnsettled: 0 },
      { unsettledShiftCount: 1, totalUnsettled: -5.00 },
    ];
    const filtered = driverSettlements.filter(d => d.unsettledShiftCount > 0 || d.totalUnsettled !== 0);
    expect(filtered.length).toBe(2);
  });

  it("should sort by absolute unsettled amount descending", () => {
    const driverSettlements = [
      { name: "A", totalUnsettled: 5.00 },
      { name: "B", totalUnsettled: -20.00 },
      { name: "C", totalUnsettled: 10.00 },
    ];
    driverSettlements.sort((a, b) => Math.abs(b.totalUnsettled) - Math.abs(a.totalUnsettled));
    expect(driverSettlements[0].name).toBe("B"); // abs(20)
    expect(driverSettlements[1].name).toBe("C"); // abs(10)
    expect(driverSettlements[2].name).toBe("A"); // abs(5)
  });
});
