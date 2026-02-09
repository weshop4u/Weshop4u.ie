import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export const usersRouter = router({
  // Update user profile
  updateProfile: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // For now, update user 1 (in production, use ctx.user.id)
      const userId = ctx.user?.id || 1;

      await db
        .update(users)
        .set({
          name: input.name,
          email: input.email,
          phone: input.phone,
        })
        .where(eq(users.id, userId));

      return { success: true };
    }),

  // Get current user profile
  getProfile: publicProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // For now, get user 1 (in production, use ctx.user.id)
    const userId = ctx.user?.id || 1;

    const user = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
      throw new Error("User not found");
    }

    return user[0];
  }),
});
