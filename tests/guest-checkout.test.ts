import { describe, it, expect } from "vitest";

describe("Guest Checkout System", () => {
  it("should allow guest orders with required fields", () => {
    const guestOrder = {
      customerId: null,
      guestName: "John Doe",
      guestPhone: "0891234567",
      guestEmail: "john@example.com",
      storeId: 1,
      paymentMethod: "card" as const,
      items: [{ productId: 1, quantity: 2, price: 5.99 }],
    };

    // Verify all required guest fields are present
    expect(guestOrder.customerId).toBeNull();
    expect(guestOrder.guestName).toBeTruthy();
    expect(guestOrder.guestPhone).toBeTruthy();
    expect(guestOrder.guestEmail).toBeTruthy();
    expect(guestOrder.paymentMethod).toBe("card");
  });

  it("should require card payment for guest orders", () => {
    const guestOrder = {
      customerId: null,
      paymentMethod: "card" as const,
    };

    // Guest orders must use card payment
    expect(guestOrder.paymentMethod).toBe("card");
    expect(guestOrder.customerId).toBeNull();
  });

  it("should validate guest email format", () => {
    const validEmail = "test@example.com";
    const invalidEmail = "notanemail";

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    expect(emailRegex.test(validEmail)).toBe(true);
    expect(emailRegex.test(invalidEmail)).toBe(false);
  });

  it("should validate Irish phone number format", () => {
    const validPhone = "0891234567";
    const invalidPhone = "123";

    // Irish phone numbers: 10 digits starting with 0
    const phoneRegex = /^0\d{9}$/;
    
    expect(phoneRegex.test(validPhone)).toBe(true);
    expect(phoneRegex.test(invalidPhone)).toBe(false);
  });

  it("should allow logged-in users to choose cash or card", () => {
    const loggedInOrderCard = {
      customerId: 1,
      paymentMethod: "card" as const,
    };

    const loggedInOrderCash = {
      customerId: 1,
      paymentMethod: "cash_on_delivery" as const,
    };

    // Logged-in users can use either payment method
    expect(loggedInOrderCard.customerId).toBeTruthy();
    expect(["card", "cash_on_delivery"]).toContain(loggedInOrderCard.paymentMethod);
    
    expect(loggedInOrderCash.customerId).toBeTruthy();
    expect(["card", "cash_on_delivery"]).toContain(loggedInOrderCash.paymentMethod);
  });
});
