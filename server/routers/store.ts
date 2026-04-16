import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { orders, orderItems, products, stores, users, productCategories, orderTracking, drivers, orderItemModifiers } from "../../drizzle/schema";
import { eq, and, or, like, inArray, desc, sql, gte } from "drizzle-orm";
import { storeStaff } from "../../drizzle/schema";
import { sendOrderStatusNotification, sendOrderReadyNotification } from "../services/notifications";
import { autoCreatePrintJob } from "./print";

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
        storeCategory: store[0].category,
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
        .where(eq(orders.storeId, input.storeId));

      // Filter by status if not "all"
      if (input.status !== "all") {
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
              eq(orders.storeId, input.storeId),
              eq(orders.status, input.status)
            )
          );
      }

      const storeOrders = await query;

      // Get order items for each order
      const ordersWithItems = await Promise.all(
        storeOrders.map(async (order) => {
          let items = await db
            .select()
            .from(orderItems)
            .leftJoin(products, eq(orderItems.productId, products.id))
            .where(eq(orderItems.orderId, order.id));

          // If order has receiptData with WSS items, use store receipt items instead
          if (order.receiptData) {
            try {
              const receiptData = JSON.parse(order.receiptData);
              console.log(`[getOrders] Order ${order.id} hasWssItems:`, receiptData.hasWssItems);
              if (receiptData.hasWssItems && receiptData.storeReceipt?.items) {
                // Map store receipt items back to the orderItems structure
                const storeItems = receiptData.storeReceipt.items;
                console.log(`[getOrders] Filtering items. Before: ${items.length}, Store items: ${storeItems.length}`);
                items = items.filter(item => 
                  storeItems.some(si => si.id === item.order_items.productId)
                );
                console.log(`[getOrders] After filtering: ${items.length}`);
              }
            } catch (e) {
              console.error(`Failed to parse receiptData for order ${order.id}:`, e);
            }
          }

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

          // If order has receiptData with WSS items, use store receipt totals
          let orderData = { ...order };
          if (order.receiptData) {
            try {
              const receiptData = JSON.parse(order.receiptData);
              if (receiptData.hasWssItems && receiptData.storeReceipt) {
                orderData.subtotal = receiptData.storeReceipt.subtotal.toString();
                orderData.serviceFee = receiptData.storeReceipt.serviceFee.toString();
                orderData.deliveryFee = receiptData.storeReceipt.deliveryFee.toString();
                orderData.total = receiptData.storeReceipt.total.toString();
              }
            } catch (e) {
              console.error(`Failed to parse receiptData for order ${order.id}:`, e);
            }
          }

          return {
            ...orderData,
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

      // Auto-create print job so POS prints receipt immediately on accept
      await autoCreatePrintJob(input.orderId, input.storeId);

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
          images: products.images,
          isDrs: products.isDrs,
          sortOrder: products.sortOrder,
          priceVerified: products.priceVerified,
          createdAt: products.createdAt,
        })
        .from(products)
        .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
        .where(eq(products.storeId, input.storeId))
        .orderBy(products.name);

      return result;
    }),

  // Reorder products within a category
  reorderProducts: publicProcedure
    .input(z.object({
      productIds: z.array(z.number()), // ordered list of product IDs
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Update sort_order for each product based on its position in the array
      await Promise.all(
        input.productIds.map((productId, index) =>
          db.update(products)
            .set({ sortOrder: index + 1 })
            .where(eq(products.id, productId))
        )
      );

      return { success: true };
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
      pinnedToTrending: z.boolean().optional(),
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
        pinnedToTrending: input.pinnedToTrending ?? false,
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
      pinnedToTrending: z.boolean().optional(),
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
      if (input.pinnedToTrending !== undefined) updates.pinnedToTrending = input.pinnedToTrending;

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

  // Get trending products for a store based on order frequency
  getTrendingProducts: publicProcedure
    .input(z.object({ storeId: z.number(), limit: z.number().optional().default(10) }).strict())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // 1. Get pinned products for this store (always shown first)
      const pinnedProducts = await db
        .select({
          id: products.id,
          name: products.name,
          price: products.price,
          images: products.images,
          description: products.description,
          stockStatus: products.stockStatus,
          categoryId: products.categoryId,
          pinnedToTrending: products.pinnedToTrending,
        })
        .from(products)
        .where(
          and(
            eq(products.storeId, input.storeId),
            eq(products.pinnedToTrending, true),
            eq(products.isActive, true),
            sql`${products.stockStatus} != 'out_of_stock'`
          )
        );

      const pinnedIds = pinnedProducts.map((p) => p.id);
      const remainingSlots = Math.max(0, input.limit - pinnedProducts.length);

      // 2. Get auto-trending products (by order frequency, excluding pinned ones)
      let autoTrending: Array<{ id: number; name: string; price: string; images: string | null; description: string | null; stockStatus: string; categoryId: number | null; orderCount: number }> = [];

      if (remainingSlots > 0) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const trending = await db
          .select({
            productId: orderItems.productId,
            productName: orderItems.productName,
            orderCount: sql<number>`CAST(SUM(${orderItems.quantity}) AS UNSIGNED)`.as("order_count"),
          })
          .from(orderItems)
          .innerJoin(orders, eq(orderItems.orderId, orders.id))
          .where(
            and(
              eq(orders.storeId, input.storeId),
              gte(orders.createdAt, thirtyDaysAgo),
              sql`${orders.status} != 'cancelled'`
            )
          )
          .groupBy(orderItems.productId, orderItems.productName)
          .orderBy(sql`order_count DESC`)
          .limit(remainingSlots + pinnedIds.length); // fetch extra to filter out pinned

        if (trending.length > 0) {
          // Filter out pinned products from auto-trending
          const filteredTrending = trending.filter((t) => !pinnedIds.includes(t.productId)).slice(0, remainingSlots);
          const trendingProductIds = filteredTrending.map((t) => t.productId);

          if (trendingProductIds.length > 0) {
            const trendingDetails = await db
              .select({
                id: products.id,
                name: products.name,
                price: products.price,
                images: products.images,
                description: products.description,
                stockStatus: products.stockStatus,
                categoryId: products.categoryId,
              })
              .from(products)
              .where(inArray(products.id, trendingProductIds));

            const detailMap = Object.fromEntries(trendingDetails.map((p) => [p.id, p]));
            autoTrending = filteredTrending
              .filter((t) => detailMap[t.productId])
              .map((t) => {
                const p = detailMap[t.productId];
                return { ...p, orderCount: Number(t.orderCount) };
              });
          }
        }
      }

      // 3. Combine: pinned first, then auto-trending
      const allProducts = [
        ...pinnedProducts.map((p) => ({ ...p, orderCount: 0, isPinned: true })),
        ...autoTrending.map((p) => ({ ...p, isPinned: false })),
      ];

      // Get category names for all products
      const catIds = [...new Set(allProducts.map((p) => p.categoryId).filter(Boolean))] as number[];
      let categoryMap: Record<number, string> = {};
      if (catIds.length > 0) {
        const cats = await db
          .select({ id: productCategories.id, name: productCategories.name })
          .from(productCategories)
          .where(inArray(productCategories.id, catIds));
        categoryMap = Object.fromEntries(cats.map((c) => [c.id, c.name]));
      }

      return allProducts.map((p) => {
        // Parse images JSON string to array
        let parsedImages: string[] = [];
        if (p.images) {
          try {
            const parsed = JSON.parse(p.images as string);
            parsedImages = Array.isArray(parsed) ? parsed : [parsed];
          } catch {
            parsedImages = [p.images as string];
          }
        }
        return {
          id: p.id,
          name: p.name,
          price: p.price,
          images: parsedImages,
          description: p.description,
          stockStatus: p.stockStatus,
          categoryName: p.categoryId ? categoryMap[p.categoryId] || "" : "",
          orderCount: p.orderCount,
          isPinned: "isPinned" in p ? p.isPinned : false,
        };
      });
    }),

  // Get pending orders for POS device (lightweight summary for small screens)
  getPendingOrdersForPOS: publicProcedure
    .input(z.object({
      storeId: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get pending orders + recently accepted orders (preparing, last 30 min) for this store
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
      const pendingOrders = await db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          total: orders.total,
          paymentMethod: orders.paymentMethod,
          createdAt: orders.createdAt,
          guestName: orders.guestName,
          customerId: orders.customerId,
          status: orders.status,
          acceptedAt: orders.acceptedAt,
        })
        .from(orders)
        .where(
          and(
            eq(orders.storeId, input.storeId),
            or(
              eq(orders.status, "pending"),
              and(
                eq(orders.status, "preparing"),
                gte(orders.acceptedAt, thirtyMinAgo)
              )
            )
          )
        )
        .orderBy(desc(orders.createdAt));

      // For each order, get item count and total quantity
      const result = [];
      for (const order of pendingOrders) {
        const items = await db
          .select({
            id: orderItems.id,
            productName: orderItems.productName,
            quantity: orderItems.quantity,
            subtotal: orderItems.subtotal,
          })
          .from(orderItems)
          .where(eq(orderItems.orderId, order.id));

        const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

        // Get customer name
        let customerName = order.guestName || "Guest";
        if (order.customerId) {
          const customer = await db
            .select({ name: users.name })
            .from(users)
            .where(eq(users.id, order.customerId))
            .limit(1);
          if (customer.length > 0) customerName = customer[0].name;
        }

        result.push({
          id: order.id,
          orderNumber: order.orderNumber,
          total: order.total,
          paymentMethod: order.paymentMethod,
          status: order.status,
          itemCount: items.length,
          totalQuantity,
          customerName,
          createdAt: order.createdAt,
          items: items.map(i => ({
            name: i.productName,
            quantity: i.quantity,
            subtotal: i.subtotal,
          })),
        });
      }

      return result;
    }),

  // Bulk update product prices
  bulkUpdatePrices: publicProcedure
    .input(z.object({
      updates: z.array(z.object({
        productId: z.number(),
        price: z.string(),
        salePrice: z.string().nullable().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      let updated = 0;
      for (const item of input.updates) {
        const updateData: Record<string, any> = { price: item.price };
        if (item.salePrice !== undefined) updateData.salePrice = item.salePrice;
        await db.update(products).set(updateData).where(eq(products.id, item.productId));
        updated++;
      }
      return { success: true, updated };
    }),

  // Accept order from POS device (same as acceptOrder but returns alreadyAccepted flag)
  acceptOrderFromPOS: publicProcedure
    .input(z.object({
      orderId: z.number(),
      storeId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify order belongs to this store and is pending
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
        // Already accepted by dashboard or another device
        return { success: false, alreadyAccepted: true };
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

      // Send notification to customer
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

      // Auto-create print job (POS picks this up for printing)
      await autoCreatePrintJob(input.orderId, input.storeId);

      return { success: true, alreadyAccepted: false };
    }),

  // Move a product to a different store (categories are global, so just update storeId)
  moveProductToStore: publicProcedure
    .input(z.object({
      productId: z.number(),
      targetStoreId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const product = await db.select().from(products).where(eq(products.id, input.productId)).limit(1);
      if (product.length === 0) throw new Error("Product not found");
      await db.update(products).set({
        storeId: input.targetStoreId,
      }).where(eq(products.id, input.productId));
      return { success: true };
    }),

  // Duplicate a product to another store (categories are global, so same categoryId works)
  duplicateProductToStore: publicProcedure
    .input(z.object({
      productId: z.number(),
      targetStoreId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const product = await db.select().from(products).where(eq(products.id, input.productId)).limit(1);
      if (product.length === 0) throw new Error("Product not found");
      const p = product[0];
      const result = await db.insert(products).values({
        storeId: input.targetStoreId,
        categoryId: p.categoryId,
        name: p.name,
        description: p.description,
        sku: p.sku,
        barcode: p.barcode,
        price: p.price,
        salePrice: p.salePrice,
        images: p.images,
        stockStatus: p.stockStatus,
        quantity: p.quantity,
        isActive: p.isActive,
        isDrs: p.isDrs,
        weight: p.weight,
        dimensions: p.dimensions,
      });
      return { success: true, newProductId: Number(result[0].insertId) };
    }),

  // Change a product's category
  changeProductCategory: publicProcedure
    .input(z.object({
      productId: z.number(),
      categoryId: z.number().nullable(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(products).set({ categoryId: input.categoryId }).where(eq(products.id, input.productId));
      return { success: true };
    }),

  // Bulk change category for multiple products
  bulkChangeCategory: publicProcedure
    .input(z.object({
      productIds: z.array(z.number()),
      categoryId: z.number().nullable(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(products).set({ categoryId: input.categoryId }).where(inArray(products.id, input.productIds));
      return { success: true, count: input.productIds.length };
    }),

  // Bulk update prices for multiple products (set same price)
  bulkSetPrice: publicProcedure
    .input(z.object({
      productIds: z.array(z.number()),
      price: z.string().optional(),
      salePrice: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const updateData: any = {};
      if (input.price !== undefined) updateData.price = input.price;
      if (input.salePrice !== undefined) updateData.salePrice = input.salePrice;
      if (Object.keys(updateData).length > 0) {
        await db.update(products).set(updateData).where(inArray(products.id, input.productIds));
      }
      return { success: true, count: input.productIds.length };
    }),

  // Bulk duplicate products to another store
  bulkDuplicateToStore: publicProcedure
    .input(z.object({
      productIds: z.array(z.number()),
      targetStoreId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const sourceProducts = await db.select().from(products).where(inArray(products.id, input.productIds));
      if (sourceProducts.length === 0) throw new Error("No products found");
      let duplicated = 0;
      for (const p of sourceProducts) {
        await db.insert(products).values({
          storeId: input.targetStoreId,
          categoryId: p.categoryId,
          name: p.name,
          description: p.description,
          sku: p.sku,
          barcode: p.barcode,
          price: p.price,
          salePrice: p.salePrice,
          images: p.images,
          stockStatus: p.stockStatus,
          quantity: p.quantity,
          isActive: p.isActive,
          isDrs: p.isDrs,
          weight: p.weight,
          dimensions: p.dimensions,
        });
        duplicated++;
      }
      return { success: true, count: duplicated };
    }),

  // Bulk move products to another store (changes storeId, removes from current store)
  bulkMoveToStore: publicProcedure
    .input(z.object({
      productIds: z.array(z.number()),
      targetStoreId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(products).set({ storeId: input.targetStoreId }).where(inArray(products.id, input.productIds));
      return { success: true, count: input.productIds.length };
    }),

  // Bulk delete products
  bulkDeleteProducts: publicProcedure
    .input(z.object({
      productIds: z.array(z.number()),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(products).where(inArray(products.id, input.productIds));
      return { success: true, count: input.productIds.length };
    }),

  // Bulk toggle stock status
  bulkSetStockStatus: publicProcedure
    .input(z.object({
      productIds: z.array(z.number()),
      stockStatus: z.enum(["in_stock", "out_of_stock"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.update(products).set({ stockStatus: input.stockStatus }).where(inArray(products.id, input.productIds));
      return { success: true, count: input.productIds.length };
    }),

  // Get top selling products for a store
  getTopProducts: publicProcedure
    .input(z.object({
      storeId: z.number(),
      days: z.number().default(30),
      limit: z.number().default(10),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const cutoffDate = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);

      const recentOrders = await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.storeId, input.storeId),
            gte(orders.createdAt, cutoffDate),
            eq(orders.status, "delivered")
          )
        );

      const orderIds = recentOrders.map(o => o.id);
      if (orderIds.length === 0) return { topProducts: [] };

      const items = await db
        .select({
          productId: orderItems.productId,
          productName: orderItems.productName,
          quantity: orderItems.quantity,
          price: orderItems.productPrice,
        })
        .from(orderItems)
        .leftJoin(products, eq(orderItems.productId, products.id))
        .where(inArray(orderItems.orderId, orderIds));

      const productStats = new Map<number, { name: string; quantity: number; revenue: number }>();
      items.forEach(item => {
        if (!item.productId) return;
        const existing = productStats.get(item.productId) || { name: item.productName || "Unknown", quantity: 0, revenue: 0 };
        existing.quantity += item.quantity || 0;
        existing.revenue += (item.quantity || 0) * parseFloat(item.price || "0");
        productStats.set(item.productId, existing);
      });

      const topProducts = Array.from(productStats.values())
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, input.limit);

      return { topProducts };
    }),

  // Get sales by hour (peak hours)
  getPeakHours: publicProcedure
    .input(z.object({
      storeId: z.number(),
      days: z.number().default(7),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const cutoffDate = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);

      const recentOrders = await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.storeId, input.storeId),
            gte(orders.createdAt, cutoffDate),
            eq(orders.status, "delivered")
          )
        );

      const hourlyStats = new Map<number, { count: number; revenue: number }>();
      recentOrders.forEach(order => {
        const hour = new Date(order.createdAt).getHours();
        const existing = hourlyStats.get(hour) || { count: 0, revenue: 0 };
        existing.count += 1;
        existing.revenue += parseFloat(order.subtotal || "0");
        hourlyStats.set(hour, existing);
      });

      const peakHours = Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        count: hourlyStats.get(i)?.count || 0,
        revenue: hourlyStats.get(i)?.revenue || 0,
      }));

      return { peakHours };
    }),

  // Get daily sales for the last N days
  getDailySales: publicProcedure
    .input(z.object({
      storeId: z.number(),
      days: z.number().default(30),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const cutoffDate = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);

      const recentOrders = await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.storeId, input.storeId),
            gte(orders.createdAt, cutoffDate),
            eq(orders.status, "delivered")
          )
        );

      const dailyStats = new Map<string, { count: number; revenue: number }>();
      recentOrders.forEach(order => {
        const date = new Date(order.createdAt).toISOString().split('T')[0];
        const existing = dailyStats.get(date) || { count: 0, revenue: 0 };
        existing.count += 1;
        existing.revenue += parseFloat(order.subtotal || "0");
        dailyStats.set(date, existing);
      });

      const dailySales = Array.from(dailyStats.entries())
        .map(([date, stats]) => ({
          date,
          ...stats,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return { dailySales };
    }),
});
