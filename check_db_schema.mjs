import { db } from './server/_core/db.js';

try {
  const result = await db.execute('SHOW COLUMNS FROM users');
  console.log('=== SHOW COLUMNS FROM users ===\n');
  result.forEach(row => {
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
  console.error('Error:', error.message);
  process.exit(1);
}
