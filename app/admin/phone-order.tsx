import { Text, View, TouchableOpacity, TextInput, ScrollView, FlatList, ActivityIndicator, Platform, Modal, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { getApiBaseUrl } from "@/constants/oauth";
import { useColors } from "@/hooks/use-colors";

import { AdminDesktopLayout } from "@/components/admin-desktop-layout";

type CartItem = {
  productId: number;
  name: string;
  price: number;
  quantity: number;
  ageRestricted?: boolean;
};

type FeeInfo = {
  distance: number;
  deliveryFee: number;
  serviceFee: number;
  total: number;
  deliveryLatitude: number;
  deliveryLongitude: number;
  formattedAddress: string;
} | null;

const getProductImage = (product: any): string | null => {
  if (product.images && product.images.length > 0) return product.images[0];
  if (product.image) return product.image;
  if (product.imageUrl) return product.imageUrl;
  return null;
};

function PhoneOrderScreenContent() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useColors();

  // Step tracking
  const [step, setStep] = useState<"store" | "products" | "details" | "confirm">("store");

  // Store selection
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [selectedStoreName, setSelectedStoreName] = useState("");

  // Product search, categories, and cart
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);

  // Customer details
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryEircode, setDeliveryEircode] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "cash_on_delivery">("cash_on_delivery");
  const [allowSubstitution, setAllowSubstitution] = useState(false);
  const [customerDob, setCustomerDob] = useState("");

  // Fee calculation
  const [feeInfo, setFeeInfo] = useState<FeeInfo>(null);
  const [feeLoading, setFeeLoading] = useState(false);
  const [feeError, setFeeError] = useState("");

  // Customer lookup
  const [lookupDone, setLookupDone] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupMessage, setLookupMessage] = useState("");
  const [lookupPhone, setLookupPhone] = useState("");
  const phoneDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // tRPC query for customer lookup (enabled when lookupPhone is set)
  const { data: lookupData, isFetching: lookupFetching } = trpc.admin.lookupCustomerByPhone.useQuery(
    { phone: lookupPhone },
    { enabled: lookupPhone.length >= 7 }
  );

  // Process lookup results
  useEffect(() => {
    if (!lookupPhone || lookupPhone.length < 7) return;
    if (lookupFetching) {
      setLookupLoading(true);
      return;
    }
    setLookupLoading(false);
    if (lookupData) {
      if (lookupData.found) {
        if (lookupData.name) setCustomerName(lookupData.name);
        if (lookupData.address) setDeliveryAddress(lookupData.address);
        if (lookupData.eircode) setDeliveryEircode(lookupData.eircode);
        setLookupMessage(`\u2705 Found: ${lookupData.name || "Customer"} — details auto-filled`);
        setLookupDone(true);
      } else {
        setLookupMessage("No previous orders found for this number");
        setLookupDone(true);
      }
    }
  }, [lookupData, lookupFetching, lookupPhone]);

  // Submitting
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [orderResult, setOrderResult] = useState<{ orderId: number; orderNumber: string; total: number; distance: number; serviceFee: number; deliveryFee: number; subtotal: number; paymentMethod: string } | null>(null);
  const [submitError, setSubmitError] = useState("");

  // Queries
  const { data: storesList, isLoading: storesLoading } = trpc.admin.getStores.useQuery();
  // Debounce search query for API calls
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const categoryFlatListRef = useRef<FlatList>(null);
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [searchQuery]);

  useEffect(() => {
    if (selectedCategoryId !== null) {
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          // Scroll every possible container to top
          document.documentElement.scrollTop = 0;
          document.body.scrollTop = 0;
          const all = document.querySelectorAll('*');
          all.forEach(el => {
            if ((el as HTMLElement).scrollTop > 0) {
              (el as HTMLElement).scrollTop = 0;
            }
          });
        }
        categoryFlatListRef.current?.scrollToOffset({ offset: 0, animated: false });
      }, 50);
    }
  }, [selectedCategoryId]);

  const { data: productsData, isLoading: productsLoading } = trpc.stores.getProducts.useQuery(
    { storeId: selectedStoreId!, limit: 5000 },
    { enabled: selectedStoreId !== null && step === "products" }
  );
  const productsList = productsData?.items || [];

  // Client-side search filtering (since stores.getProducts doesn't support search param)
  const filteredProductsList = useMemo(() => {
    if (!debouncedSearch.trim()) return productsList;
    const query = debouncedSearch.toLowerCase();
    return productsList.filter(p => p.name.toLowerCase().includes(query));
  }, [productsList, debouncedSearch]);

  const createPhoneOrderMutation = trpc.admin.createPhoneOrder.useMutation();
  const calculateFeesMutation = trpc.admin.calculatePhoneOrderFees.useMutation();

  // Cart calculations
  const cartSubtotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
  const cartItemCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  // Check if cart has age-restricted items
  const hasAgeRestrictedItems = useMemo(() => cart.some(item => item.ageRestricted), [cart]);

  // Group products by category for browsing
  const categoriesWithProducts = useMemo(() => {
    if (productsList.length === 0) return [];
    const catMap: Record<number, { id: number; name: string; icon: string | null; ageRestricted: boolean; products: typeof productsList }> = {};
    for (const product of productsList) {
      const catId = (product as any).categoryId || 0;
      const catName = (product as any).category?.name || "Uncategorized";
      const catIcon = (product as any).category?.icon || null;
      const catAgeRestricted = (product as any).category?.ageRestricted || false;
      if (!catMap[catId]) {
        catMap[catId] = { id: catId, name: catName, icon: catIcon, ageRestricted: catAgeRestricted, products: [] };
      }
      catMap[catId].products.push(product);
    }
    return Object.values(catMap).sort((a, b) => a.name.localeCompare(b.name));
  }, [productsList]);

  // Filtered products for selected category
  const categoryProducts = useMemo(() => {
    if (selectedCategoryId === null) return [];
    const cat = categoriesWithProducts.find(c => c.id === selectedCategoryId);
    if (!cat) return [];
    if (!debouncedSearch.trim()) return cat.products;
    const query = debouncedSearch.toLowerCase();
    return cat.products.filter(p => p.name.toLowerCase().includes(query));
  }, [categoriesWithProducts, selectedCategoryId, debouncedSearch]);

  const addToCart = (product: { id: number; name: string; price: string }, ageRestricted?: boolean) => {
    const existing = cart.find(c => c.productId === product.id);
    if (existing) {
      setCart(cart.map(c => c.productId === product.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { productId: product.id, name: product.name, price: parseFloat(product.price), quantity: 1, ageRestricted }]);
    }
  };

  const removeFromCart = (productId: number) => {
    const existing = cart.find(c => c.productId === productId);
    if (existing && existing.quantity > 1) {
      setCart(cart.map(c => c.productId === productId ? { ...c, quantity: c.quantity - 1 } : c));
    } else {
      setCart(cart.filter(c => c.productId !== productId));
    }
  };

  // ===== CUSTOMER LOOKUP BY PHONE =====
  const handlePhoneChange = useCallback((text: string) => {
    setCustomerPhone(text);
    setLookupDone(false);
    setLookupMessage("");

    // Debounce: set lookupPhone after delay to trigger tRPC query
    if (phoneDebounceRef.current) clearTimeout(phoneDebounceRef.current);
    const cleaned = text.replace(/\s+/g, "");
    if (cleaned.length >= 7) {
      phoneDebounceRef.current = setTimeout(() => {
        setLookupPhone(cleaned);
      }, 800);
    } else {
      setLookupPhone("");
    }
  }, []);

  // ===== FEE CALCULATION =====
  const calculateFees = useCallback(async () => {
    if (!selectedStoreId || !deliveryEircode.trim() || cartSubtotal <= 0) return;

    setFeeLoading(true);
    setFeeError("");
    setFeeInfo(null);

    try {
      const result = await calculateFeesMutation.mutateAsync({
        storeId: selectedStoreId,
        eircode: deliveryEircode.trim(),
        subtotal: cartSubtotal,
      });
      setFeeInfo(result);
    } catch (e: any) {
      setFeeError(e.message || "Could not calculate fees");
    } finally {
      setFeeLoading(false);
    }
  }, [selectedStoreId, deliveryEircode, cartSubtotal]);

  // Auto-calculate fees when Eircode changes (debounced)
  const eircodeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleEircodeChange = useCallback((text: string) => {
    setDeliveryEircode(text);
    setFeeInfo(null);
    setFeeError("");

    if (eircodeDebounceRef.current) clearTimeout(eircodeDebounceRef.current);
    const cleaned = text.replace(/\s+/g, "");
    if (cleaned.length >= 5) {
      eircodeDebounceRef.current = setTimeout(() => {
        calculateFees();
      }, 1000);
    }
  }, [calculateFees]);

  // Recalculate when eircode debounce triggers (need latest values)
  useEffect(() => {
    // Cleanup debounce on unmount
    return () => {
      if (phoneDebounceRef.current) clearTimeout(phoneDebounceRef.current);
      if (eircodeDebounceRef.current) clearTimeout(eircodeDebounceRef.current);
    };
  }, []);

  // ===== ORDER SUBMISSION (no Alert.alert) =====
  const handleSubmit = useCallback(() => {
    if (!selectedStoreId || cart.length === 0 || !customerName.trim() || !customerPhone.trim() || !deliveryAddress.trim() || !deliveryEircode.trim()) {
      setSubmitError("Please fill in all required fields including Eircode.");
      return;
    }
    // Validate DOB if age-restricted items in cart
    if (hasAgeRestrictedItems && !customerDob.trim()) {
      setSubmitError("Date of birth is required for age-restricted items.");
      return;
    }
    setSubmitError("");
    setShowConfirmModal(true);
  }, [selectedStoreId, cart, customerName, customerPhone, deliveryAddress, deliveryEircode, hasAgeRestrictedItems, customerDob]);

  const confirmAndCreate = useCallback(async () => {
    setShowConfirmModal(false);
    setSubmitting(true);
    setSubmitError("");

    try {
      const lat = feeInfo?.deliveryLatitude ?? 53.6109;
      const lng = feeInfo?.deliveryLongitude ?? -6.1811;

      const data = await createPhoneOrderMutation.mutateAsync({
        storeId: selectedStoreId!,
        items: cart.map(c => ({ productId: c.productId, quantity: c.quantity })),
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        deliveryAddress: deliveryAddress.trim(),
        deliveryEircode: deliveryEircode.trim() || undefined,
        deliveryLatitude: lat,
        deliveryLongitude: lng,
        paymentMethod,
        customerNotes: customerNotes.trim() || undefined,
        allowSubstitution,
      });

      // For card payments, redirect to Elavon payment page
      if (paymentMethod === "card") {
        setOrderResult({
          orderId: data.orderId,
          orderNumber: data.orderNumber,
          total: data.total,
          distance: data.distance,
          serviceFee: data.serviceFee,
          deliveryFee: data.deliveryFee,
          subtotal: data.subtotal,
          paymentMethod: "card",
        });
        // Navigate to Elavon payment page
        router.push(`/payment/${data.orderId}`);
        return;
      }

      setOrderResult({
        orderId: data.orderId,
        orderNumber: data.orderNumber,
        total: data.total,
        distance: data.distance,
        serviceFee: data.serviceFee,
        deliveryFee: data.deliveryFee,
        subtotal: data.subtotal,
        paymentMethod: "cash_on_delivery",
      });
    } catch (e: any) {
      setSubmitting(false);
      setSubmitError(e.message || "Failed to create order");
    }
  }, [selectedStoreId, cart, customerName, customerPhone, deliveryAddress, deliveryEircode, paymentMethod, customerNotes, allowSubstitution, feeInfo]);

  // Step indicator
  const steps = [
    { key: "store", label: "Store" },
    { key: "products", label: "Items" },
    { key: "details", label: "Details" },
    { key: "confirm", label: "Confirm" },
  ];
  const currentStepIndex = steps.findIndex(s => s.key === step);

  // ===== ORDER SUCCESS SCREEN =====
  if (orderResult) {
    return (
      <ScreenContainer className="bg-background">
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingBottom: 40 + insets.bottom, alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>✅</Text>
          <Text style={{ fontSize: 24, fontWeight: "800", color: colors.foreground, marginBottom: 8, textAlign: "center" }}>Order Created!</Text>
          <Text style={{ fontSize: 16, color: colors.muted, marginBottom: 24, textAlign: "center" }}>
            {orderResult.orderNumber}
          </Text>

          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border, width: "100%", maxWidth: 400, marginBottom: 24 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ fontSize: 14, color: colors.muted }}>Subtotal</Text>
              <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>€{orderResult.subtotal.toFixed(2)}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ fontSize: 14, color: colors.muted }}>Service Fee (10%)</Text>
              <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>€{orderResult.serviceFee.toFixed(2)}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={{ fontSize: 14, color: colors.muted }}>Delivery Fee ({orderResult.distance.toFixed(1)} km)</Text>
              <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>€{orderResult.deliveryFee.toFixed(2)}</Text>
            </View>
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 8 }} />
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: colors.foreground }}>Total</Text>
              <Text style={{ fontSize: 16, fontWeight: "800", color: "#00E5FF" }}>€{orderResult.total.toFixed(2)}</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => router.back()}
            style={{ backgroundColor: "#00E5FF", paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#151718" }}>Done</Text>
          </TouchableOpacity>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // ===== CONFIRM MODAL (web-compatible, replaces Alert.alert) =====
  const ConfirmOverlay = showConfirmModal ? (
    <View style={{
      position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0,0,0,0.7)",
      justifyContent: "center", alignItems: "center",
      zIndex: 999,
      padding: 24,
    }}>
      <View style={{
        backgroundColor: "#1e2022",
        borderRadius: 16,
        padding: 24,
        width: "100%",
        maxWidth: 400,
        borderWidth: 1,
        borderColor: "#334155",
      }}>
        <Text style={{ fontSize: 20, fontWeight: "800", color: "#ECEDEE", marginBottom: 12 }}>Confirm Order</Text>
        <Text style={{ fontSize: 15, color: "#9BA1A6", marginBottom: 6 }}>
          Create order for {customerName}?
        </Text>
        <Text style={{ fontSize: 14, color: "#9BA1A6", marginBottom: 4 }}>
          {cartItemCount} items from {selectedStoreName}
        </Text>
        <Text style={{ fontSize: 14, color: "#9BA1A6", marginBottom: 4 }}>
          Subtotal: €{cartSubtotal.toFixed(2)}
        </Text>
        {feeInfo && (
          <>
            <Text style={{ fontSize: 14, color: "#9BA1A6", marginBottom: 4 }}>
              Service Fee: €{feeInfo.serviceFee.toFixed(2)}
            </Text>
            <Text style={{ fontSize: 14, color: "#9BA1A6", marginBottom: 4 }}>
              Delivery Fee: €{feeInfo.deliveryFee.toFixed(2)} ({feeInfo.distance.toFixed(1)} km)
            </Text>
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#00E5FF", marginBottom: 4 }}>
              Total: €{feeInfo.total.toFixed(2)}
            </Text>
          </>
        )}
        <Text style={{ fontSize: 14, color: "#9BA1A6", marginBottom: 16 }}>
          Payment: {paymentMethod === "cash_on_delivery" ? "Cash on Delivery" : "Card"}
        </Text>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity
            onPress={() => setShowConfirmModal(false)}
            style={{ flex: 1, backgroundColor: "#334155", padding: 14, borderRadius: 10, alignItems: "center" }}
          >
            <Text style={{ fontSize: 15, fontWeight: "600", color: "#ECEDEE" }}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={confirmAndCreate}
            style={{ flex: 2, backgroundColor: "#22C55E", padding: 14, borderRadius: 10, alignItems: "center" }}
          >
            <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>Create Order</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  ) : null;

  return (
    <ScreenContainer className="bg-background">
      {/* Step Indicator */}
      <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#334155", gap: 4 }}>
        {steps.map((s, i) => (
          <TouchableOpacity
            key={s.key}
            style={{ flex: 1, alignItems: "center" }}
            onPress={() => {
              // Only allow going back, or to steps already reached
              if (i < currentStepIndex) {
                setStep(s.key as typeof step);
              } else if (i === 1 && selectedStoreId !== null) {
                setStep("products");
              } else if (i === 2 && cart.length > 0) {
                setStep("details");
              } else if (i === 3 && cart.length > 0 && customerName.trim() && customerPhone.trim() && deliveryAddress.trim() && deliveryEircode.trim()) {
                setStep("confirm");
              }
            }}
          >
            <View style={{
              width: "100%", height: 3, borderRadius: 2,
              backgroundColor: i <= currentStepIndex ? "#00E5FF" : "#334155",
              marginBottom: 4,
            }} />
            <Text style={{ fontSize: 11, fontWeight: i === currentStepIndex ? "700" : "400", color: i <= currentStepIndex ? "#00E5FF" : "#687076" }}>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* STEP 1: Store Selection */}
      {step === "store" && (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 20 + insets.bottom }}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: "#ECEDEE", marginBottom: 4 }}>Select Store</Text>
          <Text style={{ fontSize: 14, color: "#687076", marginBottom: 16 }}>Which store is the customer ordering from?</Text>

          {storesLoading ? (
            <ActivityIndicator size="large" color="#00E5FF" style={{ marginTop: 40 }} />
          ) : (
            <View style={{ gap: 10 }}>
              {(storesList || []).map(store => (
                <TouchableOpacity
                  key={store.id}
                  onPress={() => {
                    setSelectedStoreId(store.id);
                    setSelectedStoreName(store.name);
                    setStep("products");
                  }}
                  style={{
                    backgroundColor: "#1e2022",
                    padding: 16,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: selectedStoreId === store.id ? "#00E5FF" : "#334155",
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: "700", color: "#ECEDEE" }}>{store.name}</Text>
                  <Text style={{ fontSize: 13, color: "#687076", marginTop: 2 }}>{store.address}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* STEP 2: Product Selection — with Category Browsing */}
      {step === "products" && (
        <View className="flex-1">
          {/* Search */}
          <View style={{ paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#334155" }}>
            <View style={{ backgroundColor: "#151718", borderRadius: 10, borderWidth: 1, borderColor: "#334155", paddingHorizontal: 12, paddingVertical: 10 }}>
              <TextInput
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  // If searching, show flat product list (no category filter)
                  if (text.trim().length > 0) {
                    setSelectedCategoryId(null);
                  }
                }}
                placeholder="Search products..."
                placeholderTextColor="#687076"
                style={{ fontSize: 15, color: "#ECEDEE" }}
                returnKeyType="search"
              />
            </View>
          </View>

          {/* Category List OR Product List */}
          {productsLoading ? (
            <ActivityIndicator size="large" color="#00E5FF" style={{ marginTop: 40 }} />
          ) : searchQuery.trim().length > 0 ? (
            // ── SEARCH RESULTS (flat product list) ──
            <FlatList
              data={filteredProductsList}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={{ padding: 12, paddingBottom: cart.length > 0 ? 100 : 20 }}
              renderItem={({ item }) => {
                const inCart = cart.find(c => c.productId === item.id);
                const catAgeRestricted = (item as any).category?.ageRestricted || false;
                return (
                  <View style={{
                    backgroundColor: "#fff",
                    padding: 12,
                    borderRadius: 10,
                    marginBottom: 6,
                    borderWidth: 1,
                    borderColor: inCart ? "#00E5FF" : "#E5E7EB",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={{ fontSize: 14, fontWeight: "600", color: "#11181C", flex: 1 }} numberOfLines={2}>{item.name}</Text>
                        {catAgeRestricted && (
                          <View style={{ backgroundColor: "#FEF2F2", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                            <Text style={{ fontSize: 9, fontWeight: "700", color: "#DC2626" }}>18+</Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: "#00E5FF", marginTop: 2 }}>€{parseFloat(item.price).toFixed(2)}</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      {inCart && (
                        <>
                          <TouchableOpacity
                            onPress={() => removeFromCart(item.id)}
                            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#E5E7EB", alignItems: "center", justifyContent: "center" }}
                          >
                            <Text style={{ fontSize: 18, fontWeight: "700", color: "#11181C" }}>−</Text>
                          </TouchableOpacity>
                          <Text style={{ fontSize: 16, fontWeight: "700", color: "#11181C", minWidth: 24, textAlign: "center" }}>{inCart.quantity}</Text>
                        </>
                      )}
                      <TouchableOpacity
                        onPress={() => addToCart(item, catAgeRestricted)}
                        style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#00E5FF", alignItems: "center", justifyContent: "center" }}
                      >
                        <Text style={{ fontSize: 18, fontWeight: "700", color: "#151718" }}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={{ alignItems: "center", paddingVertical: 40 }}>
                  <Text style={{ color: "#687076" }}>No products found</Text>
                </View>
              }
            />
          ) : selectedCategoryId === null ? (
            // ── CATEGORY LIST (with images and 18+ badges) ──
            <ScrollView className="flex-1" contentContainerStyle={{ padding: 12, paddingBottom: cart.length > 0 ? 100 : 20 }}>
              {categoriesWithProducts.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  onPress={() => setSelectedCategoryId(category.id)}
                  style={{
                    backgroundColor: "#fff",
                    padding: 14,
                    borderRadius: 12,
                    marginBottom: 8,
                    borderWidth: 1,
                    borderColor: "#E5E7EB",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  {/* Category Image */}
                  <View style={{ width: 56, height: 56, borderRadius: 10, overflow: "hidden", backgroundColor: "#f5f5f5" }}>
                    {category.icon ? (
                      <Image source={{ uri: category.icon }} style={{ width: 56, height: 56 }} contentFit="cover" />
                    ) : (
                      <View style={{ width: 56, height: 56, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontSize: 28 }}>📦</Text>
                      </View>
                    )}
                  </View>
                  {/* Category Info */}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={{ fontSize: 16, fontWeight: "600", color: "#11181C" }}>{category.name}</Text>
                      {category.ageRestricted && (
                        <View style={{ backgroundColor: "#FEF2F2", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                          <Text style={{ fontSize: 10, fontWeight: "700", color: "#DC2626" }}>18+</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ fontSize: 13, color: "#687076", marginTop: 2 }}>
                      {category.products.length} {category.products.length === 1 ? "item" : "items"}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 20, color: "#9BA1A6" }}>›</Text>
                </TouchableOpacity>
              ))}
              {categoriesWithProducts.length === 0 && (
                <View style={{ alignItems: "center", paddingVertical: 40 }}>
                  <Text style={{ color: "#687076" }}>No products available</Text>
                </View>
              )}
            </ScrollView>
          ) : (
            // ── PRODUCTS IN SELECTED CATEGORY ──
            <View style={{ flex: 1 }}>
              {/* Category Header with Back */}
              <TouchableOpacity
                onPress={() => setSelectedCategoryId(null)}
                style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, gap: 6 }}
              >
                <Text style={{ fontSize: 18, color: "#00E5FF" }}>‹</Text>
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#00E5FF" }}>Categories</Text>
              </TouchableOpacity>

              {cart.length > 0 && (
                <View>
                  <TouchableOpacity
                    onPress={() => setCartDrawerOpen(!cartDrawerOpen)}
                    style={{
                      backgroundColor: "#1e2022",
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      borderBottomWidth: 1,
                      borderBottomColor: "#334155",
                    }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: "700", color: "#ECEDEE" }}>{cartItemCount} items — €{cartSubtotal.toFixed(2)}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Text style={{ fontSize: 13, color: "#9BA1A6" }}>{cartDrawerOpen ? "▲ Hide" : "▼ View cart"}</Text>
                      <TouchableOpacity
                        onPress={() => setStep("details")}
                        style={{ backgroundColor: "#00E5FF", paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8 }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: "700", color: "#151718" }}>Next →</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                  {cartDrawerOpen && (
                    <View style={{ backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}>
                      {cart.map(item => (
                        <View key={item.productId} style={{
                          flexDirection: "row",
                          alignItems: "center",
                          paddingHorizontal: 16,
                          paddingVertical: 10,
                          borderBottomWidth: 1,
                          borderBottomColor: "#E5E7EB",
                        }}>
                          <Text style={{ flex: 1, fontSize: 14, color: "#11181C" }} numberOfLines={1}>{item.name}</Text>
                          <Text style={{ fontSize: 14, fontWeight: "600", color: "#11181C", marginRight: 12 }}>€{(item.price * item.quantity).toFixed(2)}</Text>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <TouchableOpacity
                              onPress={() => removeFromCart(item.productId)}
                              style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#E5E7EB", alignItems: "center", justifyContent: "center" }}
                            >
                              <Text style={{ fontSize: 16, fontWeight: "700", color: "#11181C" }}>−</Text>
                            </TouchableOpacity>
                            <Text style={{ fontSize: 14, fontWeight: "700", color: "#11181C", minWidth: 20, textAlign: "center" }}>{item.quantity}</Text>
                            <TouchableOpacity
                              onPress={() => addToCart({ id: item.productId, name: item.name, price: String(item.price) }, item.ageRestricted)}
                              style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#00E5FF", alignItems: "center", justifyContent: "center" }}
                            >
                              <Text style={{ fontSize: 16, fontWeight: "700", color: "#151718" }}>+</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              <FlatList
                ref={categoryFlatListRef}
                data={categoryProducts}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={{ padding: 12, paddingBottom: cart.length > 0 ? 100 : 20 }}
                renderItem={({ item }) => {
                  const inCart = cart.find(c => c.productId === item.id);
                  const cat = categoriesWithProducts.find(c => c.id === selectedCategoryId);
                  const catAgeRestricted = cat?.ageRestricted || false;
                  const productImage = getProductImage(item);
                  return (
                    <View style={{
                      backgroundColor: "#fff",
                      padding: 12,
                      borderRadius: 10,
                      marginBottom: 6,
                      borderWidth: 1,
                      borderColor: inCart ? "#00E5FF" : "#E5E7EB",
                      flexDirection: "row",
                      alignItems: "center",
                    }}>
                      {productImage && (
                        <View style={{ width: 56, height: 56, borderRadius: 8, overflow: "hidden", marginRight: 10 }}>
                          <Image source={{ uri: productImage }} style={{ width: 56, height: 56 }} contentFit="cover" />
                        </View>
                      )}
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={{ fontSize: 14, fontWeight: "600", color: "#11181C" }} numberOfLines={2}>{item.name}</Text>
                        {catAgeRestricted && (
                          <View style={{ backgroundColor: "#FEF2F2", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, alignSelf: "flex-start", marginTop: 2 }}>
                            <Text style={{ fontSize: 9, fontWeight: "700", color: "#DC2626" }}>18+</Text>
                          </View>
                        )}
                        <Text style={{ fontSize: 14, fontWeight: "700", color: "#00E5FF", marginTop: 2 }}>€{parseFloat(item.price).toFixed(2)}</Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        {inCart && (
                          <>
                            <TouchableOpacity
                              onPress={() => removeFromCart(item.id)}
                              style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#E5E7EB", alignItems: "center", justifyContent: "center" }}
                            >
                              <Text style={{ fontSize: 18, fontWeight: "700", color: "#11181C" }}>−</Text>
                            </TouchableOpacity>
                            <Text style={{ fontSize: 16, fontWeight: "700", color: "#11181C", minWidth: 24, textAlign: "center" }}>{inCart.quantity}</Text>
                          </>
                        )}
                        <TouchableOpacity
                          onPress={() => addToCart(item, catAgeRestricted)}
                          style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#00E5FF", alignItems: "center", justifyContent: "center" }}
                        >
                          <Text style={{ fontSize: 18, fontWeight: "700", color: "#151718" }}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }}
                ListEmptyComponent={
                  <View style={{ alignItems: "center", paddingVertical: 40 }}>
                    <Text style={{ color: "#687076" }}>No products in this category</Text>
                  </View>
                }
              />
            </View>
          )}

          {/* Cart Summary Bar */}
          {cart.length > 0 && (
            <View style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: "#1e2022",
              borderTopWidth: 1,
              borderTopColor: "#334155",
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 12 + insets.bottom,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <View>
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#ECEDEE" }}>{cartItemCount} items</Text>
                <Text style={{ fontSize: 16, fontWeight: "800", color: "#00E5FF" }}>€{cartSubtotal.toFixed(2)}</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  onPress={() => { setStep("store"); setCart([]); setSelectedStoreId(null); setSelectedCategoryId(null); }}
                  style={{ backgroundColor: "#334155", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "600", color: "#ECEDEE" }}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setStep("details")}
                  style={{ backgroundColor: "#00E5FF", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#151718" }}>Next</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* STEP 3: Customer Details */}
      {step === "details" && (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 + insets.bottom }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 22, fontWeight: "800", color: "#ECEDEE", marginBottom: 4 }}>Customer Details</Text>
              <Text style={{ fontSize: 14, color: "#687076" }}>Enter the caller's delivery information</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                if (!customerName.trim() || !customerPhone.trim() || !deliveryAddress.trim() || !deliveryEircode.trim()) {
                  setSubmitError("Please fill in name, phone, address, and Eircode.");
                  return;
                }
                if (hasAgeRestrictedItems && !customerDob.trim()) {
                  setSubmitError("Date of birth is required for age-restricted items.");
                  return;
                }
                setSubmitError("");
                if (!feeInfo && deliveryEircode.trim().length >= 5) {
                  calculateFees();
                }
                setStep("confirm");
              }}
              style={{ backgroundColor: "#00E5FF", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, marginLeft: 12, marginTop: 2 }}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#151718" }}>Next</Text>
            </TouchableOpacity>
          </View>

          {/* Order Summary */}
          <View style={{ backgroundColor: "#f8f9fa", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#E5E7EB", marginBottom: 20 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#687076", marginBottom: 10 }}>ORDER SUMMARY ({cartItemCount} items)</Text>
{cart.map(item => (
                  <View key={item.productId} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#E5E7EB", gap: 8 }}>
                    <Text style={{ fontSize: 14, color: "#11181C", flex: 1 }} numberOfLines={1}>{item.name}</Text>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: "#11181C" }}>€{(item.price * item.quantity).toFixed(2)}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <TouchableOpacity
                        onPress={() => removeFromCart(item.productId)}
                        style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: "#E5E7EB", alignItems: "center", justifyContent: "center" }}
                      >
                        <Text style={{ fontSize: 15, fontWeight: "700", color: "#11181C" }}>−</Text>
                      </TouchableOpacity>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: "#11181C", minWidth: 18, textAlign: "center" }}>{item.quantity}</Text>
                      <TouchableOpacity
                        onPress={() => addToCart({ id: item.productId, name: item.name, price: String(item.price) }, item.ageRestricted)}
                        style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: "#00E5FF", alignItems: "center", justifyContent: "center" }}
                      >
                        <Text style={{ fontSize: 15, fontWeight: "700", color: "#151718" }}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: "#11181C" }}>Subtotal</Text>
              <Text style={{ fontSize: 15, fontWeight: "700", color: "#00E5FF" }}>€{cartSubtotal.toFixed(2)}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
              <Text style={{ fontSize: 14, color: "#687076" }}>Service fee (10%)</Text>
              <Text style={{ fontSize: 14, color: "#687076" }}>€{(cartSubtotal * 0.1).toFixed(2)}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: "#E5E7EB" }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: "#11181C" }}>Total before delivery</Text>
              <Text style={{ fontSize: 15, fontWeight: "700", color: "#00E5FF" }}>€{(cartSubtotal * 1.1).toFixed(2)}</Text>
            </View>
          </View>

          {/* Phone Number (FIRST - for auto-fill) */}
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#687076", marginBottom: 6 }}>PHONE NUMBER * (enter first to auto-fill)</Text>
          <View style={{ backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: lookupDone ? "#22C55E" : "#E5E7EB", paddingHorizontal: 12, paddingVertical: 10, marginBottom: 4 }}>
            <TextInput
              value={customerPhone}
              onChangeText={handlePhoneChange}
              placeholder="e.g. 089 123 4567"
              placeholderTextColor="#687076"
              style={{ fontSize: 15, color: "#11181C" }}
              keyboardType="phone-pad"
              returnKeyType="next"
            />
          </View>
          {lookupLoading && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <ActivityIndicator size="small" color="#00E5FF" />
              <Text style={{ fontSize: 12, color: "#687076" }}>Looking up customer...</Text>
            </View>
          )}
          {lookupMessage ? (
            <Text style={{ fontSize: 12, color: lookupMessage.startsWith("\u2705") ? "#22C55E" : "#687076", marginBottom: 12 }}>
              {lookupMessage}
            </Text>
          ) : <View style={{ height: 12 }} />}

          {/* Customer Name */}
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#687076", marginBottom: 6 }}>CUSTOMER NAME *</Text>
          <View style={{ backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB", paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16 }}>
            <TextInput
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="e.g. John Murphy"
              placeholderTextColor="#687076"
              style={{ fontSize: 15, color: "#11181C" }}
              returnKeyType="next"
            />
          </View>

          {/* Delivery Address */}
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#687076", marginBottom: 6 }}>DELIVERY ADDRESS *</Text>
          <View style={{ backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB", paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16 }}>
            <TextInput
              value={deliveryAddress}
              onChangeText={setDeliveryAddress}
              placeholder="e.g. 12 Main Street, Balbriggan"
              placeholderTextColor="#687076"
              style={{ fontSize: 15, color: "#11181C" }}
              multiline
              returnKeyType="next"
            />
          </View>

          {/* Eircode */}
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#687076", marginBottom: 6 }}>EIRCODE * (for delivery fee)</Text>
          <View style={{ backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: feeInfo ? "#22C55E" : "#E5E7EB", paddingHorizontal: 12, paddingVertical: 10, marginBottom: 4 }}>
            <TextInput
              value={deliveryEircode}
              onChangeText={handleEircodeChange}
              placeholder="e.g. K32 AB12"
              placeholderTextColor="#687076"
              style={{ fontSize: 15, color: "#11181C" }}
              autoCapitalize="characters"
              returnKeyType="next"
            />
          </View>
          {feeLoading && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <ActivityIndicator size="small" color="#00E5FF" />
              <Text style={{ fontSize: 12, color: "#687076" }}>Calculating delivery fee...</Text>
            </View>
          )}
          {feeError ? (
            <Text style={{ fontSize: 12, color: "#EF4444", marginBottom: 8 }}>{feeError}</Text>
          ) : null}
          {!feeLoading && !feeError && deliveryEircode.replace(/\s+/g, "").length >= 5 && !feeInfo && (
            <TouchableOpacity onPress={calculateFees} style={{ marginBottom: 8 }}>
              <Text style={{ fontSize: 13, color: "#00E5FF", fontWeight: "600" }}>Tap to calculate delivery fee</Text>
            </TouchableOpacity>
          )}
          <View style={{ height: 4 }} />

          {/* Fee Preview Box */}
          {feeInfo && (
            <View style={{
              backgroundColor: "#0a2a1f",
              borderRadius: 10,
              padding: 14,
              borderWidth: 1,
              borderColor: "#22C55E",
              marginBottom: 16,
            }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#22C55E", marginBottom: 8 }}>💰 COST BREAKDOWN (tell customer)</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={{ fontSize: 14, color: "#9BA1A6" }}>Items subtotal</Text>
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#ECEDEE" }}>€{cartSubtotal.toFixed(2)}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={{ fontSize: 14, color: "#9BA1A6" }}>Service fee (10%)</Text>
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#ECEDEE" }}>€{feeInfo.serviceFee.toFixed(2)}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={{ fontSize: 14, color: "#9BA1A6" }}>Delivery ({feeInfo.distance.toFixed(1)} km)</Text>
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#ECEDEE" }}>€{feeInfo.deliveryFee.toFixed(2)}</Text>
              </View>
              <View style={{ height: 1, backgroundColor: "#334155", marginVertical: 6 }} />
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 16, fontWeight: "800", color: "#ECEDEE" }}>Total</Text>
                <Text style={{ fontSize: 16, fontWeight: "800", color: "#22C55E" }}>€{feeInfo.total.toFixed(2)}</Text>
              </View>
            </View>
          )}

          {/* Customer Date of Birth — only shown when age-restricted items in cart */}
          {hasAgeRestrictedItems && (
            <>
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#687076", marginBottom: 6 }}>CUSTOMER DATE OF BIRTH (DD-MM-YYYY) *</Text>
              <View style={{ backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB", paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16 }}>
                <TextInput
                  value={customerDob}
                  onChangeText={setCustomerDob}
                  placeholder="e.g. 15-03-1990"
                  placeholderTextColor="#687076"
                  style={{ fontSize: 15, color: "#11181C" }}
                  returnKeyType="next"
                />
              </View>
            </>
          )}

          {/* Payment Method */}
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#687076", marginBottom: 6 }}>PAYMENT METHOD</Text>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
            <TouchableOpacity
              onPress={() => setPaymentMethod("cash_on_delivery")}
              style={{
                flex: 1,
                backgroundColor: paymentMethod === "cash_on_delivery" ? "#00E5FF" : "#fff",
                padding: 14,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: paymentMethod === "cash_on_delivery" ? "#00E5FF" : "#E5E7EB",
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: paymentMethod === "cash_on_delivery" ? "#151718" : "#11181C" }}>Cash</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setPaymentMethod("card")}
              style={{
                flex: 1,
                backgroundColor: paymentMethod === "card" ? "#00E5FF" : "#fff",
                padding: 14,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: paymentMethod === "card" ? "#00E5FF" : "#E5E7EB",
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: paymentMethod === "card" ? "#151718" : "#11181C" }}>Card</Text>
            </TouchableOpacity>
          </View>

          {/* Notes */}
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#687076", marginBottom: 6 }}>NOTES (Optional)</Text>
          <View style={{ backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB", paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16 }}>
            <TextInput
              value={customerNotes}
              onChangeText={setCustomerNotes}
              placeholder="e.g. Ring doorbell, leave at gate..."
              placeholderTextColor="#687076"
              style={{ fontSize: 15, color: "#11181C", minHeight: 60 }}
              multiline
            />
          </View>

          {/* Substitution */}
          <TouchableOpacity
            onPress={() => setAllowSubstitution(!allowSubstitution)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              backgroundColor: "#fff",
              padding: 14,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: allowSubstitution ? "#00E5FF" : "#E5E7EB",
              marginBottom: 24,
            }}
          >
            <View style={{
              width: 22, height: 22, borderRadius: 4,
              backgroundColor: allowSubstitution ? "#00E5FF" : "transparent",
              borderWidth: 2, borderColor: allowSubstitution ? "#00E5FF" : "#687076",
              alignItems: "center", justifyContent: "center",
            }}>
              {allowSubstitution && <Text style={{ fontSize: 14, fontWeight: "800", color: "#151718" }}>✓</Text>}
            </View>
            <Text style={{ fontSize: 14, color: "#11181C" }}>Customer allows substitutions</Text>
          </TouchableOpacity>

          {/* Navigation */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity
              onPress={() => setStep("products")}
              style={{ flex: 1, backgroundColor: "#E5E7EB", padding: 14, borderRadius: 10, alignItems: "center" }}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: "#11181C" }}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (!customerName.trim() || !customerPhone.trim() || !deliveryAddress.trim() || !deliveryEircode.trim()) {
                  setSubmitError("Please fill in name, phone, address, and Eircode.");
                  return;
                }
                if (hasAgeRestrictedItems && !customerDob.trim()) {
                  setSubmitError("Date of birth is required for age-restricted items.");
                  return;
                }
                setSubmitError("");
                // Calculate fees if not done yet
                if (!feeInfo && deliveryEircode.trim().length >= 5) {
                  calculateFees();
                }
                setStep("confirm");
              }}
              style={{ flex: 1, backgroundColor: "#00E5FF", padding: 14, borderRadius: 10, alignItems: "center" }}
            >
              <Text style={{ fontSize: 15, fontWeight: "700", color: "#151718" }}>Review Order</Text>
            </TouchableOpacity>
          </View>

          {submitError ? (
            <Text style={{ fontSize: 13, color: "#EF4444", marginTop: 10, textAlign: "center" }}>{submitError}</Text>
          ) : null}
        </ScrollView>
      )}

      {/* STEP 4: Confirmation */}
      {step === "confirm" && (
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 + insets.bottom }}>
          <Text style={{ fontSize: 22, fontWeight: "800", color: "#ECEDEE", marginBottom: 16 }}>Review Order</Text>

          {/* Store */}
          <View style={{ backgroundColor: "#1e2022", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#334155", marginBottom: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#687076", marginBottom: 4 }}>STORE</Text>
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#ECEDEE" }}>{selectedStoreName}</Text>
          </View>

          {/* Customer */}
          <View style={{ backgroundColor: "#1e2022", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#334155", marginBottom: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#687076", marginBottom: 4 }}>CUSTOMER</Text>
            <Text style={{ fontSize: 15, fontWeight: "600", color: "#ECEDEE" }}>{customerName}</Text>
            <Text style={{ fontSize: 14, color: "#9BA1A6" }}>{customerPhone}</Text>
            <Text style={{ fontSize: 14, color: "#9BA1A6", marginTop: 4 }}>{deliveryAddress}</Text>
            {deliveryEircode ? <Text style={{ fontSize: 14, color: "#9BA1A6" }}>{deliveryEircode}</Text> : null}
            {customerDob ? <Text style={{ fontSize: 14, color: "#9BA1A6", marginTop: 4 }}>DOB: {customerDob}</Text> : null}
          </View>

          {/* Items */}
          <View style={{ backgroundColor: "#1e2022", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#334155", marginBottom: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#687076", marginBottom: 8 }}>ITEMS ({cartItemCount})</Text>
            {cart.map(item => (
              <View key={item.productId} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#334155" }}>
                <Text style={{ fontSize: 14, color: "#ECEDEE", flex: 1 }} numberOfLines={1}>{item.quantity}x {item.name}</Text>
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#ECEDEE" }}>€{(item.price * item.quantity).toFixed(2)}</Text>
              </View>
            ))}
          </View>

          {/* Price Breakdown */}
          <View style={{ backgroundColor: "#1e2022", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#334155", marginBottom: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#687076", marginBottom: 8 }}>PRICE BREAKDOWN</Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={{ fontSize: 14, color: "#9BA1A6" }}>Subtotal</Text>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#ECEDEE" }}>€{cartSubtotal.toFixed(2)}</Text>
            </View>
            {feeInfo ? (
              <>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text style={{ fontSize: 14, color: "#9BA1A6" }}>Service Fee (10%)</Text>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: "#ECEDEE" }}>€{feeInfo.serviceFee.toFixed(2)}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text style={{ fontSize: 14, color: "#9BA1A6" }}>Delivery Fee ({feeInfo.distance.toFixed(1)} km)</Text>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: "#ECEDEE" }}>€{feeInfo.deliveryFee.toFixed(2)}</Text>
                </View>
                <View style={{ height: 1, backgroundColor: "#334155", marginVertical: 6 }} />
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 16, fontWeight: "800", color: "#ECEDEE" }}>Total</Text>
                  <Text style={{ fontSize: 16, fontWeight: "800", color: "#00E5FF" }}>€{feeInfo.total.toFixed(2)}</Text>
                </View>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 12, color: "#F59E0B", marginTop: 4 }}>
                  ⚠️ Delivery fee not yet calculated. Fees will be calculated on submit.
                </Text>
                {!feeLoading && (
                  <TouchableOpacity onPress={calculateFees} style={{ marginTop: 8 }}>
                    <Text style={{ fontSize: 13, color: "#00E5FF", fontWeight: "600" }}>Calculate Fees Now</Text>
                  </TouchableOpacity>
                )}
                {feeLoading && <ActivityIndicator size="small" color="#00E5FF" style={{ marginTop: 8 }} />}
              </>
            )}
          </View>

          {/* Payment & Options */}
          <View style={{ backgroundColor: "#1e2022", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#334155", marginBottom: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={{ fontSize: 14, color: "#687076" }}>Payment</Text>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#ECEDEE" }}>{paymentMethod === "cash_on_delivery" ? "Cash on Delivery" : "Card"}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={{ fontSize: 14, color: "#687076" }}>Substitutions</Text>
              <Text style={{ fontSize: 14, fontWeight: "600", color: allowSubstitution ? "#22C55E" : "#9BA1A6" }}>
                {allowSubstitution ? "Allowed" : "Not allowed"}
              </Text>
            </View>
            {customerNotes ? (
              <View style={{ marginTop: 4 }}>
                <Text style={{ fontSize: 14, color: "#687076" }}>Notes</Text>
                <Text style={{ fontSize: 14, color: "#ECEDEE", fontStyle: "italic", marginTop: 2 }}>{customerNotes}</Text>
              </View>
            ) : null}
          </View>

          {/* Order Source Badge */}
          <View style={{ backgroundColor: "#DBEAFE", padding: 10, borderRadius: 10, marginBottom: 20, alignItems: "center" }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#2563EB" }}>📞 Phone Order — entered by staff</Text>
          </View>

          {/* Error message */}
          {submitError ? (
            <Text style={{ fontSize: 13, color: "#EF4444", marginBottom: 10, textAlign: "center" }}>{submitError}</Text>
          ) : null}

          {/* Action Buttons */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity
              onPress={() => setStep("details")}
              style={{ flex: 1, backgroundColor: "#334155", padding: 14, borderRadius: 10, alignItems: "center" }}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: "#ECEDEE" }}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting}
              style={{
                flex: 2,
                backgroundColor: submitting ? "#687076" : "#22C55E",
                padding: 14,
                borderRadius: 10,
                alignItems: "center",
              }}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>Create Order</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* Confirm Modal Overlay */}
      {ConfirmOverlay}
    </ScreenContainer>
  );
}

export default function PhoneOrderScreen() {
  return (
    <AdminDesktopLayout title="Create Phone Order">
      <PhoneOrderScreenContent />
    </AdminDesktopLayout>
  );
}
