import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { stores, products, productCategories, modifierGroups, productModifierTemplates, categoryModifierTemplates } from "../../drizzle/schema";
import { eq, and, like, sql, inArray, count } from "drizzle-orm";
import { storagePut } from "../storage";

// Railway PostgreSQL Migration - v1.0.5 - Force rebuild with explicit PostgreSQL support
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

      // Force PostgreSQL - v1.0.4 - Raw query to ensure new code is deployed
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
    .input(z.object({
      storeId: z.number(),
      search: z.string().optional(),
      categoryId: z.number().optional(),
      filter: z.enum(["all", "no_desc", "no_image", "drs", "out_of_stock", "pinned"]).optional(),
      wssFilter: z.enum(["wss", "non_wss"]).optional(),
      limit: z.number().optional().default(100),
      offset: z.number().optional().default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      let conditions: any[] = [
        eq(products.storeId, input.storeId),
        eq(products.isActive, true),
      ];

      // Server-side search
      if (input.search && input.search.trim()) {
        const term = `%${input.search.trim()}%`;
        conditions.push(sql`(LOWER(${products.name}) LIKE LOWER(${term}) OR LOWER(${products.sku}) LIKE LOWER(${term}))`);
      }

      // Server-side category filter
      if (input.categoryId) {
        conditions.push(eq(products.categoryId, input.categoryId));
      }

      // Server-side special filters
      if (input.filter === "no_desc") {
        conditions.push(sql`(${products.description} IS NULL OR ${products.description} = '')`);
      } else if (input.filter === "no_image") {
        conditions.push(sql`(${products.images} IS NULL OR ${products.images} = '' OR ${products.images} = '[]')`);
      } else if (input.filter === "drs") {
        conditions.push(eq(products.isDrs, true));
      } else if (input.filter === "out_of_stock") {
        conditions.push(eq(products.stockStatus, "out_of_stock"));
      } else if (input.filter === "pinned") {
        conditions.push(eq(products.pinnedToTrending, true));
      }

      // WSS filter
      if (input.wssFilter === "wss") {
        conditions.push(eq(products.isWss, true));
      } else if (input.wssFilter === "non_wss") {
        conditions.push(eq(products.isWss, false));
      }

      // Get total count for this query
      const [{ total }] = await db
        .select({ total: count() })
        .from(products)
        .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
        .where(and(...conditions));

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
          pinnedToTrending: products.pinnedToTrending,
          sortOrder: products.sortOrder,
          priceVerified: products.priceVerified,
          isWss: products.isWss,
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
        .where(and(...conditions))
        .orderBy(products.name)
        .limit(input.limit)
        .offset(input.offset);

      // Get category summary for this store (always unfiltered)
      const categorySummary = await db
        .select({
          categoryId: products.categoryId,
          categoryName: productCategories.name,
          count: count(),
        })
        .from(products)
        .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
        .where(and(eq(products.storeId, input.storeId), eq(products.isActive, true)))
        .groupBy(products.categoryId, productCategories.name);

      // Get counts for filter badges (always unfiltered by search/category)
      const baseConditions = [eq(products.storeId, input.storeId), eq(products.isActive, true)];
      const [{ noDescCount }] = await db
        .select({ noDescCount: count() })
        .from(products)
        .where(and(...baseConditions, sql`(${products.description} IS NULL OR ${products.description} = '')`));
      const [{ noImageCount }] = await db
        .select({ noImageCount: count() })
        .from(products)
        .where(and(...baseConditions, sql`(${products.images} IS NULL OR ${products.images} = '' OR ${products.images} = '[]')`));
      const [{ drsCount }] = await db
        .select({ drsCount: count() })
        .from(products)
        .where(and(...baseConditions, eq(products.isDrs, true)));
      const [{ outOfStockCount }] = await db
        .select({ outOfStockCount: count() })
        .from(products)
        .where(and(...baseConditions, eq(products.stockStatus, "out_of_stock")));

      // Check which products have modifiers (custom groups, product templates, or category templates)
      const productIds = productsList.map((p: any) => p.id);
      const categoryIds = [...new Set(productsList.map((p: any) => p.categoryId).filter(Boolean))] as number[];

      // Products with custom modifier groups
      const productsWithGroups = productIds.length > 0 ? await db
        .select({ productId: modifierGroups.productId })
        .from(modifierGroups)
        .where(inArray(modifierGroups.productId, productIds))
        .groupBy(modifierGroups.productId) : [];
      const groupProductIds = new Set(productsWithGroups.map((r: any) => r.productId));

      // Products with directly assigned templates
      const productsWithTemplates = productIds.length > 0 ? await db
        .select({ productId: productModifierTemplates.productId })
        .from(productModifierTemplates)
        .where(inArray(productModifierTemplates.productId, productIds))
        .groupBy(productModifierTemplates.productId) : [];
      const templateProductIds = new Set(productsWithTemplates.map((r: any) => r.productId));

      // Categories with assigned templates
      const categoriesWithTemplates = categoryIds.length > 0 ? await db
        .select({ categoryId: categoryModifierTemplates.categoryId })
        .from(categoryModifierTemplates)
        .where(inArray(categoryModifierTemplates.categoryId, categoryIds))
        .groupBy(categoryModifierTemplates.categoryId) : [];
      const templateCategoryIds = new Set(categoriesWithTemplates.map((r: any) => r.categoryId));

      // Parse images JSON string to array for client
      const items = productsList.map((p: any) => ({
        ...p,
        images: p.images ? (() => { try { return JSON.parse(p.images as string); } catch { return [p.images]; } })() : [],
        hasModifiers: groupProductIds.has(p.id) || templateProductIds.has(p.id) || (p.categoryId ? templateCategoryIds.has(p.categoryId) : false),
      }));

      return {
        items,
        total,
        categories: categorySummary.map((c: any) => ({ id: c.categoryId, name: c.categoryName || "Uncategorized", count: c.count })),
        counts: { noDesc: noDescCount, noImage: noImageCount, drs: drsCount, outOfStock: outOfStockCount },
      };
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
          pinnedToTrending: products.pinnedToTrending,
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
        .limit(20);

      // Parse images and group by store
      return results.map((r: any) => ({
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
      const categoryMap = new Map(categories.map((c: any) => [c.slug, c.id]));

      // Insert products
      const productsToInsert = input.products.map((p: any) => ({
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
        pinnedToTrending: z.boolean().optional(),
        priceVerified: z.boolean().optional(),
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
      if (input.pinnedToTrending !== undefined) updateData.pinnedToTrending = input.pinnedToTrending;
      if (input.priceVerified !== undefined) updateData.priceVerified = input.priceVerified;

      await db.update(products).set(updateData).where(eq(products.id, input.id));

      return { success: true };
    }),

  // Toggle price verified status on a single product
  togglePriceVerified: publicProcedure
    .input(z.object({
      productId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Get current product to toggle the status
      const product = await db.select().from(products).where(eq(products.id, input.productId)).limit(1);
      if (product.length === 0) {
        throw new Error("Product not found");
      }

      const newStatus = !product[0].priceVerified;
      await db.update(products)
        .set({ priceVerified: newStatus })
        .where(eq(products.id, input.productId));

      return { success: true, priceVerified: newStatus };
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

  // Bulk update stock status on multiple products
  bulkUpdateStock: publicProcedure
    .input(z.object({
      productIds: z.array(z.number()),
      stockStatus: z.enum(["in_stock", "out_of_stock", "low_stock"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      await db.update(products)
        .set({ stockStatus: input.stockStatus })
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
      pinnedToTrending: z.boolean().optional(),
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
          pinnedToTrending: input.pinnedToTrending ?? false,
        });

        createdIds.push(Number(result[0].insertId));
      }

      return { ids: createdIds, success: true, count: createdIds.length };
    }),

  duplicateProduct: publicProcedure
    .input(z.object({
      productId: z.number(),
      targetStoreIds: z.array(z.number()).min(1),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Fetch the source product
      const [source] = await db
        .select()
        .from(products)
        .where(eq(products.id, input.productId))
        .limit(1);

      if (!source) throw new Error("Product not found");

      const createdIds: number[] = [];

      for (const storeId of input.targetStoreIds) {
        // Skip if same store as source
        if (storeId === source.storeId) continue;

        const result = await db.insert(products).values({
          storeId,
          name: source.name,
          description: source.description,
          price: source.price,
          categoryId: source.categoryId,
          stockStatus: source.stockStatus || "in_stock",
          isActive: source.isActive ?? true,
          images: source.images,
          isDrs: source.isDrs ?? false,
          sku: source.sku,
          barcode: source.barcode,
          quantity: source.quantity,
        });

        createdIds.push(Number(result[0].insertId));
      }

      return { ids: createdIds, success: true, count: createdIds.length };
    }),

  // Toggle WSS flag for a product
  toggleWss: publicProcedure
    .input(z.object({
      productId: z.number(),
      isWss: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      try {
        console.log(`[toggleWss] Updating product ${input.productId} to isWss=${input.isWss}`);
        const result = await db
          .update(products)
          .set({ isWss: input.isWss })
          .where(eq(products.id, input.productId));

        console.log(`[toggleWss] Update result:`, result);
        return { success: true, productId: input.productId, isWss: input.isWss };
      } catch (error: any) {
        console.error(`[toggleWss] Error updating product:`, error);
        throw error;
      }
    }),
});
