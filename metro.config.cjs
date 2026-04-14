const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Exclude react-native-css-interop from watchFolders to prevent cache issues
config.watchFolders = [
  ...(config.watchFolders || []),
].filter(folder => !folder.includes('react-native-css-interop'));

// Disable Metro's file watching for node_modules to prevent cache issues
config.watchFolders = config.watchFolders.filter(folder => !folder.includes('node_modules'));

// Exclude cache directories from Metro bundler to prevent build failures
config.resolver.blockList = [
  ...(config.resolver.blockList || []),
  /node_modules\/react-native-css-interop\/.cache\/.*/,
  /node_modules\/react-native-css-interop\/\.cache\/.*/,
];

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Force write CSS to file system instead of virtual modules
  // This fixes iOS styling issues in development mode
  forceWriteFileSystem: true,
  // Disable CSS caching to prevent Metro bundler issues
  cacheDisabled: true,
});
