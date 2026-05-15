import { getDb } from "../server/_core/db";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("Database not available");
    process.exit(1);
  }

  // Get order 131 (assuming it's in the database)
  const orders = await db.query.orders.findMany({
    where: (orders, { like, eq }) => eq(orders.orderNumber, "WS4U/SPR/131"),
  });

  if (orders.length === 0) {
    console.log("Order not found");
    process.exit(0);
  }

  const order = orders[0];
  console.log("Order:", order.id, order.orderNumber);
  console.log("ReceiptData exists:", !!order.receiptData);
  
  if (order.receiptData) {
    try {
      const receiptData = JSON.parse(order.receiptData);
      console.log("Receipt data parsed successfully");
      console.log("hasWssItems:", receiptData.hasWssItems);
      console.log("Store receipt items:", receiptData.storeReceipt?.items?.length || 0);
      console.log("Store receipt items:", receiptData.storeReceipt?.items?.map((i: any) => i.productName));
    } catch (e) {
      console.error("Failed to parse receiptData:", e);
    }
  }

  process.exit(0);
}

main();
