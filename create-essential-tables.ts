import postgres from "postgres";

const backupUrl = process.env.DATABASE_URL_BACKUP;
if (!backupUrl) {
  console.error("DATABASE_URL_BACKUP not set");
  process.exit(1);
}

const sql = postgres(backupUrl, { ssl: "require" });

async function createTables() {
  try {
    console.log("Creating essential tables on Railway PostgreSQL...");
    
    // Create stores table
    await sql`
      CREATE TABLE IF NOT EXISTS "stores" (
        "id" serial PRIMARY KEY,
        "name" varchar(255) NOT NULL,
        "slug" varchar(255) NOT NULL,
        "description" text,
        "category" varchar(100),
        "logo" varchar(500),
        "address" text,
        "eircode" varchar(50),
        "latitude" decimal(10,8),
        "longitude" decimal(11,8),
        "phone" varchar(20),
        "email" varchar(255),
        "is_open_247" boolean DEFAULT false,
        "opening_hours" text,
        "is_active" boolean DEFAULT true,
        "short_code" varchar(50),
        "order_counter" integer DEFAULT 0,
        "sort_position" integer DEFAULT 0,
        "is_featured" boolean DEFAULT false,
        "auto_print_enabled" boolean DEFAULT false,
        "auto_print_threshold" integer,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log("✅ stores table created");
    
    // Verify
    const result = await sql`SELECT COUNT(*) as count FROM "stores"`;
    console.log(`✅ Stores table verified! Count: ${result[0].count}`);
    
  } catch (error: any) {
    console.error("Error:", error.message);
  } finally {
    await sql.end();
  }
}

createTables();
