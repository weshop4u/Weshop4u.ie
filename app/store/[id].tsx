import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, Alert, TextInput } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useMemo } from "react";
import { useCart } from "@/lib/cart-provider";

export default function StoreDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [categorySearch, setCategorySearch] = useState("");
  const { cart, addToCart, clearCart, getItemCount } = useCart();
  
  const storeId = parseInt(id);
  const { data: store, isLoading: storeLoading } = trpc.stores.getById.useQuery({ id: storeId });
  const { data: products, isLoading: productsLoading } = trpc.stores.getProducts.useQuery({ storeId });

  const handleAddToCart = async (productId: number, productName: string, productPrice: string) => {
    const success = await addToCart(storeId, store?.name || "Store", {
      productId,
      productName,
      productPrice,
      quantity: 1,
    });

    if (!success) {
      // Show store restriction dialog
      Alert.alert(
        "Replace cart items?",
        `You have items from ${cart.storeName} in your cart.\n\nAdding items from ${store?.name} will remove your current cart.`,
        [
          {
            text: "Keep Current Cart",
            style: "cancel",
          },
          {
            text: "Start New Cart",
            onPress: () => {
              clearCart();
              addToCart(storeId, store?.name || "Store", {
                productId,
                productName,
                productPrice,
                quantity: 1,
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
        products: [],
      };
    }
    acc[product.categoryId].products.push(product);
    return acc;
  }, {} as Record<number, { id: number; name: string; products: typeof products }>) || {};

  const categories = Object.values(categoriesWithProducts);

  // Filter categories based on search query
  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return categories;
    const query = categorySearch.toLowerCase().trim();
    return categories.filter((category) =>
      category.name.toLowerCase().includes(query)
    );
  }, [categories, categorySearch]);

  if (storeLoading || productsLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color="#00E5FF" />
      </ScreenContainer>
    );
  }

  if (!store) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Text className="text-foreground">Store not found</Text>
      </ScreenContainer>
    );
  }

  // If no category selected, show category selection
  if (selectedCategoryId === null) {
    return (
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
          <View className="px-4 pt-4 pb-6">
            <View className="flex-row items-center gap-3 mb-2">
              <Text className="text-3xl font-bold text-foreground">{store.name}</Text>
            </View>
            {store.address && (
              <Text className="text-sm text-muted">{store.address}</Text>
            )}
          </View>

          {/* Category Search Bar */}
          <View className="px-4 mb-4">
            <TextInput
              className="bg-surface border border-border rounded-xl p-4 text-foreground"
              placeholder="Search categories..."
              placeholderTextColor="#9BA1A6"
              value={categorySearch}
              onChangeText={setCategorySearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Categories */}
          <View className="px-4">
            <Text className="text-xl font-bold text-foreground mb-4">Browse by Category</Text>
            
            {filteredCategories.length > 0 ? (
              <View className="gap-3">
                {filteredCategories.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    onPress={() => setSelectedCategoryId(category.id)}
                    className="bg-surface rounded-xl p-4 border border-border active:opacity-70"
                  >
                    <View className="flex-row items-center gap-3">
                      {/* Category Icon/Image */}
                      <View className="w-14 h-14 bg-primary/10 rounded-xl items-center justify-center">
                        <Text className="text-3xl">
                          {category.products[0]?.category?.icon || '📦'}
                        </Text>
                      </View>
                      
                      {/* Category Info */}
                      <View className="flex-1">
                        <Text className="text-lg font-semibold text-foreground mb-1">
                          {category.name}
                        </Text>
                        <Text className="text-sm text-muted">
                          {category.products.length} {category.products.length === 1 ? 'item' : 'items'}
                        </Text>
                      </View>
                      
                      {/* Arrow */}
                      <Text className="text-primary text-2xl">›</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View className="items-center py-8">
                <Text className="text-muted text-center">
                  {categorySearch ? "No categories match your search" : "No products available"}
                </Text>
                {categorySearch && (
                  <TouchableOpacity
                    onPress={() => setCategorySearch("")}
                    className="mt-4 bg-primary px-6 py-2 rounded-lg active:opacity-70"
                  >
                    <Text className="text-background font-semibold">Clear Search</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // Show products for selected category
  const selectedCategory = categoriesWithProducts[selectedCategoryId];
  const categoryProducts = selectedCategory?.products || [];

  // Get quantity for a product from cart
  const getProductQuantity = (productId: number) => {
    const item = cart.items.find(i => i.productId === productId);
    return item?.quantity || 0;
  };

  return (
    <ScreenContainer className="bg-background">
      {/* Header with Back Button and Cart Icon */}
      <View className="flex-row items-center justify-between px-4 py-4 border-b border-border">
        <TouchableOpacity
          onPress={() => setSelectedCategoryId(null)}
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
        <View className="px-4 pt-4 pb-6">
          <Text className="text-3xl font-bold text-foreground">{selectedCategory?.name}</Text>
          <Text className="text-sm text-muted">{store.name}</Text>
        </View>

        {/* Products */}
        <View className="px-4">
          {categoryProducts.length > 0 ? (
            <View className="gap-3">
              {categoryProducts.map((product) => {
                const quantity = getProductQuantity(product.id);
                return (
                  <View
                    key={product.id}
                    className="bg-surface rounded-xl p-4 border border-border"
                  >
                    <View className="flex-row justify-between items-start">
                      <View className="flex-1 pr-4">
                        <Text className="text-lg font-semibold text-foreground mb-1">
                          {product.name}
                        </Text>
                        {product.description && (
                          <Text className="text-sm text-muted mb-2" numberOfLines={2}>
                            {product.description}
                          </Text>
                        )}
                        <Text className="text-xl font-bold text-primary">
                          €{parseFloat(product.price).toFixed(2)}
                        </Text>
                      </View>

                      {/* Add to Cart Button */}
                      <TouchableOpacity
                        onPress={() => handleAddToCart(product.id, product.name, product.price)}
                        className="bg-primary px-4 py-2 rounded-lg active:opacity-70"
                      >
                        <Text className="text-background font-semibold">
                          {quantity > 0 ? `+${quantity}` : "Add"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View className="items-center py-8">
              <Text className="text-muted">No products in this category</Text>
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
  );
}
