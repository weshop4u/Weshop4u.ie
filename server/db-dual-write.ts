/**
 * Single Database Manager - TiDB Cloud (MySQL)
 * 
 * Simplified database connection using only TiDB Cloud MySQL.
 * Removed Railway backup database logic that was causing 10-second timeouts on every request.
 */

import { drizzle as drizzleMysql } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

let _db: any = null;
let _pool: any = null;

/**
 * Initialize database connection
 * Called on server startup
 */
export async function initializeDualDatabases() {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set");
    }

    // Create MySQL connection pool from TiDB Cloud
    _pool = await mysql.createPool(process.env.DATABASE_URL);
    _db = drizzleMysql(_pool);
    
    console.log("[DB] ✓ TiDB Cloud database initialized");
  } catch (error) {
    console.error("[DB] ✗ Failed to initialize database:", error);
    throw error;
  }
}

/**
 * Get the database connection
 * Returns the TiDB Cloud Drizzle ORM instance
 */
export async function getDb(): Promise<any> {
  if (!_db) {
    throw new Error("Database not initialized. Call initializeDualDatabases() first.");
  }
  return _db;
}

/**
 * Get the currently active database instance
 * Used for debugging and health checks
 */
export function getActiveDb(): any {
  return _db;
}

/**
 * Get database health status
 */
export function getDatabaseHealth() {
  return {
    database: "TiDB Cloud",
    available: _db !== null,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Graceful shutdown
 */
export async function shutdownDatabases() {
  try {
    if (_pool) {
      await _pool.end();
      console.log("[DB] Database connection pool closed");
    }
  } catch (error) {
    console.error("[DB] Error closing database connection:", error);
  }
}
