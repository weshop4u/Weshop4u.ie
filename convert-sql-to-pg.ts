import postgres from "postgres";
import fs from "fs";
import path from "path";

const backupUrl = process.env.DATABASE_URL_BACKUP;
if (!backupUrl) {
  console.error("DATABASE_URL_BACKUP not set");
  process.exit(1);
}

const sql = postgres(backupUrl, { ssl: "require" });

function convertMySQLToPG(sqlContent: string): string {
  // Convert MySQL backticks to PostgreSQL double quotes
  let converted = sqlContent.replace(/`/g, '"');
  
  // Convert UNSIGNED to just remove it (PostgreSQL doesn't have UNSIGNED)
  converted = converted.replace(/\s+UNSIGNED/gi, '');
  
  // Convert AUTO_INCREMENT to SERIAL
  converted = converted.replace(/INT\s+AUTO_INCREMENT/gi, 'SERIAL');
  
  // Convert COLLATE utf8mb4_unicode_ci to COLLATE "C"
  converted = converted.replace(/COLLATE\s+utf8mb4_unicode_ci/gi, 'COLLATE "C"');
  
  // Convert ENGINE=InnoDB to nothing (PostgreSQL doesn't need it)
  converted = converted.replace(/\s+ENGINE\s*=\s*InnoDB/gi, '');
  
  // Convert CHARACTER SET utf8mb4 to nothing
  converted = converted.replace(/\s+CHARACTER\s+SET\s+utf8mb4/gi, '');
  
  // Convert DEFAULT CURRENT_TIMESTAMP to DEFAULT CURRENT_TIMESTAMP
  converted = converted.replace(/DEFAULT\s+CURRENT_TIMESTAMP/gi, 'DEFAULT CURRENT_TIMESTAMP');
  
  // Convert ON UPDATE CURRENT_TIMESTAMP to nothing (use triggers instead if needed)
  converted = converted.replace(/\s+ON\s+UPDATE\s+CURRENT_TIMESTAMP/gi, '');
  
  return converted;
}

async function createSchema() {
  try {
    const migrationsDir = path.join(process.cwd(), "drizzle");
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith(".sql")).sort();
    
    console.log(`Found ${files.length} migration files`);
    
    for (const file of files) {
      const sqlPath = path.join(migrationsDir, file);
      let sqlContent = fs.readFileSync(sqlPath, "utf-8");
      
      // Convert MySQL to PostgreSQL syntax
      sqlContent = convertMySQLToPG(sqlContent);
      
      console.log(`\nExecuting: ${file}`);
      try {
        await sql.unsafe(sqlContent);
        console.log(`✅ ${file} executed successfully`);
      } catch (err: any) {
        console.error(`❌ ${file} failed:`, err.message.substring(0, 100));
      }
    }
    
    // Verify tables were created
    const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;
    console.log(`\n✅ Schema created! Tables: ${tables.length}`);
    tables.forEach(t => console.log(`  - ${t.table_name}`));
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await sql.end();
  }
}

createSchema();
