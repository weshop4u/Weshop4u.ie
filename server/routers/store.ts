import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { orders, orderItems, products, stores, users, productCategories, orderTracking, drivers, orderItemModifiers } from "../../drizzle/schema";
import { eq, and, or, like, inArray, desc } from "drizzle-orm";
import { storeStaff } from "../../drizzle/schema";
import { sendOrderStatusNotification, sendOrderReadyNotification } from "../services/notifications";
// autoCreatePrintJob removed - printing is now manual only via Print Pick List button

export const storeRouter = router({
  // Get the store linked to the current staff user
  getMyStore: publicProcedure
    .input(
      z.object({
        userId: z.number(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      const staffLink = await db
        .select({
          storeId: storeStaff.storeId,
          role: storeStaff.role,
        })
        .from(storeStaff)
        .where(eq(storeStaff.userId, input.userId))
        .limit(1);

      if (staffLink.length === 0) {
        return null;
      }

      const store = await db
        .select()
        .from(stores)
        .where(eq(stores.id, staffLink[0].storeId))
        .limit(1);

      if (store.length === 0) {
        return null;
      }

      return {
        storeId: store[0].id,
        storeName: store[0].name,
        staffRole: staffLink[0].role,
      };
    }),

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

          // Get tracking events for this order (for driver_at_store detection)
          const tracking = await db
            .select()
            .from(orderTracking)
            .where(eq(orderTracking.orderId, order.id))
            .orderBy(desc(orderTracking.createdAt));

          // Get driver display number if assigned
          let driverName: string | null = null;
          if (order.driverId) {
            const driverResult = await db
              .select({ displayNumber: drivers.displayNumber })
              .from(drivers)
              .where(eq(drivers.userId, order.driverId))
              .limit(1);
            if (driverResult.length > 0 && driverResult[0].displayNumber) {
              driverName = `Driver ${driverResult[0].displayNumber}`;
            } else {
              driverName = "Driver";
            }
          }

          // Get customer name and phone
          let customerName: string | null = null;
          let customerPhone: string | null = null;
          if (order.customerId) {
            const customerResult = await db
              .select({ name: users.name, phone: users.phone })
              .from(users)
              .where(eq(users.id, order.customerId))
              .limit(1);
            if (customerResult.length > 0) {
              customerName = customerResult[0].name;
              customerPhone = customerResult[0].phone;
            }
          }

          // Fetch modifiers for all items in this order
          const itemIds = items.map(i => i.order_items.id).filter(Boolean);
          let modifiersMap: Record<number, { groupName: string | null; modifierName: string; modifierPrice: string | null }[]> = {};
          if (itemIds.length > 0) {
            const allMods = await db
              .select({
                orderItemId: orderItemModifiers.orderItemId,
                groupName: orderItemModifiers.groupName,
                modifierName: orderItemModifiers.modifierName,
                modifierPrice: orderItemModifiers.modifierPrice,
              })
              .from(orderItemModifiers)
              .where(inArray(orderItemModifiers.orderItemId, itemIds));
            for (const m of allMods) {
              if (!modifiersMap[m.orderItemId]) modifiersMap[m.orderItemId] = [];
              modifiersMap[m.orderItemId].push({ groupName: m.groupName, modifierName: m.modifierName, modifierPrice: m.modifierPrice });
            }
          }

          return {
            ...order,
            driverName,
            customerName,
            customerPhone,
            items: items.map(item => ({
              ...item.order_items,
              product: item.products,
              modifiers: modifiersMap[item.order_items.id] || [],
            })),
            tracking: tracking.map(t => ({
              status: t.status,
              createdAt: t.createdAt,
              notes: t.notes,
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

          // Fetch modifiers for deli items
          const deliItemIds = deliItems.map(item => item.order_items.id);
          let itemModsMap: Record<number, { groupName: string; modifierName: string; modifierPrice: string }[]> = {};
          if (deliItemIds.length > 0) {
            const mods = await db
              .select({
                orderItemId: orderItemModifiers.orderItemId,
                groupName: orderItemModifiers.groupName,
                modifierName: orderItemModifiers.modifierName,
                modifierPrice: orderItemModifiers.modifierPrice,
              })
              .from(orderItemModifiers)
              .where(inArray(orderItemModifiers.orderItemId, deliItemIds));
            for (const m of mods) {
              if (!itemModsMap[m.orderItemId]) itemModsMap[m.orderItemId] = [];
              itemModsMap[m.orderItemId].push(m);
            }
          }

          return {
            ...order,
            deliItems: deliItems.map(item => ({
              ...item.order_items,
              product: item.products,
              modifiers: itemModsMap[item.order_items.id] || [],
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

      // Print job is now manual only - staff presses "Print Pick List" button

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

  // ===== PRODUCT MANAGEMENT =====

  // Get all products for a store
  getProducts: publicProcedure
    .input(z.object({ storeId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const result = await db
        .select({
          id: products.id,
          name: products.name,
          description: products.description,
          price: products.price,
          salePrice: products.salePrice,
          stockStatus: products.stockStatus,
          isActive: products.isActive,
          categoryId: products.categoryId,
          categoryName: productCategories.name,
          quantity: products.quantity,
          sku: products.sku,
          barcode: products.barcode,
          createdAt: products.createdAt,
        })
        .from(products)
        .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
        .where(eq(products.storeId, input.storeId))
        .orderBy(products.name);

      return result;
    }),

  // Get categories for a store
  getCategories: publicProcedure
    .input(z.object({ storeId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Categories are global (no storeId), but we can filter by which categories have products in this store
      // For now return all categories so store can assign any category
      const result = await db
        .select()
        .from(productCategories)
        .orderBy(productCategories.name);

      return result;
    }),

  // Add a new product
  addProduct: publicProcedure
    .input(z.object({
      storeId: z.number(),
      name: z.string().min(1),
      description: z.string().optional(),
      price: z.string(),
      categoryId: z.number().optional(),
      stockStatus: z.enum(["in_stock", "out_of_stock", "low_stock"]).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const result = await db.insert(products).values({
        storeId: input.storeId,
        name: input.name,
        description: input.description || null,
        price: input.price,
        categoryId: input.categoryId || null,
        stockStatus: input.stockStatus || "in_stock",
        isActive: input.isActive ?? true,
      });

      return { id: Number(result[0].insertId), success: true };
    }),

  // Update a product
  updateProduct: publicProcedure
    .input(z.object({
      productId: z.number(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      price: z.string().optional(),
      categoryId: z.number().nullable().optional(),
      stockStatus: z.enum(["in_stock", "out_of_stock", "low_stock"]).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const updates: Record<string, any> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (input.price !== undefined) updates.price = input.price;
      if (input.categoryId !== undefined) updates.categoryId = input.categoryId;
      if (input.stockStatus !== undefined) updates.stockStatus = input.stockStatus;
      if (input.isActive !== undefined) updates.isActive = input.isActive;

      await db.update(products).set(updates).where(eq(products.id, input.productId));

      return { success: true };
    }),

  // Delete a product
  deleteProduct: publicProcedure
    .input(z.object({ productId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Soft delete - mark as inactive
      await db.update(products).set({ isActive: false }).where(eq(products.id, input.productId));

      return { success: true };
    }),

  // Toggle product availability
  toggleProductStock: publicProcedure
    .input(z.object({
      productId: z.number(),
      stockStatus: z.enum(["in_stock", "out_of_stock", "low_stock"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.update(products)
        .set({ stockStatus: input.stockStatus })
        .where(eq(products.id, input.productId));

      return { success: true };
    }),

  // Add a new category
  addCategory: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Generate slug from name
      const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

      const result = await db.insert(productCategories).values({
        name: input.name,
        slug,
        description: input.description || null,
      });

      return { id: Number(result[0].insertId), success: true };
    }),
});
