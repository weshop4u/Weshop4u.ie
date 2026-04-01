import postgres from "postgres";

const backupUrl = process.env.DATABASE_URL_BACKUP;
const sql = postgres(backupUrl, { ssl: "require" });

async function check() {
  try {
    const result = await sql`SELECT COUNT(*) as total FROM "stores"`;
    console.log("Total stores:", result[0].total);
    
    const active = await sql`SELECT COUNT(*) as count FROM "stores" WHERE "is_active" = true`;
    console.log("Active stores:", active[0].count);
    
    const sample = await sql`SELECT "id", "name", "is_active" FROM "stores" LIMIT 3`;
    console.log("Sample:", sample);
  } catch (error: any) {
    console.error("Error:", error.message);
  } finally {
    await sql.end();
  }
}

check();
