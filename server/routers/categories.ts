import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { productCategories } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { storagePut } from "../storage";

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

  // Upload category image from base64 data
  uploadImage: publicProcedure
    .input(
      z.object({
        base64: z.string(),
        mimeType: z.string().default("image/jpeg"),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const buffer = Buffer.from(input.base64, "base64");
        const ext = input.mimeType.split("/")[1] || "jpg";
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const filename = `category-${timestamp}-${random}.${ext}`;

        const result = await storagePut(`category-images/${filename}`, buffer, input.mimeType);
        return { url: result.url };
      } catch (error: any) {
        throw new Error(`Failed to upload image: ${error.message}`);
      }
    }),
});
