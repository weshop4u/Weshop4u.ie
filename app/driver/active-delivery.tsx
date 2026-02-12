import { View, Text, TouchableOpacity, ScrollView, Linking, ActivityIndicator } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";

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
  const { data: returnCount } = trpc.drivers.getReturnCount.useQuery(
    { driverId: user?.id! },
    { enabled: !!user?.id }
  );
  
  const [deliveryStatus, setDeliveryStatus] = useState<"going_to_store" | "at_store" | "going_to_customer" | "delivered">("going_to_store");
  const [showReturnConfirm, setShowReturnConfirm] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [isReturning, setIsReturning] = useState(false);
  const [returnError, setReturnError] = useState("");

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

  const handleReturnJob = async (reason: string) => {
    if (!orderId || !user?.id) return;
    if (reasonRequired && !reason) {
      setReturnError("You must select a reason (3+ returns today).");
      return;
    }
    setReturnError("");
    setIsReturning(true);
    try {
      await returnJobMutation.mutateAsync({
        orderId,
        driverId: user.id,
        reason: reason || undefined,
      });
      // Navigate back to driver dashboard
      router.push("/driver");
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
      // Navigate back to driver dashboard
      setTimeout(() => {
        router.push("/driver");
      }, 1000);
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
  const orderTotal = parseFloat(order.total || "0");
  const paymentMethod = order.paymentMethod || "card";
  const customerNotes = order.customerNotes || null;
  const orderNumber = order.orderNumber || `Order #${order.id}`;

  return (
    <ScreenContainer>
      <ScrollView className="flex-1 p-4">
        {/* Back Button */}
        <TouchableOpacity
          onPress={() => router.back()}
          className="active:opacity-70 mb-4"
        >
          <Text className="text-primary text-lg">‹ Back to Available Jobs</Text>
        </TouchableOpacity>

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
            
            {/* Quick reason buttons */}
            <Text className="text-foreground font-semibold text-sm mb-2">
              Reason {reasonRequired ? "(required)" : "(optional)"}:
            </Text>
            <View className="gap-2 mb-4">
              {["Car trouble", "Personal emergency", "Too far away", "Other reason"].map((reason) => (
                <TouchableOpacity
                  key={reason}
                  onPress={() => setReturnReason(returnReason === reason ? "" : reason)}
                  className={`p-3 rounded-lg border ${returnReason === reason ? "bg-error/10 border-error" : "bg-surface border-border"} active:opacity-70`}
                >
                  <Text className={`text-sm ${returnReason === reason ? "text-error font-bold" : "text-foreground"}`}>
                    {returnReason === reason ? "✓ " : ""}{reason}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => { setShowReturnConfirm(false); setReturnReason(""); }}
                className="flex-1 bg-surface border border-border p-3 rounded-lg items-center active:opacity-70"
              >
                <Text className="text-foreground font-semibold">Keep Job</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleReturnJob(returnReason)}
                disabled={isReturning}
                className="flex-1 bg-error p-3 rounded-lg items-center active:opacity-70"
                style={isReturning ? { opacity: 0.5 } : undefined}
              >
                <Text className="text-background font-bold">
                  {isReturning ? "Returning..." : "Return Job"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Status Header */}
        <View className="bg-primary/10 border-2 border-primary p-4 rounded-lg mb-6">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-muted text-sm mb-1">Active Delivery</Text>
              <Text className="text-foreground font-bold text-xl">{orderNumber}</Text>
            </View>
            <Text className="text-4xl">{status.emoji}</Text>
          </View>
          <View className="mt-3 bg-background p-3 rounded-lg">
            <Text className={`${status.color} font-bold text-center`}>{status.text}</Text>
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
              <TouchableOpacity
                onPress={handlePickedUp}
                className="mt-3 bg-success p-4 rounded-lg items-center active:opacity-70"
              >
                <Text className="text-background font-bold text-lg">✓ Picked Up Order</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Customer Information */}
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

        {/* Delivery Complete Message */}
        {deliveryStatus === "delivered" && (
          <View className="bg-success/10 border border-success p-4 rounded-lg mb-6 items-center">
            <Text className="text-success font-bold text-xl mb-2">🎉 Delivery Complete!</Text>
            <Text className="text-muted text-center">Redirecting to dashboard...</Text>
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
            <Text className="text-muted">Your Earnings</Text>
            <Text className="text-primary font-bold text-lg">€{deliveryFee.toFixed(2)}</Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
