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

    // Get order 122
    const result = await db.execute(sql`
      SELECT id, order_number, receipt_data 
      FROM orders 
      WHERE order_number = 'WS4U/SPR/122'
    `);
    
    if (!result || result.length === 0) {
      console.log("Order 122 not found");
    } else {
      const order = result[0][0];
      console.log("\nOrder found!");
      console.log("ID:", order.id);
      console.log("Order number:", order.order_number);
      if (order.receipt_data) {
        const data = JSON.parse(order.receipt_data);
        console.log("hasWssItems:", data.hasWssItems);
        console.log("storeReceipt items:", data.storeReceipt.items.length);
        console.log("customerReceipt items:", data.customerReceipt.items.length);
      } else {
        console.log("receiptData: NULL");
      }
    }

    process.exit(0);
  } catch (error) {
    console.error("Failed:", error);
    process.exit(1);
  }
})();
