import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { orders, orderItems, stores, products, users } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { sendNewOrderNotification } from "../services/notifications";

// Helper function to calculate distance between two points (Haversine formula)
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance * 100) / 100; // Round to 2 decimal places
}

// Helper function to calculate delivery fee based on distance
function calculateDeliveryFee(distanceKm: number): number {
  const BASE_FEE = 3.50;
  const BASE_DISTANCE = 2.8;
  const COST_PER_KM = 1.00;

  if (distanceKm <= BASE_DISTANCE) {
    return BASE_FEE;
  }

  const additionalDistance = distanceKm - BASE_DISTANCE;
  const additionalCost = additionalDistance * COST_PER_KM;
  return Math.round((BASE_FEE + additionalCost) * 100) / 100; // Round to 2 decimal places
}

export const ordersRouter = router({
  // Calculate delivery fee
  calculateDeliveryFee: publicProcedure
    .input(
      z.object({
        storeId: z.number(),
        deliveryLatitude: z.number(),
        deliveryLongitude: z.number(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Get store location
      const store = await db
        .select()
        .from(stores)
        .where(eq(stores.id, input.storeId))
        .limit(1);

      if (store.length === 0) {
        throw new Error("Store not found");
      }

      const storeData = store[0];
      if (!storeData.latitude || !storeData.longitude) {
        throw new Error("Store location not available");
      }

      const distance = calculateDistance(
        parseFloat(storeData.latitude),
        parseFloat(storeData.longitude),
        input.deliveryLatitude,
        input.deliveryLongitude
      );

      const deliveryFee = calculateDeliveryFee(distance);

      return {
        distance,
        deliveryFee,
        storeName: storeData.name,
      };
    }),

  // Create new order
  create: publicProcedure
    .input(
      z.object({
        customerId: z.number(),
        storeId: z.number(),
        items: z.array(
          z.object({
            productId: z.number(),
            quantity: z.number(),
          })
        ),
        deliveryAddress: z.string(),
        deliveryLatitude: z.number(),
        deliveryLongitude: z.number(),
        paymentMethod: z.enum(["card", "cash_on_delivery"]),
        customerNotes: z.string().optional(),
        allowSubstitution: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Get store location for distance calculation
      const store = await db
        .select()
        .from(stores)
        .where(eq(stores.id, input.storeId))
        .limit(1);

      if (store.length === 0) {
        throw new Error("Store not found");
      }

      const storeData = store[0];
      if (!storeData.latitude || !storeData.longitude) {
        throw new Error("Store location not available");
      }

      // Calculate distance and delivery fee
      const distance = calculateDistance(
        parseFloat(storeData.latitude),
        parseFloat(storeData.longitude),
        input.deliveryLatitude,
        input.deliveryLongitude
      );
      const deliveryFee = calculateDeliveryFee(distance);

      // Get product details and calculate subtotal
      let subtotal = 0;
      const orderItemsData = [];

      for (const item of input.items) {
        const product = await db
          .select()
          .from(products)
          .where(eq(products.id, item.productId))
          .limit(1);

        if (product.length === 0) {
          throw new Error(`Product ${item.productId} not found`);
        }

        const productData = product[0];
        const price = parseFloat(productData.price);
        const itemSubtotal = price * item.quantity;
        subtotal += itemSubtotal;

        orderItemsData.push({
          productId: item.productId,
          productName: productData.name,
          productPrice: productData.price,
          quantity: item.quantity,
          subtotal: itemSubtotal.toFixed(2),
        });
      }

      // Calculate service fee (10% of subtotal)
      const serviceFee = Math.round(subtotal * 0.10 * 100) / 100;
      const total = Math.round((subtotal + serviceFee + deliveryFee) * 100) / 100;

      // Generate order number
      const orderNumber = `WS4U-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // Create order
      const [order] = await db.insert(orders).values({
        orderNumber,
        customerId: input.customerId,
        storeId: input.storeId,
        status: "pending",
        paymentMethod: input.paymentMethod,
        paymentStatus: input.paymentMethod === "card" ? "completed" : "pending",
        subtotal: subtotal.toFixed(2),
        serviceFee: serviceFee.toFixed(2),
        deliveryFee: deliveryFee.toFixed(2),
        total: total.toFixed(2),
        deliveryAddress: input.deliveryAddress,
        deliveryLatitude: input.deliveryLatitude.toString(),
        deliveryLongitude: input.deliveryLongitude.toString(),
        deliveryDistance: distance.toFixed(2),
        customerNotes: input.customerNotes || null,
        allowSubstitution: input.allowSubstitution || false,
      });

      const orderId = order.insertId;

      // Create order items
      for (const item of orderItemsData) {
        await db.insert(orderItems).values({
          orderId: Number(orderId),
          ...item,
        });
      }

      // Send notification to store staff
      // Get store staff for this store
      const storeStaff = await db
        .select()
        .from(users)
        .where(and(eq(users.role, "store_staff"), eq(users.id, storeData.id)))
        .limit(1);

      if (storeStaff.length > 0 && storeStaff[0].pushToken) {
        // Get customer name
        const customer = await db
          .select()
          .from(users)
          .where(eq(users.id, input.customerId))
          .limit(1);

        const customerName = customer.length > 0 ? customer[0].name : "Customer";

        await sendNewOrderNotification(
          storeStaff[0].pushToken,
          Number(orderId),
          customerName,
          input.items.length,
          total
        );
      }

      return {
        orderId,
        orderNumber,
        subtotal,
        serviceFee,
        deliveryFee,
        total,
        distance,
      };
    }),

  // Get order by ID
  getById: publicProcedure
    .input(z.object({ orderId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      const order = await db
        .select()
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1);

      if (order.length === 0) {
        throw new Error("Order not found");
      }

      const items = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, input.orderId));

      return {
        ...order[0],
        items,
      };
    }),

  // Get orders for a customer
  getByCustomer: publicProcedure
    .input(z.object({ customerId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      const customerOrders = await db
        .select()
        .from(orders)
        .where(eq(orders.customerId, input.customerId))
        .orderBy(desc(orders.createdAt));

      return customerOrders;
    }),
});
