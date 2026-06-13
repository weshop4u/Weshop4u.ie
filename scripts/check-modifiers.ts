import "./load-env.js";
import mysql from "mysql2/promise";

async function main() {
  const pool = await mysql.createPool(process.env.DATABASE_URL!);

  // Step 1: Find the product
  console.log("=== STEP 1: Find product ===");
  const [products] = await pool.query(
    "SELECT id, name, store_id, category_id FROM products WHERE name LIKE '%Chicken Fillet Roll%' LIMIT 10"
  );
  console.log(JSON.stringify(products, null, 2));

  const productRows = products as any[];
  if (productRows.length === 0) {
    console.log("No product found!");
    await pool.end();
    return;
  }

  // Use the first match (or the one with "Create Your Own")
  const target = productRows.find((p: any) => p.name.includes("Create Your Own")) || productRows[0];
  console.log(`\nTarget product: id=${target.id}, name="${target.name}", store_id=${target.store_id}, category_id=${target.category_id}`);

  // Step 2: Check modifier_groups table (source 1)
  console.log("\n=== STEP 2: modifier_groups entries for this product ===");
  const [modGroups] = await pool.query(
    "SELECT * FROM modifier_groups WHERE product_id = ?",
    [target.id]
  );
  console.log(JSON.stringify(modGroups, null, 2));

  // Step 3: Check product_modifier_templates (source 2)
  console.log("\n=== STEP 3: product_modifier_templates for this product ===");
  const [prodTemplates] = await pool.query(
    "SELECT * FROM product_modifier_templates WHERE product_id = ?",
    [target.id]
  );
  console.log(JSON.stringify(prodTemplates, null, 2));

  // Step 4: Check category_modifier_templates (source 3)
  console.log("\n=== STEP 4: category_modifier_templates for this product's category ===");
  if (target.category_id) {
    const [catTemplates] = await pool.query(
      "SELECT * FROM category_modifier_templates WHERE category_id = ?",
      [target.category_id]
    );
    console.log(JSON.stringify(catTemplates, null, 2));
  } else {
    console.log("Product has no category_id");
  }

  await pool.end();
}
main().catch(console.error);
