import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

try {
  const pool = await mysql.createPool(url);
  const connection = await pool.getConnection();
  
  const [rows] = await connection.execute(
    'SELECT id, email, name, profile_picture FROM users WHERE email = ?',
    ['fergusgosson@gmail.com']
  );
  
  console.log('Query result:');
  console.log(JSON.stringify(rows, null, 2));
  
  if (rows.length > 0) {
    console.log('\nProfile picture column value:', rows[0].profile_picture);
    console.log('Is null?', rows[0].profile_picture === null);
    console.log('Type:', typeof rows[0].profile_picture);
  } else {
    console.log('\nNo user found');
  }
  
  await connection.release();
  await pool.end();
} catch (error) {
  console.error('Error:', error);
  process.exit(1);
}
