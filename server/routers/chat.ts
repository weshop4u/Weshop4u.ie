import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { chatMessages, users, orders } from "../../drizzle/schema";
import { eq, and, desc, gt, sql } from "drizzle-orm";

export const chatRouter = router({
  // Send a chat message
  sendMessage: publicProcedure
    .input(
      z.object({
        orderId: z.number(),
        senderId: z.number(),
        senderRole: z.enum(["customer", "driver"]),
        message: z.string().min(1).max(1000),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Verify the order exists and is active
      const order = await db
        .select()
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1);

      if (order.length === 0) {
        throw new Error("Order not found");
      }

      const activeStatuses = ["pending", "preparing", "ready_for_pickup", "picked_up", "on_the_way"];
      if (!activeStatuses.includes(order[0].status)) {
        throw new Error("Chat is only available for active orders");
      }

      await db.insert(chatMessages).values({
        orderId: input.orderId,
        senderId: input.senderId,
        senderRole: input.senderRole,
        message: input.message,
      });

      return { success: true };
    }),

  // Get messages for an order
  getMessages: publicProcedure
    .input(
      z.object({
        orderId: z.number(),
        afterId: z.number().optional(), // For polling only new messages
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      let conditions = [eq(chatMessages.orderId, input.orderId)];
      if (input.afterId) {
        conditions.push(gt(chatMessages.id, input.afterId));
      }

      const messages = await db
        .select({
          id: chatMessages.id,
          orderId: chatMessages.orderId,
          senderId: chatMessages.senderId,
          senderRole: chatMessages.senderRole,
          message: chatMessages.message,
          createdAt: chatMessages.createdAt,
          senderName: users.name,
        })
        .from(chatMessages)
        .leftJoin(users, eq(chatMessages.senderId, users.id))
        .where(and(...conditions))
        .orderBy(chatMessages.createdAt);

      return messages;
    }),

  // Get unread count for a user on an order
  getUnreadCount: publicProcedure
    .input(
      z.object({
        orderId: z.number(),
        userId: z.number(),
        userRole: z.enum(["customer", "driver"]),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { count: 0 };

      // Count messages NOT sent by this user (i.e., messages from the other party)
      const otherRole = input.userRole === "customer" ? "driver" : "customer";

      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(chatMessages)
        .where(
          and(
            eq(chatMessages.orderId, input.orderId),
            eq(chatMessages.senderRole, otherRole)
          )
        );

      return { count: result[0]?.count || 0 };
    }),
});
