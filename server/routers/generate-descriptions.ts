import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import { products, productCategories } from "../../drizzle/schema";
import { eq, isNull, or, sql } from "drizzle-orm";

export const generateDescriptionsRouter = router({
  // Get count of products missing descriptions
  getMissingCount: publicProcedure
    .input(z.object({ storeId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const conditions = [
        or(isNull(products.description), eq(products.description, "")),
      ];

      if (input?.storeId) {
        const [rows] = await db.execute(sql`
          SELECT COUNT(*) as cnt FROM products 
          WHERE (description IS NULL OR description = '') 
          AND store_id = ${input.storeId}
        `);
        return { count: (rows as any)[0]?.cnt || 0 };
      }

      const [rows] = await db.execute(sql`
        SELECT COUNT(*) as cnt FROM products 
        WHERE description IS NULL OR description = ''
      `);
      return { count: (rows as any)[0]?.cnt || 0 };
    }),

  // Get a batch of products missing descriptions
  getMissingBatch: publicProcedure
    .input(z.object({
      storeId: z.number().optional(),
      limit: z.number().default(20),
      offset: z.number().default(0),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      let query;
      if (input?.storeId) {
        query = await db.execute(sql`
          SELECT p.id, p.name, p.sku, p.price, pc.name as category_name
          FROM products p
          LEFT JOIN product_categories pc ON p.category_id = pc.id
          WHERE (p.description IS NULL OR p.description = '')
          AND p.store_id = ${input.storeId}
          ORDER BY p.id
          LIMIT ${input?.limit ?? 20} OFFSET ${input?.offset ?? 0}
        `);
      } else {
        query = await db.execute(sql`
          SELECT p.id, p.name, p.sku, p.price, pc.name as category_name
          FROM products p
          LEFT JOIN product_categories pc ON p.category_id = pc.id
          WHERE p.description IS NULL OR p.description = ''
          ORDER BY p.id
          LIMIT ${input?.limit ?? 20} OFFSET ${input?.offset ?? 0}
        `);
      }

      return { products: (query as any)[0] || [] };
    }),

  // Generate descriptions for a batch of products using LLM
  generateBatch: publicProcedure
    .input(z.object({
      products: z.array(z.object({
        id: z.number(),
        name: z.string(),
        category: z.string().optional(),
        price: z.string().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Build a prompt with all products in the batch
      const productList = input.products.map((p, i) => 
        `${i + 1}. "${p.name}" (Category: ${p.category || "General"}, Price: €${p.price || "N/A"})`
      ).join("\n");

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a product description writer for a convenience store delivery app in Ireland. 
Write short, helpful descriptions for grocery/convenience store products.

Rules:
- Each description should be 1-2 sentences, max 150 characters
- Focus on what the product IS (not marketing fluff)
- Include key details: size/weight if in the name, flavour, type
- Use simple, clear language
- Do NOT include the price
- Do NOT repeat the product name
- For food items, mention key ingredients or flavour
- For drinks, mention the type and size
- For household items, mention the use case
- Return ONLY a valid JSON object with product IDs as keys and descriptions as values
- Example: {"1": "Creamy vanilla protein drink with 27g protein per serving. 500ml carton.", "2": "Fresh whole milk from Irish farms. 2 litre bottle."}`,
          },
          {
            role: "user",
            content: `Generate short product descriptions for these items:\n\n${productList}\n\nReturn JSON with the list number (1, 2, 3...) as keys and descriptions as values.`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (!content || typeof content !== "string") {
        throw new Error("No response from LLM");
      }

      let descriptions: Record<string, string>;
      try {
        descriptions = JSON.parse(content);
      } catch (e) {
        throw new Error(`Failed to parse LLM response: ${content.substring(0, 200)}`);
      }

      // Update products in the database
      let updatedCount = 0;
      for (let i = 0; i < input.products.length; i++) {
        const key = String(i + 1);
        const desc = descriptions[key];
        if (desc && desc.trim()) {
          await db
            .update(products)
            .set({ description: desc.trim() })
            .where(eq(products.id, input.products[i].id));
          updatedCount++;
        }
      }

      return {
        success: true,
        updated: updatedCount,
        total: input.products.length,
      };
    }),
});
