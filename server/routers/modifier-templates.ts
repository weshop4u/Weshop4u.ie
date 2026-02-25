import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  modifierTemplates,
  modifierTemplateOptions,
  categoryModifierTemplates,
  productModifierTemplates,
  productTemplateExclusions,
  modifierGroups,
  modifiers,
  multiBuyDeals,
  products,
} from "../../drizzle/schema";
import { eq, and, asc, inArray } from "drizzle-orm";

export const modifierTemplatesRouter = router({
  // ===== TEMPLATE CRUD =====

  // List all templates with their options
  list: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const templates = await db
      .select()
      .from(modifierTemplates)
      .orderBy(asc(modifierTemplates.name));

    if (templates.length === 0) return [];

    const templateIds = templates.map((t) => t.id);
    const options = await db
      .select()
      .from(modifierTemplateOptions)
      .where(inArray(modifierTemplateOptions.templateId, templateIds))
      .orderBy(asc(modifierTemplateOptions.sortOrder), asc(modifierTemplateOptions.id));

    return templates.map((t) => ({
      ...t,
      options: options.filter((o) => o.templateId === t.id),
    }));
  }),

  // Get a single template with options
  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [template] = await db
        .select()
        .from(modifierTemplates)
        .where(eq(modifierTemplates.id, input.id));

      if (!template) throw new Error("Template not found");

      const options = await db
        .select()
        .from(modifierTemplateOptions)
        .where(eq(modifierTemplateOptions.templateId, input.id))
        .orderBy(asc(modifierTemplateOptions.sortOrder), asc(modifierTemplateOptions.id));

      return { ...template, options };
    }),

  // Create a template
  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        type: z.enum(["single", "multi"]).default("single"),
        required: z.boolean().default(false),
        minSelections: z.number().default(0),
        maxSelections: z.number().default(0),
        options: z
          .array(
            z.object({
              name: z.string().min(1),
              price: z.string().default("0.00"),
              isDefault: z.boolean().default(false),
              sortOrder: z.number().default(0),
            })
          )
          .default([]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const result = await db.insert(modifierTemplates).values({
        name: input.name,
        type: input.type,
        required: input.required,
        minSelections: input.minSelections,
        maxSelections: input.maxSelections,
      });

      const templateId = Number(result[0].insertId);

      // Create options if provided
      if (input.options.length > 0) {
        await db.insert(modifierTemplateOptions).values(
          input.options.map((o) => ({
            templateId,
            name: o.name,
            price: o.price,
            isDefault: o.isDefault,
            sortOrder: o.sortOrder,
          }))
        );
      }

      return { id: templateId, success: true };
    }),

  // Update a template
  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        type: z.enum(["single", "multi"]).optional(),
        required: z.boolean().optional(),
        minSelections: z.number().optional(),
        maxSelections: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { id, ...updateData } = input;
      const cleanData: any = {};
      Object.entries(updateData).forEach(([k, v]) => {
        if (v !== undefined) cleanData[k] = v;
      });

      if (Object.keys(cleanData).length > 0) {
        await db.update(modifierTemplates).set(cleanData).where(eq(modifierTemplates.id, id));
      }

      return { success: true };
    }),

  // Delete a template (and all its options + links)
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Delete all links first
      await db.delete(categoryModifierTemplates).where(eq(categoryModifierTemplates.templateId, input.id));
      await db.delete(productModifierTemplates).where(eq(productModifierTemplates.templateId, input.id));
      await db.delete(productTemplateExclusions).where(eq(productTemplateExclusions.templateId, input.id));
      // Delete options
      await db.delete(modifierTemplateOptions).where(eq(modifierTemplateOptions.templateId, input.id));
      // Delete template
      await db.delete(modifierTemplates).where(eq(modifierTemplates.id, input.id));

      return { success: true };
    }),

  // ===== TEMPLATE OPTIONS =====

  addOption: publicProcedure
    .input(
      z.object({
        templateId: z.number(),
        name: z.string().min(1),
        price: z.string().default("0.00"),
        isDefault: z.boolean().default(false),
        sortOrder: z.number().default(0),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const result = await db.insert(modifierTemplateOptions).values({
        templateId: input.templateId,
        name: input.name,
        price: input.price,
        isDefault: input.isDefault,
        sortOrder: input.sortOrder,
      });

      return { id: Number(result[0].insertId), success: true };
    }),

  updateOption: publicProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        price: z.string().optional(),
        isDefault: z.boolean().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { id, ...updateData } = input;
      const cleanData: any = {};
      Object.entries(updateData).forEach(([k, v]) => {
        if (v !== undefined) cleanData[k] = v;
      });

      if (Object.keys(cleanData).length > 0) {
        await db.update(modifierTemplateOptions).set(cleanData).where(eq(modifierTemplateOptions.id, id));
      }

      return { success: true };
    }),

  deleteOption: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.delete(modifierTemplateOptions).where(eq(modifierTemplateOptions.id, input.id));
      return { success: true };
    }),

  // ===== CATEGORY LINKING =====

  // Get templates assigned to a category
  getForCategory: publicProcedure
    .input(z.object({ categoryId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const links = await db
        .select()
        .from(categoryModifierTemplates)
        .where(eq(categoryModifierTemplates.categoryId, input.categoryId))
        .orderBy(asc(categoryModifierTemplates.sortOrder));

      if (links.length === 0) return [];

      const templateIds = links.map((l) => l.templateId);
      const templates = await db
        .select()
        .from(modifierTemplates)
        .where(inArray(modifierTemplates.id, templateIds));

      return links.map((l) => ({
        linkId: l.id,
        sortOrder: l.sortOrder,
        template: templates.find((t) => t.id === l.templateId)!,
      }));
    }),

  // Assign a template to a category
  assignToCategory: publicProcedure
    .input(
      z.object({
        categoryId: z.number(),
        templateId: z.number(),
        sortOrder: z.number().default(0),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Check if already assigned
      const existing = await db
        .select()
        .from(categoryModifierTemplates)
        .where(
          and(
            eq(categoryModifierTemplates.categoryId, input.categoryId),
            eq(categoryModifierTemplates.templateId, input.templateId)
          )
        );

      if (existing.length > 0) return { success: true, alreadyExists: true };

      await db.insert(categoryModifierTemplates).values({
        categoryId: input.categoryId,
        templateId: input.templateId,
        sortOrder: input.sortOrder,
      });

      return { success: true, alreadyExists: false };
    }),

  // Remove a template from a category
  removeFromCategory: publicProcedure
    .input(z.object({ linkId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.delete(categoryModifierTemplates).where(eq(categoryModifierTemplates.id, input.linkId));
      return { success: true };
    }),

  // ===== PRODUCT LINKING =====

  // Get templates manually assigned to a product
  getForProduct: publicProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const links = await db
        .select()
        .from(productModifierTemplates)
        .where(eq(productModifierTemplates.productId, input.productId))
        .orderBy(asc(productModifierTemplates.sortOrder));

      if (links.length === 0) return [];

      const templateIds = links.map((l) => l.templateId);
      const templates = await db
        .select()
        .from(modifierTemplates)
        .where(inArray(modifierTemplates.id, templateIds));

      return links.map((l) => ({
        linkId: l.id,
        sortOrder: l.sortOrder,
        template: templates.find((t) => t.id === l.templateId)!,
      }));
    }),

  // Assign a template to a product
  assignToProduct: publicProcedure
    .input(
      z.object({
        productId: z.number(),
        templateId: z.number(),
        sortOrder: z.number().default(0),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const existing = await db
        .select()
        .from(productModifierTemplates)
        .where(
          and(
            eq(productModifierTemplates.productId, input.productId),
            eq(productModifierTemplates.templateId, input.templateId)
          )
        );

      if (existing.length > 0) return { success: true, alreadyExists: true };

      await db.insert(productModifierTemplates).values({
        productId: input.productId,
        templateId: input.templateId,
        sortOrder: input.sortOrder,
      });

      return { success: true, alreadyExists: false };
    }),

  // Remove a template from a product
  removeFromProduct: publicProcedure
    .input(z.object({ linkId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.delete(productModifierTemplates).where(eq(productModifierTemplates.id, input.linkId));
      return { success: true };
    }),

  // ===== EXCLUSIONS =====

  // Get exclusions for a product (which category templates are opted out)
  getExclusions: publicProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      return db
        .select()
        .from(productTemplateExclusions)
        .where(eq(productTemplateExclusions.productId, input.productId));
    }),

  // Exclude a category template from a product
  excludeTemplate: publicProcedure
    .input(z.object({ productId: z.number(), templateId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const existing = await db
        .select()
        .from(productTemplateExclusions)
        .where(
          and(
            eq(productTemplateExclusions.productId, input.productId),
            eq(productTemplateExclusions.templateId, input.templateId)
          )
        );

      if (existing.length > 0) return { success: true };

      await db.insert(productTemplateExclusions).values({
        productId: input.productId,
        templateId: input.templateId,
      });

      return { success: true };
    }),

  // Re-include a category template for a product
  includeTemplate: publicProcedure
    .input(z.object({ productId: z.number(), templateId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .delete(productTemplateExclusions)
        .where(
          and(
            eq(productTemplateExclusions.productId, input.productId),
            eq(productTemplateExclusions.templateId, input.templateId)
          )
        );

      return { success: true };
    }),

  // ===== MERGED MODIFIER FETCH (CUSTOMER-FACING) =====
  // Combines: category-inherited templates + product-assigned templates + custom per-product modifiers
  // This is what the customer sees when viewing a product

  getAllForProduct: publicProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // 1. Get the product to find its categoryId
      const [product] = await db
        .select({ categoryId: products.categoryId })
        .from(products)
        .where(eq(products.id, input.productId));

      if (!product) throw new Error("Product not found");

      // 2. Get exclusions for this product
      const exclusions = await db
        .select()
        .from(productTemplateExclusions)
        .where(eq(productTemplateExclusions.productId, input.productId));
      const excludedTemplateIds = new Set(exclusions.map((e) => e.templateId));

      // 3. Get category-level templates (if product has a category)
      let categoryTemplateIds: number[] = [];
      if (product.categoryId) {
        const catLinks = await db
          .select()
          .from(categoryModifierTemplates)
          .where(eq(categoryModifierTemplates.categoryId, product.categoryId))
          .orderBy(asc(categoryModifierTemplates.sortOrder));

        categoryTemplateIds = catLinks
          .map((l) => l.templateId)
          .filter((id) => !excludedTemplateIds.has(id));
      }

      // 4. Get product-level templates
      const prodLinks = await db
        .select()
        .from(productModifierTemplates)
        .where(eq(productModifierTemplates.productId, input.productId))
        .orderBy(asc(productModifierTemplates.sortOrder));

      const productTemplateIds = prodLinks.map((l) => l.templateId);

      // 5. Merge template IDs (category first, then product, deduplicated)
      const allTemplateIds = [...new Set([...categoryTemplateIds, ...productTemplateIds])];

      // 6. Fetch template data + options
      let templateGroups: Array<{
        source: "category" | "product_template";
        templateId: number;
        name: string;
        type: "single" | "multi";
        required: boolean | null;
        minSelections: number | null;
        maxSelections: number | null;
        modifiers: Array<{
          id: number;
          name: string;
          price: string;
          isDefault: boolean | null;
        }>;
      }> = [];

      if (allTemplateIds.length > 0) {
        const templates = await db
          .select()
          .from(modifierTemplates)
          .where(inArray(modifierTemplates.id, allTemplateIds));

        const allOptions = await db
          .select()
          .from(modifierTemplateOptions)
          .where(inArray(modifierTemplateOptions.templateId, allTemplateIds))
          .orderBy(asc(modifierTemplateOptions.sortOrder), asc(modifierTemplateOptions.id));

        // Maintain order: category templates first, then product templates
        for (const tId of allTemplateIds) {
          const template = templates.find((t) => t.id === tId);
          if (!template) continue;

          const source = categoryTemplateIds.includes(tId) ? "category" as const : "product_template" as const;

          templateGroups.push({
            source,
            templateId: template.id,
            name: template.name,
            type: template.type,
            required: template.required,
            minSelections: template.minSelections,
            maxSelections: template.maxSelections,
            modifiers: allOptions
              .filter((o) => o.templateId === tId)
              .map((o) => ({
                id: o.id,
                name: o.name,
                price: String(o.price),
                isDefault: o.isDefault,
              })),
          });
        }
      }

      // 7. Get custom per-product modifier groups (existing system)
      const customGroups = await db
        .select()
        .from(modifierGroups)
        .where(eq(modifierGroups.productId, input.productId))
        .orderBy(asc(modifierGroups.sortOrder), asc(modifierGroups.id));

      let customGroupsWithMods: Array<{
        source: "custom";
        groupId: number;
        name: string;
        type: "single" | "multi";
        required: boolean | null;
        minSelections: number | null;
        maxSelections: number | null;
        modifiers: Array<{
          id: number;
          name: string;
          price: string;
          isDefault: boolean | null;
        }>;
      }> = [];

      if (customGroups.length > 0) {
        const groupIds = customGroups.map((g) => g.id);
        const customMods = await db
          .select()
          .from(modifiers)
          .where(and(inArray(modifiers.groupId, groupIds), eq(modifiers.isActive, true)))
          .orderBy(asc(modifiers.sortOrder), asc(modifiers.id));

        customGroupsWithMods = customGroups.map((g) => ({
          source: "custom" as const,
          groupId: g.id,
          name: g.name,
          type: g.type,
          required: g.required,
          minSelections: g.minSelections,
          maxSelections: g.maxSelections,
          modifiers: customMods
            .filter((m) => m.groupId === g.id)
            .map((m) => ({
              id: m.id,
              name: m.name,
              price: String(m.price),
              isDefault: m.isDefault,
            })),
        }));
      }

      // 8. Get multi-buy deals
      const deals = await db
        .select()
        .from(multiBuyDeals)
        .where(and(eq(multiBuyDeals.productId, input.productId), eq(multiBuyDeals.isActive, true)));

      // 9. Merge: template groups first, then custom groups
      const allGroups = [
        ...templateGroups.map((g) => ({
          source: g.source,
          id: g.templateId, // template ID for template-based groups
          name: g.name,
          type: g.type,
          required: g.required,
          minSelections: g.minSelections,
          maxSelections: g.maxSelections,
          modifiers: g.modifiers,
        })),
        ...customGroupsWithMods.map((g) => ({
          source: g.source,
          id: g.groupId, // group ID for custom groups
          name: g.name,
          type: g.type,
          required: g.required,
          minSelections: g.minSelections,
          maxSelections: g.maxSelections,
          modifiers: g.modifiers,
        })),
      ];

      return { groups: allGroups, deals };
    }),
});
