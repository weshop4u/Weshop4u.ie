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

    // Get order 119
    const result = await db.execute(sql`
      SELECT id, order_number, receipt_data FROM orders WHERE order_number = 'WS4U/SPR/119'
    `);
    
    if (!result || result.length === 0) {
      console.log("Order 119 not found");
      process.exit(0);
    }

    const order = result[0];
    console.log("Order ID:", order.id);
    console.log("Order number:", order.order_number);
    console.log("receiptData is NULL:", order.receipt_data === null);
    console.log("receiptData length:", order.receipt_data ? order.receipt_data.length : 0);
    
    if (order.receipt_data) {
      try {
        const parsed = JSON.parse(order.receipt_data);
        console.log("\nParsed receiptData:");
        console.log("- hasWssItems:", parsed.hasWssItems);
        console.log("- storeReceipt items count:", parsed.storeReceipt?.items?.length);
        console.log("- customerReceipt items count:", parsed.customerReceipt?.items?.length);
        console.log("\nStore receipt items:");
        parsed.storeReceipt?.items?.forEach((item: any) => {
          console.log(`  - ${item.productName} (id: ${item.id}, isWss: ${item.isWss})`);
        });
      } catch (e) {
        console.log("Failed to parse receiptData:", e.message);
      }
    } else {
      console.log("\n⚠️  receiptData is NULL - not being saved!");
    }

    process.exit(0);
  } catch (error) {
    console.error("Failed:", error);
    process.exit(1);
  }
})();
