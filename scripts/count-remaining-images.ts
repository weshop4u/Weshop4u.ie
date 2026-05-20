import { getDb } from "../server/db";
import { initializeDualDatabases } from "../server/db-dual-write";
import { products } from "../server/db/schema";
import { like } from "drizzle-orm";

async function main() {
  try {
    await initializeDualDatabases();
    const db = await getDb();
    if (!db) throw new Error("Database connection failed");

    const result = await db
      .select()
      .from(products)
      .where(like(products.images, "%files.manuscdn.com%"))
      .execute();

    console.log(`Total products with Manus CDN images: ${result.length}`);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
