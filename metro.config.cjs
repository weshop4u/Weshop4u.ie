const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

let config = getDefaultConfig(__dirname);

// Apply NativeWind
// WORKAROUND: Set forceWriteFileSystem to false to prevent cache file recreation
// This stops the SHA-1 hashing error in Metro
config = withNativeWind(config, {
  input: "./global.css",
  forceWriteFileSystem: false,
});

// Then set blockList using Metro's proper format
config.resolver.blockList = [
  ...(config.resolver.blockList || []),
  // Exclude react-native-css-interop cache to prevent SHA-1 hashing errors
  /.*\/react-native-css-interop\/\.cache\/.*/,
  /.*react-native-css-interop\/\.cache\/web\.css$/,
];

module.exports = config;
