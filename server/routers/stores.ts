import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { stores, products, productCategories } from "../../drizzle/schema";
import { eq, and, like, sql } from "drizzle-orm";
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
      if (input.image !== undefined && input.image.length > 10 && (input.image.startsWith('http') || input.image.startsWith('data:'))) {
        updateData.images = JSON.stringify([input.image]);
      }
      if (input.quantity !== undefined) updateData.quantity = input.quantity;
      if (input.sku !== undefined) updateData.sku = input.sku;
      if (input.stockStatus !== undefined) updateData.stockStatus = input.stockStatus;
      if (input.categoryId !== undefined) updateData.categoryId = input.categoryId;

      await db.update(products).set(updateData).where(eq(products.id, input.id));

      return { success: true };
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
        const buffer = Buffer.from(input.base64, "base64");
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
});
