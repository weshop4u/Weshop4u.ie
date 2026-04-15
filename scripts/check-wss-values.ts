import mysql from "mysql2/promise";

async function checkWssValues() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const pool = await mysql.createPool(databaseUrl);
  const connection = await pool.getConnection();

  try {
    // Check products with WSS flag
    const [products] = await connection.query(
      `SELECT id, name, price, is_wss FROM products WHERE store_id = (SELECT id FROM stores LIMIT 1) LIMIT 10`
    );

    console.log("Products in database:");
    console.log(JSON.stringify(products, null, 2));
  } catch (error) {
    console.error("Error:", error);
    throw error;
  } finally {
    await connection.end();
    await pool.end();
  }
}

checkWssValues().catch(console.error);
