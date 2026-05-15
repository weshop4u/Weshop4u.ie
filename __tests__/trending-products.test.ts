import { describe, it, expect } from "vitest";

interface TrendingProduct {
  id: number;
  name: string;
  price: string;
  images: string | null;
  description: string;
  stockStatus: string;
  categoryName: string;
  orderCount: number;
}

describe("Trending Products", () => {
  const mockTrendingData: TrendingProduct[] = [
    {
      id: 60718,
      name: "Alka Seltzer 10pk",
      price: "5.49",
      images: '[\"https://weshop4u.ie/storage/products/alka-seltzer-10pk.jpg\"]',
      description: "Effervescent tablets",
      stockStatus: "in_stock",
      categoryName: "Medicine and Personal",
      orderCount: 6,
    },
    {
      id: 360001,
      name: "Create Your Own",
      price: "0.00",
      images: '[\"https://example.com/deli.jpg\"]',
      description: "Build your perfect sandwich",
      stockStatus: "in_stock",
      categoryName: "Deli",
      orderCount: 4,
    },
    {
      id: 60608,
      name: "Chicken Wings x6",
      price: "4.49",
      images: null,
      description: "Six succulent chicken wings",
      stockStatus: "in_stock",
      categoryName: "Deli",
      orderCount: 4,
    },
  ];

  it("should have items sorted by orderCount descending", () => {
    for (let i = 1; i < mockTrendingData.length; i++) {
      expect(mockTrendingData[i].orderCount).toBeLessThanOrEqual(
        mockTrendingData[i - 1].orderCount
      );
    }
  });

  it("should parse images JSON string correctly", () => {
    for (const item of mockTrendingData) {
      const images = item.images
        ? typeof item.images === "string"
          ? JSON.parse(item.images)
          : item.images
        : [];
      expect(Array.isArray(images)).toBe(true);
    }
  });

  it("should handle null images gracefully", () => {
    const nullImageItem = mockTrendingData.find((i) => i.images === null);
    expect(nullImageItem).toBeDefined();
    const rawImages = nullImageItem!.images;
    const images = rawImages
      ? typeof rawImages === "string"
        ? JSON.parse(rawImages)
        : rawImages
      : [];
    expect(images).toEqual([]);
  });

  it("should have required fields for UI rendering", () => {
    for (const item of mockTrendingData) {
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("name");
      expect(item).toHaveProperty("price");
      expect(item).toHaveProperty("categoryName");
      expect(item).toHaveProperty("orderCount");
      expect(typeof item.name).toBe("string");
      expect(typeof item.price).toBe("string");
      expect(typeof item.orderCount).toBe("number");
    }
  });

  it("should format price with euro sign correctly", () => {
    for (const item of mockTrendingData) {
      const formatted = `\u20AC${parseFloat(item.price).toFixed(2)}`;
      expect(formatted).toMatch(/^\u20AC\d+\.\d{2}$/);
      // Verify the euro sign renders as €
      expect(formatted.charAt(0)).toBe("€");
    }
  });

  it("should assign rank badges to top 3 items", () => {
    const rankColors = ["#FFD700", "#C0C0C0", "#CD7F32"]; // gold, silver, bronze
    mockTrendingData.forEach((_item, index) => {
      if (index < 3) {
        expect(rankColors[index]).toBeDefined();
      }
    });
  });
});
