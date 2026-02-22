import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { orders, drivers, users, stores, orderItems, products, orderOffers, storeStaff as storeStaffTable, savedAddresses } from "../../drizzle/schema";
import { eq, and, desc, gte, sql, count, inArray, isNull } from "drizzle-orm";
import { offerOrderToQueue } from "./drivers";
import { sendPushNotification, sendNewOrderNotification } from "../services/notifications";
import { geocodeAddress } from "../services/geocoding";

// Helper function to generate sequential order number per store
async function generateOrderNumber(storeId: number): Promise<string> {
  const db = await getDb();
  await db!.update(stores)
    .set({ orderCounter: sql`order_counter + 1` })
    .where(eq(stores.id, storeId));
  const [store] = await db!.select({
    shortCode: stores.shortCode,
    orderCounter: stores.orderCounter,
  }).from(stores).where(eq(stores.id, storeId));
  const code = store?.shortCode || 'GEN';
  const num = store?.orderCounter || 1;
  const padded = String(num).padStart(3, '0');
  return `WS4U/${code}/${padded}`;
}

// Helper function to calculate distance between two points (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

function calculateDeliveryFee(distanceKm: number): number {
  const BASE_FEE = 3.50;
  const BASE_DISTANCE = 2.8;
  const COST_PER_KM = 1.00;
  if (distanceKm <= BASE_DISTANCE) return BASE_FEE;
  return Math.round((BASE_FEE + (distanceKm - BASE_DISTANCE) * COST_PER_KM) * 100) / 100;
}

export const adminRouter = router({
  // Get dashboard overview stats
  getDashboardStats: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week (Sunday)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get all orders
    const allOrders = await db.select().from(orders);

    // Today's orders
    const todayOrders = allOrders.filter(o => o.createdAt >= todayStart);
    const weekOrders = allOrders.filter(o => o.createdAt >= weekStart);
    const monthOrders = allOrders.filter(o => o.createdAt >= monthStart);

    // Revenue calculations (only delivered orders)
    const calcRevenue = (orderList: typeof allOrders) =>
      orderList
        .filter(o => o.status === "delivered")
        .reduce((sum, o) => sum + parseFloat(o.total), 0);

    const calcServiceFees = (orderList: typeof allOrders) =>
      orderList
        .filter(o => o.status === "delivered")
        .reduce((sum, o) => sum + parseFloat(o.serviceFee), 0);

    const calcDeliveryFees = (orderList: typeof allOrders) =>
      orderList
        .filter(o => o.status === "delivered")
        .reduce((sum, o) => sum + parseFloat(o.deliveryFee), 0);

    const calcTips = (orderList: typeof allOrders) =>
      orderList
        .filter(o => o.status === "delivered")
        .reduce((sum, o) => sum + parseFloat(o.tipAmount || "0"), 0);

    // Active orders (not delivered or cancelled)
    const activeOrders = allOrders.filter(o =>
      !["delivered", "cancelled"].includes(o.status)
    );

    // Order status breakdown
    const statusBreakdown = {
      pending: allOrders.filter(o => o.status === "pending").length,
      accepted: allOrders.filter(o => o.status === "accepted").length,
      preparing: allOrders.filter(o => o.status === "preparing").length,
      ready_for_pickup: allOrders.filter(o => o.status === "ready_for_pickup").length,
      picked_up: allOrders.filter(o => o.status === "picked_up").length,
      on_the_way: allOrders.filter(o => o.status === "on_the_way").length,
      delivered: allOrders.filter(o => o.status === "delivered").length,
      cancelled: allOrders.filter(o => o.status === "cancelled").length,
    };

    // Get all drivers with user info
    const allDrivers = await db
      .select({
        id: drivers.id,
        isOnline: drivers.isOnline,
        isAvailable: drivers.isAvailable,
        totalDeliveries: drivers.totalDeliveries,
        rating: drivers.rating,
      })
      .from(drivers);

    const onlineDrivers = allDrivers.filter(d => d.isOnline);
    const availableDrivers = allDrivers.filter(d => d.isOnline && d.isAvailable);

    // Get all stores
    const allStores = await db.select().from(stores);
    const activeStores = allStores.filter(s => s.isActive);

    return {
      orders: {
        today: {
          count: todayOrders.length,
          revenue: Math.round(calcRevenue(todayOrders) * 100) / 100,
          serviceFees: Math.round(calcServiceFees(todayOrders) * 100) / 100,
          deliveryFees: Math.round(calcDeliveryFees(todayOrders) * 100) / 100,
          tips: Math.round(calcTips(todayOrders) * 100) / 100,
        },
        thisWeek: {
          count: weekOrders.length,
          revenue: Math.round(calcRevenue(weekOrders) * 100) / 100,
          serviceFees: Math.round(calcServiceFees(weekOrders) * 100) / 100,
        },
        thisMonth: {
          count: monthOrders.length,
          revenue: Math.round(calcRevenue(monthOrders) * 100) / 100,
          serviceFees: Math.round(calcServiceFees(monthOrders) * 100) / 100,
        },
        allTime: {
          count: allOrders.length,
          revenue: Math.round(calcRevenue(allOrders) * 100) / 100,
          serviceFees: Math.round(calcServiceFees(allOrders) * 100) / 100,
        },
        active: activeOrders.length,
        statusBreakdown,
      },
      drivers: {
        total: allDrivers.length,
        online: onlineDrivers.length,
        available: availableDrivers.length,
      },
      stores: {
        total: allStores.length,
        active: activeStores.length,
      },
    };
  }),

  // Get all orders with details for admin view
  getAllOrders: publicProcedure
    .input(
      z.object({
        status: z.string().optional(),
        limit: z.number().optional().default(50),
        offset: z.number().optional().default(0),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;

      // Build query
      let conditions = [];
      if (input?.status && input.status !== "all") {
        conditions.push(eq(orders.status, input.status as any));
      }

      const ordersList = await db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          status: orders.status,
          paymentMethod: orders.paymentMethod,
          paymentStatus: orders.paymentStatus,
          subtotal: orders.subtotal,
          serviceFee: orders.serviceFee,
          deliveryFee: orders.deliveryFee,
          tipAmount: orders.tipAmount,
          total: orders.total,
          deliveryAddress: orders.deliveryAddress,
          deliveryDistance: orders.deliveryDistance,
          customerNotes: orders.customerNotes,
          createdAt: orders.createdAt,
          deliveredAt: orders.deliveredAt,
          cancelledAt: orders.cancelledAt,
          customerId: orders.customerId,
          guestName: orders.guestName,
          guestPhone: orders.guestPhone,
          storeName: stores.name,
          storeId: orders.storeId,
          driverId: orders.driverId,
        })
        .from(orders)
        .leftJoin(stores, eq(orders.storeId, stores.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(orders.createdAt))
        .limit(limit)
        .offset(offset);

      // Get customer names for orders with customerId
      const customerIds = ordersList
        .filter(o => o.customerId)
        .map(o => o.customerId!);

      let customerMap: Record<number, string> = {};
      if (customerIds.length > 0) {
        const uniqueIds = [...new Set(customerIds)];
        const customerRows = await db
          .select({ id: users.id, name: users.name, email: users.email })
          .from(users)
          .where(sql`${users.id} IN (${sql.join(uniqueIds.map(id => sql`${id}`), sql`, `)})`);
        customerMap = Object.fromEntries(
          customerRows.map(c => [c.id, c.name || c.email || "Unknown"])
        );
      }

      // Get driver display numbers (orders.driverId stores users.id)
      const driverUserIds = ordersList
        .filter(o => o.driverId)
        .map(o => o.driverId!);

      let driverMap: Record<number, string> = {};
      if (driverUserIds.length > 0) {
        const uniqueDriverUserIds = [...new Set(driverUserIds)];
        const driverRows = await db
          .select({ userId: drivers.userId, displayNumber: drivers.displayNumber })
          .from(drivers)
          .where(sql`${drivers.userId} IN (${sql.join(uniqueDriverUserIds.map(id => sql`${id}`), sql`, `)})`);

        driverMap = Object.fromEntries(
          driverRows.map(d => [d.userId, d.displayNumber ? `Driver ${d.displayNumber}` : "Driver"])
        );
      }

      return ordersList.map(order => ({
        ...order,
        customerName: order.customerId
          ? customerMap[order.customerId] || "Unknown"
          : order.guestName || "Guest",
        driverName: order.driverId ? driverMap[order.driverId] || "Unassigned" : "Unassigned",
      }));
    }),

  // Get all drivers with details
  getAllDrivers: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const driversList = await db
      .select({
        id: drivers.id,
        userId: drivers.userId,
        displayNumber: drivers.displayNumber,
        vehicleType: drivers.vehicleType,
        vehicleNumber: drivers.vehicleNumber,
        isOnline: drivers.isOnline,
        isAvailable: drivers.isAvailable,
        totalDeliveries: drivers.totalDeliveries,
        totalReturns: drivers.totalReturns,
        rating: drivers.rating,
        createdAt: drivers.createdAt,
      })
      .from(drivers);

    // Get user info for all drivers
    const userIds = driversList.map(d => d.userId);
    let userMap: Record<number, { name: string; email: string; phone: string }> = {};
    if (userIds.length > 0) {
      const userRows = await db
        .select({ id: users.id, name: users.name, email: users.email, phone: users.phone })
        .from(users)
        .where(sql`${users.id} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`);

      userMap = Object.fromEntries(
        userRows.map(u => [u.id, { name: u.name || "Unknown", email: u.email || "", phone: u.phone || "" }])
      );
    }

    // Get today's earnings for each driver
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.status, "delivered"),
          gte(orders.deliveredAt, todayStart)
        )
      );

    const driverEarningsToday: Record<number, number> = {};
    todayOrders.forEach(order => {
      if (order.driverId) {
        const earnings = parseFloat(order.deliveryFee) + parseFloat(order.tipAmount || "0");
        driverEarningsToday[order.driverId] = (driverEarningsToday[order.driverId] || 0) + earnings;
      }
    });

    return driversList.map(driver => ({
      ...driver,
      name: userMap[driver.userId]?.name || "Unknown",
      email: userMap[driver.userId]?.email || "",
      phone: userMap[driver.userId]?.phone || "",
      earningsToday: Math.round((driverEarningsToday[driver.id] || 0) * 100) / 100,
    }));
  }),

  // Get single order with full details (items, customer, driver, store)
  getOrderDetail: publicProcedure
    .input(z.object({ orderId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [order] = await db
        .select()
        .from(orders)
        .leftJoin(stores, eq(orders.storeId, stores.id))
        .where(eq(orders.id, input.orderId))
        .limit(1);

      if (!order) throw new Error("Order not found");

      // Get order items
      const items = await db
        .select({
          id: orderItems.id,
          productId: orderItems.productId,
          productName: orderItems.productName,
          productPrice: orderItems.productPrice,
          quantity: orderItems.quantity,
          subtotal: orderItems.subtotal,
          notes: orderItems.notes,
        })
        .from(orderItems)
        .where(eq(orderItems.orderId, input.orderId));

      // Get customer info
      let customerInfo = { name: order.orders.guestName || "Guest", phone: order.orders.guestPhone || "", email: order.orders.guestEmail || "" };
      if (order.orders.customerId) {
        const [customer] = await db
          .select({ name: users.name, phone: users.phone, email: users.email })
          .from(users)
          .where(eq(users.id, order.orders.customerId))
          .limit(1);
        if (customer) {
          customerInfo = { name: customer.name || "Unknown", phone: customer.phone || "", email: customer.email || "" };
        }
      }

      // Get driver info
      let driverInfo = null;
      if (order.orders.driverId) {
        const [driverRecord] = await db
          .select({ displayNumber: drivers.displayNumber, vehicleType: drivers.vehicleType })
          .from(drivers)
          .where(eq(drivers.userId, order.orders.driverId))
          .limit(1);
        const [driverUser] = await db
          .select({ name: users.name, phone: users.phone })
          .from(users)
          .where(eq(users.id, order.orders.driverId))
          .limit(1);
        driverInfo = {
          userId: order.orders.driverId,
          name: driverUser?.name || "Unknown",
          phone: driverUser?.phone || "",
          displayNumber: driverRecord?.displayNumber || null,
          vehicleType: driverRecord?.vehicleType || null,
        };
      }

      return {
        ...order.orders,
        store: order.stores,
        items,
        customer: customerInfo,
        driver: driverInfo,
      };
    }),

  // Admin update order status (can change to any status)
  updateOrderStatus: publicProcedure
    .input(z.object({
      orderId: z.number(),
      status: z.enum(["pending", "accepted", "preparing", "ready_for_pickup", "picked_up", "on_the_way", "delivered", "cancelled"]),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const updateFields: Record<string, any> = { status: input.status };
      const now = new Date();

      if (input.status === "accepted") updateFields.acceptedAt = now;
      else if (input.status === "picked_up" || input.status === "on_the_way") updateFields.pickedUpAt = now;
      else if (input.status === "delivered") updateFields.deliveredAt = now;
      else if (input.status === "cancelled") {
        updateFields.cancelledAt = now;
        updateFields.cancellationReason = input.reason || "Cancelled by admin";
      }

      await db.update(orders).set(updateFields).where(eq(orders.id, input.orderId));

      // If cancelled, expire any pending offers
      if (input.status === "cancelled") {
        await db
          .update(orderOffers)
          .set({ status: "expired" })
          .where(and(eq(orderOffers.orderId, input.orderId), eq(orderOffers.status, "pending")));
      }

      // If delivered, mark driver as available again
      if (input.status === "delivered") {
        const [orderData] = await db.select({ driverId: orders.driverId }).from(orders).where(eq(orders.id, input.orderId)).limit(1);
        if (orderData?.driverId) {
          await db.update(drivers).set({ isAvailable: true }).where(eq(drivers.userId, orderData.driverId));
        }
      }

      // Send push notification to customer
      const [orderData] = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
      if (orderData?.customerId) {
        const [customer] = await db.select({ pushToken: users.pushToken }).from(users).where(eq(users.id, orderData.customerId)).limit(1);
        if (customer?.pushToken) {
          const msgs: Record<string, { title: string; body: string }> = {
            accepted: { title: "Order Confirmed!", body: `Order #${orderData.orderNumber} has been confirmed.` },
            preparing: { title: "Preparing Your Order", body: `Order #${orderData.orderNumber} is being prepared.` },
            ready_for_pickup: { title: "Order Ready", body: `Order #${orderData.orderNumber} is ready for pickup.` },
            on_the_way: { title: "On the Way!", body: `Order #${orderData.orderNumber} is on its way to you!` },
            delivered: { title: "Order Delivered!", body: `Order #${orderData.orderNumber} has been delivered. Enjoy!` },
            cancelled: { title: "Order Cancelled", body: `Order #${orderData.orderNumber} has been cancelled.` },
          };
          const msg = msgs[input.status];
          if (msg) {
            await sendPushNotification(customer.pushToken, { title: msg.title, body: msg.body, data: { type: "order_update", orderId: input.orderId, status: input.status }, channelId: "orders" });
          }
        }
      }

      // Print job is now manual only - staff presses "Print Pick List" button

      console.log(`[Admin] Order ${input.orderId} status updated to ${input.status}`);
      return { success: true };
    }),

  // Admin assign driver to order
  assignDriver: publicProcedure
    .input(z.object({
      orderId: z.number(),
      driverUserId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify driver exists
      const [driver] = await db.select().from(drivers).where(eq(drivers.userId, input.driverUserId)).limit(1);
      if (!driver) throw new Error("Driver not found");

      // Get current order state
      const [order] = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
      if (!order) throw new Error("Order not found");

      // If order already had a driver, make old driver available again
      if (order.driverId && order.driverId !== input.driverUserId) {
        await db.update(drivers).set({ isAvailable: true }).where(eq(drivers.userId, order.driverId));
      }

      // Assign new driver
      await db.update(orders).set({
        driverId: input.driverUserId,
        driverAssignedAt: new Date(),
      }).where(eq(orders.id, input.orderId));

      // Mark driver as busy
      await db.update(drivers).set({ isAvailable: false }).where(eq(drivers.userId, input.driverUserId));

      // Expire any pending offers for this order
      await db.update(orderOffers).set({ status: "expired" })
        .where(and(eq(orderOffers.orderId, input.orderId), eq(orderOffers.status, "pending")));

      // Send push notification to driver
      const [driverUser] = await db.select({ pushToken: users.pushToken }).from(users).where(eq(users.id, input.driverUserId)).limit(1);
      if (driverUser?.pushToken) {
        await sendPushNotification(driverUser.pushToken, {
          title: "New Job Assigned",
          body: `You have been assigned order #${order.orderNumber}. Check your dashboard.`,
          data: { type: "job_assigned", orderId: input.orderId },
          channelId: "driver",
        });
      }

      console.log(`[Admin] Driver ${input.driverUserId} assigned to order ${input.orderId}`);
      return { success: true };
    }),

  // Get available drivers for assignment
  getAvailableDriversForAssignment: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const driversList = await db
      .select({
        id: drivers.id,
        userId: drivers.userId,
        displayNumber: drivers.displayNumber,
        isOnline: drivers.isOnline,
        isAvailable: drivers.isAvailable,
        vehicleType: drivers.vehicleType,
        totalDeliveries: drivers.totalDeliveries,
        rating: drivers.rating,
      })
      .from(drivers);

    const userIds = driversList.map(d => d.userId);
    let userMap: Record<number, { name: string; phone: string }> = {};
    if (userIds.length > 0) {
      const userRows = await db
        .select({ id: users.id, name: users.name, phone: users.phone })
        .from(users)
        .where(sql`${users.id} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`);
      userMap = Object.fromEntries(userRows.map(u => [u.id, { name: u.name || "Unknown", phone: u.phone || "" }]));
    }

    return driversList
      .sort((a, b) => {
        // Online & available first, then online & busy, then offline
        const scoreA = a.isOnline ? (a.isAvailable ? 2 : 1) : 0;
        const scoreB = b.isOnline ? (b.isAvailable ? 2 : 1) : 0;
        return scoreB - scoreA;
      })
      .map(d => ({
        userId: d.userId,
        name: userMap[d.userId]?.name || "Unknown",
        phone: userMap[d.userId]?.phone || "",
        displayNumber: d.displayNumber,
        isOnline: d.isOnline,
        isAvailable: d.isAvailable,
        vehicleType: d.vehicleType,
        totalDeliveries: d.totalDeliveries,
        rating: d.rating,
      }));
  }),

  // Set driver display number
  setDriverDisplayNumber: publicProcedure
    .input(z.object({
      driverUserId: z.number(),
      displayNumber: z.string().max(10),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.update(drivers)
        .set({ displayNumber: input.displayNumber })
        .where(eq(drivers.userId, input.driverUserId));

      console.log(`[Admin] Driver ${input.driverUserId} display number set to ${input.displayNumber}`);
      return { success: true };
    }),

  // Create phone order (admin creates on behalf of customer)
  createPhoneOrder: publicProcedure
    .input(z.object({
      storeId: z.number(),
      items: z.array(z.object({
        productId: z.number(),
        quantity: z.number().min(1),
      })),
      customerName: z.string(),
      customerPhone: z.string(),
      deliveryAddress: z.string(),
      deliveryEircode: z.string().optional(),
      deliveryLatitude: z.number(),
      deliveryLongitude: z.number(),
      paymentMethod: z.enum(["card", "cash_on_delivery"]),
      customerNotes: z.string().optional(),
      allowSubstitution: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get store location
      const [store] = await db.select().from(stores).where(eq(stores.id, input.storeId)).limit(1);
      if (!store) throw new Error("Store not found");
      if (!store.latitude || !store.longitude) throw new Error("Store location not available");

      // Calculate distance and delivery fee
      const distance = calculateDistance(
        parseFloat(store.latitude), parseFloat(store.longitude),
        input.deliveryLatitude, input.deliveryLongitude
      );
      const deliveryFee = calculateDeliveryFee(distance);

      // Get product details and calculate subtotal
      let subtotal = 0;
      const orderItemsData = [];
      for (const item of input.items) {
        const [product] = await db.select().from(products).where(eq(products.id, item.productId)).limit(1);
        if (!product) throw new Error(`Product ${item.productId} not found`);
        const price = parseFloat(product.price);
        const itemSubtotal = price * item.quantity;
        subtotal += itemSubtotal;
        orderItemsData.push({
          productId: item.productId,
          productName: product.name,
          productPrice: product.price,
          quantity: item.quantity,
          subtotal: itemSubtotal.toFixed(2),
        });
      }

      const serviceFee = Math.round(subtotal * 0.10 * 100) / 100;
      const total = Math.round((subtotal + serviceFee + deliveryFee) * 100) / 100;
      const orderNumber = await generateOrderNumber(input.storeId);

      // Check if customer phone matches an existing user
      let customerId: number | null = null;
      if (input.customerPhone) {
        const [existingUser] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.phone, input.customerPhone))
          .limit(1);
        if (existingUser) customerId = existingUser.id;
      }

      // Create order
      const [order] = await db.insert(orders).values({
        orderNumber,
        customerId,
        storeId: input.storeId,
        status: "pending",
        paymentMethod: input.paymentMethod,
        paymentStatus: input.paymentMethod === "card" ? "completed" : "pending",
        subtotal: subtotal.toFixed(2),
        serviceFee: serviceFee.toFixed(2),
        deliveryFee: deliveryFee.toFixed(2),
        tipAmount: "0.00",
        total: total.toFixed(2),
        deliveryAddress: input.deliveryAddress,
        deliveryLatitude: input.deliveryLatitude.toString(),
        deliveryLongitude: input.deliveryLongitude.toString(),
        deliveryDistance: distance.toFixed(2),
        customerNotes: input.customerNotes || null,
        allowSubstitution: input.allowSubstitution || false,
        guestName: customerId ? null : input.customerName,
        guestPhone: customerId ? null : input.customerPhone,
      });

      const orderId = order.insertId;

      // Create order items
      for (const item of orderItemsData) {
        await db.insert(orderItems).values({ orderId: Number(orderId), ...item });
      }

      // Send push notification to store staff
      try {
        const storeStaffMembers = await db
          .select({ userId: storeStaffTable.userId, pushToken: users.pushToken })
          .from(storeStaffTable)
          .innerJoin(users, eq(storeStaffTable.userId, users.id))
          .where(eq(storeStaffTable.storeId, input.storeId));

        for (const staff of storeStaffMembers) {
          if (staff.pushToken) {
            await sendNewOrderNotification(staff.pushToken, Number(orderId), input.customerName, input.items.length, total);
          }
        }
      } catch (e) {
        console.error(`[Push] Failed to notify store staff for phone order ${orderId}:`, e);
      }

      // Offer to driver queue
      try {
        await offerOrderToQueue(Number(orderId));
      } catch (e) {
        console.error(`[Queue] Failed to offer phone order ${orderId} to queue:`, e);
      }

      console.log(`[Admin] Phone order ${orderId} (#${orderNumber}) created for ${input.customerName}`);
      return { orderId: Number(orderId), orderNumber, subtotal, serviceFee, deliveryFee, total, distance };
    }),

  // Calculate fees for phone order preview (before creating order)
  calculatePhoneOrderFees: publicProcedure
    .input(z.object({
      storeId: z.number(),
      eircode: z.string().min(1),
      subtotal: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get store location
      const [store] = await db.select().from(stores).where(eq(stores.id, input.storeId)).limit(1);
      if (!store) throw new Error("Store not found");
      if (!store.latitude || !store.longitude) throw new Error("Store location not available");

      // Geocode the Eircode
      const customerLocation = await geocodeAddress(input.eircode);
      if (!customerLocation) {
        throw new Error("Could not find that Eircode. Please check and try again.");
      }

      // Calculate distance and delivery fee
      const distance = calculateDistance(
        parseFloat(store.latitude), parseFloat(store.longitude),
        customerLocation.latitude, customerLocation.longitude
      );
      const deliveryFee = calculateDeliveryFee(distance);
      const serviceFee = Math.round(input.subtotal * 0.10 * 100) / 100;
      const total = Math.round((input.subtotal + serviceFee + deliveryFee) * 100) / 100;

      return {
        distance,
        deliveryFee,
        serviceFee,
        total,
        deliveryLatitude: customerLocation.latitude,
        deliveryLongitude: customerLocation.longitude,
        formattedAddress: customerLocation.formattedAddress,
      };
    }),

  // Look up customer by phone number from previous orders
  lookupCustomerByPhone: publicProcedure
    .input(z.object({ phone: z.string().min(3) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const normalizedPhone = input.phone.replace(/\s+/g, "").replace(/^\+353/, "0");

      // First check registered users by phone
      const userRows = await db.select({
        id: users.id,
        name: users.name,
        phone: users.phone,
      }).from(users);

      const matchedUser = userRows.find(u => {
        if (!u.phone) return false;
        const normalized = u.phone.replace(/\s+/g, "").replace(/^\+353/, "0");
        return normalized === normalizedPhone || normalized.endsWith(normalizedPhone) || normalizedPhone.endsWith(normalized);
      });

      if (matchedUser) {
        // Get their most recent order for address info
        const recentOrders = await db
          .select({
            deliveryAddress: orders.deliveryAddress,
            deliveryLatitude: orders.deliveryLatitude,
            deliveryLongitude: orders.deliveryLongitude,
          })
          .from(orders)
          .where(eq(orders.customerId, matchedUser.id))
          .orderBy(desc(orders.createdAt))
          .limit(1);

        // Get saved addresses
        const addresses = await db
          .select()
          .from(savedAddresses)
          .where(eq(savedAddresses.userId, matchedUser.id));

        const defaultAddr = addresses.find(a => a.isDefault) || addresses[0];

        return {
          found: true,
          name: matchedUser.name,
          phone: matchedUser.phone || input.phone,
          address: defaultAddr?.streetAddress || (recentOrders[0]?.deliveryAddress ?? ""),
          eircode: defaultAddr?.eircode || "",
          latitude: defaultAddr?.latitude ? parseFloat(defaultAddr.latitude) : (recentOrders[0]?.deliveryLatitude ? parseFloat(recentOrders[0].deliveryLatitude) : null),
          longitude: defaultAddr?.longitude ? parseFloat(defaultAddr.longitude) : (recentOrders[0]?.deliveryLongitude ? parseFloat(recentOrders[0].deliveryLongitude) : null),
        };
      }

      // Check guest orders by phone
      const guestOrders = await db
        .select({
          guestName: orders.guestName,
          guestPhone: orders.guestPhone,
          deliveryAddress: orders.deliveryAddress,
          deliveryLatitude: orders.deliveryLatitude,
          deliveryLongitude: orders.deliveryLongitude,
        })
        .from(orders)
        .orderBy(desc(orders.createdAt))
        .limit(500);

      const matchedGuest = guestOrders.find(o => {
        if (!o.guestPhone) return false;
        const normalized = o.guestPhone.replace(/\s+/g, "").replace(/^\+353/, "0");
        return normalized === normalizedPhone || normalized.endsWith(normalizedPhone) || normalizedPhone.endsWith(normalized);
      });

      if (matchedGuest) {
        return {
          found: true,
          name: matchedGuest.guestName || "",
          phone: matchedGuest.guestPhone || input.phone,
          address: matchedGuest.deliveryAddress || "",
          eircode: "", // Guest orders don't store Eircode separately
          latitude: matchedGuest.deliveryLatitude ? parseFloat(matchedGuest.deliveryLatitude) : null,
          longitude: matchedGuest.deliveryLongitude ? parseFloat(matchedGuest.deliveryLongitude) : null,
        };
      }

      return { found: false, name: "", phone: input.phone, address: "", eircode: "", latitude: null, longitude: null };
    }),

  // Get all stores (for phone order store selection)
  getStores: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const storesList = await db.select({ id: stores.id, name: stores.name, address: stores.address, isActive: stores.isActive }).from(stores).where(eq(stores.isActive, true));
    return storesList;
  }),

  // Get products for a store (for phone order product selection)
  getStoreProducts: publicProcedure
    .input(z.object({ storeId: z.number(), search: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      let conditions = [eq(products.storeId, input.storeId), eq(products.isActive, true)];

      const productsList = await db
        .select({ id: products.id, name: products.name, price: products.price, images: products.images, stockStatus: products.stockStatus })
        .from(products)
        .where(and(...conditions))
        .orderBy(products.name)
        .limit(200);

      // Filter by search term in JS if provided
      if (input.search && input.search.trim()) {
        const term = input.search.toLowerCase().trim();
        return productsList.filter(p => p.name.toLowerCase().includes(term));
      }

      return productsList;
    }),

  // ===== STORE MANAGEMENT =====

  // Get all stores with full details (admin)
  getAllStoresAdmin: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const storesList = await db.select().from(stores).orderBy(stores.name);
    return storesList;
  }),

  // Get single store detail
  getStoreDetail: publicProcedure
    .input(z.object({ storeId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [store] = await db.select().from(stores).where(eq(stores.id, input.storeId)).limit(1);
      if (!store) throw new Error("Store not found");
      return store;
    }),

  // Update store details
  updateStore: publicProcedure
    .input(z.object({
      storeId: z.number(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      category: z.enum(["convenience", "restaurant", "hardware", "electrical", "clothing", "grocery", "pharmacy", "other"]).optional(),
      address: z.string().optional(),
      eircode: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      sortPosition: z.number().optional(),
      isFeatured: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { storeId, ...updates } = input;
      const updateData: Record<string, any> = {};

      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.category !== undefined) updateData.category = updates.category;
      if (updates.address !== undefined) updateData.address = updates.address;
      if (updates.eircode !== undefined) updateData.eircode = updates.eircode;
      if (updates.phone !== undefined) updateData.phone = updates.phone;
      if (updates.email !== undefined) updateData.email = updates.email;
      if (updates.sortPosition !== undefined) updateData.sortPosition = updates.sortPosition;
      if (updates.isFeatured !== undefined) updateData.isFeatured = updates.isFeatured;

      // If Eircode changed, re-geocode
      if (updates.eircode && updates.eircode.trim()) {
        try {
          const location = await geocodeAddress(updates.eircode);
          if (location) {
            updateData.latitude = location.latitude.toString();
            updateData.longitude = location.longitude.toString();
          }
        } catch (e) {
          console.error("[Store] Failed to geocode Eircode:", e);
        }
      }

      if (Object.keys(updateData).length > 0) {
        await db.update(stores).set(updateData).where(eq(stores.id, storeId));
      }

      return { success: true };
    }),

  // Update store opening hours
  updateStoreHours: publicProcedure
    .input(z.object({
      storeId: z.number(),
      isOpen247: z.boolean(),
      openingHours: z.string().optional(), // JSON string of hours per day
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.update(stores).set({
        isOpen247: input.isOpen247,
        openingHours: input.isOpen247 ? null : (input.openingHours || null),
      }).where(eq(stores.id, input.storeId));

      return { success: true };
    }),

  // Toggle store active/inactive
  toggleStoreActive: publicProcedure
    .input(z.object({ storeId: z.number(), isActive: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.update(stores).set({ isActive: input.isActive }).where(eq(stores.id, input.storeId));

      return { success: true, isActive: input.isActive };
    }),

  // Toggle store featured status (appears in "Popular Stores" on homepage)
  toggleStoreFeatured: publicProcedure
    .input(z.object({ storeId: z.number(), isFeatured: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.update(stores).set({ isFeatured: input.isFeatured }).where(eq(stores.id, input.storeId));

      return { success: true, isFeatured: input.isFeatured };
    }),

  // Update store logo URL
  updateStoreLogo: publicProcedure
    .input(z.object({ storeId: z.number(), logoUrl: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.update(stores).set({ logo: input.logoUrl }).where(eq(stores.id, input.storeId));

      return { success: true };
    }),

  // Delete a driver account and recycle their display number
  deleteDriver: publicProcedure
    .input(z.object({ driverId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // Check if driver has any active deliveries (assigned/picked_up/in_transit)
      const activeOrders = await db
        .select({ id: orders.id })
        .from(orders)
        .where(
          and(
            eq(orders.driverId, input.driverId),
            sql`${orders.status} IN ('assigned', 'picked_up', 'in_transit')`
          )
        )
        .limit(1);
      const activeOrder = activeOrders[0];
      
      if (activeOrder) {
        throw new Error("Cannot delete driver with active deliveries. Please reassign or complete their current orders first.");
      }
      
      // Get the driver record to find the user_id
      const [driver] = await db
        .select({ id: drivers.id, userId: drivers.userId, displayNumber: drivers.displayNumber })
        .from(drivers)
        .where(eq(drivers.id, input.driverId))
        .limit(1);
      
      if (!driver) {
        throw new Error("Driver not found.");
      }
      
      // Delete driver record first (foreign key)
      await db.delete(drivers).where(eq(drivers.id, input.driverId));
      
      // Delete the user account
      if (driver.userId) {
        await db.delete(users).where(eq(users.id, driver.userId));
      }
      
      return { 
        success: true, 
        freedDisplayNumber: driver.displayNumber || null,
        message: `Driver deleted successfully.${driver.displayNumber ? ` Display number #${String(driver.displayNumber).padStart(2, '0')} is now available.` : ''}` 
      };
    }),
});
