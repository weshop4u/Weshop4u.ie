import { describe, it, expect, vi, beforeEach } from "vitest";

// ===== MODIFIER TEMPLATE SYSTEM TESTS =====
// Tests for the three-tier modifier template system:
// 1. Category-level templates (automatic inheritance)
// 2. Template-based modifiers (manual product assignment)
// 3. Custom per-product modifiers
// 4. Merged modifier fetch for customer view

// Mock data representing what the backend returns
const mockTemplates = [
  {
    id: 1,
    name: "Chinese Sides",
    type: "single" as const,
    required: true,
    minSelections: 0,
    maxSelections: 0,
    options: [
      { id: 10, templateId: 1, name: "Boiled Rice", price: "0.00", isDefault: true, sortOrder: 0 },
      { id: 11, templateId: 1, name: "Chips", price: "0.50", isDefault: false, sortOrder: 1 },
      { id: 12, templateId: 1, name: "Fried Rice", price: "2.00", isDefault: false, sortOrder: 2 },
      { id: 13, templateId: 1, name: "Egg Noodle", price: "2.00", isDefault: false, sortOrder: 3 },
    ],
  },
  {
    id: 2,
    name: "Deli Fillings",
    type: "multi" as const,
    required: false,
    minSelections: 0,
    maxSelections: 5,
    options: [
      { id: 20, templateId: 2, name: "Lettuce", price: "0.00", isDefault: false, sortOrder: 0 },
      { id: 21, templateId: 2, name: "Onion", price: "0.00", isDefault: false, sortOrder: 1 },
      { id: 22, templateId: 2, name: "Tomato", price: "0.00", isDefault: false, sortOrder: 2 },
      { id: 23, templateId: 2, name: "Cheese", price: "0.50", isDefault: false, sortOrder: 3 },
    ],
  },
  {
    id: 3,
    name: "Dinner Sides",
    type: "single" as const,
    required: true,
    minSelections: 0,
    maxSelections: 0,
    options: [
      { id: 30, templateId: 3, name: "Mashed Potato", price: "0.00", isDefault: true, sortOrder: 0 },
      { id: 31, templateId: 3, name: "Boiled Potato", price: "0.00", isDefault: false, sortOrder: 1 },
      { id: 32, templateId: 3, name: "Chips", price: "0.50", isDefault: false, sortOrder: 2 },
    ],
  },
];

// Simulates the merged modifier fetch logic from the backend
function mergeModifiers(
  categoryTemplateIds: number[],
  productTemplateIds: number[],
  excludedTemplateIds: Set<number>,
  customGroups: Array<{
    id: number;
    name: string;
    type: "single" | "multi";
    required: boolean;
    minSelections: number;
    maxSelections: number;
    modifiers: Array<{ id: number; name: string; price: string; isDefault: boolean }>;
  }>,
  allTemplates: typeof mockTemplates
) {
  // Filter category templates (remove excluded)
  const activeCategoryIds = categoryTemplateIds.filter((id) => !excludedTemplateIds.has(id));

  // Merge: category first, then product, deduplicated
  const allTemplateIds = [...new Set([...activeCategoryIds, ...productTemplateIds])];

  // Build template groups
  const templateGroups = allTemplateIds.map((tId) => {
    const template = allTemplates.find((t) => t.id === tId);
    if (!template) return null;
    const source = activeCategoryIds.includes(tId) ? "category" : "product_template";
    return {
      source,
      id: template.id,
      name: template.name,
      type: template.type,
      required: template.required,
      minSelections: template.minSelections,
      maxSelections: template.maxSelections,
      modifiers: template.options.map((o) => ({
        id: o.id,
        name: o.name,
        price: o.price,
        isDefault: o.isDefault,
      })),
    };
  }).filter(Boolean);

  // Add custom groups
  const customGroupsMapped = customGroups.map((g) => ({
    source: "custom",
    id: g.id,
    name: g.name,
    type: g.type,
    required: g.required,
    minSelections: g.minSelections,
    maxSelections: g.maxSelections,
    modifiers: g.modifiers,
  }));

  return [...templateGroups, ...customGroupsMapped];
}

describe("Modifier Template System", () => {
  describe("Template Structure", () => {
    it("should have correct structure for single-select template", () => {
      const chineseSides = mockTemplates[0];
      expect(chineseSides.type).toBe("single");
      expect(chineseSides.required).toBe(true);
      expect(chineseSides.options).toHaveLength(4);
      expect(chineseSides.options[0].name).toBe("Boiled Rice");
      expect(chineseSides.options[0].price).toBe("0.00");
      expect(chineseSides.options[0].isDefault).toBe(true);
    });

    it("should have correct structure for multi-select template", () => {
      const deliFillings = mockTemplates[1];
      expect(deliFillings.type).toBe("multi");
      expect(deliFillings.required).toBe(false);
      expect(deliFillings.maxSelections).toBe(5);
      expect(deliFillings.options).toHaveLength(4);
    });

    it("should have price as string for consistent formatting", () => {
      for (const template of mockTemplates) {
        for (const option of template.options) {
          expect(typeof option.price).toBe("string");
          expect(parseFloat(option.price)).not.toBeNaN();
        }
      }
    });
  });

  describe("Category-Level Inheritance", () => {
    it("should include category templates in merged result", () => {
      const result = mergeModifiers(
        [1, 3], // Chinese Sides and Dinner Sides inherited from category
        [], // No product-specific templates
        new Set(), // No exclusions
        [], // No custom groups
        mockTemplates
      );

      expect(result).toHaveLength(2);
      expect(result[0]!.source).toBe("category");
      expect(result[0]!.name).toBe("Chinese Sides");
      expect(result[1]!.source).toBe("category");
      expect(result[1]!.name).toBe("Dinner Sides");
    });

    it("should exclude opted-out category templates", () => {
      const result = mergeModifiers(
        [1, 3], // Chinese Sides and Dinner Sides inherited from category
        [], // No product-specific templates
        new Set([3]), // Dinner Sides excluded for this product
        [], // No custom groups
        mockTemplates
      );

      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe("Chinese Sides");
    });

    it("should exclude all category templates when all are opted out", () => {
      const result = mergeModifiers(
        [1, 3],
        [],
        new Set([1, 3]), // Both excluded
        [],
        mockTemplates
      );

      expect(result).toHaveLength(0);
    });
  });

  describe("Product-Level Template Assignment", () => {
    it("should include manually assigned product templates", () => {
      const result = mergeModifiers(
        [], // No category templates
        [2], // Deli Fillings manually assigned
        new Set(),
        [],
        mockTemplates
      );

      expect(result).toHaveLength(1);
      expect(result[0]!.source).toBe("product_template");
      expect(result[0]!.name).toBe("Deli Fillings");
    });

    it("should combine category and product templates", () => {
      const result = mergeModifiers(
        [1], // Chinese Sides from category
        [2], // Deli Fillings manually assigned
        new Set(),
        [],
        mockTemplates
      );

      expect(result).toHaveLength(2);
      expect(result[0]!.name).toBe("Chinese Sides");
      expect(result[0]!.source).toBe("category");
      expect(result[1]!.name).toBe("Deli Fillings");
      expect(result[1]!.source).toBe("product_template");
    });

    it("should deduplicate templates that appear in both category and product", () => {
      const result = mergeModifiers(
        [1, 2], // Both from category
        [2], // Deli Fillings also manually assigned
        new Set(),
        [],
        mockTemplates
      );

      // Should only appear once (from category, since category comes first)
      expect(result).toHaveLength(2);
      const names = result.map((r) => r!.name);
      expect(names.filter((n) => n === "Deli Fillings")).toHaveLength(1);
    });
  });

  describe("Custom Per-Product Modifiers", () => {
    it("should include custom modifiers alongside templates", () => {
      const customGroups = [
        {
          id: 100,
          name: "Extra Sauce",
          type: "multi" as const,
          required: false,
          minSelections: 0,
          maxSelections: 3,
          modifiers: [
            { id: 200, name: "Sweet Chili", price: "0.50", isDefault: false },
            { id: 201, name: "Garlic Mayo", price: "0.50", isDefault: false },
          ],
        },
      ];

      const result = mergeModifiers(
        [1], // Chinese Sides from category
        [],
        new Set(),
        customGroups,
        mockTemplates
      );

      expect(result).toHaveLength(2);
      expect(result[0]!.name).toBe("Chinese Sides");
      expect(result[0]!.source).toBe("category");
      expect(result[1]!.name).toBe("Extra Sauce");
      expect(result[1]!.source).toBe("custom");
    });

    it("should work with only custom modifiers (no templates)", () => {
      const customGroups = [
        {
          id: 100,
          name: "Spice Level",
          type: "single" as const,
          required: true,
          minSelections: 0,
          maxSelections: 0,
          modifiers: [
            { id: 200, name: "Mild", price: "0.00", isDefault: true },
            { id: 201, name: "Medium", price: "0.00", isDefault: false },
            { id: 202, name: "Hot", price: "0.00", isDefault: false },
          ],
        },
      ];

      const result = mergeModifiers([], [], new Set(), customGroups, mockTemplates);

      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe("Spice Level");
      expect(result[0]!.source).toBe("custom");
    });
  });

  describe("Full Three-Tier Merge", () => {
    it("should merge all three tiers correctly", () => {
      const customGroups = [
        {
          id: 100,
          name: "Spice Level",
          type: "single" as const,
          required: true,
          minSelections: 0,
          maxSelections: 0,
          modifiers: [
            { id: 200, name: "Mild", price: "0.00", isDefault: true },
            { id: 201, name: "Hot", price: "0.00", isDefault: false },
          ],
        },
      ];

      const result = mergeModifiers(
        [1], // Chinese Sides from category
        [2], // Deli Fillings manually assigned
        new Set(),
        customGroups,
        mockTemplates
      );

      expect(result).toHaveLength(3);
      // Order: category templates first, then product templates, then custom
      expect(result[0]!.source).toBe("category");
      expect(result[0]!.name).toBe("Chinese Sides");
      expect(result[1]!.source).toBe("product_template");
      expect(result[1]!.name).toBe("Deli Fillings");
      expect(result[2]!.source).toBe("custom");
      expect(result[2]!.name).toBe("Spice Level");
    });

    it("should handle empty product (no modifiers at all)", () => {
      const result = mergeModifiers([], [], new Set(), [], mockTemplates);
      expect(result).toHaveLength(0);
    });
  });

  describe("Price Calculations", () => {
    it("should calculate correct total with template modifiers", () => {
      const basePrice = 8.50;
      const selectedModifiers = [
        { price: "2.00" }, // Fried Rice
        { price: "0.50" }, // Cheese
      ];

      const modifierTotal = selectedModifiers.reduce(
        (sum, m) => sum + parseFloat(m.price), 0
      );
      const total = basePrice + modifierTotal;

      expect(total).toBe(11.00);
    });

    it("should handle free modifiers (price 0.00)", () => {
      const basePrice = 8.50;
      const selectedModifiers = [
        { price: "0.00" }, // Boiled Rice (free)
        { price: "0.00" }, // Lettuce (free)
      ];

      const modifierTotal = selectedModifiers.reduce(
        (sum, m) => sum + parseFloat(m.price), 0
      );
      const total = basePrice + modifierTotal;

      expect(total).toBe(8.50);
    });
  });

  describe("Modifier Selection Validation", () => {
    it("should validate required single-select groups", () => {
      const group = {
        type: "single",
        required: true,
        minSelections: 0,
        maxSelections: 0,
        modifiers: [
          { id: 10, name: "Boiled Rice" },
          { id: 11, name: "Chips" },
        ],
      };

      // No selection - should fail
      const selectedIds: number[] = [];
      const isValid = !group.required || selectedIds.length > 0;
      expect(isValid).toBe(false);

      // One selection - should pass
      const selectedIds2 = [10];
      const isValid2 = !group.required || selectedIds2.length > 0;
      expect(isValid2).toBe(true);
    });

    it("should validate multi-select max selections", () => {
      const group = {
        type: "multi",
        required: false,
        minSelections: 0,
        maxSelections: 3,
        modifiers: [
          { id: 20, name: "Lettuce" },
          { id: 21, name: "Onion" },
          { id: 22, name: "Tomato" },
          { id: 23, name: "Cheese" },
        ],
      };

      // 3 selections (at max) - should be valid
      const selectedIds = [20, 21, 22];
      const isValid = group.maxSelections === 0 || selectedIds.length <= group.maxSelections;
      expect(isValid).toBe(true);

      // 4 selections (over max) - should be invalid
      const selectedIds2 = [20, 21, 22, 23];
      const isValid2 = group.maxSelections === 0 || selectedIds2.length <= group.maxSelections;
      expect(isValid2).toBe(false);
    });

    it("should handle optional groups (no selection required)", () => {
      const group = {
        type: "multi",
        required: false,
        minSelections: 0,
        maxSelections: 5,
      };

      const selectedIds: number[] = [];
      const isValid = !group.required || selectedIds.length > 0;
      expect(isValid).toBe(true);
    });
  });

  describe("Cart Modifier Format", () => {
    it("should format modifiers correctly for cart storage", () => {
      const group = { id: 1, name: "Chinese Sides" };
      const selectedMod = { id: 12, name: "Fried Rice", price: "2.00" };

      const cartModifier = {
        groupName: group.name,
        modifierId: selectedMod.id,
        modifierName: selectedMod.name,
        modifierPrice: selectedMod.price,
      };

      expect(cartModifier.groupName).toBe("Chinese Sides");
      expect(cartModifier.modifierName).toBe("Fried Rice");
      expect(cartModifier.modifierPrice).toBe("2.00");
      expect(cartModifier.modifierId).toBe(12);
    });

    it("should format multiple modifiers from different groups", () => {
      const cartModifiers = [
        { groupName: "Chinese Sides", modifierId: 12, modifierName: "Fried Rice", modifierPrice: "2.00" },
        { groupName: "Deli Fillings", modifierId: 20, modifierName: "Lettuce", modifierPrice: "0.00" },
        { groupName: "Deli Fillings", modifierId: 23, modifierName: "Cheese", modifierPrice: "0.50" },
      ];

      expect(cartModifiers).toHaveLength(3);
      const totalExtra = cartModifiers.reduce((sum, m) => sum + parseFloat(m.modifierPrice), 0);
      expect(totalExtra).toBe(2.50);
    });
  });
});
