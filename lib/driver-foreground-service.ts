import { Platform } from "react-native";
// Notifee is a native-only module — guard all access so this file
// never breaks web or SSR builds.
let notifee: any = null;
let AndroidImportance: any = null;
if (Platform.OS === "android") {
  try {
    const notifeeModule = require("@notifee/react-native");
    notifee = notifeeModule.default;
    AndroidImportance = notifeeModule.AndroidImportance;
  } catch (e) {
    console.log("[ForegroundService] Notifee not available:", e);
  }
}
const CHANNEL_ID = "driver-online-status";
const NOTIFICATION_ID = "driver-foreground-service";

// Track whether the service is already running so repeated calls (e.g. from
// a React effect re-firing on every object-reference change of `user`) don't
// re-post the same notification over and over — that repeated re-display is
// what causes the notification icon to visibly flicker on/off.
let isServiceRunning = false;

async function ensureChannel() {
  if (!notifee) return;
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: "Online Status",
    importance: AndroidImportance.LOW, // low = no sound/heads-up, just persistent
  });
}
export async function startDriverForegroundService() {
  if (Platform.OS !== "android" || !notifee) return;
  if (isServiceRunning) return; // already showing — don't re-post
  try {
    await ensureChannel();
    await notifee.displayNotification({
      id: NOTIFICATION_ID,
      title: "🟢 WeShop4U — You're Online",
      body: "Receiving delivery offers and sharing your location",
      android: {
        channelId: CHANNEL_ID,
        asForegroundService: true,
        ongoing: true,
        importance: AndroidImportance.LOW,
        smallIcon: "ic_launcher",
        color: "#22C55E",
      },
    });
    isServiceRunning = true;
    console.log("[ForegroundService] Started");
  } catch (e) {
    console.log("[ForegroundService] Failed to start:", e);
  }
}
export async function stopDriverForegroundService() {
  if (Platform.OS !== "android" || !notifee) return;
  try {
    await notifee.stopForegroundService();
    await notifee.cancelNotification(NOTIFICATION_ID);
    isServiceRunning = false;
    console.log("[ForegroundService] Stopped");
  } catch (e) {
    console.log("[ForegroundService] Failed to stop:", e);
  }
}
