import { getDb } from "../server/_core/db";
import { autoCreatePrintJob } from "../server/routers/print";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("Database not available");
    process.exit(1);
  }

  // Get order 132
  const orders = await db.query.orders.findMany({
    where: (orders, { eq }) => eq(orders.orderNumber, "WS4U/SPR/132"),
  });

  if (orders.length === 0) {
    console.log("Order not found");
    process.exit(0);
  }

  const order = orders[0];
  console.log("Order:", order.id, order.orderNumber);
  console.log("Calling createPrintJob manually...");
  
  // Call the createPrintJob endpoint logic directly
  const { createPrintJob } = await import("../server/routers/print");
  
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
