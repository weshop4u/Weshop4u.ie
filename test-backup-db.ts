import postgres from "postgres";

const backupUrl = process.env.DATABASE_URL_BACKUP;
if (!backupUrl) {
  console.error("DATABASE_URL_BACKUP not set");
  process.exit(1);
}

const sql = postgres(backupUrl, { ssl: "require" });

async function testBackupDb() {
  try {
    const result = await sql`SELECT COUNT(*) as count FROM stores WHERE is_active = true`;
    console.log("✅ Backup DB Query Success!");
    console.log("Active stores:", result[0].count);
  } catch (error) {
    console.error("❌ Backup DB Query Failed:", error);
  } finally {
    await sql.end();
  }
}

testBackupDb();
