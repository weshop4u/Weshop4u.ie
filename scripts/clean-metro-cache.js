#!/usr/bin/env node

/**
 * Clean Metro bundler cache to prevent "Failed to get the SHA-1" errors
 * This script removes all cache directories that Metro might try to hash
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const cacheDirs = [
  "node_modules/.cache",
  "node_modules/react-native-css-interop/.cache",
  ".expo",
  ".next",
  ".metro-cache",
  "node_modules/.expo",
];

console.log("🧹 Cleaning Metro cache directories...");

cacheDirs.forEach((dir) => {
  const fullPath = path.join(process.cwd(), dir);
  try {
    if (fs.existsSync(fullPath)) {
      fs.rmSync(fullPath, { recursive: true, force: true });
      console.log(`  ✓ Removed: ${dir}`);
    }
  } catch (error) {
    console.warn(`  ⚠ Failed to remove ${dir}:`, error.message);
  }
});

console.log("✅ Metro cache cleanup complete\n");
