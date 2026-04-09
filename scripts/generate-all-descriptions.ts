import { getDb } from "../server/db";
import { products, productCategories } from "../drizzle/schema";
import { eq, isNull, or, sql } from "drizzle-orm";
import { invokeLLM } from "../server/_core/llm";

async function generateAllDescriptions() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let offset = 0;
  const batchSize = 20;
  let totalUpdated = 0;

  while (true) {
    // Get batch of missing products
    const query = await db.execute(sql`
      SELECT p.id, p.name, p.sku, p.price, pc.name as category_name
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      WHERE p.description IS NULL OR p.description = ''
      ORDER BY p.id
      LIMIT ${batchSize} OFFSET ${offset}
    `);

    const products_list = (query as any)[0] || [];
    if (!products_list || products_list.length === 0) {
      console.log(`\n✅ All done! Total updated: ${totalUpdated}`);
      break;
    }

    console.log(`Processing batch ${Math.floor(offset / batchSize) + 1}: ${products_list.length} products...`);

    // Build prompt
    const productList = products_list.map((p: any, i: number) => 
      `${i + 1}. "${p.name}" (Category: ${p.category_name || "General"}, Price: €${p.price || "N/A"})`
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
      console.error(`Failed to parse LLM response: ${content.substring(0, 200)}`);
      offset += batchSize;
      continue;
    }

    // Update products
    for (let i = 0; i < products_list.length; i++) {
      const key = String(i + 1);
      const desc = descriptions[key];
      if (desc && desc.trim()) {
        await db
          .update(products)
          .set({ description: desc.trim() })
          .where(eq(products.id, products_list[i].id));
        totalUpdated++;
      }
    }

    console.log(`  ✅ Updated ${totalUpdated} total so far`);
    offset += batchSize;
  }
}

generateAllDescriptions().catch(console.error);
