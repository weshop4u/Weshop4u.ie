import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { stores, products, productCategories } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

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
      return storesList;
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

      return productsList;
    }),
});
