import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, Alert, TextInput, Modal, Dimensions, Platform } from "react-native";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useMemo, useCallback } from "react";
import { useCart } from "@/lib/cart-provider";
import { isStoreOpen, getTodayHours, getNextOpenTime, getWeeklyHoursSummary } from "@/lib/store-hours";
import { isCategoryAvailable, getAvailabilityMessage, getTodayAvailability } from "@/lib/category-availability";
import * as Haptics from "expo-haptics";
import { StyleSheet } from "react-native";
import { WebLayout } from "@/components/web-layout";

type SortOption = "az" | "za" | "price_low" | "price_high";
type CategorySortOption = "popular" | "az" | "za";

export default function StoreDetailScreen() {
  const { id, categoryId: categoryIdParam, productSearch: productSearchParam } = useLocalSearchParams<{ id: string; categoryId?: string; productSearch?: string }>();
  const router = useRouter();
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    categoryIdParam ? parseInt(categoryIdParam) : null
  );
  const [categorySearch, setCategorySearch] = useState("");
  const [categorySortBy, setCategorySortBy] = useState<CategorySortOption>("popular");
  const [productSearch, setProductSearch] = useState(productSearchParam || "");
  const [globalSearch, setGlobalSearch] = useState("");
  const [showHours, setShowHours] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("az");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [modalQuantity, setModalQuantity] = useState(1);
  const { cart, addToCart, clearCart, getItemCount } = useCart();
  
  const storeId = parseInt(id);
  const { data: store, isLoading: storeLoading } = trpc.stores.getById.useQuery({ id: storeId });
  const { data: productsData, isLoading: productsLoading } = trpc.stores.getProducts.useQuery({ storeId, limit: 5000 });
  const products = productsData?.items || [];

  const storeOpen = store ? isStoreOpen(store) : true;
  const todayHours = store ? getTodayHours(store) : null;
  const nextOpen = store && !storeOpen ? getNextOpenTime(store) : null;
  const weeklyHours = store ? getWeeklyHoursSummary(store) : [];

  const handleAddToCart = async (productId: number, productName: string, productPrice: string, categorySchedule?: string | null, qty: number = 1) => {
    if (!storeOpen) {
      Alert.alert(
        "Store Closed",
        `${store?.name} is currently closed. ${nextOpen || "Please check back later."}`,
        [{ text: "OK" }]
      );
      return;
    }

    // Check category availability
    if (categorySchedule && !isCategoryAvailable(categorySchedule)) {
      const msg = getAvailabilityMessage(categorySchedule) || "This product is not available right now.";
      Alert.alert("Not Available", msg, [{ text: "OK" }]);
      return;
    }

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const success = await addToCart(storeId, store?.name || "Store", {
      productId,
      productName,
      productPrice,
      quantity: qty,
    });

    if (!success) {
      Alert.alert(
        "Replace cart items?",
        `You have items from ${cart.storeName} in your cart.\n\nAdding items from ${store?.name} will remove your current cart.`,
        [
          { text: "Keep Current Cart", style: "cancel" },
          {
            text: "Start New Cart",
            onPress: () => {
              clearCart();
              addToCart(storeId, store?.name || "Store", {
                productId,
                productName,
                productPrice,
                quantity: qty,
              });
            },
          },
        ]
      );
    }
  };

  const cartItemCount = getItemCount();

  // Group products by category
  const categoriesWithProducts = products?.reduce((acc, product) => {
    if (!product.categoryId) return acc;
    
    if (!acc[product.categoryId]) {
      acc[product.categoryId] = {
        id: product.categoryId,
        name: product.category?.name || "Uncategorized",
        icon: product.category?.icon || null,
        ageRestricted: product.category?.ageRestricted || false,
        availabilitySchedule: product.category?.availabilitySchedule || null,
        products: [],
      };
    }
    acc[product.categoryId].products.push(product);
    return acc;
  }, {} as Record<number, { id: number; name: string; icon: string | null; ageRestricted: boolean; availabilitySchedule: string | null; products: typeof products }>) || {};

  const categories = Object.values(categoriesWithProducts);

  // Filter and sort categories
  const filteredCategories = useMemo(() => {
    let result = [...categories];
    const searchTerm = globalSearch.trim() || categorySearch.trim();
    if (searchTerm) {
      const query = searchTerm.toLowerCase();
      result = result.filter((category) =>
        category.name.toLowerCase().includes(query)
      );
    }
    // Sort categories
    switch (categorySortBy) {
      case "popular":
        result.sort((a, b) => b.products.length - a.products.length);
        break;
      case "az":
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "za":
        result.sort((a, b) => b.name.localeCompare(a.name));
        break;
    }
    return result;
  }, [categories, categorySearch, globalSearch, categorySortBy]);

  // Search products across all categories (for global search)
  const globalSearchResults = useMemo(() => {
    if (!globalSearch.trim()) return [];
    const query = globalSearch.toLowerCase().trim();
    const results: Array<{ product: any; categoryName: string; categoryId: number; categorySchedule: string | null }> = [];
    for (const cat of categories) {
      for (const product of cat.products) {
        if (
          product.name.toLowerCase().includes(query) ||
          (product.description?.toLowerCase().includes(query) || false)
        ) {
          results.push({
            product,
            categoryName: cat.name,
            categoryId: cat.id,
            categorySchedule: cat.availabilitySchedule,
          });
        }
      }
    }
    // Sort by name
    results.sort((a, b) => a.product.name.localeCompare(b.product.name));
    return results.slice(0, 50); // Limit to 50 results
  }, [categories, globalSearch]);

  // These hooks MUST be before any conditional returns to avoid hooks ordering errors
  const selectedCategory = selectedCategoryId !== null ? categoriesWithProducts[selectedCategoryId] : null;
  const categoryProducts = selectedCategory?.products || [];
  const catAvailable = isCategoryAvailable(selectedCategory?.availabilitySchedule);
  const catAvailMsg = getAvailabilityMessage(selectedCategory?.availabilitySchedule);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let result = categoryProducts;
    
    // Filter by search
    if (productSearch.trim()) {
      const query = productSearch.toLowerCase().trim();
      result = result.filter((product) =>
        product.name.toLowerCase().includes(query) ||
        (product.description?.toLowerCase().includes(query) || false)
      );
    }
    
    // Sort
    const sorted = [...result];
    switch (sortBy) {
      case "az":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "za":
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "price_low":
        sorted.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
        break;
      case "price_high":
        sorted.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
        break;
    }
    
    return sorted;
  }, [categoryProducts, productSearch, sortBy]);

  // Get quantity for a product from cart
  const getProductQuantity = useCallback((productId: number) => {
    const item = cart.items.find(i => i.productId === productId);
    return item?.quantity || 0;
  }, [cart.items]);

  // Get product image helper
  const getProductImage = useCallback((product: any): string | null => {
    const productImages = Array.isArray(product.images) ? product.images : [];
    return productImages.length > 0 ? productImages[0] : null;
  }, []);

  // Open product detail modal
  const openProductDetail = useCallback((product: any) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const existingQty = getProductQuantity(product.id);
    setModalQuantity(existingQty > 0 ? existingQty : 1);
    setSelectedProduct(product);
  }, [getProductQuantity]);

  const isWeb = Platform.OS === "web";
  const Wrapper = isWeb ? WebLayout : ({ children }: { children: React.ReactNode }) => <>{children}</>;

  // Product detail modal — works from both category view and search results
  // Defined here (before early returns) so it can be rendered in all views
  const renderProductModal = () => {
    if (!selectedProduct) return null;
    const productImage = getProductImage(selectedProduct);
    const productCatSchedule = selectedProduct.category?.availabilitySchedule ?? selectedCategory?.availabilitySchedule ?? null;
    const productCatAvailable = isCategoryAvailable(productCatSchedule);
    const productCatAvailMsg = getAvailabilityMessage(productCatSchedule);
    const productCatAgeRestricted = selectedProduct.category?.ageRestricted ?? selectedCategory?.ageRestricted ?? false;
    const isRestricted = !productCatAvailable;
    const isOutOfStock = selectedProduct.stockStatus === "out_of_stock";
    const canAdd = !isRestricted && storeOpen && !isOutOfStock;
    const quantity = getProductQuantity(selectedProduct.id);

    return (
      <Modal
        visible={!!selectedProduct}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedProduct(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setSelectedProduct(null)}
          />
          <View style={styles.modalContent}>
            <View style={styles.handleBar} />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              <TouchableOpacity onPress={() => setSelectedProduct(null)} style={styles.closeButton}>
                <Text style={{ fontSize: 18, color: "#687076", fontWeight: "600" }}>✕</Text>
              </TouchableOpacity>
              {productImage ? (
                <View style={styles.modalImageContainer}>
                  <Image source={{ uri: productImage }} style={styles.modalImage} contentFit="contain" />
                </View>
              ) : (
                <View style={[styles.modalImageContainer, styles.modalImagePlaceholder]}>
                  <Text style={{ fontSize: 64 }}>📦</Text>
                </View>
              )}
              <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <Text style={styles.modalProductName}>{selectedProduct.name}</Text>
                  {productCatAgeRestricted && (
                    <View style={{ backgroundColor: "#FEF2F2", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: "#DC2626" }}>18+</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.modalPrice}>€{parseFloat(selectedProduct.price).toFixed(2)}</Text>
                {selectedProduct.isDrs && (
                  <Text style={{ fontSize: 12, color: "#0EA5E9", fontWeight: "600", marginTop: 4 }}>Price incl. DRS deposit</Text>
                )}
                {isOutOfStock && (
                  <View style={{ backgroundColor: "#FEF2F2", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: "flex-start", marginTop: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: "#DC2626" }}>Out of Stock</Text>
                  </View>
                )}
                {isRestricted && productCatAvailMsg && (
                  <View style={{ backgroundColor: "#FEF3C7", padding: 12, borderRadius: 10, marginTop: 12, borderWidth: 1, borderColor: "#FDE68A" }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#92400E" }}>🕐 {productCatAvailMsg}</Text>
                  </View>
                )}
                {selectedProduct.description ? (
                  <View style={{ marginTop: 16 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: "#11181C", marginBottom: 6 }}>Description</Text>
                    <Text style={{ fontSize: 14, color: "#687076", lineHeight: 21 }}>{selectedProduct.description}</Text>
                  </View>
                ) : null}
                {selectedProduct.sku ? (
                  <Text style={{ fontSize: 12, color: "#9BA1A6", marginTop: 12 }}>SKU: {selectedProduct.sku}</Text>
                ) : null}
                {quantity > 0 && (
                  <View style={{ backgroundColor: "#DCFCE7", padding: 10, borderRadius: 10, marginTop: 12, flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ fontSize: 13, color: "#16A34A", fontWeight: "600" }}>✓ {quantity} already in cart</Text>
                  </View>
                )}
              </View>
            </ScrollView>
            {canAdd && (
              <View style={styles.modalBottom}>
                <View style={styles.quantitySelector}>
                  <TouchableOpacity
                    onPress={() => { if (modalQuantity > 1) { setModalQuantity(modalQuantity - 1); if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } }}
                    style={[styles.quantityButton, modalQuantity <= 1 && { opacity: 0.3 }]}
                    disabled={modalQuantity <= 1}
                  >
                    <Text style={styles.quantityButtonText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.quantityText}>{modalQuantity}</Text>
                  <TouchableOpacity
                    onPress={() => { setModalQuantity(modalQuantity + 1); if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                    style={styles.quantityButton}
                  >
                    <Text style={styles.quantityButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    handleAddToCart(selectedProduct.id, selectedProduct.name, selectedProduct.price, productCatSchedule, modalQuantity);
                    setSelectedProduct(null);
                  }}
                  style={styles.addToCartButton}
                >
                  <Text style={styles.addToCartText}>Add to Cart · €{(parseFloat(selectedProduct.price) * modalQuantity).toFixed(2)}</Text>
                </TouchableOpacity>
              </View>
            )}
            {!canAdd && (
              <View style={styles.modalBottom}>
                <View style={[styles.addToCartButton, { backgroundColor: "#9BA1A6", flex: 1 }]}>
                  <Text style={styles.addToCartText}>
                    {isOutOfStock ? "Out of Stock" : !storeOpen ? "Store Closed" : "Not Available Right Now"}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    );
  };

  if (storeLoading || productsLoading) {
    return (
      <Wrapper>
        <ScreenContainer className="items-center justify-center">
          <ActivityIndicator size="large" color="#00E5FF" />
        </ScreenContainer>
      </Wrapper>
    );
  }

  if (!store) {
    return (
      <Wrapper>
        <ScreenContainer className="items-center justify-center">
          <Text className="text-foreground">Store not found</Text>
        </ScreenContainer>
      </Wrapper>
    );
  }

  // If no category selected, show category selection
  if (selectedCategoryId === null) {
    return (
      <Wrapper>
      <ScreenContainer className="bg-background">
        {/* Header with Cart Icon */}
        <View className="flex-row items-center justify-between px-4 py-4 border-b border-border">
          <TouchableOpacity
            onPress={() => router.back()}
            className="active:opacity-70"
          >
            <Text className="text-primary text-2xl">‹ Back</Text>
          </TouchableOpacity>

          {cartItemCount > 0 && (
            <TouchableOpacity
              onPress={() => router.push(`/cart/${cart.storeId}` as any)}
              className="active:opacity-70"
            >
              <View className="relative">
                <Text className="text-3xl">🛒</Text>
                <View className="absolute -top-1 -right-1 bg-primary w-5 h-5 rounded-full items-center justify-center">
                  <Text className="text-background text-xs font-bold">{cartItemCount}</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
          {/* Store Header */}
          <View className="px-4 pt-4 pb-2">
            <View className="flex-row items-center gap-3 mb-2">
              <Text className="text-3xl font-bold text-foreground">{store.name}</Text>
              {/* Open/Closed Badge */}
              <View
                style={{
                  backgroundColor: storeOpen ? "#DCFCE7" : "#FEF2F2",
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                  borderRadius: 12,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: storeOpen ? "#16A34A" : "#DC2626",
                  }}
                >
                  {storeOpen ? "Open" : "Closed"}
                </Text>
              </View>
            </View>
            {store.address && (
              <Text className="text-sm text-muted mb-1">{store.address}</Text>
            )}
          </View>

          {/* Store Hours Section */}
          <View className="px-4 pb-4">
            <TouchableOpacity
              onPress={() => setShowHours(!showHours)}
              className="active:opacity-70"
            >
              <View className="flex-row items-center gap-2">
                <Text style={{ fontSize: 13, color: storeOpen ? "#16A34A" : "#DC2626", fontWeight: "600" }}>
                  {todayHours || "Hours not set"}
                </Text>
                <Text className="text-muted text-xs">{showHours ? "▲" : "▼"}</Text>
              </View>
              {!storeOpen && nextOpen && (
                <Text style={{ fontSize: 12, color: "#DC2626", marginTop: 2 }}>
                  {nextOpen}
                </Text>
              )}
            </TouchableOpacity>

            {/* Weekly Hours Dropdown */}
            {showHours && weeklyHours.length > 0 && (
              <View className="mt-3 bg-surface rounded-xl p-3 border border-border">
                {weeklyHours.map((item, index) => {
                  const isToday = index === new Date().getDay();
                  return (
                    <View
                      key={item.day}
                      className="flex-row justify-between py-1.5"
                      style={isToday ? { backgroundColor: "rgba(0,229,255,0.08)", marginHorizontal: -8, paddingHorizontal: 8, borderRadius: 6 } : undefined}
                    >
                      <Text style={{ fontSize: 13, fontWeight: isToday ? "700" : "400", color: isToday ? "#00E5FF" : "#687076" }}>
                        {item.day}{isToday ? " (Today)" : ""}
                      </Text>
                      <Text style={{ fontSize: 13, fontWeight: isToday ? "700" : "400", color: item.hours === "Closed" ? "#DC2626" : (isToday ? "#00E5FF" : "#687076") }}>
                        {item.hours}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Closed Store Banner */}
          {!storeOpen && (
            <View className="mx-4 mb-4 p-4 rounded-xl" style={{ backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA" }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#DC2626", marginBottom: 2 }}>
                This store is currently closed
              </Text>
              <Text style={{ fontSize: 13, color: "#991B1B" }}>
                You can browse the menu but ordering is not available right now.{nextOpen ? ` ${nextOpen}.` : ""}
              </Text>
            </View>
          )}

          {/* Search Bar — categories + products */}
          <View className="px-4 mb-4">
            <TextInput
              className="bg-surface border border-border rounded-xl p-4 text-foreground"
              placeholder="Search products and categories..."
              placeholderTextColor="#9BA1A6"
              value={globalSearch}
              onChangeText={(text) => {
                setGlobalSearch(text);
                setCategorySearch("");
              }}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>

          {/* Product Search Results */}
          {globalSearch.trim().length > 0 && globalSearchResults.length > 0 && (
            <View className="px-4 mb-4">
              <Text className="text-lg font-bold text-foreground mb-3">
                Products ({globalSearchResults.length}{globalSearchResults.length >= 50 ? "+" : ""})
              </Text>
              <View className="gap-2">
                {globalSearchResults.map(({ product, categoryName, categorySchedule }) => {
                  const productImage = getProductImage(product);
                  const qty = getProductQuantity(product.id);
                  const catOk = isCategoryAvailable(categorySchedule);
                  return (
                    <TouchableOpacity
                      key={product.id}
                      onPress={() => openProductDetail({ ...product, category: { ...product.category, availabilitySchedule: categorySchedule } })}
                      className="bg-surface rounded-xl border border-border active:opacity-70"
                      style={{ flexDirection: "row", alignItems: "center", padding: 12, gap: 12, opacity: catOk ? 1 : 0.5 }}
                    >
                      {/* Product Image */}
                      <View style={{ width: 52, height: 52, borderRadius: 10, backgroundColor: "#f0f0f0", overflow: "hidden" }}>
                        {productImage ? (
                          <Image source={{ uri: productImage }} style={{ width: 52, height: 52 }} contentFit="cover" />
                        ) : (
                          <View style={{ width: 52, height: 52, justifyContent: "center", alignItems: "center" }}>
                            <Text style={{ fontSize: 22 }}>📦</Text>
                          </View>
                        )}
                      </View>
                      {/* Product Info */}
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: "600", color: "#11181C" }} numberOfLines={1}>{product.name}</Text>
                        <Text style={{ fontSize: 11, color: "#9BA1A6", marginTop: 1 }} numberOfLines={1}>{categoryName}</Text>
                      </View>
                      {/* Price + Add */}
                      <View style={{ alignItems: "flex-end", gap: 4 }}>
                        <Text style={{ fontSize: 15, fontWeight: "700", color: "#00E5FF" }}>€{parseFloat(product.price).toFixed(2)}</Text>
                        {qty > 0 ? (
                          <View style={{ backgroundColor: "#00E5FF", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 }}>
                            <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{qty} in cart</Text>
                          </View>
                        ) : (
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation?.();
                              handleAddToCart(product.id, product.name, product.price, categorySchedule);
                            }}
                            style={{ backgroundColor: "#00E5FF", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 }}
                          >
                            <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>+ Add</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* No results message */}
          {globalSearch.trim().length > 0 && globalSearchResults.length === 0 && filteredCategories.length === 0 && (
            <View className="px-4 mb-4 items-center py-8">
              <Text style={{ fontSize: 40, marginBottom: 8 }}>🔍</Text>
              <Text className="text-muted text-center" style={{ fontSize: 15 }}>
                No products or categories match "{globalSearch}"
              </Text>
              <TouchableOpacity
                onPress={() => setGlobalSearch("")}
                className="mt-4 bg-primary px-6 py-2 rounded-lg active:opacity-70"
              >
                <Text className="text-background font-semibold">Clear Search</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Categories */}
          <View className="px-4">
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <Text className="text-xl font-bold text-foreground">
                {globalSearch.trim() && filteredCategories.length > 0 ? "Matching Categories" : "Browse by Category"}
              </Text>
              <View style={{ flexDirection: "row", gap: 4 }}>
                {(["popular", "az", "za"] as CategorySortOption[]).map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => setCategorySortBy(opt)}
                    style={[{
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 12,
                      borderWidth: 1,
                    }, categorySortBy === opt
                      ? { backgroundColor: "#00BCD4", borderColor: "#00BCD4" }
                      : { backgroundColor: "transparent", borderColor: "#9BA1A6" }
                    ]}
                  >
                    <Text style={[{ fontSize: 11, fontWeight: "700" }, categorySortBy === opt ? { color: "#fff" } : { color: "#9BA1A6" }]}>
                      {opt === "popular" ? "Popular" : opt === "az" ? "A → Z" : "Z → A"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            {filteredCategories.length > 0 ? (
              <View className="gap-3">
                {filteredCategories.map((category) => {
                  const catAvailable = isCategoryAvailable(category.availabilitySchedule);
                  const availMsg = getAvailabilityMessage(category.availabilitySchedule);
                  const todayAvail = getTodayAvailability(category.availabilitySchedule);

                  return (
                    <TouchableOpacity
                      key={category.id}
                      onPress={() => setSelectedCategoryId(category.id)}
                      className="bg-surface rounded-xl p-4 border border-border active:opacity-70"
                      style={!catAvailable ? { opacity: 0.55 } : undefined}
                    >
                      <View className="flex-row items-center gap-3">
                        <View className="w-14 h-14 bg-primary/10 rounded-xl overflow-hidden">
                          {category.icon ? (
                            <Image
                              source={{ uri: category.icon }}
                              style={{ width: 56, height: 56 }}
                              contentFit="cover"
                            />
                          ) : (
                            <View className="w-full h-full items-center justify-center">
                              <Text className="text-3xl">📦</Text>
                            </View>
                          )}
                        </View>
                        
                        <View className="flex-1">
                          <View className="flex-row items-center gap-1.5">
                            <Text className="text-lg font-semibold text-foreground" numberOfLines={1} style={{ flexShrink: 1 }}>
                              {category.name}
                            </Text>
                            {category.ageRestricted && (
                              <View style={{ backgroundColor: "#FEF2F2", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                                <Text style={{ fontSize: 10, fontWeight: "700", color: "#DC2626" }}>18+</Text>
                              </View>
                            )}
                          </View>
                          <Text className="text-sm text-muted">
                            {category.products.length} {category.products.length === 1 ? 'item' : 'items'}
                          </Text>
                          {/* Availability message */}
                          {!catAvailable && availMsg && (
                            <View className="flex-row items-center gap-1 mt-1">
                              <Text style={{ fontSize: 11, color: "#F59E0B", fontWeight: "600" }}>
                                🕐 {availMsg}
                              </Text>
                            </View>
                          )}
                          {catAvailable && todayAvail && (
                            <Text style={{ fontSize: 11, color: "#16A34A", marginTop: 2 }}>
                              🕐 {todayAvail}
                            </Text>
                          )}
                        </View>
                        
                        <Text className="text-primary text-2xl">›</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              !globalSearch.trim() ? (
                <View className="items-center py-8">
                  <Text className="text-muted text-center">No products available</Text>
                </View>
              ) : null
            )}
          </View>
        </ScrollView>
      {/* Product Detail Modal — also rendered in category browsing/search view */}
      {renderProductModal()}
      </ScreenContainer>
      </Wrapper>
    );
  }

  // Sort pill component
  const SortPill = ({ label, value }: { label: string; value: SortOption }) => {
    const isActive = sortBy === value;
    return (
      <TouchableOpacity
        onPress={() => {
          setSortBy(value);
          if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        style={[
          styles.sortPill,
          isActive && styles.sortPillActive,
        ]}
      >
        <Text style={[
          styles.sortPillText,
          isActive && styles.sortPillTextActive,
        ]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <Wrapper>
    <ScreenContainer className="bg-background">
      {/* Product Detail Modal */}
      {renderProductModal()}

      {/* Header with Back Button and Cart Icon */}
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-border">
        <TouchableOpacity
          onPress={() => { setSelectedCategoryId(null); setProductSearch(""); setSortBy("az"); }}
          className="active:opacity-70"
        >
          <Text className="text-primary text-2xl">‹ Categories</Text>
        </TouchableOpacity>

        {cartItemCount > 0 && (
          <TouchableOpacity
            onPress={() => router.push(`/cart/${cart.storeId}` as any)}
            className="active:opacity-70"
          >
            <View className="relative">
              <Text className="text-3xl">🛒</Text>
              <View className="absolute -top-1 -right-1 bg-primary w-5 h-5 rounded-full items-center justify-center">
                <Text className="text-background text-xs font-bold">{cartItemCount}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 20 }}>
        {/* Category Header */}
        <View className="px-4 pt-4 pb-2">
          <View className="flex-row items-center gap-2">
            <Text className="text-3xl font-bold text-foreground">{selectedCategory?.name}</Text>
            {selectedCategory?.ageRestricted && (
              <View style={{ backgroundColor: "#FEF2F2", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#DC2626" }}>18+</Text>
              </View>
            )}
          </View>
          <View className="flex-row items-center gap-2 mt-1">
            <Text className="text-sm text-muted">{store.name} · {filteredProducts.length} items</Text>
            {!storeOpen && (
              <View style={{ backgroundColor: "#FEF2F2", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#DC2626" }}>Closed</Text>
              </View>
            )}
          </View>
        </View>

        {/* Category Availability Banner */}
        {!catAvailable && catAvailMsg && (
          <View className="mx-4 mb-3 p-3 rounded-xl" style={{ backgroundColor: "#FEF3C7", borderWidth: 1, borderColor: "#FDE68A" }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#92400E" }}>
              🕐 {catAvailMsg}
            </Text>
            <Text style={{ fontSize: 12, color: "#92400E", marginTop: 2 }}>
              You can browse but these items cannot be added to your cart right now.
            </Text>
          </View>
        )}

        {/* Product Search Bar */}
        <View className="px-4 pt-3 pb-2">
          <TextInput
            className="bg-surface border border-border rounded-xl p-4 text-foreground"
            placeholder="Search products..."
            placeholderTextColor="#9BA1A6"
            value={productSearch}
            onChangeText={setProductSearch}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
          />
        </View>

        {/* Sort Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}
        >
          <SortPill label="A → Z" value="az" />
          <SortPill label="Z → A" value="za" />
          <SortPill label="Price ↑" value="price_low" />
          <SortPill label="Price ↓" value="price_high" />
        </ScrollView>

        {/* Products */}
        <View className="px-4 pt-2">
          {filteredProducts.length > 0 ? (
            <View className="gap-3">
              {filteredProducts.map((product) => {
                const quantity = getProductQuantity(product.id);
                const isRestricted = !catAvailable;
                const productImage = getProductImage(product);

                return (
                  <TouchableOpacity
                    key={product.id}
                    onPress={() => openProductDetail(product)}
                    activeOpacity={0.7}
                    style={isRestricted ? { opacity: 0.45 } : undefined}
                  >
                    <View className="bg-surface rounded-xl p-4 border border-border">
                      <View className="flex-row justify-between items-start">
                        {/* Product Image */}
                        {productImage && (
                          <View style={{ width: 64, height: 64, borderRadius: 10, overflow: "hidden", marginRight: 12 }}>
                            <Image
                              source={{ uri: productImage }}
                              style={{ width: 64, height: 64 }}
                              contentFit="cover"
                            />
                          </View>
                        )}

                        <View className="flex-1 pr-3">
                          <Text className="text-base font-semibold text-foreground mb-1" numberOfLines={2}>
                            {product.name}
                          </Text>
                          {product.description && (
                            <Text className="text-sm text-muted mb-2" numberOfLines={2}>
                              {product.description}
                            </Text>
                          )}
                          <Text className="text-lg font-bold text-primary">
                            €{parseFloat(product.price).toFixed(2)}
                          </Text>
                          {product.isDrs && (
                            <Text style={{ fontSize: 10, color: "#0EA5E9", fontWeight: "600", marginTop: 1 }}>Price incl. DRS deposit</Text>
                          )}
                          {product.stockStatus === "out_of_stock" && (
                            <Text style={{ fontSize: 11, color: "#DC2626", fontWeight: "600", marginTop: 2 }}>Out of stock</Text>
                          )}
                        </View>

                        {/* Add to Cart Button */}
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            handleAddToCart(product.id, product.name, product.price, selectedCategory?.availabilitySchedule);
                          }}
                          style={[
                            styles.quickAddButton,
                            {
                              backgroundColor: isRestricted || !storeOpen || product.stockStatus === "out_of_stock" ? "#9BA1A6" : "#00E5FF",
                            },
                          ]}
                          disabled={product.stockStatus === "out_of_stock"}
                        >
                          <Text className="text-background font-semibold">
                            {product.stockStatus === "out_of_stock" ? "N/A" : quantity > 0 ? `+${quantity}` : "Add"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View className="items-center py-8">
              <Text className="text-muted">
                {productSearch ? "No products match your search" : "No products in this category"}
              </Text>
              {productSearch && (
                <TouchableOpacity
                  onPress={() => setProductSearch("")}
                  className="mt-4 bg-primary px-6 py-2 rounded-lg active:opacity-70"
                >
                  <Text className="text-background font-semibold">Clear Search</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* View Cart Button - Fixed at bottom */}
      {cartItemCount > 0 && cart.storeId === storeId && (
        <View className="p-4 bg-background border-t border-border">
          <TouchableOpacity
            onPress={() => router.push(`/cart/${storeId}` as any)}
            className="bg-primary py-4 rounded-xl active:opacity-70"
          >
            <Text className="text-background text-center font-bold text-lg">
              View Cart ({cartItemCount} {cartItemCount === 1 ? 'item' : 'items'})
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </ScreenContainer>
    </Wrapper>
  );
}

const { width: screenWidth } = Dimensions.get("window");

const styles = StyleSheet.create({
  // Sort pills
  sortPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sortPillActive: {
    backgroundColor: "#00E5FF",
    borderColor: "#00E5FF",
  },
  sortPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#687076",
  },
  sortPillTextActive: {
    color: "#ffffff",
  },
  // Quick add button on list
  quickAddButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: "center",
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    minHeight: "50%",
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: "#D1D5DB",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 8,
  },
  closeButton: {
    position: "absolute",
    top: 4,
    right: 16,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    justifyContent: "center",
  },
  modalImageContainer: {
    width: "100%",
    height: 240,
    backgroundColor: "#f9f9f9",
    alignItems: "center",
    justifyContent: "center",
  },
  modalImage: {
    width: "100%",
    height: 240,
  },
  modalImagePlaceholder: {
    backgroundColor: "#f0f0f0",
  },
  modalProductName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#11181C",
    flexShrink: 1,
  },
  modalPrice: {
    fontSize: 24,
    fontWeight: "800",
    color: "#00E5FF",
    marginTop: 4,
  },
  modalBottom: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    gap: 12,
  },
  quantitySelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  quantityButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  quantityButtonText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#11181C",
  },
  quantityText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#11181C",
    minWidth: 28,
    textAlign: "center",
  },
  addToCartButton: {
    flex: 1,
    backgroundColor: "#00E5FF",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  addToCartText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
  },
});
