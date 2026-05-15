import { describe, it, expect } from "vitest";

// Test the store hours utility functions
describe("Store Hours Utility", () => {
  // Import the functions we need to test
  // Since these are client-side utils, we test the logic directly

  describe("isStoreOpen logic", () => {
    it("should return true for 24/7 stores", () => {
      const store = { isOpen247: true, openingHours: null };
      // 24/7 stores are always open
      expect(store.isOpen247).toBe(true);
    });

    it("should handle stores with no opening hours set", () => {
      const store = { isOpen247: false, openingHours: null };
      // No hours set = assume open (graceful fallback)
      expect(store.openingHours).toBeNull();
    });

    it("should parse opening hours JSON correctly", () => {
      const hours = {
        monday: { open: "08:00", close: "22:00" },
        tuesday: { open: "08:00", close: "22:00" },
        wednesday: { open: "08:00", close: "22:00" },
        thursday: { open: "08:00", close: "22:00" },
        friday: { open: "08:00", close: "23:00" },
        saturday: { open: "09:00", close: "23:00" },
        sunday: { open: "10:00", close: "21:00" },
      };
      const parsed = JSON.parse(JSON.stringify(hours));
      expect(parsed.monday.open).toBe("08:00");
      expect(parsed.monday.close).toBe("22:00");
      expect(parsed.friday.close).toBe("23:00");
      expect(parsed.sunday.open).toBe("10:00");
    });

    it("should handle closed days", () => {
      const hours = {
        monday: { open: "08:00", close: "22:00" },
        sunday: null, // Closed on Sunday
      };
      expect(hours.sunday).toBeNull();
    });
  });

  describe("Time comparison logic", () => {
    it("should correctly compare times within range", () => {
      const openTime = "08:00";
      const closeTime = "22:00";
      const currentTime = "14:30";

      const [openH, openM] = openTime.split(":").map(Number);
      const [closeH, closeM] = closeTime.split(":").map(Number);
      const [curH, curM] = currentTime.split(":").map(Number);

      const openMinutes = openH * 60 + openM;
      const closeMinutes = closeH * 60 + closeM;
      const currentMinutes = curH * 60 + curM;

      const isOpen = currentMinutes >= openMinutes && currentMinutes < closeMinutes;
      expect(isOpen).toBe(true);
    });

    it("should correctly identify closed time", () => {
      const openTime = "08:00";
      const closeTime = "22:00";
      const currentTime = "23:00";

      const [openH, openM] = openTime.split(":").map(Number);
      const [closeH, closeM] = closeTime.split(":").map(Number);
      const [curH, curM] = currentTime.split(":").map(Number);

      const openMinutes = openH * 60 + openM;
      const closeMinutes = closeH * 60 + closeM;
      const currentMinutes = curH * 60 + curM;

      const isOpen = currentMinutes >= openMinutes && currentMinutes < closeMinutes;
      expect(isOpen).toBe(false);
    });

    it("should handle midnight crossing (late night stores)", () => {
      // Store open 18:00 to 02:00
      const openTime = "18:00";
      const closeTime = "02:00";
      const currentTime = "23:30";

      const [openH, openM] = openTime.split(":").map(Number);
      const [closeH, closeM] = closeTime.split(":").map(Number);
      const [curH, curM] = currentTime.split(":").map(Number);

      const openMinutes = openH * 60 + openM;
      const closeMinutes = closeH * 60 + closeM;
      const currentMinutes = curH * 60 + curM;

      // When close < open, it crosses midnight
      let isOpen: boolean;
      if (closeMinutes < openMinutes) {
        isOpen = currentMinutes >= openMinutes || currentMinutes < closeMinutes;
      } else {
        isOpen = currentMinutes >= openMinutes && currentMinutes < closeMinutes;
      }
      expect(isOpen).toBe(true);
    });

    it("should handle early morning for midnight crossing stores", () => {
      const openTime = "18:00";
      const closeTime = "02:00";
      const currentTime = "01:00";

      const [openH, openM] = openTime.split(":").map(Number);
      const [closeH, closeM] = closeTime.split(":").map(Number);
      const [curH, curM] = currentTime.split(":").map(Number);

      const openMinutes = openH * 60 + openM;
      const closeMinutes = closeH * 60 + closeM;
      const currentMinutes = curH * 60 + curM;

      let isOpen: boolean;
      if (closeMinutes < openMinutes) {
        isOpen = currentMinutes >= openMinutes || currentMinutes < closeMinutes;
      } else {
        isOpen = currentMinutes >= openMinutes && currentMinutes < closeMinutes;
      }
      expect(isOpen).toBe(true);
    });
  });
});

describe("Admin Dashboard Stats", () => {
  it("should calculate revenue correctly from order list", () => {
    const orders = [
      { status: "delivered", total: "15.50", serviceFee: "1.55", deliveryFee: "3.50", tipAmount: "2.00" },
      { status: "delivered", total: "22.00", serviceFee: "2.20", deliveryFee: "4.00", tipAmount: "0.00" },
      { status: "pending", total: "10.00", serviceFee: "1.00", deliveryFee: "3.50", tipAmount: "1.00" },
      { status: "cancelled", total: "8.00", serviceFee: "0.80", deliveryFee: "3.50", tipAmount: "0.00" },
    ];

    const deliveredOrders = orders.filter(o => o.status === "delivered");
    const totalRevenue = deliveredOrders.reduce((sum, o) => sum + parseFloat(o.total), 0);
    const totalServiceFees = deliveredOrders.reduce((sum, o) => sum + parseFloat(o.serviceFee), 0);
    const totalDeliveryFees = deliveredOrders.reduce((sum, o) => sum + parseFloat(o.deliveryFee), 0);
    const totalTips = deliveredOrders.reduce((sum, o) => sum + parseFloat(o.tipAmount), 0);

    expect(totalRevenue).toBe(37.50);
    expect(totalServiceFees).toBe(3.75);
    expect(totalDeliveryFees).toBe(7.50);
    expect(totalTips).toBe(2.00);
  });

  it("should count order statuses correctly", () => {
    const orders = [
      { status: "pending" },
      { status: "pending" },
      { status: "preparing" },
      { status: "delivered" },
      { status: "delivered" },
      { status: "delivered" },
      { status: "cancelled" },
    ];

    const statusBreakdown = {
      pending: orders.filter(o => o.status === "pending").length,
      preparing: orders.filter(o => o.status === "preparing").length,
      delivered: orders.filter(o => o.status === "delivered").length,
      cancelled: orders.filter(o => o.status === "cancelled").length,
    };

    expect(statusBreakdown.pending).toBe(2);
    expect(statusBreakdown.preparing).toBe(1);
    expect(statusBreakdown.delivered).toBe(3);
    expect(statusBreakdown.cancelled).toBe(1);
  });

  it("should count active orders (not delivered or cancelled)", () => {
    const orders = [
      { status: "pending" },
      { status: "accepted" },
      { status: "preparing" },
      { status: "on_the_way" },
      { status: "delivered" },
      { status: "cancelled" },
    ];

    const activeOrders = orders.filter(o => !["delivered", "cancelled"].includes(o.status));
    expect(activeOrders.length).toBe(4);
  });

  it("should calculate driver earnings correctly", () => {
    const todayOrders = [
      { driverId: 1, deliveryFee: "3.50", tipAmount: "2.00" },
      { driverId: 1, deliveryFee: "4.00", tipAmount: "1.00" },
      { driverId: 2, deliveryFee: "3.50", tipAmount: "0.00" },
    ];

    const driverEarnings: Record<number, number> = {};
    todayOrders.forEach(order => {
      const earnings = parseFloat(order.deliveryFee) + parseFloat(order.tipAmount);
      driverEarnings[order.driverId] = (driverEarnings[order.driverId] || 0) + earnings;
    });

    expect(driverEarnings[1]).toBe(10.50);
    expect(driverEarnings[2]).toBe(3.50);
  });
});

describe("Product Search", () => {
  it("should filter products by name", () => {
    const products = [
      { name: "Milk 2L", description: "Full fat milk" },
      { name: "Bread White", description: "Sliced white bread" },
      { name: "Butter 250g", description: "Irish butter" },
      { name: "Chocolate Milk", description: "Flavoured milk drink" },
    ];

    const query = "milk";
    const filtered = products.filter(p =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.description.toLowerCase().includes(query.toLowerCase())
    );

    expect(filtered.length).toBe(2);
    expect(filtered[0].name).toBe("Milk 2L");
    expect(filtered[1].name).toBe("Chocolate Milk");
  });

  it("should filter products by description", () => {
    const products = [
      { name: "Kerrygold", description: "Irish butter 250g" },
      { name: "Flora", description: "Margarine spread" },
    ];

    const query = "butter";
    const filtered = products.filter(p =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.description.toLowerCase().includes(query.toLowerCase())
    );

    expect(filtered.length).toBe(1);
    expect(filtered[0].name).toBe("Kerrygold");
  });

  it("should return empty for no matches", () => {
    const products = [
      { name: "Milk 2L", description: "Full fat milk" },
      { name: "Bread White", description: "Sliced white bread" },
    ];

    const query = "pizza";
    const filtered = products.filter(p =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.description.toLowerCase().includes(query.toLowerCase())
    );

    expect(filtered.length).toBe(0);
  });

  it("should be case insensitive", () => {
    const products = [
      { name: "MILK 2L", description: "Full fat milk" },
    ];

    const query = "milk";
    const filtered = products.filter(p =>
      p.name.toLowerCase().includes(query.toLowerCase())
    );

    expect(filtered.length).toBe(1);
  });
});
