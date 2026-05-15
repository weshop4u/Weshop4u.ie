import { getDb } from "../server/_core/db";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("Database not available");
    process.exit(1);
  }

  try {
    const products = await db.query.products.findMany({
      where: (products, { like }) => like(products.name, "%USB%"),
    });

    console.log("USB Products:");
    for (const p of products) {
      console.log(`  ${p.id}: ${p.name} - isWss: ${p.isWss}`);
    }

  } catch (e) {
    console.error("Error:", e);
  }

  process.exit(0);
}

main();
