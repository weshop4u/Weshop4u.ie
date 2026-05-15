import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

async function addIsWssColumn() {
  try {
    const db = await getDb();
    if (!db) {
      console.error("Database not available");
      process.exit(1);
    }

    console.log("Adding is_wss column to products table...");
    
    // Try to add the column - it might already exist
    try {
      await db.execute(sql`ALTER TABLE products ADD COLUMN is_wss BOOLEAN DEFAULT FALSE`);
      console.log("✓ Successfully added is_wss column");
    } catch (err: any) {
      if (err.message?.includes("Duplicate column")) {
        console.log("✓ Column already exists");
      } else {
        throw err;
      }
    }

    console.log("Migration complete!");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

addIsWssColumn();
