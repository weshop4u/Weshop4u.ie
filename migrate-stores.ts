import postgres from "postgres";
import mysql from "mysql2/promise";

const railwayUrl = process.env.DATABASE_URL_BACKUP;
const manusUrl = process.env.DATABASE_URL;

if (!railwayUrl || !manusUrl) {
  console.error("Missing database URLs");
  process.exit(1);
}

async function migrateStores() {
  try {
    console.log("Connecting to Manus MySQL...");
    const mysqlConnection = await mysql.createConnection(manusUrl);
    
    console.log("Fetching stores from Manus...");
    const [stores] = await mysqlConnection.execute("SELECT * FROM stores");
    console.log(`Found ${stores.length} stores in Manus`);
    
    if (stores.length === 0) {
      console.log("No stores to migrate");
      await mysqlConnection.end();
      return;
    }
    
    console.log("First store:", stores[0]);
    
    // Connect to Railway
    console.log("Connecting to Railway PostgreSQL...");
    const sql = postgres(railwayUrl);
    
    // Insert stores - include all columns from MySQL
    for (const store of stores) {
      try {
        await sql`INSERT INTO stores (id, name, slug, description, category, logo, address, eircode, latitude, longitude, phone, email, is_open_247, opening_hours, is_active, created_at, updated_at, auto_print_enabled, auto_print_threshold, short_code, order_counter, sort_position, is_featured)
          VALUES (${store.id}, ${store.name}, ${store.slug}, ${store.description}, ${store.category}, ${store.logo}, ${store.address}, ${store.eircode}, ${store.latitude}, ${store.longitude}, ${store.phone}, ${store.email}, ${store.is_open_247}, ${store.opening_hours}, ${store.is_active}, ${store.created_at}, ${store.updated_at}, ${store.auto_print_enabled}, ${store.auto_print_threshold}, ${store.short_code}, ${store.order_counter}, ${store.sort_position}, ${store.is_featured})
          ON CONFLICT (id) DO NOTHING`;
      } catch (e) {
        console.error(`Error inserting store ${store.id}:`, e.message);
      }
    }
    
    console.log(`✓ Migrated ${stores.length} stores to Railway`);
    
    // Verify
    const result = await sql`SELECT COUNT(*) as count FROM stores`;
    console.log(`Railway now has ${result[0].count} stores`);
    
    await sql.end();
    await mysqlConnection.end();
  } catch (error) {
    console.error("Migration error:", error);
  }
}

migrateStores();
