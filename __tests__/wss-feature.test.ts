import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { getDb } from "../server/db";
import { products, orders, orderItems, stores, users } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

describe("WSS (WeShop4U Stock) Feature", () => {
  let db: any;
  let testStoreId: number;
  let testProductIdWss: number;
  let testProductIdNormal: number;
  let testCustomerId: number;

  beforeAll(async () => {
    db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create test store
    const [storeResult] = await db.insert(stores).values({
      name: "Test Store WSS",
      slug: "test-store-wss",
      category: "convenience",
      address: "123 Test St",
      eircode: "D01",
      latitude: "53.3498",
      longitude: "-6.2603",
      shortCode: "TST",
    });
    testStoreId = Number(storeResult.insertId);

    // Create test customer
    const [userResult] = await db.insert(users).values({
      email: "wss-test@example.com",
      name: "WSS Test Customer",
      role: "customer",
    });
    testCustomerId = Number(userResult.insertId);

    // Create WSS product
    const [wssProductResult] = await db.insert(products).values({
      storeId: testStoreId,
      name: "20 JPS Blue (WSS)",
      price: "17.45",
      wss: true,
      isActive: true,
    });
    testProductIdWss = Number(wssProductResult.insertId);

    // Create normal product
    const [normalProductResult] = await db.insert(products).values({
      storeId: testStoreId,
      name: "Can of Coke",
      price: "2.50",
      wss: false,
      isActive: true,
    });
    testProductIdNormal = Number(normalProductResult.insertId);
  });

  afterAll(async () => {
    if (!db) return;
    // Cleanup
    await db.delete(orderItems).where(eq(orderItems.productId, testProductIdWss));
    await db.delete(orderItems).where(eq(orderItems.productId, testProductIdNormal));
    await db.delete(orders).where(eq(orders.storeId, testStoreId));
    await db.delete(products).where(eq(products.storeId, testStoreId));
    await db.delete(stores).where(eq(stores.id, testStoreId));
    await db.delete(users).where(eq(users.id, testCustomerId));
  });

  it("should mark product as WSS", async () => {
    const product = await db
      .select()
      .from(products)
      .where(eq(products.id, testProductIdWss))
      .limit(1);

    expect(product).toHaveLength(1);
    expect(product[0].wss).toBe(true);
    expect(product[0].name).toContain("WSS");
  });

  it("should have normal product not marked as WSS", async () => {
    const product = await db
      .select()
      .from(products)
      .where(eq(products.id, testProductIdNormal))
      .limit(1);

    expect(product).toHaveLength(1);
    expect(product[0].wss).toBe(false);
  });

  it("should toggle WSS flag on product", async () => {
    // Toggle to true (already true, so toggle to false)
    await db
      .update(products)
      .set({ wss: false })
      .where(eq(products.id, testProductIdWss));

    let product = await db
      .select()
      .from(products)
      .where(eq(products.id, testProductIdWss))
      .limit(1);
    expect(product[0].wss).toBe(false);

    // Toggle back to true
    await db
      .update(products)
      .set({ wss: true })
      .where(eq(products.id, testProductIdWss));

    product = await db
      .select()
      .from(products)
      .where(eq(products.id, testProductIdWss))
      .limit(1);
    expect(product[0].wss).toBe(true);
  });

  it("should track WSS items in order creation", async () => {
    // Create an order with both WSS and normal items
    const [orderResult] = await db.insert(orders).values({
      orderNumber: "WS4U/TST/001",
      customerId: testCustomerId,
      storeId: testStoreId,
      status: "pending",
      paymentMethod: "card",
      paymentStatus: "pending",
      subtotal: "19.95",
      serviceFee: "2.00",
      deliveryFee: "3.50",
      total: "25.45",
      deliveryAddress: "123 Test Address",
      deliveryLatitude: "53.3498",
      deliveryLongitude: "-6.2603",
    });
    const orderId = Number(orderResult.insertId);

    // Add WSS item
    const [wssItemResult] = await db.insert(orderItems).values({
      orderId,
      productId: testProductIdWss,
      productName: "20 JPS Blue (WSS)",
      productPrice: "17.45",
      quantity: 1,
      subtotal: "17.45",
    });

    // Add normal item
    const [normalItemResult] = await db.insert(orderItems).values({
      orderId,
      productId: testProductIdNormal,
      productName: "Can of Coke",
      productPrice: "2.50",
      quantity: 1,
      subtotal: "2.50",
    });

    // Verify order items
    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    expect(items).toHaveLength(2);

    // Verify WSS item
    const wssItem = items.find((i: any) => i.productId === testProductIdWss);
    expect(wssItem).toBeDefined();
    expect(wssItem.productName).toContain("WSS");

    // Verify normal item
    const normalItem = items.find((i: any) => i.productId === testProductIdNormal);
    expect(normalItem).toBeDefined();
    expect(normalItem.productName).toContain("Coke");

    // Cleanup
    await db.delete(orderItems).where(eq(orderItems.orderId, orderId));
    await db.delete(orders).where(eq(orders.id, orderId));
  });

  it("should calculate store receipt subtotal excluding WSS items", async () => {
    // Create an order with WSS and normal items
    const [orderResult] = await db.insert(orders).values({
      orderNumber: "WS4U/TST/002",
      customerId: testCustomerId,
      storeId: testStoreId,
      status: "pending",
      paymentMethod: "card",
      paymentStatus: "pending",
      subtotal: "19.95", // Total of both items
      serviceFee: "2.00",
      deliveryFee: "3.50",
      total: "25.45",
      deliveryAddress: "123 Test Address",
      deliveryLatitude: "53.3498",
      deliveryLongitude: "-6.2603",
    });
    const orderId = Number(orderResult.insertId);

    // Add items
    await db.insert(orderItems).values({
      orderId,
      productId: testProductIdWss,
      productName: "20 JPS Blue (WSS)",
      productPrice: "17.45",
      quantity: 1,
      subtotal: "17.45",
    });

    await db.insert(orderItems).values({
      orderId,
      productId: testProductIdNormal,
      productName: "Can of Coke",
      productPrice: "2.50",
      quantity: 1,
      subtotal: "2.50",
    });

    // Get items with product info
    const items = await db
      .select({
        id: orderItems.id,
        productId: orderItems.productId,
        subtotal: orderItems.subtotal,
        isWss: products.wss,
      })
      .from(orderItems)
      .leftJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.orderId, orderId));

    // Calculate store receipt subtotal (excluding WSS)
    const storeReceiptSubtotal = items
      .filter((item: any) => !item.isWss)
      .reduce((sum: number, item: any) => sum + parseFloat(item.subtotal), 0);

    // Store should only see the Coke (2.50), not the JPS Blue (17.45)
    expect(storeReceiptSubtotal).toBe(2.50);

    // Cleanup
    await db.delete(orderItems).where(eq(orderItems.orderId, orderId));
    await db.delete(orders).where(eq(orders.id, orderId));
  });

  it("should handle order with only WSS items", async () => {
    // Create an order with ONLY WSS items
    const [orderResult] = await db.insert(orders).values({
      orderNumber: "WS4U/TST/003",
      customerId: testCustomerId,
      storeId: testStoreId,
      status: "pending",
      paymentMethod: "card",
      paymentStatus: "pending",
      subtotal: "17.45",
      serviceFee: "1.75",
      deliveryFee: "3.50",
      total: "22.70",
      deliveryAddress: "123 Test Address",
      deliveryLatitude: "53.3498",
      deliveryLongitude: "-6.2603",
    });
    const orderId = Number(orderResult.insertId);

    // Add only WSS item
    await db.insert(orderItems).values({
      orderId,
      productId: testProductIdWss,
      productName: "20 JPS Blue (WSS)",
      productPrice: "17.45",
      quantity: 1,
      subtotal: "17.45",
    });

    // Get items with product info
    const items = await db
      .select({
        id: orderItems.id,
        productId: orderItems.productId,
        isWss: products.wss,
      })
      .from(orderItems)
      .leftJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.orderId, orderId));

    // All items are WSS
    const hasWssItems = items.some((item: any) => item.isWss);
    const storeItems = items.filter((item: any) => !item.isWss);

    expect(hasWssItems).toBe(true);
    expect(storeItems).toHaveLength(0); // Store sees no items

    // Cleanup
    await db.delete(orderItems).where(eq(orderItems.orderId, orderId));
    await db.delete(orders).where(eq(orders.id, orderId));
  });
});
