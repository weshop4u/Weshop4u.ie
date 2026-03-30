let Expo: any;
let expo: any;
let expoAvailable = false;

try {
  const expoModule = await import("expo-server-sdk");
  Expo = expoModule.Expo;
  expo = new Expo();
  expoAvailable = true;
} catch (error) {
  console.warn("[Notifications] expo-server-sdk not available - push notifications will be disabled");
}

export interface PushNotificationData {
  title: string;
  body: string;
  data?: any;
  sound?: boolean;
  badge?: number;
  channelId?: string;
}

/**
 * Send push notification to a single device
 */
export async function sendPushNotification(
  pushToken: string,
  notification: PushNotificationData
): Promise<boolean> {
  if (!expoAvailable) {
    console.warn("[Notifications] Push notifications disabled - expo-server-sdk not available");
    return false;
  }

  try {
    // Check that the push token is valid
    if (!Expo.isExpoPushToken(pushToken)) {
      console.error(`Push token ${pushToken} is not a valid Expo push token`);
      return false;
    }

    // Construct the message
    const message: any = {
      to: pushToken,
      sound: notification.sound !== false ? "default" : undefined,
      title: notification.title,
      body: notification.body,
      data: notification.data || {},
      badge: notification.badge,
      channelId: notification.channelId || "default",
    };

    // Send the notification
    const tickets = await expo.sendPushNotificationsAsync([message]);

    // Check if the notification was sent successfully
    const ticket = tickets[0];
    if (ticket.status === "error") {
      console.error(`Error sending push notification: ${ticket.message}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error sending push notification:", error);
    return false;
  }
}

/**
 * Send push notifications to multiple devices
 */
export async function sendBulkPushNotifications(
  pushTokens: string[],
  notification: PushNotificationData
): Promise<{ success: number; failed: number }> {
  if (!expoAvailable) {
    console.warn("[Notifications] Push notifications disabled - expo-server-sdk not available");
    return { success: 0, failed: pushTokens.length };
  }

  try {
    // Filter out invalid tokens
    const validTokens = pushTokens.filter((token) => Expo.isExpoPushToken(token));

    if (validTokens.length === 0) {
      console.error("No valid push tokens provided");
      return { success: 0, failed: pushTokens.length };
    }

    // Construct messages
    const messages: any[] = validTokens.map((token) => ({
      to: token,
      sound: notification.sound !== false ? "default" : undefined,
      title: notification.title,
      body: notification.body,
      data: notification.data || {},
      badge: notification.badge,
      channelId: notification.channelId || "default",
    }));

    // Send notifications in chunks (Expo recommends max 100 per request)
    const chunks = expo.chunkPushNotifications(messages);
    let successCount = 0;
    let failedCount = 0;

    for (const chunk of chunks) {
      try {
        const tickets = await expo.sendPushNotificationsAsync(chunk);

        // Count successes and failures
        tickets.forEach((ticket: any) => {
          if (ticket.status === "ok") {
            successCount++;
          } else {
            failedCount++;
            console.error(`Error sending push notification: ${ticket.message}`);
          }
        });
      } catch (error) {
        console.error("Error sending push notification chunk:", error);
        failedCount += chunk.length;
      }
    }

    return { success: successCount, failed: failedCount };
  } catch (error) {
    console.error("Error sending bulk push notifications:", error);
    return { success: 0, failed: pushTokens.length };
  }
}

/**
 * Send order status update notification to customer
 */
export async function sendOrderStatusNotification(
  pushToken: string,
  orderId: number,
  status: string,
  storeName: string
): Promise<boolean> {
  const statusMessages: Record<string, { title: string; body: string }> = {
    accepted: {
      title: "Order Accepted! 🎉",
      body: `${storeName} is preparing your order`,
    },
    preparing: {
      title: "Order Being Prepared 👨‍🍳",
      body: `${storeName} is getting your items ready`,
    },
    ready_for_pickup: {
      title: "Order Ready! 📦",
      body: `Your order is ready for driver pickup`,
    },
    driver_assigned: {
      title: "Driver Assigned! 🚗",
      body: `A driver is on the way to pick up your order`,
    },
    driver_at_store: {
      title: "Driver at Store! 🏪",
      body: `Your driver has arrived at ${storeName} to collect your order`,
    },
    picked_up: {
      title: "Order Picked Up! 🚀",
      body: `Your order is on the way to you`,
    },
    on_the_way: {
      title: "Driver On The Way! 🏃",
      body: `Your order will arrive soon`,
    },
    delivered: {
      title: "Order Delivered! ✅",
      body: `Enjoy your order from ${storeName}!`,
    },
  };

  const message = statusMessages[status] || {
    title: "Order Update",
    body: `Your order status has been updated`,
  };

  return await sendPushNotification(pushToken, {
    ...message,
    data: {
      type: "order_update",
      orderId,
      status,
    },
    channelId: "orders",
  });
}

/**
 * Send job offer notification to driver
 */
export async function sendJobOfferNotification(
  pushToken: string,
  orderId: number,
  storeName: string,
  deliveryFee: number,
  distance: number
): Promise<boolean> {
  return await sendPushNotification(pushToken, {
    title: "New Delivery Job! 🚗",
    body: `${storeName} - €${deliveryFee.toFixed(2)} (${distance.toFixed(1)}km)`,
    data: {
      type: "job_offer",
      orderId,
      storeName,
      deliveryFee,
      distance,
    },
    sound: true,
    channelId: "jobs",
  });
}

/**
 * Send new order notification to store
 */
export async function sendNewOrderNotification(
  pushToken: string,
  orderId: number,
  customerName: string,
  itemCount: number,
  total: number
): Promise<boolean> {
  return await sendPushNotification(pushToken, {
    title: "New Order! 🛒",
    body: `${customerName} - ${itemCount} items (€${total.toFixed(2)})`,
    data: {
      type: "new_order",
      orderId,
      customerName,
      itemCount,
      total,
    },
    sound: true,
    channelId: "orders",
  });
}

/**
 * Send order ready for pickup notification to driver
 */
export async function sendOrderReadyNotification(
  pushToken: string,
  orderId: number,
  storeName: string
): Promise<boolean> {
  return await sendPushNotification(pushToken, {
    title: "Order Ready for Pickup! 📦",
    body: `${storeName} - Your delivery is ready`,
    data: {
      type: "order_ready",
      orderId,
      storeName,
    },
    sound: true,
    channelId: "jobs",
  });
}
