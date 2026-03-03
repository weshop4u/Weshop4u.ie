import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) { console.log("No DB"); process.exit(1); }

  // Get all Treasure Bowl categories (products with store_id = 6)
  const catResult = await db.execute(sql.raw(`
    SELECT DISTINCT pc.id, pc.name, pc.icon
    FROM product_categories pc
    JOIN products p ON p.category_id = pc.id
    WHERE p.store_id = 6
    ORDER BY pc.name
  `));
  
  const categories = (catResult as unknown as any[][])[0];
  console.log(`Found ${categories.length} categories for Treasure Bowl\n`);

  let updated = 0;
  let noImage = 0;

  for (const cat of categories) {
    // Get the first product in this category that has an image
    const prodResult = await db.execute(sql.raw(`
      SELECT p.id, p.name, p.images
      FROM products p
      WHERE p.store_id = 6 AND p.category_id = ${cat.id} AND p.images IS NOT NULL AND p.images != '' AND p.images != '[]'
      ORDER BY p.id ASC
      LIMIT 1
    `));

    const products = (prodResult as unknown as any[][])[0];

    if (products.length === 0) {
      console.log(`[NO IMAGE] ${cat.name} (id=${cat.id}) - no products with images`);
      noImage++;
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
      console.log(`[NO IMAGE] ${cat.name} (id=${cat.id}) - product ${product.name} has empty images`);
      noImage++;
      continue;
    }

    // Update the category icon with this image URL
    await db.execute(sql.raw(`
      UPDATE product_categories SET icon = '${imageUrl.replace(/'/g, "''")}' WHERE id = ${cat.id}
    `));
    
    console.log(`[UPDATED] ${cat.name} (id=${cat.id}) <- ${product.name}: ${imageUrl.substring(0, 80)}...`);
    updated++;
  }

  console.log(`\nDone! Updated: ${updated}, No image: ${noImage}`);
  process.exit(0);
}

main();
