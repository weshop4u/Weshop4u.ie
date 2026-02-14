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
  const { data: user } = trpc.auth.me.useQuery();
  const isGuest = !user;
  
  // Guest user fields
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  
  const [streetAddress, setStreetAddress] = useState("");
  const [eircode, setEircode] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  
  // Fetch user's saved addresses
  const { data: savedAddresses } = trpc.addresses.getAddresses.useQuery(
    undefined,
    { enabled: !!user?.id }
  );
  
  // Fetch user's most recent order to auto-fill address as fallback
  const { data: recentOrders } = trpc.orders.getByCustomer.useQuery(
    { customerId: user?.id || 0 },
    { enabled: !!user?.id }
  );
  
  // Auto-fill from default saved address, then fall back to most recent order
  useEffect(() => {
    if (streetAddress) return; // Don't overwrite if user already entered something
    
    // Priority 1: Default saved address
    if (savedAddresses && savedAddresses.length > 0) {
      const defaultAddr = savedAddresses.find(a => a.isDefault) || savedAddresses[0];
      setStreetAddress(defaultAddr.streetAddress);
      setEircode(defaultAddr.eircode);
      setSelectedAddressId(defaultAddr.id);
      return;
    }
    
    // Priority 2: Most recent order address
    if (recentOrders && recentOrders.length > 0) {
      const lastOrder = recentOrders[0];
      if (lastOrder.deliveryAddress) {
        const parts = lastOrder.deliveryAddress.split(',');
        if (parts.length >= 2) {
          setStreetAddress(parts[0].trim());
        }
      }
    }
  }, [savedAddresses, recentOrders, streetAddress]);
  
  // Handle saved address selection
  const handleSelectSavedAddress = (addressId: number) => {
    const addr = savedAddresses?.find(a => a.id === addressId);
    if (addr) {
      setStreetAddress(addr.streetAddress);
      setEircode(addr.eircode);
      setSelectedAddressId(addr.id);
      setDeliveryFeeCalculated(false);
      calculateDeliveryFeeMutation.reset();
    }
  };
  const [customerNotes, setCustomerNotes] = useState("");
  const [allowSubstitution, setAllowSubstitution] = useState(false);
  // Guests must use card, logged-in users can choose
  const [paymentMethod, setPaymentMethod] = useState<"card" | "cash_on_delivery">("cash_on_delivery");
  const [deliveryFeeCalculated, setDeliveryFeeCalculated] = useState(false);
  const [tipAmount, setTipAmount] = useState(0);
  const [customTip, setCustomTip] = useState("");
  const [showCustomTip, setShowCustomTip] = useState(false);
  
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
  
  // Force guests to use card payment
  useEffect(() => {
    if (isGuest) {
      setPaymentMethod("card");
    }
  }, [isGuest]);

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
  const tipValue = showCustomTip ? (parseFloat(customTip) || 0) : tipAmount;
  const total = subtotal + serviceFee + deliveryFee + (paymentMethod === "card" ? tipValue : 0);

  const handleCheckout = async () => {
    console.log("[Checkout] Starting checkout process...");
    // Validate guest fields
    if (isGuest) {
      if (!guestName.trim()) {
        Alert.alert("Error", "Please enter your name");
        return;
      }
      if (!guestPhone.trim()) {
        Alert.alert("Error", "Please enter your phone number");
        return;
      }
      if (!guestEmail.trim() || !guestEmail.includes("@")) {
        Alert.alert("Error", "Please enter a valid email address");
        return;
      }
    }
    
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

      console.log("[Checkout] Order items prepared:", orderItems);
      console.log("[Checkout] Calling createOrderMutation with:", {
        customerId: user?.id || null,
        storeId: storeIdNum,
        itemCount: orderItems.length,
        deliveryAddress: `${streetAddress}, ${eircode}, Ireland`,
        paymentMethod,
        isGuest
      });

      // Create order with guest info if not logged in
      const result = await createOrderMutation.mutateAsync({
        customerId: user?.id || null, // null for guest orders
        storeId: storeIdNum,
        items: orderItems,
        deliveryAddress: `${streetAddress}, ${eircode}, Ireland`,
        deliveryLatitude,
        deliveryLongitude,
        paymentMethod,
        tipAmount: paymentMethod === "card" ? tipValue : 0,
        customerNotes: customerNotes.trim() || undefined,
        allowSubstitution,
        // Guest order fields
        guestName: isGuest ? guestName.trim() : undefined,
        guestPhone: isGuest ? guestPhone.trim() : undefined,
        guestEmail: isGuest ? guestEmail.trim() : undefined,
      });

      // Clear cart
      clearCart();
      setDeliveryFeeCalculated(false);
      calculateDeliveryFeeMutation.reset();

      // Navigate to order confirmation screen
      router.push(`/order-confirmation/${result.orderId}`);
    } catch (error: any) {
      console.error("[Checkout] Error placing order:", error);
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
      {/* Header with Back Button */}
      <View className="flex-row items-center px-4 py-4 border-b border-border">
        <TouchableOpacity
          onPress={() => router.back()}
          className="active:opacity-70 mr-4"
        >
          <Text className="text-primary text-2xl">‹ Back</Text>
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-xl font-bold text-foreground">Your Cart</Text>
          <Text className="text-muted text-sm">{store?.name}</Text>
        </View>
      </View>

      <ScrollView className="flex-1 p-4">

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

        {/* Continue Shopping Button */}
        <TouchableOpacity
          onPress={() => router.back()}
          className="mb-6 py-3 border-2 border-primary rounded-xl active:opacity-70"
        >
          <Text className="text-primary text-center font-semibold text-base">
            ← Continue Shopping
          </Text>
        </TouchableOpacity>

        {/* Guest Information (only shown for non-logged-in users) */}
        {isGuest && (
          <View className="mb-6">
            <Text className="text-foreground font-semibold mb-3">Your Information</Text>
            <Text className="text-muted text-sm mb-3">We need your details to complete the order</Text>
            
            <TextInput
              className="bg-surface text-foreground p-4 rounded-lg border border-border mb-3"
              placeholder="Full Name"
              placeholderTextColor="#9BA1A6"
              value={guestName}
              onChangeText={setGuestName}
            />
            
            <TextInput
              className="bg-surface text-foreground p-4 rounded-lg border border-border mb-3"
              placeholder="Phone Number"
              placeholderTextColor="#9BA1A6"
              value={guestPhone}
              onChangeText={setGuestPhone}
              keyboardType="phone-pad"
            />
            
            <TextInput
              className="bg-surface text-foreground p-4 rounded-lg border border-border"
              placeholder="Email Address"
              placeholderTextColor="#9BA1A6"
              value={guestEmail}
              onChangeText={setGuestEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        )}

        {/* Delivery Address */}
        <View className="mb-6">
          <Text className="text-foreground font-semibold mb-2">Delivery Address</Text>
          
          {/* Saved Address Picker */}
          {!isGuest && savedAddresses && savedAddresses.length > 0 && (
            <View className="mb-3">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {savedAddresses.map((addr) => (
                  <TouchableOpacity
                    key={addr.id}
                    onPress={() => handleSelectSavedAddress(addr.id)}
                    className="active:opacity-70"
                    style={[{
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 12,
                      borderWidth: 2,
                      borderColor: selectedAddressId === addr.id ? '#0a7ea4' : '#E5E7EB',
                      backgroundColor: selectedAddressId === addr.id ? '#E6F7FC' : 'transparent',
                      minWidth: 120,
                    }]}
                  >
                    <Text style={{ fontWeight: '700', fontSize: 13, color: selectedAddressId === addr.id ? '#0a7ea4' : '#11181C', marginBottom: 2 }}>
                      {addr.label}{addr.isDefault ? ' ★' : ''}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#687076' }} numberOfLines={1}>
                      {addr.streetAddress}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#687076' }}>
                      {addr.eircode}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  onPress={() => {
                    setSelectedAddressId(null);
                    setStreetAddress("");
                    setEircode("");
                    setDeliveryFeeCalculated(false);
                    calculateDeliveryFeeMutation.reset();
                  }}
                  className="active:opacity-70"
                  style={[{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: selectedAddressId === null && !streetAddress ? '#0a7ea4' : '#E5E7EB',
                    backgroundColor: 'transparent',
                    minWidth: 100,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }]}
                >
                  <Text style={{ fontWeight: '600', fontSize: 13, color: '#0a7ea4' }}>+ New</Text>
                  <Text style={{ fontSize: 11, color: '#687076' }}>Address</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}
          
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
          
          {/* Show cash option only for logged-in users */}
          {!isGuest && (
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
          )}

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
          
          {/* Guest checkout notice */}
          {isGuest && (
            <View className="mt-3 p-3 bg-surface rounded-lg">
              <Text className="text-muted text-sm">
                💳 Card payment required for guest checkout. Create an account to unlock cash payment option.
              </Text>
            </View>
          )}
        </View>

        {/* Driver Tip - Card Payments Only */}
        {paymentMethod === "card" && (
          <View className="mb-6">
            <Text className="text-foreground font-semibold mb-2">Tip Your Driver (Optional)</Text>
            <Text className="text-muted text-sm mb-3">100% of tips go directly to your driver</Text>
            <View className="flex-row flex-wrap gap-2 mb-2">
              {[0, 1, 2, 3, 5].map((amount) => (
                <TouchableOpacity
                  key={amount}
                  onPress={() => { setTipAmount(amount); setShowCustomTip(false); setCustomTip(""); }}
                  className="active:opacity-70"
                  style={[{
                    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
                    borderWidth: 2,
                    borderColor: !showCustomTip && tipAmount === amount ? '#0a7ea4' : '#E5E7EB',
                    backgroundColor: !showCustomTip && tipAmount === amount ? '#E6F7FC' : 'transparent',
                  }]}
                >
                  <Text style={{ color: !showCustomTip && tipAmount === amount ? '#0a7ea4' : '#687076', fontWeight: '600' }}>
                    {amount === 0 ? 'No Tip' : `€${amount}`}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                onPress={() => { setShowCustomTip(true); setTipAmount(0); }}
                className="active:opacity-70"
                style={[{
                  paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
                  borderWidth: 2,
                  borderColor: showCustomTip ? '#0a7ea4' : '#E5E7EB',
                  backgroundColor: showCustomTip ? '#E6F7FC' : 'transparent',
                }]}
              >
                <Text style={{ color: showCustomTip ? '#0a7ea4' : '#687076', fontWeight: '600' }}>Custom</Text>
              </TouchableOpacity>
            </View>
            {showCustomTip && (
              <TextInput
                className="bg-surface text-foreground p-4 rounded-lg border border-border mt-2"
                placeholder="Enter tip amount (€)"
                placeholderTextColor="#9BA1A6"
                value={customTip}
                onChangeText={setCustomTip}
                keyboardType="decimal-pad"
                returnKeyType="done"
              />
            )}
          </View>
        )}

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
          
          <View className="flex-row justify-between mb-2">
            <Text className="text-muted">Delivery Fee</Text>
            <Text className="text-foreground">
              {deliveryFeeCalculated ? `€${deliveryFee.toFixed(2)}` : "Calculate above"}
            </Text>
          </View>
          
          {paymentMethod === "card" && tipValue > 0 && (
            <View className="flex-row justify-between mb-2">
              <Text className="text-muted">Driver Tip</Text>
              <Text style={{ color: '#0a7ea4', fontWeight: '600' }}>€{tipValue.toFixed(2)}</Text>
            </View>
          )}
          
          <View className="mb-3 pb-3 border-b border-border" />
          
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
