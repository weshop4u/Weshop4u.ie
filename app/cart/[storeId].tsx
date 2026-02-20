import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Modal, Platform, Image } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { useCart } from "@/lib/cart-provider";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";

const GUEST_CASH_LIMIT = 30; // €30 cash limit for guest orders

export default function CartScreen() {
  const { storeId } = useLocalSearchParams<{ storeId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { cart: cartContext, updateQuantity: updateCartQuantity, clearCart } = useCart();
  const { user: authUser, loading: authLoading } = useAuth();
  const { data: meData } = trpc.auth.me.useQuery();
  const user = authUser || meData;
  const isGuest = !user;
  
  // Guest checkout choice state
  const [showGuestChoice, setShowGuestChoice] = useState(false);
  const [guestChoiceMade, setGuestChoiceMade] = useState(false);
  
  // Delivery fee warning modal
  const [showDeliveryFeeWarning, setShowDeliveryFeeWarning] = useState(false);
  const [deliveryFeeWarningAcknowledged, setDeliveryFeeWarningAcknowledged] = useState(false);
  
  // Error banner state
  const [errorMessage, setErrorMessage] = useState("");
  
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
    if (streetAddress) return;
    
    if (savedAddresses && savedAddresses.length > 0) {
      const defaultAddr = savedAddresses.find((a: any) => a.isDefault) || savedAddresses[0];
      setStreetAddress(defaultAddr.streetAddress);
      setEircode(defaultAddr.eircode);
      setSelectedAddressId(defaultAddr.id);
      return;
    }
    
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
  
  // Show guest choice modal when guest user arrives at checkout
  useEffect(() => {
    if (!authLoading && isGuest && !guestChoiceMade) {
      setShowGuestChoice(true);
    }
  }, [authLoading, isGuest, guestChoiceMade]);
  
  // Handle saved address selection
  const handleSelectSavedAddress = (addressId: number) => {
    const addr = savedAddresses?.find((a: any) => a.id === addressId);
    if (addr) {
      setStreetAddress(addr.streetAddress);
      setEircode(addr.eircode);
      setSelectedAddressId(addr.id);
      setDeliveryFeeCalculated(false);
      setDeliveryFeeWarningAcknowledged(false);
      calculateDeliveryFeeMutation.reset();
    }
  };
  const [customerNotes, setCustomerNotes] = useState("");
  const [allowSubstitution, setAllowSubstitution] = useState(false);
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

  useEffect(() => {
    if (cartContext.storeId !== null && cartContext.storeId !== storeIdNum) {
      router.back();
    }
  }, [cartContext.storeId, storeIdNum]);

  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  const updateQuantity = (productId: number, delta: number) => {
    const currentItem = cartContext.items.find(i => i.productId === productId);
    if (!currentItem) return;
    const newQty = currentItem.quantity + delta;
    updateCartQuantity(productId, newQty);
  };

  const handleCalculateDeliveryFee = async () => {
    if (!streetAddress.trim() || !eircode.trim()) {
      setErrorMessage("Please enter both your street address and Eircode");
      return;
    }

    try {
      const fullAddress = `${streetAddress}, ${eircode}, Ireland`;
      const result = await calculateDeliveryFeeMutation.mutateAsync({
        storeId: storeIdNum,
        customerAddress: fullAddress,
      });
      setDeliveryFeeCalculated(true);
      setErrorMessage("");
      
      // Show delivery fee warning if fee is €10 or more
      if (result.deliveryFee >= 10 && !deliveryFeeWarningAcknowledged) {
        setShowDeliveryFeeWarning(true);
      }
    } catch (error: any) {
      setErrorMessage(error.message || "Could not calculate delivery fee. Please check your address and Eircode.");
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
  
  // Check if guest cash limit is exceeded
  const guestCashLimitExceeded = isGuest && paymentMethod === "cash_on_delivery" && total > GUEST_CASH_LIMIT;

  const handleCheckout = async () => {
    console.log("[Checkout] Starting checkout process...");
    if (isGuest) {
      if (!guestName.trim()) {
        setErrorMessage("Please enter your name");
        return;
      }
      if (!guestPhone.trim()) {
        setErrorMessage("Please enter your phone number");
        return;
      }
      // Check guest cash limit
      if (paymentMethod === "cash_on_delivery" && total > GUEST_CASH_LIMIT) {
        setErrorMessage(`Guest cash orders are limited to €${GUEST_CASH_LIMIT}. Please reduce your cart or switch to card payment.`);
        return;
      }
    }
    
    if (!streetAddress.trim() || !eircode.trim()) {
      setErrorMessage("Please enter both your street address and Eircode");
      return;
    }

    if (!deliveryFeeCalculated) {
      setErrorMessage("Please calculate delivery fee first");
      return;
    }
    
    // Check delivery fee warning
    if (deliveryFee >= 10 && !deliveryFeeWarningAcknowledged) {
      setShowDeliveryFeeWarning(true);
      return;
    }

    try {
      const orderItems = cartItems.map(product => ({
        productId: product!.id,
        quantity: product!.cartQuantity,
      }));

      const result = await createOrderMutation.mutateAsync({
        customerId: user?.id || null,
        storeId: storeIdNum,
        items: orderItems,
        deliveryAddress: `${streetAddress}, ${eircode}, Ireland`,
        deliveryLatitude,
        deliveryLongitude,
        paymentMethod,
        tipAmount: paymentMethod === "card" ? tipValue : 0,
        customerNotes: customerNotes.trim() || undefined,
        allowSubstitution,
        guestName: isGuest ? guestName.trim() : undefined,
        guestPhone: isGuest ? guestPhone.trim() : undefined,
        guestEmail: isGuest ? guestEmail.trim() || undefined : undefined,
      });

      clearCart();
      setDeliveryFeeCalculated(false);
      calculateDeliveryFeeMutation.reset();
      setErrorMessage("");
      router.push(`/order-confirmation/${result.orderId}`);
    } catch (error: any) {
      console.error("[Checkout] Error placing order:", error);
      setErrorMessage(error.message || "Failed to place order. Please try again.");
    }
  };

  if (cartItems.length === 0) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Image
          source={require("@/assets/images/Weshop4ulogo.jpg")}
          style={{ width: 80, height: 80, borderRadius: 40, marginBottom: 16 }}
          resizeMode="cover"
        />
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
      {/* Guest Checkout Choice Modal */}
      <Modal
        visible={showGuestChoice}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setGuestChoiceMade(true);
          setShowGuestChoice(false);
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: colors.background, borderRadius: 20, padding: 28, width: '100%', maxWidth: 380, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 }}>
            {/* Header */}
            <Text style={{ fontSize: 24, fontWeight: '800', color: colors.foreground, textAlign: 'center', marginBottom: 8 }}>
              Ready to Order?
            </Text>
            <Text style={{ fontSize: 14, color: colors.muted, textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
              Choose how you'd like to continue
            </Text>

            {/* Continue as Guest */}
            <TouchableOpacity
              onPress={() => {
                setGuestChoiceMade(true);
                setShowGuestChoice(false);
              }}
              style={{
                backgroundColor: colors.primary,
                borderRadius: 14,
                padding: 18,
                marginBottom: 12,
                alignItems: 'center',
              }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 }}>
                Continue as Guest
              </Text>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
                Quick order — no account needed
              </Text>
            </TouchableOpacity>

            {/* Guest info */}
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <Text style={{ fontSize: 12, color: colors.muted, lineHeight: 18 }}>
                As a guest you can pay by cash (up to €{GUEST_CASH_LIMIT}) or card. Just provide your name, phone number, and delivery address.
              </Text>
            </View>

            {/* Divider */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              <Text style={{ marginHorizontal: 12, color: colors.muted, fontSize: 13 }}>or</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            </View>

            {/* Log In */}
            <TouchableOpacity
              onPress={() => {
                setShowGuestChoice(false);
                router.push("/auth/login");
              }}
              style={{
                borderWidth: 2,
                borderColor: colors.primary,
                borderRadius: 14,
                padding: 18,
                marginBottom: 12,
                alignItems: 'center',
              }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.primary, marginBottom: 4 }}>
                Log In
              </Text>
              <Text style={{ fontSize: 12, color: colors.muted }}>
                Access saved addresses & order history
              </Text>
            </TouchableOpacity>

            {/* Create Account */}
            <TouchableOpacity
              onPress={() => {
                setShowGuestChoice(false);
                router.push("/auth/register");
              }}
              style={{
                borderWidth: 2,
                borderColor: colors.border,
                borderRadius: 14,
                padding: 18,
                alignItems: 'center',
              }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.foreground, marginBottom: 4 }}>
                Create Account
              </Text>
              <Text style={{ fontSize: 12, color: colors.muted }}>
                Higher limits, faster checkout, order tracking
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delivery Fee Warning Modal */}
      <Modal
        visible={showDeliveryFeeWarning}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeliveryFeeWarning(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: colors.background, borderRadius: 20, padding: 28, width: '100%', maxWidth: 380, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 }}>
            {/* Warning Icon */}
            <Text style={{ fontSize: 48, textAlign: 'center', marginBottom: 16 }}>⚠️</Text>
            
            {/* Title */}
            <Text style={{ fontSize: 20, fontWeight: '800', color: colors.foreground, textAlign: 'center', marginBottom: 12 }}>
              Delivery Fee Notice
            </Text>
            
            {/* Message */}
            <Text style={{ fontSize: 15, color: colors.foreground, textAlign: 'center', marginBottom: 8, lineHeight: 22 }}>
              Delivery fee is over €10.
            </Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#F59E0B', textAlign: 'center', marginBottom: 8 }}>
              Your delivery fee is €{deliveryFee.toFixed(2)}
            </Text>
            <Text style={{ fontSize: 14, color: colors.muted, textAlign: 'center', marginBottom: 24, lineHeight: 20 }}>
              Delivery may take longer than usual due to the distance.
            </Text>
            
            {/* Distance info */}
            <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 20, flexDirection: 'row', justifyContent: 'center' }}>
              <Text style={{ fontSize: 13, color: colors.muted }}>
                Distance: {distance.toFixed(2)} km from store
              </Text>
            </View>
            
            {/* OK Button */}
            <TouchableOpacity
              onPress={() => {
                setDeliveryFeeWarningAcknowledged(true);
                setShowDeliveryFeeWarning(false);
              }}
              style={{
                backgroundColor: colors.primary,
                borderRadius: 14,
                padding: 16,
                alignItems: 'center',
                marginBottom: 8,
              }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#FFFFFF' }}>
                I Understand, Continue
              </Text>
            </TouchableOpacity>
            
            {/* Cancel */}
            <TouchableOpacity
              onPress={() => setShowDeliveryFeeWarning(false)}
              style={{ padding: 12, alignItems: 'center' }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 14, color: colors.muted }}>
                Go Back
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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

      {/* Error Banner */}
      {errorMessage ? (
        <View style={{ backgroundColor: colors.error + '15', borderColor: colors.error, borderWidth: 1, margin: 16, marginBottom: 0, padding: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: colors.error, flex: 1, fontSize: 14 }}>{errorMessage}</Text>
          <TouchableOpacity onPress={() => setErrorMessage("")} className="active:opacity-70">
            <Text style={{ color: colors.error, fontWeight: '700', fontSize: 16, paddingLeft: 8 }}>✕</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Guest Banner */}
      {isGuest && guestChoiceMade && (
        <View style={{ backgroundColor: '#00E5FF15', borderColor: '#00E5FF', borderWidth: 1, margin: 16, marginBottom: 0, padding: 12, borderRadius: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontWeight: '700', fontSize: 14, marginBottom: 2 }}>
                Ordering as Guest
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                Cash limit: €{GUEST_CASH_LIMIT} per order
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/auth/login")}
              style={{ backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 }}
              activeOpacity={0.8}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 12 }}>Log In</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

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

        {/* Guest Information */}
        {isGuest && (
          <View className="mb-6">
            <Text className="text-foreground font-semibold mb-3">Your Information</Text>
            <Text className="text-muted text-sm mb-3">We need your details to deliver your order</Text>
            
            <TextInput
              className="bg-surface text-foreground p-4 rounded-lg border border-border mb-3"
              placeholder="Full Name *"
              placeholderTextColor={colors.muted}
              value={guestName}
              onChangeText={setGuestName}
            />
            
            <TextInput
              className="bg-surface text-foreground p-4 rounded-lg border border-border mb-3"
              placeholder="Phone Number *"
              placeholderTextColor={colors.muted}
              value={guestPhone}
              onChangeText={setGuestPhone}
              keyboardType="phone-pad"
            />
            
            <TextInput
              className="bg-surface text-foreground p-4 rounded-lg border border-border"
              placeholder="Email Address (optional — for order updates)"
              placeholderTextColor={colors.muted}
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
                {savedAddresses.map((addr: any) => (
                  <TouchableOpacity
                    key={addr.id}
                    onPress={() => handleSelectSavedAddress(addr.id)}
                    className="active:opacity-70"
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 12,
                      borderWidth: 2,
                      borderColor: selectedAddressId === addr.id ? colors.primary : colors.border,
                      backgroundColor: selectedAddressId === addr.id ? colors.primary + '15' : 'transparent',
                      minWidth: 120,
                    }}
                  >
                    <Text style={{ fontWeight: '700', fontSize: 13, color: selectedAddressId === addr.id ? colors.primary : colors.foreground, marginBottom: 2 }}>
                      {addr.label}{addr.isDefault ? ' ★' : ''}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.muted }} numberOfLines={1}>
                      {addr.streetAddress}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.muted }}>
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
                    setDeliveryFeeWarningAcknowledged(false);
                    calculateDeliveryFeeMutation.reset();
                  }}
                  className="active:opacity-70"
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: selectedAddressId === null && !streetAddress ? colors.primary : colors.border,
                    backgroundColor: 'transparent',
                    minWidth: 100,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontWeight: '600', fontSize: 13, color: colors.primary }}>+ New</Text>
                  <Text style={{ fontSize: 11, color: colors.muted }}>Address</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}
          
          {/* Street Address */}
          <TextInput
            className="bg-surface text-foreground p-4 rounded-lg border border-border mb-3"
            placeholder="Street address (e.g., 123 Main Street, Balbriggan)"
            placeholderTextColor={colors.muted}
            value={streetAddress}
            onChangeText={(text) => {
              setStreetAddress(text);
              setDeliveryFeeCalculated(false);
              setDeliveryFeeWarningAcknowledged(false);
              calculateDeliveryFeeMutation.reset();
            }}
            multiline
            numberOfLines={2}
          />

          {/* Eircode */}
          <TextInput
            className="bg-surface text-foreground p-4 rounded-lg border border-border"
            placeholder="Eircode (e.g., K32 Y621)"
            placeholderTextColor={colors.muted}
            value={eircode}
            onChangeText={(text) => {
              setEircode(text.toUpperCase());
              setDeliveryFeeCalculated(false);
              setDeliveryFeeWarningAcknowledged(false);
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
                : "bg-primary active:opacity-70"
            }`}
          >
            {calculateDeliveryFeeMutation.isPending ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text className={`font-semibold ${
                calculateDeliveryFeeMutation.isPending || !streetAddress.trim() || !eircode.trim()
                  ? "text-muted"
                  : "text-background"
              }`}>
                {deliveryFeeCalculated ? "✓ Delivery Fee Calculated" : "Calculate Delivery Fee"}
              </Text>
            )}
          </TouchableOpacity>

          {deliveryFeeCalculated && calculateDeliveryFeeMutation.data && (
            <View className="mt-3 p-4 bg-surface rounded-lg">
              <Text className="text-muted text-sm">Distance: {distance.toFixed(2)} km</Text>
              <Text className="text-muted text-sm">Delivery Fee: €{deliveryFee.toFixed(2)}</Text>
              {deliveryFee >= 10 && (
                <Text style={{ color: '#F59E0B', fontSize: 12, fontWeight: '600', marginTop: 4 }}>
                  ⚠️ High delivery fee — long distance from store
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Customer Notes */}
        <View className="mb-6">
          <Text className="text-foreground font-semibold mb-2">Order Notes (Optional)</Text>
          <TextInput
            className="bg-surface text-foreground p-4 rounded-lg border border-border"
            placeholder="Special instructions for your order..."
            placeholderTextColor={colors.muted}
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
          
          {/* Cash on Delivery - available for all users */}
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
            <View style={{ flex: 1 }}>
              <Text className="text-foreground">Cash on Delivery</Text>
              {isGuest && (
                <Text style={{ fontSize: 12, color: guestCashLimitExceeded ? colors.error : colors.muted }}>
                  {guestCashLimitExceeded 
                    ? `Order exceeds €${GUEST_CASH_LIMIT} guest cash limit`
                    : `Guest limit: €${GUEST_CASH_LIMIT} per order`
                  }
                </Text>
              )}
            </View>
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
          
          {/* Guest cash limit warning */}
          {guestCashLimitExceeded && (
            <View style={{ marginTop: 12, padding: 14, backgroundColor: colors.error + '15', borderColor: colors.error, borderWidth: 1, borderRadius: 12 }}>
              <Text style={{ color: colors.error, fontWeight: '700', fontSize: 14, marginBottom: 6 }}>
                Cart total exceeds €{GUEST_CASH_LIMIT} guest cash limit
              </Text>
              <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18, marginBottom: 12 }}>
                Guest cash on delivery orders are limited to €{GUEST_CASH_LIMIT} for security. You can:
              </Text>
              <View style={{ gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setPaymentMethod("card")}
                  style={{ backgroundColor: colors.primary, padding: 12, borderRadius: 10, alignItems: 'center' }}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>Pay by Card Instead</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push("/auth/register")}
                  style={{ borderWidth: 2, borderColor: colors.primary, padding: 12, borderRadius: 10, alignItems: 'center' }}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>Create Account for Higher Limits</Text>
                </TouchableOpacity>
              </View>
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
                  style={{
                    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
                    borderWidth: 2,
                    borderColor: !showCustomTip && tipAmount === amount ? colors.primary : colors.border,
                    backgroundColor: !showCustomTip && tipAmount === amount ? colors.primary + '15' : 'transparent',
                  }}
                >
                  <Text style={{ color: !showCustomTip && tipAmount === amount ? colors.primary : colors.muted, fontWeight: '600' }}>
                    {amount === 0 ? 'No Tip' : `€${amount}`}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                onPress={() => { setShowCustomTip(true); setTipAmount(0); }}
                className="active:opacity-70"
                style={{
                  paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
                  borderWidth: 2,
                  borderColor: showCustomTip ? colors.primary : colors.border,
                  backgroundColor: showCustomTip ? colors.primary + '15' : 'transparent',
                }}
              >
                <Text style={{ color: showCustomTip ? colors.primary : colors.muted, fontWeight: '600' }}>Custom</Text>
              </TouchableOpacity>
            </View>
            {showCustomTip && (
              <TextInput
                className="bg-surface text-foreground p-4 rounded-lg border border-border mt-2"
                placeholder="Enter tip amount (€)"
                placeholderTextColor={colors.muted}
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
            <Text className={deliveryFee >= 10 ? "" : "text-foreground"} style={deliveryFee >= 10 ? { color: '#F59E0B', fontWeight: '600' } : undefined}>
              {deliveryFeeCalculated ? `€${deliveryFee.toFixed(2)}` : "Calculate above"}
            </Text>
          </View>
          
          {paymentMethod === "card" && tipValue > 0 && (
            <View className="flex-row justify-between mb-2">
              <Text className="text-muted">Driver Tip</Text>
              <Text style={{ color: colors.primary, fontWeight: '600' }}>€{tipValue.toFixed(2)}</Text>
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
          disabled={!deliveryFeeCalculated || createOrderMutation.isPending || guestCashLimitExceeded}
          style={{ marginBottom: Math.max(insets.bottom, 16) + 16 }}
          className={`p-4 rounded-lg items-center ${
            deliveryFeeCalculated && !createOrderMutation.isPending && !guestCashLimitExceeded ? "bg-primary active:opacity-70" : "bg-surface"
          }`}
        >
          {createOrderMutation.isPending ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text className={`font-bold text-lg ${
              deliveryFeeCalculated && !guestCashLimitExceeded ? "text-background" : "text-muted"
            }`}>
              Place Order
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
