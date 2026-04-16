import { initializeDualDatabases } from "../server/db-dual-write";
import { getDb } from "../server/db";
import { products } from "../drizzle/schema";
import { eq, like, and } from "drizzle-orm";

(async () => {
  try {
    // Initialize database
    await initializeDualDatabases();
    const db = await getDb();
    if (!db) {
      console.error("Failed to get database connection");
      process.exit(1);
    }

    console.log("Updating products to mark as WSS...");

    // Mark Amoy Noodles as WSS
    const result2 = await db
      .update(products)
      .set({ isWss: true })
      .where(and(like(products.name, "%Amoy%"), eq(products.storeId, 1)));
    console.log("✓ Marked Amoy Noodles as WSS");

    // Verify the updates
    const result = await db
      .select()
      .from(products)
      .where(eq(products.storeId, 1));

    console.log("\nAll Spar Balbriggan products:");
    result.forEach((p) => {
      if (p.name.includes("10 ft") || p.name.includes("Amoy")) {
        console.log(`  ✓ ${p.name}: isWss=${p.isWss}`);
      } else {
        console.log(`    ${p.name}: isWss=${p.isWss}`);
      }
    });

    console.log("\nDone!");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
})();
