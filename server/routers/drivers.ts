import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { drivers, orders, orderItems, products, stores, users, driverQueue, orderOffers, jobReturns, orderTracking, driverShifts } from "../../drizzle/schema";
import { eq, and, or, isNull, asc, desc, gte, lte, sql, inArray, ne } from "drizzle-orm";
import { sendOrderStatusNotification, sendJobOfferNotification, sendPushNotification } from "../services/notifications";
import { sendDriverAtStoreSMS } from "../sms";

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
        inArray(orders.status, ["pending", "accepted", "preparing", "ready_for_pickup"]),
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

// Check if a driver already heading to the same store can take an extra order (batch)
const MAX_BATCH_SIZE = 5;

async function tryBatchOfferToEnRouteDriver(orderId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  // Get the store for this order
  const orderResult = await db
    .select({ storeId: orders.storeId })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (orderResult.length === 0) return false;
  const storeId = orderResult[0].storeId;

  // Find drivers currently assigned to orders from the SAME store
  // that are in pre-delivery statuses (heading to store / at store / picking up)
  const driversAtSameStore = await db
    .select({
      driverId: orders.driverId,
      orderId: orders.id,
      status: orders.status,
      batchId: orders.batchId,
    })
    .from(orders)
    .where(
      and(
        eq(orders.storeId, storeId),
        sql`${orders.driverId} IS NOT NULL`,
        // Only drivers who haven't left the store yet
        inArray(orders.status, ["pending", "accepted", "preparing", "ready_for_pickup", "picked_up"])
      )
    );

  if (driversAtSameStore.length === 0) return false;

  // Group by driver and count their current batch size
  const driverBatchCounts = new Map<number, { count: number; batchId: string | null; hasLeftStore: boolean }>();
  for (const row of driversAtSameStore) {
    if (!row.driverId) continue;
    const existing = driverBatchCounts.get(row.driverId);
    // Check if any order in their batch is already on_the_way — means they've left the store
    const hasLeft = row.status === "on_the_way";
    if (existing) {
      existing.count++;
      if (!existing.batchId && row.batchId) existing.batchId = row.batchId;
      if (hasLeft) existing.hasLeftStore = true;
    } else {
      driverBatchCounts.set(row.driverId, { count: 1, batchId: row.batchId, hasLeftStore: hasLeft });
    }
  }

  // Find an eligible driver (under max batch, hasn't left store)
  for (const [driverId, info] of driverBatchCounts) {
    if (info.hasLeftStore) continue; // Already delivering, don't add more
    if (info.count >= MAX_BATCH_SIZE) continue; // At max batch size

    // Check if this driver already has a pending batch offer (don't spam)
    const existingBatchOffer = await db
      .select({ id: orderOffers.id })
      .from(orderOffers)
      .where(
        and(
          eq(orderOffers.driverId, driverId),
          eq(orderOffers.status, "pending"),
          eq(orderOffers.isBatchOffer, true),
          gte(orderOffers.expiresAt, new Date())
        )
      )
      .limit(1);
    if (existingBatchOffer.length > 0) continue; // Already has a pending batch offer

    // Create a batch offer with 30-second expiry (longer than normal since they're already busy)
    const expiresAt = new Date(Date.now() + 30 * 1000);
    await db.insert(orderOffers).values({
      orderId,
      driverId,
      status: "pending",
      offeredAt: new Date(),
      expiresAt,
      isBatchOffer: true,
    });

    console.log(`[Batch] Offered order ${orderId} as batch add-on to driver ${driverId} (current batch: ${info.count}), expires at ${expiresAt.toISOString()}`);

    // Send push notification
    try {
      const driverUser = await db
        .select({ pushToken: users.pushToken })
        .from(users)
        .where(eq(users.id, driverId))
        .limit(1);
      if (driverUser.length > 0 && driverUser[0].pushToken) {
        const storeInfo = await db
          .select({ name: stores.name })
          .from(stores)
          .where(eq(stores.id, storeId))
          .limit(1);
        const storeName = storeInfo.length > 0 ? storeInfo[0].name : "Store";
        const totalInBatch = info.count + 1;
        await sendPushNotification(driverUser[0].pushToken, {
          title: `📦 ${totalInBatch} jobs now waiting in ${storeName}`,
          body: `Another order is ready at ${storeName}. Accept to add to your batch.`,
          data: { type: "batch_offer", orderId, driverId },
          channelId: "orders",
        });
      }
    } catch (pushError) {
      console.error(`[Batch] Failed to send batch offer notification:`, pushError);
    }

    return true; // Successfully offered as batch
  }

  return false; // No eligible driver found for batch
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

  // Find next AVAILABLE driver who hasn't been offered yet
  // Available means: in queue AND isAvailable=true (not currently on a delivery)
  let nextDriver = null;
  for (const q of queue) {
    if (offeredDriverIds.includes(q.driverId)) continue;
    // Check if driver is actually available
    const driverCheck = await db
      .select({ isAvailable: drivers.isAvailable })
      .from(drivers)
      .where(eq(drivers.userId, q.driverId))
      .limit(1);
    if (driverCheck.length > 0 && driverCheck[0].isAvailable) {
      nextDriver = q;
      break;
    }
  }

  if (!nextDriver) {
    // No available drivers in queue — try batch offer to a driver already at the same store
    console.log(`[Queue] No available drivers for order ${orderId}, trying batch offer...`);
    const batchOffered = await tryBatchOfferToEnRouteDriver(orderId);
    if (!batchOffered) {
      console.log(`[Queue] No batch opportunity either for order ${orderId}`);
    }
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

// Haversine distance in km
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Auto-sort batch delivery sequence by closest customer (greedy nearest-neighbour from store)
async function autoSortBatchSequence(batchId: string) {
  const db = await getDb();
  if (!db) return;

  const batchOrders = await db
    .select({
      id: orders.id,
      deliveryLatitude: orders.deliveryLatitude,
      deliveryLongitude: orders.deliveryLongitude,
      storeId: orders.storeId,
    })
    .from(orders)
    .where(eq(orders.batchId, batchId))
    .orderBy(asc(orders.batchSequence));

  if (batchOrders.length <= 1) return;

  // Get store location as starting point
  const storeResult = await db
    .select({ latitude: stores.latitude, longitude: stores.longitude })
    .from(stores)
    .where(eq(stores.id, batchOrders[0].storeId))
    .limit(1);

  let currentLat = storeResult.length > 0 ? parseFloat(storeResult[0].latitude || "0") : 0;
  let currentLng = storeResult.length > 0 ? parseFloat(storeResult[0].longitude || "0") : 0;

  // Greedy nearest-neighbour sort
  const remaining = [...batchOrders];
  const sorted: typeof batchOrders = [];

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const lat = parseFloat(remaining[i].deliveryLatitude || "0");
      const lng = parseFloat(remaining[i].deliveryLongitude || "0");
      if (lat === 0 && lng === 0) continue;
      const dist = haversineKm(currentLat, currentLng, lat, lng);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    const next = remaining.splice(bestIdx, 1)[0];
    sorted.push(next);
    currentLat = parseFloat(next.deliveryLatitude || "0");
    currentLng = parseFloat(next.deliveryLongitude || "0");
  }

  // Update sequence numbers
  for (let i = 0; i < sorted.length; i++) {
    await db
      .update(orders)
      .set({ batchSequence: i + 1 })
      .where(eq(orders.id, sorted[i].id));
  }

  console.log(`[Batch] Auto-sorted batch ${batchId}: ${sorted.map((o, i) => `#${o.id}→${i + 1}`).join(", ")}`);
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

        // Check if driver has active deliveries — notify admin staff if so
        try {
          const activeDeliveries = await db
            .select({ id: orders.id, orderNumber: orders.orderNumber })
            .from(orders)
            .where(
              and(
                eq(orders.driverId, input.driverId),
                sql`${orders.status} IN ('picked_up', 'on_the_way', 'accepted', 'preparing', 'ready_for_pickup')`
              )
            );

          if (activeDeliveries.length > 0) {
            // Get driver name
            const [driverUser] = await db
              .select({ name: users.name })
              .from(users)
              .where(eq(users.id, input.driverId))
              .limit(1);
            const driverName = driverUser?.name || "Unknown driver";
            const orderNumbers = activeDeliveries.map(o => `#${o.orderNumber}`).join(", ");

            // Find all admin users with push tokens
            const adminUsers = await db
              .select({ pushToken: users.pushToken, name: users.name })
              .from(users)
              .where(and(eq(users.role, "admin"), sql`${users.pushToken} IS NOT NULL AND ${users.pushToken} != ''`));

            for (const admin of adminUsers) {
              if (admin.pushToken) {
                await sendPushNotification(admin.pushToken, {
                  title: "\u26a0\ufe0f Driver Went Offline During Delivery",
                  body: `${driverName} went offline with ${activeDeliveries.length} active order(s): ${orderNumbers}`,
                  data: { type: "driver_offline_alert", driverId: input.driverId },
                  channelId: "orders",
                });
              }
            }
            console.log(`[Alert] Driver ${input.driverId} (${driverName}) went offline with active deliveries: ${orderNumbers}`);
          }
        } catch (e) {
          console.error(`[Alert] Failed to check/notify for driver offline during delivery:`, e);
        }
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
               eq(orders.status, "accepted"),
               eq(orders.status, "preparing"),
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

      const orderRecord = orderResult[0].orders;
      const customer = orderResult[0].users;
      const store = orderResult[0].stores;

      // Check if driver already arrived (prevent duplicate SMS)
      if (orderRecord.driverArrivedAt) {
        console.log(`[notifyDriverAtStore] Driver already arrived for order ${input.orderId}, skipping duplicate notification`);
        return { success: true, alreadyNotified: true };
      }

      // Set driverArrivedAt timestamp to persist the "at store" state
      await db.update(orders).set({
        driverArrivedAt: new Date(),
      }).where(eq(orders.id, input.orderId));

      // Log to order_tracking
      await db.insert(orderTracking).values({
        orderId: input.orderId,
        status: "driver_at_store",
        notes: `Driver arrived at ${store?.name || "store"}`,
      });

      // SMS #2 / Push — Driver at Store notification
      // Strategy: Send push to customers WITH a push token (app users).
      // Send SMS to customers WITHOUT a push token (guests + web-only users).
      const baseUrl = process.env.PUBLIC_URL || 'https://weshop4u.app';
      const trackingUrl = `${baseUrl}/track/${input.orderId}`;

      if (customer && customer.pushToken && store) {
        // App user — send push notification (free)
        await sendOrderStatusNotification(
          customer.pushToken,
          input.orderId,
          "driver_at_store",
          store.name
        );
        console.log(`[Push] Driver-at-store push sent to customer ${orderRecord.customerId}`);
      } else if (store) {
        // No push token — send SMS with tracking link
        // Get phone number: guest phone or logged-in user's phone
        let smsPhone: string | null = orderRecord.guestPhone || null;
        if (!smsPhone && customer?.phone) {
          smsPhone = customer.phone;
        }
        if (smsPhone) {
          try {
            await sendDriverAtStoreSMS(smsPhone, store.name, orderRecord.orderNumber, trackingUrl);
            console.log(`[SMS] Driver-at-store SMS sent to ${smsPhone} for order ${orderRecord.orderNumber}`);
          } catch (smsError) {
            console.error(`[SMS] Failed to send driver-at-store SMS:`, smsError);
          }
        }
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

      // If delivered, check if this is part of a batch
      if (input.status === "delivered") {
        const orderResult = await db
          .select()
          .from(orders)
          .where(eq(orders.id, input.orderId))
          .limit(1);

        if (orderResult.length > 0 && orderResult[0].driverId) {
          // Increment delivery count
          const currentDriver = await db
            .select()
            .from(drivers)
            .where(eq(drivers.id, orderResult[0].driverId))
            .limit(1);

          if (currentDriver.length > 0) {
            await db
              .update(drivers)
              .set({
                totalDeliveries: (currentDriver[0].totalDeliveries || 0) + 1,
                updatedAt: new Date(),
              })
              .where(eq(drivers.id, orderResult[0].driverId));
          }

          // Check if there are remaining undelivered orders in the same batch
          const batchId = orderResult[0].batchId;
          if (batchId) {
            const remainingInBatch = await db
              .select({ id: orders.id })
              .from(orders)
              .where(
                and(
                  eq(orders.batchId, batchId),
                  sql`${orders.status} != 'delivered'`,
                  sql`${orders.status} != 'cancelled'`
                )
              );

            if (remainingInBatch.length > 0) {
              // Still more orders to deliver in this batch
              console.log(`[Batch] Order ${input.orderId} delivered, ${remainingInBatch.length} remaining in batch ${batchId}`);
              return { success: true, batchComplete: false, remainingInBatch: remainingInBatch.length };
            }
          }

          // All batch orders delivered (or single order) — mark driver available
          if (currentDriver.length > 0) {
            await db
              .update(drivers)
              .set({
                isAvailable: true,
                updatedAt: new Date(),
              })
              .where(eq(drivers.id, orderResult[0].driverId));
          }
          console.log(`[Batch] All orders in batch delivered. Driver ${orderResult[0].driverId} is now available.`);
        }
      }

      return { success: true, batchComplete: true };
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

      // Helper to get date string in Irish timezone (Europe/Dublin)
      const toIrishDateStr = (date: Date): string => {
        return date.toLocaleDateString('en-CA', { timeZone: 'Europe/Dublin' }); // returns YYYY-MM-DD
      };

      // Calculate today's stats using Irish timezone
      const todayStr = toIrishDateStr(new Date());
      const todayOrders = completedOrders.filter(order => {
        const deliveredAt = getDeliveryDate(order);
        return toIrishDateStr(deliveredAt) === todayStr;
      });
      const todayEarnings = todayOrders.reduce(
        (sum, order) => sum + parseFee(order.deliveryFee) + parseFee(order.tipAmount),
        0
      );
      const todayTips = todayOrders.reduce(
        (sum, order) => sum + parseFee(order.tipAmount),
        0
      );

      // Calculate this week's stats using Irish timezone
      // Get current day of week in Irish timezone
      const nowInIreland = new Date();
      const irishDayOfWeek = parseInt(nowInIreland.toLocaleDateString('en-US', { timeZone: 'Europe/Dublin', weekday: 'narrow' }).length > 0 
        ? new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Dublin', weekday: 'short' }).format(nowInIreland)
        : '0');
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const currentDayIdx = dayNames.indexOf(
        new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Dublin', weekday: 'short' }).format(nowInIreland)
      );
      // Build list of date strings for this week (Sunday to today) in Irish timezone
      const weekDateStrs: string[] = [];
      for (let i = currentDayIdx; i >= 0; i--) {
        const d = new Date(nowInIreland.getTime() - i * 86400000);
        weekDateStrs.push(toIrishDateStr(d));
      }
      const weekOrders = completedOrders.filter(order => {
        const deliveredAt = getDeliveryDate(order);
        return weekDateStrs.includes(toIrishDateStr(deliveredAt));
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

      // Get driver approval status
      const [driverProfile] = await db
        .select({ approvalStatus: drivers.approvalStatus })
        .from(drivers)
        .where(eq(drivers.userId, input.driverId))
        .limit(1);

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
        approvalStatus: driverProfile?.approvalStatus || "approved",
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
          if (orderCheck.length > 0 && !orderCheck[0].driverId && ["pending", "accepted", "preparing", "ready_for_pickup"].includes(orderCheck[0].status)) {
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

  // Accept an order offer (regular or batch)
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

      const isBatch = offer.isBatchOffer === true;

      // Accept the offer
      await db
        .update(orderOffers)
        .set({ status: "accepted", respondedAt: new Date() })
        .where(eq(orderOffers.id, input.offerId));

      if (isBatch) {
        // BATCH OFFER: Add this order to the driver's existing batch
        // Find the driver's current batch
        const existingBatchOrders = await db
          .select({ id: orders.id, batchId: orders.batchId, batchSequence: orders.batchSequence })
          .from(orders)
          .where(
            and(
              eq(orders.driverId, input.driverId),
              sql`${orders.status} IN ('pending', 'accepted', 'preparing', 'ready_for_pickup', 'picked_up')`
            )
          )
          .orderBy(asc(orders.batchSequence));

        // Determine batch ID — use existing or create new
        let batchId = existingBatchOrders.find(o => o.batchId)?.batchId;
        if (!batchId) {
          batchId = `BATCH-${input.driverId}-${Date.now()}`;
          // Assign batchId and sequence 1 to existing order(s)
          for (let i = 0; i < existingBatchOrders.length; i++) {
            await db
              .update(orders)
              .set({ batchId, batchSequence: i + 1 })
              .where(eq(orders.id, existingBatchOrders[i].id));
          }
        }

        const nextSequence = existingBatchOrders.length + 1;

        // Assign driver and batch info to the new order
        await db
          .update(orders)
          .set({
            driverId: input.driverId,
            driverAssignedAt: new Date(),
            batchId,
            batchSequence: nextSequence,
          })
          .where(eq(orders.id, offer.orderId));

        // Auto-sort batch by closest customer (Haversine)
        await autoSortBatchSequence(batchId);

        console.log(`[Batch] Driver ${input.driverId} accepted batch offer for order ${offer.orderId} (batch: ${batchId}, position: ${nextSequence})`);

        return { success: true, orderId: offer.orderId, isBatch: true, batchId };
      } else {
        // REGULAR OFFER: Standard single-order acceptance
        // Generate a batch ID even for single orders (makes it easy to add more later)
        const batchId = `BATCH-${input.driverId}-${Date.now()}`;

        await db
          .update(orders)
          .set({
            driverId: input.driverId,
            driverAssignedAt: new Date(),
            batchId,
            batchSequence: 1,
          })
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

        return { success: true, orderId: offer.orderId, isBatch: false, batchId };
      }
    }),

  // Decline an order offer (regular or batch)
  declineOffer: publicProcedure
    .input(z.object({ offerId: z.number(), driverId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get the offer to check if it's a batch offer
      const offerCheck = await db
        .select({ isBatchOffer: orderOffers.isBatchOffer, orderId: orderOffers.orderId })
        .from(orderOffers)
        .where(eq(orderOffers.id, input.offerId))
        .limit(1);

      const isBatch = offerCheck.length > 0 && offerCheck[0].isBatchOffer === true;

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

      if (isBatch) {
        // BATCH DECLINE: Don't take driver offline, just decline the extra order
        // The order goes back to the queue for another driver
        console.log(`[Batch] Driver ${input.driverId} declined batch offer ${input.offerId}`);
        if (offerCheck.length > 0) {
          await offerToNextDriver(offerCheck[0].orderId);
        }
        return { success: true, wentOffline: false };
      } else {
        // REGULAR DECLINE: Auto-toggle driver OFFLINE
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
        if (offerCheck.length > 0) {
          await offerToNextDriver(offerCheck[0].orderId);
        }

        return { success: true, wentOffline: true };
      }
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

      // Helper to get date string in Irish timezone (Europe/Dublin)
      const toIrishDateStr = (date: Date): string => {
        return date.toLocaleDateString('en-CA', { timeZone: 'Europe/Dublin' }); // returns YYYY-MM-DD
      };
      const toIrishDayLabel = (date: Date): string => {
        return new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Dublin', weekday: 'short' }).format(date);
      };
      const toIrishDayOfMonth = (date: Date): number => {
        return parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Dublin', day: 'numeric' }).format(date));
      };

      // Helper to get effective delivery date (use deliveredAt, fall back to createdAt)
      const getDeliveryDate = (order: any): Date => {
        if (order.deliveredAt) return new Date(order.deliveredAt);
        return new Date(order.createdAt);
      };

      // Build daily breakdown for the past 7 days using Irish timezone
      const dailyBreakdown: { date: string; dayLabel: string; earnings: number; deliveries: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        const dateStr = toIrishDateStr(d);
        const dayOrders = completedOrders.filter(o => {
          const oDate = toIrishDateStr(getDeliveryDate(o));
          return oDate === dateStr;
        });
        const dayOfMonth = toIrishDayOfMonth(d);
        dailyBreakdown.push({
          date: dateStr,
          dayLabel: i === 0 ? "Today" : i === 1 ? "Yesterday" : toIrishDayLabel(d),
          earnings: dayOrders.reduce((s, o) => s + parseFloat(o.deliveryFee) + parseFloat(o.tipAmount || "0"), 0),
          deliveries: dayOrders.length,
        });
      }

      // Today's earnings using Irish timezone
      const todayStr = toIrishDateStr(new Date());
      const todayOrders = completedOrders.filter(o => {
        const oDate = toIrishDateStr(getDeliveryDate(o));
        return oDate === todayStr;
      });
      const todayEarnings = todayOrders.reduce((s, o) => s + parseFloat(o.deliveryFee) + parseFloat(o.tipAmount || "0"), 0);
      const todayTips = todayOrders.reduce((s, o) => s + parseFloat(o.tipAmount || "0"), 0);

      // This week's earnings using Irish timezone
      const nowForWeek = new Date();
      const dayNamesForWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const currentDayIdx = dayNamesForWeek.indexOf(toIrishDayLabel(nowForWeek));
      const weekDateStrs: string[] = [];
      for (let i = currentDayIdx; i >= 0; i--) {
        const d = new Date(nowForWeek.getTime() - i * 86400000);
        weekDateStrs.push(toIrishDateStr(d));
      }
      const weekOrders = completedOrders.filter(o => {
        const oDate = toIrishDateStr(getDeliveryDate(o));
        return weekDateStrs.includes(oDate);
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

      // --- "Driver is nearby" proximity notification ---
      // Check all active orders for this driver that are picked_up or on_the_way
      try {
        const activeOrders = await db
          .select({
            id: orders.id,
            orderNumber: orders.orderNumber,
            customerId: orders.customerId,
            deliveryLatitude: orders.deliveryLatitude,
            deliveryLongitude: orders.deliveryLongitude,
            status: orders.status,
          })
          .from(orders)
          .where(
            and(
              eq(orders.driverId, input.driverId),
              inArray(orders.status, ["picked_up", "on_the_way"])
            )
          );

        for (const order of activeOrders) {
          if (!order.deliveryLatitude || !order.deliveryLongitude) continue;

          const delLat = parseFloat(order.deliveryLatitude);
          const delLng = parseFloat(order.deliveryLongitude);
          if (isNaN(delLat) || isNaN(delLng)) continue;

          // Haversine distance calculation
          const R = 6371000; // Earth radius in metres
          const dLat = ((delLat - input.latitude) * Math.PI) / 180;
          const dLng = ((delLng - input.longitude) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((input.latitude * Math.PI) / 180) *
              Math.cos((delLat * Math.PI) / 180) *
              Math.sin(dLng / 2) *
              Math.sin(dLng / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distanceMetres = R * c;

          // If within 500m, check if we already sent this notification
          if (distanceMetres <= 500) {
            // Check if we already sent a nearby notification for this order
            const existingNotif = await db
              .select({ id: orderTracking.id })
              .from(orderTracking)
              .where(
                and(
                  eq(orderTracking.orderId, order.id),
                  eq(orderTracking.status, "driver_nearby_notified")
                )
              )
              .limit(1);

            if (existingNotif.length === 0) {
              // Mark as notified so we don't send again
              await db.insert(orderTracking).values({
                orderId: order.id,
                status: "driver_nearby_notified",
                latitude: String(input.latitude),
                longitude: String(input.longitude),
              });

              // Get customer push token
              if (order.customerId) {
                const [customer] = await db
                  .select({ pushToken: users.pushToken, name: users.name })
                  .from(users)
                  .where(eq(users.id, order.customerId))
                  .limit(1);

                if (customer?.pushToken) {
                  const distanceDisplay = distanceMetres < 100
                    ? "less than 100m"
                    : `about ${Math.round(distanceMetres / 100) * 100}m`;

                  await sendPushNotification(customer.pushToken, {
                    title: "🚗 Your driver is nearby!",
                    body: `Your driver is ${distanceDisplay} away. Get ready for your delivery!`,
                    data: {
                      type: "driver_nearby",
                      orderId: order.id,
                      orderNumber: order.orderNumber || `#${order.id}`,
                    },
                    channelId: "orders",
                  });
                  console.log(`[Proximity] Sent nearby notification for order ${order.id} (${Math.round(distanceMetres)}m)`);
                }
              }
            }
          }
        }
      } catch (proximityError) {
        // Don't fail the location update if proximity check fails
        console.error("[Proximity] Error checking driver proximity:", proximityError);
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

  // Get all active orders in a driver's current batch
  getActiveBatch: publicProcedure
    .input(z.object({ driverId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get all non-delivered orders assigned to this driver
      const activeOrders = await db
        .select()
        .from(orders)
        .leftJoin(stores, eq(orders.storeId, stores.id))
        .leftJoin(users, eq(orders.customerId, users.id))
        .where(
          and(
            eq(orders.driverId, input.driverId),
            inArray(orders.status, ["pending", "accepted", "preparing", "ready_for_pickup", "picked_up", "on_the_way"])
          )
        )
        .orderBy(asc(orders.batchSequence));

      if (activeOrders.length === 0) return { orders: [], batchId: null };

      // Get items for each order
      const ordersWithItems = await Promise.all(
        activeOrders.map(async (row) => {
          const items = await db
            .select()
            .from(orderItems)
            .where(eq(orderItems.orderId, row.orders.id));
          return {
            ...row.orders,
            store: row.stores,
            customer: row.users,
            items,
          };
        })
      );

      return {
        orders: ordersWithItems,
        batchId: ordersWithItems[0]?.batchId || null,
        batchSize: ordersWithItems.length,
      };
    }),

  // Get pending batch offer for a driver (extra same-store order)
  getBatchOffer: publicProcedure
    .input(z.object({ driverId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const pendingBatchOffer = await db
        .select()
        .from(orderOffers)
        .where(
          and(
            eq(orderOffers.driverId, input.driverId),
            eq(orderOffers.status, "pending"),
            eq(orderOffers.isBatchOffer, true),
            gte(orderOffers.expiresAt, new Date())
          )
        )
        .orderBy(desc(orderOffers.offeredAt))
        .limit(1);

      if (pendingBatchOffer.length === 0) return null;

      const offer = pendingBatchOffer[0];

      // Get order details
      const orderResult = await db
        .select()
        .from(orders)
        .leftJoin(stores, eq(orders.storeId, stores.id))
        .where(eq(orders.id, offer.orderId))
        .limit(1);

      if (orderResult.length === 0) return null;

      // Count current batch size
      const currentBatch = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(orders)
        .where(
          and(
            eq(orders.driverId, input.driverId),
            inArray(orders.status, ["pending", "accepted", "preparing", "ready_for_pickup", "picked_up"])
          )
        );

      return {
        offerId: offer.id,
        orderId: offer.orderId,
        storeName: orderResult[0].stores?.name || "Store",
        orderNumber: orderResult[0].orders.orderNumber,
        deliveryAddress: orderResult[0].orders.deliveryAddress,
        expiresAt: offer.expiresAt.toISOString(),
        currentBatchSize: Number(currentBatch[0]?.count || 0),
        newBatchSize: Number(currentBatch[0]?.count || 0) + 1,
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

  // End shift - driver signals they're done for the day
  // Creates a shift record with settlement calculation
  endShift: publicProcedure
    .input(z.object({ driverId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Find the last active shift or the last ended shift's endedAt to determine shift start
      const lastShift = await db
        .select()
        .from(driverShifts)
        .where(eq(driverShifts.driverId, input.driverId))
        .orderBy(desc(driverShifts.createdAt))
        .limit(1);

      // Shift start = last shift's endedAt, or beginning of today if no previous shift
      let shiftStart: Date;
      if (lastShift.length > 0 && lastShift[0].endedAt) {
        shiftStart = new Date(lastShift[0].endedAt);
      } else if (lastShift.length > 0 && lastShift[0].status === "active") {
        // There's already an active shift - end it and recalculate
        shiftStart = new Date(lastShift[0].startedAt);
      } else {
        // No previous shift - use start of today
        shiftStart = new Date();
        shiftStart.setHours(0, 0, 0, 0);
      }

      const now = new Date();

      // Get all delivered orders for this driver since shift start
      const shiftOrders = await db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          deliveryFee: orders.deliveryFee,
          tipAmount: orders.tipAmount,
          paymentMethod: orders.paymentMethod,
          total: orders.total,
          deliveredAt: orders.deliveredAt,
          storeName: stores.name,
        })
        .from(orders)
        .leftJoin(stores, eq(orders.storeId, stores.id))
        .where(
          and(
            eq(orders.driverId, input.driverId),
            eq(orders.status, "delivered"),
            gte(orders.deliveredAt, shiftStart)
          )
        )
        .orderBy(asc(orders.deliveredAt));

      // Calculate settlement
      let cashCollected = 0; // Total cash collected from cash_on_delivery orders
      let deliveryFeesEarned = 0; // Sum of all delivery fees (driver's base pay)
      let cardTipsEarned = 0; // Tips from card orders (tracked, paid to driver)

      for (const order of shiftOrders) {
        const fee = parseFloat(order.deliveryFee || "0");
        const tip = parseFloat(order.tipAmount || "0");
        const total = parseFloat(order.total || "0");

        deliveryFeesEarned += fee;

        if (order.paymentMethod === "cash_on_delivery") {
          // Driver collected the full order total in cash
          cashCollected += total;
          // Cash tips are invisible - driver keeps them, not tracked
        } else {
          // Card payment - tip is tracked and owed to driver
          cardTipsEarned += tip;
        }
      }

      // Net owed: positive = driver owes admin, negative = admin owes driver
      // Driver collected cash, but earned delivery fees + card tips
      // So driver owes: cashCollected - (deliveryFeesEarned + cardTipsEarned)
      const netOwed = Math.round((cashCollected - (deliveryFeesEarned + cardTipsEarned)) * 100) / 100;

      // If there's an active shift, update it; otherwise create new
      if (lastShift.length > 0 && lastShift[0].status === "active") {
        await db
          .update(driverShifts)
          .set({
            endedAt: now,
            status: "ended",
            totalJobs: shiftOrders.length,
            cashCollected: cashCollected.toFixed(2),
            deliveryFeesEarned: deliveryFeesEarned.toFixed(2),
            cardTipsEarned: cardTipsEarned.toFixed(2),
            netOwed: netOwed.toFixed(2),
          })
          .where(eq(driverShifts.id, lastShift[0].id));
      } else {
        await db.insert(driverShifts).values({
          driverId: input.driverId,
          startedAt: shiftStart,
          endedAt: now,
          status: "ended",
          totalJobs: shiftOrders.length,
          cashCollected: cashCollected.toFixed(2),
          deliveryFeesEarned: deliveryFeesEarned.toFixed(2),
          cardTipsEarned: cardTipsEarned.toFixed(2),
          netOwed: netOwed.toFixed(2),
        });
      }

      // Also set driver offline
      await db
        .update(drivers)
        .set({ isOnline: false, isAvailable: false, updatedAt: now })
        .where(eq(drivers.userId, input.driverId));

      // Remove from queue
      await db.delete(driverQueue).where(eq(driverQueue.driverId, input.driverId));

      // Expire any pending offers
      await db
        .update(orderOffers)
        .set({ status: "expired", respondedAt: now })
        .where(
          and(
            eq(orderOffers.driverId, input.driverId),
            eq(orderOffers.status, "pending")
          )
        );

      console.log(`[Shift] Driver ${input.driverId} ended shift: ${shiftOrders.length} jobs, cash €${cashCollected.toFixed(2)}, fees €${deliveryFeesEarned.toFixed(2)}, card tips €${cardTipsEarned.toFixed(2)}, net owed €${netOwed.toFixed(2)}`);

      return {
        success: true,
        summary: {
          shiftStart: shiftStart.toISOString(),
          shiftEnd: now.toISOString(),
          totalJobs: shiftOrders.length,
          cashCollected: Math.round(cashCollected * 100) / 100,
          deliveryFeesEarned: Math.round(deliveryFeesEarned * 100) / 100,
          cardTipsEarned: Math.round(cardTipsEarned * 100) / 100,
          netOwed: Math.round(netOwed * 100) / 100,
          orders: shiftOrders.map(o => ({
            id: o.id,
            orderNumber: o.orderNumber,
            storeName: o.storeName || "Store",
            deliveryFee: parseFloat(o.deliveryFee || "0"),
            tipAmount: parseFloat(o.tipAmount || "0"),
            paymentMethod: o.paymentMethod,
            total: parseFloat(o.total || "0"),
            deliveredAt: o.deliveredAt?.toISOString() || "",
          })),
        },
      };
    }),

  // Get shift summary for driver (current unsettled balance + recent shifts)
  getShiftSummary: publicProcedure
    .input(z.object({ driverId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get all unsettled shifts
      const unsettledShifts = await db
        .select()
        .from(driverShifts)
        .where(
          and(
            eq(driverShifts.driverId, input.driverId),
            eq(driverShifts.status, "ended"),
            sql`${driverShifts.settledAt} IS NULL`
          )
        )
        .orderBy(desc(driverShifts.endedAt));

      // Calculate total unsettled balance
      const totalUnsettled = unsettledShifts.reduce(
        (sum, s) => sum + parseFloat(s.netOwed || "0"),
        0
      );

      // Get recent settled shifts (last 10)
      const recentSettled = await db
        .select()
        .from(driverShifts)
        .where(
          and(
            eq(driverShifts.driverId, input.driverId),
            sql`${driverShifts.settledAt} IS NOT NULL`
          )
        )
        .orderBy(desc(driverShifts.settledAt))
        .limit(10);

      return {
        unsettledBalance: Math.round(totalUnsettled * 100) / 100,
        unsettledShifts: unsettledShifts.map(s => ({
          id: s.id,
          startedAt: s.startedAt.toISOString(),
          endedAt: s.endedAt?.toISOString() || "",
          totalJobs: s.totalJobs || 0,
          cashCollected: parseFloat(s.cashCollected || "0"),
          deliveryFeesEarned: parseFloat(s.deliveryFeesEarned || "0"),
          cardTipsEarned: parseFloat(s.cardTipsEarned || "0"),
          netOwed: parseFloat(s.netOwed || "0"),
        })),
        recentSettled: recentSettled.map(s => ({
          id: s.id,
          startedAt: s.startedAt.toISOString(),
          endedAt: s.endedAt?.toISOString() || "",
          totalJobs: s.totalJobs || 0,
          netOwed: parseFloat(s.netOwed || "0"),
          settledAt: s.settledAt?.toISOString() || "",
        })),
      };
    }),

  // Driver reorder batch delivery sequence
  reorderBatch: publicProcedure
    .input(
      z.object({
        driverId: z.number(),
        batchId: z.string(),
        orderSequence: z.array(z.object({ orderId: z.number(), sequence: z.number() })),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify all orders belong to this driver
      for (const item of input.orderSequence) {
        const [order] = await db
          .select({ id: orders.id, driverId: orders.driverId })
          .from(orders)
          .where(and(eq(orders.id, item.orderId), eq(orders.batchId, input.batchId)))
          .limit(1);
        if (!order || order.driverId !== input.driverId) {
          throw new Error(`Order ${item.orderId} does not belong to this driver's batch`);
        }
      }

      for (const item of input.orderSequence) {
        await db
          .update(orders)
          .set({ batchSequence: item.sequence })
          .where(and(eq(orders.id, item.orderId), eq(orders.batchId, input.batchId)));
      }

      console.log(`[Driver] Reordered batch ${input.batchId}: ${input.orderSequence.map(o => `#${o.orderId}→${o.sequence}`).join(", ")}`);
      return { success: true };
    }),
});
