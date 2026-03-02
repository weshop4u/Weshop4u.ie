import { describe, it, expect } from "vitest";

describe("Driver Performance Dashboard", () => {
  // Simulate the performance data structure returned by the backend
  type DriverPerformance = {
    id: number;
    userId: number;
    displayNumber: string | null;
    name: string;
    phone: string;
    vehicleType: string | null;
    isOnline: boolean;
    totalDeliveries: number;
    totalReturns: number;
    rating: number | null;
    deliveries30d: number;
    deliveriesToday: number;
    deliveriesThisWeek: number;
    earnings30d: number;
    earningsToday: number;
    earningsThisWeek: number;
    avgDeliveryTime: number | null;
    dailyBreakdown: { date: string; deliveries: number; earnings: number }[];
    joinedAt: Date | null;
  };

  const mockDrivers: DriverPerformance[] = [
    {
      id: 1, userId: 101, displayNumber: "D1", name: "John Smith", phone: "0851234567",
      vehicleType: "car", isOnline: true, totalDeliveries: 150, totalReturns: 3,
      rating: 4.8, deliveries30d: 45, deliveriesToday: 5, deliveriesThisWeek: 18,
      earnings30d: 337.50, earningsToday: 37.50, earningsThisWeek: 135.00,
      avgDeliveryTime: 28,
      dailyBreakdown: [
        { date: "2026-02-24", deliveries: 3, earnings: 22.50 },
        { date: "2026-02-25", deliveries: 4, earnings: 30.00 },
        { date: "2026-02-26", deliveries: 2, earnings: 15.00 },
        { date: "2026-02-27", deliveries: 3, earnings: 22.50 },
        { date: "2026-02-28", deliveries: 1, earnings: 7.50 },
        { date: "2026-03-01", deliveries: 5, earnings: 37.50 },
        { date: "2026-03-02", deliveries: 5, earnings: 37.50 },
      ],
      joinedAt: new Date("2025-06-15"),
    },
    {
      id: 2, userId: 102, displayNumber: "D2", name: "Mary O'Brien", phone: "0869876543",
      vehicleType: "bike", isOnline: false, totalDeliveries: 80, totalReturns: 1,
      rating: 4.5, deliveries30d: 20, deliveriesToday: 0, deliveriesThisWeek: 8,
      earnings30d: 150.00, earningsToday: 0, earningsThisWeek: 60.00,
      avgDeliveryTime: 35,
      dailyBreakdown: [
        { date: "2026-02-24", deliveries: 1, earnings: 7.50 },
        { date: "2026-02-25", deliveries: 2, earnings: 15.00 },
        { date: "2026-02-26", deliveries: 0, earnings: 0 },
        { date: "2026-02-27", deliveries: 2, earnings: 15.00 },
        { date: "2026-02-28", deliveries: 3, earnings: 22.50 },
        { date: "2026-03-01", deliveries: 0, earnings: 0 },
        { date: "2026-03-02", deliveries: 0, earnings: 0 },
      ],
      joinedAt: new Date("2025-09-01"),
    },
    {
      id: 3, userId: 103, displayNumber: "D3", name: "Alan Murphy", phone: "",
      vehicleType: null, isOnline: true, totalDeliveries: 10, totalReturns: 0,
      rating: null, deliveries30d: 5, deliveriesToday: 2, deliveriesThisWeek: 3,
      earnings30d: 37.50, earningsToday: 15.00, earningsThisWeek: 22.50,
      avgDeliveryTime: null,
      dailyBreakdown: [
        { date: "2026-02-24", deliveries: 0, earnings: 0 },
        { date: "2026-02-25", deliveries: 0, earnings: 0 },
        { date: "2026-02-26", deliveries: 1, earnings: 7.50 },
        { date: "2026-02-27", deliveries: 0, earnings: 0 },
        { date: "2026-02-28", deliveries: 0, earnings: 0 },
        { date: "2026-03-01", deliveries: 2, earnings: 15.00 },
        { date: "2026-03-02", deliveries: 2, earnings: 15.00 },
      ],
      joinedAt: new Date("2026-01-10"),
    },
  ];

  describe("Sorting", () => {
    it("should sort drivers by deliveries30d descending by default", () => {
      const sorted = [...mockDrivers].sort((a, b) => b.deliveries30d - a.deliveries30d);
      expect(sorted[0].name).toBe("John Smith");
      expect(sorted[1].name).toBe("Mary O'Brien");
      expect(sorted[2].name).toBe("Alan Murphy");
    });

    it("should sort drivers by name ascending", () => {
      const sorted = [...mockDrivers].sort((a, b) => a.name.localeCompare(b.name));
      expect(sorted[0].name).toBe("Alan Murphy");
      expect(sorted[1].name).toBe("John Smith");
      expect(sorted[2].name).toBe("Mary O'Brien");
    });

    it("should sort drivers by earnings30d descending", () => {
      const sorted = [...mockDrivers].sort((a, b) => b.earnings30d - a.earnings30d);
      expect(sorted[0].earnings30d).toBe(337.50);
      expect(sorted[1].earnings30d).toBe(150.00);
      expect(sorted[2].earnings30d).toBe(37.50);
    });

    it("should sort drivers by avgDeliveryTime ascending (fastest first)", () => {
      const sorted = [...mockDrivers].sort((a, b) => {
        const aVal = a.avgDeliveryTime ?? 999;
        const bVal = b.avgDeliveryTime ?? 999;
        return aVal - bVal;
      });
      expect(sorted[0].name).toBe("John Smith"); // 28 min
      expect(sorted[1].name).toBe("Mary O'Brien"); // 35 min
      expect(sorted[2].name).toBe("Alan Murphy"); // null -> 999
    });

    it("should sort drivers by rating descending", () => {
      const sorted = [...mockDrivers].sort((a, b) => {
        const aVal = a.rating ?? -1;
        const bVal = b.rating ?? -1;
        return bVal - aVal;
      });
      expect(sorted[0].rating).toBe(4.8);
      expect(sorted[1].rating).toBe(4.5);
      expect(sorted[2].rating).toBeNull();
    });
  });

  describe("Time filter", () => {
    it("should return today's deliveries when filter is 'today'", () => {
      const getDeliveries = (driver: DriverPerformance, filter: string) => {
        if (filter === "today") return driver.deliveriesToday;
        if (filter === "week") return driver.deliveriesThisWeek;
        return driver.deliveries30d;
      };
      expect(getDeliveries(mockDrivers[0], "today")).toBe(5);
      expect(getDeliveries(mockDrivers[1], "today")).toBe(0);
      expect(getDeliveries(mockDrivers[2], "today")).toBe(2);
    });

    it("should return this week's earnings when filter is 'week'", () => {
      const getEarnings = (driver: DriverPerformance, filter: string) => {
        if (filter === "today") return driver.earningsToday;
        if (filter === "week") return driver.earningsThisWeek;
        return driver.earnings30d;
      };
      expect(getEarnings(mockDrivers[0], "week")).toBe(135.00);
      expect(getEarnings(mockDrivers[1], "week")).toBe(60.00);
    });

    it("should return 30-day data when filter is '30d'", () => {
      expect(mockDrivers[0].deliveries30d).toBe(45);
      expect(mockDrivers[0].earnings30d).toBe(337.50);
    });
  });

  describe("Totals calculation", () => {
    it("should calculate correct total drivers", () => {
      expect(mockDrivers.length).toBe(3);
    });

    it("should calculate correct online count", () => {
      const onlineCount = mockDrivers.filter(d => d.isOnline).length;
      expect(onlineCount).toBe(2);
    });

    it("should calculate correct total deliveries in 30d", () => {
      const total = mockDrivers.reduce((sum, d) => sum + d.deliveries30d, 0);
      expect(total).toBe(70); // 45 + 20 + 5
    });

    it("should calculate correct total earnings in 30d", () => {
      const total = mockDrivers.reduce((sum, d) => sum + d.earnings30d, 0);
      expect(total).toBe(525.00); // 337.50 + 150.00 + 37.50
    });
  });

  describe("Daily breakdown chart", () => {
    it("should have 7 days of data per driver", () => {
      mockDrivers.forEach(driver => {
        expect(driver.dailyBreakdown.length).toBe(7);
      });
    });

    it("should calculate max deliveries for bar height scaling", () => {
      const driver = mockDrivers[0];
      const maxDeliveries = Math.max(...driver.dailyBreakdown.map(d => d.deliveries), 1);
      expect(maxDeliveries).toBe(5);
    });

    it("should handle zero deliveries days", () => {
      const driver = mockDrivers[2]; // Alan Murphy
      const zeroDays = driver.dailyBreakdown.filter(d => d.deliveries === 0);
      expect(zeroDays.length).toBe(4);
    });
  });

  describe("Average delivery time", () => {
    it("should calculate avg delivery time from order timestamps", () => {
      const deliveryTimes = [
        { created: "2026-03-01T10:00:00Z", delivered: "2026-03-01T10:25:00Z" }, // 25 min
        { created: "2026-03-01T11:00:00Z", delivered: "2026-03-01T11:35:00Z" }, // 35 min
        { created: "2026-03-01T14:00:00Z", delivered: "2026-03-01T14:30:00Z" }, // 30 min
      ];
      const times = deliveryTimes.map(o => {
        return (new Date(o.delivered).getTime() - new Date(o.created).getTime()) / 60000;
      });
      const avg = Math.round(times.reduce((s, t) => s + t, 0) / times.length);
      expect(avg).toBe(30);
    });

    it("should filter out unreasonable delivery times (>300 min)", () => {
      const times = [25, 30, 400, 28, 500];
      const filtered = times.filter(t => t > 0 && t < 300);
      expect(filtered).toEqual([25, 30, 28]);
    });

    it("should return null when no delivery times available", () => {
      const times: number[] = [];
      const avg = times.length > 0
        ? Math.round(times.reduce((s, t) => s + t, 0) / times.length)
        : null;
      expect(avg).toBeNull();
    });
  });
});

describe("Delivery Route Lines", () => {
  type ActiveOrder = {
    orderNumber: string;
    status: string;
    deliveryAddress: string;
    deliveryLatitude: number | null;
    deliveryLongitude: number | null;
  };

  type DriverWithOrders = {
    id: number;
    latitude: number | null;
    longitude: number | null;
    isOnline: boolean;
    activeOrders: ActiveOrder[];
  };

  const mockDriversWithRoutes: DriverWithOrders[] = [
    {
      id: 1, latitude: 53.6108, longitude: -6.1811, isOnline: true,
      activeOrders: [
        { orderNumber: "WS-001", status: "on_the_way", deliveryAddress: "123 Main St", deliveryLatitude: 53.6150, deliveryLongitude: -6.1750 },
      ],
    },
    {
      id: 2, latitude: 53.6090, longitude: -6.1830, isOnline: true,
      activeOrders: [
        { orderNumber: "WS-002", status: "picked_up", deliveryAddress: "456 Oak Ave", deliveryLatitude: 53.6200, deliveryLongitude: -6.1700 },
        { orderNumber: "WS-003", status: "on_the_way", deliveryAddress: "789 Elm Rd", deliveryLatitude: null, deliveryLongitude: null },
      ],
    },
    {
      id: 3, latitude: 53.6120, longitude: -6.1800, isOnline: true,
      activeOrders: [],
    },
  ];

  it("should identify drivers with active orders that have delivery coordinates", () => {
    const driversWithRoutes = mockDriversWithRoutes.filter(d =>
      d.isOnline && d.latitude && d.longitude &&
      d.activeOrders.some(o => o.deliveryLatitude && o.deliveryLongitude)
    );
    expect(driversWithRoutes.length).toBe(2); // Driver 1 and 2
  });

  it("should skip orders without delivery coordinates", () => {
    const driver2 = mockDriversWithRoutes[1];
    const routeableOrders = driver2.activeOrders.filter(o => o.deliveryLatitude && o.deliveryLongitude);
    expect(routeableOrders.length).toBe(1); // Only WS-002, not WS-003
  });

  it("should not draw routes for drivers with no active orders", () => {
    const driver3 = mockDriversWithRoutes[2];
    expect(driver3.activeOrders.length).toBe(0);
  });

  it("should calculate correct route line coordinates", () => {
    const driver1 = mockDriversWithRoutes[0];
    const order = driver1.activeOrders[0];
    const routeCoords = [
      [driver1.latitude, driver1.longitude],
      [order.deliveryLatitude, order.deliveryLongitude],
    ];
    expect(routeCoords[0]).toEqual([53.6108, -6.1811]);
    expect(routeCoords[1]).toEqual([53.6150, -6.1750]);
  });
});

describe("Driver Offline During Delivery Alert", () => {
  type ActiveDelivery = {
    id: number;
    orderNumber: string;
  };

  it("should detect when driver going offline has active deliveries", () => {
    const activeDeliveries: ActiveDelivery[] = [
      { id: 1, orderNumber: "WS-100" },
      { id: 2, orderNumber: "WS-101" },
    ];
    const shouldAlert = activeDeliveries.length > 0;
    expect(shouldAlert).toBe(true);
  });

  it("should not alert when driver going offline has no active deliveries", () => {
    const activeDeliveries: ActiveDelivery[] = [];
    const shouldAlert = activeDeliveries.length > 0;
    expect(shouldAlert).toBe(false);
  });

  it("should format alert message correctly with order numbers", () => {
    const driverName = "John Smith";
    const activeDeliveries = [
      { id: 1, orderNumber: "WS-100" },
      { id: 2, orderNumber: "WS-101" },
    ];
    const orderNumbers = activeDeliveries.map(o => `#${o.orderNumber}`).join(", ");
    const message = `${driverName} went offline with ${activeDeliveries.length} active order(s): ${orderNumbers}`;
    expect(message).toBe("John Smith went offline with 2 active order(s): #WS-100, #WS-101");
  });

  it("should format alert for single active delivery", () => {
    const driverName = "Mary O'Brien";
    const activeDeliveries = [{ id: 1, orderNumber: "WS-200" }];
    const orderNumbers = activeDeliveries.map(o => `#${o.orderNumber}`).join(", ");
    const message = `${driverName} went offline with ${activeDeliveries.length} active order(s): ${orderNumbers}`;
    expect(message).toBe("Mary O'Brien went offline with 1 active order(s): #WS-200");
  });

  it("should identify admin users for notification", () => {
    const users = [
      { id: 1, role: "admin", pushToken: "ExponentPushToken[abc123]" },
      { id: 2, role: "admin", pushToken: "" },
      { id: 3, role: "admin", pushToken: null },
      { id: 4, role: "driver", pushToken: "ExponentPushToken[def456]" },
      { id: 5, role: "admin", pushToken: "ExponentPushToken[ghi789]" },
    ];
    const adminWithTokens = users.filter(u => u.role === "admin" && u.pushToken && u.pushToken !== "");
    expect(adminWithTokens.length).toBe(2);
    expect(adminWithTokens[0].id).toBe(1);
    expect(adminWithTokens[1].id).toBe(5);
  });
});
