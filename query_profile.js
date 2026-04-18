import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'weshop4u',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

try {
  const [rows] = await connection.execute(
    'SELECT id, email, name, profile_picture FROM users WHERE email = ?',
    ['fergusgosson@gmail.com']
  );
  
  console.log('Query result:');
  console.log(JSON.stringify(rows, null, 2));
  
  if (rows.length > 0) {
    console.log('\nProfile picture value:', rows[0].profile_picture);
  } else {
    console.log('\nNo user found with that email');
  }
} catch (error) {
  console.error('Query error:', error);
} finally {
  await connection.end();
}
