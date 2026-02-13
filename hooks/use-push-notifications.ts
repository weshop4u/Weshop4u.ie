import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { trpc } from "@/lib/trpc";

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

    async function registerPushToken() {
      try {
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

        // Get the Expo push token
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: projectId || undefined,
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
        console.error("[Push] Failed to register push token:", error);
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

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Set up Android notification channels for different notification types.
 * Call this once at app startup.
 */
export async function setupNotificationChannels() {
  if (Platform.OS !== "android") return;

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
}
