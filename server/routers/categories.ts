import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { productCategories } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { storagePut } from "../storage";
import axios from "axios";

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

  // Upload category image
  uploadImage: publicProcedure
    .input(
      z.object({
        uri: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // Download image from URI
        const response = await axios.get(input.uri, { responseType: "arraybuffer" });
        const buffer = Buffer.from(response.data);
        const contentType = response.headers["content-type"] || "image/jpeg";
        
        // Generate unique filename
        const timestamp = Date.now();
        const ext = contentType.split("/")[1] || "jpg";
        const filename = `category-${timestamp}.${ext}`;
        
        // Upload to storage
        const result = await storagePut(`category-images/${filename}`, buffer, contentType);
        return { url: result.url };
      } catch (error: any) {
        throw new Error(`Failed to upload image: ${error.message}`);
      }
    }),
});
