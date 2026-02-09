import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  registerForPushNotificationsAsync,
  getPushToken,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
} from "./notifications";
import { trpc } from "./trpc";

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

  // Notification token registration will be added to backend API

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
          // await registerTokenMutation.mutateAsync({ userId: user.id, pushToken: token });
        }
      }
    } catch (error) {
      console.error("Error registering push token:", error);
    }
  };

  useEffect(() => {
    // Load existing token
    getPushToken().then(setPushToken);

    // Register for push notifications
    registerToken();

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
