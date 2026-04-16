import { getDb } from "../server/_core/db";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("Database not available");
    process.exit(1);
  }

  try {
    const orders = await db.query.orders.findMany({
      where: (orders, { eq }) => eq(orders.orderNumber, "WS4U/SPR/133"),
    });

    if (orders.length === 0) {
      console.log("Order not found");
      process.exit(0);
    }

    const order = orders[0];
    console.log("Order:", order.id, order.orderNumber);
    console.log("ReceiptData exists:", !!order.receiptData);
    
    if (order.receiptData) {
      const receiptData = JSON.parse(order.receiptData);
      console.log("\nReceipt Data:");
      console.log("hasWssItems:", receiptData.hasWssItems);
      console.log("\nStore Receipt Items:");
      receiptData.storeReceipt?.items?.forEach((item: any, idx: number) => {
        console.log(`  ${idx + 1}. ${item.productName} (isWss: ${item.isWss})`);
      });
      console.log("\nCustomer Receipt Items:");
      receiptData.customerReceipt?.items?.forEach((item: any, idx: number) => {
        console.log(`  ${idx + 1}. ${item.productName} (isWss: ${item.isWss})`);
      });
    }

  } catch (e) {
    console.error("Error:", e);
  }

  process.exit(0);
}

main();
