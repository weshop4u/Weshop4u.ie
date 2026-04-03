import jwt from 'jsonwebtoken';
import { getDb } from './server/db.js';

const jwtSecret = process.env.JWT_SECRET || 'test-secret';

// Get database and check for admin users
const db = await getDb();
if (!db) {
  console.log('Database not available');
  process.exit(1);
}

// Query for users with admin role
const { users } = await import('./drizzle/schema.js');
const adminUsers = await db.select().from(users).where((t) => t.role === 'admin');

console.log('Admin users in database:', adminUsers);

if (adminUsers.length > 0) {
  const adminUser = adminUsers[0];
  const token = jwt.sign(
    { userId: adminUser.id, email: adminUser.email, role: adminUser.role },
    jwtSecret,
    { expiresIn: '1h' }
  );
  console.log('\nGenerated JWT token for admin user:');
  console.log('User:', adminUser.email, 'ID:', adminUser.id, 'Role:', adminUser.role);
  console.log('Token:', token);
} else {
  console.log('No admin users found in database');
}

process.exit(0);
