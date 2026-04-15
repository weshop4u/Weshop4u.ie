import mysql from "mysql2/promise";

async function addIsWssColumn() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const pool = await mysql.createPool(databaseUrl);
  const connection = await pool.getConnection();

  try {
    // Check if column exists
    const [columns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'products' AND COLUMN_NAME = 'is_wss'`
    );

    if ((columns as any[]).length === 0) {
      console.log("Adding is_wss column to products table...");
      await connection.query(
        `ALTER TABLE products ADD COLUMN is_wss BOOLEAN DEFAULT FALSE AFTER price`
      );
      console.log("✓ is_wss column added successfully");
    } else {
      console.log("✓ is_wss column already exists");
    }
  } catch (error) {
    console.error("Error:", error);
    throw error;
  } finally {
    await connection.end();
    await pool.end();
  }
}

addIsWssColumn().catch(console.error);
