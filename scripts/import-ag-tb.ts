import fs from "fs";
import { parse } from "csv-parse/sync";

const API_BASE = `http://127.0.0.1:${process.env.API_PORT || 3000}`;
const CSV_PATH = "/home/ubuntu/upload/products-2026-02-22-03-52-42.csv";

// Store IDs from database
const APPLEGREEN_STORE_ID = 3;
const TREASURE_BOWL_STORE_ID = 6;

interface CsvRow {
  ID: string;
  Name: string;
  Description: string;
  URL: string;
  SKU: string;
  Categories: string;
  Image: string;
  Images: string;
  Price: string;
}

function isAppleGreenProduct(row: CsvRow): boolean {
  const img = row.Image || "";
  const name = row.Name || "";
  return img.includes("weshop4u-naul-rd") || name.toLowerCase().includes("applegreen");
}

function isTreasureBowlProduct(row: CsvRow): boolean {
  const img = row.Image || "";
  const name = row.Name || "";
  const cat = row.Categories || "";
  return (
    img.toLowerCase().includes("treasure-bowl") ||
    name.toLowerCase().includes("treasure bowl") ||
    cat.includes("Treasure Bowl")
  );
}

function cleanCategoryName(cat: string, storeName: string): string {
  // For Treasure Bowl, clean up the category names
  // "Treasure Bowl Balbriggan,Treasure Bowl Appetizers" → "Appetizers"
  // "Treasure Bowl Curry Sauce (1,5,6,8,12)" → "Curry Sauce"
  if (storeName === "Treasure Bowl") {
    // Take the last part after comma if it contains Treasure Bowl prefix
    const parts = cat.split(",").map((p) => p.trim());
    // Use the most specific part (last one)
    let best = parts[parts.length - 1];
    // Remove "Treasure Bowl " prefix
    best = best.replace(/^Treasure Bowl\s*/i, "");
    // Remove allergen numbers like (1,5,6,8,12) or (1,5) etc.
    best = best.replace(/\s*\([0-9,\s]+\)\s*$/, "").trim();
    return best || "General";
  }
  return cat.trim() || "General";
}

async function importProducts(
  storeId: number,
  storeName: string,
  products: CsvRow[]
) {
  console.log(`\n=== Importing ${products.length} products for ${storeName} (store ${storeId}) ===`);

  // Map products to import format
  const mapped = products.map((row) => ({
    botbleId: row.ID,
    name: row.Name.trim(),
    description: row.Description || "",
    price: row.Price || "0",
    categoryName: cleanCategoryName(row.Categories || "", storeName),
    sku: row.SKU || "",
    imageUrl: row.Image || "",
    stockStatus: "in_stock",
    status: "published",
  }));

  // Show categories
  const cats = new Set(mapped.map((p) => p.categoryName));
  console.log(`  Categories (${cats.size}):`);
  for (const c of [...cats].sort()) {
    const count = mapped.filter((p) => p.categoryName === c).length;
    console.log(`    - ${c} (${count} products)`);
  }

  // Import in chunks of 200 to avoid request size limits
  const chunkSize = 200;
  let totalInserted = 0;
  let totalSkipped = 0;

  for (let i = 0; i < mapped.length; i += chunkSize) {
    const chunk = mapped.slice(i, i + chunkSize);
    const isFirst = i === 0;

    console.log(
      `  Importing batch ${Math.floor(i / chunkSize) + 1}/${Math.ceil(mapped.length / chunkSize)} (${chunk.length} products)...`
    );

    const res = await fetch(`${API_BASE}/api/trpc/import.importProducts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        json: {
          storeId,
          products: chunk,
          clearExisting: isFirst, // Clear existing on first batch only
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`  ❌ Batch failed: ${text}`);
      continue;
    }

    const data = (await res.json()) as any;
    const result = data.result?.data?.json;
    if (result) {
      totalInserted += result.inserted || 0;
      totalSkipped += result.skipped || 0;
      console.log(
        `    Inserted: ${result.inserted}, Skipped: ${result.skipped}, Categories created: ${result.categoriesCreated || 0}`
      );
    }
  }

  console.log(
    `\n  ✅ ${storeName}: ${totalInserted} products imported, ${totalSkipped} skipped`
  );
}

async function main() {
  // Read CSV
  const csvContent = fs.readFileSync(CSV_PATH, "utf-8");
  const rows: CsvRow[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  });

  console.log(`Total CSV rows: ${rows.length}`);

  // Filter products for each store
  const agProducts = rows.filter(isAppleGreenProduct);
  const tbProducts = rows.filter(isTreasureBowlProduct);

  console.log(`AppleGreen products found: ${agProducts.length}`);
  console.log(`Treasure Bowl products found: ${tbProducts.length}`);

  // Import AppleGreen
  await importProducts(APPLEGREEN_STORE_ID, "AppleGreen", agProducts);

  // Import Treasure Bowl
  await importProducts(TREASURE_BOWL_STORE_ID, "Treasure Bowl", tbProducts);

  console.log("\n✅ All imports complete!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
