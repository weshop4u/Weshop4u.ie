import { getDb } from "../server/_core/db";
import { printJobs, orders } from "../server/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("Database not available");
    process.exit(1);
  }

  try {
    // Get all print jobs
    const jobs = await db
      .select({
        id: printJobs.id,
        orderId: printJobs.orderId,
        status: printJobs.status,
        createdAt: printJobs.createdAt,
      })
      .from(printJobs)
      .orderBy((pj) => pj.createdAt);

    console.log("Print jobs:");
    for (const job of jobs) {
      // Get order number
      const order = await db
        .select({ orderNumber: orders.orderNumber })
        .from(orders)
        .where(eq(orders.id, job.orderId))
        .limit(1);
      
      const orderNumber = order.length > 0 ? order[0].orderNumber : "Unknown";
      console.log(`  ${job.id}: ${orderNumber} (${job.status}) - ${job.createdAt}`);
    }

  } catch (e) {
    console.error("Error:", e);
  }

  process.exit(0);
}

main();
