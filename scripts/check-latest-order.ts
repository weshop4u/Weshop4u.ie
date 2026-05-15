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

    // Get the latest order
    const result = await db.execute(sql`
      SELECT id, order_number, subtotal, service_fee, total, receipt_data 
      FROM orders 
      ORDER BY id DESC 
      LIMIT 1
    `);
    
    if (!result || result.length === 0) {
      console.log("No orders found");
      process.exit(0);
    }

    const order = result[0];
    console.log("\n=== Latest Order ===");
    console.log("Order ID:", order.id);
    console.log("Order number:", order.order_number);
    console.log("Subtotal:", order.subtotal);
    console.log("Service fee:", order.service_fee);
    console.log("Total:", order.total);
    console.log("receiptData exists:", !!order.receipt_data);
    console.log("receiptData length:", order.receipt_data ? order.receipt_data.length : 0);
    
    if (order.receipt_data) {
      try {
        const parsed = JSON.parse(order.receipt_data);
        console.log("\n=== Parsed receiptData ===");
        console.log("hasWssItems:", parsed.hasWssItems);
        console.log("storeReceipt.subtotal:", parsed.storeReceipt?.subtotal);
        console.log("storeReceipt.total:", parsed.storeReceipt?.total);
        console.log("storeReceipt items count:", parsed.storeReceipt?.items?.length);
        console.log("customerReceipt items count:", parsed.customerReceipt?.items?.length);
      } catch (e) {
        console.log("Failed to parse receiptData:", e.message);
      }
    } else {
      console.log("\n⚠️  receiptData is NULL!");
    }

    process.exit(0);
  } catch (error) {
    console.error("Failed:", error);
    process.exit(1);
  }
})();
