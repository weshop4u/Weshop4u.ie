import { getDb } from "../server/_core/db";
import { orders, printJobs } from "../server/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("Database not available");
    process.exit(1);
  }

  try {
    // Find order by number
    const orderList = await db
      .select()
      .from(orders)
      .where(eq(orders.orderNumber, "WS4U/SPR/132"))
      .limit(1);

    if (orderList.length === 0) {
      console.log("Order WS4U/SPR/132 not found");
      process.exit(0);
    }

    const order = orderList[0];
    console.log("Found order:", order.id, order.orderNumber);
    console.log("ReceiptData exists:", !!order.receiptData);
    
    if (order.receiptData) {
      const receiptData = JSON.parse(order.receiptData);
      console.log("hasWssItems:", receiptData.hasWssItems);
      console.log("Store items count:", receiptData.storeReceipt?.items?.length);
      console.log("Store items:", receiptData.storeReceipt?.items?.map((i: any) => i.productName));
    }

  } catch (e) {
    console.error("Error:", e);
  }

  process.exit(0);
}

main();
