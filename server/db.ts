import { eq } from "drizzle-orm";
import { drizzle as drizzleMysql } from "drizzle-orm/mysql2";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: any = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  // Priority: Use Railway PostgreSQL (DATABASE_URL_BACKUP) as primary
  // Fallback: Use Manus MySQL (DATABASE_URL) for development
  const dbUrl = process.env.DATABASE_URL_BACKUP || process.env.DATABASE_URL;
  
  if (!_db && dbUrl) {
    try {
      const isPostgres = dbUrl.includes("railway") || dbUrl.includes("postgres");
      
      if (isPostgres) {
        // Use PostgreSQL driver for Railway
        const client = postgres(dbUrl);
        _db = drizzlePostgres(client);
        console.log(`[Database] Connected to Railway PostgreSQL`);
      } else {
        // Use MySQL driver for Manus
        _db = drizzleMysql(dbUrl);
        console.log(`[Database] Connected to Manus MySQL`);
      }
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// Type for inserting a new user
export type InsertUser = typeof users.$inferInsert;
export type SelectUser = typeof users.$inferSelect;

// Upsert user by email (for WESHOP4U authentication)
export async function upsertUser(user: Partial<InsertUser> & { email: string }): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      email: user.email,
      name: user.name || user.email,
      phone: user.phone || null,
      role: user.role || "customer",
      passwordHash: user.passwordHash || null,
    };

    const updateSet: Partial<InsertUser> = {};
    if (user.name) updateSet.name = user.name;
    if (user.phone) updateSet.phone = user.phone;
    if (user.passwordHash) updateSet.passwordHash = user.passwordHash;

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// TODO: add feature queries here as your schema grows.
