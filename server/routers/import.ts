import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { products, productCategories } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

// Helper to create a URL-friendly slug from a category name
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 200);
}

// Helper to strip HTML tags from description
function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// Determine if a category should be age-restricted based on its name
function isAgeRestrictedCategory(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes("wine") ||
    lower.includes("beer") ||
    lower.includes("cider") ||
    lower.includes("spirit") ||
    lower.includes("whiskey") ||
    lower.includes("rum") ||
    lower.includes("gin") ||
    lower.includes("vodka") ||
    lower.includes("liqueur") ||
    lower.includes("champagne") ||
    lower.includes("cocktail") ||
    lower.includes("flavored alcohol") ||
    lower.includes("tobacco") ||
    lower.includes("cigar") ||
    lower.includes("cigarette") ||
    lower.includes("vape") ||
    lower.includes("nicotine")
  );
}

// Default alcohol availability schedule (Irish licensing hours)
function getAlcoholSchedule(): string {
  return JSON.stringify({
    mon: { open: "10:30", close: "22:00" },
    tue: { open: "10:30", close: "22:00" },
    wed: { open: "10:30", close: "22:00" },
    thu: { open: "10:30", close: "22:00" },
    fri: { open: "10:30", close: "22:00" },
    sat: { open: "10:30", close: "22:00" },
    sun: { open: "12:30", close: "22:00" },
  });
}

// Check if a category name is alcohol-related (not tobacco/vape)
function isAlcoholCategory(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes("wine") ||
    lower.includes("beer") ||
    lower.includes("cider") ||
    lower.includes("spirit") ||
    lower.includes("whiskey") ||
    lower.includes("rum") ||
    lower.includes("gin") ||
    lower.includes("vodka") ||
    lower.includes("liqueur") ||
    lower.includes("champagne") ||
    lower.includes("cocktail") ||
    lower.includes("flavored alcohol")
  );
}

export const importRouter = router({
  // Bulk import products from CSV data
  importProducts: publicProcedure
    .input(
      z.object({
        storeId: z.number(),
        products: z.array(
          z.object({
            botbleId: z.string().optional(),
            name: z.string(),
            description: z.string().optional(),
            price: z.string(),
            categoryName: z.string().optional(),
            sku: z.string().optional(),
            imageUrl: z.string().optional(),
            stockStatus: z.string().optional(),
            status: z.string().optional(),
          })
        ),
        clearExisting: z.boolean().default(false), // Whether to clear existing products first
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Step 1: Get existing categories
      const existingCategories = await db.select().from(productCategories);
      const categoryMap = new Map<string, number>();
      for (const cat of existingCategories) {
        categoryMap.set(cat.slug, cat.id);
        categoryMap.set(cat.name.toLowerCase(), cat.id);
      }

      // Step 2: Collect all unique category names from import data
      const newCategoryNames = new Set<string>();
      for (const p of input.products) {
        if (p.categoryName && p.categoryName.trim()) {
          const catName = p.categoryName.trim();
          const slug = slugify(catName);
          if (!categoryMap.has(slug) && !categoryMap.has(catName.toLowerCase())) {
            newCategoryNames.add(catName);
          }
        }
      }

      // Step 3: Create new categories
      let createdCategories = 0;
      for (const catName of newCategoryNames) {
        const slug = slugify(catName);
        // Check if slug already exists (might have been created by a previous iteration)
        const existing = await db
          .select()
          .from(productCategories)
          .where(eq(productCategories.slug, slug))
          .limit(1);

        if (existing.length === 0) {
          const ageRestricted = isAgeRestrictedCategory(catName);
          const availabilitySchedule = isAlcoholCategory(catName)
            ? getAlcoholSchedule()
            : null;

          const [result] = await db.insert(productCategories).values({
            name: catName,
            slug,
            description: null,
            icon: null,
            ageRestricted,
            availabilitySchedule,
            sortOrder: 0,
          });
          categoryMap.set(slug, (result as any).insertId);
          categoryMap.set(catName.toLowerCase(), (result as any).insertId);
          createdCategories++;
        } else {
          categoryMap.set(slug, existing[0].id);
          categoryMap.set(catName.toLowerCase(), existing[0].id);
        }
      }

      // Step 4: Optionally clear existing products for this store
      if (input.clearExisting) {
        await db.delete(products).where(eq(products.storeId, input.storeId));
      }

      // Step 5: Insert products in batches of 100
      let insertedCount = 0;
      let skippedCount = 0;
      const batchSize = 100;

      for (let i = 0; i < input.products.length; i += batchSize) {
        const batch = input.products.slice(i, i + batchSize);
        const productsToInsert = [];

        for (const p of batch) {
          // Skip products without a price
          if (!p.price || p.price.trim() === "" || parseFloat(p.price) <= 0) {
            skippedCount++;
            continue;
          }

          // Skip pending/draft products
          if (p.status && p.status !== "published") {
            skippedCount++;
            continue;
          }

          // Find category ID
          let categoryId: number | null = null;
          if (p.categoryName && p.categoryName.trim()) {
            const slug = slugify(p.categoryName.trim());
            categoryId =
              categoryMap.get(slug) ||
              categoryMap.get(p.categoryName.trim().toLowerCase()) ||
              null;
          }

          // If no category, use "General" category
          if (!categoryId) {
            const generalSlug = "general";
            if (!categoryMap.has(generalSlug)) {
              const [result] = await db.insert(productCategories).values({
                name: "General",
                slug: generalSlug,
                description: "Uncategorized products",
                icon: null,
                ageRestricted: false,
                availabilitySchedule: null,
                sortOrder: 999,
              });
              categoryMap.set(generalSlug, (result as any).insertId);
            }
            categoryId = categoryMap.get(generalSlug) || null;
          }

          // Clean description
          const description = p.description
            ? stripHtml(p.description)
            : null;

          // Build images JSON array
          const images = p.imageUrl ? JSON.stringify([p.imageUrl]) : null;

          // Map stock status
          const stockStatus =
            p.stockStatus === "out_of_stock" ? "out_of_stock" : "in_stock";

          productsToInsert.push({
            storeId: input.storeId,
            categoryId,
            name: p.name.trim(),
            description,
            sku: p.sku && p.sku.trim() ? p.sku.trim() : null,
            barcode: null,
            price: p.price.trim(),
            salePrice: null,
            images,
            stockStatus: stockStatus as "in_stock" | "out_of_stock" | "low_stock",
            quantity: stockStatus === "in_stock" ? 100 : 0,
            isActive: true,
            weight: null,
            dimensions: null,
          });
        }

        if (productsToInsert.length > 0) {
          await db.insert(products).values(productsToInsert);
          insertedCount += productsToInsert.length;
        }
      }

      return {
        success: true,
        inserted: insertedCount,
        skipped: skippedCount,
        categoriesCreated: createdCategories,
        totalProcessed: input.products.length,
      };
    }),

  // Get import status / preview
  previewImport: publicProcedure
    .input(
      z.object({
        storeId: z.number(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const existingProducts = await db
        .select()
        .from(products)
        .where(eq(products.storeId, input.storeId));

      const existingCats = await db.select().from(productCategories);

      return {
        existingProductCount: existingProducts.length,
        existingCategoryCount: existingCats.length,
      };
    }),
});
