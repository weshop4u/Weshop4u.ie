import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { discountCodes, discountUsage, stores, users } from "../../drizzle/schema";
import { eq, and, sql, desc } from "drizzle-orm";

export const discountsRouter = router({
  // List all discount codes (admin)
  list: publicProcedure
    .input(
      z.object({
        includeInactive: z.boolean().optional().default(false),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];
      if (!input?.includeInactive) {
        conditions.push(eq(discountCodes.isActive, true));
      }

      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const codes = await db
        .select({
          id: discountCodes.id,
          code: discountCodes.code,
          description: discountCodes.description,
          discountType: discountCodes.discountType,
          discountValue: discountCodes.discountValue,
          minOrderValue: discountCodes.minOrderValue,
          maxDiscountAmount: discountCodes.maxDiscountAmount,
          storeId: discountCodes.storeId,
          maxUsesTotal: discountCodes.maxUsesTotal,
          maxUsesPerCustomer: discountCodes.maxUsesPerCustomer,
          currentUsesTotal: discountCodes.currentUsesTotal,
          startsAt: discountCodes.startsAt,
          expiresAt: discountCodes.expiresAt,
          isActive: discountCodes.isActive,
          createdAt: discountCodes.createdAt,
        })
        .from(discountCodes)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(discountCodes.createdAt));

      // Get store names for store-specific codes
      const storeIds = codes.filter(c => c.storeId).map(c => c.storeId!);
      let storeMap: Record<number, string> = {};
      if (storeIds.length > 0) {
        const storeList = await db
          .select({ id: stores.id, name: stores.name })
          .from(stores);
        storeMap = Object.fromEntries(storeList.map(s => [s.id, s.name]));
      }

      return codes.map(c => ({
        ...c,
        storeName: c.storeId ? storeMap[c.storeId] || null : null,
      }));
    }),

  // Get a single discount code by ID (admin)
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [code] = await db
        .select()
        .from(discountCodes)
        .where(eq(discountCodes.id, input.id))
        .limit(1);

      if (!code) throw new Error("Discount code not found");

      // Get usage stats
      const usage = await db
        .select({
          id: discountUsage.id,
          customerId: discountUsage.customerId,
          customerName: users.name,
          customerEmail: users.email,
          orderId: discountUsage.orderId,
          discountAmount: discountUsage.discountAmount,
          usedAt: discountUsage.usedAt,
        })
        .from(discountUsage)
        .leftJoin(users, eq(discountUsage.customerId, users.id))
        .where(eq(discountUsage.discountCodeId, input.id))
        .orderBy(desc(discountUsage.usedAt));

      return { ...code, usage };
    }),

  // Create a new discount code (admin)
  create: publicProcedure
    .input(
      z.object({
        code: z.string().min(1).max(50).transform(v => v.toUpperCase().replace(/\s/g, "")),
        description: z.string().max(255).optional(),
        discountType: z.enum(["percentage", "fixed_amount", "free_delivery"]),
        discountValue: z.number().min(0).optional().default(0),
        minOrderValue: z.number().min(0).optional().default(0),
        maxDiscountAmount: z.number().min(0).optional().nullable(),
        storeId: z.number().optional().nullable(),
        maxUsesTotal: z.number().min(1).optional().nullable(),
        maxUsesPerCustomer: z.number().min(1).optional().default(1),
        startsAt: z.string().optional().nullable(),
        expiresAt: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      // Check if code already exists
      const [existing] = await db
        .select({ id: discountCodes.id })
        .from(discountCodes)
        .where(eq(discountCodes.code, input.code))
        .limit(1);

      if (existing) throw new Error("A discount code with this name already exists");

      // Validate percentage is 1-100
      if (input.discountType === "percentage" && (input.discountValue < 1 || input.discountValue > 100)) {
        throw new Error("Percentage discount must be between 1 and 100");
      }

      await db.insert(discountCodes).values({
        code: input.code,
        description: input.description || null,
        discountType: input.discountType,
        discountValue: String(input.discountValue),
        minOrderValue: String(input.minOrderValue),
        maxDiscountAmount: input.maxDiscountAmount != null ? String(input.maxDiscountAmount) : null,
        storeId: input.storeId || null,
        maxUsesTotal: input.maxUsesTotal || null,
        maxUsesPerCustomer: input.maxUsesPerCustomer,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      });

      return { success: true };
    }),

  // Update a discount code (admin)
  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        description: z.string().max(255).optional(),
        discountType: z.enum(["percentage", "fixed_amount", "free_delivery"]).optional(),
        discountValue: z.number().min(0).optional(),
        minOrderValue: z.number().min(0).optional(),
        maxDiscountAmount: z.number().min(0).optional().nullable(),
        storeId: z.number().optional().nullable(),
        maxUsesTotal: z.number().min(1).optional().nullable(),
        maxUsesPerCustomer: z.number().min(1).optional(),
        startsAt: z.string().optional().nullable(),
        expiresAt: z.string().optional().nullable(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      const setValues: Record<string, unknown> = {};

      if (updates.description !== undefined) setValues.description = updates.description;
      if (updates.discountType !== undefined) setValues.discountType = updates.discountType;
      if (updates.discountValue !== undefined) setValues.discountValue = String(updates.discountValue);
      if (updates.minOrderValue !== undefined) setValues.minOrderValue = String(updates.minOrderValue);
      if (updates.maxDiscountAmount !== undefined) setValues.maxDiscountAmount = updates.maxDiscountAmount != null ? String(updates.maxDiscountAmount) : null;
      if (updates.storeId !== undefined) setValues.storeId = updates.storeId;
      if (updates.maxUsesTotal !== undefined) setValues.maxUsesTotal = updates.maxUsesTotal;
      if (updates.maxUsesPerCustomer !== undefined) setValues.maxUsesPerCustomer = updates.maxUsesPerCustomer;
      if (updates.startsAt !== undefined) setValues.startsAt = updates.startsAt ? new Date(updates.startsAt) : null;
      if (updates.expiresAt !== undefined) setValues.expiresAt = updates.expiresAt ? new Date(updates.expiresAt) : null;
      if (updates.isActive !== undefined) setValues.isActive = updates.isActive;

      const db = await getDb();
      if (!db) throw new Error("Database not available");
      if (Object.keys(setValues).length > 0) {
        await db
          .update(discountCodes)
          .set(setValues)
          .where(eq(discountCodes.id, id));
      }

      return { success: true };
    }),

  // Toggle active status (admin)
  toggleActive: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [code] = await db
        .select({ isActive: discountCodes.isActive })
        .from(discountCodes)
        .where(eq(discountCodes.id, input.id))
        .limit(1);

      if (!code) throw new Error("Discount code not found");

      await db
        .update(discountCodes)
        .set({ isActive: !code.isActive })
        .where(eq(discountCodes.id, input.id));

      return { success: true, isActive: !code.isActive };
    }),

  // Delete a discount code (admin)
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      // Delete usage records first
      await db.delete(discountUsage).where(eq(discountUsage.discountCodeId, input.id));
      await db.delete(discountCodes).where(eq(discountCodes.id, input.id));
      return { success: true };
    }),

  // Validate a discount code at checkout (customer-facing)
  validate: publicProcedure
    .input(
      z.object({
        code: z.string().transform(v => v.toUpperCase().replace(/\s/g, "")),
        storeId: z.number(),
        orderTotal: z.number(),
        customerId: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      // Find the code
      const [discountCode] = await db
        .select()
        .from(discountCodes)
        .where(eq(discountCodes.code, input.code))
        .limit(1);

      if (!discountCode) {
        return { valid: false, error: "Invalid discount code" };
      }

      if (!discountCode.isActive) {
        return { valid: false, error: "This discount code is no longer active" };
      }

      // Check store restriction
      if (discountCode.storeId && discountCode.storeId !== input.storeId) {
        return { valid: false, error: "This code is not valid for this store" };
      }

      // Check validity period
      const now = new Date();
      if (discountCode.startsAt && now < discountCode.startsAt) {
        return { valid: false, error: "This discount code is not active yet" };
      }
      if (discountCode.expiresAt && now > discountCode.expiresAt) {
        return { valid: false, error: "This discount code has expired" };
      }

      // Check total usage limit
      if (discountCode.maxUsesTotal && (discountCode.currentUsesTotal || 0) >= discountCode.maxUsesTotal) {
        return { valid: false, error: "This discount code has reached its usage limit" };
      }

      // Check per-customer usage limit
      if (discountCode.maxUsesPerCustomer) {
        const [customerUsage] = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(discountUsage)
          .where(
            and(
              eq(discountUsage.discountCodeId, discountCode.id),
              eq(discountUsage.customerId, input.customerId)
            )
          );

        if (customerUsage && customerUsage.count >= discountCode.maxUsesPerCustomer) {
          return { valid: false, error: "You've already used this discount code" };
        }
      }

      // Check minimum order value
      const minOrder = parseFloat(discountCode.minOrderValue as string) || 0;
      if (input.orderTotal < minOrder) {
        return {
          valid: false,
          error: `Minimum order of €${minOrder.toFixed(2)} required for this code`,
        };
      }

      // Calculate discount amount
      let discountAmount = 0;
      const discountValue = parseFloat(discountCode.discountValue as string) || 0;
      const maxDiscount = discountCode.maxDiscountAmount ? parseFloat(discountCode.maxDiscountAmount as string) : null;

      switch (discountCode.discountType) {
        case "percentage":
          discountAmount = (input.orderTotal * discountValue) / 100;
          if (maxDiscount && discountAmount > maxDiscount) {
            discountAmount = maxDiscount;
          }
          break;
        case "fixed_amount":
          discountAmount = Math.min(discountValue, input.orderTotal);
          break;
        case "free_delivery":
          discountAmount = 0; // Delivery fee handled separately at checkout
          break;
      }

      return {
        valid: true,
        discountCode: {
          id: discountCode.id,
          code: discountCode.code,
          discountType: discountCode.discountType,
          discountValue: discountValue,
          description: discountCode.description,
        },
        discountAmount: Math.round(discountAmount * 100) / 100,
        isFreeDelivery: discountCode.discountType === "free_delivery",
      };
    }),

  // Record usage of a discount code (called when order is placed)
  recordUsage: publicProcedure
    .input(
      z.object({
        discountCodeId: z.number(),
        customerId: z.number(),
        orderId: z.number().optional(),
        discountAmount: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      // Insert usage record
      await db.insert(discountUsage).values({
        discountCodeId: input.discountCodeId,
        customerId: input.customerId,
        orderId: input.orderId || null,
        discountAmount: String(input.discountAmount),
      });

      // Increment total usage count
      await db
        .update(discountCodes)
        .set({
          currentUsesTotal: sql`${discountCodes.currentUsesTotal} + 1`,
        })
        .where(eq(discountCodes.id, input.discountCodeId));

      return { success: true };
    }),
});
