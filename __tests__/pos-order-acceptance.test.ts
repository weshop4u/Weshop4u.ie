import { describe, it, expect } from "vitest";

/**
 * Tests for POS Order Acceptance feature.
 * Validates the backend endpoints that the POS APK calls.
 */

const API_BASE = "http://127.0.0.1:3000/api/trpc";

describe("POS Order Acceptance - Backend Endpoints", () => {
  describe("store.getPendingOrdersForPOS", () => {
    it("should return an array of pending orders for a valid store", async () => {
      const input = encodeURIComponent(JSON.stringify({ json: { storeId: 1 } }));
      const res = await fetch(`${API_BASE}/store.getPendingOrdersForPOS?input=${input}`);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.result).toBeDefined();
      expect(data.result.data).toBeDefined();
      expect(Array.isArray(data.result.data.json)).toBe(true);
    });

    it("should return empty array when no pending orders exist", async () => {
      // Store 999 likely has no orders
      const input = encodeURIComponent(JSON.stringify({ json: { storeId: 999 } }));
      const res = await fetch(`${API_BASE}/store.getPendingOrdersForPOS?input=${input}`);
      expect(res.status).toBe(200);

      const data = await res.json();
      const orders = data.result.data.json;
      expect(Array.isArray(orders)).toBe(true);
      expect(orders.length).toBe(0);
    });

    it("should return orders with required fields when orders exist", async () => {
      const input = encodeURIComponent(JSON.stringify({ json: { storeId: 1 } }));
      const res = await fetch(`${API_BASE}/store.getPendingOrdersForPOS?input=${input}`);
      const data = await res.json();
      const orders = data.result.data.json;

      // If there are pending orders, validate their structure
      if (orders.length > 0) {
        const order = orders[0];
        expect(order).toHaveProperty("id");
        expect(order).toHaveProperty("orderNumber");
        expect(order).toHaveProperty("total");
        expect(order).toHaveProperty("itemCount");
        expect(order).toHaveProperty("totalQuantity");
        expect(order).toHaveProperty("customerName");
        expect(order).toHaveProperty("paymentMethod");
        expect(order).toHaveProperty("createdAt");
        expect(order).toHaveProperty("items");
        expect(Array.isArray(order.items)).toBe(true);

        if (order.items.length > 0) {
          const item = order.items[0];
          expect(item).toHaveProperty("name");
          expect(item).toHaveProperty("quantity");
          expect(item).toHaveProperty("subtotal");
        }
      }
    });
  });

  describe("store.acceptOrderFromPOS", () => {
    it("should handle accepting a non-existent order gracefully", async () => {
      const res = await fetch(`${API_BASE}/store.acceptOrderFromPOS`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: { orderId: 999999, storeId: 1 } }),
      });
      expect(res.status).toBe(200);

      const data = await res.json();
      const result = data.result.data.json;
      // Should return alreadyAccepted or success:false for non-existent order
      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("alreadyAccepted");
    });

    it("should return proper structure on accept response", async () => {
      const res = await fetch(`${API_BASE}/store.acceptOrderFromPOS`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: { orderId: 1, storeId: 1 } }),
      });
      expect(res.status).toBe(200);

      const data = await res.json();
      const result = data.result.data.json;
      expect(typeof result.success).toBe("boolean");
      expect(typeof result.alreadyAccepted).toBe("boolean");
    });
  });
});
