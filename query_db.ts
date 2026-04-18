// Import the server's database module
import { getDb } from "./server/db-dual-write.js";
import { users } from "./drizzle/schema.js";
import { eq } from "drizzle-orm";

// Initialize database first
import * as dbModule from "./server/db-dual-write.js";
await dbModule.initializeDualDatabases();

const db = await getDb();

const result = await db
  .select({
    id: users.id,
    email: users.email,
    name: users.name,
    profilePicture: users.profilePicture,
  })
  .from(users)
  .where(eq(users.email, 'fergusgosson@gmail.com'));

console.log('Query result:');
console.log(JSON.stringify(result, null, 2));

if (result.length > 0) {
  console.log('\nProfile picture value:', result[0].profilePicture);
  console.log('Is null?', result[0].profilePicture === null);
} else {
  console.log('\nNo user found');
}

process.exit(0);
