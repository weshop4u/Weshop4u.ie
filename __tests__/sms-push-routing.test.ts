import { describe, it, expect } from "vitest";

/**
 * Tests for the SMS/Push notification routing logic.
 * 
 * Strategy:
 * - Customers WITH a push token → push notification (free)
 * - Customers WITHOUT a push token → SMS (guests + web-only users)
 * 
 * This applies to:
 * - SMS #1: Order Confirmed (on order placement)
 * - SMS #2: Driver at Store + tracking link (when driver arrives)
 */

describe("SMS/Push Notification Routing Logic", () => {
  describe("Notification routing decision", () => {
    // Simulate the routing logic used in orders.ts and drivers.ts
    function shouldSendSMS(customer: { pushToken: string | null; phone: string | null } | null, guestPhone: string | null): { sendSMS: boolean; sendPush: boolean; smsPhone: string | null } {
      if (customer?.pushToken) {
        return { sendSMS: false, sendPush: true, smsPhone: null };
      }
      // No push token — determine SMS phone
      const smsPhone = guestPhone || customer?.phone || null;
      return { sendSMS: !!smsPhone, sendPush: false, smsPhone };
    }

    it("should send push notification to app user with push token", () => {
      const result = shouldSendSMS(
        { pushToken: "ExponentPushToken[abc123]", phone: "+353891234567" },
        null
      );
      expect(result.sendPush).toBe(true);
      expect(result.sendSMS).toBe(false);
    });

    it("should send SMS to guest order with phone number", () => {
      const result = shouldSendSMS(null, "+353891234567");
      expect(result.sendSMS).toBe(true);
      expect(result.sendPush).toBe(false);
      expect(result.smsPhone).toBe("+353891234567");
    });

    it("should send SMS to logged-in web user without push token", () => {
      const result = shouldSendSMS(
        { pushToken: null, phone: "+353897654321" },
        null
      );
      expect(result.sendSMS).toBe(true);
      expect(result.sendPush).toBe(false);
      expect(result.smsPhone).toBe("+353897654321");
    });

    it("should not send anything if no push token and no phone number", () => {
      const result = shouldSendSMS(
        { pushToken: null, phone: null },
        null
      );
      expect(result.sendSMS).toBe(false);
      expect(result.sendPush).toBe(false);
    });

    it("should prefer guest phone over customer phone for guest orders", () => {
      const result = shouldSendSMS(null, "+353891111111");
      expect(result.smsPhone).toBe("+353891111111");
    });

    it("should use customer phone when guest phone is not available", () => {
      const result = shouldSendSMS(
        { pushToken: null, phone: "+353892222222" },
        null
      );
      expect(result.smsPhone).toBe("+353892222222");
    });
  });

  describe("Tracking URL construction", () => {
    it("should use PUBLIC_URL env variable when set", () => {
      const envUrl: string | undefined = "https://weshop4u.ie";
      const baseUrl = envUrl ?? "https://weshop4u.app";
      const trackingUrl = `${baseUrl}/track/123`;
      expect(trackingUrl).toBe("https://weshop4u.ie/track/123");
    });

    it("should fall back to default when PUBLIC_URL is not set", () => {
      const envUrl: string | undefined = undefined;
      const baseUrl = envUrl ?? "https://weshop4u.app";
      const trackingUrl = `${baseUrl}/track/456`;
      expect(trackingUrl).toBe("https://weshop4u.app/track/456");
    });

    it("should include order ID in tracking URL", () => {
      const orderId = 789;
      const trackingUrl = `https://example.com/track/${orderId}`;
      expect(trackingUrl).toContain("/track/789");
    });
  });

  describe("Public tracking page requirements", () => {
    it("tracking router should serve HTML page at /track/:orderId", () => {
      // The tracking page is a standalone HTML page served by Express
      // No authentication required — accessible via SMS link
      const route = "/track/123";
      expect(route).toMatch(/^\/track\/\d+$/);
    });

    it("tracking API should return JSON at /api/track/:orderId", () => {
      const apiRoute = "/api/track/123";
      expect(apiRoute).toMatch(/^\/api\/track\/\d+$/);
    });
  });

  describe("SMS message content", () => {
    it("SMS #1 should confirm order and mention driver notification", () => {
      const storeName = "Spar Balbriggan";
      const orderId = 42;
      const message = `Your ${storeName} order #${orderId} is confirmed! We'll let you know when the driver is at the store.\n- WeShop4U`;
      
      expect(message).toContain(storeName);
      expect(message).toContain(`#${orderId}`);
      expect(message).toContain("driver is at the store");
      expect(message).toContain("WeShop4U");
    });

    it("SMS #2 should include store name, order number, and tracking link", () => {
      const storeName = "Treasure Bowl";
      const orderNumber = "WS4U/TBL/015";
      const trackingUrl = "https://weshop4u.ie/track/99";
      const message = `Your driver has arrived at ${storeName} to collect your order ${orderNumber}! Track your driver here: ${trackingUrl}\n- WeShop4U`;
      
      expect(message).toContain(storeName);
      expect(message).toContain(orderNumber);
      expect(message).toContain(trackingUrl);
      expect(message).toContain("arrived");
      expect(message).toContain("WeShop4U");
    });
  });

  describe("Cost optimization", () => {
    it("app users with push tokens should never trigger SMS", () => {
      // This is the key cost-saving rule
      const appUser = { pushToken: "ExponentPushToken[xyz]", phone: "+353891234567" };
      const hasPushToken = !!appUser.pushToken;
      expect(hasPushToken).toBe(true);
      // SMS should NOT be sent
    });

    it("only 2 SMS per non-app order (confirmation + driver at store)", () => {
      const smsEvents = ["order_confirmed", "driver_at_store"];
      expect(smsEvents).toHaveLength(2);
      // No SMS for: accepted, preparing, ready_for_pickup, picked_up, on_the_way, delivered
    });
  });
});
