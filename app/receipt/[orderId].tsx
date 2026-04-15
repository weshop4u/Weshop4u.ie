import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Platform, Image } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useLocalSearchParams, useRouter } from "expo-router";
import { formatIrishDateFull, formatIrishDate } from "@/lib/timezone";
import { ScreenWrapper } from "@/components/native-wrapper";

function formatDate(dateStr: string | Date | null | undefined): string {
  return formatIrishDateFull(dateStr);
}

export default function ReceiptScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const orderIdNum = parseInt(orderId);
  const isWeb = Platform.OS === "web";


  const { data: order, isLoading } = trpc.orders.getById.useQuery({ orderId: orderIdNum });

  const handlePrint = () => {
    if (Platform.OS === "web") {
      window.print();
    }
  };

  if (isLoading) {
    return (
      <ScreenWrapper>
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color="#0a7ea4" />
        <Text className="text-muted mt-4">Loading receipt...</Text>
      </ScreenContainer>
      </ScreenWrapper>
    );
  }

  if (!order) {
    return (
      <ScreenWrapper>
      <ScreenContainer className="items-center justify-center p-4">
        <Text style={{ fontSize: 48, marginBottom: 12 }}>🧾</Text>
        <Text className="text-foreground text-lg mb-2">Receipt not found</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ backgroundColor: "#0a7ea4", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, marginTop: 16 }}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>Go Back</Text>
        </TouchableOpacity>
      </ScreenContainer>
      </ScreenWrapper>
    );
  }

  const subtotal = parseFloat(order.subtotal || "0");
  const serviceFee = parseFloat(order.serviceFee || "0");
  const deliveryFee = parseFloat(order.deliveryFee || "0");
  const tipAmount = parseFloat(order.tipAmount || "0");
  const total = parseFloat(order.total || "0");

  return (
    <ScreenWrapper>
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header with back button */}
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
            <Text style={{ color: "#0a7ea4", fontSize: 16, fontWeight: "600" }}>← Back</Text>
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: 18, fontWeight: "700", color: "#11181C", textAlign: "center" }}>Receipt</Text>
          {order.coIndicator && (
            <View style={{ backgroundColor: "#F59E0B", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, marginRight: 8 }}>
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>{order.coIndicator}</Text>
            </View>
          )}
          <TouchableOpacity onPress={handlePrint} style={{ marginLeft: 12 }}>
            <Text style={{ color: "#0a7ea4", fontSize: 14, fontWeight: "600" }}>🖨 Print</Text>
          </TouchableOpacity>
        </View>

        {/* Receipt Card */}
        <View style={{ margin: 16, backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#E5E7EB", overflow: "hidden" }}>
          {/* Store Logo & Name */}
          <View style={{ backgroundColor: "#0a7ea4", paddingVertical: 24, alignItems: "center" }}>
            <Image
              source={require("@/assets/images/Weshop4ulogo.jpg")}
              style={{ width: 72, height: 72, borderRadius: 36, marginBottom: 8 }}
              resizeMode="cover"
            />
            <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800", letterSpacing: 1 }}>WESHOP4U</Text>
            <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, marginTop: 4 }}>24/7 Delivery Platform</Text>
          </View>

          {/* Order Info */}
          <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ color: "#687076", fontSize: 13 }}>Order Number</Text>
              <Text style={{ color: "#11181C", fontSize: 13, fontWeight: "700" }}>{order.orderNumber}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ color: "#687076", fontSize: 13 }}>Date</Text>
              <Text style={{ color: "#11181C", fontSize: 13 }}>{formatDate(order.createdAt)}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ color: "#687076", fontSize: 13 }}>Store</Text>
              <Text style={{ color: "#11181C", fontSize: 13, fontWeight: "600" }}>{order.store?.name || "Store"}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ color: "#687076", fontSize: 13 }}>Payment</Text>
              <Text style={{ color: "#11181C", fontSize: 13 }}>
                {order.paymentMethod === "card" ? "💳 Card" : "💵 Cash on Delivery"}
              </Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: "#687076", fontSize: 13 }}>Status</Text>
              <Text style={{
                color: order.status === "delivered" ? "#22C55E" : order.status === "cancelled" ? "#EF4444" : "#F59E0B",
                fontSize: 13,
                fontWeight: "700",
              }}>
                {order.status === "delivered" ? "✅ Delivered" : order.status === "cancelled" ? "✕ Cancelled" : order.status.replace(/_/g, " ").toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Delivery Address */}
          <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" }}>
            <Text style={{ color: "#687076", fontSize: 11, fontWeight: "600", letterSpacing: 1, marginBottom: 6 }}>DELIVERED TO</Text>
            <Text style={{ color: "#11181C", fontSize: 14, lineHeight: 20 }}>{order.deliveryAddress}</Text>
            {order.deliveredAt && (
              <Text style={{ color: "#687076", fontSize: 12, marginTop: 4 }}>
                Delivered at {formatDate(order.deliveredAt)}
              </Text>
            )}
          </View>

          {/* Items */}
          <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" }}>
            <Text style={{ color: "#687076", fontSize: 11, fontWeight: "600", letterSpacing: 1, marginBottom: 12 }}>ORDER ITEMS</Text>
            {order.items?.map((item: any, idx: number) => {
              const mods = item.modifiers || [];
              const grouped: Record<string, { name: string; price: string; count: number }[]> = {};
              for (const m of mods) {
                const gn = m.groupName || "Options";
                if (!grouped[gn]) grouped[gn] = [];
                const cleanName = m.modifierName.replace(/ \u00d7\d+$/, '');
                const existing = grouped[gn].find((d: any) => d.name === cleanName && d.price === m.modifierPrice);
                if (existing) { existing.count++; } else { grouped[gn].push({ name: cleanName, price: m.modifierPrice, count: 1 }); }
              }
              return (
                <View
                  key={item.id || idx}
                  style={{
                    paddingVertical: 8,
                    borderBottomWidth: idx < (order.items?.length || 0) - 1 ? 1 : 0,
                    borderBottomColor: "#f5f5f5",
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={{ color: "#11181C", fontSize: 14, fontWeight: "500" }}>
                        {item.quantity}x {item.productName || item.product?.name || "Item"}
                      </Text>
                      {item.notes && (
                        <Text style={{ color: "#687076", fontSize: 12, fontStyle: "italic", marginTop: 2 }}>{item.notes}</Text>
                      )}
                    </View>
                    <Text style={{ color: "#11181C", fontSize: 14, fontWeight: "600" }}>
                      €{parseFloat(item.subtotal || "0").toFixed(2)}
                    </Text>
                  </View>
                  {mods.length > 0 && (
                    <View style={{ marginLeft: 8, marginTop: 4 }}>
                      {Object.entries(grouped).map(([groupName, options]) => (
                        <View key={groupName} style={{ marginBottom: 2 }}>
                          <Text style={{ fontSize: 11, fontWeight: "600", color: "#687076" }}>{groupName}:</Text>
                          {options.map((opt: any, oi: number) => {
                            const extraPrice = parseFloat(opt.price) * opt.count;
                            return (
                              <Text key={oi} style={{ fontSize: 12, color: "#11181C", marginLeft: 8, lineHeight: 18 }}>
                                • {opt.name}{opt.count > 1 ? ` ×${opt.count}` : ""}{extraPrice > 0 ? ` +€${extraPrice.toFixed(2)}` : ""}
                              </Text>
                            );
                          })}
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* Price Breakdown */}
          <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ color: "#687076", fontSize: 14 }}>Subtotal</Text>
              <Text style={{ color: "#11181C", fontSize: 14 }}>€{subtotal.toFixed(2)}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ color: "#687076", fontSize: 14 }}>Service Fee</Text>
              <Text style={{ color: "#11181C", fontSize: 14 }}>€{serviceFee.toFixed(2)}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ color: "#687076", fontSize: 14 }}>Delivery Fee</Text>
              <Text style={{ color: "#11181C", fontSize: 14 }}>€{deliveryFee.toFixed(2)}</Text>
            </View>
            {tipAmount > 0 && (
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                <Text style={{ color: "#0a7ea4", fontSize: 14 }}>Driver Tip</Text>
                <Text style={{ color: "#0a7ea4", fontSize: 14 }}>€{tipAmount.toFixed(2)}</Text>
              </View>
            )}

            {/* Divider */}
            <View style={{ height: 1, backgroundColor: "#E5E7EB", marginVertical: 8 }} />

            {/* Total */}
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: "#11181C", fontSize: 18, fontWeight: "800" }}>Total</Text>
              <Text style={{ color: "#11181C", fontSize: 18, fontWeight: "800" }}>€{total.toFixed(2)}</Text>
            </View>
          </View>

          {/* Footer */}
          <View style={{ padding: 20, alignItems: "center" }}>
            <Text style={{ color: "#687076", fontSize: 12, textAlign: "center", lineHeight: 18 }}>
              Thank you for ordering with WESHOP4U!
            </Text>
            <Text style={{ color: "#9BA1A6", fontSize: 11, marginTop: 8 }}>
              Receipt generated on {formatIrishDate(new Date())}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={{ paddingHorizontal: 16, gap: 12, marginBottom: 20 }}>
          <TouchableOpacity
            onPress={handlePrint}
            style={{
              backgroundColor: "#0a7ea4",
              padding: 16,
              borderRadius: 12,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>🖨 Print / Save as PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              backgroundColor: "#fff",
              padding: 16,
              borderRadius: 12,
              alignItems: "center",
              borderWidth: 1,
              borderColor: "#E5E7EB",
            }}
          >
            <Text style={{ color: "#0a7ea4", fontWeight: "700", fontSize: 16 }}>← Back to Order</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
    </ScreenWrapper>
  );
}
