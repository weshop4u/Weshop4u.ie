const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// CRITICAL FIX: Prevent Metro from trying to hash react-native-css-interop cache files
// The issue: react-native-css-interop creates .cache/web.css during bundling
// Metro then tries to hash this file, but it's not in watchFolders, causing SHA-1 error
// Solution: Add the cache path to blockList BEFORE withNativeWind processes it

// Add cache exclusion to blockList FIRST
config.resolver.blockList = [
  ...(config.resolver.blockList || []),
  // Exclude react-native-css-interop cache - this is the critical fix
  /node_modules\/react-native-css-interop\/\.cache/,
];

config.resolver.sourceExts = [
  "js",
  "jsx",
  "ts",
  "tsx",
  "json",
  "mjs",
  "cjs",
];

module.exports = withNativeWind(config, {
  input: "./global.css",
});
