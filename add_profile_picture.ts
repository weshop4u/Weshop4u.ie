import { initializeDualDatabases, getDb } from "./server/db-dual-write";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  try {
    await initializeDualDatabases();
    const db = await getDb();
    
    console.log('Running: ALTER TABLE users ADD COLUMN profile_picture VARCHAR(500) NULL DEFAULT NULL;');
    
    // Execute the ALTER TABLE statement
    await db.execute(`ALTER TABLE users ADD COLUMN profile_picture VARCHAR(500) NULL DEFAULT NULL`);
    
    console.log('✓ Column added successfully!\n');
    
    // Verify the column exists
    console.log('Verifying the column was added...\n');
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
    console.error('✗ Error:', error);
    process.exit(1);
  }
}

main();
