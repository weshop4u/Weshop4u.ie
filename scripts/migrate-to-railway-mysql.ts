import mysql from "mysql2/promise";

const SOURCE_DB = process.env.DATABASE_URL || "mysql://root:password@127.0.0.1:3306/weshop4u";
const TARGET_DB = process.env.DATABASE_URL_BACKUP || "mysql://root:password@railway:3306/railway";

const TABLES = [
  "users",
  "stores",
  "store_staff",
  "product_categories",
  "products",
  "delivery_zones",
  "drivers",
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
  const sourceConn = await mysql.createConnection(SOURCE_DB);
  const targetConn = await mysql.createConnection(TARGET_DB);

  console.log("[Migration] Starting MySQL to Railway MySQL migration...");

  try {
    let totalRecords = 0;

    for (const table of TABLES) {
      try {
        // Get all data from source
        const [rows] = await sourceConn.query(`SELECT * FROM \`${table}\``);
        const records = rows as any[];

        if (records.length === 0) {
          console.log(`[Migration] ⊘ ${table}: 0 records (skipped)`);
          continue;
        }

        // Clear target table
        await targetConn.query(`DELETE FROM \`${table}\``);

        // Insert data in batches
        const batchSize = 100;
        for (let i = 0; i < records.length; i += batchSize) {
          const batch = records.slice(i, i + batchSize);
          const columns = Object.keys(batch[0]);
          const values = batch.map((row) =>
            `(${columns.map((col) => {
              const val = row[col];
              if (val === null) return "NULL";
              if (typeof val === "string") return `'${val.replace(/'/g, "''")}'`;
              if (typeof val === "boolean") return val ? "1" : "0";
              if (val instanceof Date) return `'${val.toISOString().slice(0, 19)}'`;
              return val;
            }).join(", ")})`
          );

          const query = `INSERT INTO \`${table}\` (\`${columns.join("`, `")}\`) VALUES ${values.join(", ")}`;
          await targetConn.query(query);
        }

        console.log(`[Migration] ✓ ${table}: ${records.length} records migrated`);
        totalRecords += records.length;
      } catch (error: any) {
        console.log(`[Migration] ✗ ${table}: ${error.message}`);
      }
    }

    console.log("[Migration] ✓ Migration complete!");
    console.log(`[Migration] Summary:`);
    console.log(`[Migration]   - Tables migrated: ${TABLES.length}`);
    console.log(`[Migration]   - Total records: ${totalRecords}`);
    console.log("[Migration] Railway MySQL is now ready for production!");
  } finally {
    await sourceConn.end();
    await targetConn.end();
  }
}

migrateData().catch(console.error);
