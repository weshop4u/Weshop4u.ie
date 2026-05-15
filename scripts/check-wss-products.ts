import { getDb } from "../server/_core/db";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("Database not available");
    process.exit(1);
  }

  // Get all products with their WSS flag
  const products = await db.query.products.findMany();
  
  console.log("Products with WSS flag:");
  for (const p of products) {
    console.log(`${p.id}: ${p.name} - WSS: ${p.isWss}`);
  }

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
