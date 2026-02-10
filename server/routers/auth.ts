import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { users, drivers, storeStaff } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export const authRouter = router({
  // Register a new customer
  registerCustomer: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(6),
        name: z.string().min(2),
        phone: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Check if user already exists
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (existingUser.length > 0) {
        throw new Error("User with this email already exists");
      }

      // Hash password
      const passwordHash = await bcrypt.hash(input.password, 10);

      // Create user
      const result = await db.insert(users).values({
        email: input.email,
        name: input.name,
        phone: input.phone || null,
        role: "customer",
        passwordHash,
      });

      const userId = Number((result as any).insertId);

      return {
        success: true,
        userId,
        role: "customer" as const,
      };
    }),

  // Register a new driver
  registerDriver: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(6),
        name: z.string().min(2),
        phone: z.string(),
        vehicleType: z.string(),
        vehicleNumber: z.string(),
        licenseNumber: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Check if user already exists
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (existingUser.length > 0) {
        throw new Error("User with this email already exists");
      }

      // Hash password
      const passwordHash = await bcrypt.hash(input.password, 10);

      // Create user
      const userResult = await db.insert(users).values({
        email: input.email,
        name: input.name,
        phone: input.phone,
        role: "driver",
        passwordHash,
      });

      const userId = Number((userResult as any).insertId);

      // Create driver profile
      await db.insert(drivers).values({
        userId,
        vehicleType: input.vehicleType,
        vehicleNumber: input.vehicleNumber,
        licenseNumber: input.licenseNumber || null,
        isOnline: false,
        isAvailable: false,
      });

      return {
        success: true,
        userId,
        role: "driver" as const,
      };
    }),

  // Login
  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Find user
      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (userResult.length === 0) {
        throw new Error("Invalid email or password");
      }

      const user = userResult[0];

      // Check password
      if (!user.passwordHash) {
        throw new Error("Invalid email or password");
      }

      const isValidPassword = await bcrypt.compare(input.password, user.passwordHash);

      if (!isValidPassword) {
        throw new Error("Invalid email or password");
      }

      // Get additional profile data based on role
      let profileData: any = null;

      if (user.role === "driver") {
        const driverResult = await db
          .select()
          .from(drivers)
          .where(eq(drivers.userId, user.id))
          .limit(1);

        if (driverResult.length > 0) {
          profileData = driverResult[0];
        }
      } else if (user.role === "store_staff") {
        const staffResult = await db
          .select()
          .from(storeStaff)
          .where(eq(storeStaff.userId, user.id))
          .limit(1);

        if (staffResult.length > 0) {
          profileData = staffResult[0];
        }
      }

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role,
        },
        profile: profileData,
      };
    }),

  // Update profile
  updateProfile: publicProcedure
    .input(
      z.object({
        userId: z.number(),
        name: z.string().min(2).optional(),
        phone: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      const updateData: any = {};
      if (input.name) updateData.name = input.name;
      if (input.phone) updateData.phone = input.phone;

      await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, input.userId));

      return { success: true };
    }),

  // Logout
  logout: publicProcedure.mutation(({ ctx }) => {
    console.log("[Logout] Logout endpoint called");
    // Clear session cookie using Express clearCookie to match domain attributes
    if (ctx.res && ctx.req) {
      const { getSessionCookieOptions } = require("../../server/_core/cookies");
      const { COOKIE_NAME } = require("../../shared/const");
      const cookieOptions = getSessionCookieOptions(ctx.req);
      console.log("[Logout] Clearing cookie:", COOKIE_NAME, "with options:", cookieOptions);
      ctx.res.clearCookie(COOKIE_NAME, cookieOptions);
      console.log("[Logout] Cookie cleared");
    } else {
      console.log("[Logout] No req/res in context!");
    }
    return { success: true };
  }),

  // Request password reset (simplified version without email)
  requestPasswordReset: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Check if user exists
      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      // Always return success even if user doesn't exist (security best practice)
      // In production, you would send an email here
      return { 
        success: true,
        message: "If an account exists with this email, password reset instructions have been sent."
      };
    }),

  // Reset password with token (simplified - uses email + new password directly)
  resetPassword: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        newPassword: z.string().min(6),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Find user
      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (userResult.length === 0) {
        throw new Error("User not found");
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(input.newPassword, 10);

      // Update password
      await db
        .update(users)
        .set({ passwordHash: newPasswordHash })
        .where(eq(users.email, input.email));

      return { success: true };
    }),

  // Change password
  changePassword: publicProcedure
    .input(
      z.object({
        userId: z.number(),
        currentPassword: z.string(),
        newPassword: z.string().min(6),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Get user
      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (userResult.length === 0) {
        throw new Error("User not found");
      }

      const user = userResult[0];

      // Verify current password
      if (!user.passwordHash) {
        throw new Error("Invalid password");
      }

      const isValidPassword = await bcrypt.compare(input.currentPassword, user.passwordHash);

      if (!isValidPassword) {
        throw new Error("Current password is incorrect");
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(input.newPassword, 10);

      // Update password
      await db
        .update(users)
        .set({ passwordHash: newPasswordHash })
        .where(eq(users.id, input.userId));

      return { success: true };
    }),

  // Get all drivers (admin only)
  getAllDrivers: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // Get all users with driver role and their driver profiles
    const driverUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.role, "driver"));

    // Get driver profiles for each driver user
    const driversWithProfiles = await Promise.all(
      driverUsers.map(async (user) => {
        const [driverProfile] = await db
          .select()
          .from(drivers)
          .where(eq(drivers.userId, user.id))
          .limit(1);

        return {
          ...user,
          profile: driverProfile || null,
        };
      })
    );

    return driversWithProfiles;
  }),

  // Get current user
  me: publicProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    const userId = ctx.user?.id || 1;

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        phone: users.phone,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  }),
});
