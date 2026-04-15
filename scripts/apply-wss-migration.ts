import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

async function applyMigration() {
  const db = await getDb();
  if (!db) {
    console.error("Database not available");
    process.exit(1);
  }

  try {
    // Add has_wss_items column
    await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS has_wss_items BOOLEAN DEFAULT FALSE`);
    console.log("✓ Added has_wss_items column");

    // Add store receipt fields
    await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_receipt_subtotal DECIMAL(10, 2)`);
    console.log("✓ Added store_receipt_subtotal column");

    await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_receipt_service_fee DECIMAL(10, 2)`);
    console.log("✓ Added store_receipt_service_fee column");

    await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_receipt_delivery_fee DECIMAL(10, 2)`);
    console.log("✓ Added store_receipt_delivery_fee column");

    await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS store_receipt_total DECIMAL(10, 2)`);
    console.log("✓ Added store_receipt_total column");

    console.log("\n✓ Migration applied successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

applyMigration();
