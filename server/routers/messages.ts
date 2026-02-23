import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { contactMessages } from "../../drizzle/schema";
import { eq, desc, sql } from "drizzle-orm";

export const messagesRouter = router({
  // Public: anyone can submit a contact message
  submit: publicProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required").max(255),
        email: z.string().email("Invalid email").max(320),
        subject: z.string().min(1, "Subject is required").max(500),
        message: z.string().min(1, "Message is required").max(5000),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.insert(contactMessages).values({
        name: input.name,
        email: input.email,
        subject: input.subject,
        message: input.message,
      });

      return { success: true };
    }),

  // Admin: list all messages with pagination
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        filter: z.enum(["all", "unread", "read"]).default("all"),
      })
    )
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new Error("Admin access required");

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const offset = (input.page - 1) * input.limit;

      // Build where condition
      let whereCondition;
      if (input.filter === "unread") {
        whereCondition = eq(contactMessages.isRead, false);
      } else if (input.filter === "read") {
        whereCondition = eq(contactMessages.isRead, true);
      }

      const messages = await db
        .select()
        .from(contactMessages)
        .where(whereCondition)
        .orderBy(desc(contactMessages.createdAt))
        .limit(input.limit)
        .offset(offset);

      // Get counts
      const [totalResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(contactMessages)
        .where(whereCondition);

      const [unreadResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(contactMessages)
        .where(eq(contactMessages.isRead, false));

      return {
        messages,
        total: totalResult?.count || 0,
        unreadCount: unreadResult?.count || 0,
        page: input.page,
        totalPages: Math.ceil((totalResult?.count || 0) / input.limit),
      };
    }),

  // Admin: mark message as read/unread
  markRead: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        isRead: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new Error("Admin access required");

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(contactMessages)
        .set({ isRead: input.isRead })
        .where(eq(contactMessages.id, input.id));

      return { success: true };
    }),

  // Admin: delete a message
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new Error("Admin access required");

      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.delete(contactMessages).where(eq(contactMessages.id, input.id));

      return { success: true };
    }),
});
