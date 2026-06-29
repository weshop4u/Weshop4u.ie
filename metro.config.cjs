const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
const path = require("path");
config.watchFolders = [
  ...(config.watchFolders || []),
  path.resolve(__dirname, "node_modules/react-native-css-interop/.cache"),
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
