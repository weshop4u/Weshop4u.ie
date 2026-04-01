import { describe, it, expect } from "vitest";
import { formatReceipt } from "../server/routers/print";

describe("formatReceipt with modifiers", () => {
  const mockOrder = {
    id: 1,
    orderNumber: "WS4U/SPR/001",
    subtotal: "15.40",
    serviceFee: "1.00",
    deliveryFee: "2.50",
    tipAmount: "0.00",
    total: "18.90",
    paymentMethod: "cash",
    deliveryAddress: "123 Main St, Dublin",
    customerNotes: "",
    createdAt: new Date("2026-02-25T10:00:00Z"),
  };

  const mockStore = {
    id: 1,
    name: "SPAR Ballymun",
    address: "123 Ballymun Rd",
    phone: "01-1234567",
  };

  const mockItems = [
    {
      id: 101,
      orderId: 1,
      productId: 10,
      productName: "Create Your Own",
      productPrice: "7.70",
      quantity: 2,
      subtotal: "15.40",
      notes: "",
    },
  ];

  it("should include modifier details in the receipt", () => {
    const itemModifiers: Record<number, { groupName: string; modifierName: string; modifierPrice: string }[]> = {
      101: [
        { groupName: "Choose Your Bread", modifierName: "White Roll", modifierPrice: "0.00" },
        { groupName: "Choose Your Meat", modifierName: "Turkey", modifierPrice: "0.00" },
        { groupName: "Choose Your Sauce", modifierName: "Mayo", modifierPrice: "0.00" },
        { groupName: "Choose Your Fillings", modifierName: "Lettuce", modifierPrice: "0.00" },
        { groupName: "Choose Your Fillings", modifierName: "Tomato", modifierPrice: "0.00" },
      ],
    };

    const receipt = formatReceipt(mockOrder, mockStore, mockItems, "John Doe", "0871234567", itemModifiers);

    // Should contain the item name
    expect(receipt).toContain("Create Your Own");
    
    // Should contain modifier group names
    expect(receipt).toContain("Choose Your Bread:");
    expect(receipt).toContain("Choose Your Meat:");
    expect(receipt).toContain("Choose Your Sauce:");
    expect(receipt).toContain("Choose Your Fillings:");
    
    // Should contain modifier option names
    expect(receipt).toContain("White Roll");
    expect(receipt).toContain("Turkey");
    expect(receipt).toContain("Mayo");
    expect(receipt).toContain("Lettuce");
    expect(receipt).toContain("Tomato");
  });

  it("should show modifier prices when they have extra cost", () => {
    const itemModifiers: Record<number, { groupName: string; modifierName: string; modifierPrice: string }[]> = {
      101: [
        { groupName: "Choose Your Bread", modifierName: "White Roll", modifierPrice: "0.00" },
        { groupName: "Extras", modifierName: "Extra Cheese", modifierPrice: "0.50" },
        { groupName: "Extras", modifierName: "Bacon", modifierPrice: "1.00" },
      ],
    };

    const receipt = formatReceipt(mockOrder, mockStore, mockItems, "John Doe", "0871234567", itemModifiers);

    // Should contain extra price indicators
    expect(receipt).toContain("Extra Cheese");
    expect(receipt).toContain("+EUR0.50");
    expect(receipt).toContain("Bacon");
    expect(receipt).toContain("+EUR1.00");
  });

  it("should group duplicate modifiers with quantity", () => {
    const itemModifiers: Record<number, { groupName: string; modifierName: string; modifierPrice: string }[]> = {
      101: [
        { groupName: "Extras", modifierName: "Sausage", modifierPrice: "0.50" },
        { groupName: "Extras", modifierName: "Sausage", modifierPrice: "0.50" },
        { groupName: "Extras", modifierName: "Sausage", modifierPrice: "0.50" },
      ],
    };

    const receipt = formatReceipt(mockOrder, mockStore, mockItems, "John Doe", "0871234567", itemModifiers);

    // Should show quantity indicator for duplicates
    expect(receipt).toContain("Sausage ×3");
    expect(receipt).toContain("+EUR1.50");
  });

  it("should work without modifiers", () => {
    const receipt = formatReceipt(mockOrder, mockStore, mockItems, "John Doe", "0871234567", {});

    // Should still contain the item name
    expect(receipt).toContain("Create Your Own");
    // Should not crash
    expect(receipt).toBeTruthy();
  });

  it("should work with undefined modifiers", () => {
    const receipt = formatReceipt(mockOrder, mockStore, mockItems, "John Doe", "0871234567", undefined);

    expect(receipt).toContain("Create Your Own");
    expect(receipt).toBeTruthy();
  });
});
