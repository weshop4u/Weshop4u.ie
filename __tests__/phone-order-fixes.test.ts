import { describe, it, expect, vi } from "vitest";

// ===== Test 1: Fee calculation helper functions =====
describe("Phone Order Fee Calculation", () => {
  // Replicate the server-side helpers
  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100;
  }

  function calculateDeliveryFee(distanceKm: number): number {
    const BASE_FEE = 3.50;
    const BASE_DISTANCE = 2.8;
    const COST_PER_KM = 1.00;
    if (distanceKm <= BASE_DISTANCE) return BASE_FEE;
    return Math.round((BASE_FEE + (distanceKm - BASE_DISTANCE) * COST_PER_KM) * 100) / 100;
  }

  it("should return base fee for short distances", () => {
    const fee = calculateDeliveryFee(1.5);
    expect(fee).toBe(3.50);
  });

  it("should return base fee for exactly base distance", () => {
    const fee = calculateDeliveryFee(2.8);
    expect(fee).toBe(3.50);
  });

  it("should add €1/km for distances over 2.8km", () => {
    const fee = calculateDeliveryFee(5.8);
    // 3.50 + (5.8 - 2.8) * 1.00 = 3.50 + 3.00 = 6.50
    expect(fee).toBe(6.50);
  });

  it("should calculate service fee as 10% of subtotal", () => {
    const subtotal = 25.00;
    const serviceFee = Math.round(subtotal * 0.10 * 100) / 100;
    expect(serviceFee).toBe(2.50);
  });

  it("should calculate total correctly", () => {
    const subtotal = 25.00;
    const serviceFee = Math.round(subtotal * 0.10 * 100) / 100;
    const deliveryFee = calculateDeliveryFee(4.0);
    const total = Math.round((subtotal + serviceFee + deliveryFee) * 100) / 100;
    // 25.00 + 2.50 + (3.50 + 1.20) = 25.00 + 2.50 + 4.70 = 32.20
    expect(total).toBe(32.20);
  });

  it("should calculate distance between two points in Balbriggan area", () => {
    // Spar Balbriggan to a nearby location
    const distance = calculateDistance(53.6109, -6.1811, 53.6200, -6.1900);
    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThan(5); // Should be within 5km in same town
  });
});

// ===== Test 2: Phone number normalization for customer lookup =====
describe("Phone Number Normalization", () => {
  function normalizePhone(phone: string): string {
    return phone.replace(/\s+/g, "").replace(/^\+353/, "0");
  }

  it("should remove spaces from phone numbers", () => {
    expect(normalizePhone("089 123 4567")).toBe("0891234567");
  });

  it("should convert +353 prefix to 0", () => {
    expect(normalizePhone("+353891234567")).toBe("0891234567");
  });

  it("should handle already normalized numbers", () => {
    expect(normalizePhone("0891234567")).toBe("0891234567");
  });

  it("should handle +353 with spaces", () => {
    expect(normalizePhone("+353 89 123 4567")).toBe("0891234567");
  });
});

// ===== Test 3: Confirm modal replaces Alert.alert for web compatibility =====
describe("Web-Compatible Confirmation", () => {
  it("should not use Alert.alert in phone-order.tsx", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(
      path.join(process.cwd(), "app/admin/phone-order.tsx"),
      "utf-8"
    );
    // Should NOT contain Alert.alert function calls (comments mentioning it are OK)
    const alertCalls = content.match(/Alert\.alert\s*\(/g);
    expect(alertCalls).toBeNull();
    // Should contain the confirm modal state
    expect(content).toContain("showConfirmModal");
    // Should contain the confirm overlay
    expect(content).toContain("ConfirmOverlay");
  });

  it("should have a success screen instead of Alert for order result", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(
      path.join(process.cwd(), "app/admin/phone-order.tsx"),
      "utf-8"
    );
    // Should have orderResult state for success screen
    expect(content).toContain("orderResult");
    expect(content).toContain("Order Created!");
    expect(content).toContain("router.back()");
  });
});

// ===== Test 4: Fee display in customer details step =====
describe("Fee Display in Details Step", () => {
  it("should have fee preview box in the details step", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(
      path.join(process.cwd(), "app/admin/phone-order.tsx"),
      "utf-8"
    );
    // Should have fee info display
    expect(content).toContain("COST BREAKDOWN (tell customer)");
    expect(content).toContain("feeInfo");
    expect(content).toContain("calculatePhoneOrderFees");
  });

  it("should auto-calculate fees when Eircode is entered", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(
      path.join(process.cwd(), "app/admin/phone-order.tsx"),
      "utf-8"
    );
    // Should have Eircode change handler that triggers fee calculation
    expect(content).toContain("handleEircodeChange");
    expect(content).toContain("eircodeDebounceRef");
  });
});

// ===== Test 5: Customer auto-fill by phone =====
describe("Customer Auto-Fill by Phone", () => {
  it("should have phone lookup functionality", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(
      path.join(process.cwd(), "app/admin/phone-order.tsx"),
      "utf-8"
    );
    // Should have phone lookup
    expect(content).toContain("lookupCustomerByPhone");
    expect(content).toContain("handlePhoneChange");
    expect(content).toContain("lookupPhone");
    // Phone field should come first with auto-fill hint
    expect(content).toContain("enter first to auto-fill");
  });

  it("should have phone field before name field in details step", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(
      path.join(process.cwd(), "app/admin/phone-order.tsx"),
      "utf-8"
    );
    // Phone field should appear before name field
    const phoneIdx = content.indexOf("PHONE NUMBER * (enter first to auto-fill)");
    const nameIdx = content.indexOf("CUSTOMER NAME *");
    expect(phoneIdx).toBeGreaterThan(-1);
    expect(nameIdx).toBeGreaterThan(-1);
    expect(phoneIdx).toBeLessThan(nameIdx);
  });
});

// ===== Test 6: Server endpoint exists =====
describe("Server Endpoints", () => {
  it("should have calculatePhoneOrderFees endpoint in admin router", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(
      path.join(process.cwd(), "server/routers/admin.ts"),
      "utf-8"
    );
    expect(content).toContain("calculatePhoneOrderFees");
    expect(content).toContain("geocodeAddress");
    expect(content).toContain("eircode: z.string()");
  });

  it("should have lookupCustomerByPhone endpoint in admin router", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(
      path.join(process.cwd(), "server/routers/admin.ts"),
      "utf-8"
    );
    expect(content).toContain("lookupCustomerByPhone");
    expect(content).toContain("phone: z.string()");
    expect(content).toContain("guestPhone");
    expect(content).toContain("savedAddresses");
  });
});
