import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { productCategories, products } from "../../drizzle/schema";
import { eq, sql } from "drizzle-orm";
import { storagePut } from "../storage";

// Availability schedule schema for per-day hours
const dayScheduleSchema = z.object({
  open: z.string().regex(/^\d{2}:\d{2}$/), // "10:30"
  close: z.string().regex(/^\d{2}:\d{2}$/), // "22:00"
});

const availabilityScheduleSchema = z.object({
  mon: dayScheduleSchema.optional(),
  tue: dayScheduleSchema.optional(),
  wed: dayScheduleSchema.optional(),
  thu: dayScheduleSchema.optional(),
  fri: dayScheduleSchema.optional(),
  sat: dayScheduleSchema.optional(),
  sun: dayScheduleSchema.optional(),
}).nullable();

export const categoriesRouter = router({
  // Get all categories with product counts
  getAll: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    const categories = await db.select().from(productCategories);
    return categories;
  }),

  // Get all categories with product counts for admin
  getAllWithCounts: publicProcedure
    .input(z.object({ storeId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const categories = await db.select().from(productCategories);

      // Get product counts per category
      const countQuery = input?.storeId
        ? db
            .select({
              categoryId: products.categoryId,
              count: sql<number>`COUNT(*)`.as("count"),
            })
            .from(products)
            .where(eq(products.storeId, input.storeId))
            .groupBy(products.categoryId)
        : db
            .select({
              categoryId: products.categoryId,
              count: sql<number>`COUNT(*)`.as("count"),
            })
            .from(products)
            .groupBy(products.categoryId);

      const counts = await countQuery;
      const countMap = new Map(counts.map((c) => [c.categoryId, c.count]));

      return categories.map((cat) => ({
        ...cat,
        productCount: countMap.get(cat.id) || 0,
      }));
    }),

  // Rename a category
  rename: publicProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).max(255),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Generate new slug from name
      const slug = input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .substring(0, 200);

      await db
        .update(productCategories)
        .set({ name: input.name, slug })
        .where(eq(productCategories.id, input.id));

      return { success: true };
    }),

  // Update category settings (age restriction, availability, sort order)
  updateSettings: publicProcedure
    .input(
      z.object({
        id: z.number(),
        ageRestricted: z.boolean().optional(),
        availabilitySchedule: availabilityScheduleSchema.optional(),
        sortOrder: z.number().optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const updateData: Record<string, any> = {};
      if (input.ageRestricted !== undefined) updateData.ageRestricted = input.ageRestricted;
      if (input.availabilitySchedule !== undefined) {
        updateData.availabilitySchedule = input.availabilitySchedule
          ? JSON.stringify(input.availabilitySchedule)
          : null;
      }
      if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;
      if (input.description !== undefined) updateData.description = input.description;

      if (Object.keys(updateData).length > 0) {
        await db
          .update(productCategories)
          .set(updateData)
          .where(eq(productCategories.id, input.id));
      }

      return { success: true };
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
      if (!db) throw new Error("Database not available");

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
        // Strip data URL prefix if present (e.g. "data:image/jpeg;base64,...")
        let rawBase64 = input.base64;
        if (rawBase64.includes(",")) {
          rawBase64 = rawBase64.split(",")[1];
        }
        const buffer = Buffer.from(rawBase64, "base64");
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

  // Delete a category (reassign products to General)
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Find or create "General" category
      let generalCat = await db
        .select()
        .from(productCategories)
        .where(eq(productCategories.slug, "general"))
        .limit(1);

      let generalId: number;
      if (generalCat.length === 0) {
        const [result] = await db.insert(productCategories).values({
          name: "General",
          slug: "general",
          description: "Uncategorized products",
          sortOrder: 999,
        });
        generalId = (result as any).insertId;
      } else {
        generalId = generalCat[0].id;
      }

      // Reassign products
      await db
        .update(products)
        .set({ categoryId: generalId })
        .where(eq(products.categoryId, input.id));

      // Delete the category
      await db.delete(productCategories).where(eq(productCategories.id, input.id));

      return { success: true };
    }),

  // Merge two categories (move all products from source to target, delete source)
  merge: publicProcedure
    .input(
      z.object({
        sourceId: z.number(),
        targetId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Move all products from source to target
      await db
        .update(products)
        .set({ categoryId: input.targetId })
        .where(eq(products.categoryId, input.sourceId));

      // Delete the source category
      await db.delete(productCategories).where(eq(productCategories.id, input.sourceId));

      return { success: true };
    }),
});
