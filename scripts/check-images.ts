import mysql from "mysql2/promise";

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL || "");
  
  // Check how images are stored
  const [rows] = await conn.execute(
    "SELECT id, name, LEFT(images, 300) as img_preview FROM products WHERE images IS NOT NULL AND images != '[]' AND images != '' LIMIT 5"
  );
  console.log("=== Products with images ===");
  console.log(JSON.stringify(rows, null, 2));
  
  // Count products with/without images
  const [counts] = await conn.execute(
    "SELECT COUNT(*) as total, SUM(CASE WHEN images IS NOT NULL AND images != '[]' AND images != '' THEN 1 ELSE 0 END) as with_images FROM products"
  );
  console.log("\n=== Image counts ===");
  console.log(JSON.stringify(counts, null, 2));
  
  await conn.end();
}

main().catch(console.error);
