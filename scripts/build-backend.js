import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
];

async function build() {
  try {
    // Build web frontend first
    console.log('[build] Building web frontend with Expo...');
    const { execSync } = await import('child_process');
    try {
      // Pass environment variables to web build
      const env = { ...process.env };
      
      // CRITICAL: For web builds, we MUST unset EXPO_PUBLIC_API_BASE_URL
      // This forces the web app to use relative URLs (/api/...) which call the local server
      // The APK will have this set by its build system, but Render web should NOT have it
      console.log('[build] EXPO_PUBLIC_API_BASE_URL from environment:', env.EXPO_PUBLIC_API_BASE_URL || 'NOT SET');
      delete env.EXPO_PUBLIC_API_BASE_URL;
      console.log('[build] Explicitly unsetting EXPO_PUBLIC_API_BASE_URL for web build');
      console.log('[build] Web app will use relative URLs (/api/...) to call local Render server');
      
      execSync('pnpm build:web', { stdio: 'inherit', env: { ...env, NODE_ENV: 'production' } });
      console.log('[build] ✓ Web frontend built successfully (using relative URLs)');
    } catch (error) {
      console.warn('[build] ⚠ Web frontend build failed, continuing with backend...');
      console.error('[build] Web build error details:', error.message);
      console.error('[build] Note: Web build should NOT have EXPO_PUBLIC_API_BASE_URL set');
    }

    // Build backend
    console.log('[build] Building backend with esbuild...');
    // Restore EXPO_PUBLIC_API_BASE_URL for backend if needed
    if (process.env.EXPO_PUBLIC_API_BASE_URL) {
      console.log('[build] Note: EXPO_PUBLIC_API_BASE_URL is set for backend context');
    }
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
