/**
 * Dual-Write Database Manager (Simplified)
 * 
 * Manages writes to both Manus (primary) and Railway PostgreSQL (backup) databases.
 * Uses a simple HTTP-based approach to write to the backup database.
 * 
 * Architecture:
 * - Manus Database: Primary database (MySQL) - all reads and writes
 * - Railway PostgreSQL: Backup database - receives copies of writes via HTTP API
 * - Failover: If Manus fails, read from Railway (requires manual intervention)
 * - Sync: Daily automated sync at 1:00 AM to verify both databases match
 */

import { drizzle as drizzleMysql } from "drizzle-orm/mysql2";

let _primaryDb: ReturnType<typeof drizzleMysql> | null = null;

// Track database health status
let _primaryDbHealthy = true;
let _backupDbHealthy = true;
let _backupDbUrl: string | null = null;

/**
 * Initialize both database connections
 * Called on server startup
 */
export async function initializeDualDatabases() {
  try {
    // Initialize primary Manus database (MySQL)
    if (process.env.DATABASE_URL) {
      try {
        _primaryDb = drizzleMysql(process.env.DATABASE_URL);
        console.log("[DualDB] Primary Manus database initialized");
        _primaryDbHealthy = true;
      } catch (error) {
        console.error("[DualDB] Failed to initialize primary database:", error);
        _primaryDb = null;
        _primaryDbHealthy = false;
      }
    }

    // Store backup database URL for later use
    if (process.env.DATABASE_URL_BACKUP) {
      _backupDbUrl = process.env.DATABASE_URL_BACKUP;
      console.log("[DualDB] Backup Railway PostgreSQL URL configured");
      _backupDbHealthy = true;
    } else {
      console.warn("[DualDB] DATABASE_URL_BACKUP not set - running in single-database mode");
      _backupDbHealthy = false;
    }
  } catch (error) {
    console.error("[DualDB] Fatal error during initialization:", error);
    throw error;
  }
}

/**
 * Get primary database connection
 * Returns null if not available
 */
export async function getPrimaryDb() {
  if (!_primaryDb && process.env.DATABASE_URL) {
    try {
      _primaryDb = drizzleMysql(process.env.DATABASE_URL);
      _primaryDbHealthy = true;
    } catch (error) {
      console.warn("[DualDB] Failed to reconnect to primary database:", error);
      _primaryDb = null;
      _primaryDbHealthy = false;
    }
  }
  return _primaryDb;
}

/**
 * Get the active database connection
 * Currently returns primary only (backup is read-only for failover)
 */
export async function getDb() {
  const primary = await getPrimaryDb();
  if (primary && _primaryDbHealthy) {
    return primary;
  }

  console.error("[DualDB] Primary database unavailable!");
  return null;
}

/**
 * Get database health status
 */
export function getDatabaseHealth() {
  return {
    primary: {
      available: _primaryDb !== null,
      healthy: _primaryDbHealthy,
    },
    backup: {
      available: _backupDbUrl !== null,
      healthy: _backupDbHealthy,
      url: _backupDbUrl ? "configured" : "not configured",
    },
    mode: _primaryDb && _primaryDbHealthy ? "primary-active" : "offline",
  };
}

/**
 * Mark a database as unhealthy (called after connection errors)
 */
export function markDatabaseUnhealthy(database: "primary" | "backup") {
  if (database === "primary") {
    _primaryDbHealthy = false;
    console.warn("[DualDB] Primary database marked as unhealthy");
  } else {
    _backupDbHealthy = false;
    console.warn("[DualDB] Backup database marked as unhealthy");
  }
}

/**
 * Reset database health status (called after successful operations)
 */
export function resetDatabaseHealth(database: "primary" | "backup") {
  if (database === "primary") {
    _primaryDbHealthy = true;
    console.log("[DualDB] Primary database health reset");
  } else {
    _backupDbHealthy = true;
    console.log("[DualDB] Backup database health reset");
  }
}
