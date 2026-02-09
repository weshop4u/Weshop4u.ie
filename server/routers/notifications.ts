import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import {
  sendPushNotification,
  sendOrderStatusNotification,
  sendJobOfferNotification,
  sendNewOrderNotification,
  sendOrderReadyNotification,
} from "../services/notifications";

export const notificationsRouter = router({
  // Register push token for a user
  registerToken: publicProcedure
    .input(
      z.object({
        userId: z.number(),
        pushToken: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Update user's push token
      await db
        .update(users)
        .set({ pushToken: input.pushToken })
        .where(eq(users.id, input.userId));

      return { success: true };
    }),

  // Send test notification
  sendTest: publicProcedure
    .input(
      z.object({
        userId: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Get user's push token
      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (userResult.length === 0 || !userResult[0].pushToken) {
        throw new Error("User not found or push token not registered");
      }

      const success = await sendPushNotification(userResult[0].pushToken, {
        title: "Test Notification",
        body: "Your notifications are working! 🎉",
        data: { type: "test" },
      });

      return { success };
    }),

  // Send order status notification
  sendOrderStatus: publicProcedure
    .input(
      z.object({
        userId: z.number(),
        orderId: z.number(),
        status: z.string(),
        storeName: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Get user's push token
      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (userResult.length === 0 || !userResult[0].pushToken) {
        return { success: false, error: "User not found or push token not registered" };
      }

      const success = await sendOrderStatusNotification(
        userResult[0].pushToken,
        input.orderId,
        input.status,
        input.storeName
      );

      return { success };
    }),

  // Send job offer to driver
  sendJobOffer: publicProcedure
    .input(
      z.object({
        driverId: z.number(),
        orderId: z.number(),
        storeName: z.string(),
        deliveryFee: z.number(),
        distance: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Get driver's push token
      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.id, input.driverId))
        .limit(1);

      if (userResult.length === 0 || !userResult[0].pushToken) {
        return { success: false, error: "Driver not found or push token not registered" };
      }

      const success = await sendJobOfferNotification(
        userResult[0].pushToken,
        input.orderId,
        input.storeName,
        input.deliveryFee,
        input.distance
      );

      return { success };
    }),

  // Send new order to store
  sendNewOrder: publicProcedure
    .input(
      z.object({
        storeStaffId: z.number(),
        orderId: z.number(),
        customerName: z.string(),
        itemCount: z.number(),
        total: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Get store staff's push token
      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.id, input.storeStaffId))
        .limit(1);

      if (userResult.length === 0 || !userResult[0].pushToken) {
        return { success: false, error: "Store staff not found or push token not registered" };
      }

      const success = await sendNewOrderNotification(
        userResult[0].pushToken,
        input.orderId,
        input.customerName,
        input.itemCount,
        input.total
      );

      return { success };
    }),

  // Send order ready notification to driver
  sendOrderReady: publicProcedure
    .input(
      z.object({
        driverId: z.number(),
        orderId: z.number(),
        storeName: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Get driver's push token
      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.id, input.driverId))
        .limit(1);

      if (userResult.length === 0 || !userResult[0].pushToken) {
        return { success: false, error: "Driver not found or push token not registered" };
      }

      const success = await sendOrderReadyNotification(
        userResult[0].pushToken,
        input.orderId,
        input.storeName
      );

      return { success };
    }),
});
