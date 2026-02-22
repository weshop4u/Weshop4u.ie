import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { stores, products, productCategories } from "../../drizzle/schema";
import { eq, and, like, sql, inArray } from "drizzle-orm";
import { storagePut } from "../storage";

export const storesRouter = router({
  // Get all active stores
  list: publicProcedure
    .input(
      z.object({
        category: z.enum(["convenience", "restaurant", "hardware", "electrical", "clothing", "grocery", "pharmacy", "other"]).optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      let query = db.select().from(stores).where(eq(stores.isActive, true));
      
      if (input?.category) {
        query = db.select().from(stores).where(
          and(
            eq(stores.isActive, true),
            eq(stores.category, input.category)
          )
        );
      }

      const storesList = await query;
      // Sort by admin-set position (lower = higher in list)
      return storesList.sort((a, b) => (a.sortPosition ?? 999) - (b.sortPosition ?? 999));
    }),

  // Get store by ID
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      const result = await db
        .select()
        .from(stores)
        .where(eq(stores.id, input.id))
        .limit(1);

      if (result.length === 0) {
        throw new Error("Store not found");
      }

      return result[0];
    }),

  // Get store by slug
  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      const result = await db
        .select()
        .from(stores)
        .where(eq(stores.slug, input.slug))
        .limit(1);

      if (result.length === 0) {
        throw new Error("Store not found");
      }

      return result[0];
    }),

  // Get products for a store
  getProducts: publicProcedure
    .input(z.object({ storeId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      const productsList = await db
        .select({
          id: products.id,
          storeId: products.storeId,
          categoryId: products.categoryId,
          name: products.name,
          description: products.description,
          sku: products.sku,
          barcode: products.barcode,
          price: products.price,
          salePrice: products.salePrice,
          stockStatus: products.stockStatus,
          quantity: products.quantity,
          images: products.images,
          isActive: products.isActive,
          isDrs: products.isDrs,
          createdAt: products.createdAt,
          updatedAt: products.updatedAt,
          category: {
            id: productCategories.id,
            name: productCategories.name,
            slug: productCategories.slug,
            icon: productCategories.icon,
            ageRestricted: productCategories.ageRestricted,
            availabilitySchedule: productCategories.availabilitySchedule,
          },
        })
        .from(products)
        .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
        .where(
          and(
            eq(products.storeId, input.storeId),
            eq(products.isActive, true)
          )
        );

      // Parse images JSON string to array for client
      return productsList.map(p => ({
        ...p,
        images: p.images ? (() => { try { return JSON.parse(p.images as string); } catch { return [p.images]; } })() : [],
      }));
    }),

  // Get featured stores for homepage "Popular Stores" section
  getFeatured: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      const storesList = await db.select().from(stores).where(
        and(
          eq(stores.isActive, true),
          eq(stores.isFeatured, true)
        )
      );
      return storesList.sort((a, b) => (a.sortPosition ?? 999) - (b.sortPosition ?? 999));
    }),

  // Search products across all active stores
  searchProducts: publicProcedure
    .input(z.object({ query: z.string().min(1).max(100) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      const searchTerm = `%${input.query.toLowerCase()}%`;

      const results = await db
        .select({
          id: products.id,
          name: products.name,
          price: products.price,
          salePrice: products.salePrice,
          images: products.images,
          storeId: products.storeId,
          categoryId: products.categoryId,
          isDrs: products.isDrs,
          storeName: stores.name,
          storeLogo: stores.logo,
          storeCategory: stores.category,
          categoryName: productCategories.name,
        })
        .from(products)
        .innerJoin(stores, and(eq(products.storeId, stores.id), eq(stores.isActive, true)))
        .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
        .where(
          and(
            eq(products.isActive, true),
            sql`LOWER(${products.name}) LIKE ${searchTerm}`
          )
        )
        .limit(30);

      // Parse images and group by store
      return results.map(r => ({
        ...r,
        images: r.images ? (() => { try { return JSON.parse(r.images as string); } catch { return [r.images]; } })() : [],
      }));
    }),

  // Get all stores (including inactive for admin)
  getAll: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      const storesList = await db.select().from(stores);
      return storesList;
    }),

  // Import products in bulk
  importProducts: publicProcedure
    .input(
      z.object({
        storeId: z.number(),
        products: z.array(
          z.object({
            name: z.string(),
            description: z.string().optional(),
            price: z.string(),
            categorySlug: z.string().optional(),
            sku: z.string().optional(),
            barcode: z.string().optional(),
            quantity: z.number().optional(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Get all categories for slug lookup
      const categories = await db.select().from(productCategories);
      const categoryMap = new Map(categories.map(c => [c.slug, c.id]));

      // Insert products
      const productsToInsert = input.products.map(p => ({
        storeId: input.storeId,
        name: p.name,
        description: p.description || null,
        price: p.price,
        categoryId: p.categorySlug ? categoryMap.get(p.categorySlug) || null : null,
        sku: p.sku || null,
        barcode: p.barcode || null,
        quantity: p.quantity || 0,
        stockStatus: "in_stock" as const,
        isActive: true,
      }));

      await db.insert(products).values(productsToInsert);

      return { success: true, count: productsToInsert.length };
    }),

  // Update product
  updateProduct: publicProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        price: z.string().optional(),
        image: z.string().optional(),
        quantity: z.number().optional(),
        sku: z.string().optional(),
        stockStatus: z.enum(["in_stock", "out_of_stock", "low_stock"]).optional(),
        categoryId: z.number().nullable().optional(),
        isDrs: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      const updateData: any = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.price !== undefined) updateData.price = input.price;
      if (input.image !== undefined && input.image.length > 10) {
        if (input.image.startsWith('http')) {
          // Already a URL (e.g. from S3)
          updateData.images = JSON.stringify([input.image]);
        } else if (input.image.startsWith('data:') || input.image.length > 200) {
          // Base64 data - upload to S3 first
          try {
            let rawBase64 = input.image;
            let mimeType = 'image/jpeg';
            if (rawBase64.includes(',')) {
              const prefix = rawBase64.split(',')[0];
              const mimeMatch = prefix.match(/data:([^;]+)/);
              if (mimeMatch) mimeType = mimeMatch[1];
              rawBase64 = rawBase64.split(',')[1];
            }
            const buffer = Buffer.from(rawBase64, 'base64');
            const ext = mimeType.split('/')[1] || 'jpg';
            const timestamp = Date.now();
            const random = Math.random().toString(36).substring(2, 8);
            const filename = `product-image-${timestamp}-${random}.${ext}`;
            const result = await storagePut(`product-images/${filename}`, buffer, mimeType);
            updateData.images = JSON.stringify([result.url]);
          } catch (e: any) {
            console.warn('Failed to upload product image:', e.message);
          }
        }
      }
      if (input.quantity !== undefined) updateData.quantity = input.quantity;
      if (input.sku !== undefined) updateData.sku = input.sku;
      if (input.stockStatus !== undefined) updateData.stockStatus = input.stockStatus;
      if (input.categoryId !== undefined) updateData.categoryId = input.categoryId;
      if (input.isDrs !== undefined) updateData.isDrs = input.isDrs;

      await db.update(products).set(updateData).where(eq(products.id, input.id));

      return { success: true };
    }),

  // Bulk toggle DRS flag on multiple products
  bulkToggleDrs: publicProcedure
    .input(z.object({
      productIds: z.array(z.number()),
      isDrs: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      await db.update(products)
        .set({ isDrs: input.isDrs })
        .where(inArray(products.id, input.productIds));

      return { success: true, updatedCount: input.productIds.length };
    }),

  // Suggest products that likely need DRS flag based on keywords in drink categories
  suggestDrs: publicProcedure
    .input(z.object({ storeId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Get all active products for this store that are NOT already flagged as DRS
      const allProducts = await db.select({
        id: products.id,
        name: products.name,
        price: products.price,
        categoryName: productCategories.name,
      })
        .from(products)
        .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
        .where(
          and(
            eq(products.storeId, input.storeId),
            eq(products.isActive, true),
            eq(products.isDrs, false)
          )
        );

      // Keywords that suggest DRS-applicable products (container sizes)
      const drsKeywords = ["can", "bottle", "ml", "ltr", "litre", "liter", "330ml", "500ml", "440ml", "250ml", "750ml", "1l", "2l", "1.5l"];
      // Drink-related category keywords
      const drinkCategoryKeywords = ["drink", "beverage", "soft", "water", "juice", "beer", "cider", "energy", "soda", "mineral", "fizzy", "sparkling", "cola", "lemonade", "wine", "spirit", "alcohol", "smoothie", "shake", "protein"];
      // Categories to EXCLUDE from DRS suggestions (non-drink items that happen to have ml/can in names)
      const excludedCategories = ["ice cream", "household", "vape", "medicine", "personal", "tobacco", "cigar", "sweet", "candy", "animal", "gift", "pasta", "sauce", "soup", "oil", "condiment", "spread", "jam", "gravy", "herb", "spice", "rice", "noodle", "crisp", "nut", "chip", "bakery", "bread", "roll", "wrap", "sandwich", "meal", "breakfast", "confect", "halloween", "cantonese", "duck", "chicken", "beef", "prawn", "tofu", "pork"];

      const suggestions = allProducts.filter(p => {
        const name = p.name.toLowerCase();
        const cat = (p.categoryName || "").toLowerCase();

        // Skip products in excluded categories
        if (excludedCategories.some(exc => cat.includes(exc))) return false;
        // Skip milk cartons (not DRS)
        if (name.includes("milk") && (name.includes("ltr") || name.includes("litre") || /\d+\s*l\b/i.test(name))) return false;

        // Check if product name contains DRS keywords
        const nameHasKeyword = drsKeywords.some(kw => name.includes(kw));
        // Check if category is drink-related
        const isDrinkCategory = drinkCategoryKeywords.some(kw => cat.includes(kw));

        // Product is likely DRS if: name has container keyword, OR it's in a drink category with container-like name
        return nameHasKeyword || (isDrinkCategory && (name.includes("can") || name.includes("bottle") || /\d+\s*ml/i.test(name) || /\d+\s*l\b/i.test(name)));
      });

      return suggestions;
    }),

  // Delete product
  deleteProduct: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      await db.delete(products).where(eq(products.id, input.id));

      return { success: true };
    }),

  // Update store logo
  updateLogo: publicProcedure
    .input(
      z.object({
        id: z.number(),
        logoUrl: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      await db.update(stores).set({ logo: input.logoUrl }).where(eq(stores.id, input.id));

      return { success: true };
    }),

  // Upload store logo from base64 data
  uploadLogo: publicProcedure
    .input(z.object({
      base64: z.string(),
      mimeType: z.string().default("image/jpeg"),
    }))
    .mutation(async ({ input }) => {
      try {
        // Strip data URL prefix if present (e.g. "data:image/jpeg;base64,...")
        let rawBase64 = input.base64;
        if (rawBase64.includes(",")) {
          rawBase64 = rawBase64.split(",")[1];
        }
        const buffer = Buffer.from(rawBase64, "base64");
        const ext = input.mimeType.split("/")[1] || "jpg";
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const filename = `store-logo-${timestamp}-${random}.${ext}`;

        const result = await storagePut(`store-logos/${filename}`, buffer, input.mimeType);
        return { url: result.url };
      } catch (error: any) {
        throw new Error(`Failed to upload logo: ${error.message}`);
      }
    }),

  // Upload product image from base64 data
  uploadProductImage: publicProcedure
    .input(z.object({
      base64: z.string(),
      mimeType: z.string().default("image/jpeg"),
    }))
    .mutation(async ({ input }) => {
      try {
        let rawBase64 = input.base64;
        if (rawBase64.includes(",")) {
          rawBase64 = rawBase64.split(",")[1];
        }
        const buffer = Buffer.from(rawBase64, "base64");
        const ext = input.mimeType.split("/")[1] || "jpg";
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const filename = `product-image-${timestamp}-${random}.${ext}`;

        const result = await storagePut(`product-images/${filename}`, buffer, input.mimeType);
        return { url: result.url };
      } catch (error: any) {
        throw new Error(`Failed to upload product image: ${error.message}`);
      }
    }),

  // Add a new product (supports multi-store: copies product to each selected store)
  addProduct: publicProcedure
    .input(z.object({
      storeIds: z.array(z.number()).min(1),
      name: z.string().min(1),
      description: z.string().optional(),
      price: z.string(),
      categoryId: z.number().optional(),
      stockStatus: z.enum(["in_stock", "out_of_stock", "low_stock"]).optional(),
      isActive: z.boolean().optional(),
      imageUrl: z.string().optional(),
      isDrs: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const createdIds: number[] = [];

      for (const storeId of input.storeIds) {
        // For each store, find the matching category by name if categoryId is provided
        let targetCategoryId = input.categoryId || null;

        // Categories are global (not per-store), so the same categoryId works for all stores

        const result = await db.insert(products).values({
          storeId,
          name: input.name,
          description: input.description || null,
          price: input.price,
          categoryId: targetCategoryId,
          stockStatus: input.stockStatus || "in_stock",
          isActive: input.isActive ?? true,
          images: input.imageUrl ? JSON.stringify([input.imageUrl]) : null,
          isDrs: input.isDrs ?? false,
        });

        createdIds.push(Number(result[0].insertId));
      }

      return { ids: createdIds, success: true, count: createdIds.length };
    }),
});
