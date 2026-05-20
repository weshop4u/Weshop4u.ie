/**
 * Migration Script: Manus CDN → Cloudflare R2
 * 
 * Downloads product images from Manus CDN and uploads them to Cloudflare R2
 * Updates the products table with new R2 URLs
 * 
 * Usage: tsx scripts/migrate-images-to-r2.ts [limit]
 * Example: tsx scripts/migrate-images-to-r2.ts 10
 */

import { getDb } from "../server/db";
import { initializeDualDatabases } from "../server/db-dual-write";
import { products } from "../server/db/schema";
import { like, sql } from "drizzle-orm";
import { storagePut } from "../server/storage";
import fetch from "node-fetch";

const BATCH_SIZE = process.argv[2] ? parseInt(process.argv[2]) : 10;

interface ProductRow {
  id: number;
  name: string;
  images: string | null;
}

interface ImageData {
  url: string;
  buffer: Buffer;
}

async function downloadImage(url: string): Promise<Buffer> {
  console.log(`  ⬇️  Downloading: ${url}`);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const buffer = await response.buffer();
    console.log(`  ✅ Downloaded: ${buffer.length} bytes`);
    return buffer;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to download image: ${message}`);
  }
}

function extractImageUrl(imagesJson: string): string | null {
  try {
    const parsed = JSON.parse(imagesJson);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed[0];
    }
  } catch (e) {
    console.error(`  ❌ Failed to parse images JSON: ${imagesJson}`);
  }
  return null;
}

function getFileExtension(url: string): string {
  const match = url.match(/\.(\w+)(?:\?|$)/);
  return match ? match[1].toLowerCase() : "jpg";
}

async function migrateProduct(product: ProductRow): Promise<boolean> {
  try {
    if (!product.images) {
      console.log(`⏭️  Product ${product.id}: No images, skipping`);
      return false;
    }

    const oldUrl = extractImageUrl(product.images);
    if (!oldUrl) {
      console.log(`⏭️  Product ${product.id}: Could not parse image URL, skipping`);
      return false;
    }

    // Only migrate Manus CDN images
    if (!oldUrl.includes("files.manuscdn.com")) {
      console.log(`⏭️  Product ${product.id}: Not a Manus CDN URL, skipping`);
      return false;
    }

    console.log(`\n📦 Migrating Product ${product.id}: "${product.name}"`);
    console.log(`   Old URL: ${oldUrl}`);

    // Download image from Manus CDN
    const imageBuffer = await downloadImage(oldUrl);

    // Upload to R2
    const ext = getFileExtension(oldUrl);
    const key = `product-images/${product.id}.${ext}`;
    console.log(`  ⬆️  Uploading to R2: ${key}`);

    const uploadResult = await storagePut(key, imageBuffer, "image/jpeg");
    console.log(`  ✅ Uploaded: ${uploadResult.url}`);

    // Update database with new R2 URL
    const newImagesJson = JSON.stringify([uploadResult.url]);
    const db = await getDb();
    if (!db) {
      throw new Error("Database connection lost during update");
    }
    await db
      .update(products)
      .set({ images: newImagesJson })
      .where(sql`id = ${product.id}`)
      .execute();

    console.log(`  ✅ Database updated`);
    console.log(`   New URL: ${uploadResult.url}`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Product ${product.id} failed: ${message}`);
    return false;
  }
}

async function main() {
  console.log("🚀 Starting image migration from Manus CDN to Cloudflare R2");
  console.log(`📊 Batch size: ${BATCH_SIZE} products\n`);

  try {
    // Initialize database connection
    console.log("🔌 Initializing database connection...");
    await initializeDualDatabases();
    console.log("✅ Database initialized\n");

    const db = await getDb();
    if (!db) {
      throw new Error("Database connection failed");
    }
    // Query products with Manus CDN URLs
    console.log("🔍 Querying products with Manus CDN images...");
    const productsToMigrate = await db
      .select()
      .from(products)
      .where(like(products.images, "%files.manuscdn.com%"))
      .limit(BATCH_SIZE)
      .execute();

    console.log(`✅ Found ${productsToMigrate.length} products to migrate\n`);

    if (productsToMigrate.length === 0) {
      console.log("ℹ️  No products found with Manus CDN URLs");
      return;
    }

    // Migrate each product
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < productsToMigrate.length; i++) {
      const product = productsToMigrate[i] as ProductRow;
      console.log(`\n[${i + 1}/${productsToMigrate.length}]`);

      const success = await migrateProduct(product);
      if (success) {
        successCount++;
      } else {
        failureCount++;
      }

      // Small delay between requests to avoid rate limiting
      if (i < productsToMigrate.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("📈 Migration Summary");
    console.log("=".repeat(60));
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failureCount}`);
    console.log(`📊 Total: ${productsToMigrate.length}`);
    console.log("=".repeat(60));

    if (failureCount === 0) {
      console.log("\n🎉 All products migrated successfully!");
    } else {
      console.log(
        `\n⚠️  ${failureCount} product(s) failed. Review logs above for details.`
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Migration failed: ${message}`);
    process.exit(1);
  }
}

main();
