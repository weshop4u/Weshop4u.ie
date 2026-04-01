import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { savedAddresses } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

export const addressesRouter = router({
  // Get all saved addresses for current user
  getAddresses: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user?.id) {
      return []; // Guest users have no saved addresses
    }

    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    const userId = ctx.user.id;

    const addresses = await db
      .select()
      .from(savedAddresses)
      .where(eq(savedAddresses.userId, userId));

    return addresses;
  }),

  // Add new address
  addAddress: publicProcedure
    .input(
      z.object({
        label: z.string().min(1),
        streetAddress: z.string().min(1),
        eircode: z.string().min(1),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        isDefault: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) {
        throw new Error("Authentication required to save addresses");
      }

      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      const userId = ctx.user.id;

      // If this is set as default, unset other defaults
      if (input.isDefault) {
        await db
          .update(savedAddresses)
          .set({ isDefault: false })
          .where(eq(savedAddresses.userId, userId));
      }

      const result: any = await db.insert(savedAddresses).values({
        userId,
        label: input.label,
        streetAddress: input.streetAddress,
        eircode: input.eircode,
        latitude: input.latitude,
        longitude: input.longitude,
        isDefault: input.isDefault || false,
      });

      return { success: true, id: Number(result.insertId) };
    }),

  // Update address
  updateAddress: publicProcedure
    .input(
      z.object({
        id: z.number(),
        label: z.string().min(1).optional(),
        streetAddress: z.string().min(1).optional(),
        eircode: z.string().min(1).optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        isDefault: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) {
        throw new Error("Authentication required to update addresses");
      }

      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      const userId = ctx.user.id;

      // If this is set as default, unset other defaults
      if (input.isDefault) {
        await db
          .update(savedAddresses)
          .set({ isDefault: false })
          .where(eq(savedAddresses.userId, userId));
      }

      const updateData: any = {};
      if (input.label) updateData.label = input.label;
      if (input.streetAddress) updateData.streetAddress = input.streetAddress;
      if (input.eircode) updateData.eircode = input.eircode;
      if (input.latitude) updateData.latitude = input.latitude;
      if (input.longitude) updateData.longitude = input.longitude;
      if (input.isDefault !== undefined) updateData.isDefault = input.isDefault;

      await db
        .update(savedAddresses)
        .set(updateData)
        .where(
          and(
            eq(savedAddresses.id, input.id),
            eq(savedAddresses.userId, userId)
          )
        );

      return { success: true };
    }),

  // Delete address
  deleteAddress: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user?.id) {
        throw new Error("Authentication required to delete addresses");
      }

      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      const userId = ctx.user.id;

      await db
        .delete(savedAddresses)
        .where(
          and(
            eq(savedAddresses.id, input.id),
            eq(savedAddresses.userId, userId)
          )
        );

      return { success: true };
    }),
});
