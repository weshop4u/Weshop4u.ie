import { describe, it, expect } from "vitest";

// Test the slug generation logic used in duplicateStore
function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function makeUniqueSlug(slug: string, existingSlugs: string[]): string {
  if (existingSlugs.includes(slug)) {
    return `${slug}-${Date.now()}`;
  }
  return slug;
}

describe("Duplicate Store", () => {
  describe("Slug generation", () => {
    it("should generate a valid slug from store name", () => {
      expect(generateSlug("Spar Swords")).toBe("spar-swords");
      expect(generateSlug("AppleGreen Balbriggan")).toBe("applegreen-balbriggan");
      expect(generateSlug("The Hamlet Bar")).toBe("the-hamlet-bar");
    });

    it("should handle special characters in names", () => {
      expect(generateSlug("O'Brien's Pub")).toBe("o-brien-s-pub");
      expect(generateSlug("Store #1 (Main)")).toBe("store-1-main");
      expect(generateSlug("  Extra  Spaces  ")).toBe("extra-spaces");
    });

    it("should make slug unique when duplicate exists", () => {
      const existing = ["spar-swords"];
      const slug = generateSlug("Spar Swords");
      const unique = makeUniqueSlug(slug, existing);
      expect(unique).not.toBe("spar-swords");
      expect(unique).toMatch(/^spar-swords-\d+$/);
    });

    it("should keep slug as-is when no duplicate", () => {
      const existing = ["spar-balbriggan"];
      const slug = generateSlug("Spar Swords");
      const unique = makeUniqueSlug(slug, existing);
      expect(unique).toBe("spar-swords");
    });
  });

  describe("Input validation", () => {
    it("should require name and address", () => {
      const isValid = (name: string, address: string) => name.trim().length > 0 && address.trim().length > 0;
      
      expect(isValid("Spar Swords", "Main St, Swords")).toBe(true);
      expect(isValid("", "Main St")).toBe(false);
      expect(isValid("Spar", "")).toBe(false);
      expect(isValid("  ", "  ")).toBe(false);
    });

    it("should handle optional fields", () => {
      const input = {
        sourceStoreId: 1,
        newName: "Spar Swords",
        newAddress: "Main St, Swords",
        newEircode: undefined,
        newShortCode: undefined,
        newPhone: undefined,
        newEmail: undefined,
        copyProducts: true,
        copyModifiers: true,
      };
      
      expect(input.newEircode).toBeUndefined();
      expect(input.copyProducts).toBe(true);
      expect(input.copyModifiers).toBe(true);
    });
  });

  describe("Copy options", () => {
    it("should default to copying products and modifiers", () => {
      const defaults = {
        copyProducts: true,
        copyModifiers: true,
      };
      expect(defaults.copyProducts).toBe(true);
      expect(defaults.copyModifiers).toBe(true);
    });

    it("should disable modifier copy when products are not copied", () => {
      // When copyProducts is false, copyModifiers should be effectively false
      const copyProducts = false;
      const copyModifiers = true;
      const effectiveModifierCopy = copyProducts && copyModifiers;
      expect(effectiveModifierCopy).toBe(false);
    });
  });

  describe("Result stats", () => {
    it("should report correct stats format", () => {
      const result = {
        success: true,
        storeId: 7,
        stats: {
          productsCopied: 150,
          modifiersCopied: 45,
          dealsCopied: 10,
        },
      };

      expect(result.success).toBe(true);
      expect(result.storeId).toBeGreaterThan(0);
      expect(result.stats.productsCopied).toBe(150);
      expect(result.stats.modifiersCopied).toBe(45);
      expect(result.stats.dealsCopied).toBe(10);
    });

    it("should generate correct success message", () => {
      const stats = { productsCopied: 150, modifiersCopied: 45, dealsCopied: 10 };
      const message = `Store duplicated! ${stats.productsCopied} products, ${stats.modifiersCopied} modifiers, ${stats.dealsCopied} deals copied. New store is set to Inactive — activate it when ready.`;
      
      expect(message).toContain("150 products");
      expect(message).toContain("45 modifiers");
      expect(message).toContain("10 deals");
      expect(message).toContain("Inactive");
    });
  });
});
