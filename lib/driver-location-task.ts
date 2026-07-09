import * as TaskManager from "expo-task-manager";
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

if (Platform.OS === "android") {
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
}
