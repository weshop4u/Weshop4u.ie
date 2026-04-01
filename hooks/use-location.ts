import { useState, useEffect, useCallback } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const LOCATION_STORAGE_KEY = "@weshop4u_user_location";

export interface UserLocation {
  latitude: number;
  longitude: number;
  timestamp: number;
}

interface UseLocationResult {
  location: UserLocation | null;
  loading: boolean;
  error: string | null;
  permissionDenied: boolean;
  refresh: () => Promise<void>;
}

// Haversine formula to calculate distance between two points in km
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function useLocation(): UseLocationResult {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const fetchLocation = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (Platform.OS === "web") {
        // Web: use browser Geolocation API
        if (!navigator.geolocation) {
          setError("Geolocation not supported");
          setLoading(false);
          return;
        }

        const position = await new Promise<GeolocationPosition>(
          (resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 300000, // 5 min cache
            });
          }
        );

        const loc: UserLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: Date.now(),
        };
        setLocation(loc);
        await AsyncStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(loc));
      } else {
        // Native: use expo-location
        const Location = await import("expo-location");
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== "granted") {
          setPermissionDenied(true);
          setError("Location permission denied");
          // Try to load cached location
          const cached = await AsyncStorage.getItem(LOCATION_STORAGE_KEY);
          if (cached) {
            setLocation(JSON.parse(cached));
          }
          setLoading(false);
          return;
        }

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const loc: UserLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: Date.now(),
        };
        setLocation(loc);
        await AsyncStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(loc));
      }
    } catch (err: any) {
      if (err?.code === 1) {
        setPermissionDenied(true);
        setError("Location permission denied");
      } else {
        setError("Could not get location");
      }
      // Try cached location as fallback
      try {
        const cached = await AsyncStorage.getItem(LOCATION_STORAGE_KEY);
        if (cached) {
          setLocation(JSON.parse(cached));
        }
      } catch {}
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  return {
    location,
    loading,
    error,
    permissionDenied,
    refresh: fetchLocation,
  };
}
