import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { drivers, orders, orderItems, products, stores, users, driverQueue, orderOffers, jobReturns, orderTracking } from "../../drizzle/schema";
import { eq, and, or, isNull, asc, desc, gte, lte, sql, inArray, ne } from "drizzle-orm";
import { sendOrderStatusNotification, sendJobOfferNotification } from "../services/notifications";

// Directly offer the oldest eligible unassigned order to a specific driver.
// This is used when a driver goes online or finishes declining — it finds the oldest
// order that hasn't been declined/expired by this driver and doesn't have an active offer.
async function offerOldestOrderToDriver(driverId: number) {
  const db = await getDb();
  if (!db) return;

  // Check if driver already has a pending (non-expired) offer
  const existingOffer = await db
    .select({ id: orderOffers.id })
    .from(orderOffers)
    .where(
      and(
        eq(orderOffers.driverId, driverId),
        eq(orderOffers.status, "pending"),
        gte(orderOffers.expiresAt, new Date())
      )
    )
    .limit(1);
  if (existingOffer.length > 0) {
    // Driver already has an active offer, don't create another
    return;
  }

  // Check if driver is available (online and not on a delivery)
  const driverRecord = await db
    .select({ isOnline: drivers.isOnline, isAvailable: drivers.isAvailable })
    .from(drivers)
    .where(eq(drivers.userId, driverId))
    .limit(1);
  if (driverRecord.length === 0 || !driverRecord[0].isOnline || !driverRecord[0].isAvailable) {
    return;
  }

  // Get orders this driver has already declined or had expire
  const previouslyOffered = await db
    .select({ orderId: orderOffers.orderId })
    .from(orderOffers)
    .where(
      and(
        eq(orderOffers.driverId, driverId),
        inArray(orderOffers.status, ["declined", "expired"])
      )
    );
  const excludedOrderIds = previouslyOffered.map(o => o.orderId);

  // Get all unassigned orders, oldest first
  const unassignedOrders = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        inArray(orders.status, ["pending", "accepted", "ready_for_pickup"]),
        isNull(orders.driverId)
      )
    )
    .orderBy(asc(orders.createdAt))
    .limit(20);

  // Filter out excluded orders and orders with active offers to other drivers
  for (const order of unassignedOrders) {
    if (excludedOrderIds.includes(order.id)) continue;

    // Check if this order already has an active offer to someone else
    const activeOffer = await db
      .select({ id: orderOffers.id })
      .from(orderOffers)
      .where(
        and(
          eq(orderOffers.orderId, order.id),
          eq(orderOffers.status, "pending"),
          gte(orderOffers.expiresAt, new Date())
        )
      )
      .limit(1);
    if (activeOffer.length > 0) continue;

    // Found an eligible order — create the offer directly
    const expiresAt = new Date(Date.now() + 15 * 1000);
    await db.insert(orderOffers).values({
      orderId: order.id,
      driverId,
      status: "pending",
      offeredAt: new Date(),
      expiresAt,
    });
    console.log(`[FIFO] Offered oldest eligible order ${order.id} to driver ${driverId}, expires at ${expiresAt.toISOString()}`);

    // Send server-side push notification to driver
    try {
      const driverUser = await db
        .select({ pushToken: users.pushToken })
        .from(users)
        .where(eq(users.id, driverId))
        .limit(1);
      if (driverUser.length > 0 && driverUser[0].pushToken) {
        // Get order details for the notification
        const orderDetails = await db
          .select({
            deliveryFee: orders.deliveryFee,
            storeId: orders.storeId,
          deliveryDistance: orders.deliveryDistance,
        })
        .from(orders)
        .where(eq(orders.id, order.id))
        .limit(1);
      if (orderDetails.length > 0) {
        const storeInfo = await db
          .select({ name: stores.name })
          .from(stores)
          .where(eq(stores.id, orderDetails[0].storeId))
          .limit(1);
        const storeName = storeInfo.length > 0 ? storeInfo[0].name : "Store";
        const fee = parseFloat(orderDetails[0].deliveryFee || "0");
        const dist = parseFloat(orderDetails[0].deliveryDistance || "0");
          await sendJobOfferNotification(driverUser[0].pushToken, order.id, storeName, fee, dist);
          console.log(`[Push] Sent job offer notification to driver ${driverId} for order ${order.id}`);
        }
      }
    } catch (pushError) {
      console.error(`[Push] Failed to send job offer notification to driver ${driverId}:`, pushError);
    }
    return;
  }

  console.log(`[FIFO] No eligible orders for driver ${driverId}`);
}

// Offer an order to the next available driver in queue
async function offerToNextDriver(orderId: number) {
  const db = await getDb();
  if (!db) return;

  // Get all drivers who have already been offered this order
  const previousOffers = await db
    .select({ driverId: orderOffers.driverId })
    .from(orderOffers)
    .where(eq(orderOffers.orderId, orderId));
  const offeredDriverIds = previousOffers.map(o => o.driverId);

  // Get queue ordered by position
  const queue = await db
    .select()
    .from(driverQueue)
    .orderBy(asc(driverQueue.position));

  // Find next driver who hasn't been offered yet
  const nextDriver = queue.find(q => !offeredDriverIds.includes(q.driverId));

  if (!nextDriver) {
    // No more drivers to offer to - order stays in available jobs for manual pickup
    console.log(`[Queue] No more drivers available for order ${orderId}`);
    return;
  }

  // Create offer with 15-second expiry
  const expiresAt = new Date(Date.now() + 15 * 1000);
  await db.insert(orderOffers).values({
    orderId,
    driverId: nextDriver.driverId,
    status: "pending",
    offeredAt: new Date(),
    expiresAt,
  });

  console.log(`[Queue] Offered order ${orderId} to driver ${nextDriver.driverId} (position ${nextDriver.position}), expires at ${expiresAt.toISOString()}`);

  // Send server-side push notification to the driver
  try {
    const driverUser = await db
      .select({ pushToken: users.pushToken })
      .from(users)
      .where(eq(users.id, nextDriver.driverId))
      .limit(1);
    if (driverUser.length > 0 && driverUser[0].pushToken) {
      const orderDetails = await db
        .select({
          deliveryFee: orders.deliveryFee,
          storeId: orders.storeId,
          deliveryDistance: orders.deliveryDistance,
        })
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);
      if (orderDetails.length > 0) {
        const storeInfo = await db
          .select({ name: stores.name })
          .from(stores)
          .where(eq(stores.id, orderDetails[0].storeId))
          .limit(1);
        const storeName = storeInfo.length > 0 ? storeInfo[0].name : "Store";
        const fee = parseFloat(orderDetails[0].deliveryFee || "0");
        const dist = parseFloat(orderDetails[0].deliveryDistance || "0");
        await sendJobOfferNotification(driverUser[0].pushToken, orderId, storeName, fee, dist);
        console.log(`[Push] Sent job offer notification to driver ${nextDriver.driverId} for order ${orderId}`);
      }
    }
  } catch (pushError) {
    console.error(`[Push] Failed to send job offer notification to driver ${nextDriver.driverId}:`, pushError);
  }
}

// Called when a new order is placed - start the offer cascade
export async function offerOrderToQueue(orderId: number) {
  await offerToNextDriver(orderId);
}

export const driversRouter = router({
  // Toggle driver online/offline status
  toggleOnlineStatus: publicProcedure
    .input(
      z.object({
        driverId: z.number(),
        isOnline: z.boolean(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // driverId here is the USER ID (not the drivers table ID)
      await db
        .update(drivers)
        .set({
          isOnline: input.isOnline,
          isAvailable: input.isOnline, // When going online, also set available
          updatedAt: new Date(),
        })
        .where(eq(drivers.userId, input.driverId));

      // Queue management: add or remove from queue
      if (input.isOnline) {
        // Get the current max position
        const maxPos = await db
          .select({ maxPosition: sql<number>`COALESCE(MAX(${driverQueue.position}), 0)` })
          .from(driverQueue);
        const nextPosition = (maxPos[0]?.maxPosition || 0) + 1;

        // Remove any existing entry first (in case of stale data)
        await db.delete(driverQueue).where(eq(driverQueue.driverId, input.driverId));

        // Add to queue
        await db.insert(driverQueue).values({
          driverId: input.driverId,
          position: nextPosition,
          wentOnlineAt: new Date(),
        });

        // Clear decline/expiry history so ALL waiting jobs are eligible again.
        // When a driver toggles back online, it's a fresh start — they should
        // see the oldest waiting job even if they declined it before.
        await db
          .delete(orderOffers)
          .where(
            and(
              eq(orderOffers.driverId, input.driverId),
              inArray(orderOffers.status, ["declined", "expired"])
            )
          );
        console.log(`[Queue] Driver ${input.driverId} went online, cleared decline/expiry history`);

        // Force-offer the oldest eligible unassigned order to this driver (FIFO)
        await offerOldestOrderToDriver(input.driverId);
      } else {
        // Remove from queue
        await db.delete(driverQueue).where(eq(driverQueue.driverId, input.driverId));

        // Expire any pending offers for this driver
        await db
          .update(orderOffers)
          .set({ status: "expired", respondedAt: new Date() })
          .where(
            and(
              eq(orderOffers.driverId, input.driverId),
              eq(orderOffers.status, "pending")
            )
          );
      }

      return { success: true, isOnline: input.isOnline };
    }),

  // Get driver profile and stats
  getProfile: publicProcedure
    .input(
      z.object({
        driverId: z.number(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // driverId here is the USER ID (not the drivers table ID)
      const driverResult = await db
        .select()
        .from(drivers)
        .leftJoin(users, eq(drivers.userId, users.id))
        .where(eq(drivers.userId, input.driverId))
        .limit(1);

      if (driverResult.length === 0) {
        throw new Error("Driver not found");
      }

      return {
        ...driverResult[0].drivers,
        user: driverResult[0].users,
      };
    }),

  // Get available delivery jobs (orders ready for pickup)
  getAvailableJobs: publicProcedure
    .input(
      z.object({
        driverId: z.number(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Get orders that are ready for pickup and don't have a driver assigned
      const availableOrders = await db
        .select()
        .from(orders)
        .leftJoin(stores, eq(orders.storeId, stores.id))
        .where(
          and(
            eq(orders.status, "ready_for_pickup"),
            isNull(orders.driverId)
          )
        )
        .limit(10);

      // Get order items for each order
      const ordersWithItems = await Promise.all(
        availableOrders.map(async (orderData) => {
          const items = await db
            .select()
            .from(orderItems)
            .where(eq(orderItems.orderId, orderData.orders.id));

          return {
            ...orderData.orders,
            store: orderData.stores,
            items,
          };
        })
      );

      return ordersWithItems;
    }),

  // Accept a delivery job
  acceptJob: publicProcedure
    .input(
      z.object({
        driverId: z.number(),
        orderId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Check if order is still available
      const orderResult = await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.id, input.orderId),
            isNull(orders.driverId)
          )
        )
        .limit(1);

      if (orderResult.length === 0) {
        throw new Error("Order is no longer available");
      }

      // Assign driver to order
      await db
        .update(orders)
        .set({
          driverId: input.driverId,
          status: "picked_up",
          driverAssignedAt: new Date(),
          pickedUpAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(orders.id, input.orderId));

      // Mark driver as unavailable
      await db
        .update(drivers)
        .set({
          isAvailable: false,
          updatedAt: new Date(),
        })
        .where(eq(drivers.id, input.driverId));

      // Send notification to customer (skip for guest orders)
      if (orderResult[0].customerId) {
        const customer = await db
          .select()
          .from(users)
          .where(eq(users.id, orderResult[0].customerId))
          .limit(1);

        if (customer.length > 0 && customer[0].pushToken) {
        const store = await db
          .select()
          .from(stores)
          .where(eq(stores.id, orderResult[0].storeId))
          .limit(1);

        const storeName = store.length > 0 ? store[0].name : "Store";

        await sendOrderStatusNotification(
          customer[0].pushToken,
          input.orderId,
          "picked_up",
          storeName
        );
        }
      }

      return { success: true, orderId: input.orderId };
    }),

  // Get active delivery for driver
  getActiveDelivery: publicProcedure
    .input(
      z.object({
        driverId: z.number(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      const activeOrderResult = await db
        .select()
        .from(orders)
        .leftJoin(stores, eq(orders.storeId, stores.id))
        .leftJoin(users, eq(orders.customerId, users.id))
        .where(
          and(
            eq(orders.driverId, input.driverId),
            or(
              eq(orders.status, "ready_for_pickup"),
              eq(orders.status, "picked_up"),
              eq(orders.status, "on_the_way")
            )
          )
        )
        .limit(1);

      if (activeOrderResult.length === 0) {
        return null;
      }

      const orderData = activeOrderResult[0];

      // Get order items
      const items = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, orderData.orders.id));

      return {
        ...orderData.orders,
        store: orderData.stores,
        customer: orderData.users,
        items,
      };
    }),

  // Notify customer that driver has arrived at store
  notifyDriverAtStore: publicProcedure
    .input(
      z.object({
        orderId: z.number(),
        driverId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get order details for notification
      const orderResult = await db
        .select()
        .from(orders)
        .leftJoin(stores, eq(orders.storeId, stores.id))
        .leftJoin(users, eq(orders.customerId, users.id))
        .where(eq(orders.id, input.orderId))
        .limit(1);

      if (orderResult.length === 0) {
        throw new Error("Order not found");
      }

      const customer = orderResult[0].users;
      const store = orderResult[0].stores;

      // Log to order_tracking
      await db.insert(orderTracking).values({
        orderId: input.orderId,
        status: "driver_at_store",
        notes: `Driver arrived at ${store?.name || "store"}`,
      });

      // Send push notification to customer
      if (customer && customer.pushToken && store) {
        await sendOrderStatusNotification(
          customer.pushToken,
          input.orderId,
          "driver_at_store",
          store.name
        );
      }

      return { success: true };
    }),

  // Update delivery status
  updateDeliveryStatus: publicProcedure
    .input(
      z.object({
        orderId: z.number(),
        status: z.enum(["picked_up", "on_the_way", "delivered"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      const updateData: any = {
        status: input.status,
        updatedAt: new Date(),
      };

      if (input.status === "picked_up") {
        updateData.pickedUpAt = new Date();
      } else if (input.status === "on_the_way") {
        updateData.status = "on_the_way";
      } else if (input.status === "delivered") {
        updateData.deliveredAt = new Date();
      }

      // Get order details before update for notification
      const orderBeforeUpdate = await db
        .select()
        .from(orders)
        .leftJoin(stores, eq(orders.storeId, stores.id))
        .leftJoin(users, eq(orders.customerId, users.id))
        .where(eq(orders.id, input.orderId))
        .limit(1);

      await db
        .update(orders)
        .set(updateData)
        .where(eq(orders.id, input.orderId));

      // Send notification to customer
      if (orderBeforeUpdate.length > 0) {
        const customer = orderBeforeUpdate[0].users;
        const store = orderBeforeUpdate[0].stores;

        if (customer && customer.pushToken && store) {
          await sendOrderStatusNotification(
            customer.pushToken,
            input.orderId,
            input.status,
            store.name
          );
        }
      }

      // If delivered, mark driver as available again
      if (input.status === "delivered") {
        const orderResult = await db
          .select()
          .from(orders)
          .where(eq(orders.id, input.orderId))
          .limit(1);

        if (orderResult.length > 0 && orderResult[0].driverId) {
          const currentDriver = await db
            .select()
            .from(drivers)
            .where(eq(drivers.id, orderResult[0].driverId))
            .limit(1);

          if (currentDriver.length > 0) {
            await db
              .update(drivers)
              .set({
                isAvailable: true,
                totalDeliveries: (currentDriver[0].totalDeliveries || 0) + 1,
                updatedAt: new Date(),
              })
              .where(eq(drivers.id, orderResult[0].driverId));
          }
        }
      }

      return { success: true };
    }),

  // Get driver stats for dashboard
  getStats: publicProcedure
    .input(
      z.object({
        driverId: z.number(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Get all completed deliveries for driver
      const completedOrders = await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.driverId, input.driverId),
            eq(orders.status, "delivered")
          )
        );

      // Helper to safely parse delivery fee
      const parseFee = (fee: string | null | undefined): number => {
        if (!fee) return 0;
        const parsed = parseFloat(fee);
        return isNaN(parsed) ? 0 : parsed;
      };

      // Helper to get the effective delivery date (use deliveredAt, fall back to createdAt)
      const getDeliveryDate = (order: any): Date => {
        if (order.deliveredAt) return new Date(order.deliveredAt);
        return new Date(order.createdAt);
      };

      // Calculate today's stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayOrders = completedOrders.filter(order => {
        const deliveredAt = getDeliveryDate(order);
        return deliveredAt >= today;
      });
      const todayEarnings = todayOrders.reduce(
        (sum, order) => sum + parseFee(order.deliveryFee) + parseFee(order.tipAmount),
        0
      );
      const todayTips = todayOrders.reduce(
        (sum, order) => sum + parseFee(order.tipAmount),
        0
      );

      // Calculate this week's stats
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week (Sunday)
      weekStart.setHours(0, 0, 0, 0);
      const weekOrders = completedOrders.filter(order => {
        const deliveredAt = getDeliveryDate(order);
        return deliveredAt >= weekStart;
      });
      const weekEarnings = weekOrders.reduce(
        (sum, order) => sum + parseFee(order.deliveryFee) + parseFee(order.tipAmount),
        0
      );
      const weekTips = weekOrders.reduce(
        (sum, order) => sum + parseFee(order.tipAmount),
        0
      );

      // Total stats
      const totalEarnings = completedOrders.reduce(
        (sum, order) => sum + parseFee(order.deliveryFee) + parseFee(order.tipAmount),
        0
      );
      const totalTips = completedOrders.reduce(
        (sum, order) => sum + parseFee(order.tipAmount),
        0
      );

      return {
        todayEarnings,
        todayTips,
        todayDeliveries: todayOrders.length,
        weekEarnings,
        weekTips,
        weekDeliveries: weekOrders.length,
        totalEarnings,
        totalTips,
        totalDeliveries: completedOrders.length,
      };
    }),

  // Get queue position for a driver
  getQueuePosition: publicProcedure
    .input(z.object({ driverId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get all queue entries ordered by position
      const queue = await db
        .select()
        .from(driverQueue)
        .orderBy(asc(driverQueue.position));

      const myEntry = queue.find(q => q.driverId === input.driverId);
      if (!myEntry) {
        return { inQueue: false, position: 0, totalOnline: queue.length };
      }

      // Calculate actual position (1-based)
      const position = queue.findIndex(q => q.driverId === input.driverId) + 1;

      return {
        inQueue: true,
        position,
        totalOnline: queue.length,
      };
    }),

  // Get current pending offer for a driver (polling endpoint)
  getCurrentOffer: publicProcedure
    .input(z.object({ driverId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const now = new Date();

      // First, expire any offers that have passed their expiry time
      const expiredOffers = await db
        .select()
        .from(orderOffers)
        .where(
          and(
            eq(orderOffers.status, "pending"),
            lte(orderOffers.expiresAt, now)
          )
        );

      if (expiredOffers.length > 0) {
        await db
          .update(orderOffers)
          .set({ status: "expired" })
          .where(
            and(
              eq(orderOffers.status, "pending"),
              lte(orderOffers.expiresAt, now)
            )
          );

        // Cascade: offer expired orders to next driver in queue
        const expiredOrderIds = [...new Set(expiredOffers.map(o => o.orderId))];
        for (const orderId of expiredOrderIds) {
          // Only cascade if order is still unassigned
          const orderCheck = await db
            .select({ driverId: orders.driverId, status: orders.status })
            .from(orders)
            .where(eq(orders.id, orderId))
            .limit(1);
          if (orderCheck.length > 0 && !orderCheck[0].driverId && ["pending", "accepted", "ready_for_pickup"].includes(orderCheck[0].status)) {
            await offerToNextDriver(orderId);
          }
        }
      }

      // Check for pending offer for this driver
      const pendingOffer = await db
        .select()
        .from(orderOffers)
        .where(
          and(
            eq(orderOffers.driverId, input.driverId),
            eq(orderOffers.status, "pending"),
            gte(orderOffers.expiresAt, now)
          )
        )
        .limit(1);

      if (pendingOffer.length === 0) {
        // No active offer — try to force-offer the oldest eligible order (FIFO).
        // This uses offerOldestOrderToDriver which respects decline/expiry exclusions
        // and won't create duplicates if driver already has an offer or is unavailable.
        await offerOldestOrderToDriver(input.driverId);

        // Re-check if an offer was just created
        const newOffer = await db
          .select()
          .from(orderOffers)
          .where(
            and(
              eq(orderOffers.driverId, input.driverId),
              eq(orderOffers.status, "pending"),
              gte(orderOffers.expiresAt, new Date())
            )
          )
          .limit(1);

        if (newOffer.length === 0) {
          return { hasOffer: false, offer: null };
        }

        // Use the newly created offer
        pendingOffer.length = 0;
        pendingOffer.push(newOffer[0]);
      }

      // Get order details for the offer
      const offer = pendingOffer[0];
      const orderResult = await db
        .select()
        .from(orders)
        .leftJoin(stores, eq(orders.storeId, stores.id))
        .where(eq(orders.id, offer.orderId))
        .limit(1);

      if (orderResult.length === 0) {
        return { hasOffer: false, offer: null };
      }

      const order = orderResult[0];
      const items = await db
        .select({ quantity: orderItems.quantity, productName: products.name })
        .from(orderItems)
        .leftJoin(products, eq(orderItems.productId, products.id))
        .where(eq(orderItems.orderId, offer.orderId));

      // Calculate estimated distance between store and delivery address
      let estimatedDistanceKm: number | null = null;
      const storeLat = order.stores?.latitude ? parseFloat(order.stores.latitude) : null;
      const storeLng = order.stores?.longitude ? parseFloat(order.stores.longitude) : null;
      const delivLat = order.orders.deliveryLatitude ? parseFloat(order.orders.deliveryLatitude) : null;
      const delivLng = order.orders.deliveryLongitude ? parseFloat(order.orders.deliveryLongitude) : null;
      if (storeLat && storeLng && delivLat && delivLng) {
        // Haversine formula
        const R = 6371; // Earth radius in km
        const dLat = (delivLat - storeLat) * Math.PI / 180;
        const dLng = (delivLng - storeLng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(storeLat * Math.PI / 180) * Math.cos(delivLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        estimatedDistanceKm = Math.round(R * c * 10) / 10; // 1 decimal place
      }

      return {
        hasOffer: true,
        offer: {
          offerId: offer.id,
          orderId: offer.orderId,
          expiresAt: offer.expiresAt.toISOString(),
          orderNumber: order.orders.orderNumber,
          storeName: order.stores?.name || "Store",
          storeAddress: order.stores?.address || "",
          deliveryAddress: order.orders.deliveryAddress,
          deliveryFee: order.orders.deliveryFee,
          tipAmount: order.orders.tipAmount,
          total: order.orders.total,
          paymentMethod: order.orders.paymentMethod,
          customerNotes: order.orders.customerNotes,
          itemCount: items.length,
          items: items.map(i => ({ quantity: i.quantity, name: i.productName || "Item" })),
          estimatedDistanceKm,
          allowSubstitution: order.orders.allowSubstitution || false,
        },
      };
    }),

  // Accept an order offer
  acceptOffer: publicProcedure
    .input(z.object({ offerId: z.number(), driverId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get the offer
      const offerResult = await db
        .select()
        .from(orderOffers)
        .where(eq(orderOffers.id, input.offerId))
        .limit(1);

      if (offerResult.length === 0) throw new Error("Offer not found");
      const offer = offerResult[0];

      if (offer.status !== "pending") throw new Error("Offer is no longer available");
      if (offer.driverId !== input.driverId) throw new Error("This offer is not for you");
      if (new Date() > offer.expiresAt) throw new Error("Offer has expired");

      // Accept the offer
      await db
        .update(orderOffers)
        .set({ status: "accepted", respondedAt: new Date() })
        .where(eq(orderOffers.id, input.offerId));

      // Assign driver to order
      await db
        .update(orders)
        .set({ driverId: input.driverId, driverAssignedAt: new Date() })
        .where(eq(orders.id, offer.orderId));

      // Move driver to back of queue
      const maxPos = await db
        .select({ maxPosition: sql<number>`COALESCE(MAX(${driverQueue.position}), 0)` })
        .from(driverQueue);
      const newPosition = (maxPos[0]?.maxPosition || 0) + 1;

      await db
        .update(driverQueue)
        .set({ position: newPosition, lastCompletedAt: new Date() })
        .where(eq(driverQueue.driverId, input.driverId));

      return { success: true, orderId: offer.orderId };
    }),

  // Decline an order offer
  declineOffer: publicProcedure
    .input(z.object({ offerId: z.number(), driverId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Mark offer as declined
      await db
        .update(orderOffers)
        .set({ status: "declined", respondedAt: new Date() })
        .where(
          and(
            eq(orderOffers.id, input.offerId),
            eq(orderOffers.driverId, input.driverId)
          )
        );

      // Auto-toggle driver OFFLINE after declining
      await db
        .update(drivers)
        .set({
          isOnline: false,
          isAvailable: false,
          updatedAt: new Date(),
        })
        .where(eq(drivers.userId, input.driverId));

      // Remove from driver queue
      await db.delete(driverQueue).where(eq(driverQueue.driverId, input.driverId));

      console.log(`[Decline] Driver ${input.driverId} declined offer ${input.offerId}, auto-toggled offline`);

      // Trigger cascade to next driver in queue for this order
      const offer = await db
        .select()
        .from(orderOffers)
        .where(eq(orderOffers.id, input.offerId))
        .limit(1);

      if (offer.length > 0) {
        await offerToNextDriver(offer[0].orderId);
      }

      return { success: true, wentOffline: true };
    }),

  // Get today's return count for a driver
  getReturnCount: publicProcedure
    .input(z.object({ driverId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const result = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(jobReturns)
        .where(
          and(
            eq(jobReturns.driverId, input.driverId),
            gte(jobReturns.returnedAt, todayStart)
          )
        );

      const returnsToday = result[0]?.count || 0;
      const reasonRequired = returnsToday >= 3;

      return {
        returnsToday,
        reasonRequired,
        maxFreeReturns: 3,
      };
    }),

  // Get driver earnings with daily breakdown
  getEarnings: publicProcedure
    .input(
      z.object({
        driverId: z.number(),
        period: z.enum(["today", "week", "month", "all"]).optional().default("all"),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Get all completed deliveries for driver with store info
      const completedOrders = await db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          deliveryFee: orders.deliveryFee,
          tipAmount: orders.tipAmount,
          deliveredAt: orders.deliveredAt,
          createdAt: orders.createdAt,
          deliveryAddress: orders.deliveryAddress,
          storeName: stores.name,
        })
        .from(orders)
        .leftJoin(stores, eq(orders.storeId, stores.id))
        .where(
          and(
            eq(orders.driverId, input.driverId),
            eq(orders.status, "delivered")
          )
        )
        .orderBy(desc(orders.deliveredAt));

      // Calculate total earnings
      const totalEarnings = completedOrders.reduce(
        (sum, order) => sum + parseFloat(order.deliveryFee) + parseFloat(order.tipAmount || "0"),
        0
      );
      const totalTips = completedOrders.reduce(
        (sum, order) => sum + parseFloat(order.tipAmount || "0"),
        0
      );

      // Build daily breakdown for the past 7 days
      const dailyBreakdown: { date: string; dayLabel: string; earnings: number; deliveries: number }[] = [];
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        const dayOrders = completedOrders.filter(o => {
          const oDate = o.deliveredAt ? new Date(o.deliveredAt).toISOString().split("T")[0] : null;
          return oDate === dateStr;
        });
        dailyBreakdown.push({
          date: dateStr,
          dayLabel: i === 0 ? "Today" : i === 1 ? "Yesterday" : days[d.getDay()],
          earnings: dayOrders.reduce((s, o) => s + parseFloat(o.deliveryFee) + parseFloat(o.tipAmount || "0"), 0),
          deliveries: dayOrders.length,
        });
      }

      // Today's earnings
      const todayStr = new Date().toISOString().split("T")[0];
      const todayOrders = completedOrders.filter(o => {
        const oDate = o.deliveredAt ? new Date(o.deliveredAt).toISOString().split("T")[0] : null;
        return oDate === todayStr;
      });
      const todayEarnings = todayOrders.reduce((s, o) => s + parseFloat(o.deliveryFee) + parseFloat(o.tipAmount || "0"), 0);
      const todayTips = todayOrders.reduce((s, o) => s + parseFloat(o.tipAmount || "0"), 0);

      // This week's earnings
      const weekStart = new Date();
      weekStart.setHours(0, 0, 0, 0);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday
      const weekOrders = completedOrders.filter(o => {
        const oDate = o.deliveredAt ? new Date(o.deliveredAt) : null;
        return oDate && oDate >= weekStart;
      });
      const weekEarnings = weekOrders.reduce((s, o) => s + parseFloat(o.deliveryFee) + parseFloat(o.tipAmount || "0"), 0);
      const weekTips = weekOrders.reduce((s, o) => s + parseFloat(o.tipAmount || "0"), 0);

      return {
        totalEarnings,
        totalTips,
        totalDeliveries: completedOrders.length,
        averagePerDelivery: completedOrders.length > 0 
          ? totalEarnings / completedOrders.length 
          : 0,
        todayEarnings,
        todayTips,
        todayDeliveries: todayOrders.length,
        weekEarnings,
        weekTips,
        weekDeliveries: weekOrders.length,
        dailyBreakdown,
        recentDeliveries: completedOrders.slice(0, 50).map(order => ({
          id: order.id,
          orderNumber: order.orderNumber,
          amount: parseFloat(order.deliveryFee) + parseFloat(order.tipAmount || "0"),
          baseFee: parseFloat(order.deliveryFee),
          tip: parseFloat(order.tipAmount || "0"),
          completedAt: order.deliveredAt,
          storeName: order.storeName || "Store",
          deliveryAddress: order.deliveryAddress,
        })),
      };
    }),

  // Update driver location during active delivery
  updateLocation: publicProcedure
    .input(
      z.object({
        driverId: z.number(),
        latitude: z.number(),
        longitude: z.number(),
        orderId: z.number().optional(), // if actively delivering
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Update driver's current location
      await db
        .update(drivers)
        .set({
          currentLatitude: String(input.latitude),
          currentLongitude: String(input.longitude),
          lastLocationUpdate: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(drivers.userId, input.driverId));

      // If actively delivering an order, also log to order_tracking
      if (input.orderId) {
        await db.insert(orderTracking).values({
          orderId: input.orderId,
          status: "location_update",
          latitude: String(input.latitude),
          longitude: String(input.longitude),
        });
      }

      return { success: true };
    }),

  // Get driver location for a specific order (customer-facing)
  getDriverLocation: publicProcedure
    .input(
      z.object({
        orderId: z.number(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get the order to find the assigned driver
      const orderResult = await db
        .select({
          driverId: orders.driverId,
          status: orders.status,
          storeId: orders.storeId,
          deliveryLatitude: orders.deliveryLatitude,
          deliveryLongitude: orders.deliveryLongitude,
        })
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1);

      if (orderResult.length === 0) {
        return { hasLocation: false, driver: null, store: null };
      }

      const order = orderResult[0];

      // Only show driver location for active delivery statuses
      if (!order.driverId || !["picked_up", "on_the_way"].includes(order.status)) {
        // Return store location for pre-pickup statuses
        const storeResult = await db
          .select({ latitude: stores.latitude, longitude: stores.longitude, name: stores.name })
          .from(stores)
          .where(eq(stores.id, order.storeId))
          .limit(1);

        return {
          hasLocation: false,
          driver: null,
          store: storeResult.length > 0 ? {
            latitude: storeResult[0].latitude ? parseFloat(storeResult[0].latitude) : null,
            longitude: storeResult[0].longitude ? parseFloat(storeResult[0].longitude) : null,
            name: storeResult[0].name,
          } : null,
          delivery: {
            latitude: order.deliveryLatitude ? parseFloat(order.deliveryLatitude) : null,
            longitude: order.deliveryLongitude ? parseFloat(order.deliveryLongitude) : null,
          },
        };
      }

      // Get driver's current location
      const driverResult = await db
        .select({
          currentLatitude: drivers.currentLatitude,
          currentLongitude: drivers.currentLongitude,
          lastLocationUpdate: drivers.lastLocationUpdate,
          userId: drivers.userId,
          displayNumber: drivers.displayNumber,
        })
        .from(drivers)
        .where(eq(drivers.userId, order.driverId))
        .limit(1);

      // Get store location
      const storeResult = await db
        .select({ latitude: stores.latitude, longitude: stores.longitude, name: stores.name })
        .from(stores)
        .where(eq(stores.id, order.storeId))
        .limit(1);

      if (driverResult.length === 0 || !driverResult[0].currentLatitude) {
        return {
          hasLocation: false,
          driver: null,
          store: storeResult.length > 0 ? {
            latitude: storeResult[0].latitude ? parseFloat(storeResult[0].latitude) : null,
            longitude: storeResult[0].longitude ? parseFloat(storeResult[0].longitude) : null,
            name: storeResult[0].name,
          } : null,
          delivery: {
            latitude: order.deliveryLatitude ? parseFloat(order.deliveryLatitude) : null,
            longitude: order.deliveryLongitude ? parseFloat(order.deliveryLongitude) : null,
          },
        };
      }

      return {
        hasLocation: true,
        driver: {
          latitude: parseFloat(driverResult[0].currentLatitude!),
          longitude: parseFloat(driverResult[0].currentLongitude!),
          lastUpdate: driverResult[0].lastLocationUpdate?.toISOString() || null,
          name: driverResult[0].displayNumber ? `Driver ${driverResult[0].displayNumber}` : "Driver",
        },
        store: storeResult.length > 0 ? {
          latitude: storeResult[0].latitude ? parseFloat(storeResult[0].latitude) : null,
          longitude: storeResult[0].longitude ? parseFloat(storeResult[0].longitude) : null,
          name: storeResult[0].name,
        } : null,
        delivery: {
          latitude: order.deliveryLatitude ? parseFloat(order.deliveryLatitude) : null,
          longitude: order.deliveryLongitude ? parseFloat(order.deliveryLongitude) : null,
        },
      };
    }),

  // Get count of unassigned pending orders waiting for a driver
  waitingOrdersCount: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { count: 0 };

    // Count all orders waiting for a driver (any status that needs delivery)
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(
        and(
          inArray(orders.status, ["pending", "accepted", "preparing", "ready_for_pickup"]),
          isNull(orders.driverId)
        )
      );

    return { count: Number(result[0]?.count ?? 0) };
  }),
});
