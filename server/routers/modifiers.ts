import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { modifierGroups, modifiers, multiBuyDeals, orderItemModifiers, products, modifierTemplates, modifierTemplateOptions, categoryModifierTemplates, productModifierTemplates } from "../../drizzle/schema";
import { eq, and, asc, inArray } from "drizzle-orm";

export const modifiersRouter = router({
  // ===== MODIFIER GROUPS =====

  // Get all modifier groups + modifiers for a product from three sources:
  // 1. Custom modifier groups directly on the product
  // 2. Product-level modifier templates
  // 3. Category-level modifier templates
  getForProduct: publicProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // SOURCE 1: Custom modifier groups directly on the product
      const customGroups = await db
        .select()
        .from(modifierGroups)
        .where(eq(modifierGroups.productId, input.productId))
        .orderBy(asc(modifierGroups.sortOrder), asc(modifierGroups.id));

      // SOURCE 2: Product-level modifier templates
      const productTemplateLinks = await db
        .select({ templateId: productModifierTemplates.templateId, sortOrder: productModifierTemplates.sortOrder })
        .from(productModifierTemplates)
        .where(eq(productModifierTemplates.productId, input.productId))
        .orderBy(asc(productModifierTemplates.sortOrder));

      let productTemplateGroups: any[] = [];
      if (productTemplateLinks.length > 0) {
        const templateIds = productTemplateLinks.map(link => link.templateId);
        const templates = await db
          .select()
          .from(modifierTemplates)
          .where(inArray(modifierTemplates.id, templateIds));

        const templateOptions = await db
          .select()
          .from(modifierTemplateOptions)
          .where(inArray(modifierTemplateOptions.templateId, templateIds))
          .orderBy(asc(modifierTemplateOptions.sortOrder), asc(modifierTemplateOptions.id));

        // Convert templates to modifier group format
        productTemplateGroups = templates.map((template) => ({
          id: `product_template_${template.id}`,
          productId: input.productId,
          name: template.name,
          type: template.type,
          required: template.required,
          minSelections: template.minSelections,
          maxSelections: template.maxSelections,
          allowOptionQuantity: template.allowOptionQuantity,
          maxOptionQuantity: template.maxOptionQuantity,
          sortOrder: productTemplateLinks.find(l => l.templateId === template.id)?.sortOrder ?? 0,
          isTemplate: true,
          templateId: template.id,
          templateOptions: templateOptions.filter(o => o.templateId === template.id),
        }));
      }

      // SOURCE 3: Category-level modifier templates
      const product = await db
        .select({ categoryId: products.categoryId })
        .from(products)
        .where(eq(products.id, input.productId));

      let categoryTemplateGroups: any[] = [];
      if (product.length > 0 && product[0].categoryId) {
        const categoryTemplateLinks = await db
          .select({ templateId: categoryModifierTemplates.templateId, sortOrder: categoryModifierTemplates.sortOrder })
          .from(categoryModifierTemplates)
          .where(eq(categoryModifierTemplates.categoryId, product[0].categoryId))
          .orderBy(asc(categoryModifierTemplates.sortOrder));

        if (categoryTemplateLinks.length > 0) {
          const templateIds = categoryTemplateLinks.map(link => link.templateId);
          const templates = await db
            .select()
            .from(modifierTemplates)
            .where(inArray(modifierTemplates.id, templateIds));

          const templateOptions = await db
            .select()
            .from(modifierTemplateOptions)
            .where(inArray(modifierTemplateOptions.templateId, templateIds))
            .orderBy(asc(modifierTemplateOptions.sortOrder), asc(modifierTemplateOptions.id));

          // Convert templates to modifier group format
          categoryTemplateGroups = templates.map((template) => ({
            id: `category_template_${template.id}`,
            productId: input.productId,
            name: template.name,
            type: template.type,
            required: template.required,
            minSelections: template.minSelections,
            maxSelections: template.maxSelections,
            allowOptionQuantity: template.allowOptionQuantity,
            maxOptionQuantity: template.maxOptionQuantity,
            sortOrder: categoryTemplateLinks.find(l => l.templateId === template.id)?.sortOrder ?? 0,
            isTemplate: true,
            templateId: template.id,
            templateOptions: templateOptions.filter(o => o.templateId === template.id),
          }));
        }
      }

      // COMBINE: Merge all groups from all three sources
      const allGroups = [...customGroups, ...productTemplateGroups, ...categoryTemplateGroups];
      
      // Remove duplicates by ID (in case same template is linked at both product and category level)
      const seenIds = new Set<string | number>();
      const uniqueGroups = allGroups.filter(g => {
        if (seenIds.has(g.id)) return false;
        seenIds.add(g.id);
        return true;
      });

      if (uniqueGroups.length === 0) return { groups: [], deals: [] };

      // Fetch modifiers for custom groups only (templates have their options already)
      const customGroupIds = customGroups.map(g => g.id);
      const mods = customGroupIds.length > 0 
        ? await db
            .select()
            .from(modifiers)
            .where(and(inArray(modifiers.groupId, customGroupIds), eq(modifiers.isActive, true)))
            .orderBy(asc(modifiers.sortOrder), asc(modifiers.id))
        : [];

      // Get multi-buy deals for this product
      const deals = await db
        .select()
        .from(multiBuyDeals)
        .where(and(eq(multiBuyDeals.productId, input.productId), eq(multiBuyDeals.isActive, true)));

      // Format response: convert template options to modifiers format for consistency
      const formattedGroups = uniqueGroups.map(g => ({
        ...g,
        modifiers: g.isTemplate 
          ? g.templateOptions.map(opt => ({
              id: opt.id,
              groupId: g.id,
              name: opt.name,
              price: opt.price,
              isActive: opt.available,
              sortOrder: opt.sortOrder,
            }))
          : mods.filter(m => m.groupId === g.id),
      }));

      return {
        groups: formattedGroups,
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
