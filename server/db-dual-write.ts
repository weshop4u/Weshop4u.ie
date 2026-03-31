/**
 * Dual-Write Database Manager with Automatic Failover
 * 
 * Manages reads/writes to both Manus (primary) and Railway PostgreSQL (backup) databases.
 * Automatically switches to backup when primary is unavailable.
 * 
 * Architecture:
 * - Manus Database: Primary database (MySQL) - preferred for all operations
 * - Railway PostgreSQL: Backup database - automatic failover when Manus unavailable
 * - Failover: Automatic - if Manus fails, all queries route to Railway
 * - Sync: Daily automated sync at 1:00 AM to verify both databases match
 */

import { drizzle as drizzleMysql } from "drizzle-orm/mysql2";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";

let _primaryDb: any = null;
let _backupDb: any = null;
let _backupSql: ReturnType<typeof postgres> | null = null;

// Track database health status
let _primaryDbHealthy = true;
let _backupDbHealthy = false;
let _currentMode: "primary" | "backup" | "offline" = "offline";

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
        console.log("[DualDB] ✓ Primary Manus database initialized");
        _primaryDbHealthy = true;
      } catch (error) {
        console.error("[DualDB] ✗ Failed to initialize primary database:", error);
        _primaryDb = null;
        _primaryDbHealthy = false;
      }
    }

    // Initialize backup Railway PostgreSQL database
    if (process.env.DATABASE_URL_BACKUP) {
      try {
        _backupSql = postgres(process.env.DATABASE_URL_BACKUP, {
          max: 20,
          idle_timeout: 30,
          connect_timeout: 10,
        });
        _backupDb = drizzlePostgres(_backupSql);
        console.log("[DualDB] ✓ Backup Railway PostgreSQL database initialized");
        _backupDbHealthy = true;
      } catch (error) {
        console.error("[DualDB] ✗ Failed to initialize backup database:", error);
        _backupDb = null;
        _backupDbHealthy = false;
      }
    } else {
      console.warn("[DualDB] ⚠ DATABASE_URL_BACKUP not set - running in single-database mode");
    }

    // Determine initial mode
    if (_primaryDb && _primaryDbHealthy) {
      _currentMode = "primary";
      console.log("[DualDB] Mode: PRIMARY-ACTIVE");
    } else if (_backupDb && _backupDbHealthy) {
      _currentMode = "backup";
      console.log("[DualDB] Mode: BACKUP-ACTIVE (Primary unavailable)");
    } else {
      _currentMode = "offline";
      console.log("[DualDB] Mode: OFFLINE (No databases available)");
    }
  } catch (error) {
    console.error("[DualDB] Fatal error during initialization:", error);
    throw error;
  }
}

/**
 * Test primary database connection
 */
async function testPrimaryConnection(): Promise<boolean> {
  if (!_primaryDb) return false;
  try {
    // Try a simple query to verify connection
    await _primaryDb.execute("SELECT 1");
    return true;
  } catch (error) {
    console.warn("[DualDB] Primary database connection test failed");
    return false;
  }
}

/**
 * Test backup database connection
 */
async function testBackupConnection(): Promise<boolean> {
  if (!_backupDb || !_backupSql) return false;
  try {
    // Try a simple query to verify connection
    await _backupSql`SELECT 1`;
    return true;
  } catch (error) {
    console.warn("[DualDB] Backup database connection test failed");
    return false;
  }
}

/**
 * Get the active database connection
 * Automatically switches to backup if primary is unavailable
 */
export async function getDb(): Promise<any> {
  // If currently using primary, verify it's still healthy
  if (_currentMode === "primary" && _primaryDb && _primaryDbHealthy) {
    const isHealthy = await testPrimaryConnection();
    if (isHealthy) {
      return _primaryDb;
    }
    console.warn("[DualDB] Primary database connection lost, switching to backup");
    _primaryDbHealthy = false;
    _currentMode = "backup";
  }

  // If primary is down, try backup
  if (_currentMode === "backup" || (_primaryDbHealthy === false && _backupDb)) {
    if (_backupDb && _backupDbHealthy) {
      const isHealthy = await testBackupConnection();
      if (isHealthy) {
        _currentMode = "backup";
        console.log("[DualDB] Using BACKUP database (Railway PostgreSQL)");
        return _backupDb;
      }
      _backupDbHealthy = false;
    }
  }

  // Try to reconnect to primary
  if (!_primaryDb && process.env.DATABASE_URL) {
    try {
      _primaryDb = drizzleMysql(process.env.DATABASE_URL);
      const isHealthy = await testPrimaryConnection();
      if (isHealthy) {
        _primaryDbHealthy = true;
        _currentMode = "primary";
        console.log("[DualDB] Reconnected to PRIMARY database");
        return _primaryDb;
      }
    } catch (error) {
      console.warn("[DualDB] Failed to reconnect to primary");
    }
  }

  // Try to reconnect to backup
  if (!_backupDb && process.env.DATABASE_URL_BACKUP) {
    try {
      _backupSql = postgres(process.env.DATABASE_URL_BACKUP, {
        max: 20,
        idle_timeout: 30,
        connect_timeout: 10,
      });
      _backupDb = drizzlePostgres(_backupSql);
      const isHealthy = await testBackupConnection();
      if (isHealthy) {
        _backupDbHealthy = true;
        _currentMode = "backup";
        console.log("[DualDB] Reconnected to BACKUP database");
        return _backupDb;
      }
    } catch (error) {
      console.warn("[DualDB] Failed to reconnect to backup");
    }
  }

  console.error("[DualDB] ✗ No databases available!");
  _currentMode = "offline";
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
      available: _backupDb !== null,
      healthy: _backupDbHealthy,
    },
    mode: _currentMode,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Mark a database as unhealthy (called after connection errors)
 */
export function markDatabaseUnhealthy(database: "primary" | "backup") {
  if (database === "primary") {
    _primaryDbHealthy = false;
    console.warn("[DualDB] Primary database marked as unhealthy");
    // Trigger failover to backup
    if (_backupDb && _backupDbHealthy) {
      _currentMode = "backup";
      console.log("[DualDB] Failover triggered: switching to BACKUP");
    }
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
    _currentMode = "primary";
    console.log("[DualDB] Primary database health reset");
  } else {
    _backupDbHealthy = true;
    console.log("[DualDB] Backup database health reset");
  }
}

/**
 * Graceful shutdown
 */
export async function shutdownDatabases() {
  try {
    if (_backupSql) {
      await _backupSql.end();
      console.log("[DualDB] Backup database connection closed");
    }
  } catch (error) {
    console.error("[DualDB] Error closing backup database:", error);
  }
}
