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

    // Get order 123
    const orderResult = await db.execute(sql`
      SELECT id FROM orders WHERE order_number = 'WS4U/SPR/123'
    `);
    
    if (!orderResult || orderResult.length === 0 || !orderResult[0][0]) {
      console.log("Order 123 not found");
      process.exit(0);
    }

    const orderId = orderResult[0][0].id;
    console.log("Order ID:", orderId);

    // Get print job for this order
    const printResult = await db.execute(sql`
      SELECT id, receipt_content FROM print_jobs WHERE order_id = ${orderId}
    `);
    
    if (!printResult || printResult.length === 0) {
      console.log("No print job found for order 123");
    } else {
      const printJob = printResult[0][0];
      console.log("\nPrint job found!");
      console.log("Receipt content (first 500 chars):");
      console.log(printJob.receipt_content.substring(0, 500));
      console.log("\n... checking for Amoy Noodles ...");
      if (printJob.receipt_content.includes("Amoy")) {
        console.log("❌ Amoy Noodles FOUND in receipt (should be hidden!)");
      } else {
        console.log("✅ Amoy Noodles NOT found in receipt (correct!)");
      }
    }

    process.exit(0);
  } catch (error) {
    console.error("Failed:", error);
    process.exit(1);
  }
})();
