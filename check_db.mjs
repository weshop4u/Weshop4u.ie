import { getDb } from './server/db.ts';

try {
  const db = await getDb();
  if (!db) {
    console.log('Database not available');
    process.exit(1);
  }
  
  const result = await db.execute(
    `SELECT id, email, name, profile_picture FROM users WHERE email = 'fergusgosson@gmail.com'`
  );
  
  console.log('Query result:');
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error('Error:', error);
  process.exit(1);
}
