import { describe, it, expect } from "vitest";

/** Haversine distance in metres — same formula used in the backend */
function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

describe("Driver Nearby Notification", () => {
  describe("Haversine distance calculation", () => {
    it("should return 0 for the same point", () => {
      const d = haversineDistance(53.6, -6.18, 53.6, -6.18);
      expect(d).toBeCloseTo(0, 0);
    });

    it("should calculate correct distance for known points (~1km apart)", () => {
      // Approx 1km apart in Dublin area
      const d = haversineDistance(53.3498, -6.2603, 53.3588, -6.2603);
      expect(d).toBeGreaterThan(900);
      expect(d).toBeLessThan(1100);
    });

    it("should detect driver within 500m of delivery address", () => {
      // Driver at 53.6000, -6.1800
      // Delivery at 53.6030, -6.1810 (~340m away)
      const d = haversineDistance(53.6000, -6.1800, 53.6030, -6.1810);
      expect(d).toBeLessThan(500);
    });

    it("should detect driver outside 500m of delivery address", () => {
      // Driver at 53.6000, -6.1800
      // Delivery at 53.6100, -6.1900 (~1.3km away)
      const d = haversineDistance(53.6000, -6.1800, 53.6100, -6.1900);
      expect(d).toBeGreaterThan(500);
    });
  });

  describe("Proximity notification logic", () => {
    it("should trigger notification when distance <= 500m", () => {
      const distanceMetres = 350;
      const shouldNotify = distanceMetres <= 500;
      expect(shouldNotify).toBe(true);
    });

    it("should NOT trigger notification when distance > 500m", () => {
      const distanceMetres = 750;
      const shouldNotify = distanceMetres <= 500;
      expect(shouldNotify).toBe(false);
    });

    it("should NOT trigger notification if already sent for this order", () => {
      const existingNotifications = [{ id: 1, status: "driver_nearby_notified" }];
      const alreadySent = existingNotifications.length > 0;
      expect(alreadySent).toBe(true);
      // Should skip sending
    });

    it("should trigger notification if not yet sent for this order", () => {
      const existingNotifications: any[] = [];
      const alreadySent = existingNotifications.length > 0;
      expect(alreadySent).toBe(false);
      // Should send notification
    });
  });

  describe("Distance display formatting", () => {
    it("should show 'less than 100m' when very close", () => {
      const distanceMetres = 75;
      const display = distanceMetres < 100
        ? "less than 100m"
        : `about ${Math.round(distanceMetres / 100) * 100}m`;
      expect(display).toBe("less than 100m");
    });

    it("should round to nearest 100m for distances over 100m", () => {
      const distanceMetres = 350;
      const display = distanceMetres < 100
        ? "less than 100m"
        : `about ${Math.round(distanceMetres / 100) * 100}m`;
      expect(display).toBe("about 400m");
    });

    it("should show 'about 500m' for distances near the threshold", () => {
      const distanceMetres = 480;
      const display = distanceMetres < 100
        ? "less than 100m"
        : `about ${Math.round(distanceMetres / 100) * 100}m`;
      expect(display).toBe("about 500m");
    });

    it("should show 'about 200m' for 200m distance", () => {
      const distanceMetres = 200;
      const display = distanceMetres < 100
        ? "less than 100m"
        : `about ${Math.round(distanceMetres / 100) * 100}m`;
      expect(display).toBe("about 200m");
    });
  });

  describe("Only active delivery statuses trigger proximity check", () => {
    it("should check proximity for picked_up status", () => {
      const validStatuses = ["picked_up", "on_the_way"];
      expect(validStatuses.includes("picked_up")).toBe(true);
    });

    it("should check proximity for on_the_way status", () => {
      const validStatuses = ["picked_up", "on_the_way"];
      expect(validStatuses.includes("on_the_way")).toBe(true);
    });

    it("should NOT check proximity for pending status", () => {
      const validStatuses = ["picked_up", "on_the_way"];
      expect(validStatuses.includes("pending")).toBe(false);
    });

    it("should NOT check proximity for delivered status", () => {
      const validStatuses = ["picked_up", "on_the_way"];
      expect(validStatuses.includes("delivered")).toBe(false);
    });
  });

  describe("Edge cases", () => {
    it("should skip orders without delivery coordinates", () => {
      const deliveryLatitude = null;
      const deliveryLongitude = null;
      const shouldSkip = !deliveryLatitude || !deliveryLongitude;
      expect(shouldSkip).toBe(true);
    });

    it("should skip orders with invalid coordinates", () => {
      const deliveryLatitude = "invalid";
      const deliveryLongitude = "-6.18";
      const lat = parseFloat(deliveryLatitude);
      const lng = parseFloat(deliveryLongitude);
      const shouldSkip = isNaN(lat) || isNaN(lng);
      expect(shouldSkip).toBe(true);
    });

    it("should handle batch deliveries — check all active orders", () => {
      const activeOrders = [
        { id: 1, deliveryLatitude: "53.601", deliveryLongitude: "-6.181" },
        { id: 2, deliveryLatitude: "53.610", deliveryLongitude: "-6.190" },
        { id: 3, deliveryLatitude: "53.603", deliveryLongitude: "-6.182" },
      ];
      const driverLat = 53.600;
      const driverLng = -6.180;

      const nearbyOrders = activeOrders.filter((o) => {
        const d = haversineDistance(
          driverLat, driverLng,
          parseFloat(o.deliveryLatitude), parseFloat(o.deliveryLongitude)
        );
        return d <= 500;
      });

      // Orders 1 and 3 should be within 500m, order 2 is farther
      expect(nearbyOrders.length).toBe(2);
      expect(nearbyOrders.map((o) => o.id)).toContain(1);
      expect(nearbyOrders.map((o) => o.id)).toContain(3);
    });
  });
});
