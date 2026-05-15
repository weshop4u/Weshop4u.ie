import { initializeDualDatabases, getDb } from "../server/db-dual-write";
import { sql } from "drizzle-orm";

async function addReceiptColumn() {
  try {
    await initializeDualDatabases();
    const db = await getDb();
    if (!db) {
      console.error("Database not available");
      process.exit(1);
    }

    // Add receipt_data column
    await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS receipt_data TEXT`);
    console.log("✓ Added receipt_data column to orders table");

    process.exit(0);
  } catch (error) {
    console.error("Failed to add column:", error);
    process.exit(1);
  }
}

addReceiptColumn();
