import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { orders, orderItems, products, stores, users, productCategories } from "../../drizzle/schema";
import { eq, and, or, like, inArray } from "drizzle-orm";
import { storeStaff } from "../../drizzle/schema";
import { sendOrderStatusNotification, sendOrderReadyNotification } from "../services/notifications";

export const storeRouter = router({
  // Get all orders for a specific store
  getOrders: publicProcedure
    .input(
      z.object({
        storeId: z.number(),
        status: z.enum(["pending", "preparing", "ready_for_pickup", "all"]).optional().default("all"),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      let query = db
        .select()
        .from(orders)
        .where(eq(orders.storeId, input.storeId));

      // Filter by status if not "all"
      if (input.status !== "all") {
        query = db
          .select()
          .from(orders)
          .where(
            and(
              eq(orders.storeId, input.storeId),
              eq(orders.status, input.status)
            )
          );
      }

      const storeOrders = await query;

      // Get order items for each order
      const ordersWithItems = await Promise.all(
        storeOrders.map(async (order) => {
          const items = await db
            .select()
            .from(orderItems)
            .leftJoin(products, eq(orderItems.productId, products.id))
            .where(eq(orderItems.orderId, order.id));

          return {
            ...order,
            items: items.map(item => ({
              ...item.order_items,
              product: item.products,
            })),
          };
        })
      );

      return ordersWithItems;
    }),

  // Get orders with deli items only (for deli view)
  getDeliOrders: publicProcedure
    .input(
      z.object({
        storeId: z.number(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Get all active orders for this store
      const storeOrders = await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.storeId, input.storeId),
            or(
              eq(orders.status, "preparing"),
              eq(orders.status, "ready_for_pickup")
            )
          )
        );

      // Get order items and filter for deli items
      const ordersWithDeliItems = await Promise.all(
        storeOrders.map(async (order) => {
          const items = await db
            .select()
            .from(orderItems)
            .leftJoin(products, eq(orderItems.productId, products.id))
            .where(eq(orderItems.orderId, order.id));

          // Find deli category IDs dynamically
          const deliCategories = await db
            .select({ id: productCategories.id })
            .from(productCategories)
            .where(like(productCategories.name, '%Deli%'));
          const deliCategoryIds = deliCategories.map(c => c.id);

          // Filter for deli category items
          const deliItems = items.filter(item =>
            item.products?.categoryId != null && deliCategoryIds.includes(item.products.categoryId)
          );

          if (deliItems.length === 0) {
            return null; // Skip orders with no deli items
          }

          return {
            ...order,
            deliItems: deliItems.map(item => ({
              ...item.order_items,
              product: item.products,
            })),
            otherItemsCount: items.length - deliItems.length,
          };
        })
      );

      // Filter out null values (orders with no deli items)
      return ordersWithDeliItems.filter(order => order !== null);
    }),

  // Accept an order
  acceptOrder: publicProcedure
    .input(
      z.object({
        orderId: z.number(),
        storeId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Verify order belongs to this store
      const orderResult = await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.id, input.orderId),
            eq(orders.storeId, input.storeId),
            eq(orders.status, "pending")
          )
        )
        .limit(1);

      if (orderResult.length === 0) {
        throw new Error("Order not found or already accepted");
      }

      // Update order status to preparing
      await db
        .update(orders)
        .set({
          status: "preparing",
          acceptedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(orders.id, input.orderId));

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
          .where(eq(stores.id, input.storeId))
          .limit(1);

        const storeName = store.length > 0 ? store[0].name : "Store";

        await sendOrderStatusNotification(
          customer[0].pushToken,
          input.orderId,
          "accepted",
          storeName
        );
        }
      }

      return { success: true };
    }),

  // Reject an order
  rejectOrder: publicProcedure
    .input(
      z.object({
        orderId: z.number(),
        storeId: z.number(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Verify order belongs to this store
      const orderResult = await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.id, input.orderId),
            eq(orders.storeId, input.storeId),
            eq(orders.status, "pending")
          )
        )
        .limit(1);

      if (orderResult.length === 0) {
        throw new Error("Order not found or cannot be rejected");
      }

      // Update order status to cancelled
      await db
        .update(orders)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
          cancellationReason: input.reason || "Rejected by store",
          updatedAt: new Date(),
        })
        .where(eq(orders.id, input.orderId));

      return { success: true };
    }),

  // Mark order as ready for pickup
  markOrderReady: publicProcedure
    .input(
      z.object({
        orderId: z.number(),
        storeId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Verify order belongs to this store
      const orderResult = await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.id, input.orderId),
            eq(orders.storeId, input.storeId),
            eq(orders.status, "preparing")
          )
        )
        .limit(1);

      if (orderResult.length === 0) {
        throw new Error("Order not found or not in preparing status");
      }

      // Update order status to ready_for_pickup
      await db
        .update(orders)
        .set({
          status: "ready_for_pickup",
          updatedAt: new Date(),
        })
        .where(eq(orders.id, input.orderId));

      // TODO: Notify available drivers about this order

      return { success: true };
    }),

  // Mark individual deli item as ready (for deli view)
  markDeliItemReady: publicProcedure
    .input(
      z.object({
        orderItemId: z.number(),
        orderId: z.number(),
        storeId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Verify order belongs to this store
      const orderResult = await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.id, input.orderId),
            eq(orders.storeId, input.storeId)
          )
        )
        .limit(1);

      if (orderResult.length === 0) {
        throw new Error("Order not found");
      }

      // Note: We don't have an "isReady" field in order_items table yet
      // For MVP, we'll just return success and handle this in frontend state
      // In production, you'd want to add a "status" or "isReady" field to order_items

      return { success: true };
    }),

  // Update store opening hours (for store staff)
  updateOpeningHours: publicProcedure
    .input(
      z.object({
        storeId: z.number(),
        userId: z.number(),
        openingHours: z.record(
          z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]),
          z.object({
            open: z.string().nullable(),
            close: z.string().nullable(),
          }).nullable()
        ),
        isOpen247: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Verify user is staff for this store
      const staffCheck = await db
        .select()
        .from(storeStaff)
        .where(
          and(
            eq(storeStaff.userId, input.userId),
            eq(storeStaff.storeId, input.storeId)
          )
        )
        .limit(1);

      if (staffCheck.length === 0) {
        throw new Error("You are not authorized to update this store's hours");
      }

      // Update store opening hours
      const updateData: any = {
        openingHours: JSON.stringify(input.openingHours),
        updatedAt: new Date(),
      };

      if (input.isOpen247 !== undefined) {
        updateData.isOpen247 = input.isOpen247;
      }

      await db
        .update(stores)
        .set(updateData)
        .where(eq(stores.id, input.storeId));

      return { success: true };
    }),

  // Get store statistics
  getStats: publicProcedure
    .input(
      z.object({
        storeId: z.number(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Get all orders for this store
      const allOrders = await db
        .select()
        .from(orders)
        .where(eq(orders.storeId, input.storeId));

      // Calculate statistics
      const pendingOrders = allOrders.filter(o => o.status === "pending").length;
      const preparingOrders = allOrders.filter(o => o.status === "preparing").length;
      const completedOrders = allOrders.filter(o => o.status === "delivered").length;

      const totalRevenue = allOrders
        .filter(o => o.status === "delivered")
        .reduce((sum, order) => sum + parseFloat(order.subtotal), 0);

      return {
        pendingOrders,
        preparingOrders,
        completedOrders,
        totalRevenue,
      };
    }),
});
