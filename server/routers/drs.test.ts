import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "../db";
import { products, stores } from "../../drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";

describe("DRS (Deposit Return Scheme) System", () => {
  let db: Awaited<ReturnType<typeof getDb>>;
  let testStoreId: number;
  let testProductIds: number[] = [];

  beforeAll(async () => {
    db = await getDb();
    if (!db) throw new Error("Database not available");

    // Get first active store
    const [store] = await db.select().from(stores).where(eq(stores.isActive, true)).limit(1);
    testStoreId = store.id;
  });

  it("should have isDrs column in products table defaulting to false", async () => {
    const [inserted] = await db!.insert(products).values({
      storeId: testStoreId,
      name: "DRS Test Product Plain",
      price: "1.50",
    }).$returningId();
    testProductIds.push(inserted.id);

    const [product] = await db!.select({ isDrs: products.isDrs })
      .from(products)
      .where(eq(products.id, inserted.id));

    expect(product.isDrs).toBe(false);
  });

  it("should allow setting isDrs to true on a product", async () => {
    const [inserted] = await db!.insert(products).values({
      storeId: testStoreId,
      name: "Coca Cola 330ml Can",
      price: "1.80",
      isDrs: true,
    }).$returningId();
    testProductIds.push(inserted.id);

    const [product] = await db!.select({ isDrs: products.isDrs, name: products.name })
      .from(products)
      .where(eq(products.id, inserted.id));

    expect(product.isDrs).toBe(true);
    expect(product.name).toBe("Coca Cola 330ml Can");
  });

  it("should update isDrs flag on existing product", async () => {
    const productId = testProductIds[0];

    // Set to true
    await db!.update(products).set({ isDrs: true }).where(eq(products.id, productId));
    const [updated] = await db!.select({ isDrs: products.isDrs }).from(products).where(eq(products.id, productId));
    expect(updated.isDrs).toBe(true);

    // Set back to false
    await db!.update(products).set({ isDrs: false }).where(eq(products.id, productId));
    const [reverted] = await db!.select({ isDrs: products.isDrs }).from(products).where(eq(products.id, productId));
    expect(reverted.isDrs).toBe(false);
  });

  it("should bulk update isDrs for multiple products", async () => {
    const names = ["Pepsi 500ml Bottle", "Fanta 330ml Can", "Water 1.5L"];
    for (const name of names) {
      const [inserted] = await db!.insert(products).values({
        storeId: testStoreId,
        name,
        price: "2.00",
        isDrs: false,
      }).$returningId();
      testProductIds.push(inserted.id);
    }

    // Bulk set isDrs to true
    await db!.update(products)
      .set({ isDrs: true })
      .where(inArray(products.id, testProductIds));

    // Verify all are now true
    const updated = await db!.select({ id: products.id, isDrs: products.isDrs })
      .from(products)
      .where(inArray(products.id, testProductIds));

    for (const p of updated) {
      expect(p.isDrs).toBe(true);
    }
  });

  it("should return isDrs in product queries", async () => {
    const result = await db!.select({
      id: products.id,
      name: products.name,
      isDrs: products.isDrs,
    })
      .from(products)
      .where(eq(products.id, testProductIds[1]));

    expect(result.length).toBe(1);
    expect(result[0].isDrs).toBe(true);
    expect(result[0].name).toBe("Coca Cola 330ml Can");
  });

  it("should filter products by isDrs flag", async () => {
    // Reset one product to false for filtering test
    await db!.update(products).set({ isDrs: false }).where(eq(products.id, testProductIds[0]));

    const drsProducts = await db!.select({ id: products.id, isDrs: products.isDrs })
      .from(products)
      .where(and(
        eq(products.isDrs, true),
        inArray(products.id, testProductIds)
      ));

    // Should have all except the first one (which we set to false)
    expect(drsProducts.length).toBe(testProductIds.length - 1);
    for (const p of drsProducts) {
      expect(p.isDrs).toBe(true);
    }
  });

  afterAll(async () => {
    if (db && testProductIds.length > 0) {
      await db.delete(products).where(inArray(products.id, testProductIds));
    }
  });
});
