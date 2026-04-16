import { initializeDualDatabases } from "../server/db-dual-write";
import { getDb } from "../server/db";
import { orders } from "../drizzle/schema";
import { eq } from "drizzle-orm";

(async () => {
  try {
    await initializeDualDatabases();
    const db = await getDb();
    if (!db) {
      console.error("Failed to get database connection");
      process.exit(1);
    }

    const result = await db
      .select()
      .from(orders)
      .where(eq(orders.orderNumber, "WS4U/SPR/127"));

    if (result.length > 0) {
      console.log("Found order ID:", result[0].id);
    } else {
      console.log("Order not found");
    }
    
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
})();
