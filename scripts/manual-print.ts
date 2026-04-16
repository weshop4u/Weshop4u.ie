import { getDb } from "../server/_core/db";
import { printRouter } from "../server/routers/print";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("Database not available");
    process.exit(1);
  }

  // Get the latest order
  const orders = await db.query.orders.findMany({
    limit: 1,
    orderBy: (orders, { desc }) => [desc(orders.createdAt)],
  });

  if (orders.length === 0) {
    console.log("No orders found");
    process.exit(0);
  }

  const order = orders[0];
  console.log("Latest order:", order.id, order.orderNumber);
  
  // Manually call the createPrintJob logic
  const { createPrintJob } = await import("../server/routers/print");
  
  // Create a mock context
  const ctx = { user: null };
  
  try {
    // Call the mutation directly
    const caller = printRouter.createCaller(ctx);
    const result = await caller.createPrintJob({
      orderId: order.id,
      storeId: order.storeId
    });
    console.log("Print job created:", result);
  } catch (e) {
    console.error("Error creating print job:", e);
  }

  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
