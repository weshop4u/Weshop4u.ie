import "../scripts/load-env.js";
import mysql from "mysql2/promise";

async function main() {
  const pool = await mysql.createPool(process.env.DATABASE_URL!);
  const [rows] = await pool.query("SELECT id, name, storeId FROM products WHERE name LIKE '%Chicken Fillet Roll%' LIMIT 10");
  console.log(JSON.stringify(rows, null, 2));
  await pool.end();
}
main().catch(console.error);
