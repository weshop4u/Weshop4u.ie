import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { users } from "../drizzle/schema";

let _db: any = null;
// Railway PostgreSQL deployment - v1.0.4 - Force rebuild

// Lazily create the drizzle instance for MySQL
export async function getDb() {
  const dbUrl = process.env.DATABASE_URL || process.env.DATABASE_URL_BACKUP;
  
  if (!_db && dbUrl) {
    try {
      const connection = await mysql.createConnection(dbUrl);
      _db = drizzle(connection);
      console.log(`[Database] ✅ Connected to MySQL`);
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

    // PostgreSQL upsert syntax
    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.email,
      set: {
        name: user.name || values.name,
        phone: user.phone || values.phone,
        passwordHash: user.passwordHash || values.passwordHash,
      },
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
