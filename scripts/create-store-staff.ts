import bcrypt from "bcryptjs";
import { getDb } from "../server/db";
import { users, storeStaff } from "../drizzle/schema";
import { eq } from "drizzle-orm";

async function createStoreStaff() {
  const db = await getDb();
  if (!db) {
    console.error("Database not available");
    process.exit(1);
  }

  const email = "spar@weshop4u.ie";
  const password = "spar123";
  const storeId = 1; // Spar Balbriggan

  // Check if user already exists
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    console.log("User already exists with id:", existing[0].id);
    // Check if store_staff link exists
    const staffLink = await db.select().from(storeStaff).where(eq(storeStaff.userId, existing[0].id)).limit(1);
    if (staffLink.length > 0) {
      console.log("Store staff link already exists");
    } else {
      await db.insert(storeStaff).values({ userId: existing[0].id, storeId, role: "manager" });
      console.log("Store staff link created");
    }
    process.exit(0);
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  // Create user
  const result = await db.insert(users).values({
    email,
    name: "Spar Manager",
    role: "store_staff",
    passwordHash,
  });

  // MySQL2 returns [ResultSetHeader, ...] or { insertId } depending on driver
  const insertId = (result as any)[0]?.insertId ?? (result as any).insertId;
  const userId = Number(insertId);
  console.log("Insert result:", JSON.stringify(result).slice(0, 200));
  console.log("Created user with id:", userId);

  if (!userId || isNaN(userId)) {
    // Fallback: query the user we just created
    const created = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (created.length === 0) {
      console.error("Failed to create user");
      process.exit(1);
    }
    const fallbackId = created[0].id;
    console.log("Fallback user id:", fallbackId);
    await db.insert(storeStaff).values({ userId: fallbackId, storeId, role: "manager" });
    console.log("Store staff account created successfully!");
    console.log("Email:", email);
    console.log("Password:", password);
    process.exit(0);
  }

  // Link to store
  await db.insert(storeStaff).values({
    userId,
    storeId,
    role: "manager",
  });

  console.log("Store staff account created successfully!");
  console.log("Email:", email);
  console.log("Password:", password);
  console.log("Store: Spar Balbriggan (ID:", storeId, ")");
  
  process.exit(0);
}

createStoreStaff().catch(console.error);
