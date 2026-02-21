import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Platform, Alert, Linking, Image, AppState } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import { useAudioPlayer, setAudioModeAsync } from "expo-audio";
import * as Notifications from "expo-notifications";
import * as Haptics from "expo-haptics";
import Constants from "expo-constants";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { useColors } from "@/hooks/use-colors";
import { formatIrishTime } from "@/lib/timezone";

const isExpoGo = Constants.appOwnership === "expo";
import { startWebAlarm, stopWebAlarm } from "@/lib/notification-sound";

// Trigger local print via browser print dialog (for POS standalone mode)
function triggerLocalPrint(content: string) {
  if (typeof window === "undefined") return;

  const printFrame = document.createElement("iframe");
  printFrame.style.position = "fixed";
  printFrame.style.right = "0";
  printFrame.style.bottom = "0";
  printFrame.style.width = "0";
  printFrame.style.height = "0";
  printFrame.style.border = "none";
  document.body.appendChild(printFrame);

  const doc = printFrame.contentDocument || printFrame.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Receipt</title>
        <style>
          @page { size: 58mm auto; margin: 0; }
          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.3;
            margin: 0;
            padding: 4mm;
            width: 50mm;
            white-space: pre-wrap;
            word-wrap: break-word;
          }
        </style>
      </head>
      <body>${content.replace(/\n/g, "<br>")}</body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      try {
        printFrame.contentWindow?.print();
      } catch (e) {
        console.log("[Print] iframe print failed, trying window.print");
      }
      setTimeout(() => {
        document.body.removeChild(printFrame);
      }, 1000);
    }, 300);
  }
}

export default function StoreDashboardScreen() {
  const router = useRouter();
  const colors = useColors();
  const { data: user, isLoading: userLoading } = trpc.auth.me.useQuery();

  // Register push token for store staff
  usePushNotifications(user?.id);

  const [refreshing, setRefreshing] = useState(false);
  const prevPendingIdsRef = useRef<Set<number>>(new Set());
  const isFirstLoadRef = useRef(true);
  const audioPlayer = useAudioPlayer(require("@/assets/sounds/order-alert.mp3"));
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [newOrderFlash, setNewOrderFlash] = useState(false);
  const repeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [printingOrderId, setPrintingOrderId] = useState<number | null>(null);
  const [printSuccess, setPrintSuccess] = useState<number | null>(null);
  const [showPrintSettings, setShowPrintSettings] = useState(false);

  // Get the store ID for this staff member
  const { data: myStore } = trpc.store.getMyStore.useQuery(
    { userId: user?.id || 0 },
    { enabled: !!user }
  );

  // Get pending orders for the store
  const { data: orders, isLoading, refetch } = trpc.orders.getUserOrders.useQuery(
    undefined,
    { enabled: !!user, refetchInterval: 5000 }
  );

  // Get print settings
  const { data: printSettings, refetch: refetchPrintSettings } = trpc.print.getPrintSettings.useQuery(
    { storeId: myStore?.storeId || 0 },
    { enabled: !!myStore?.storeId }
  );

  const updateStatusMutation = trpc.orders.updateStatus.useMutation();
  const createPrintJobMutation = trpc.print.createPrintJob.useMutation();
  const updatePrintSettingsMutation = trpc.print.updatePrintSettings.useMutation();

  // Enable audio playback in silent mode (iOS)
  useEffect(() => {
    if (Platform.OS !== "web") {
      setAudioModeAsync({ playsInSilentMode: true });
    }
  }, []);

  // Listen for push notifications (new order alerts from server)
  useEffect(() => {
    if (Platform.OS === "web") return;

    if (isExpoGo) return; // Skip in Expo Go
    let subscription: Notifications.Subscription | null = null;
    try {
      subscription = Notifications.addNotificationReceivedListener((notification) => {
        const data = notification.request.content.data;
        if (data?.type === "new_order") {
          // Immediately refetch orders when we get a push notification
          refetch();
        }
      });
    } catch (e) {
      console.log("[Push] Could not add notification listener");
    }

    return () => subscription?.remove();
  }, [refetch]);

  // Refetch when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        refetch();
      }
    });
    return () => subscription.remove();
  }, [refetch]);

  // Detect new pending orders and play alert
  useEffect(() => {
    if (!orders) return;

    const currentPendingIds = new Set(
      orders.filter((o: any) => o.status === "pending").map((o: any) => o.id)
    );

    if (isFirstLoadRef.current) {
      prevPendingIdsRef.current = currentPendingIds;
      isFirstLoadRef.current = false;
      return;
    }

    const newPendingOrders: number[] = [];
    currentPendingIds.forEach((id) => {
      if (!prevPendingIdsRef.current.has(id)) {
        newPendingOrders.push(id);
      }
    });

    if (newPendingOrders.length > 0) {
      setNewOrderFlash(true);
      setTimeout(() => setNewOrderFlash(false), 3000);

      if (audioEnabled && Platform.OS !== "web") {
        try {
          audioPlayer.seekTo(0);
          audioPlayer.play();
        } catch (e) {
          console.error("[Audio] Failed to play alert:", e);
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    }

    prevPendingIdsRef.current = currentPendingIds;
  }, [orders, audioEnabled, audioPlayer]);

  // Repeating alert sound while there are unaccepted pending orders
  useEffect(() => {
    const pendingOrders = orders?.filter((o: any) => o.status === "pending") || [];

    if (pendingOrders.length > 0 && audioEnabled) {
      if (repeatTimerRef.current) clearInterval(repeatTimerRef.current);

      if (Platform.OS === "web") {
        // Use web alarm for persistent looping
        startWebAlarm(8000);
      } else {
        repeatTimerRef.current = setInterval(() => {
          try {
            audioPlayer.seekTo(0);
            audioPlayer.play();
          } catch (e) {
            // Ignore audio errors
          }
        }, 8000); // Repeat every 8 seconds (was 30s)
      }
    } else {
      // Stop alarms when no pending orders
      if (Platform.OS === "web") {
        stopWebAlarm();
      }
      if (repeatTimerRef.current) {
        clearInterval(repeatTimerRef.current);
        repeatTimerRef.current = null;
      }
    }

    return () => {
      if (repeatTimerRef.current) {
        clearInterval(repeatTimerRef.current);
        repeatTimerRef.current = null;
      }
      if (Platform.OS === "web") {
        stopWebAlarm();
      }
    };
  }, [orders, audioEnabled, audioPlayer]);

  // Auto-print logic: when an order is accepted, check if it should auto-print
  const handleAcceptAndMaybePrint = useCallback(async (orderId: number, itemCount: number) => {
    if (!myStore?.storeId || !printSettings) return;

    if (printSettings.autoPrintEnabled && itemCount >= (printSettings.autoPrintThreshold || 5)) {
      // Auto-print this order
      try {
        await createPrintJobMutation.mutateAsync({
          orderId,
          storeId: myStore.storeId,
        });
        console.log(`[AutoPrint] Order ${orderId} auto-printed (${itemCount} items >= threshold ${printSettings.autoPrintThreshold})`);
      } catch (e) {
        console.error("[AutoPrint] Failed:", e);
      }
    }
  }, [myStore?.storeId, printSettings, createPrintJobMutation]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleUpdateStatus = async (orderId: number, status: string, itemCount?: number) => {
    try {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      await updateStatusMutation.mutateAsync({
        orderId,
        status: status as any,
      });
      await refetch();

      // If accepting, check auto-print
      if (status === "preparing" && itemCount) {
        handleAcceptAndMaybePrint(orderId, itemCount);
      }
    } catch (error) {
      console.error("Failed to update order status:", error);
    }
  };

  const handlePrintOrder = async (orderId: number) => {
    if (!myStore?.storeId) return;

    setPrintingOrderId(orderId);
    try {
      const result = await createPrintJobMutation.mutateAsync({
        orderId,
        storeId: myStore.storeId,
      });

      // Also trigger local print if running on POS device (browser print dialog)
      // This handles the standalone POS mode where staff uses the POS directly
      if (Platform.OS === "web" && typeof window !== "undefined" && result.receiptContent) {
        try {
          triggerLocalPrint(result.receiptContent);
        } catch (e) {
          // Local print is optional; cloud print job is already created
          console.log("[Print] Local print not available, using cloud queue");
        }
      }

      setPrintSuccess(orderId);
      setTimeout(() => setPrintSuccess(null), 3000);

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error("Failed to create print job:", error);
    } finally {
      setPrintingOrderId(null);
    }
  };

  const handleToggleAutoPrint = async () => {
    if (!myStore?.storeId || !printSettings) return;

    try {
      await updatePrintSettingsMutation.mutateAsync({
        storeId: myStore.storeId,
        autoPrintEnabled: !printSettings.autoPrintEnabled,
        autoPrintThreshold: printSettings.autoPrintThreshold || 5,
      });
      refetchPrintSettings();
    } catch (e) {
      console.error("Failed to update print settings:", e);
    }
  };

  const handleUpdateThreshold = async (newThreshold: number) => {
    if (!myStore?.storeId || !printSettings) return;

    try {
      await updatePrintSettingsMutation.mutateAsync({
        storeId: myStore.storeId,
        autoPrintEnabled: printSettings.autoPrintEnabled || false,
        autoPrintThreshold: newThreshold,
      });
      refetchPrintSettings();
    } catch (e) {
      console.error("Failed to update threshold:", e);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-warning/10 border-warning text-warning";
      case "accepted":
      case "preparing":
        return "bg-primary/10 border-primary text-primary";
      case "ready_for_pickup":
        return "bg-success/10 border-success text-success";
      default:
        return "bg-surface border-border text-muted";
    }
  };

  const getNextStatus = (currentStatus: string) => {
    switch (currentStatus) {
      case "pending":
        return { status: "accepted", label: "Accept Order" };
      case "accepted":
        return { status: "preparing", label: "Start Preparing" };
      case "preparing":
        return { status: "ready_for_pickup", label: "Mark Ready" };
      default:
        return null;
    }
  };

  if (userLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color="#00E5FF" />
      </ScreenContainer>
    );
  }

  if (!user || user.role !== "store_staff") {
    return (
      <ScreenContainer className="items-center justify-center p-6">
        <Text className="text-xl font-bold text-foreground mb-2">Access Denied</Text>
        <Text className="text-muted text-center mb-4">
          You don't have permission to access the store dashboard.
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-primary px-8 py-3 rounded-full active:opacity-70"
        >
          <Text className="text-background font-bold">Go Back</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  const pendingOrders = orders?.filter((o: any) => o.status === "pending") || [];
  const activeOrders = orders?.filter((o: any) => ["accepted", "preparing", "ready_for_pickup"].includes(o.status)) || [];

  const renderOrderCard = (order: any, isPending: boolean) => {
    const nextStatus = getNextStatus(order.status);
    const isExpanded = expandedOrderId === order.id;
    const itemCount = order.items?.length || 0;
    const totalQuantity = order.items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0;
    const isPrinting = printingOrderId === order.id;
    const justPrinted = printSuccess === order.id;

    return (
      <View
        key={order.id}
        style={{
          backgroundColor: isPending ? "rgba(245, 158, 11, 0.08)" : colors.surface,
          borderWidth: isPending ? 2 : 1,
          borderColor: isPending ? colors.warning : colors.border,
          borderRadius: 16,
          padding: 16,
          marginBottom: 12,
        }}
      >
        {/* Order Header - Tap to expand */}
        <TouchableOpacity
          onPress={() => setExpandedOrderId(isExpanded ? null : order.id)}
          style={{ opacity: 1 }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground }}>
                Order #{order.orderNumber}
              </Text>
              <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>
                {formatIrishTime(order.createdAt)} · {totalQuantity} item{totalQuantity !== 1 ? "s" : ""}
              </Text>
            </View>
            {!isPending && (
              <View style={{
                borderRadius: 20,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderWidth: 1,
                borderColor: order.status === "ready_for_pickup" ? colors.success : colors.primary,
                backgroundColor: order.status === "ready_for_pickup" ? "rgba(34, 197, 94, 0.1)" : "rgba(0, 229, 255, 0.1)",
              }}>
                <Text style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: order.status === "ready_for_pickup" ? colors.success : colors.primary,
                }}>
                  {order.status.replace(/_/g, " ").toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={{ fontSize: 20, color: colors.muted, marginLeft: 8 }}>
              {isExpanded ? "▲" : "▼"}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Quick info always visible */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
          <View>
            <Text style={{ fontSize: 11, color: colors.muted }}>TOTAL</Text>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>€{order.total}</Text>
          </View>
          <View>
            <Text style={{ fontSize: 11, color: colors.muted }}>PAYMENT</Text>
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>
              {order.paymentMethod === "card" ? "💳 Card" : "💵 Cash"}
            </Text>
          </View>
          <View>
            <Text style={{ fontSize: 11, color: colors.muted }}>ITEMS</Text>
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>
              {totalQuantity}
            </Text>
          </View>
        </View>

        {/* Expanded Details */}
        {isExpanded && (
          <View style={{ marginTop: 8 }}>
            {/* Customer Info */}
            <View style={{ marginBottom: 12, padding: 10, backgroundColor: "rgba(0, 229, 255, 0.08)", borderRadius: 8 }}>
              <Text style={{ fontSize: 11, color: colors.primary, fontWeight: "600", marginBottom: 4 }}>CUSTOMER</Text>
              <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>{order.customerName || "Guest"}</Text>
              {order.customerPhone ? (
                <Text style={{ fontSize: 14, color: colors.foreground, marginTop: 2 }}>📞 {order.customerPhone}</Text>
              ) : null}
            </View>

            {/* Delivery Address */}
            <View style={{ marginBottom: 12, padding: 10, backgroundColor: "rgba(0,0,0,0.03)", borderRadius: 8 }}>
              <Text style={{ fontSize: 11, color: colors.muted, fontWeight: "600", marginBottom: 4 }}>DELIVER TO</Text>
              <Text style={{ fontSize: 14, color: colors.foreground }}>{order.deliveryAddress}</Text>
            </View>

            {/* Customer Notes */}
            {order.customerNotes ? (
              <View style={{ marginBottom: 12, padding: 10, backgroundColor: "rgba(245, 158, 11, 0.08)", borderRadius: 8 }}>
                <Text style={{ fontSize: 11, color: colors.warning, fontWeight: "600", marginBottom: 4 }}>CUSTOMER NOTES</Text>
                <Text style={{ fontSize: 14, color: colors.foreground, fontStyle: "italic" }}>{order.customerNotes}</Text>
              </View>
            ) : null}

            {/* Items List */}
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 11, color: colors.muted, fontWeight: "600", marginBottom: 8 }}>ORDER ITEMS</Text>
              {order.items?.map((item: any, idx: number) => (
                <View key={item.id || idx} style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingVertical: 6,
                  borderBottomWidth: idx < (order.items?.length || 0) - 1 ? 1 : 0,
                  borderBottomColor: "rgba(0,0,0,0.05)",
                }}>
                  <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
                    <View style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: colors.primary,
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 10,
                    }}>
                      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>{item.quantity}</Text>
                    </View>
                    <Text style={{ fontSize: 14, color: colors.foreground, flex: 1 }} numberOfLines={2}>
                      {item.product?.name || item.productName || "Item"}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground, marginLeft: 8 }}>
                    €{(parseFloat(item.productPrice || "0") * (item.quantity || 1)).toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>

          </View>
        )}

        {/* Print Button - always visible for accepted/preparing/ready orders */}
        {!isPending && (
          <TouchableOpacity
            onPress={() => handlePrintOrder(order.id)}
            disabled={isPrinting}
            style={{
              backgroundColor: justPrinted ? "#22C55E" : "#1a1a2e",
              padding: 14,
              borderRadius: 12,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
              marginTop: 10,
              marginBottom: 4,
              opacity: isPrinting ? 0.6 : 1,
            }}
          >
            <Text style={{ fontSize: 18 }}>{justPrinted ? "✅" : "🖨"}</Text>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
              {isPrinting ? "Sending to Printer..." : justPrinted ? "Sent to Printer!" : "Print Pick List"}
            </Text>
          </TouchableOpacity>
        )}

        {/* Action Buttons */}
        {nextStatus && (
          <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
            <TouchableOpacity
              onPress={() => handleUpdateStatus(order.id, nextStatus.status === "accepted" ? "preparing" : nextStatus.status, totalQuantity)}
              disabled={updateStatusMutation.isPending}
              style={{
                flex: 1,
                backgroundColor: colors.primary,
                padding: 14,
                borderRadius: 12,
                alignItems: "center",
                opacity: updateStatusMutation.isPending ? 0.6 : 1,
              }}
            >
              <Text style={{ color: colors.background, fontWeight: "700", fontSize: 15 }}>
                {updateStatusMutation.isPending ? "Updating..." : (nextStatus.status === "accepted" ? "Accept Order" : nextStatus.label)}
              </Text>
            </TouchableOpacity>

            {isPending && (
              <TouchableOpacity
                onPress={() => {
                  // Reject order
                  handleUpdateStatus(order.id, "cancelled");
                }}
                style={{
                  paddingHorizontal: 16,
                  padding: 14,
                  borderRadius: 12,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: colors.error,
                }}
              >
                <Text style={{ color: colors.error, fontWeight: "700", fontSize: 15 }}>Reject</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Driver info for active orders */}
        {order.driver && !isPending && (
          <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center" }}>
            <Text style={{ fontSize: 12, color: colors.muted }}>🚗 {order.driver.name}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <ScreenContainer>
      <ScrollView
        className="flex-1 p-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Header */}
        <View style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Text style={{ fontSize: 28, fontWeight: "800", color: colors.foreground }}>Store Dashboard</Text>
              <Text style={{ fontSize: 14, color: colors.muted }}>
                {myStore?.storeName || "Manage incoming orders"}
              </Text>
            </View>
            {/* Print Settings Button */}
            <TouchableOpacity
              onPress={() => setShowPrintSettings(!showPrintSettings)}
              style={{
                backgroundColor: showPrintSettings ? colors.primary : colors.surface,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "600", color: showPrintSettings ? colors.background : colors.foreground }}>
                🖨 Print
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Print Settings Panel */}
        {showPrintSettings && (
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: colors.border,
          }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground, marginBottom: 12 }}>
              🖨 Print Settings
            </Text>

            {/* Auto-print toggle */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>Auto-Print Large Orders</Text>
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                  Automatically print orders with many items
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleToggleAutoPrint}
                style={{
                  width: 56,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: printSettings?.autoPrintEnabled ? "#22C55E" : "#9BA1A6",
                  justifyContent: "center",
                  paddingHorizontal: 3,
                }}
              >
                <View style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: "#fff",
                  alignSelf: printSettings?.autoPrintEnabled ? "flex-end" : "flex-start",
                }} />
              </TouchableOpacity>
            </View>

            {/* Threshold selector */}
            {printSettings?.autoPrintEnabled && (
              <View>
                <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 8 }}>
                  Auto-print when order has this many items or more:
                </Text>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  {[3, 5, 7, 10].map((num) => (
                    <TouchableOpacity
                      key={num}
                      onPress={() => handleUpdateThreshold(num)}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderRadius: 20,
                        backgroundColor: (printSettings?.autoPrintThreshold || 5) === num ? colors.primary : "transparent",
                        borderWidth: 1,
                        borderColor: (printSettings?.autoPrintThreshold || 5) === num ? colors.primary : colors.border,
                      }}
                    >
                      <Text style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: (printSettings?.autoPrintThreshold || 5) === num ? colors.background : colors.foreground,
                      }}>
                        {num}+ items
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* POS Printer Link */}
            <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
              <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 8 }}>
                Open this link on your POS device to enable printing:
              </Text>
              <View style={{
                backgroundColor: "rgba(0,0,0,0.05)",
                padding: 10,
                borderRadius: 8,
              }}>
                <Text style={{ fontSize: 12, color: colors.primary, fontFamily: Platform.OS === "web" ? "monospace" : undefined }} selectable>
                  {typeof window !== "undefined" ? `${window.location.origin}/pos-printer?storeId=${myStore?.storeId || 1}` : `[app-url]/pos-printer?storeId=${myStore?.storeId || 1}`}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Audio Toggle */}
        <View style={{
          backgroundColor: colors.surface,
          padding: 14,
          borderRadius: 12,
          marginBottom: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>Audio Alerts</Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>
              {audioEnabled ? "Sound plays when new orders arrive" : "Audio alerts are muted"}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setAudioEnabled(!audioEnabled)}
            style={{
              width: 56,
              height: 30,
              borderRadius: 15,
              backgroundColor: audioEnabled ? "#22C55E" : "#9BA1A6",
              justifyContent: "center",
              paddingHorizontal: 3,
            }}
          >
            <View style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: "#fff",
              alignSelf: audioEnabled ? "flex-end" : "flex-start",
            }} />
          </TouchableOpacity>
        </View>

        {/* New Order Flash Banner */}
        {newOrderFlash && (
          <View style={{ backgroundColor: "#FEF3C7", padding: 12, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: "#F59E0B" }}>
            <Text style={{ color: "#92400E", fontWeight: "700", textAlign: "center", fontSize: 16 }}>
              🔔 NEW ORDER RECEIVED!
            </Text>
          </View>
        )}

        {/* Pending Orders */}
        {pendingOrders.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
              <Text style={{ fontSize: 20, fontWeight: "700", color: colors.foreground }}>
                🔔 New Orders
              </Text>
              <View style={{ backgroundColor: "#EF4444", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 }}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{pendingOrders.length}</Text>
              </View>
            </View>
            {pendingOrders.map((order: any) => renderOrderCard(order, true))}
          </View>
        )}

        {/* Active Orders */}
        {activeOrders.length > 0 && (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 20, fontWeight: "700", color: colors.foreground, marginBottom: 12 }}>
              📦 Active Orders ({activeOrders.length})
            </Text>
            {activeOrders.map((order: any) => renderOrderCard(order, false))}
          </View>
        )}

        {/* Empty State */}
        {!isLoading && (!orders || orders.length === 0) && (
          <View style={{ backgroundColor: colors.surface, padding: 32, borderRadius: 16, alignItems: "center" }}>
            <Image
              source={require("@/assets/images/Weshop4ulogo.jpg")}
              style={{ width: 96, height: 96, borderRadius: 48, marginBottom: 12 }}
              resizeMode="cover"
            />
            <Text style={{ fontSize: 20, fontWeight: "700", color: colors.foreground, marginBottom: 8 }}>No Orders Yet</Text>
            <Text style={{ fontSize: 14, color: colors.muted, textAlign: "center" }}>
              New orders will appear here. You'll get an alert when one comes in.
            </Text>
          </View>
        )}

        {/* Bottom spacing */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
}
