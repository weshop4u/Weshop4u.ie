import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, TextInput, Alert } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function CartScreen() {
  const { storeId } = useLocalSearchParams<{ storeId: string }>();
  const router = useRouter();
  const [cart, setCart] = useState<Record<number, number>>({});
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [allowSubstitution, setAllowSubstitution] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "cash_on_delivery">("cash_on_delivery");
  
  const storeIdNum = parseInt(storeId);
  const { data: store } = trpc.stores.getById.useQuery({ id: storeIdNum });
  const { data: products } = trpc.stores.getProducts.useQuery({ storeId: storeIdNum });
  
  // Mock delivery coordinates (Balbriggan area)
  const deliveryLat = 53.6100;
  const deliveryLon = -6.1830;
  
  const { data: deliveryFeeData } = trpc.orders.calculateDeliveryFee.useQuery(
    {
      storeId: storeIdNum,
      deliveryLatitude: deliveryLat,
      deliveryLongitude: deliveryLon,
    },
    { enabled: !!store }
  );

  useEffect(() => {
    loadCart();
  }, [storeId]);

  const loadCart = async () => {
    const savedCart = await AsyncStorage.getItem(`cart_${storeId}`);
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
  };

  const updateQuantity = async (productId: number, delta: number) => {
    const newQty = (cart[productId] || 0) + delta;
    if (newQty <= 0) {
      const { [productId]: removed, ...rest } = cart;
      setCart(rest);
      await AsyncStorage.setItem(`cart_${storeId}`, JSON.stringify(rest));
    } else {
      const newCart = { ...cart, [productId]: newQty };
      setCart(newCart);
      await AsyncStorage.setItem(`cart_${storeId}`, JSON.stringify(newCart));
    }
  };

  const cartItems = products?.filter(p => cart[p.id] > 0) || [];
  const subtotal = cartItems.reduce((sum, p) => sum + parseFloat(p.price) * cart[p.id], 0);
  const serviceFee = subtotal * 0.10;
  const deliveryFee = deliveryFeeData?.deliveryFee || 0;
  const total = subtotal + serviceFee + deliveryFee;

  const handleCheckout = () => {
    if (!deliveryAddress.trim()) {
      Alert.alert("Error", "Please enter a delivery address");
      return;
    }
    
    Alert.alert(
      "Order Placed!",
      `Your order from ${store?.name} has been placed.\n\nTotal: €${total.toFixed(2)}\nDelivery Fee: €${deliveryFee.toFixed(2)} (${deliveryFeeData?.distance.toFixed(2)} km)`,
      [
        {
          text: "OK",
          onPress: async () => {
            await AsyncStorage.removeItem(`cart_${storeId}`);
            router.push("/");
          },
        },
      ]
    );
  };

  if (cartItems.length === 0) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Text className="text-2xl mb-4">🛒</Text>
        <Text className="text-foreground text-lg mb-2">Your cart is empty</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="bg-primary px-6 py-3 rounded-lg mt-4 active:opacity-70"
        >
          <Text className="text-background font-semibold">Continue Shopping</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        {/* Header */}
        <View className="px-4 py-4">
          <TouchableOpacity onPress={() => router.back()} className="mb-4 active:opacity-70">
            <Text className="text-primary text-2xl">‹ Back</Text>
          </TouchableOpacity>
          <Text className="text-3xl font-bold text-foreground">Your Cart</Text>
          <Text className="text-muted">{store?.name}</Text>
        </View>

        {/* Cart Items */}
        <View className="px-4 mb-6">
          {cartItems.map((product) => (
            <View key={product.id} className="bg-surface rounded-xl p-4 mb-3 border border-border">
              <View className="flex-row justify-between items-start mb-2">
                <Text className="text-lg font-semibold text-foreground flex-1">
                  {product.name}
                </Text>
                <Text className="text-lg font-bold text-primary">
                  €{(parseFloat(product.price) * cart[product.id]).toFixed(2)}
                </Text>
              </View>
              
              <View className="flex-row justify-between items-center">
                <Text className="text-sm text-muted">€{parseFloat(product.price).toFixed(2)} each</Text>
                
                <View className="flex-row items-center gap-3">
                  <TouchableOpacity
                    onPress={() => updateQuantity(product.id, -1)}
                    className="bg-border w-8 h-8 rounded-lg items-center justify-center active:opacity-70"
                  >
                    <Text className="text-foreground font-bold">−</Text>
                  </TouchableOpacity>
                  
                  <Text className="text-foreground font-semibold w-8 text-center">
                    {cart[product.id]}
                  </Text>
                  
                  <TouchableOpacity
                    onPress={() => updateQuantity(product.id, 1)}
                    className="bg-primary w-8 h-8 rounded-lg items-center justify-center active:opacity-70"
                  >
                    <Text className="text-background font-bold">+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Delivery Address */}
        <View className="px-4 mb-6">
          <Text className="text-lg font-bold text-foreground mb-2">Delivery Address</Text>
          <TextInput
            value={deliveryAddress}
            onChangeText={setDeliveryAddress}
            placeholder="Enter your delivery address"
            placeholderTextColor="#9BA1A6"
            className="bg-surface text-foreground px-4 py-3 rounded-xl border border-border"
            multiline
          />
        </View>

        {/* Order Summary */}
        <View className="px-4 mb-6">
          <Text className="text-lg font-bold text-foreground mb-3">Order Summary</Text>
          <View className="bg-surface rounded-xl p-4 border border-border gap-2">
            <View className="flex-row justify-between">
              <Text className="text-foreground">Subtotal</Text>
              <Text className="text-foreground">€{subtotal.toFixed(2)}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-foreground">Service Fee (10%)</Text>
              <Text className="text-foreground">€{serviceFee.toFixed(2)}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-foreground">
                Delivery Fee {deliveryFeeData && `(${deliveryFeeData.distance.toFixed(2)} km)`}
              </Text>
              <Text className="text-foreground">€{deliveryFee.toFixed(2)}</Text>
            </View>
            <View className="h-px bg-border my-2" />
            <View className="flex-row justify-between">
              <Text className="text-xl font-bold text-foreground">Total</Text>
              <Text className="text-xl font-bold text-primary">€{total.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Payment Method */}
        <View className="px-4 mb-6">
          <Text className="text-lg font-bold text-foreground mb-2">Payment Method</Text>
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => setPaymentMethod("cash_on_delivery")}
              className={`flex-1 py-3 rounded-xl border-2 items-center ${
                paymentMethod === "cash_on_delivery" ? "border-primary bg-primary/10" : "border-border bg-surface"
              }`}
            >
              <Text className={`font-semibold ${paymentMethod === "cash_on_delivery" ? "text-primary" : "text-foreground"}`}>
                Cash
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => setPaymentMethod("card")}
              className={`flex-1 py-3 rounded-xl border-2 items-center ${
                paymentMethod === "card" ? "border-primary bg-primary/10" : "border-border bg-surface"
              }`}
            >
              <Text className={`font-semibold ${paymentMethod === "card" ? "text-primary" : "text-foreground"}`}>
                Card
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Place Order Button */}
        <View className="px-4">
          <TouchableOpacity
            onPress={handleCheckout}
            className="bg-secondary py-4 rounded-xl items-center active:opacity-70"
            style={{ shadowColor: "#FF00FF", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }}
          >
            <Text className="text-background text-lg font-bold">Place Order - €{total.toFixed(2)}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
