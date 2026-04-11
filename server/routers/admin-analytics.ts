import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { orders, orderItems, products, productCategories } from "../../drizzle/schema";
import { eq, and, desc, gte, sql, count, sum } from "drizzle-orm";
import z from "zod";

export const analyticsRouter = router({
  // Get popular products (top sellers)
  getPopularProducts: publicProcedure
    .input(
      z.object({
        limit: z.number().optional().default(10),
        days: z.number().optional().default(30), // Last N days
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - input.days);

      // Get products with sales count and revenue
      const popularProducts = await db
        .select({
          productId: orderItems.productId,
          productName: orderItems.productName,
          productPrice: orderItems.productPrice,
          totalQuantity: sql<number>`CAST(SUM(${orderItems.quantity}) AS UNSIGNED)`,
          totalRevenue: sql<string>`SUM(${orderItems.subtotal})`,
          orderCount: sql<number>`COUNT(DISTINCT ${orderItems.orderId})`,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(
          and(
            gte(orders.createdAt, daysAgo),
            eq(orders.status, "delivered")
          )
        )
        .groupBy(orderItems.productId, orderItems.productName, orderItems.productPrice)
        .orderBy(desc(sql`SUM(${orderItems.quantity})`))
        .limit(input.limit);

      return popularProducts.map(p => ({
        productId: p.productId,
        productName: p.productName,
        productPrice: parseFloat(p.productPrice),
        totalQuantity: p.totalQuantity,
        totalRevenue: parseFloat(p.totalRevenue || "0"),
        orderCount: p.orderCount,
        avgPrice: parseFloat(p.productPrice),
      }));
    }),

  // Get sales trends over time
  getSalesTrends: publicProcedure
    .input(
      z.object({
        days: z.number().optional().default(30),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - input.days);

      // Get daily sales data
      const dailySales = await db
        .select({
          date: sql<string>`DATE(${orders.createdAt})`,
          orderCount: count(),
          revenue: sql<string>`SUM(CASE WHEN ${orders.status} = 'delivered' THEN ${orders.total} ELSE 0 END)`,
          totalOrders: count(),
        })
        .from(orders)
        .where(gte(orders.createdAt, daysAgo))
        .groupBy(sql`DATE(${orders.createdAt})`)
        .orderBy(sql`DATE(${orders.createdAt})`);

      return dailySales.map(d => ({
        date: d.date,
        orderCount: d.orderCount,
        revenue: parseFloat(d.revenue || "0"),
        totalOrders: d.totalOrders,
      }));
    }),

  // Get revenue by category
  getRevenueByCategory: publicProcedure
    .input(
      z.object({
        days: z.number().optional().default(30),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - input.days);

      // Get revenue by category
      const categoryRevenue = await db
        .select({
          categoryId: productCategories.id,
          categoryName: productCategories.name,
          totalRevenue: sql<string>`SUM(${orderItems.subtotal})`,
          orderCount: sql<number>`COUNT(DISTINCT ${orderItems.orderId})`,
          totalQuantity: sql<number>`SUM(${orderItems.quantity})`,
        })
        .from(orderItems)
        .leftJoin(products, eq(orderItems.productId, products.id))
        .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(
          and(
            gte(orders.createdAt, daysAgo),
            eq(orders.status, "delivered")
          )
        )
        .groupBy(productCategories.id, productCategories.name)
        .orderBy(desc(sql`SUM(${orderItems.subtotal})`));

      return categoryRevenue.map(c => ({
        categoryId: c.categoryId,
        categoryName: c.categoryName || "Uncategorized",
        totalRevenue: parseFloat(c.totalRevenue || "0"),
        orderCount: c.orderCount,
        totalQuantity: c.totalQuantity,
      }));
    }),

  // Get product performance metrics
  getProductPerformance: publicProcedure
    .input(
      z.object({
        days: z.number().optional().default(30),
        limit: z.number().optional().default(50),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - input.days);

      // Get detailed product performance
      const productPerformance = await db
        .select({
          productId: orderItems.productId,
          productName: orderItems.productName,
          productPrice: orderItems.productPrice,
          totalQuantity: sql<number>`SUM(${orderItems.quantity})`,
          totalRevenue: sql<string>`SUM(${orderItems.subtotal})`,
          orderCount: sql<number>`COUNT(DISTINCT ${orderItems.orderId})`,
          avgQuantityPerOrder: sql<string>`AVG(${orderItems.quantity})`,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(
          and(
            gte(orders.createdAt, daysAgo),
            eq(orders.status, "delivered")
          )
        )
        .groupBy(orderItems.productId, orderItems.productName, orderItems.productPrice)
        .orderBy(desc(sql`SUM(${orderItems.subtotal})`))
        .limit(input.limit);

      return productPerformance.map(p => ({
        productId: p.productId,
        productName: p.productName,
        productPrice: parseFloat(p.productPrice),
        totalQuantity: p.totalQuantity,
        totalRevenue: parseFloat(p.totalRevenue || "0"),
        orderCount: p.orderCount,
        avgQuantityPerOrder: parseFloat(p.avgQuantityPerOrder || "0"),
      }));
    }),

  // Get sales summary
  getSalesSummary: publicProcedure
    .input(
      z.object({
        days: z.number().optional().default(30),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - input.days);

      // Get summary stats
      const [summary] = await db
        .select({
          totalOrders: count(),
          totalRevenue: sql<string>`SUM(CASE WHEN ${orders.status} = 'delivered' THEN ${orders.total} ELSE 0 END)`,
          totalItems: sql<number>`SUM(CASE WHEN ${orders.status} = 'delivered' THEN 1 ELSE 0 END)`,
          avgOrderValue: sql<string>`AVG(CASE WHEN ${orders.status} = 'delivered' THEN ${orders.total} ELSE 0 END)`,
          deliveredOrders: sql<number>`SUM(CASE WHEN ${orders.status} = 'delivered' THEN 1 ELSE 0 END)`,
          cancelledOrders: sql<number>`SUM(CASE WHEN ${orders.status} = 'cancelled' THEN 1 ELSE 0 END)`,
        })
        .from(orders)
        .where(gte(orders.createdAt, daysAgo));

      return {
        totalOrders: summary?.totalOrders || 0,
        totalRevenue: parseFloat(summary?.totalRevenue || "0"),
        totalItems: summary?.totalItems || 0,
        avgOrderValue: parseFloat(summary?.avgOrderValue || "0"),
        deliveredOrders: summary?.deliveredOrders || 0,
        cancelledOrders: summary?.cancelledOrders || 0,
        conversionRate: summary?.totalOrders ? ((summary?.deliveredOrders || 0) / (summary?.totalOrders || 1) * 100).toFixed(1) : "0",
      };
    }),

  // Get most viewed/trending products (based on order frequency)
  getMostViewedProducts: publicProcedure
    .input(
      z.object({
        limit: z.number().optional().default(10),
        days: z.number().optional().default(30),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - input.days);

      // Get most frequently ordered products (trending)
      const trendingProducts = await db
        .select({
          productId: orderItems.productId,
          productName: orderItems.productName,
          productPrice: orderItems.productPrice,
          orderCount: sql<number>`COUNT(DISTINCT ${orderItems.orderId})`,
          totalQuantity: sql<number>`SUM(${orderItems.quantity})`,
          totalRevenue: sql<string>`SUM(${orderItems.subtotal})`,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(
          and(
            gte(orders.createdAt, daysAgo),
            eq(orders.status, "delivered")
          )
        )
        .groupBy(orderItems.productId, orderItems.productName, orderItems.productPrice)
        .orderBy(desc(sql`COUNT(DISTINCT ${orderItems.orderId})`))
        .limit(input.limit);

      return trendingProducts.map(p => ({
        productId: p.productId,
        productName: p.productName,
        productPrice: parseFloat(p.productPrice),
        views: p.orderCount, // Number of orders containing this product
        totalQuantity: p.totalQuantity,
        totalRevenue: parseFloat(p.totalRevenue || "0"),
      }));
    }),
});
