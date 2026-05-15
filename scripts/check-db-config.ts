import { initializeDualDatabases, getDb } from "../server/db-dual-write";

(async () => {
  console.log("=== Database Configuration ===");
  console.log("PRIMARY_DATABASE_URL:", process.env.PRIMARY_DATABASE_URL?.substring(0, 50) + "...");
  console.log("BACKUP_DATABASE_URL:", process.env.BACKUP_DATABASE_URL?.substring(0, 50) + "...");
  console.log("DATABASE_URL:", process.env.DATABASE_URL?.substring(0, 50) + "...");
  
  await initializeDualDatabases();
  const db = await getDb();
  
  if (db) {
    console.log("\n✓ Database initialized");
    
    // Check if receipt_data column exists
    const result = await db.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'orders' AND COLUMN_NAME = 'receipt_data'
    `);
    
    if (result && result.length > 0) {
      console.log("✓ receipt_data column EXISTS in the database");
    } else {
      console.log("✗ receipt_data column DOES NOT EXIST in the database");
    }
  }
  
  process.exit(0);
})();
