import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Packages that should NOT be bundled into the backend
// These are either browser-only, mobile-only, or have incompatible dependencies
const externalPackages = [
  'expo',
  'expo-router',
  'expo-constants',
  'expo-font',
  'expo-haptics',
  'expo-image',
  'expo-keep-awake',
  'expo-linking',
  'expo-notifications',
  'expo-secure-store',
  'expo-splash-screen',
  'expo-status-bar',
  'expo-symbols',
  'expo-system-ui',
  'expo-video',
  'expo-web-browser',
  'expo-audio',
  'expo-build-properties',
  'expo-image-picker',
  'expo-location',
  'react-native',
  'react-native-gesture-handler',
  'react-native-reanimated',
  'react-native-safe-area-context',
  'react-native-screens',
  'react-native-svg',
  'react-native-web',
  'react-native-worklets',
  'react-native-maps',
  'nativewind',
  'expo-server-sdk',
  'cookie-parser',
];

async function cleanMetroCache() {
  console.log('[build] 🧹 Cleaning Metro cache before build...');
  const cacheDirs = [
    'node_modules/.cache',
    'node_modules/react-native-css-interop/.cache',
    '.expo',
    '.next',
    '.metro-cache',
  ];

  cacheDirs.forEach((dir) => {
    const fullPath = path.join(process.cwd(), dir);
    try {
      if (fs.existsSync(fullPath)) {
        fs.rmSync(fullPath, { recursive: true, force: true });
        console.log(`[build]   ✓ Removed: ${dir}`);
      }
    } catch (error) {
      console.warn(`[build]   ⚠ Failed to remove ${dir}:`, error.message);
    }
  });
  console.log('[build] ✓ Metro cache cleanup complete\n');
}

async function buildWebApp() {
  console.log('[build] Building web app with expo export...');
  try {
    // Clean cache first
    await cleanMetroCache();
    
    // Build web app
    execSync('expo export --platform web --output-dir web-dist', {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    console.log('[build] ✓ Web app built successfully');
  } catch (error) {
    console.error('[build] ✗ Web app build failed:', error.message);
    throw error;
  }
}

async function build() {
  try {
    // Build web app first (with cache cleaning)
    await buildWebApp();

    // Build backend
    console.log('[build] Building backend with esbuild...');
    await esbuild.build({
      entryPoints: ['server/_core/index.ts'],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outdir: 'dist',
      external: externalPackages,
      packages: 'external',
    });
    console.log('[build] ✓ Backend built successfully');

    // Copy web-dist to dist folder
    const webDistSrc = path.join(process.cwd(), 'web-dist');
    const webDistDest = path.join(process.cwd(), 'dist', 'web-dist');
    
    if (fs.existsSync(webDistSrc)) {
      console.log('[build] Copying web-dist to dist folder...');
      
      // Remove existing web-dist in dist if it exists
      if (fs.existsSync(webDistDest)) {
        fs.rmSync(webDistDest, { recursive: true, force: true });
      }
      
      // Copy entire web-dist directory
      fs.cpSync(webDistSrc, webDistDest, { recursive: true, force: true });
      console.log('[build] ✓ web-dist copied successfully');
    } else {
      console.warn('[build] ⚠ web-dist not found, skipping copy');
    }

    console.log('[build] ✓ Build complete: dist/ ready for Railway deployment');
  } catch (error) {
    console.error('[build] ✗ Build failed:', error);
    process.exit(1);
  }
}

build();
