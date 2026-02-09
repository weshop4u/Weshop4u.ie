import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { productCategories } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export const categoriesRouter = router({
  // Get all categories
  getAll: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    const categories = await db.select().from(productCategories);
    return categories;
  }),

  // Update category image
  updateImage: publicProcedure
    .input(
      z.object({
        id: z.number(),
        imageUrl: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      await db
        .update(productCategories)
        .set({ icon: input.imageUrl })
        .where(eq(productCategories.id, input.id));

      return { success: true };
    }),
});
