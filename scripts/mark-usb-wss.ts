import { getDb } from "../server/_core/db";
import { products } from "../server/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("Database not available");
    process.exit(1);
  }

  try {
    // Find USB Cable product
    const productList = await db
      .select()
      .from(products)
      .where(eq(products.name, "10 ft Micro USB Cable"))
      .limit(1);

    if (productList.length === 0) {
      console.log("USB Cable product not found");
      process.exit(0);
    }

    const product = productList[0];
    console.log("Found product:", product.id, product.name);
    console.log("Current isWss:", product.isWss);
    
    // Mark as WSS
    await db
      .update(products)
      .set({ isWss: true })
      .where(eq(products.id, product.id));
    
    console.log("Marked as WSS!");

  } catch (e) {
    console.error("Error:", e);
  }

  process.exit(0);
}

main();
