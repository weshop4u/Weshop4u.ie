import { View, Text, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { useCart } from "@/lib/cart-provider";

export default function CartScreen() {
  const { storeId } = useLocalSearchParams<{ storeId: string }>();
  const router = useRouter();
  const { cart: cartContext, updateQuantity: updateCartQuantity, clearCart } = useCart();
  const [streetAddress, setStreetAddress] = useState("");
  const [eircode, setEircode] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [allowSubstitution, setAllowSubstitution] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "cash_on_delivery">("cash_on_delivery");
  const [deliveryFeeCalculated, setDeliveryFeeCalculated] = useState(false);
  
  const storeIdNum = parseInt(storeId);
  const { data: store } = trpc.stores.getById.useQuery({ id: storeIdNum });
  const { data: products } = trpc.stores.getProducts.useQuery({ storeId: storeIdNum });
  
  const calculateDeliveryFeeMutation = trpc.delivery.calculateFee.useMutation();
  const createOrderMutation = trpc.orders.create.useMutation();

  // Check if cart is for this store
  useEffect(() => {
    if (cartContext.storeId !== null && cartContext.storeId !== storeIdNum) {
      // Wrong store, go back
      router.back();
    }
  }, [cartContext.storeId, storeIdNum]);

  const updateQuantity = (productId: number, delta: number) => {
    const currentItem = cartContext.items.find(i => i.productId === productId);
    if (!currentItem) return;
    
    const newQty = currentItem.quantity + delta;
    updateCartQuantity(productId, newQty);
  };

  const handleCalculateDeliveryFee = async () => {
    if (!streetAddress.trim() || !eircode.trim()) {
      Alert.alert("Error", "Please enter both your street address and Eircode");
      return;
    }

    try {
      // Combine street address and Eircode for geocoding
      const fullAddress = `${streetAddress}, ${eircode}, Ireland`;
      await calculateDeliveryFeeMutation.mutateAsync({
        storeId: storeIdNum,
        customerAddress: fullAddress,
      });
      setDeliveryFeeCalculated(true);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Could not calculate delivery fee. Please check your address and Eircode.");
    }
  };

  const cartItems = cartContext.items.map(item => {
    const product = products?.find(p => p.id === item.productId);
    return product ? { ...product, cartQuantity: item.quantity } : null;
  }).filter(Boolean) || [];
  const subtotal = cartItems.reduce((sum, p) => sum + (p ? parseFloat(p.price) * p.cartQuantity : 0), 0);
  const serviceFee = subtotal * 0.10;
  const deliveryFee = calculateDeliveryFeeMutation.data?.deliveryFee || 0;
  const distance = calculateDeliveryFeeMutation.data?.distance || 0;
  const deliveryLatitude = calculateDeliveryFeeMutation.data?.deliveryLatitude || 0;
  const deliveryLongitude = calculateDeliveryFeeMutation.data?.deliveryLongitude || 0;
  const total = subtotal + serviceFee + deliveryFee;

  const handleCheckout = async () => {
    if (!streetAddress.trim() || !eircode.trim()) {
      Alert.alert("Error", "Please enter both your street address and Eircode");
      return;
    }

    if (!deliveryFeeCalculated) {
      Alert.alert("Error", "Please calculate delivery fee first");
      return;
    }

    try {
      // Prepare order items
      const orderItems = cartItems.map(product => ({
        productId: product!.id,
        quantity: product!.cartQuantity,
      }));

      // Create order (using temporary customer ID 1 until auth is implemented)
      const result = await createOrderMutation.mutateAsync({
        customerId: 1, // TODO: Replace with actual authenticated user ID
        storeId: storeIdNum,
        items: orderItems,
        deliveryAddress: `${streetAddress}, ${eircode}, Ireland`,
        deliveryLatitude,
        deliveryLongitude,
        paymentMethod,
        customerNotes: customerNotes.trim() || undefined,
        allowSubstitution,
      });

      // Clear cart
      clearCart();
      setDeliveryFeeCalculated(false);
      calculateDeliveryFeeMutation.reset();

      // Navigate to order confirmation screen
      router.push(`/order-confirmation/${result.orderId}`);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to place order. Please try again.");
    }
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
          {cartItems.map((product) => product && (
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
                <Text className="text-foreground font-semibold w-8 text-center">{product.cartQuantity}</Text>
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
          
          {/* Street Address */}
          <TextInput
            className="bg-surface text-foreground p-4 rounded-lg border border-border mb-3"
            placeholder="Street address (e.g., 123 Main Street, Balbriggan)"
            placeholderTextColor="#9BA1A6"
            value={streetAddress}
            onChangeText={(text) => {
              setStreetAddress(text);
              setDeliveryFeeCalculated(false);
              calculateDeliveryFeeMutation.reset();
            }}
            multiline
            numberOfLines={2}
          />

          {/* Eircode */}
          <TextInput
            className="bg-surface text-foreground p-4 rounded-lg border border-border"
            placeholder="Eircode (e.g., K32 Y621)"
            placeholderTextColor="#9BA1A6"
            value={eircode}
            onChangeText={(text) => {
              setEircode(text.toUpperCase());
              setDeliveryFeeCalculated(false);
              calculateDeliveryFeeMutation.reset();
            }}
            autoCapitalize="characters"
            maxLength={10}
          />
          
          {/* Calculate Delivery Fee Button */}
          <TouchableOpacity
            onPress={handleCalculateDeliveryFee}
            disabled={calculateDeliveryFeeMutation.isPending || !streetAddress.trim() || !eircode.trim()}
            className={`mt-3 p-4 rounded-lg items-center ${
              calculateDeliveryFeeMutation.isPending || !streetAddress.trim() || !eircode.trim()
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
          disabled={!deliveryFeeCalculated || createOrderMutation.isPending}
          className={`p-4 rounded-lg items-center mb-8 ${
            deliveryFeeCalculated && !createOrderMutation.isPending ? "bg-primary active:opacity-70" : "bg-surface"
          }`}
        >
          {createOrderMutation.isPending ? (
            <ActivityIndicator color="#00E5FF" />
          ) : (
            <Text className={`font-bold text-lg ${
              deliveryFeeCalculated ? "text-background" : "text-muted"
            }`}>
              Place Order
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
