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

    // Get order 121
    const result = await db.execute(sql`
      SELECT id, order_number, receipt_data 
      FROM orders 
      WHERE order_number = 'WS4U/SPR/121'
    `);
    
    console.log("Query result:", result);
    
    if (!result || result.length === 0) {
      console.log("Order 121 not found");
    } else {
      const order = result[0];
      console.log("\nOrder found!");
      console.log("ID:", order.id);
      console.log("Order number:", order.order_number);
      console.log("receiptData:", order.receipt_data ? order.receipt_data.substring(0, 100) : "NULL");
    }

    process.exit(0);
  } catch (error) {
    console.error("Failed:", error);
    process.exit(1);
  }
})();
