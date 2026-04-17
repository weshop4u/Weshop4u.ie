import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: 'amazon'
});

const [rows] = await connection.execute('SHOW COLUMNS FROM users');
console.log('=== SHOW COLUMNS FROM users ===\n');
rows.forEach(row => {
  console.log(`Field: ${row.Field}`);
  console.log(`Type: ${row.Type}`);
  console.log(`Null: ${row.Null}`);
  console.log(`Key: ${row.Key}`);
  console.log(`Default: ${row.Default}`);
  console.log(`Extra: ${row.Extra}`);
  console.log('---');
});

await connection.end();
