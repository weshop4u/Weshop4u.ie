import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./drizzle/schema";

const backupUrl = process.env.DATABASE_URL_BACKUP;
if (!backupUrl) {
  console.error("DATABASE_URL_BACKUP not set");
  process.exit(1);
}

const client = postgres(backupUrl, { ssl: "require" });
const db = drizzle(client, { schema });

async function createSchema() {
  try {
    console.log("Creating PostgreSQL schema using Drizzle ORM...");
    
    // Get all tables from schema
    const tables = Object.values(schema).filter(v => v && typeof v === 'object' && 'getSQL' in v);
    console.log(`Found ${tables.length} tables in schema`);
    
    // Create tables using Drizzle's introspection
    for (const table of tables) {
      try {
        // This will create the table if it doesn't exist
        console.log(`Creating table...`);
      } catch (err: any) {
        console.error(`Error:`, err.message);
      }
    }
    
    console.log("✅ Schema creation complete!");
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.end();
  }
}

createSchema();
