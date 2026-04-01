import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

async function check() {
  const db = await getDb();
  if (!db) { console.log("No DB connection"); process.exit(1); }

  const rows1 = await db.execute(sql`SELECT * FROM store_staff WHERE user_id = 210001`);
  console.log("store_staff for user 210001:", JSON.stringify(rows1[0]));
  
  const rows2 = await db.execute(sql`SELECT count(*) as cnt FROM products WHERE store_id = 6`);
  console.log("products for store 6:", JSON.stringify(rows2[0]));
  
  const rows3 = await db.execute(sql`SELECT count(*) as cnt FROM products WHERE store_id = 30001`);
  console.log("products for store 30001:", JSON.stringify(rows3[0]));
  
  const rows4 = await db.execute(sql`SELECT count(*) as cnt FROM product_categories WHERE store_id = 6`);
  console.log("categories for store 6:", JSON.stringify(rows4[0]));
  
  const rows5 = await db.execute(sql`SELECT count(*) as cnt FROM product_categories WHERE store_id = 30001`);
  console.log("categories for store 30001:", JSON.stringify(rows5[0]));

  const rows6 = await db.execute(sql`SELECT count(*) as cnt FROM modifier_templates WHERE store_id = 6`);
  console.log("modifier_templates for store 6:", JSON.stringify(rows6[0]));
  
  const rows7 = await db.execute(sql`SELECT count(*) as cnt FROM modifier_templates WHERE store_id = 30001`);
  console.log("modifier_templates for store 30001:", JSON.stringify(rows7[0]));

  const rows8 = await db.execute(sql`SELECT count(*) as cnt FROM category_modifier_templates WHERE store_id = 6`);
  console.log("category_modifier_templates for store 6:", JSON.stringify(rows8[0]));
  
  const rows9 = await db.execute(sql`SELECT count(*) as cnt FROM category_modifier_templates WHERE store_id = 30001`);
  console.log("category_modifier_templates for store 30001:", JSON.stringify(rows9[0]));

  const rows10 = await db.execute(sql`SELECT id, name, category FROM stores WHERE id IN (6, 30001)`);
  console.log("stores:", JSON.stringify(rows10[0]));
  
  process.exit(0);
}
check();
