import esbuild from 'esbuild';

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

esbuild.build({
  entryPoints: ['server/_core/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outdir: 'dist',
  external: externalPackages,
  packages: 'external',
}).catch(() => process.exit(1));
