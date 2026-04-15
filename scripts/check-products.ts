import { initializeDualDatabases, getDb } from "../server/db-dual-write";
import { sql } from "drizzle-orm";

(async () => {
  try {
    await initializeDualDatabases();
    const db = await getDb();
    if (!db) {
      console.error("Database not available");
      process.exit(1);
    }

    // Check products marked as WSS
    const result = await db.execute(sql`
      SELECT id, name, is_wss FROM products WHERE name LIKE '%Amoy%' OR name LIKE '%Noodles%' OR name LIKE '%Cable%' OR name LIKE '%Oreo%'
    `);
    
    console.log("Products check:");
    if (result && result.length > 0) {
      result.forEach((p: any) => {
        console.log(`- ${p.name}: is_wss=${p.is_wss}`);
      });
    } else {
      console.log("No products found");
    }

    process.exit(0);
  } catch (error) {
    console.error("Failed:", error);
    process.exit(1);
  }
})();
