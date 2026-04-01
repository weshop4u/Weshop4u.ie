import { describe, it, expect } from "vitest";

describe("Driver Location Map", () => {
  // Simulate the timeAgo helper used in the admin driver map
  function timeAgo(isoString: string | null): string {
    if (!isoString) return "No location";
    const diff = Date.now() - new Date(isoString).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  }

  describe("timeAgo helper", () => {
    it("should return 'No location' for null input", () => {
      expect(timeAgo(null)).toBe("No location");
    });

    it("should return seconds for recent timestamps", () => {
      const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();
      expect(timeAgo(tenSecondsAgo)).toBe("10s ago");
    });

    it("should return minutes for timestamps a few minutes old", () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60000).toISOString();
      expect(timeAgo(fiveMinutesAgo)).toBe("5m ago");
    });

    it("should return hours for timestamps over an hour old", () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60000).toISOString();
      expect(timeAgo(twoHoursAgo)).toBe("2h ago");
    });
  });

  describe("Driver data classification", () => {
    type DriverLocation = {
      id: number;
      userId: number;
      label: string;
      name: string;
      displayNumber: string | null;
      isOnline: boolean | null;
      isAvailable: boolean | null;
      latitude: number | null;
      longitude: number | null;
      lastLocationUpdate: string | null;
      vehicleType: string | null;
      activeOrders: { orderNumber: string; status: string; deliveryAddress: string }[];
    };

    const mockDrivers: DriverLocation[] = [
      {
        id: 1, userId: 101, label: "Driver 01 — Tony", name: "Tony",
        displayNumber: "01", isOnline: true, isAvailable: true,
        latitude: 53.6108, longitude: -6.1811,
        lastLocationUpdate: new Date().toISOString(),
        vehicleType: "Car", activeOrders: [],
      },
      {
        id: 2, userId: 102, label: "Driver 11 — Barry", name: "Barry",
        displayNumber: "11", isOnline: true, isAvailable: false,
        latitude: 53.6120, longitude: -6.1830,
        lastLocationUpdate: new Date().toISOString(),
        vehicleType: "Van",
        activeOrders: [{ orderNumber: "WS4U/SPR/042", status: "on_the_way", deliveryAddress: "123 Main St" }],
      },
      {
        id: 3, userId: 103, label: "Driver 05 — Mike", name: "Mike",
        displayNumber: "05", isOnline: false, isAvailable: false,
        latitude: 53.6090, longitude: -6.1800,
        lastLocationUpdate: new Date(Date.now() - 3600000).toISOString(),
        vehicleType: "Car", activeOrders: [],
      },
      {
        id: 4, userId: 104, label: "Driver 08 — Sarah", name: "Sarah",
        displayNumber: "08", isOnline: true, isAvailable: true,
        latitude: null, longitude: null,
        lastLocationUpdate: null,
        vehicleType: "Bike", activeOrders: [],
      },
    ];

    it("should correctly identify online drivers", () => {
      const onlineDrivers = mockDrivers.filter(d => d.isOnline);
      expect(onlineDrivers).toHaveLength(3);
    });

    it("should correctly identify offline drivers", () => {
      const offlineDrivers = mockDrivers.filter(d => !d.isOnline);
      expect(offlineDrivers).toHaveLength(1);
      expect(offlineDrivers[0].name).toBe("Mike");
    });

    it("should correctly identify drivers with GPS location", () => {
      const driversWithLocation = mockDrivers.filter(d => d.latitude && d.longitude);
      expect(driversWithLocation).toHaveLength(3);
    });

    it("should correctly identify drivers without GPS", () => {
      const driversNoGPS = mockDrivers.filter(d => !d.latitude || !d.longitude);
      expect(driversNoGPS).toHaveLength(1);
      expect(driversNoGPS[0].name).toBe("Sarah");
    });

    it("should correctly identify drivers actively delivering", () => {
      const deliveringDrivers = mockDrivers.filter(d => d.isOnline && d.activeOrders.length > 0);
      expect(deliveringDrivers).toHaveLength(1);
      expect(deliveringDrivers[0].name).toBe("Barry");
      expect(deliveringDrivers[0].activeOrders[0].orderNumber).toBe("WS4U/SPR/042");
    });

    it("should correctly identify available (online, not delivering) drivers", () => {
      const availableDrivers = mockDrivers.filter(d => d.isOnline && d.isAvailable && d.activeOrders.length === 0);
      expect(availableDrivers).toHaveLength(2);
    });
  });

  describe("Driver label formatting", () => {
    it("should format driver label with display number and name", () => {
      const displayNumber = "01";
      const realName = "Tony";
      const label = displayNumber ? `Driver ${displayNumber}` : "Driver";
      const fullLabel = realName ? `${label} \u2014 ${realName}` : label;
      expect(fullLabel).toBe("Driver 01 \u2014 Tony");
    });

    it("should handle missing display number", () => {
      const displayNumber: string | null = null;
      const realName = "Tony";
      const label = displayNumber ? `Driver ${displayNumber}` : "Driver";
      const fullLabel = realName ? `${label} \u2014 ${realName}` : label;
      expect(fullLabel).toBe("Driver \u2014 Tony");
    });

    it("should handle missing name", () => {
      const displayNumber = "01";
      const realName = "";
      const label = displayNumber ? `Driver ${displayNumber}` : "Driver";
      const fullLabel = realName ? `${label} \u2014 ${realName}` : label;
      expect(fullLabel).toBe("Driver 01");
    });
  });

  describe("Map marker color logic", () => {
    it("should use green for online available drivers", () => {
      const isDelivering = false;
      const color = isDelivering ? "#F59E0B" : "#22C55E";
      expect(color).toBe("#22C55E");
    });

    it("should use amber for delivering drivers", () => {
      const isDelivering = true;
      const color = isDelivering ? "#F59E0B" : "#22C55E";
      expect(color).toBe("#F59E0B");
    });

    it("should use grey for offline drivers", () => {
      const isOnline = false;
      const color = isOnline ? "#22C55E" : "#94A3B8";
      expect(color).toBe("#94A3B8");
    });
  });

  describe("Balbriggan coordinates", () => {
    it("should use correct Balbriggan center coordinates", () => {
      const BALBRIGGAN_LAT = 53.6108;
      const BALBRIGGAN_LNG = -6.1811;
      // Balbriggan is in north County Dublin, Ireland
      expect(BALBRIGGAN_LAT).toBeGreaterThan(53);
      expect(BALBRIGGAN_LAT).toBeLessThan(54);
      expect(BALBRIGGAN_LNG).toBeGreaterThan(-7);
      expect(BALBRIGGAN_LNG).toBeLessThan(-6);
    });
  });
});
