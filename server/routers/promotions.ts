import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { storePromotions, products } from "../../drizzle/schema";
import { eq, and, asc } from "drizzle-orm";

export const promotionsRouter = router({
  // Active promotion for a store, or null. Drives the checkout prompt.
  getForStore: publicProcedure
    .input(z.object({ storeId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [promo] = await db
        .select()
        .from(storePromotions)
        .where(
          and(
            eq(storePromotions.storeId, input.storeId),
            eq(storePromotions.isActive, true)
          )
        )
        .limit(1);

      if (!promo) return null;

      return {
        id: promo.id,
        name: promo.name,
        minSubtotal: parseFloat(promo.minSubtotal),
        freeItemCategoryId: promo.freeItemCategoryId,
        maxFreeItems: promo.maxFreeItems,
        promptTitle: promo.promptTitle,
        promptBody: promo.promptBody,
      };
    }),

  // Products the customer can choose from as their free item.
  // Scoped to BOTH the promotion's category and the store, so a second
  // bubble tea shop on the same category can never appear here.
  getFreeItems: publicProcedure
    .input(z.object({ promotionId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [promo] = await db
        .select()
        .from(storePromotions)
        .where(eq(storePromotions.id, input.promotionId))
        .limit(1);

      if (!promo) return [];

      const items = await db
        .select({
          id: products.id,
          name: products.name,
          description: products.description,
          images: products.images,
          price: products.price,
          stockStatus: products.stockStatus,
        })
        .from(products)
        .where(
          and(
            eq(products.storeId, promo.storeId),
            eq(products.categoryId, promo.freeItemCategoryId),
            eq(products.isActive, true)
          )
        )
        .orderBy(asc(products.sortOrder), asc(products.name));

      return items
        .filter((p) => p.stockStatus !== "out_of_stock")
        .map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          images: p.images,
          price: p.price,
        }));
    }),
});
