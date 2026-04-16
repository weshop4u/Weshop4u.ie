import { getDb } from "../server/db";
import { initializeDualDatabases } from "../server/db-dual-write";
import { orders, orderItems, products, stores, users, drivers, orderItemModifiers, storeStaff } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

async function testGetOrders() {
  await initializeDualDatabases();
  const db = await getDb();
  if (!db) {
    console.error("Database not available");
    process.exit(1);
  }

  const storeId = 1; // Spar store
  const status = "all";

  console.log(`\n[TEST] Fetching orders for store ${storeId}...`);

  let query = db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      customerId: orders.customerId,
      storeId: orders.storeId,
      status: orders.status,
      subtotal: orders.subtotal,
      serviceFee: orders.serviceFee,
      deliveryFee: orders.deliveryFee,
      total: orders.total,
      receiptData: orders.receiptData,
      createdAt: orders.createdAt,
      driverId: orders.driverId,
      paymentMethod: orders.paymentMethod,
      paymentStatus: orders.paymentStatus,
      deliveryAddress: orders.deliveryAddress,
      customerNotes: orders.customerNotes,
    })
    .from(orders)
    .where(eq(orders.storeId, storeId));

  if (status !== "all") {
    query = db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        customerId: orders.customerId,
        storeId: orders.storeId,
        status: orders.status,
        subtotal: orders.subtotal,
        serviceFee: orders.serviceFee,
        deliveryFee: orders.deliveryFee,
        total: orders.total,
        receiptData: orders.receiptData,
        createdAt: orders.createdAt,
        driverId: orders.driverId,
        paymentMethod: orders.paymentMethod,
        paymentStatus: orders.paymentStatus,
        deliveryAddress: orders.deliveryAddress,
        customerNotes: orders.customerNotes,
      })
      .from(orders)
      .where(
        and(
          eq(orders.storeId, storeId),
          eq(orders.status, status)
        )
      );
  }

  const storeOrders = await query;
  console.log(`[TEST] Found ${storeOrders.length} orders`);

  // Get order items for each order
  for (const order of storeOrders.slice(-3)) { // Last 3 orders
    console.log(`\n[TEST] Processing order ${order.orderNumber} (ID: ${order.id})`);
    
    let items = await db
      .select()
      .from(orderItems)
      .leftJoin(products, eq(orderItems.productId, products.id))
      .where(eq(orderItems.orderId, order.id));

    console.log(`[TEST] Initial items count: ${items.length}`);
    items.forEach(item => {
      console.log(`  - Product ID ${item.order_items.productId}: ${item.products?.name}`);
    });

    // If order has receiptData with WSS items, use store receipt items instead
    if (order.receiptData) {
      try {
        const receiptData = JSON.parse(order.receiptData);
        console.log(`[TEST] Order ${order.id} hasWssItems:`, receiptData.hasWssItems);
        if (receiptData.hasWssItems && receiptData.storeReceipt?.items) {
          // Map store receipt items back to the orderItems structure
          const storeItems = receiptData.storeReceipt.items;
          console.log(`[TEST] Filtering items. Before: ${items.length}, Store items: ${storeItems.length}`);
          console.log(`[TEST] Store item IDs:`, storeItems.map(si => ({ id: si.id, productId: si.productId })));
          console.log(`[TEST] Order item productIds:`, items.map(i => i.order_items.productId));
          items = items.filter(item => {
            const match = storeItems.some(si => si.id === item.order_items.productId);
            console.log(`[TEST] Checking productId ${item.order_items.productId}: ${match}`);
            return match;
          });
          console.log(`[TEST] After filtering: ${items.length}`);
        }
      } catch (e) {
        console.error(`Failed to parse receiptData for order ${order.id}:`, e);
      }
    }
  }
}

testGetOrders().catch(console.error);
