import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { drivers, orders, orderItems, products, stores, users } from "../../drizzle/schema";
import { eq, and, or, isNull } from "drizzle-orm";
import { sendOrderStatusNotification, sendJobOfferNotification } from "../services/notifications";

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

      await db
        .update(drivers)
        .set({
          isOnline: input.isOnline,
          isAvailable: input.isOnline, // When going online, also set available
          updatedAt: new Date(),
        })
        .where(eq(drivers.id, input.driverId));

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

      const driverResult = await db
        .select()
        .from(drivers)
        .leftJoin(users, eq(drivers.userId, users.id))
        .where(eq(drivers.id, input.driverId))
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

      // Calculate today's stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayOrders = completedOrders.filter(order => {
        const deliveredAt = order.deliveredAt ? new Date(order.deliveredAt) : null;
        return deliveredAt && deliveredAt >= today;
      });
      const todayEarnings = todayOrders.reduce(
        (sum, order) => sum + parseFloat(order.deliveryFee),
        0
      );

      // Calculate this week's stats
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week (Sunday)
      weekStart.setHours(0, 0, 0, 0);
      const weekOrders = completedOrders.filter(order => {
        const deliveredAt = order.deliveredAt ? new Date(order.deliveredAt) : null;
        return deliveredAt && deliveredAt >= weekStart;
      });
      const weekEarnings = weekOrders.reduce(
        (sum, order) => sum + parseFloat(order.deliveryFee),
        0
      );

      // Total stats
      const totalEarnings = completedOrders.reduce(
        (sum, order) => sum + parseFloat(order.deliveryFee),
        0
      );

      return {
        todayEarnings,
        todayDeliveries: todayOrders.length,
        weekEarnings,
        weekDeliveries: weekOrders.length,
        totalEarnings,
        totalDeliveries: completedOrders.length,
      };
    }),

  // Get driver earnings
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

      // Calculate earnings
      const totalEarnings = completedOrders.reduce(
        (sum, order) => sum + parseFloat(order.deliveryFee),
        0
      );

      return {
        totalEarnings,
        totalDeliveries: completedOrders.length,
        averagePerDelivery: completedOrders.length > 0 
          ? totalEarnings / completedOrders.length 
          : 0,
        recentDeliveries: completedOrders.slice(0, 10).map(order => ({
          id: order.id,
          orderNumber: order.orderNumber,
          amount: parseFloat(order.deliveryFee),
          completedAt: order.deliveredAt,
        })),
      };
    }),
});
