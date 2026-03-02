import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { promotionalBanners } from "../../drizzle/schema";
import { getDb } from "../db";
import { eq, asc, and, lte, gte, isNull, or } from "drizzle-orm";

export const bannersRouter = router({
  // Public: get active banners for display
  getActive: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const now = new Date();
    const banners = await db
      .select()
      .from(promotionalBanners)
      .where(
        and(
          eq(promotionalBanners.isActive, true),
          or(isNull(promotionalBanners.startDate), lte(promotionalBanners.startDate, now)),
          or(isNull(promotionalBanners.endDate), gte(promotionalBanners.endDate, now))
        )
      )
      .orderBy(asc(promotionalBanners.sortPosition));
    return banners;
  }),

  // Admin: list all banners
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const banners = await db
      .select()
      .from(promotionalBanners)
      .orderBy(asc(promotionalBanners.sortPosition));
    return banners;
  }),

  // Admin: create banner
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        subtitle: z.string().optional(),
        discountCode: z.string().optional(),
        backgroundColor: z.string().default("#0F172A"),
        accentColor: z.string().default("#00E5FF"),
        isActive: z.boolean().default(true),
        sortPosition: z.number().default(0),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const result = await db.insert(promotionalBanners).values({
        title: input.title,
        subtitle: input.subtitle || null,
        discountCode: input.discountCode || null,
        backgroundColor: input.backgroundColor,
        accentColor: input.accentColor,
        isActive: input.isActive,
        sortPosition: input.sortPosition,
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
      });
      return { id: result[0].insertId };
    }),

  // Admin: update banner
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).optional(),
        subtitle: z.string().optional(),
        discountCode: z.string().optional(),
        backgroundColor: z.string().optional(),
        accentColor: z.string().optional(),
        isActive: z.boolean().optional(),
        sortPosition: z.number().optional(),
        startDate: z.string().nullable().optional(),
        endDate: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { id, ...updates } = input;
      const values: Record<string, any> = {};
      if (updates.title !== undefined) values.title = updates.title;
      if (updates.subtitle !== undefined) values.subtitle = updates.subtitle || null;
      if (updates.discountCode !== undefined) values.discountCode = updates.discountCode || null;
      if (updates.backgroundColor !== undefined) values.backgroundColor = updates.backgroundColor;
      if (updates.accentColor !== undefined) values.accentColor = updates.accentColor;
      if (updates.isActive !== undefined) values.isActive = updates.isActive;
      if (updates.sortPosition !== undefined) values.sortPosition = updates.sortPosition;
      if (updates.startDate !== undefined) values.startDate = updates.startDate ? new Date(updates.startDate) : null;
      if (updates.endDate !== undefined) values.endDate = updates.endDate ? new Date(updates.endDate) : null;

      await db.update(promotionalBanners).set(values).where(eq(promotionalBanners.id, id));
      return { success: true };
    }),

  // Admin: delete banner
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(promotionalBanners).where(eq(promotionalBanners.id, input.id));
      return { success: true };
    }),

  // Admin: toggle active
  toggleActive: protectedProcedure
    .input(z.object({ id: z.number(), isActive: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db
        .update(promotionalBanners)
        .set({ isActive: input.isActive })
        .where(eq(promotionalBanners.id, input.id));
      return { success: true };
    }),
});
