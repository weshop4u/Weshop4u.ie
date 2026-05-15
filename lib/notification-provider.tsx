import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import {
  registerForPushNotificationsAsync,
  getPushToken,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
} from "./notifications";
import { trpc } from "./trpc";

/**
 * Check if we're running in Expo Go (where push notifications are limited/unavailable)
 */
function isExpoGo(): boolean {
  return Constants.appOwnership === "expo";
}

interface NotificationContextType {
  pushToken: string | null;
  registerToken: () => Promise<void>;
  unreadCount: number;
  clearUnread: () => void;
}

const NotificationContext = createContext<NotificationContextType>({
  pushToken: null,
  registerToken: async () => {},
  unreadCount: 0,
  clearUnread: () => {},
});

export function useNotifications() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  const registerToken = async () => {
    try {
      const token = await registerForPushNotificationsAsync();
      if (token) {
        setPushToken(token);

        // Get user data
        const userData = await AsyncStorage.getItem("user");
        if (userData) {
          const user = JSON.parse(userData);
          // TODO: Register token with backend when API is ready
        }
      }
    } catch (error) {
      console.log("[Push] Error registering push token (expected in Expo Go):", error);
    }
  };

  useEffect(() => {
    // Skip all notification setup on web or in Expo Go on Android
    if (Platform.OS === "web") return;

    // Load existing token
    getPushToken().then(setPushToken);

    // Register for push notifications (will gracefully skip in Expo Go)
    registerToken();

    // Only set up listeners if not in Expo Go (where they may fail)
    if (!isExpoGo()) {
      // Listen for notifications received while app is in foreground
      notificationListener.current = addNotificationReceivedListener((notification) => {
        console.log("Notification received:", notification);
        setUnreadCount((prev) => prev + 1);
      });

      // Listen for notification taps
      responseListener.current = addNotificationResponseReceivedListener((response) => {
        console.log("Notification tapped:", response);

        const data = response.notification.request.content.data;

        // Handle deep linking based on notification type
        if (data.type === "order_update" && data.orderId) {
          router.push(`/order-tracking/${data.orderId}` as any);
        } else if (data.type === "job_offer" && data.orderId) {
          router.push(`/driver/job-offer?orderId=${data.orderId}` as any);
        } else if (data.type === "new_order" && data.orderId) {
          router.push(`/store?orderId=${data.orderId}` as any);
        }

        // Clear unread count when notification is tapped
        setUnreadCount(0);
      });
    }

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  const clearUnread = () => {
    setUnreadCount(0);
  };

  return (
    <NotificationContext.Provider
      value={{
        pushToken,
        registerToken,
        unreadCount,
        clearUnread,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
