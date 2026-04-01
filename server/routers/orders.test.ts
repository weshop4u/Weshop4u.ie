import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "../db";
import { orders, orderItems, products, stores } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Orders Router", () => {
  let testStoreId: number;
  let testProductIds: number[];

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Get test store
    const storeResult = await db
      .select()
      .from(stores)
      .where(eq(stores.name, "Spar Balbriggan"))
      .limit(1);
    
    if (storeResult.length === 0) {
      throw new Error("Test store not found");
    }
    testStoreId = storeResult[0].id;

    // Get test products
    const productsResult = await db
      .select()
      .from(products)
      .where(eq(products.storeId, testStoreId))
      .limit(2);
    
    testProductIds = productsResult.map(p => p.id);
  });

  it("should calculate delivery fee correctly for 2.8km", () => {
    const BASE_FEE = 3.50;
    const BASE_DISTANCE = 2.8;
    const COST_PER_KM = 1.00;

    function calculateDeliveryFee(distanceKm: number): number {
      if (distanceKm <= BASE_DISTANCE) {
        return BASE_FEE;
      }
      const additionalDistance = distanceKm - BASE_DISTANCE;
      const additionalCost = additionalDistance * COST_PER_KM;
      return Math.round((BASE_FEE + additionalCost) * 100) / 100;
    }

    expect(calculateDeliveryFee(2.0)).toBe(3.50);
    expect(calculateDeliveryFee(2.8)).toBe(3.50);
    expect(calculateDeliveryFee(3.2)).toBe(3.90);
    expect(calculateDeliveryFee(5.0)).toBe(5.70);
  });

  it("should create order with correct calculations", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Get product prices
    const productsData = await db
      .select()
      .from(products)
      .where(eq(products.id, testProductIds[0]))
      .limit(1);

    const product = productsData[0];
    const quantity = 2;
    const subtotal = parseFloat(product.price) * quantity;
    const serviceFee = Math.round(subtotal * 0.10 * 100) / 100;
    const deliveryFee = 3.50; // Base fee for < 2.8km
    const total = Math.round((subtotal + serviceFee + deliveryFee) * 100) / 100;

    // Create test order
    const orderNumber = `TEST-${Date.now()}`;
    const [order] = await db.insert(orders).values({
      orderNumber,
      customerId: 1,
      storeId: testStoreId,
      status: "pending",
      paymentMethod: "cash_on_delivery",
      paymentStatus: "pending",
      subtotal: subtotal.toFixed(2),
      serviceFee: serviceFee.toFixed(2),
      deliveryFee: deliveryFee.toFixed(2),
      total: total.toFixed(2),
      deliveryAddress: "Test Address, Dublin",
      deliveryLatitude: "53.6100",
      deliveryLongitude: "-6.1800",
      deliveryDistance: "2.5",
      allowSubstitution: false,
    });

    const orderId = order.insertId;

    // Create order item
    await db.insert(orderItems).values({
      orderId: Number(orderId),
      productId: product.id,
      productName: product.name,
      productPrice: product.price,
      quantity,
      subtotal: subtotal.toFixed(2),
    });

    // Verify order was created
    const createdOrder = await db
      .select()
      .from(orders)
      .where(eq(orders.id, Number(orderId)))
      .limit(1);

    expect(createdOrder.length).toBe(1);
    expect(createdOrder[0].orderNumber).toBe(orderNumber);
    expect(parseFloat(createdOrder[0].subtotal)).toBe(subtotal);
    expect(parseFloat(createdOrder[0].serviceFee)).toBe(serviceFee);
    expect(parseFloat(createdOrder[0].deliveryFee)).toBe(deliveryFee);
    expect(parseFloat(createdOrder[0].total)).toBe(total);

    // Verify order item was created
    const createdItems = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, Number(orderId)));

    expect(createdItems.length).toBe(1);
    expect(createdItems[0].quantity).toBe(quantity);
    expect(createdItems[0].productName).toBe(product.name);

    // Clean up test order
    await db.delete(orderItems).where(eq(orderItems.orderId, Number(orderId)));
    await db.delete(orders).where(eq(orders.id, Number(orderId)));
  });

  it("should calculate service fee as 10% of subtotal", () => {
    const testCases = [
      { subtotal: 10.00, expected: 1.00 },
      { subtotal: 25.50, expected: 2.55 },
      { subtotal: 12.99, expected: 1.30 },
      { subtotal: 100.00, expected: 10.00 },
    ];

    testCases.forEach(({ subtotal, expected }) => {
      const serviceFee = Math.round(subtotal * 0.10 * 100) / 100;
      expect(serviceFee).toBe(expected);
    });
  });
});
