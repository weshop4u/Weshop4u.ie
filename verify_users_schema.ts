import { initializeDualDatabases, getDb } from "./server/db-dual-write";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  try {
    await initializeDualDatabases();
    const db = await getDb();
    
    // Execute raw SQL query
    const result = await db.execute(`SHOW COLUMNS FROM users`);
    
    console.log('=== SHOW COLUMNS FROM users ===\n');
    result.forEach((row: any) => {
      console.log(`Field: ${row.Field}`);
      console.log(`Type: ${row.Type}`);
      console.log(`Null: ${row.Null}`);
      console.log(`Key: ${row.Key}`);
      console.log(`Default: ${row.Default}`);
      console.log(`Extra: ${row.Extra}`);
      console.log('---');
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
