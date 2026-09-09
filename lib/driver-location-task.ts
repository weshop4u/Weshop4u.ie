import { Platform } from "react-native";

export const DRIVER_LOCATION_TASK = "driver-background-location-task";

// Hardcoded production API base — this task can be invoked by the OS in a
// fresh JS context with no access to app runtime config, so it can't rely
// on getApiBaseUrl() the way in-app screens do.
const API_BASE_URL = "https://weshop4u.ie";

// Module-level driver ID cache. TaskManager.defineTask must run at module
// load time (not inside a component), so there's no way to pass the current
// driverId in directly — we stash it here whenever the driver goes online,
// and the task reads it when Android delivers a location update.
let currentDriverId: number | null = null;

export function setBackgroundLocationDriverId(driverId: number | null) {
  currentDriverId = driverId;
}

// Lazily loaded, like expo-notifications in usePushNotifications.ts — some
// builds (older APK/Play binaries) don't have expo-task-manager compiled
// into the native side. A top-level static import crashes the WHOLE app the
// instant this file loads if the native module is missing. require() inside
// a try/catch lets us fail safe instead: background location silently
// becomes unavailable on those builds, rather than taking down driver mode.
let TaskManager: typeof import("expo-task-manager") | null = null;
try {
  if (Platform.OS === "android") {
    TaskManager = require("expo-task-manager");
  }
} catch (e) {
  console.log("[BackgroundLocation] expo-task-manager not available on this build:", e);
  TaskManager = null;
}

if (Platform.OS === "android" && TaskManager) {
  try {
    TaskManager.defineTask(DRIVER_LOCATION_TASK, async ({ data, error }: any) => {
      if (error) {
        console.log("[BackgroundLocation] Task error:", error);
        return;
      }
      if (!data) return;

      const { locations } = data as { locations: any[] };
      if (!locations || locations.length === 0) return;

      // Use the most recent location in the batch
      const location = locations[locations.length - 1];
      const { latitude, longitude } = location.coords;

      if (!currentDriverId) {
        console.log("[BackgroundLocation] No driverId set, skipping ping");
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/driver-location-ping`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            driverId: currentDriverId,
            latitude,
            longitude,
          }),
        });

        if (!response.ok) {
          console.log("[BackgroundLocation] Ping failed:", response.status);
        }
      } catch (e) {
        console.log("[BackgroundLocation] Ping error:", e);
      }
    });
  } catch (e) {
    console.log("[BackgroundLocation] Failed to define task:", e);
  }
}
