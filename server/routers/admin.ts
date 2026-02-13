import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { orders, drivers, users, stores, orderItems, products } from "../../drizzle/schema";
import { eq, and, desc, gte, sql, count } from "drizzle-orm";

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

      // Get driver names
      const driverIds = ordersList
        .filter(o => o.driverId)
        .map(o => o.driverId!);

      let driverMap: Record<number, string> = {};
      if (driverIds.length > 0) {
        const uniqueDriverIds = [...new Set(driverIds)];
        const driverRows = await db
          .select({ id: drivers.id, userId: drivers.userId })
          .from(drivers)
          .where(sql`${drivers.id} IN (${sql.join(uniqueDriverIds.map(id => sql`${id}`), sql`, `)})`);

        const driverUserIds = driverRows.map(d => d.userId);
        if (driverUserIds.length > 0) {
          const driverUserRows = await db
            .select({ id: users.id, name: users.name, email: users.email })
            .from(users)
            .where(sql`${users.id} IN (${sql.join(driverUserIds.map(id => sql`${id}`), sql`, `)})`);

          const userMap = Object.fromEntries(
            driverUserRows.map(u => [u.id, u.name || u.email || "Unknown"])
          );

          driverMap = Object.fromEntries(
            driverRows.map(d => [d.id, userMap[d.userId] || "Unknown"])
          );
        }
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
});
