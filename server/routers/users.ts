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
        profilePicture: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      if (!ctx.user?.id) {
        throw new Error("Authentication required to update profile");
      }
      const userId = ctx.user.id;

      await db
        .update(users)
        .set({
          name: input.name,
          email: input.email,
          phone: input.phone,
          profilePicture: input.profilePicture,
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

    if (!ctx.user?.id) {
      return null; // Guest users have no profile
    }
    const userId = ctx.user.id;

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
