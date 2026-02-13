import { View, Text, TouchableOpacity, Pressable, ScrollView, Linking, ActivityIndicator, Platform } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";
import { ChatPanel } from "@/components/chat-panel";

export default function ActiveDeliveryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const orderId = params.orderId ? parseInt(params.orderId as string) : null;
  const { user } = useAuth();
  
  const { data: order, isLoading } = trpc.orders.getById.useQuery(
    { orderId: orderId! },
    { enabled: !!orderId }
  );
  const updateStatusMutation = trpc.orders.updateStatus.useMutation();
  const returnJobMutation = trpc.orders.returnJob.useMutation();
  const updateLocationMutation = trpc.drivers.updateLocation.useMutation();
  const notifyAtStoreMutation = trpc.drivers.notifyDriverAtStore.useMutation();
  const { data: returnCount } = trpc.drivers.getReturnCount.useQuery(
    { driverId: user?.id! },
    { enabled: !!user?.id }
  );
  
  const [deliveryStatus, setDeliveryStatus] = useState<"going_to_store" | "at_store" | "going_to_customer" | "delivered">("going_to_store");
  const [chatExpanded, setChatExpanded] = useState(false);
  const [showReturnConfirm, setShowReturnConfirm] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [isReturning, setIsReturning] = useState(false);
  const [returnError, setReturnError] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Location tracking - send updates every 15 seconds during active delivery
  useEffect(() => {
    if (!user?.id || !orderId || deliveryStatus === "delivered") return;
    if (Platform.OS === "web") {
      // Web: use navigator.geolocation
      if (!navigator.geolocation) return;

      const sendLocation = () => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            updateLocationMutation.mutate({
              driverId: user.id,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              orderId,
            });
          },
          (err) => console.log("Geolocation error:", err.message),
          { enableHighAccuracy: true, timeout: 10000 }
        );
      };

      sendLocation(); // Send immediately
      const locationInterval = setInterval(sendLocation, 15000);
      return () => clearInterval(locationInterval);
    } else {
      // Native: use expo-location
      let locationSub: any = null;
      (async () => {
        try {
          const Location = await import("expo-location");
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== "granted") return;

          locationSub = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              timeInterval: 15000,
              distanceInterval: 20,
            },
            (loc) => {
              updateLocationMutation.mutate({
                driverId: user!.id,
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
                orderId: orderId!,
              });
            }
          );
        } catch (e) {
          console.log("Location tracking not available:", e);
        }
      })();

      return () => {
        if (locationSub) locationSub.remove();
      };
    }
  }, [user?.id, orderId, deliveryStatus]);

  // Delivery timer - counts up from when driver accepted the order
  useEffect(() => {
    if (order?.driverAssignedAt) {
      const assignedTime = new Date(order.driverAssignedAt).getTime();
      const updateTimer = () => {
        const now = Date.now();
        setElapsedSeconds(Math.floor((now - assignedTime) / 1000));
      };
      updateTimer();
      timerRef.current = setInterval(updateTimer, 1000);
    } else {
      // Fallback: start from 0 if no assigned time
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [order?.driverAssignedAt]);

  const formatElapsed = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const openNavigation = (latitude: string | null, longitude: string | null, label: string) => {
    if (!latitude || !longitude) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&destination_place_id=${label}`;
    Linking.openURL(url).catch((error) => {
      console.error("Could not open navigation app:", error);
    });
  };

  const callPhone = (phone: string) => {
    Linking.openURL(`tel:${phone}`).catch((error) => {
      console.error("Could not make phone call:", error);
    });
  };

  const reasonRequired = returnCount?.reasonRequired || false;
  const returnsToday = returnCount?.returnsToday || 0;

  const handleReturnJob = async () => {
    if (!orderId || !user?.id) return;
    if (reasonRequired && !returnReason) {
      setReturnError("You must select a reason (3+ returns today).");
      return;
    }
    setReturnError("");
    setIsReturning(true);
    try {
      await returnJobMutation.mutateAsync({
        orderId,
        driverId: user.id,
        reason: returnReason || undefined,
      });
      // Navigate back to driver dashboard (driver is now offline)
      router.replace("/driver");
    } catch (error: any) {
      const msg = error?.message || "";
      if (msg.includes("REASON_REQUIRED")) {
        setReturnError("You must select a reason (3+ returns today).");
      } else {
        setReturnError("Failed to return job. Please try again.");
      }
      console.error("Failed to return job:", error);
      setIsReturning(false);
    }
  };

  const handleArrivedAtStore = async () => {
    console.log("[Driver] handleArrivedAtStore called", { orderId, userId: user?.id });
    if (!orderId || !user?.id) {
      console.log("[Driver] Missing orderId or userId, aborting");
      if (Platform.OS === "web") {
        alert("Error: Missing order or user information");
      }
      return;
    }
    
    // Update state immediately for instant UI feedback
    setDeliveryStatus("at_store");
    
    try {
      console.log("[Driver] Calling notifyAtStoreMutation...");
      const result = await notifyAtStoreMutation.mutateAsync({
        orderId,
        driverId: user.id,
      });
      console.log("[Driver] notifyAtStoreMutation success:", result);
    } catch (error) {
      console.error("[Driver] Failed to notify arrived at store:", error);
      // Revert state on error
      setDeliveryStatus("going_to_store");
      // Show error to user
      if (Platform.OS === "web") {
        alert("Failed to notify. Please try again.");
      }
    }
  };

  const handlePickedUp = async () => {
    if (!orderId) return;
    
    try {
      await updateStatusMutation.mutateAsync({
        orderId,
        status: "picked_up",
      });
      setDeliveryStatus("going_to_customer");
    } catch (error) {
      console.error("Failed to update order status:", error);
    }
  };

  const handleDelivered = async () => {
    if (!orderId) return;
    
    try {
      await updateStatusMutation.mutateAsync({
        orderId,
        status: "delivered",
      });
      setDeliveryStatus("delivered");
    } catch (error) {
      console.error("Failed to update order status:", error);
    }
  };

  const getStatusDisplay = () => {
    switch (deliveryStatus) {
      case "going_to_store":
        return { emoji: "🏪", text: "Going to Store", color: "text-primary" };
      case "at_store":
        return { emoji: "📦", text: "At Store - Pick Up Order", color: "text-warning" };
      case "going_to_customer":
        return { emoji: "🚗", text: "Delivering to Customer", color: "text-primary" };
      case "delivered":
        return { emoji: "✅", text: "Delivered", color: "text-success" };
    }
  };

  const status = getStatusDisplay();

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color="#0a7ea4" />
      </ScreenContainer>
    );
  }

  if (!order) {
    return (
      <ScreenContainer className="items-center justify-center p-4">
        <Text className="text-foreground text-lg mb-4">Order not found</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-primary px-6 py-3 rounded-lg active:opacity-70"
        >
          <Text className="text-background font-bold">Go Back</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  // Extract real data from order
  const storeName = order.store?.name || "Store";
  const storeAddress = order.store?.address || "Address unavailable";
  const storePhone = order.store?.phone || "";
  const storeLat = order.store?.latitude || null;
  const storeLng = order.store?.longitude || null;
  const customerAddress = order.deliveryAddress || "Address unavailable";
  const customerPhone = order.guestPhone || "";
  const customerLat = order.deliveryLatitude || null;
  const customerLng = order.deliveryLongitude || null;
  const deliveryFee = parseFloat(order.deliveryFee || "0");
  const tipAmount = parseFloat(order.tipAmount || "0");
  const totalDriverEarnings = deliveryFee + tipAmount;
  const orderTotal = parseFloat(order.total || "0");
  const paymentMethod = order.paymentMethod || "card";
  const customerNotes = order.customerNotes || null;
  const orderNumber = order.orderNumber || `Order #${order.id}`;

  return (
    <ScreenContainer>
      <ScrollView className="flex-1 p-4">
        {/* Back to Dashboard Link */}
        {deliveryStatus !== "delivered" && (
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingVertical: 4 }}
          >
            <Text style={{ fontSize: 16, color: '#0a7ea4', fontWeight: '600' }}>← Back to Dashboard</Text>
          </TouchableOpacity>
        )}

        {/* Return Job Confirmation Modal */}
        {showReturnConfirm && (
          <View className="bg-error/5 border-2 border-error p-4 rounded-lg mb-6">
            <Text className="text-error font-bold text-lg mb-2">Return This Job?</Text>
            <Text className="text-muted text-sm mb-2">
              The order will be sent back to the queue and offered to the next available driver. You will be taken offline.
            </Text>

            {/* Return count warning */}
            {returnsToday > 0 && (
              <View className={`p-2 rounded-lg mb-3 ${returnsToday >= 3 ? "bg-error/10" : "bg-warning/10"}`}>
                <Text className={`text-sm font-semibold ${returnsToday >= 3 ? "text-error" : "text-warning"}`}>
                  ⚠️ You have returned {returnsToday} job{returnsToday !== 1 ? "s" : ""} today{returnsToday >= 3 ? " - reason is now required" : ""}
                </Text>
              </View>
            )}

            {returnError ? (
              <View className="bg-error/10 p-2 rounded-lg mb-3">
                <Text className="text-error text-sm font-semibold">{returnError}</Text>
              </View>
            ) : null}
            
            {/* Reason selection */}
            <Text className="text-foreground font-semibold text-sm mb-2">
              Select a reason{reasonRequired ? " (required)" : "(optional)"}:
            </Text>
            <View className="gap-2 mb-4">
              {["Car trouble", "Personal emergency", "Too far away", "Other reason"].map((reason) => (
                <TouchableOpacity
                  key={reason}
                  onPress={() => {
                    setReturnReason(returnReason === reason ? "" : reason);
                    setReturnError("");
                  }}
                  className={`p-3 rounded-lg border ${returnReason === reason ? "bg-error/10 border-error" : "bg-surface border-border"} active:opacity-70`}
                >
                  <Text className={`text-sm ${returnReason === reason ? "text-error font-bold" : "text-foreground"}`}>
                    {returnReason === reason ? "\u2713 " : ""}{reason}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Confirm section - appears after selecting a reason */}
            {returnReason ? (
              <View className="bg-error/10 border border-error p-4 rounded-lg mb-4">
                <Text className="text-error font-bold text-center text-base mb-1">
                  Are you sure?
                </Text>
                <Text className="text-muted text-center text-xs mb-3">
                  You will be taken offline. Reason: {returnReason}
                </Text>
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => { setShowReturnConfirm(false); setReturnReason(""); setReturnError(""); }}
                    className="flex-1 bg-surface border border-border p-3 rounded-lg items-center active:opacity-70"
                  >
                    <Text className="text-foreground font-semibold">Keep Job</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleReturnJob}
                    disabled={isReturning}
                    style={[{ backgroundColor: '#EF4444', padding: 16, borderRadius: 8, alignItems: 'center', flex: 1 }, isReturning ? { opacity: 0.5 } : undefined]}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 }}>
                      {isReturning ? "Returning..." : "Confirm Return"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => { setShowReturnConfirm(false); setReturnReason(""); setReturnError(""); }}
                className="bg-surface border border-border p-3 rounded-lg items-center active:opacity-70"
              >
                <Text className="text-foreground font-semibold">Keep Job</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Status Header */}
        <View className="bg-primary/10 border-2 border-primary p-4 rounded-lg mb-6">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-muted text-sm mb-1">Active Delivery</Text>
              <Text className="text-foreground font-bold text-xl">{orderNumber}</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text className="text-4xl">{status.emoji}</Text>
            </View>
          </View>
          <View className="mt-3 bg-background p-3 rounded-lg">
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text className={`${status.color} font-bold`}>{status.text}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F9FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                <Text style={{ fontSize: 12, color: '#687076', marginRight: 4 }}>⏱</Text>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: elapsedSeconds >= 1800 ? '#EF4444' : '#0a7ea4', fontVariant: ['tabular-nums'] }}>
                  {formatElapsed(elapsedSeconds)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Customer Notes - ALWAYS visible at the top */}
        {customerNotes && (
          <View className="bg-warning/10 border border-warning p-4 rounded-lg mb-6">
            <Text className="text-warning font-bold text-sm mb-1">📝 Customer Notes:</Text>
            <Text className="text-foreground text-base">{customerNotes}</Text>
          </View>
        )}

        {/* Store Information */}
        {(deliveryStatus === "going_to_store" || deliveryStatus === "at_store") && (
          <View className="bg-surface p-4 rounded-lg mb-6">
            <Text className="text-foreground font-bold text-lg mb-3">📍 Pick Up Location</Text>
            
            <Text className="text-foreground font-semibold mb-1">{storeName}</Text>
            <Text className="text-muted text-sm mb-3">{storeAddress}</Text>

            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => openNavigation(storeLat, storeLng, storeName)}
                className="flex-1 bg-primary p-3 rounded-lg items-center active:opacity-70"
              >
                <Text className="text-background font-semibold">🗺️ Navigate</Text>
              </TouchableOpacity>
              {storePhone ? (
                <TouchableOpacity
                  onPress={() => callPhone(storePhone)}
                  className="flex-1 bg-surface border border-border p-3 rounded-lg items-center active:opacity-70"
                >
                  <Text className="text-foreground font-semibold">📞 Call</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {deliveryStatus === "going_to_store" && (
              <Pressable
                onPress={handleArrivedAtStore}
                disabled={notifyAtStoreMutation.isPending}
                style={({ pressed }) => ([
                  {
                    backgroundColor: '#F59E0B',
                    padding: 16,
                    borderRadius: 8,
                    alignItems: 'center',
                    marginTop: 12,
                    opacity: (notifyAtStoreMutation.isPending || pressed) ? 0.7 : 1,
                  }
                ])}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 }}>
                  {notifyAtStoreMutation.isPending ? "Notifying..." : "🏪 I've Arrived at Store"}
                </Text>
              </Pressable>
            )}

            {deliveryStatus === "at_store" && (
              <View style={{ marginTop: 12, gap: 8 }}>
                <View style={{ backgroundColor: '#FEF3C7', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#F59E0B' }}>
                  <Text style={{ color: '#92400E', fontSize: 13, fontWeight: '600', textAlign: 'center' }}>
                    ✅ Customer has been notified you're at the store
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handlePickedUp}
                  className="bg-success p-4 rounded-lg items-center active:opacity-70"
                >
                  <Text className="text-background font-bold text-lg">✓ Picked Up Order</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Delivery Destination Preview - visible during pickup phase */}
        {(deliveryStatus === "going_to_store" || deliveryStatus === "at_store") && (
          <View className="bg-surface/50 border border-border p-4 rounded-lg mb-6">
            <Text className="text-foreground font-bold text-lg mb-3">🏠 Delivery Destination</Text>
            <Text className="text-foreground text-sm mb-1">{customerAddress}</Text>
            {(order as any).deliveryEircode && (
              <Text className="text-muted text-xs mb-3">Eircode: {(order as any).deliveryEircode}</Text>
            )}
            <TouchableOpacity
              onPress={() => openNavigation(customerLat, customerLng, "Customer")}
              className="bg-surface border border-primary p-2.5 rounded-lg items-center active:opacity-70"
            >
              <Text className="text-primary font-semibold text-sm">🗺️ Preview Route</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Customer Information - Active navigation phase */}
        {deliveryStatus === "going_to_customer" && (
          <View className="bg-surface p-4 rounded-lg mb-6">
            <Text className="text-foreground font-bold text-lg mb-3">🏠 Delivery Location</Text>
            
            <Text className="text-muted text-sm mb-3">{customerAddress}</Text>

            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => openNavigation(customerLat, customerLng, "Customer")}
                className="flex-1 bg-primary p-3 rounded-lg items-center active:opacity-70"
              >
                <Text className="text-background font-semibold">🗺️ Navigate</Text>
              </TouchableOpacity>
              {customerPhone ? (
                <TouchableOpacity
                  onPress={() => callPhone(customerPhone)}
                  className="flex-1 bg-surface border border-border p-3 rounded-lg items-center active:opacity-70"
                >
                  <Text className="text-foreground font-semibold">📞 Call</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <TouchableOpacity
              onPress={handleDelivered}
              className="mt-3 bg-success p-4 rounded-lg items-center active:opacity-70"
            >
              <Text className="text-background font-bold text-lg">✓ Delivery Complete</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Delivery Summary */}
        {deliveryStatus === "delivered" && (
          <View className="mb-6">
            {/* Congratulations */}
            <View style={{ backgroundColor: '#F0FDF4', borderWidth: 2, borderColor: '#22C55E', borderRadius: 12, padding: 24, alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 48, marginBottom: 8 }}>🎉</Text>
              <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#16A34A', marginBottom: 4 }}>Great Job!</Text>
              <Text style={{ fontSize: 14, color: '#687076', textAlign: 'center' }}>Delivery completed successfully</Text>
            </View>

            {/* Summary Card */}
            <View style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#11181C', marginBottom: 12 }}>Delivery Summary</Text>
              
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
                <Text style={{ color: '#687076', fontSize: 14 }}>Order</Text>
                <Text style={{ color: '#11181C', fontWeight: '600', fontSize: 14 }}>{orderNumber}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
                <Text style={{ color: '#687076', fontSize: 14 }}>Store</Text>
                <Text style={{ color: '#11181C', fontWeight: '600', fontSize: 14 }}>{storeName}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
                <Text style={{ color: '#687076', fontSize: 14 }}>Time Taken</Text>
                <Text style={{ color: '#11181C', fontWeight: '600', fontSize: 14 }}>{formatElapsed(elapsedSeconds)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
                <Text style={{ color: '#687076', fontSize: 14 }}>Payment</Text>
                <Text style={{ color: '#11181C', fontWeight: '600', fontSize: 14 }}>{paymentMethod === "cash_on_delivery" ? "Cash" : "Card"}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: tipAmount > 0 ? 1 : 0, borderBottomColor: '#E5E7EB' }}>
                <Text style={{ color: '#687076', fontSize: 14 }}>Delivery Fee</Text>
                <Text style={{ color: '#11181C', fontWeight: '600', fontSize: 14 }}>€{deliveryFee.toFixed(2)}</Text>
              </View>
              {tipAmount > 0 && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
                  <Text style={{ color: '#0a7ea4', fontSize: 14, fontWeight: '600' }}>Driver Tip</Text>
                  <Text style={{ color: '#0a7ea4', fontWeight: 'bold', fontSize: 14 }}>+€{tipAmount.toFixed(2)}</Text>
                </View>
              )}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, marginTop: 4, borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
                <Text style={{ color: '#11181C', fontWeight: 'bold', fontSize: 16 }}>Your Earnings</Text>
                <Text style={{ color: '#0a7ea4', fontWeight: 'bold', fontSize: 20 }}>€{totalDriverEarnings.toFixed(2)}</Text>
              </View>
            </View>

            {/* Back to Dashboard Button */}
            <TouchableOpacity
              onPress={() => router.replace("/driver")}
              style={{ backgroundColor: '#0a7ea4', padding: 16, borderRadius: 12, alignItems: 'center' }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 }}>Back to Dashboard</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Return Job Button - only visible before pickup */}
        {(deliveryStatus === "going_to_store" || deliveryStatus === "at_store") && !showReturnConfirm && (
          <TouchableOpacity
            onPress={() => setShowReturnConfirm(true)}
            className="bg-surface border-2 border-error p-4 rounded-lg mb-6 items-center active:opacity-70"
          >
            <Text className="text-error font-bold text-base">↩ Return Job to Queue</Text>
            <Text className="text-muted text-xs mt-1">Send this job back for another driver</Text>
          </TouchableOpacity>
        )}

        {/* Order Items */}
        <View className="bg-surface p-4 rounded-lg mb-6">
          <Text className="text-foreground font-bold text-lg mb-3">Order Items</Text>
          {order.items && order.items.length > 0 ? (
            order.items.map((item: any, index: number) => (
              <View key={index} className="flex-row justify-between py-2 border-b border-border">
                <Text className="text-foreground">{item.quantity}x {item.productName || `Item #${item.productId}`}</Text>
                <Text className="text-muted">€{parseFloat(item.subtotal || "0").toFixed(2)}</Text>
              </View>
            ))
          ) : (
            <Text className="text-muted">No items available</Text>
          )}
        </View>

        {/* Payment Information */}
        <View className="bg-surface p-4 rounded-lg mb-6">
          <Text className="text-foreground font-bold text-lg mb-3">Payment Details</Text>
          
          <View className="flex-row justify-between mb-2">
            <Text className="text-muted">Payment Method</Text>
            <Text className="text-foreground font-semibold">
              {paymentMethod === "card" ? "Card (Paid)" : "Cash on Delivery"}
            </Text>
          </View>

          {paymentMethod === "cash_on_delivery" && (
            <View className="bg-warning/10 border border-warning p-3 rounded-lg mt-2">
              <Text className="text-warning font-bold mb-1">💰 Collect Cash</Text>
              <Text className="text-foreground">
                Collect <Text className="font-bold">€{orderTotal.toFixed(2)}</Text> from customer
              </Text>
            </View>
          )}

          <View className="flex-row justify-between mt-3 pt-3 border-t border-border">
            <Text className="text-muted">Order Total</Text>
            <Text className="text-foreground font-semibold">€{orderTotal.toFixed(2)}</Text>
          </View>
          <View className="flex-row justify-between mt-2">
            <Text className="text-muted">Delivery Fee</Text>
            <Text className="text-primary font-bold text-lg">€{deliveryFee.toFixed(2)}</Text>
          </View>
          {tipAmount > 0 && (
            <View className="flex-row justify-between mt-2">
              <Text style={{ color: '#0a7ea4', fontWeight: '600' }}>Driver Tip</Text>
              <Text style={{ color: '#0a7ea4', fontWeight: 'bold', fontSize: 16 }}>+€{tipAmount.toFixed(2)}</Text>
            </View>
          )}
          {tipAmount > 0 && (
            <View className="flex-row justify-between mt-2 pt-2 border-t border-border">
              <Text className="text-foreground font-bold">Your Total Earnings</Text>
              <Text style={{ color: '#22C55E', fontWeight: 'bold', fontSize: 18 }}>€{totalDriverEarnings.toFixed(2)}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Chat Panel */}
      {orderId && user?.id && deliveryStatus !== "delivered" && (
        <ChatPanel
          orderId={orderId}
          userId={user.id}
          userRole="driver"
          isExpanded={chatExpanded}
          onToggle={() => setChatExpanded(!chatExpanded)}
        />
      )}
    </ScreenContainer>
  );
}
