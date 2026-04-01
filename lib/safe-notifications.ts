/**
 * Safe wrapper around expo-notifications that prevents crashes on native APK builds.
 * 
 * The expo-notifications module can crash on Android standalone builds if:
 * - Firebase/FCM is not configured (no google-services.json)
 * - The module is imported at module scope and fails to initialize
 * - scheduleNotificationAsync is called without proper notification channels
 * 
 * This module lazily loads expo-notifications and wraps ALL calls in try/catch
 * so the app never crashes from notification failures.
 */
import { Platform } from "react-native";
import Constants from "expo-constants";

// Lazy reference to the notifications module - only loaded when first needed
let _Notifications: typeof import("expo-notifications") | null = null;
let _loadFailed = false;

/**
 * Lazily load the expo-notifications module with error handling.
 * Returns null if the module can't be loaded (e.g., on web or if native module is missing).
 */
function getNotifications(): typeof import("expo-notifications") | null {
  if (Platform.OS === "web") return null;
  if (_loadFailed) return null;
  if (_Notifications) return _Notifications;

  try {
    // Use require() for synchronous lazy loading
    _Notifications = require("expo-notifications");
    return _Notifications;
  } catch (e) {
    console.log("[SafeNotifications] Failed to load expo-notifications:", e);
    _loadFailed = true;
    return null;
  }
}

/**
 * Check if we're running in Expo Go (where push notifications are limited)
 */
function isExpoGo(): boolean {
  return Constants.appOwnership === "expo";
}

/**
 * Check if notifications are available on this platform/build
 */
export function isNotificationsAvailable(): boolean {
  if (Platform.OS === "web") return false;
  if (isExpoGo()) return false;
  return !_loadFailed;
}

/**
 * Schedule a local notification. Silently fails if notifications aren't available.
 */
export async function scheduleLocalNotification(options: {
  title: string;
  body: string;
  data?: Record<string, any>;
  channelId?: string;
  seconds?: number;
}): Promise<string | null> {
  try {
    const Notifications = getNotifications();
    if (!Notifications) return null;
    if (isExpoGo()) return null;

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: options.title,
        body: options.body,
        data: options.data,
        ...(Platform.OS === "android" && options.channelId
          ? { channelId: options.channelId }
          : {}),
      },
      trigger: options.seconds
        ? { type: "timeInterval" as any, seconds: options.seconds }
        : null,
    });
    return identifier;
  } catch (e) {
    console.log("[SafeNotifications] Failed to schedule notification:", e);
    return null;
  }
}

/**
 * Cancel a scheduled notification by identifier. Silently fails.
 */
export async function cancelNotification(identifier: string): Promise<void> {
  try {
    const Notifications = getNotifications();
    if (!Notifications) return;
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch (e) {
    console.log("[SafeNotifications] Failed to cancel notification:", e);
  }
}

/**
 * Cancel all scheduled notifications. Silently fails.
 */
export async function cancelAllNotifications(): Promise<void> {
  try {
    const Notifications = getNotifications();
    if (!Notifications) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    console.log("[SafeNotifications] Failed to cancel all notifications:", e);
  }
}

/**
 * Get the current notification permissions status. Returns null if unavailable.
 */
export async function getPermissionStatus(): Promise<string | null> {
  try {
    const Notifications = getNotifications();
    if (!Notifications) return null;
    const { status } = await Notifications.getPermissionsAsync();
    return status;
  } catch (e) {
    console.log("[SafeNotifications] Failed to get permissions:", e);
    return null;
  }
}

/**
 * Request notification permissions. Returns the final status or null if unavailable.
 */
export async function requestPermissions(): Promise<string | null> {
  try {
    const Notifications = getNotifications();
    if (!Notifications) return null;
    const { status } = await Notifications.requestPermissionsAsync();
    return status;
  } catch (e) {
    console.log("[SafeNotifications] Failed to request permissions:", e);
    return null;
  }
}

/**
 * Add a listener for received notifications. Returns a cleanup function.
 */
export function addNotificationReceivedListener(
  callback: (notification: any) => void
): () => void {
  try {
    const Notifications = getNotifications();
    if (!Notifications) return () => {};
    if (isExpoGo()) return () => {};
    const subscription = Notifications.addNotificationReceivedListener(callback);
    return () => subscription.remove();
  } catch (e) {
    console.log("[SafeNotifications] Failed to add notification listener:", e);
    return () => {};
  }
}

/**
 * Add a listener for notification response (when user taps notification). Returns cleanup function.
 */
export function addNotificationResponseListener(
  callback: (response: any) => void
): () => void {
  try {
    const Notifications = getNotifications();
    if (!Notifications) return () => {};
    if (isExpoGo()) return () => {};
    const subscription = Notifications.addNotificationResponseReceivedListener(callback);
    return () => subscription.remove();
  } catch (e) {
    console.log("[SafeNotifications] Failed to add response listener:", e);
    return () => {};
  }
}

/**
 * Set the badge count. Silently fails.
 */
export async function setBadgeCount(count: number): Promise<void> {
  try {
    const Notifications = getNotifications();
    if (!Notifications) return;
    await Notifications.setBadgeCountAsync(count);
  } catch (e) {
    console.log("[SafeNotifications] Failed to set badge count:", e);
  }
}
