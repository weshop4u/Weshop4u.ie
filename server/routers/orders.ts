import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { orders, orderItems, stores, products, users, driverQueue, drivers, jobReturns, driverRatings, storeStaff as storeStaffTable } from "../../drizzle/schema";
import { eq, and, desc, inArray, isNull, sql, asc, gte } from "drizzle-orm";
import { sendNewOrderNotification, sendOrderStatusNotification, sendPushNotification } from "../services/notifications";
import { sendOrderConfirmationSMS, sendOnTheWaySMS } from "../sms";
import { offerOrderToQueue } from "./drivers";
import { orderOffers } from "../../drizzle/schema";
// autoCreatePrintJob removed - printing is now manual only via Print Pick List button

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
        customerId: z.number().nullable(), // Null for guest orders
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
        tipAmount: z.number().optional(),
        allowSubstitution: z.boolean().optional(),
        // Guest order fields (required when customerId is null)
        guestName: z.string().optional(),
        guestPhone: z.string().optional(),
        guestEmail: z.string().optional(),
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
      const tipAmount = input.paymentMethod === "card" ? (input.tipAmount || 0) : 0;
      const total = Math.round((subtotal + serviceFee + deliveryFee + tipAmount) * 100) / 100;

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
        tipAmount: tipAmount.toFixed(2),
        total: total.toFixed(2),
        deliveryAddress: input.deliveryAddress,
        deliveryLatitude: input.deliveryLatitude.toString(),
        deliveryLongitude: input.deliveryLongitude.toString(),
        deliveryDistance: distance.toFixed(2),
        customerNotes: input.customerNotes || null,
        allowSubstitution: input.allowSubstitution || false,
        // Guest order fields
        guestName: input.guestName || null,
        guestPhone: input.guestPhone || null,
        guestEmail: input.guestEmail || null,
      });

      const orderId = order.insertId;

      // Create order items
      for (const item of orderItemsData) {
        await db.insert(orderItems).values({
          orderId: Number(orderId),
          ...item,
        });
      }

      // Send SMS confirmation to customer
      let customerPhone = input.guestPhone || null;
      
      // If logged-in user, get phone from user profile
      if (!customerPhone && input.customerId) {
        const customer = await db
          .select()
          .from(users)
          .where(eq(users.id, input.customerId))
          .limit(1);
        
        if (customer.length > 0 && customer[0].phone) {
          customerPhone = customer[0].phone;
        }
      }
      
      if (customerPhone) {
        try {
          await sendOrderConfirmationSMS(
            customerPhone,
            storeData.name,
            Number(orderId)
          );
          console.log(`[SMS] Order confirmation sent to ${customerPhone}`);
        } catch (error) {
          console.error(`[SMS] Failed to send order confirmation:`, error);
          // Don't fail the order if SMS fails
        }
      }

      // Send push notification to ALL store staff for this store
      try {
        const storeStaffMembers = await db
          .select({
            userId: storeStaffTable.userId,
            pushToken: users.pushToken,
          })
          .from(storeStaffTable)
          .innerJoin(users, eq(storeStaffTable.userId, users.id))
          .where(eq(storeStaffTable.storeId, storeData.id));

        // Get customer name
        let customerName = "Customer";
        if (input.customerId) {
          const customer = await db
            .select()
            .from(users)
            .where(eq(users.id, input.customerId))
            .limit(1);
          customerName = customer.length > 0 ? customer[0].name : "Customer";
        } else if (input.guestName) {
          customerName = input.guestName;
        }

        // Send to each staff member with a push token
        for (const staff of storeStaffMembers) {
          if (staff.pushToken) {
            await sendNewOrderNotification(
              staff.pushToken,
              Number(orderId),
              customerName,
              input.items.length,
              total
            );
            console.log(`[Push] Sent new order notification to store staff ${staff.userId} for order ${orderId}`);
          }
        }
      } catch (pushError) {
        console.error(`[Push] Failed to send store notifications for order ${orderId}:`, pushError);
      }

      // Trigger driver queue - offer to first available driver
      try {
        await offerOrderToQueue(Number(orderId));
        console.log(`[Queue] Order ${orderId} offered to driver queue`);
      } catch (error) {
        console.error(`[Queue] Failed to offer order to queue:`, error);
        // Don't fail the order if queue offering fails
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

      const orderResult = await db
        .select()
        .from(orders)
        .leftJoin(stores, eq(orders.storeId, stores.id))
        .where(eq(orders.id, input.orderId))
        .limit(1);

      if (orderResult.length === 0) {
        throw new Error("Order not found");
      }

      const items = await db
        .select({
          id: orderItems.id,
          orderId: orderItems.orderId,
          productId: orderItems.productId,
          quantity: orderItems.quantity,
          subtotal: orderItems.subtotal,
          notes: orderItems.notes,
          productName: products.name,
        })
        .from(orderItems)
        .leftJoin(products, eq(orderItems.productId, products.id))
        .where(eq(orderItems.orderId, input.orderId));

      return {
        ...orderResult[0].orders,
        store: orderResult[0].stores,
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

  // Get user's orders with full details (items, store, products)
  getUserOrders: publicProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // Get user info to determine role
    const userId = ctx.user?.id || 1;
    const userRole = ctx.user?.role || "customer";

    // If store staff, find their store and return store orders
    let whereCondition;
    if (userRole === "store_staff") {
      const staffLink = await db
        .select({ storeId: storeStaffTable.storeId })
        .from(storeStaffTable)
        .where(eq(storeStaffTable.userId, userId))
        .limit(1);

      if (staffLink.length > 0) {
        whereCondition = eq(orders.storeId, staffLink[0].storeId);
      } else {
        // No store linked, return empty
        return [];
      }
    } else {
      whereCondition = eq(orders.customerId, userId);
    }

    const userOrders = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        customerId: orders.customerId,
        storeId: orders.storeId,
        driverId: orders.driverId,
        status: orders.status,
        total: orders.total,
        deliveryFee: orders.deliveryFee,
        tipAmount: orders.tipAmount,
        subtotal: orders.subtotal,
        serviceFee: orders.serviceFee,
        deliveryAddress: orders.deliveryAddress,
        deliveryLatitude: orders.deliveryLatitude,
        deliveryLongitude: orders.deliveryLongitude,
        paymentMethod: orders.paymentMethod,
        customerNotes: orders.customerNotes,
        createdAt: orders.createdAt,
        acceptedAt: orders.acceptedAt,
        driverAssignedAt: orders.driverAssignedAt,
        pickedUpAt: orders.pickedUpAt,
        deliveredAt: orders.deliveredAt,
        storeName: stores.name,
        driverName: users.name,
        driverDisplayNumber: drivers.displayNumber,
      })
      .from(orders)
      .leftJoin(stores, eq(orders.storeId, stores.id))
      .leftJoin(drivers, eq(orders.driverId, drivers.userId))
      .leftJoin(users, eq(drivers.userId, users.id))
      .where(whereCondition)
      .orderBy(desc(orders.createdAt));

    // Get order items for each order
    const ordersWithItems = await Promise.all(
      userOrders.map(async (order) => {
        const items = await db
          .select({
            id: orderItems.id,
            orderId: orderItems.orderId,
            productId: orderItems.productId,
            quantity: orderItems.quantity,
            productPrice: orderItems.productPrice,
            productName: orderItems.productName,
          })
          .from(orderItems)
          .leftJoin(products, eq(orderItems.productId, products.id))
          .where(eq(orderItems.orderId, order.id));

        // Check if there's a rating for this order
        let orderRating = null;
        if (order.status === "delivered" && order.driverId) {
          const [existingRating] = await db
            .select({ id: driverRatings.id, rating: driverRatings.rating })
            .from(driverRatings)
            .where(eq(driverRatings.orderId, order.id))
            .limit(1);
          orderRating = existingRating || null;
        }

        return {
          ...order,
          store: { name: order.storeName },
          driver: order.driverDisplayNumber ? { name: `Driver ${order.driverDisplayNumber}` } : null,
          hasRating: !!orderRating,
          items: items.map((item) => ({
            id: item.id,
            orderId: item.orderId,
            productId: item.productId,
            quantity: item.quantity,
            productPrice: item.productPrice,
            product: { name: item.productName },
          })),
        };
      })
    );

    return ordersWithItems;
  }),

  // Get available jobs for drivers
  getAvailableJobs: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // Get orders that are available for drivers (pending, accepted, or ready for pickup)
    // Drivers see all orders so they can plan ahead while store is preparing
    const availableOrders = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        total: orders.total,
        deliveryFee: orders.deliveryFee,
        deliveryAddress: orders.deliveryAddress,
        deliveryLatitude: orders.deliveryLatitude,
        deliveryLongitude: orders.deliveryLongitude,
        status: orders.status,
        createdAt: orders.createdAt,
        driverId: orders.driverId,
        customerNotes: orders.customerNotes,
        store: {
          id: stores.id,
          name: stores.name,
          address: stores.address,
          latitude: stores.latitude,
          longitude: stores.longitude,
        },
      })
      .from(orders)
      .leftJoin(stores, eq(orders.storeId, stores.id))
      .where(
        and(
          inArray(orders.status, ["pending", "accepted", "ready_for_pickup"]),
          isNull(orders.driverId) // Only show orders without a driver assigned
        )
      )
      .orderBy(desc(orders.createdAt))
      .limit(20);

    return availableOrders;
  }),

  // Accept job as driver
  acceptJob: publicProcedure
    .input(
      z.object({
        orderId: z.number(),
        driverId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Update order with driver assignment and timestamp
      await db
        .update(orders)
        .set({
          driverId: input.driverId,
          driverAssignedAt: new Date(),
        })
        .where(eq(orders.id, input.orderId));

      return { success: true };
    }),

  // Return job - driver sends back an accepted job before pickup
  returnJob: publicProcedure
    .input(
      z.object({
        orderId: z.number(),
        driverId: z.number(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Check today's return count for this driver
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayReturns = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(jobReturns)
        .where(
          and(
            eq(jobReturns.driverId, input.driverId),
            gte(jobReturns.returnedAt, todayStart)
          )
        );
      const returnsToday = todayReturns[0]?.count || 0;

      // After 3+ returns today, reason is required
      if (returnsToday >= 3 && !input.reason) {
        throw new Error("REASON_REQUIRED: You have returned 3+ jobs today. A reason is required.");
      }

      // Verify the order belongs to this driver and hasn't been picked up yet
      const orderResult = await db
        .select({ status: orders.status, driverId: orders.driverId })
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1);

      if (orderResult.length === 0) {
        throw new Error("Order not found");
      }

      const order = orderResult[0];
      if (order.driverId !== input.driverId) {
        throw new Error("This order is not assigned to you");
      }

      if (order.status === "picked_up" || order.status === "on_the_way" || order.status === "delivered") {
        throw new Error("Cannot return a job after pickup");
      }

      // Log the return in job_returns table
      await db.insert(jobReturns).values({
        driverId: input.driverId,
        orderId: input.orderId,
        reason: input.reason || null,
      });

      // Increment total_returns on driver record
      await db
        .update(drivers)
        .set({ totalReturns: sql`${drivers.totalReturns} + 1` })
        .where(eq(drivers.userId, input.driverId));

      // Clear driver assignment and revert status to pending
      await db
        .update(orders)
        .set({
          driverId: null,
          driverAssignedAt: null,
          status: "pending",
        })
        .where(eq(orders.id, input.orderId));

      // Take driver offline - remove from queue and set isOnline=false
      await db
        .delete(driverQueue)
        .where(eq(driverQueue.driverId, input.driverId));

      await db
        .update(drivers)
        .set({ isOnline: false, isAvailable: false, updatedAt: new Date() })
        .where(eq(drivers.userId, input.driverId));

      console.log(`[Queue] Driver ${input.driverId} returned order ${input.orderId}${input.reason ? ` (reason: ${input.reason})` : ""}. Returns today: ${returnsToday + 1}. Driver taken offline.`);

      // Re-offer the order to the next driver in queue
      await offerOrderToQueue(input.orderId);

      return { success: true, returnsToday: returnsToday + 1 };
    }),

  // Update order status
  updateStatus: publicProcedure
    .input(
      z.object({
        orderId: z.number(),
        status: z.enum(["pending", "accepted", "preparing", "ready_for_pickup", "picked_up", "on_the_way", "delivered", "cancelled"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Build update fields with appropriate timestamps
      const updateFields: Record<string, any> = { status: input.status };
      const now = new Date();

      if (input.status === "accepted") {
        updateFields.acceptedAt = now;
      } else if (input.status === "picked_up" || input.status === "on_the_way") {
        updateFields.pickedUpAt = now;
      } else if (input.status === "delivered") {
        updateFields.deliveredAt = now;
      } else if (input.status === "cancelled") {
        updateFields.cancelledAt = now;
      }

      // Update order status with timestamps
      await db.update(orders).set(updateFields).where(eq(orders.id, input.orderId));

      // Get order details for notification
      const order = await db
        .select()
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1);

      if (order.length === 0) {
        throw new Error("Order not found");
      }

      // Send SMS when order is on the way
      const orderData = order[0];
      if (input.status === "on_the_way") {
        const customerPhone = orderData.guestPhone || null;
        if (customerPhone) {
          // Get store name
          const storeResult = await db
            .select()
            .from(stores)
            .where(eq(stores.id, orderData.storeId))
            .limit(1);
          
          if (storeResult.length > 0) {
            const storeName = storeResult[0].name;
            const trackingUrl = `https://weshop4u.app/order-tracking/${input.orderId}`;
            await sendOnTheWaySMS(
              customerPhone,
              storeName,
              orderData.orderNumber,
              trackingUrl
            );
          }
        }
      }

      // Print job is now manual only - staff presses "Print Pick List" button

      // Send push notification to customer
      let pushToken: string | null = null;

      if (orderData.customerId) {
        // Registered customer
        const customer = await db
          .select()
          .from(users)
          .where(eq(users.id, orderData.customerId))
          .limit(1);

        if (customer.length > 0 && customer[0].pushToken) {
          pushToken = customer[0].pushToken;
        }
      }

      // Send notification if we have a push token
      if (pushToken) {
        const notificationMessages: Record<string, { title: string; body: string }> = {
          accepted: {
            title: "Order Confirmed! 🎉",
            body: `Order #${orderData.orderNumber} has been confirmed and is being prepared.`,
          },
          preparing: {
            title: "Preparing Your Order 👨‍🍳",
            body: `Order #${orderData.orderNumber} is being prepared.`,
          },
          ready_for_pickup: {
            title: "Order Ready for Pickup 📦",
            body: `Order #${orderData.orderNumber} is ready! A driver will pick it up soon.`,
          },
          picked_up: {
            title: "Driver Picked Up Order 📦",
            body: `Order #${orderData.orderNumber} has been picked up by the driver.`,
          },
          on_the_way: {
            title: "Driver on the Way 🚗",
            body: `Order #${orderData.orderNumber} is on its way to you!`,
          },
          delivered: {
            title: "Order Delivered! ✅",
            body: `Order #${orderData.orderNumber} has been delivered. Enjoy!`,
          },
          cancelled: {
            title: "Order Cancelled ❌",
            body: `Order #${orderData.orderNumber} has been cancelled.`,
          },
        };

        const notification = notificationMessages[input.status];
        if (notification) {
          await sendPushNotification(pushToken, {
            title: notification.title,
            body: notification.body,
            data: {
              type: "order_update",
              orderId: input.orderId,
              status: input.status,
            },
            channelId: "orders",
          });
          console.log(`[Push] Sent status update notification to customer for order ${input.orderId}: ${input.status}`);
        }
      }

      return { success: true };
    }),

  // Rate a driver after delivery
  rateDriver: publicProcedure
    .input(
      z.object({
        orderId: z.number(),
        rating: z.number().min(1).max(5),
        comment: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      const userId = ctx.user?.id || 1;

      // Get the order to find the driver
      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1);

      if (!order) throw new Error("Order not found");
      if (order.status !== "delivered") throw new Error("Order not yet delivered");
      if (!order.driverId) throw new Error("No driver assigned to this order");

      // Check if already rated
      const [existing] = await db
        .select()
        .from(driverRatings)
        .where(eq(driverRatings.orderId, input.orderId))
        .limit(1);

      if (existing) throw new Error("Already rated this delivery");

      // Insert the rating
      await db.insert(driverRatings).values({
        orderId: input.orderId,
        driverId: order.driverId,
        customerId: userId,
        rating: input.rating,
        comment: input.comment || null,
      });

      // Recalculate the driver's average rating
      const allRatings = await db
        .select({ rating: driverRatings.rating })
        .from(driverRatings)
        .where(eq(driverRatings.driverId, order.driverId));

      const avgRating = allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length;

      // Update driver's rating
      await db
        .update(drivers)
        .set({ rating: avgRating.toFixed(2) })
        .where(eq(drivers.userId, order.driverId));

      console.log(`[Rating] Driver ${order.driverId} rated ${input.rating}/5 for order ${input.orderId}. New avg: ${avgRating.toFixed(2)}`);

      return { success: true, averageRating: parseFloat(avgRating.toFixed(2)) };
    }),

  // Cancel order (customer can only cancel if status is pending)
  cancelOrder: publicProcedure
    .input(
      z.object({
        orderId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Get the order
      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1);

      if (!order) {
        throw new Error("Order not found");
      }

      // Only allow cancellation if order is still pending
      if (order.status !== "pending") {
        throw new Error(
          order.status === "cancelled"
            ? "This order has already been cancelled."
            : "This order has already been accepted and cannot be cancelled. Please contact the store directly."
        );
      }

      // Update order status to cancelled
      const now = new Date();
      await db
        .update(orders)
        .set({ status: "cancelled", cancelledAt: now })
        .where(eq(orders.id, input.orderId));

      // Expire any pending order offers for this order
      await db
        .update(orderOffers)
        .set({ status: "expired" })
        .where(
          and(
            eq(orderOffers.orderId, input.orderId),
            eq(orderOffers.status, "pending")
          )
        );

      // Send push notification to store staff
      const storeStaffMembers = await db
        .select({ userId: storeStaffTable.userId })
        .from(storeStaffTable)
        .where(eq(storeStaffTable.storeId, order.storeId));

      for (const staff of storeStaffMembers) {
        const [staffUser] = await db
          .select({ pushToken: users.pushToken })
          .from(users)
          .where(eq(users.id, staff.userId))
          .limit(1);

        if (staffUser?.pushToken) {
          await sendPushNotification(staffUser.pushToken, {
            title: "Order Cancelled ❌",
            body: `Order #${order.orderNumber} has been cancelled by the customer.`,
            data: {
              type: "order_cancelled",
              orderId: input.orderId,
            },
            channelId: "orders",
          });
        }
      }

      console.log(`[Order] Order ${input.orderId} (#${order.orderNumber}) cancelled by customer`);

      return { success: true };
    }),
});
