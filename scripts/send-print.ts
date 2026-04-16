import { initializeDualDatabases } from "../server/db-dual-write";
import { getDb } from "../server/db";
import { autoCreatePrintJob } from "../server/routers/print";

(async () => {
  try {
    await initializeDualDatabases();
    const db = await getDb();
    if (!db) {
      console.error("Failed to get database connection");
      process.exit(1);
    }

    console.log("Sending test print for order 1500019 (WS4U/SPR/127)...");
    
    // Call autoCreatePrintJob directly
    await autoCreatePrintJob(1500019, 1);
    
    console.log("✓ Test print sent successfully!");
    
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
})();
