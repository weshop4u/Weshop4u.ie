import postgres from "postgres";

const backupUrl = process.env.DATABASE_URL_BACKUP;
if (!backupUrl) {
  console.error("DATABASE_URL_BACKUP not set");
  process.exit(1);
}

const sql = postgres(backupUrl, { ssl: "require" });

async function createCompleteSchema() {
  try {
    console.log("🔧 Creating complete PostgreSQL schema on Railway...\n");
    
    // Create all essential tables
    const tables = [
      {
        name: "users",
        sql: `CREATE TABLE IF NOT EXISTS "users" (
          "id" serial PRIMARY KEY,
          "email" varchar(255) UNIQUE NOT NULL,
          "password_hash" varchar(255),
          "first_name" varchar(100),
          "last_name" varchar(100),
          "phone" varchar(20),
          "role" varchar(50) DEFAULT 'customer',
          "is_active" boolean DEFAULT true,
          "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
          "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
        )`
      },
      {
        name: "stores",
        sql: `CREATE TABLE IF NOT EXISTS "stores" (
          "id" serial PRIMARY KEY,
          "name" varchar(255) NOT NULL,
          "slug" varchar(255) UNIQUE NOT NULL,
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
        )`
      },
      {
        name: "products",
        sql: `CREATE TABLE IF NOT EXISTS "products" (
          "id" serial PRIMARY KEY,
          "store_id" integer NOT NULL REFERENCES "stores"("id"),
          "category_id" integer,
          "name" varchar(255) NOT NULL,
          "description" text,
          "price" decimal(10,2) NOT NULL,
          "image_url" varchar(500),
          "is_active" boolean DEFAULT true,
          "sort_position" integer DEFAULT 0,
          "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
          "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
        )`
      },
      {
        name: "orders",
        sql: `CREATE TABLE IF NOT EXISTS "orders" (
          "id" serial PRIMARY KEY,
          "user_id" integer REFERENCES "users"("id"),
          "store_id" integer NOT NULL REFERENCES "stores"("id"),
          "status" varchar(50) DEFAULT 'pending',
          "total_amount" decimal(10,2),
          "delivery_address" text,
          "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
          "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
        )`
      },
      {
        name: "order_items",
        sql: `CREATE TABLE IF NOT EXISTS "order_items" (
          "id" serial PRIMARY KEY,
          "order_id" integer NOT NULL REFERENCES "orders"("id"),
          "product_id" integer NOT NULL REFERENCES "products"("id"),
          "quantity" integer NOT NULL,
          "price" decimal(10,2) NOT NULL,
          "created_at" timestamp DEFAULT CURRENT_TIMESTAMP
        )`
      },
      {
        name: "drivers",
        sql: `CREATE TABLE IF NOT EXISTS "drivers" (
          "id" serial PRIMARY KEY,
          "user_id" integer REFERENCES "users"("id"),
          "vehicle_number" varchar(50),
          "is_active" boolean DEFAULT true,
          "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
          "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
        )`
      },
      {
        name: "order_tracking",
        sql: `CREATE TABLE IF NOT EXISTS "order_tracking" (
          "id" serial PRIMARY KEY,
          "order_id" integer NOT NULL REFERENCES "orders"("id"),
          "status" varchar(50),
          "latitude" decimal(10,8),
          "longitude" decimal(11,8),
          "created_at" timestamp DEFAULT CURRENT_TIMESTAMP
        )`
      }
    ];
    
    for (const table of tables) {
      try {
        await sql.unsafe(table.sql);
        console.log(`✅ ${table.name} table created`);
      } catch (err: any) {
        if (err.message.includes("already exists")) {
          console.log(`⚠️  ${table.name} table already exists`);
        } else {
          console.error(`❌ ${table.name} failed:`, err.message.substring(0, 80));
        }
      }
    }
    
    // Verify tables
    const result = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;
    console.log(`\n✅ Schema complete! Tables created: ${result.length}`);
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await sql.end();
  }
}

createCompleteSchema();
