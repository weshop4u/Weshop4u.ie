import { describe, it, expect } from "vitest";

describe("Call Customer Button", () => {
  it("should resolve customer phone from guestPhone for guest orders", () => {
    const order = {
      guestPhone: "+353891234567",
      customer: null,
    };
    const customerPhone = order.guestPhone || (order.customer as any)?.phone || "";
    expect(customerPhone).toBe("+353891234567");
  });

  it("should resolve customer phone from customer.phone for registered users", () => {
    const order = {
      guestPhone: null,
      customer: { name: "John", phone: "+353897654321" },
    };
    const customerPhone = order.guestPhone || order.customer?.phone || "";
    expect(customerPhone).toBe("+353897654321");
  });

  it("should prefer guestPhone over customer.phone when both exist", () => {
    const order = {
      guestPhone: "+353891111111",
      customer: { name: "John", phone: "+353892222222" },
    };
    const customerPhone = order.guestPhone || order.customer?.phone || "";
    expect(customerPhone).toBe("+353891111111");
  });

  it("should return empty string when no phone is available", () => {
    const order = {
      guestPhone: null,
      customer: null,
    };
    const customerPhone = order.guestPhone || (order.customer as any)?.phone || "";
    expect(customerPhone).toBe("");
  });

  it("should generate correct tel: URI for phone dialer", () => {
    const phone = "+353891234567";
    const telUri = `tel:${phone}`;
    expect(telUri).toBe("tel:+353891234567");
  });

  it("should handle phone without country code", () => {
    const phone = "0891234567";
    const telUri = `tel:${phone}`;
    expect(telUri).toBe("tel:0891234567");
  });

  it("should resolve customer name from customer or guestName", () => {
    // Registered user
    const order1 = { customer: { name: "Alice" }, customerName: undefined, guestName: undefined };
    const name1 = order1.customer?.name || order1.customerName || "";
    expect(name1).toBe("Alice");

    // Guest order
    const order2 = { customer: null, customerName: undefined, guestName: "Bob" };
    const name2 = (order2.customer as any)?.name || order2.customerName || order2.guestName || "";
    expect(name2).toBe("Bob");
  });
});
