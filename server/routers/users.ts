import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { storagePut } from "../storage";

export const usersRouter = router({
  // Upload profile picture to storage
  uploadProfilePicture: publicProcedure
    .input(
      z.object({
        base64: z.string(),
        mimeType: z.string().default("image/jpeg"),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // Strip data URL prefix if present (e.g. "data:image/jpeg;base64,...")
        let rawBase64 = input.base64;
        if (rawBase64.includes(",")) {
          rawBase64 = rawBase64.split(",")[1];
        }
        const buffer = Buffer.from(rawBase64, "base64");
        const ext = input.mimeType.split("/")[1] || "jpg";
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const filename = `profile-picture-${timestamp}-${random}.${ext}`;
        const result = await storagePut(`profile-pictures/${filename}`, buffer, input.mimeType);
        // Ensure we return plain JSON
        return JSON.parse(JSON.stringify({ url: result.url }));
      } catch (error: any) {
        throw new Error(`Failed to upload profile picture: ${error.message}`);
      }
    }),

  // Update user profile
  updateProfile: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        phone: z.string().optional(),
        profilePicture: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }

        if (!ctx.user?.id) {
          throw new Error("Authentication required to update profile");
        }
        const userId = ctx.user.id;

        const updateData: Record<string, any> = {
          name: input.name,
        };

        // Only include optional fields if provided
        if (input.phone !== undefined && input.phone !== null) {
          updateData.phone = input.phone;
        }
        if (input.profilePicture !== undefined && input.profilePicture !== null) {
          updateData.profilePicture = input.profilePicture;
        }

        const result = await db
          .update(users)
          .set(updateData)
          .where(eq(users.id, userId));

        // Ensure we return plain JSON, not Drizzle objects
        return JSON.parse(JSON.stringify({ success: true }));
      } catch (error: any) {
        console.error("[updateProfile] Error:", error);
        throw new Error(error.message || "Failed to update profile");
      }
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
