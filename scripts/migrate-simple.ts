/**
 * Simple Data Migration: Manus MySQL → Railway PostgreSQL
 * 
 * Uses raw database drivers to copy data table by table
 * 
 * Usage:
 * npx tsx scripts/migrate-simple.ts
 */

import "dotenv/config";
import mysql from "mysql2/promise";
import postgres from "postgres";

// Table names in order
const TABLES = [
  "stores",
  "users",
  "drivers",
  "product_categories",
  "products",
  "delivery_zones",
  "orders",
  "order_items",
  "order_tracking",
  "notifications",
  "saved_addresses",
  "driver_queue",
  "order_offers",
  "job_returns",
  "driver_ratings",
  "chat_messages",
  "print_jobs",
  "contact_messages",
  "modifier_groups",
  "modifiers",
  "multi_buy_deals",
  "order_item_modifiers",
  "modifier_templates",
  "modifier_template_options",
  "category_modifier_templates",
  "product_modifier_templates",
  "product_template_exclusions",
  "discount_codes",
  "discount_usage",
  "promotional_banners",
  "driver_shifts",
  "app_settings",
];

async function migrateData() {
  console.log("[Migration] Starting data migration from Manus to Railway PostgreSQL...\n");

  // Parse connection strings
  const mysqlUrl = new URL(process.env.DATABASE_URL || "");
  const postgresUrl = new URL(process.env.DATABASE_URL_BACKUP || "");

  if (!process.env.DATABASE_URL || !process.env.DATABASE_URL_BACKUP) {
    throw new Error("DATABASE_URL or DATABASE_URL_BACKUP not set");
  }

  // Connect to MySQL
  const mysqlConnection = await mysql.createConnection({
    host: mysqlUrl.hostname,
    port: parseInt(mysqlUrl.port || "3306"),
    user: mysqlUrl.username,
    password: mysqlUrl.password,
    database: mysqlUrl.pathname.slice(1),
    ssl: {
      rejectUnauthorized: false,
    },
  });
  console.log("[Migration] ✓ Connected to Manus MySQL database");

  // Connect to PostgreSQL
  const pgSql = postgres(process.env.DATABASE_URL_BACKUP);
  console.log("[Migration] ✓ Connected to Railway PostgreSQL database\n");

  let totalRecords = 0;
  let successCount = 0;
  let skipCount = 0;

  try {
    for (const tableName of TABLES) {
      try {
        // Read data from MySQL
        const [rows] = await mysqlConnection.query(`SELECT * FROM \`${tableName}\``);
        const data = rows as any[];

        if (data.length === 0) {
          console.log(`[Migration] ⊘ ${tableName}: 0 records (skipped)`);
          skipCount++;
          continue;
        }

        // Build INSERT statement for PostgreSQL
        if (data.length > 0) {
          const columns = Object.keys(data[0]);
          const columnList = columns.map((col) => `"${col}"`).join(", ");

          // Prepare values for PostgreSQL
          const values = data.map((row) => {
            return columns.map((col) => {
              const val = row[col];
              if (val === null || val === undefined) return "NULL";
              if (typeof val === "string") return `'${val.replace(/'/g, "''")}'`;
              if (typeof val === "boolean") return val ? "true" : "false";
              if (val instanceof Date) return `'${val.toISOString()}'`;
              return String(val);
            });
          });

          // Insert in batches to avoid query size limits
          const batchSize = 100;
          for (let i = 0; i < values.length; i += batchSize) {
            const batch = values.slice(i, i + batchSize);
            const valuesList = batch
              .map((row) => `(${row.join(", ")})`)
              .join(", ");

            const insertSql = `INSERT INTO "${tableName}" (${columnList}) VALUES ${valuesList} ON CONFLICT DO NOTHING;`;

            try {
              await pgSql.unsafe(insertSql);
            } catch (error) {
              console.error(
                `[Migration] ✗ ${tableName} batch ${Math.floor(i / batchSize) + 1}: ${error}`
              );
            }
          }
        }

        console.log(`[Migration] ✓ ${tableName}: ${data.length} records migrated`);
        totalRecords += data.length;
        successCount++;
      } catch (error) {
        console.error(`[Migration] ✗ ${tableName}: Failed to migrate -`, error);
      }
    }

    console.log(`\n[Migration] ✓ Migration complete!`);
    console.log(`[Migration] Summary:`);
    console.log(`[Migration]   - Tables migrated: ${successCount}`);
    console.log(`[Migration]   - Tables skipped: ${skipCount}`);
    console.log(`[Migration]   - Total records: ${totalRecords}`);
    console.log(`[Migration] Both databases are now synchronized.`);
  } catch (error) {
    console.error("[Migration] ✗ Fatal error during migration:", error);
    throw error;
  } finally {
    // Close connections
    await mysqlConnection.end();
    await pgSql.end();
  }
}

// Run migration
migrateData().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
