import postgres from "postgres";

const backupUrl = process.env.DATABASE_URL_BACKUP;
if (!backupUrl) {
  console.error("DATABASE_URL_BACKUP not set");
  process.exit(1);
}

const sql = postgres(backupUrl, { ssl: "require" });

async function createSchema() {
  try {
    // Read the Drizzle SQL migration files and execute them
    const fs = await import("fs");
    const path = await import("path");
    
    const migrationsDir = path.join(process.cwd(), "drizzle");
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith(".sql")).sort();
    
    console.log(`Found ${files.length} migration files`);
    
    for (const file of files) {
      const sqlPath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(sqlPath, "utf-8");
      
      console.log(`\nExecuting: ${file}`);
      try {
        await sql.unsafe(sqlContent);
        console.log(`✅ ${file} executed successfully`);
      } catch (err: any) {
        console.error(`❌ ${file} failed:`, err.message);
      }
    }
    
    // Verify tables were created
    const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
    console.log(`\n✅ Schema created! Tables: ${tables.length}`);
    tables.forEach(t => console.log(`  - ${t.table_name}`));
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await sql.end();
  }
}

createSchema();
