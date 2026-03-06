import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { trpc } from "@/lib/trpc";

/**
 * Lazily loaded expo-notifications module.
 * Using require() instead of top-level import to prevent native module
 * initialization crashes on standalone APK builds without FCM config.
 */
let _Notifications: typeof import("expo-notifications") | null = null;
let _loadFailed = false;

function getNotifications(): typeof import("expo-notifications") | null {
  if (Platform.OS === "web") return null;
  if (_loadFailed) return null;
  if (_Notifications) return _Notifications;
  try {
    _Notifications = require("expo-notifications");
    return _Notifications;
  } catch (e) {
    console.log("[Push] Failed to load expo-notifications:", e);
    _loadFailed = true;
    return null;
  }
}

/**
 * Check if we're running in Expo Go (where push notifications are limited/unavailable)
 */
function isExpoGo(): boolean {
  return Constants.appOwnership === "expo";
}

/**
 * Hook to register the device's Expo push token with the server.
 * Call this in the root layout or any screen where the user is authenticated.
 * 
 * @param userId - The authenticated user's ID (pass undefined if not logged in)
 */
export function usePushNotifications(userId: number | undefined) {
  const hasRegistered = useRef(false);
  const registerTokenMutation = trpc.notifications.registerToken.useMutation();

  useEffect(() => {
    if (!userId || hasRegistered.current) return;
    if (Platform.OS === "web") return; // Push tokens only work on native

    // Skip in Expo Go on Android (SDK 53+ removed push notifications from Expo Go)
    if (isExpoGo()) {
      console.log("[Push] Skipping push token registration in Expo Go");
      return;
    }

    async function registerPushToken() {
      try {
        const Notifications = getNotifications();
        if (!Notifications) {
          console.log("[Push] Notifications module not available");
          return;
        }

        // Request permission
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== "granted") {
          console.log("[Push] Permission not granted");
          return;
        }

        // Get the Expo push token - need a valid projectId
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        if (!projectId) {
          console.log("[Push] No projectId available, skipping push token registration");
          return;
        }

        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId,
        });
        const pushToken = tokenData.data;

        console.log("[Push] Got push token:", pushToken);

        // Register with server
        await registerTokenMutation.mutateAsync({
          userId: userId!,
          pushToken,
        });

        hasRegistered.current = true;
        console.log("[Push] Token registered with server for user", userId);
      } catch (error) {
        console.log("[Push] Failed to register push token (expected in Expo Go):", error);
      }
    }

    registerPushToken();
  }, [userId]);

  // Reset registration flag when user changes (e.g., logout + re-login)
  useEffect(() => {
    if (!userId) {
      hasRegistered.current = false;
    }
  }, [userId]);
}

/**
 * Configure notification handler for foreground notifications.
 * Call this once at app startup (e.g., in root layout).
 */
export function setupNotificationHandler() {
  if (Platform.OS === "web") return;

  // Skip in Expo Go on Android (SDK 53+)
  if (isExpoGo()) {
    console.log("[Push] Skipping notification handler setup in Expo Go");
    return;
  }

  try {
    const Notifications = getNotifications();
    if (!Notifications) return;

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (e) {
    console.log("[Push] Could not set notification handler:", e);
  }
}

/**
 * Set up Android notification channels for different notification types.
 * Call this once at app startup.
 */
export async function setupNotificationChannels() {
  if (Platform.OS !== "android") return;

  // Skip in Expo Go (SDK 53+)
  if (isExpoGo()) {
    console.log("[Push] Skipping notification channel setup in Expo Go");
    return;
  }

  try {
    const Notifications = getNotifications();
    if (!Notifications) return;

    // Orders channel - for customer order updates
    await Notifications.setNotificationChannelAsync("orders", {
      name: "Order Updates",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: "default",
    });

    // Jobs channel - for driver job offers
    await Notifications.setNotificationChannelAsync("jobs", {
      name: "Delivery Jobs",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 250, 500],
      sound: "default",
    });

    // Store channel - for store new order alerts
    await Notifications.setNotificationChannelAsync("store", {
      name: "Store Orders",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 250, 500],
      sound: "default",
    });

    // Default channel
    await Notifications.setNotificationChannelAsync("default", {
      name: "General",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
    });
  } catch (e) {
    console.log("[Push] Could not set up notification channels:", e);
  }
}
