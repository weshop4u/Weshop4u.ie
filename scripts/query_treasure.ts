import { getDb } from "../server/db";
import { stores, products, productCategories, modifierTemplates, categoryModifierTemplates } from "../drizzle/schema";
import { eq, like, inArray, sql } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) { console.log("No DB"); process.exit(1); }

  // Find Treasure Bowl store
  const storeRows = await db.select({ id: stores.id, name: stores.name }).from(stores).where(like(stores.name, '%Treasure%'));
  console.log("=== STORE ===");
  console.log(JSON.stringify(storeRows, null, 2));

  if (storeRows.length > 0) {
    const storeId = storeRows[0].id;

    // Get categories used by products in this store
    const catRows = await db
      .selectDistinct({ categoryId: products.categoryId })
      .from(products)
      .where(eq(products.storeId, storeId));

    const catIds = catRows.map(r => r.categoryId).filter((id): id is number => id !== null);

    if (catIds.length > 0) {
      const cats = await db
        .select({ id: productCategories.id, name: productCategories.name })
        .from(productCategories)
        .where(inArray(productCategories.id, catIds));
      console.log("\n=== CATEGORIES (used by Treasure Bowl products) ===");
      console.log(JSON.stringify(cats, null, 2));

      // Get existing category-template links
      const existingLinks = await db
        .select({
          id: categoryModifierTemplates.id,
          categoryId: categoryModifierTemplates.categoryId,
          templateId: categoryModifierTemplates.templateId,
        })
        .from(categoryModifierTemplates)
        .where(inArray(categoryModifierTemplates.categoryId, catIds));
      console.log("\n=== EXISTING CATEGORY-TEMPLATE LINKS ===");
      console.log(JSON.stringify(existingLinks, null, 2));

      // Count products per category
      for (const cat of cats) {
        const countResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(products)
          .where(eq(products.categoryId, cat.id));
        console.log(`  Category "${cat.name}" (id=${cat.id}): ${countResult[0]?.count ?? 0} products`);
      }
    }
  }

  // Get all modifier templates
  const templates = await db
    .select({ id: modifierTemplates.id, name: modifierTemplates.name, type: modifierTemplates.type, required: modifierTemplates.required })
    .from(modifierTemplates);
  console.log("\n=== ALL MODIFIER TEMPLATES ===");
  console.log(JSON.stringify(templates, null, 2));

  process.exit(0);
}
main();
