import { describe, it, expect } from "vitest";

// Test the parseFee helper logic
describe("Driver Stats - parseFee helper", () => {
  const parseFee = (fee: string | null | undefined): number => {
    if (!fee) return 0;
    const parsed = parseFloat(fee);
    return isNaN(parsed) ? 0 : parsed;
  };

  it("should parse valid delivery fee", () => {
    expect(parseFee("3.50")).toBe(3.5);
    expect(parseFee("5.00")).toBe(5);
    expect(parseFee("0.15")).toBe(0.15);
  });

  it("should return 0 for null or undefined fee", () => {
    expect(parseFee(null)).toBe(0);
    expect(parseFee(undefined)).toBe(0);
    expect(parseFee("")).toBe(0);
  });

  it("should return 0 for invalid fee strings", () => {
    expect(parseFee("abc")).toBe(0);
    expect(parseFee("NaN")).toBe(0);
  });
});

// Test the getDeliveryDate helper logic
describe("Driver Stats - getDeliveryDate helper", () => {
  const getDeliveryDate = (order: { deliveredAt: Date | null; createdAt: Date }): Date => {
    if (order.deliveredAt) return new Date(order.deliveredAt);
    return new Date(order.createdAt);
  };

  it("should use deliveredAt when available", () => {
    const deliveredAt = new Date("2026-02-12T10:00:00Z");
    const createdAt = new Date("2026-02-11T08:00:00Z");
    const result = getDeliveryDate({ deliveredAt, createdAt });
    expect(result.getTime()).toBe(deliveredAt.getTime());
  });

  it("should fall back to createdAt when deliveredAt is null", () => {
    const createdAt = new Date("2026-02-11T08:00:00Z");
    const result = getDeliveryDate({ deliveredAt: null, createdAt });
    expect(result.getTime()).toBe(createdAt.getTime());
  });
});

// Test the updateStatus timestamp logic
describe("Order Status Update - Timestamp Assignment", () => {
  const getTimestampFields = (status: string) => {
    const updateFields: Record<string, any> = { status };
    const now = new Date();

    if (status === "accepted") {
      updateFields.acceptedAt = now;
    } else if (status === "picked_up" || status === "on_the_way") {
      updateFields.pickedUpAt = now;
    } else if (status === "delivered") {
      updateFields.deliveredAt = now;
    } else if (status === "cancelled") {
      updateFields.cancelledAt = now;
    }

    return updateFields;
  };

  it("should set acceptedAt for accepted status", () => {
    const fields = getTimestampFields("accepted");
    expect(fields.status).toBe("accepted");
    expect(fields.acceptedAt).toBeInstanceOf(Date);
    expect(fields.deliveredAt).toBeUndefined();
  });

  it("should set pickedUpAt for picked_up status", () => {
    const fields = getTimestampFields("picked_up");
    expect(fields.status).toBe("picked_up");
    expect(fields.pickedUpAt).toBeInstanceOf(Date);
    expect(fields.deliveredAt).toBeUndefined();
  });

  it("should set deliveredAt for delivered status", () => {
    const fields = getTimestampFields("delivered");
    expect(fields.status).toBe("delivered");
    expect(fields.deliveredAt).toBeInstanceOf(Date);
    expect(fields.pickedUpAt).toBeUndefined();
  });

  it("should set cancelledAt for cancelled status", () => {
    const fields = getTimestampFields("cancelled");
    expect(fields.status).toBe("cancelled");
    expect(fields.cancelledAt).toBeInstanceOf(Date);
    expect(fields.deliveredAt).toBeUndefined();
  });

  it("should not set any timestamp for pending status", () => {
    const fields = getTimestampFields("pending");
    expect(fields.status).toBe("pending");
    expect(Object.keys(fields)).toEqual(["status"]);
  });
});

// Test stats calculation logic
describe("Driver Stats - Calculation", () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const parseFee = (fee: string | null | undefined): number => {
    if (!fee) return 0;
    const parsed = parseFloat(fee);
    return isNaN(parsed) ? 0 : parsed;
  };

  const getDeliveryDate = (order: any): Date => {
    if (order.deliveredAt) return new Date(order.deliveredAt);
    return new Date(order.createdAt);
  };

  it("should correctly calculate today's earnings from orders delivered today", () => {
    const now = new Date();
    const orders = [
      { deliveryFee: "3.50", deliveredAt: now, createdAt: now },
      { deliveryFee: "4.00", deliveredAt: now, createdAt: now },
      { deliveryFee: "2.50", deliveredAt: new Date("2026-01-01"), createdAt: new Date("2026-01-01") },
    ];

    const todayOrders = orders.filter(order => getDeliveryDate(order) >= today);
    const todayEarnings = todayOrders.reduce((sum, order) => sum + parseFee(order.deliveryFee), 0);

    expect(todayOrders.length).toBe(2);
    expect(todayEarnings).toBe(7.5);
  });

  it("should correctly calculate total earnings including orders with null deliveredAt", () => {
    const orders = [
      { deliveryFee: "3.50", deliveredAt: null, createdAt: new Date() },
      { deliveryFee: "4.00", deliveredAt: null, createdAt: new Date() },
      { deliveryFee: null, deliveredAt: null, createdAt: new Date() },
    ];

    const totalEarnings = orders.reduce((sum, order) => sum + parseFee(order.deliveryFee), 0);
    expect(totalEarnings).toBe(7.5);
  });
});
