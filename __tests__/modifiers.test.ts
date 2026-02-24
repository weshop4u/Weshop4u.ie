import { describe, it, expect, vi } from "vitest";

// ===== RECEIPT FORMATTING WITH MODIFIERS =====
// We test the formatReceipt function directly

// Import the formatReceipt function
import { formatReceipt } from "../server/routers/print";

const mockStore = {
  id: 1,
  name: "Spar Balbriggan",
  shortCode: "SPR",
};

const mockOrder = {
  id: 1,
  orderNumber: "WS4U/SPR/001",
  createdAt: new Date("2026-02-24T12:00:00Z"),
  paymentMethod: "cash",
  deliveryAddress: "123 Main Street, Balbriggan, K32XE94",
  customerNotes: "",
  allowSubstitution: true,
  subtotal: "15.50",
  serviceFee: "1.30",
  deliveryFee: "3.50",
  tipAmount: "0",
  total: "20.30",
};

describe("Receipt Formatting with Modifiers", () => {
  it("should format a receipt without modifiers (backward compatible)", () => {
    const items = [
      { id: 1, productName: "Chicken Curry", quantity: 1, subtotal: "8.50", notes: "" },
      { id: 2, productName: "Coke 500ml", quantity: 2, subtotal: "3.00", notes: "" },
    ];

    const receipt = formatReceipt(mockOrder, mockStore, items, "John Doe", "089-1234567");
    expect(receipt).toContain("WESHOP4U");
    expect(receipt).toContain("SPAR BALBRIGGAN");
    expect(receipt).toContain("1. 1x Chicken Curry");
    expect(receipt).toContain("2. 2x Coke 500ml");
    expect(receipt).toContain("John Doe");
    expect(receipt).toContain("089-1234567");
    // Should NOT contain modifier lines
    expect(receipt).not.toContain("Choose your side:");
  });

  it("should show modifiers under items on receipt", () => {
    const items = [
      { id: 10, productName: "Chicken Curry", quantity: 1, subtotal: "10.50", notes: "" },
      { id: 11, productName: "Coke 500ml", quantity: 2, subtotal: "3.00", notes: "" },
    ];

    const itemModifiers: Record<number, { groupName: string; modifierName: string; modifierPrice: string }[]> = {
      10: [
        { groupName: "Choose your side", modifierName: "Basmati Rice", modifierPrice: "0.00" },
        { groupName: "Choose your side", modifierName: "Naan Bread", modifierPrice: "1.50" },
        { groupName: "Spice Level", modifierName: "Medium", modifierPrice: "0.00" },
      ],
    };

    const receipt = formatReceipt(mockOrder, mockStore, items, "John Doe", "089-1234567", itemModifiers);
    
    // Should contain modifier group headers
    expect(receipt).toContain("Choose your side:");
    expect(receipt).toContain("Spice Level:");
    
    // Should contain modifier names
    expect(receipt).toContain("Basmati Rice");
    expect(receipt).toContain("Naan Bread");
    expect(receipt).toContain("Medium");
    
    // Should show price for paid modifiers
    expect(receipt).toContain("+EUR1.50");
    
    // Free modifiers should not show price
    const lines = receipt.split("\n");
    const basmatiLine = lines.find(l => l.includes("Basmati Rice"));
    expect(basmatiLine).toBeDefined();
    expect(basmatiLine).not.toContain("+EUR");
    
    // Item without modifiers should not have modifier lines
    expect(receipt).toContain("2. 2x Coke 500ml");
  });

  it("should handle empty modifiers map", () => {
    const items = [
      { id: 1, productName: "Water", quantity: 1, subtotal: "1.50", notes: "" },
    ];

    const receipt = formatReceipt(mockOrder, mockStore, items, "Guest", undefined, {});
    expect(receipt).toContain("1. 1x Water");
    expect(receipt).not.toContain("Choose");
  });

  it("should handle item with notes AND modifiers", () => {
    const items = [
      { id: 20, productName: "Deli Roll", quantity: 1, subtotal: "5.50", notes: "Extra butter please" },
    ];

    const itemModifiers: Record<number, { groupName: string; modifierName: string; modifierPrice: string }[]> = {
      20: [
        { groupName: "Bread", modifierName: "White Roll", modifierPrice: "0.00" },
        { groupName: "Fillings", modifierName: "Ham", modifierPrice: "0.00" },
        { groupName: "Fillings", modifierName: "Cheese", modifierPrice: "0.50" },
      ],
    };

    const receipt = formatReceipt(mockOrder, mockStore, items, "Jane", "089-9999999", itemModifiers);
    
    // Should have both modifiers and notes
    expect(receipt).toContain("Bread:");
    expect(receipt).toContain("White Roll");
    expect(receipt).toContain("Fillings:");
    expect(receipt).toContain("Ham");
    expect(receipt).toContain("Cheese");
    expect(receipt).toContain("+EUR0.50");
    expect(receipt).toContain("Note: Extra butter please");
  });
});

// ===== MULTI-BUY DEAL PRICING CALCULATIONS =====

describe("Multi-Buy Deal Pricing", () => {
  // Simulate the cart's deal pricing logic
  function calculateDealPrice(
    unitPrice: number,
    quantity: number,
    deals: { quantity: number; dealPrice: number }[]
  ): number {
    if (deals.length === 0) return unitPrice * quantity;
    
    // Sort deals by quantity descending to apply best deal first
    const sortedDeals = [...deals].sort((a, b) => b.quantity - a.quantity);
    let remaining = quantity;
    let total = 0;
    
    for (const deal of sortedDeals) {
      while (remaining >= deal.quantity) {
        total += deal.dealPrice;
        remaining -= deal.quantity;
      }
    }
    
    // Remaining items at full price
    total += remaining * unitPrice;
    return total;
  }

  it("should apply 2-for deal correctly", () => {
    const deals = [{ quantity: 2, dealPrice: 2.50 }];
    // 2 items at €1.50 each = €2.50 deal
    expect(calculateDealPrice(1.50, 2, deals)).toBe(2.50);
  });

  it("should apply deal with remaining items at full price", () => {
    const deals = [{ quantity: 2, dealPrice: 2.50 }];
    // 3 items: 2 at deal (€2.50) + 1 at full (€1.50) = €4.00
    expect(calculateDealPrice(1.50, 3, deals)).toBe(4.00);
  });

  it("should apply deal multiple times", () => {
    const deals = [{ quantity: 2, dealPrice: 2.50 }];
    // 4 items: 2 deals = 2 × €2.50 = €5.00
    expect(calculateDealPrice(1.50, 4, deals)).toBe(5.00);
  });

  it("should use full price when quantity below deal threshold", () => {
    const deals = [{ quantity: 3, dealPrice: 5.00 }];
    // 2 items at €2.50 each = €5.00 (no deal)
    expect(calculateDealPrice(2.50, 2, deals)).toBe(5.00);
  });

  it("should handle no deals", () => {
    // 3 items at €2.00 each = €6.00
    expect(calculateDealPrice(2.00, 3, [])).toBe(6.00);
  });

  it("should apply best deal first (larger quantity)", () => {
    const deals = [
      { quantity: 2, dealPrice: 2.50 },
      { quantity: 3, dealPrice: 3.00 },
    ];
    // 5 items: 3-for-€3.00 + 2-for-€2.50 = €5.50
    expect(calculateDealPrice(2.00, 5, deals)).toBe(5.50);
  });

  it("should handle single item with deal", () => {
    const deals = [{ quantity: 2, dealPrice: 2.50 }];
    // 1 item at €1.50 = €1.50 (no deal)
    expect(calculateDealPrice(1.50, 1, deals)).toBe(1.50);
  });
});

// ===== MODIFIER SELECTION VALIDATION =====

describe("Modifier Selection Validation", () => {
  function validateModifierSelections(
    groups: { id: number; name: string; type: "single" | "multi"; required: boolean; minSelections: number; maxSelections: number }[],
    selections: Record<number, number[]> // groupId -> selected modifier IDs
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const group of groups) {
      const selected = selections[group.id] || [];

      if (group.required && selected.length === 0) {
        errors.push(`"${group.name}" is required — please make a selection`);
        continue;
      }

      if (group.type === "single" && selected.length > 1) {
        errors.push(`"${group.name}" allows only one selection`);
      }

      if (group.type === "multi") {
        if (group.minSelections > 0 && selected.length < group.minSelections) {
          errors.push(`"${group.name}" requires at least ${group.minSelections} selection(s)`);
        }
        if (group.maxSelections > 0 && selected.length > group.maxSelections) {
          errors.push(`"${group.name}" allows at most ${group.maxSelections} selection(s)`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  it("should pass with valid single selection on required group", () => {
    const groups = [{ id: 1, name: "Choose your side", type: "single" as const, required: true, minSelections: 0, maxSelections: 1 }];
    const selections = { 1: [101] };
    const result = validateModifierSelections(groups, selections);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should fail when required group has no selection", () => {
    const groups = [{ id: 1, name: "Choose your side", type: "single" as const, required: true, minSelections: 0, maxSelections: 1 }];
    const selections = {};
    const result = validateModifierSelections(groups, selections);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Choose your side");
    expect(result.errors[0]).toContain("required");
  });

  it("should fail when single-select group has multiple selections", () => {
    const groups = [{ id: 1, name: "Rice", type: "single" as const, required: false, minSelections: 0, maxSelections: 1 }];
    const selections = { 1: [101, 102] };
    const result = validateModifierSelections(groups, selections);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("only one");
  });

  it("should pass with valid multi selection within limits", () => {
    const groups = [{ id: 1, name: "Toppings", type: "multi" as const, required: false, minSelections: 0, maxSelections: 5 }];
    const selections = { 1: [101, 102, 103] };
    const result = validateModifierSelections(groups, selections);
    expect(result.valid).toBe(true);
  });

  it("should fail when multi selection exceeds max", () => {
    const groups = [{ id: 1, name: "Toppings", type: "multi" as const, required: false, minSelections: 0, maxSelections: 3 }];
    const selections = { 1: [101, 102, 103, 104] };
    const result = validateModifierSelections(groups, selections);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("at most 3");
  });

  it("should fail when multi selection below min", () => {
    const groups = [{ id: 1, name: "Toppings", type: "multi" as const, required: false, minSelections: 2, maxSelections: 5 }];
    const selections = { 1: [101] };
    const result = validateModifierSelections(groups, selections);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("at least 2");
  });

  it("should pass with optional group and no selection", () => {
    const groups = [{ id: 1, name: "Extra Sauce", type: "multi" as const, required: false, minSelections: 0, maxSelections: 3 }];
    const selections = {};
    const result = validateModifierSelections(groups, selections);
    expect(result.valid).toBe(true);
  });

  it("should validate multiple groups independently", () => {
    const groups = [
      { id: 1, name: "Side", type: "single" as const, required: true, minSelections: 0, maxSelections: 1 },
      { id: 2, name: "Toppings", type: "multi" as const, required: false, minSelections: 0, maxSelections: 5 },
    ];
    const selections = { 1: [101], 2: [201, 202] };
    const result = validateModifierSelections(groups, selections);
    expect(result.valid).toBe(true);
  });

  it("should report errors for multiple invalid groups", () => {
    const groups = [
      { id: 1, name: "Side", type: "single" as const, required: true, minSelections: 0, maxSelections: 1 },
      { id: 2, name: "Toppings", type: "multi" as const, required: false, minSelections: 2, maxSelections: 5 },
    ];
    const selections = { 2: [201] }; // Missing required Side, Toppings below min
    const result = validateModifierSelections(groups, selections);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
  });
});

// ===== MODIFIER PRICE CALCULATION =====

describe("Modifier Price Calculation", () => {
  function calculateItemTotal(
    basePrice: number,
    quantity: number,
    selectedModifiers: { price: number }[],
    deals: { quantity: number; dealPrice: number }[]
  ): number {
    const modifierTotal = selectedModifiers.reduce((sum, m) => sum + m.price, 0);
    const perItemPrice = basePrice + modifierTotal;
    
    // Apply deals to the per-item price
    if (deals.length === 0) return perItemPrice * quantity;
    
    const sortedDeals = [...deals].sort((a, b) => b.quantity - a.quantity);
    let remaining = quantity;
    let total = 0;
    
    for (const deal of sortedDeals) {
      while (remaining >= deal.quantity) {
        // Deal price replaces the base price, but modifiers still apply
        total += deal.dealPrice + (modifierTotal * deal.quantity);
        remaining -= deal.quantity;
      }
    }
    
    total += remaining * perItemPrice;
    return total;
  }

  it("should calculate base price with no modifiers", () => {
    expect(calculateItemTotal(5.00, 1, [], [])).toBe(5.00);
  });

  it("should add modifier prices to base", () => {
    const mods = [{ price: 0.50 }, { price: 1.00 }];
    // 5.00 + 0.50 + 1.00 = 6.50
    expect(calculateItemTotal(5.00, 1, mods, [])).toBe(6.50);
  });

  it("should multiply by quantity", () => {
    const mods = [{ price: 0.50 }];
    // (5.00 + 0.50) × 2 = 11.00
    expect(calculateItemTotal(5.00, 2, mods, [])).toBe(11.00);
  });

  it("should handle free modifiers", () => {
    const mods = [{ price: 0 }, { price: 0 }, { price: 0.50 }];
    // 5.00 + 0 + 0 + 0.50 = 5.50
    expect(calculateItemTotal(5.00, 1, mods, [])).toBe(5.50);
  });
});

// ===== FETCH ITEM MODIFIERS HELPER =====

describe("fetchItemModifiers", () => {
  it("should return empty object for empty item IDs", async () => {
    // We can test the logic without DB by checking the function signature
    const { fetchItemModifiers } = await import("../server/lib/fetch-item-modifiers");
    const result = await fetchItemModifiers([]);
    expect(result).toEqual({});
  });
});
