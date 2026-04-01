import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

/**
 * Check if we're running in Expo Go (where push notifications are limited/unavailable)
 */
function isExpoGo(): boolean {
  return Constants.appOwnership === "expo";
}

// Configure how notifications are handled when app is in foreground
// Only set up on native and when not in Expo Go on Android (SDK 53+ removed push from Expo Go)
if (Platform.OS !== "web") {
  try {
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
    console.log("[Notifications] Could not set notification handler:", e);
  }
}

/**
 * Request notification permissions from the user
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === "web") {
    // Web doesn't support push notifications in Expo
    return null;
  }

  // Skip push token registration in Expo Go (not supported in SDK 53+)
  if (isExpoGo()) {
    console.log("[Push] Skipping push token registration in Expo Go");
    return null;
  }

  try {
    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not already granted
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("Failed to get push token for push notification!");
      return null;
    }

    // Get the Expo push token - need a valid projectId
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.log("[Push] No projectId available, skipping push token registration");
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    const token = tokenData.data;

    // Store token locally
    await AsyncStorage.setItem("pushToken", token);

    // Configure Android notification channel
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#00E5FF",
      });

      await Notifications.setNotificationChannelAsync("orders", {
        name: "Order Updates",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#00E5FF",
        sound: "default",
      });

      await Notifications.setNotificationChannelAsync("jobs", {
        name: "Delivery Jobs",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500],
        lightColor: "#FF00FF",
        sound: "default",
      });
    }

    return token;
  } catch (error) {
    console.log("[Push] Error registering for push notifications (expected in Expo Go):", error);
    return null;
  }
}

/**
 * Get the stored push token
 */
export async function getPushToken(): Promise<string | null> {
  try {
    const token = await AsyncStorage.getItem("pushToken");
    return token;
  } catch (error) {
    console.error("Error getting push token:", error);
    return null;
  }
}

/**
 * Add a listener for when notifications are received while app is in foreground
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
) {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Add a listener for when user taps on a notification
 */
export function addNotificationResponseReceivedListener(
  callback: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Schedule a local notification (for testing)
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: any
) {
  if (isExpoGo() && Platform.OS === "android") {
    console.log("[Push] Skipping local notification in Expo Go on Android");
    return;
  }
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: null, // Show immediately
    });
  } catch (e) {
    console.log("[Push] Could not schedule notification:", e);
  }
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    console.log("[Push] Could not cancel notifications:", e);
  }
}

/**
 * Get notification badge count
 */
export async function getBadgeCount(): Promise<number> {
  try {
    return await Notifications.getBadgeCountAsync();
  } catch (e) {
    return 0;
  }
}

/**
 * Set notification badge count
 */
export async function setBadgeCount(count: number) {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (e) {
    // Ignore in Expo Go
  }
}

/**
 * Clear notification badge
 */
export async function clearBadge() {
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch (e) {
    // Ignore in Expo Go
  }
}
