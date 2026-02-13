import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo } from "react";

/** Compute estimated delivery time based on status and timestamps. */
function getEstimatedDelivery(order: any): { label: string; minutes: number | null } | null {
  if (order.status === "delivered") return null;
  if (order.status === "cancelled") return null;

  const distKm = order.deliveryDistance ? parseFloat(order.deliveryDistance) : 3;

  // Average prep time: 10-15 min, driver travel: ~2 min/km
  const driveMins = Math.max(5, Math.round(distKm * 2));

  switch (order.status) {
    case "pending":
      // Waiting for store to accept + prep + drive
      return { label: "Estimated delivery", minutes: 5 + 15 + driveMins };
    case "accepted":
    case "preparing":
      // Prep time remaining + drive
      return { label: "Estimated delivery", minutes: 12 + driveMins };
    case "ready_for_pickup":
      // Waiting for driver + drive
      return { label: "Estimated delivery", minutes: 5 + driveMins };
    case "picked_up":
    case "on_the_way":
      // Drive only
      return { label: "Arriving in", minutes: driveMins };
    default:
      return null;
  }
}

type DateLike = string | Date | null | undefined;

/** Format a timestamp to a readable time string. */
function formatTime(dateStr: DateLike): string {
  if (!dateStr) return "";
  const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(dateStr: DateLike): string {
  if (!dateStr) return "";
  const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Get time elapsed since a timestamp. */
function getElapsed(dateStr: DateLike): string {
  if (!dateStr) return "";
  const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  return formatDateTime(dateStr);
}

/** Leaflet-based live map for web - shows driver, store, and delivery markers */
function LiveMapWeb({
  driverLat,
  driverLng,
  storeLat,
  storeLng,
  deliveryLat,
  deliveryLng,
  storeName,
  hasDriver,
}: {
  driverLat: number | null;
  driverLng: number | null;
  storeLat: number | null;
  storeLng: number | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  storeName: string;
  hasDriver: boolean;
}) {
  // Build a static map URL using OpenStreetMap tiles via an iframe with Leaflet
  // Center on driver if available, otherwise on store, otherwise on delivery
  const centerLat = driverLat ?? storeLat ?? deliveryLat ?? 53.6;
  const centerLng = driverLng ?? storeLng ?? deliveryLng ?? -6.18;
  const zoom = hasDriver ? 14 : 13;

  // Build markers JS for Leaflet
  const markers: string[] = [];
  if (storeLat && storeLng) {
    markers.push(
      `L.marker([${storeLat},${storeLng}],{icon:L.divIcon({html:'<div style="font-size:24px">\uD83C\uDFEA</div>',iconSize:[30,30],iconAnchor:[15,15],className:''})}).addTo(map).bindPopup('${storeName.replace(/'/g, "\\'")}');`
    );
  }
  if (deliveryLat && deliveryLng) {
    markers.push(
      `L.marker([${deliveryLat},${deliveryLng}],{icon:L.divIcon({html:'<div style="font-size:24px">\uD83C\uDFE0</div>',iconSize:[30,30],iconAnchor:[15,15],className:''})}).addTo(map).bindPopup('Delivery Address');`
    );
  }
  if (hasDriver && driverLat && driverLng) {
    markers.push(
      `L.marker([${driverLat},${driverLng}],{icon:L.divIcon({html:'<div style="font-size:28px">\uD83D\uDE97</div>',iconSize:[34,34],iconAnchor:[17,17],className:''})}).addTo(map).bindPopup('Driver').openPopup();`
    );
  }

  // Fit bounds to show all markers
  const allPoints: string[] = [];
  if (storeLat && storeLng) allPoints.push(`[${storeLat},${storeLng}]`);
  if (deliveryLat && deliveryLng) allPoints.push(`[${deliveryLat},${deliveryLng}]`);
  if (hasDriver && driverLat && driverLng) allPoints.push(`[${driverLat},${driverLng}]`);

  const fitBoundsJs = allPoints.length >= 2
    ? `map.fitBounds([${allPoints.join(",")}],{padding:[30,30]});`
    : `map.setView([${centerLat},${centerLng}],${zoom});`;

  const html = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{margin:0;padding:0;width:100%;height:100%}</style>
</head><body>
<div id="map"></div>
<script>
var map=L.map('map',{zoomControl:false});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'',maxZoom:18}).addTo(map);
${markers.join("\n")}
${fitBoundsJs}
</script></body></html>`;

  const srcDoc = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;

  return (
    <View style={{ height: 250, width: "100%" }}>
      {/* @ts-ignore - iframe works on web */}
      <iframe
        src={srcDoc}
        style={{ width: "100%", height: "100%", border: "none" }}
        title="Driver Location Map"
      />
    </View>
  );
}

export default function OrderTrackingScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const orderIdNum = parseInt(orderId);

  const { data: order, isLoading, refetch } = trpc.orders.getById.useQuery({ orderId: orderIdNum });

  // Get driver location (only when order is picked up or on the way)
  const isActiveDelivery = order?.status === "picked_up" || order?.status === "on_the_way";
  const { data: locationData } = trpc.drivers.getDriverLocation.useQuery(
    { orderId: orderIdNum },
    {
      enabled: !!order && (isActiveDelivery || order?.status === "preparing" || order?.status === "ready_for_pickup" || order?.status === "pending" || order?.status === "accepted"),
      refetchInterval: isActiveDelivery ? 10000 : 30000, // 10s during delivery, 30s otherwise
    }
  );

  // Auto-refresh order status every 8 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 8000);
    return () => clearInterval(interval);
  }, [refetch]);

  const statusSteps = useMemo(() => [
    { key: "pending", label: "Order Placed", icon: "1", activeColor: "#0a7ea4" },
    { key: "accepted", label: "Store Accepted", icon: "2", activeColor: "#0a7ea4" },
    { key: "preparing", label: "Preparing Your Order", icon: "3", activeColor: "#F59E0B" },
    { key: "ready_for_pickup", label: "Ready for Pickup", icon: "4", activeColor: "#22C55E" },
    { key: "picked_up", label: "Driver Picked Up", icon: "5", activeColor: "#22C55E" },
    { key: "on_the_way", label: "On the Way to You", icon: "6", activeColor: "#0a7ea4" },
    { key: "delivered", label: "Delivered!", icon: "✓", activeColor: "#22C55E" },
  ], []);

  const estimated = order ? getEstimatedDelivery(order) : null;

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color="#00E5FF" />
        <Text className="text-muted mt-4">Loading order details...</Text>
      </ScreenContainer>
    );
  }

  if (!order) {
    return (
      <ScreenContainer className="items-center justify-center p-4">
        <Text style={{ fontSize: 48, marginBottom: 12 }}>📦</Text>
        <Text className="text-foreground text-lg mb-2">Order not found</Text>
        <TouchableOpacity
          onPress={() => router.push("/")}
          style={{ backgroundColor: "#0a7ea4", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, marginTop: 16 }}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>Back to Home</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  const currentStatusIndex = statusSteps.findIndex(step => step.key === order.status);
  const isCancelled = order.status === "cancelled";
  const isDelivered = order.status === "delivered";

  // Map status keys to their timestamps
  const getTimestampForStep = (key: string): DateLike => {
    switch (key) {
      case "pending": return order.createdAt;
      case "accepted": return order.acceptedAt;
      case "preparing": return order.acceptedAt; // preparing starts when accepted
      case "ready_for_pickup": return null; // no separate timestamp in schema
      case "picked_up": return order.pickedUpAt;
      case "on_the_way": return order.pickedUpAt; // on_the_way starts at pickup
      case "delivered": return order.deliveredAt;
      default: return null;
    }
  };

  const storeName = order.store?.name || "Store";

  return (
    <ScreenContainer>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={{ backgroundColor: "#0a7ea4", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 12 }}>
            <Text style={{ color: "#fff", fontSize: 14 }}>{"\u2190"} Back</Text>
          </TouchableOpacity>
          <Text style={{ color: "#fff", fontSize: 24, fontWeight: "700" }}>Track Order</Text>
          <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, marginTop: 2 }}>
            #{order.orderNumber} from {storeName}
          </Text>
        </View>

        {/* Estimated Delivery Banner */}
        {estimated && !isCancelled && (
          <View style={{
            backgroundColor: isDelivered ? "#22C55E" : "#0a7ea4",
            marginHorizontal: 16,
            marginTop: -12,
            borderRadius: 12,
            padding: 16,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            ...Platform.select({
              web: { boxShadow: "0 4px 12px rgba(0,0,0,0.15)" },
              default: { elevation: 4 },
            }),
          }}>
            <View>
              <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "500" }}>
                {estimated.label}
              </Text>
              <Text style={{ color: "#fff", fontSize: 28, fontWeight: "800" }}>
                {estimated.minutes !== null ? `~${estimated.minutes} min` : "Calculating..."}
              </Text>
            </View>
            <View style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: "rgba(255,255,255,0.2)",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <Text style={{ fontSize: 24 }}>
                {order.status === "on_the_way" || order.status === "picked_up" ? "🚗" :
                 order.status === "preparing" ? "👨‍🍳" :
                 order.status === "ready_for_pickup" ? "📦" : "⏳"}
              </Text>
            </View>
          </View>
        )}

        {/* Delivered Banner */}
        {isDelivered && (
          <View style={{
            backgroundColor: "#22C55E",
            marginHorizontal: 16,
            marginTop: -12,
            borderRadius: 12,
            padding: 16,
            alignItems: "center",
            ...Platform.select({
              web: { boxShadow: "0 4px 12px rgba(0,0,0,0.15)" },
              default: { elevation: 4 },
            }),
          }}>
            <Text style={{ fontSize: 36, marginBottom: 4 }}>🎉</Text>
            <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700" }}>Order Delivered!</Text>
            {order.deliveredAt && (
              <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, marginTop: 4 }}>
                Delivered at {formatTime(order.deliveredAt)}
              </Text>
            )}
          </View>
        )}

        {/* Cancelled Banner */}
        {isCancelled && (
          <View style={{
            backgroundColor: "#FEE2E2",
            marginHorizontal: 16,
            marginTop: 16,
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            borderColor: "#EF4444",
          }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={{ fontSize: 32, marginRight: 12 }}>❌</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#EF4444", fontWeight: "700", fontSize: 16 }}>Order Cancelled</Text>
                {order.cancellationReason && (
                  <Text style={{ color: "#DC2626", fontSize: 13, marginTop: 4 }}>{order.cancellationReason}</Text>
                )}
                {order.cancelledAt && (
                  <Text style={{ color: "#9CA3AF", fontSize: 12, marginTop: 4 }}>{formatDateTime(order.cancelledAt)}</Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Live Driver Map */}
        {locationData && !isCancelled && !isDelivered && (
          <View style={{
            marginHorizontal: 16,
            marginTop: 16,
            backgroundColor: "#fff",
            borderRadius: 12,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: "#E5E7EB",
          }}>
            <View style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}>
              <Text className="text-foreground font-bold text-base">
                {locationData.hasLocation ? "Live Driver Location" : "Order Location"}
              </Text>
              {locationData.hasLocation && locationData.driver?.name && (
                <Text style={{ color: "#687076", fontSize: 12, marginTop: 2 }}>
                  Driver: {locationData.driver.name}
                  {locationData.driver.lastUpdate && (
                    <Text> · Updated {getElapsed(locationData.driver.lastUpdate)}</Text>
                  )}
                </Text>
              )}
            </View>
            {/* OpenStreetMap embed showing driver, store, and delivery locations */}
            {Platform.OS === "web" ? (
              <LiveMapWeb
                driverLat={locationData.driver?.latitude ?? null}
                driverLng={locationData.driver?.longitude ?? null}
                storeLat={locationData.store?.latitude ?? null}
                storeLng={locationData.store?.longitude ?? null}
                deliveryLat={locationData.delivery?.latitude ?? null}
                deliveryLng={locationData.delivery?.longitude ?? null}
                storeName={locationData.store?.name || "Store"}
                hasDriver={locationData.hasLocation}
              />
            ) : (
              <View style={{ height: 200, alignItems: "center", justifyContent: "center", backgroundColor: "#F9FAFB" }}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>
                  {locationData.hasLocation ? "🚗" : "📍"}
                </Text>
                <Text style={{ color: "#687076", fontSize: 13, textAlign: "center", paddingHorizontal: 20 }}>
                  {locationData.hasLocation
                    ? "Driver is on the way! Open the app in a browser for the live map."
                    : "Map will show driver location once order is picked up."}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Status Timeline */}
        {!isCancelled && (
          <View style={{
            marginHorizontal: 16,
            marginTop: 20,
            backgroundColor: "#fff",
            borderRadius: 12,
            padding: 20,
            borderWidth: 1,
            borderColor: "#E5E7EB",
          }}>
            <Text className="text-foreground font-bold text-lg" style={{ marginBottom: 16 }}>Order Progress</Text>

            {statusSteps.map((step, index) => {
              const isCompleted = index <= currentStatusIndex;
              const isCurrent = index === currentStatusIndex;
              const isLast = index === statusSteps.length - 1;
              const timestamp = getTimestampForStep(step.key);

              return (
                <View key={step.key}>
                  <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                    {/* Step indicator */}
                    <View style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: isCompleted ? step.activeColor : "#E5E7EB",
                      alignItems: "center",
                      justifyContent: "center",
                      ...(isCurrent ? {
                        borderWidth: 3,
                        borderColor: step.activeColor + "40",
                      } : {}),
                    }}>
                      <Text style={{
                        color: isCompleted ? "#fff" : "#9CA3AF",
                        fontWeight: "700",
                        fontSize: step.icon === "✓" ? 16 : 14,
                      }}>
                        {isCompleted && index < currentStatusIndex ? "✓" : step.icon}
                      </Text>
                    </View>

                    {/* Step content */}
                    <View style={{ flex: 1, marginLeft: 12, paddingBottom: isLast ? 0 : 4 }}>
                      <Text style={{
                        fontWeight: isCurrent ? "700" : "600",
                        fontSize: isCurrent ? 15 : 14,
                        color: isCompleted ? "#11181C" : "#9CA3AF",
                      }}>
                        {step.label}
                      </Text>

                      {/* Timestamp for completed steps */}
                      {isCompleted && timestamp && (
                        <Text style={{ color: "#687076", fontSize: 12, marginTop: 2 }}>
                          {formatTime(timestamp)}
                          {isCurrent && (
                            <Text style={{ color: step.activeColor }}> · {getElapsed(timestamp)}</Text>
                          )}
                        </Text>
                      )}

                      {/* Current step description */}
                      {isCurrent && !isDelivered && (
                        <Text style={{ color: step.activeColor, fontSize: 12, fontWeight: "600", marginTop: 4 }}>
                          {step.key === "pending" && "Waiting for store to accept your order..."}
                          {step.key === "accepted" && "Store has accepted — preparing soon!"}
                          {step.key === "preparing" && "Your order is being prepared now"}
                          {step.key === "ready_for_pickup" && "Waiting for a driver to pick up"}
                          {step.key === "picked_up" && "Driver has your order"}
                          {step.key === "on_the_way" && "Driver is on the way to you!"}
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Connector line */}
                  {!isLast && (
                    <View style={{
                      width: 2,
                      height: 24,
                      marginLeft: 17,
                      backgroundColor: index < currentStatusIndex ? step.activeColor : "#E5E7EB",
                      marginVertical: 2,
                    }} />
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Delivery Information */}
        <View style={{
          marginHorizontal: 16,
          marginTop: 16,
          backgroundColor: "#fff",
          borderRadius: 12,
          padding: 16,
          borderWidth: 1,
          borderColor: "#E5E7EB",
        }}>
          <Text className="text-foreground font-bold text-base" style={{ marginBottom: 12 }}>Delivery Details</Text>

          <View style={{ flexDirection: "row", marginBottom: 10 }}>
            <Text style={{ color: "#687076", fontSize: 13, width: 100 }}>Address</Text>
            <Text style={{ color: "#11181C", fontSize: 13, flex: 1 }}>{order.deliveryAddress}</Text>
          </View>

          {order.deliveryDistance && (
            <View style={{ flexDirection: "row", marginBottom: 10 }}>
              <Text style={{ color: "#687076", fontSize: 13, width: 100 }}>Distance</Text>
              <Text style={{ color: "#11181C", fontSize: 13, flex: 1 }}>
                {parseFloat(order.deliveryDistance).toFixed(1)} km
              </Text>
            </View>
          )}

          <View style={{ flexDirection: "row", marginBottom: 10 }}>
            <Text style={{ color: "#687076", fontSize: 13, width: 100 }}>Payment</Text>
            <Text style={{ color: "#11181C", fontSize: 13, flex: 1 }}>
              {order.paymentMethod === "card" ? "Card (Paid)" : "Cash on Delivery"}
            </Text>
          </View>

          {order.customerNotes ? (
            <View style={{ flexDirection: "row" }}>
              <Text style={{ color: "#687076", fontSize: 13, width: 100 }}>Notes</Text>
              <Text style={{ color: "#11181C", fontSize: 13, flex: 1, fontStyle: "italic" }}>
                {order.customerNotes}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Order Items */}
        <View style={{
          marginHorizontal: 16,
          marginTop: 16,
          backgroundColor: "#fff",
          borderRadius: 12,
          padding: 16,
          borderWidth: 1,
          borderColor: "#E5E7EB",
        }}>
          <Text className="text-foreground font-bold text-base" style={{ marginBottom: 12 }}>
            Order Items ({order.items?.length || 0})
          </Text>

          {order.items?.map((item: any, idx: number) => (
            <View
              key={item.id || idx}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                paddingVertical: 8,
                borderBottomWidth: idx < (order.items?.length || 0) - 1 ? 1 : 0,
                borderBottomColor: "#F3F4F6",
              }}
            >
              <Text style={{ color: "#11181C", fontSize: 14, flex: 1 }}>
                {item.quantity}x {item.productName}
              </Text>
              <Text style={{ color: "#11181C", fontSize: 14, fontWeight: "600" }}>
                €{parseFloat(item.subtotal).toFixed(2)}
              </Text>
            </View>
          ))}

          {/* Price breakdown */}
          <View style={{ borderTopWidth: 1, borderTopColor: "#E5E7EB", marginTop: 12, paddingTop: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
              <Text style={{ color: "#687076", fontSize: 13 }}>Subtotal</Text>
              <Text style={{ color: "#687076", fontSize: 13 }}>€{parseFloat(order.subtotal).toFixed(2)}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
              <Text style={{ color: "#687076", fontSize: 13 }}>Service Fee</Text>
              <Text style={{ color: "#687076", fontSize: 13 }}>€{parseFloat(order.serviceFee).toFixed(2)}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ color: "#687076", fontSize: 13 }}>Delivery Fee</Text>
              <Text style={{ color: "#687076", fontSize: 13 }}>€{parseFloat(order.deliveryFee).toFixed(2)}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: "#11181C", fontSize: 16, fontWeight: "700" }}>Total</Text>
              <Text style={{ color: "#0a7ea4", fontSize: 16, fontWeight: "700" }}>€{parseFloat(order.total).toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Full Timeline */}
        <View style={{
          marginHorizontal: 16,
          marginTop: 16,
          backgroundColor: "#fff",
          borderRadius: 12,
          padding: 16,
          borderWidth: 1,
          borderColor: "#E5E7EB",
        }}>
          <Text className="text-foreground font-bold text-base" style={{ marginBottom: 12 }}>Timeline</Text>

          {[
            { label: "Order Placed", time: order.createdAt },
            { label: "Accepted by Store", time: order.acceptedAt },
            { label: "Driver Assigned", time: order.driverAssignedAt },
            { label: "Picked Up", time: order.pickedUpAt },
            { label: "Delivered", time: order.deliveredAt },
            { label: "Cancelled", time: order.cancelledAt, isError: true },
          ]
            .filter(entry => entry.time)
            .map((entry, idx) => (
              <View
                key={idx}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 6,
                }}
              >
                <View style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: entry.isError ? "#EF4444" : "#0a7ea4",
                  marginRight: 10,
                }} />
                <Text style={{
                  color: entry.isError ? "#EF4444" : "#687076",
                  fontSize: 13,
                  width: 130,
                }}>
                  {entry.label}
                </Text>
                <Text style={{
                  color: entry.isError ? "#EF4444" : "#11181C",
                  fontSize: 13,
                  fontWeight: "500",
                }}>
                  {formatDateTime(entry.time)}
                </Text>
              </View>
            ))}
        </View>

        {/* Action Buttons */}
        <View style={{ marginHorizontal: 16, marginTop: 20, marginBottom: 20, gap: 12 }}>
          <TouchableOpacity
            onPress={() => router.push("/")}
            style={{
              backgroundColor: "#0a7ea4",
              padding: 16,
              borderRadius: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Back to Home</Text>
          </TouchableOpacity>

          {isDelivered && (
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/orders")}
              style={{
                backgroundColor: "#fff",
                padding: 16,
                borderRadius: 12,
                alignItems: "center",
                borderWidth: 1,
                borderColor: "#E5E7EB",
              }}
            >
              <Text style={{ color: "#0a7ea4", fontWeight: "700", fontSize: 16 }}>View Order History</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
