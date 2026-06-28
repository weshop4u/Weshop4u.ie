// Load environment variables with proper priority (system > .env)
import type { ExpoConfig } from "expo/config";

// Bundle ID format: space.manus.<project_name_dots>.<timestamp>
// e.g., "my-app" created at 2024-01-15 10:30:45 -> "space.manus.my.app.t20240115103045"
// Bundle ID can only contain letters, numbers, and dots
// Android requires each dot-separated segment to start with a letter
const rawBundleId = "ie.weshop4u.app";
const bundleId =
  rawBundleId
    .replace(/[-_]/g, ".") // Replace hyphens/underscores with dots
    .replace(/[^a-zA-Z0-9.]/g, "") // Remove invalid chars
    .replace(/\.+/g, ".") // Collapse consecutive dots
    .replace(/^\.+|\.+$/g, "") // Trim leading/trailing dots
    .toLowerCase()
    .split(".")
    .map((segment) => {
      // Android requires each segment to start with a letter
      // Prefix with 'x' if segment starts with a digit
      return /^[a-zA-Z]/.test(segment) ? segment : "x" + segment;
    })
    .join(".") || "space.manus.app";
// Extract timestamp from bundle ID and prefix with "manus" for deep link scheme
// e.g., "space.manus.my.app.t20240115103045" -> "manus20240115103045"
const schemeFromBundleId = "weshop4u";

const env = {
  // App branding - update these values directly (do not use env vars)
  appName: "WESHOP4U",
  appSlug: "weshop4u",
  // S3 URL of the app logo - set this to the URL returned by generate_image when creating custom logo
  // Leave empty to use the default icon from assets/images/icon.png
  logoUrl: "https://private-us-east-1.manuscdn.com/sessionFile/2pl4Z34K2XdpOowI8TGoDF/sandbox/EFeOhwoALVAKAePLACKpGv-img-1_1770348854000_na1fn_d2VzaG9wNHUtaWNvbg.png",
  scheme: schemeFromBundleId,
  iosBundleId: bundleId,
  androidPackage: bundleId,
};

const config: ExpoConfig = {
  name: env.appName,
  slug: env.appSlug,
  version: "1.0.15",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: env.scheme,
  userInterfaceStyle: "automatic",
  // New Architecture disabled — causes cascading remounts with NativeWind on native Android
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: env.iosBundleId,
    "infoPlist": {
        "ITSAppUsesNonExemptEncryption": false
      }
  },
  android: {
    versionCode: 5,
    adaptiveIcon: {
      backgroundColor: "#0F172A",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    softwareKeyboardLayoutMode: "pan",
    package: env.androidPackage,
    permissions: ["POST_NOTIFICATIONS"],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: env.scheme,
            host: "*",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
    name: "WESHOP4U - 24/7 Delivery Platform",
    shortName: "WESHOP4U",
    description: "Order groceries, food, and essentials from local stores in Balbriggan. Delivered to your door within minutes!",
    themeColor: "#0F172A",
    backgroundColor: "#0F172A",
    lang: "en-IE",
  },
  plugins: [
    "expo-router",
    [
      "expo-audio",
      {
        microphonePermission: "Allow $(PRODUCT_NAME) to access your microphone.",
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          backgroundColor: "#000000",
        },
      },
    ],
    [
      "expo-build-properties",
      {
        android: {
          buildArchs: ["armeabi-v7a", "arm64-v8a"],
          minSdkVersion: 24,
        },
      },
    ],
  ],
  extra: {
    eas: {
      projectId: "c0c1895b-8b0b-446b-9473-9e72fd25754a"
    }
  },
updates: {
    enabled: true,
    url: "https://u.expo.dev/c0c1895b-8b0b-446b-9473-9e72fd25754a",
    checkAutomatically: "ON_LOAD",
    fallbackToCacheTimeout: 0,
  },
  runtimeVersion: {
    policy: "appVersion"
  },
  experiments: {
    typedRoutes: true,
    // React Compiler disabled — causes cascading remounts with NativeWind on native Android,
    // leading to TextInput focus loss and component flickering
    reactCompiler: false,
    baseUrl: "/api/web",
  },
};

export default config;
