import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) { console.log("No DB"); process.exit(1); }

  // Get all stores
  const storeResult = await db.execute(sql.raw(`SELECT id, name FROM stores ORDER BY id`));
  const stores = (storeResult as unknown as any[][])[0];
  console.log(`Found ${stores.length} stores\n`);

  let totalUpdated = 0;
  let totalNoImage = 0;
  let totalAlreadySet = 0;

  for (const store of stores) {
    console.log(`\n=== ${store.name} (id=${store.id}) ===`);

    // Get all categories for this store (via products)
    const catResult = await db.execute(sql.raw(`
      SELECT DISTINCT pc.id, pc.name, pc.icon
      FROM product_categories pc
      JOIN products p ON p.category_id = pc.id
      WHERE p.store_id = ${store.id}
      ORDER BY pc.name
    `));
    const categories = (catResult as unknown as any[][])[0];

    if (categories.length === 0) {
      console.log(`  No categories found`);
      continue;
    }

    console.log(`  ${categories.length} categories`);

    for (const cat of categories) {
      // Skip if category already has an icon set
      if (cat.icon && cat.icon.length > 0) {
        totalAlreadySet++;
        continue;
      }

      // Get the first product with an image
      const prodResult = await db.execute(sql.raw(`
        SELECT p.id, p.name, p.images
        FROM products p
        WHERE p.store_id = ${store.id} AND p.category_id = ${cat.id} 
          AND p.images IS NOT NULL AND p.images != '' AND p.images != '[]'
        ORDER BY p.id ASC
        LIMIT 1
      `));
      const products = (prodResult as unknown as any[][])[0];

      if (products.length === 0) {
        console.log(`  [NO IMAGE] ${cat.name} (id=${cat.id})`);
        totalNoImage++;
        continue;
      }

      const product = products[0];
      let imageUrl = "";

      try {
        const images = JSON.parse(product.images);
        if (Array.isArray(images) && images.length > 0) {
          imageUrl = images[0];
        } else if (typeof images === "string") {
          imageUrl = images;
        }
      } catch {
        imageUrl = product.images;
      }

      if (!imageUrl) {
        console.log(`  [NO IMAGE] ${cat.name} (id=${cat.id}) - empty images field`);
        totalNoImage++;
        continue;
      }

      await db.execute(sql.raw(`
        UPDATE product_categories SET icon = '${imageUrl.replace(/'/g, "''")}' WHERE id = ${cat.id}
      `));

      console.log(`  [UPDATED] ${cat.name} <- ${product.name}`);
      totalUpdated++;
    }
  }

  console.log(`\n========== SUMMARY ==========`);
  console.log(`Updated: ${totalUpdated}`);
  console.log(`Already had image: ${totalAlreadySet}`);
  console.log(`No image available: ${totalNoImage}`);
  process.exit(0);
}

main();
