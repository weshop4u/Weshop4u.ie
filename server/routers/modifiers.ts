import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { modifierGroups, modifiers, multiBuyDeals, orderItemModifiers, products } from "../../drizzle/schema";
import { eq, and, asc, inArray } from "drizzle-orm";

export const modifiersRouter = router({
  // ===== MODIFIER GROUPS =====

  // Get all modifier groups + modifiers for a product
  getForProduct: publicProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const groups = await db
        .select()
        .from(modifierGroups)
        .where(eq(modifierGroups.productId, input.productId))
        .orderBy(asc(modifierGroups.sortOrder), asc(modifierGroups.id));

      if (groups.length === 0) return { groups: [], deals: [] };

      const groupIds = groups.map(g => g.id);
      const mods = await db
        .select()
        .from(modifiers)
        .where(and(inArray(modifiers.groupId, groupIds), eq(modifiers.isActive, true)))
        .orderBy(asc(modifiers.sortOrder), asc(modifiers.id));

      // Get multi-buy deals for this product
      const deals = await db
        .select()
        .from(multiBuyDeals)
        .where(and(eq(multiBuyDeals.productId, input.productId), eq(multiBuyDeals.isActive, true)));

      return {
        groups: groups.map(g => ({
          ...g,
          modifiers: mods.filter(m => m.groupId === g.id),
        })),
        deals,
      };
    }),

  // Create a modifier group
  createGroup: publicProcedure
    .input(z.object({
      productId: z.number(),
      name: z.string().min(1),
      type: z.enum(["single", "multi"]).default("single"),
      required: z.boolean().default(false),
      minSelections: z.number().default(0),
      maxSelections: z.number().default(0),
      sortOrder: z.number().default(0),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const result = await db.insert(modifierGroups).values({
        productId: input.productId,
        name: input.name,
        type: input.type,
        required: input.required,
        minSelections: input.minSelections,
        maxSelections: input.maxSelections,
        sortOrder: input.sortOrder,
      });

      return { id: Number(result[0].insertId), success: true };
    }),

  // Update a modifier group
  updateGroup: publicProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      type: z.enum(["single", "multi"]).optional(),
      required: z.boolean().optional(),
      minSelections: z.number().optional(),
      maxSelections: z.number().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { id, ...updateData } = input;
      const cleanData: any = {};
      Object.entries(updateData).forEach(([k, v]) => {
        if (v !== undefined) cleanData[k] = v;
      });

      if (Object.keys(cleanData).length > 0) {
        await db.update(modifierGroups).set(cleanData).where(eq(modifierGroups.id, id));
      }

      return { success: true };
    }),

  // Delete a modifier group (and its modifiers)
  deleteGroup: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Delete all modifiers in this group first
      await db.delete(modifiers).where(eq(modifiers.groupId, input.id));
      // Delete the group
      await db.delete(modifierGroups).where(eq(modifierGroups.id, input.id));

      return { success: true };
    }),

  // ===== MODIFIERS =====

  // Add a modifier to a group
  createModifier: publicProcedure
    .input(z.object({
      groupId: z.number(),
      name: z.string().min(1),
      price: z.string().default("0.00"), // decimal as string
      isDefault: z.boolean().default(false),
      sortOrder: z.number().default(0),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const result = await db.insert(modifiers).values({
        groupId: input.groupId,
        name: input.name,
        price: input.price,
        isDefault: input.isDefault,
        sortOrder: input.sortOrder,
      });

      return { id: Number(result[0].insertId), success: true };
    }),

  // Update a modifier
  updateModifier: publicProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      price: z.string().optional(),
      isDefault: z.boolean().optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { id, ...updateData } = input;
      const cleanData: any = {};
      Object.entries(updateData).forEach(([k, v]) => {
        if (v !== undefined) cleanData[k] = v;
      });

      if (Object.keys(cleanData).length > 0) {
        await db.update(modifiers).set(cleanData).where(eq(modifiers.id, id));
      }

      return { success: true };
    }),

  // Delete a modifier
  deleteModifier: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.delete(modifiers).where(eq(modifiers.id, input.id));
      return { success: true };
    }),

  // Bulk create modifiers for a group (used when setting up a new group with multiple options)
  bulkCreateModifiers: publicProcedure
    .input(z.object({
      groupId: z.number(),
      modifiers: z.array(z.object({
        name: z.string().min(1),
        price: z.string().default("0.00"),
        isDefault: z.boolean().default(false),
        sortOrder: z.number().default(0),
      })),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      if (input.modifiers.length === 0) return { success: true, count: 0 };

      const values = input.modifiers.map(m => ({
        groupId: input.groupId,
        name: m.name,
        price: m.price,
        isDefault: m.isDefault,
        sortOrder: m.sortOrder,
      }));

      await db.insert(modifiers).values(values);
      return { success: true, count: values.length };
    }),

  // ===== MULTI-BUY DEALS =====

  // Get deals for a product
  getDeals: publicProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      return db
        .select()
        .from(multiBuyDeals)
        .where(eq(multiBuyDeals.productId, input.productId));
    }),

  // Create a multi-buy deal
  createDeal: publicProcedure
    .input(z.object({
      productId: z.number(),
      quantity: z.number().min(2),
      dealPrice: z.string(), // decimal as string
      label: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Auto-generate label if not provided
      const label = input.label || `${input.quantity} for €${input.dealPrice}`;

      const result = await db.insert(multiBuyDeals).values({
        productId: input.productId,
        quantity: input.quantity,
        dealPrice: input.dealPrice,
        label,
      });

      return { id: Number(result[0].insertId), success: true };
    }),

  // Update a multi-buy deal
  updateDeal: publicProcedure
    .input(z.object({
      id: z.number(),
      quantity: z.number().min(2).optional(),
      dealPrice: z.string().optional(),
      label: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { id, ...updateData } = input;
      const cleanData: any = {};
      Object.entries(updateData).forEach(([k, v]) => {
        if (v !== undefined) cleanData[k] = v;
      });

      if (Object.keys(cleanData).length > 0) {
        await db.update(multiBuyDeals).set(cleanData).where(eq(multiBuyDeals.id, id));
      }

      return { success: true };
    }),

  // Delete a multi-buy deal
  deleteDeal: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.delete(multiBuyDeals).where(eq(multiBuyDeals.id, input.id));
      return { success: true };
    }),

  // ===== ORDER ITEM MODIFIERS =====

  // Get modifiers for order items (used in order detail, receipt, driver view)
  getForOrderItems: publicProcedure
    .input(z.object({ orderItemIds: z.array(z.number()) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      if (input.orderItemIds.length === 0) return [];

      return db
        .select()
        .from(orderItemModifiers)
        .where(inArray(orderItemModifiers.orderItemId, input.orderItemIds));
    }),

  // Copy modifier groups from one product to another (useful for similar products)
  copyGroups: publicProcedure
    .input(z.object({
      sourceProductId: z.number(),
      targetProductId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get source groups
      const sourceGroups = await db
        .select()
        .from(modifierGroups)
        .where(eq(modifierGroups.productId, input.sourceProductId));

      if (sourceGroups.length === 0) return { success: true, count: 0 };

      let copiedCount = 0;

      for (const group of sourceGroups) {
        // Create group on target
        const newGroupResult = await db.insert(modifierGroups).values({
          productId: input.targetProductId,
          name: group.name,
          type: group.type,
          required: group.required,
          minSelections: group.minSelections,
          maxSelections: group.maxSelections,
          sortOrder: group.sortOrder,
        });
        const newGroupId = Number(newGroupResult[0].insertId);

        // Copy modifiers
        const sourceMods = await db
          .select()
          .from(modifiers)
          .where(eq(modifiers.groupId, group.id));

        if (sourceMods.length > 0) {
          await db.insert(modifiers).values(
            sourceMods.map(m => ({
              groupId: newGroupId,
              name: m.name,
              price: m.price,
              isDefault: m.isDefault,
              sortOrder: m.sortOrder,
            }))
          );
        }

        copiedCount++;
      }

      return { success: true, count: copiedCount };
    }),
});
