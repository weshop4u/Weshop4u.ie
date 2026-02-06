import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
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
  const [deliveryFeeCalculated, setDeliveryFeeCalculated] = useState(false);
  
  const storeIdNum = parseInt(storeId);
  const { data: store } = trpc.stores.getById.useQuery({ id: storeIdNum });
  const { data: products } = trpc.stores.getProducts.useQuery({ storeId: storeIdNum });
  
  const calculateDeliveryFeeMutation = trpc.delivery.calculateFee.useMutation();

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

  const handleCalculateDeliveryFee = async () => {
    if (!deliveryAddress.trim()) {
      Alert.alert("Error", "Please enter your Eircode or full address");
      return;
    }

    try {
      await calculateDeliveryFeeMutation.mutateAsync({
        storeId: storeIdNum,
        customerAddress: deliveryAddress,
      });
      setDeliveryFeeCalculated(true);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Could not calculate delivery fee. Please check your address.");
    }
  };

  const cartItems = products?.filter(p => cart[p.id] > 0) || [];
  const subtotal = cartItems.reduce((sum, p) => sum + parseFloat(p.price) * cart[p.id], 0);
  const serviceFee = subtotal * 0.10;
  const deliveryFee = calculateDeliveryFeeMutation.data?.deliveryFee || 0;
  const distance = calculateDeliveryFeeMutation.data?.distance || 0;
  const total = subtotal + serviceFee + deliveryFee;

  const handleCheckout = () => {
    if (!deliveryAddress.trim()) {
      Alert.alert("Error", "Please enter a delivery address");
      return;
    }

    if (!deliveryFeeCalculated) {
      Alert.alert("Error", "Please calculate delivery fee first");
      return;
    }
    
    Alert.alert(
      "Order Placed!",
      `Your order from ${store?.name} has been placed.\n\nTotal: €${total.toFixed(2)}\nDelivery Fee: €${deliveryFee.toFixed(2)} (${distance.toFixed(2)} km)\nPayment: ${paymentMethod === "card" ? "Card" : "Cash on Delivery"}`,
      [
        {
          text: "OK",
          onPress: async () => {
            await AsyncStorage.removeItem(`cart_${storeId}`);
            setDeliveryFeeCalculated(false);
            calculateDeliveryFeeMutation.reset();
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
    <ScreenContainer>
      <ScrollView className="flex-1 p-4">
        {/* Header */}
        <View className="mb-6">
          <Text className="text-2xl font-bold text-foreground mb-2">Your Cart</Text>
          <Text className="text-muted">{store?.name}</Text>
        </View>

        {/* Cart Items */}
        <View className="mb-6">
          {cartItems.map((product) => (
            <View key={product.id} className="flex-row justify-between items-center mb-4 pb-4 border-b border-border">
              <View className="flex-1">
                <Text className="text-foreground font-semibold">{product.name}</Text>
                <Text className="text-muted text-sm">€{parseFloat(product.price).toFixed(2)}</Text>
              </View>
              <View className="flex-row items-center gap-3">
                <TouchableOpacity
                  onPress={() => updateQuantity(product.id, -1)}
                  className="w-8 h-8 bg-surface rounded-full items-center justify-center active:opacity-70"
                >
                  <Text className="text-foreground font-bold">−</Text>
                </TouchableOpacity>
                <Text className="text-foreground font-semibold w-8 text-center">{cart[product.id]}</Text>
                <TouchableOpacity
                  onPress={() => updateQuantity(product.id, 1)}
                  className="w-8 h-8 bg-primary rounded-full items-center justify-center active:opacity-70"
                >
                  <Text className="text-background font-bold">+</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* Delivery Address */}
        <View className="mb-6">
          <Text className="text-foreground font-semibold mb-2">Delivery Address</Text>
          <TextInput
            className="bg-surface text-foreground p-4 rounded-lg border border-border"
            placeholder="Enter your Eircode or full address"
            placeholderTextColor="#9BA1A6"
            value={deliveryAddress}
            onChangeText={(text) => {
              setDeliveryAddress(text);
              setDeliveryFeeCalculated(false);
              calculateDeliveryFeeMutation.reset();
            }}
            multiline
            numberOfLines={2}
          />
          
          {/* Calculate Delivery Fee Button */}
          <TouchableOpacity
            onPress={handleCalculateDeliveryFee}
            disabled={calculateDeliveryFeeMutation.isPending || !deliveryAddress.trim()}
            className={`mt-3 p-4 rounded-lg items-center ${
              calculateDeliveryFeeMutation.isPending || !deliveryAddress.trim()
                ? "bg-surface"
                : "bg-secondary active:opacity-70"
            }`}
          >
            {calculateDeliveryFeeMutation.isPending ? (
              <ActivityIndicator color="#00E5FF" />
            ) : (
              <Text className="text-background font-semibold">
                {deliveryFeeCalculated ? "✓ Delivery Fee Calculated" : "Calculate Delivery Fee"}
              </Text>
            )}
          </TouchableOpacity>

          {deliveryFeeCalculated && calculateDeliveryFeeMutation.data && (
            <View className="mt-3 p-4 bg-surface rounded-lg">
              <Text className="text-muted text-sm">Distance: {distance.toFixed(2)} km</Text>
              <Text className="text-muted text-sm">Delivery Fee: €{deliveryFee.toFixed(2)}</Text>
            </View>
          )}
        </View>

        {/* Customer Notes */}
        <View className="mb-6">
          <Text className="text-foreground font-semibold mb-2">Order Notes (Optional)</Text>
          <TextInput
            className="bg-surface text-foreground p-4 rounded-lg border border-border"
            placeholder="Special instructions for your order..."
            placeholderTextColor="#9BA1A6"
            value={customerNotes}
            onChangeText={setCustomerNotes}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Allow Substitution */}
        <TouchableOpacity
          onPress={() => setAllowSubstitution(!allowSubstitution)}
          className="flex-row items-center mb-6 active:opacity-70"
        >
          <View className={`w-6 h-6 rounded border-2 mr-3 items-center justify-center ${
            allowSubstitution ? "bg-primary border-primary" : "border-border"
          }`}>
            {allowSubstitution && <Text className="text-background font-bold">✓</Text>}
          </View>
          <Text className="text-foreground flex-1">
            If item is out of stock, get something similar
          </Text>
        </TouchableOpacity>

        {/* Payment Method */}
        <View className="mb-6">
          <Text className="text-foreground font-semibold mb-3">Payment Method</Text>
          
          <TouchableOpacity
            onPress={() => setPaymentMethod("cash_on_delivery")}
            className="flex-row items-center mb-3 active:opacity-70"
          >
            <View className={`w-6 h-6 rounded-full border-2 mr-3 items-center justify-center ${
              paymentMethod === "cash_on_delivery" ? "border-primary" : "border-border"
            }`}>
              {paymentMethod === "cash_on_delivery" && (
                <View className="w-3 h-3 rounded-full bg-primary" />
              )}
            </View>
            <Text className="text-foreground">Cash on Delivery</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setPaymentMethod("card")}
            className="flex-row items-center active:opacity-70"
          >
            <View className={`w-6 h-6 rounded-full border-2 mr-3 items-center justify-center ${
              paymentMethod === "card" ? "border-primary" : "border-border"
            }`}>
              {paymentMethod === "card" && (
                <View className="w-3 h-3 rounded-full bg-primary" />
              )}
            </View>
            <Text className="text-foreground">Card Payment (Elavon)</Text>
          </TouchableOpacity>
        </View>

        {/* Order Summary */}
        <View className="bg-surface p-4 rounded-lg mb-6">
          <Text className="text-foreground font-bold text-lg mb-3">Order Summary</Text>
          
          <View className="flex-row justify-between mb-2">
            <Text className="text-muted">Subtotal</Text>
            <Text className="text-foreground">€{subtotal.toFixed(2)}</Text>
          </View>
          
          <View className="flex-row justify-between mb-2">
            <Text className="text-muted">Service Fee (10%)</Text>
            <Text className="text-foreground">€{serviceFee.toFixed(2)}</Text>
          </View>
          
          <View className="flex-row justify-between mb-3 pb-3 border-b border-border">
            <Text className="text-muted">Delivery Fee</Text>
            <Text className="text-foreground">
              {deliveryFeeCalculated ? `€${deliveryFee.toFixed(2)}` : "Calculate above"}
            </Text>
          </View>
          
          <View className="flex-row justify-between">
            <Text className="text-foreground font-bold text-lg">Total</Text>
            <Text className="text-primary font-bold text-lg">€{total.toFixed(2)}</Text>
          </View>
        </View>

        {/* Checkout Button */}
        <TouchableOpacity
          onPress={handleCheckout}
          disabled={!deliveryFeeCalculated}
          className={`p-4 rounded-lg items-center mb-8 ${
            deliveryFeeCalculated ? "bg-primary active:opacity-70" : "bg-surface"
          }`}
        >
          <Text className={`font-bold text-lg ${
            deliveryFeeCalculated ? "text-background" : "text-muted"
          }`}>
            Place Order
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
