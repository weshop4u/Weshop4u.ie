import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Switch, Platform, Image as RNImage, FlatList } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useRouter } from "expo-router";
import { useState, useMemo, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/hooks/use-auth";

type ProductItem = {
  id: number;
  name: string;
  description: string | null;
  price: string;
  salePrice: string | null;
  stockStatus: "in_stock" | "out_of_stock" | "low_stock";
  isActive: boolean | null;
  categoryId: number | null;
  categoryName: string | null;
  quantity: number | null;
  sku: string | null;
  barcode: string | null;
  images: string | null;
  createdAt: Date;
};

const webConfirm = (msg: string) => Platform.OS === "web" ? window.confirm(msg) : true;
const webAlert = (msg: string) => Platform.OS === "web" ? window.alert(msg) : null;

/** Parse the images JSON string and return the first image URL or null */
function getFirstImageUrl(images: string | null | undefined): string | null {
  if (!images) return null;
  try {
    const arr = JSON.parse(images);
    if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === "string") {
      return arr[0];
    }
  } catch {}
  return null;
}

export default function ProductManagementScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const utils = trpc.useUtils();

  // Get store ID
  const { data: myStore } = trpc.store.getMyStore.useQuery(
    { userId: user?.id! },
    { enabled: !!user?.id }
  );
  const storeId = myStore?.storeId;

  // Queries
  const { data: productsData, isLoading } = trpc.store.getProducts.useQuery(
    { storeId: storeId! },
    { enabled: !!storeId }
  );
  const { data: categories } = trpc.store.getCategories.useQuery(
    { storeId: storeId! },
    { enabled: !!storeId }
  );

  // Mutations
  const addProductMut = trpc.store.addProduct.useMutation({
    onSuccess: () => {
      utils.store.getProducts.invalidate();
      setShowAddForm(false);
      resetForm();
    },
  });
  const updateProductMut = trpc.store.updateProduct.useMutation({
    onSuccess: () => {
      utils.store.getProducts.invalidate();
      setEditingId(null);
    },
  });
  const toggleStockMut = trpc.store.toggleProductStock.useMutation({
    onSuccess: () => utils.store.getProducts.invalidate(),
  });
  const deleteProductMut = trpc.store.deleteProduct.useMutation({
    onSuccess: () => utils.store.getProducts.invalidate(),
  });
  const addCategoryMut = trpc.store.addCategory.useMutation({
    onSuccess: () => {
      utils.store.getCategories.invalidate();
      setNewCategoryName("");
      setShowAddCategory(false);
    },
  });

  // State
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [filterCategory, setFilterCategory] = useState<number | null>(null);
  const [stockFilter, setStockFilter] = useState<"all" | "in_stock" | "out_of_stock">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showEditCategoryPicker, setShowEditCategoryPicker] = useState(false);
  const [editCategorySearch, setEditCategorySearch] = useState("");
  const [showFormCategoryPicker, setShowFormCategoryPicker] = useState(false);
  const [formCategorySearch, setFormCategorySearch] = useState("");

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formCategory, setFormCategory] = useState<number | undefined>(undefined);
  const [formStockStatus, setFormStockStatus] = useState<"in_stock" | "out_of_stock">("in_stock");

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editCategory, setEditCategory] = useState<number | undefined>(undefined);

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormPrice("");
    setFormCategory(undefined);
    setFormStockStatus("in_stock");
  };

  const startEdit = (product: ProductItem) => {
    setEditingId(product.id);
    setEditName(product.name);
    setEditDescription(product.description || "");
    setEditPrice(product.price);
    setEditCategory(product.categoryId ?? undefined);
  };

  // Filtered products
  const filteredProducts = useMemo(() => {
    if (!productsData) return [];
    let filtered = productsData.filter((p) => p.isActive !== false);
    if (stockFilter !== "all") {
      filtered = filtered.filter((p) => p.stockStatus === stockFilter);
    }
    if (filterCategory !== null) {
      filtered = filtered.filter((p) => p.categoryId === filterCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          (p.sku && p.sku.toLowerCase().includes(q))
      );
    }
    return filtered;
  }, [productsData, filterCategory, searchQuery, stockFilter]);

  const totalProducts = productsData?.filter((p) => p.isActive !== false).length || 0;
  const inStockCount = productsData?.filter((p) => p.isActive !== false && p.stockStatus === "in_stock").length || 0;
  const outOfStockCount = productsData?.filter((p) => p.isActive !== false && p.stockStatus === "out_of_stock").length || 0;

  // Get the selected category name for the dropdown button
  const selectedCategoryName = useMemo(() => {
    if (filterCategory === null) return "All Categories";
    const cat = categories?.find((c) => c.id === filterCategory);
    return cat?.name || "Unknown";
  }, [filterCategory, categories]);

  // Custom category priority order — user-defined tiers, then rest alphabetically
  const CATEGORY_PRIORITY_ORDER = [
    "Deli",
    "Fizzy Drinks",
    "Energy Drinks",
    "Water and Flavoured Water",
    "Chocolate Bars",
    "Chocolates Multi packs and Boxes",
    "Crisps and Nuts",
    "Biscuits and Cookies",
    "Tobacco and Cigars and Papers",
    "Vapes and Vape Oils",
    "Spirits",
    "Cans and Bottles",
    "Flavored Alcohol",
    "Wines",
    "Nicotine Products",
  ];

  // Categories sorted with product count using custom priority
  const categoriesWithCount = useMemo(() => {
    if (!categories || !productsData) return [];
    const activeProducts = productsData.filter((p) => p.isActive !== false);
    const withCount = categories.map((cat) => ({
      ...cat,
      count: activeProducts.filter((p) => p.categoryId === cat.id).length,
    })).filter((c) => c.count > 0);

    // Sort: priority categories first (in specified order), then rest alphabetically
    return withCount.sort((a, b) => {
      const aIdx = CATEGORY_PRIORITY_ORDER.indexOf(a.name);
      const bIdx = CATEGORY_PRIORITY_ORDER.indexOf(b.name);
      // Both are priority categories — sort by their priority position
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      // Only a is priority — a comes first
      if (aIdx !== -1) return -1;
      // Only b is priority — b comes first
      if (bIdx !== -1) return 1;
      // Neither is priority — sort alphabetically
      return a.name.localeCompare(b.name);
    });
  }, [categories, productsData]);

  // Sorted categories for edit/add form pickers (priority order, then alphabetical)
  const sortedCategoriesForPicker = useMemo(() => {
    if (!categories) return [];
    return [...categories].sort((a, b) => {
      const aIdx = CATEGORY_PRIORITY_ORDER.indexOf(a.name);
      const bIdx = CATEGORY_PRIORITY_ORDER.indexOf(b.name);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [categories]);

  if (!storeId) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color="#0a7ea4" />
        <Text className="text-muted mt-4">Loading store...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
            <Text style={{ color: "#0a7ea4", fontSize: 16, fontWeight: "600" }}>← Back</Text>
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: 18, fontWeight: "700", color: "#11181C", textAlign: "center" }}>Products</Text>
          <TouchableOpacity
            onPress={() => setShowAddForm(!showAddForm)}
            style={{ backgroundColor: "#22C55E", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Bar - Tappable filters */}
        <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}>
          <TouchableOpacity onPress={() => setStockFilter(stockFilter === "all" ? "all" : "all")} style={{ flex: 1, backgroundColor: stockFilter === "all" ? "#0a7ea4" : "#f0f9ff", padding: 12, borderRadius: 10, alignItems: "center", borderWidth: stockFilter === "all" ? 2 : 0, borderColor: "#0a7ea4" }}>
            <Text style={{ fontSize: 20, fontWeight: "800", color: stockFilter === "all" ? "#fff" : "#0a7ea4" }}>{totalProducts}</Text>
            <Text style={{ fontSize: 11, color: stockFilter === "all" ? "#e0f0ff" : "#687076" }}>Total</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setStockFilter(stockFilter === "in_stock" ? "all" : "in_stock")} style={{ flex: 1, backgroundColor: stockFilter === "in_stock" ? "#22C55E" : "#f0fdf4", padding: 12, borderRadius: 10, alignItems: "center", borderWidth: stockFilter === "in_stock" ? 2 : 0, borderColor: "#22C55E" }}>
            <Text style={{ fontSize: 20, fontWeight: "800", color: stockFilter === "in_stock" ? "#fff" : "#22C55E" }}>{inStockCount}</Text>
            <Text style={{ fontSize: 11, color: stockFilter === "in_stock" ? "#e0ffe0" : "#687076" }}>In Stock</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setStockFilter(stockFilter === "out_of_stock" ? "all" : "out_of_stock")} style={{ flex: 1, backgroundColor: stockFilter === "out_of_stock" ? "#EF4444" : "#fef2f2", padding: 12, borderRadius: 10, alignItems: "center", borderWidth: stockFilter === "out_of_stock" ? 2 : 0, borderColor: "#EF4444" }}>
            <Text style={{ fontSize: 20, fontWeight: "800", color: stockFilter === "out_of_stock" ? "#fff" : "#EF4444" }}>{outOfStockCount}</Text>
            <Text style={{ fontSize: 11, color: stockFilter === "out_of_stock" ? "#ffe0e0" : "#687076" }}>Out of Stock</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          <TextInput
            placeholder="Search products..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{
              backgroundColor: "#f5f5f5",
              padding: 12,
              borderRadius: 10,
              fontSize: 14,
              color: "#11181C",
            }}
            placeholderTextColor="#9BA1A6"
          />
        </View>

        {/* Category Dropdown Button */}
        <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          <TouchableOpacity
            onPress={() => setShowCategoryPicker(!showCategoryPicker)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: filterCategory !== null ? "#0a7ea4" : "#f5f5f5",
              padding: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: filterCategory !== null ? "#0a7ea4" : "#E5E7EB",
            }}
          >
            <Text style={{
              fontSize: 14,
              fontWeight: "600",
              color: filterCategory !== null ? "#fff" : "#11181C",
            }}>
              {selectedCategoryName}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {filterCategory !== null && (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation?.();
                    setFilterCategory(null);
                    setShowCategoryPicker(false);
                  }}
                  style={{
                    backgroundColor: "rgba(255,255,255,0.3)",
                    borderRadius: 10,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>✕ Clear</Text>
                </TouchableOpacity>
              )}
              <Text style={{ color: filterCategory !== null ? "#fff" : "#687076", fontSize: 16 }}>
                {showCategoryPicker ? "▲" : "▼"}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Category Picker Dropdown */}
        {showCategoryPicker && (
          <View style={{
            marginHorizontal: 16,
            marginBottom: 12,
            backgroundColor: "#fff",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#E5E7EB",
            maxHeight: 300,
            overflow: "hidden",
          }}>
            <ScrollView nestedScrollEnabled style={{ maxHeight: 300 }}>
              {/* All Categories option */}
              <TouchableOpacity
                onPress={() => { setFilterCategory(null); setShowCategoryPicker(false); }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: 12,
                  backgroundColor: filterCategory === null ? "#f0f9ff" : "#fff",
                  borderBottomWidth: 1,
                  borderBottomColor: "#f0f0f0",
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: filterCategory === null ? "700" : "500", color: filterCategory === null ? "#0a7ea4" : "#11181C" }}>
                  All Categories
                </Text>
                <Text style={{ fontSize: 12, color: "#687076" }}>{totalProducts}</Text>
              </TouchableOpacity>

              {categoriesWithCount.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => { setFilterCategory(cat.id); setShowCategoryPicker(false); }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: 12,
                    backgroundColor: filterCategory === cat.id ? "#f0f9ff" : "#fff",
                    borderBottomWidth: 1,
                    borderBottomColor: "#f0f0f0",
                  }}
                >
                  <Text style={{
                    fontSize: 14,
                    fontWeight: filterCategory === cat.id ? "700" : "500",
                    color: filterCategory === cat.id ? "#0a7ea4" : "#11181C",
                    flex: 1,
                    marginRight: 8,
                  }}>
                    {cat.name}
                  </Text>
                  <View style={{
                    backgroundColor: "#f0f0f0",
                    borderRadius: 10,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    minWidth: 30,
                    alignItems: "center",
                  }}>
                    <Text style={{ fontSize: 12, color: "#687076", fontWeight: "600" }}>{cat.count}</Text>
                  </View>
                </TouchableOpacity>
              ))}

              {/* Add Category option */}
              <TouchableOpacity
                onPress={() => { setShowCategoryPicker(false); setShowAddCategory(true); }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 12,
                  backgroundColor: "#f9fafb",
                  borderTopWidth: 1,
                  borderTopColor: "#E5E7EB",
                }}
              >
                <Text style={{ fontSize: 14, color: "#0a7ea4", fontWeight: "600" }}>+ Add New Category</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {/* Add Category Form */}
        {showAddCategory && (
          <View style={{ marginHorizontal: 16, marginBottom: 12, backgroundColor: "#f0f9ff", padding: 12, borderRadius: 12, gap: 8 }}>
            <Text style={{ fontWeight: "700", color: "#11181C", fontSize: 14 }}>New Category</Text>
            <TextInput
              placeholder="Category name"
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              style={{ backgroundColor: "#fff", padding: 10, borderRadius: 8, fontSize: 14, color: "#11181C", borderWidth: 1, borderColor: "#E5E7EB" }}
              placeholderTextColor="#9BA1A6"
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                onPress={() => {
                  if (!newCategoryName.trim()) return;
                  addCategoryMut.mutate({ name: newCategoryName.trim() });
                }}
                style={{ flex: 1, backgroundColor: "#0a7ea4", padding: 10, borderRadius: 8, alignItems: "center" }}
              >
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>Add</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setShowAddCategory(false); setNewCategoryName(""); }}
                style={{ flex: 1, backgroundColor: "#f5f5f5", padding: 10, borderRadius: 8, alignItems: "center" }}
              >
                <Text style={{ color: "#687076", fontWeight: "600", fontSize: 13 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Add Product Form */}
        {showAddForm && (
          <View style={{ marginHorizontal: 16, marginBottom: 12, backgroundColor: "#f0fdf4", padding: 16, borderRadius: 12, gap: 10, borderWidth: 1, borderColor: "#bbf7d0" }}>
            <Text style={{ fontWeight: "700", color: "#11181C", fontSize: 16 }}>Add New Product</Text>

            <TextInput
              placeholder="Product name *"
              value={formName}
              onChangeText={setFormName}
              style={{ backgroundColor: "#fff", padding: 12, borderRadius: 8, fontSize: 14, color: "#11181C", borderWidth: 1, borderColor: "#E5E7EB" }}
              placeholderTextColor="#9BA1A6"
            />

            <TextInput
              placeholder="Description (optional)"
              value={formDescription}
              onChangeText={setFormDescription}
              multiline
              style={{ backgroundColor: "#fff", padding: 12, borderRadius: 8, fontSize: 14, color: "#11181C", borderWidth: 1, borderColor: "#E5E7EB", minHeight: 60 }}
              placeholderTextColor="#9BA1A6"
            />

            <TextInput
              placeholder="Price (e.g. 4.50) *"
              value={formPrice}
              onChangeText={setFormPrice}
              keyboardType="decimal-pad"
              style={{ backgroundColor: "#fff", padding: 12, borderRadius: 8, fontSize: 14, color: "#11181C", borderWidth: 1, borderColor: "#E5E7EB" }}
              placeholderTextColor="#9BA1A6"
            />

            {/* Category picker - dropdown */}
            <Text style={{ fontSize: 12, color: "#687076", fontWeight: "600" }}>Category</Text>
            <TouchableOpacity
              onPress={() => { setShowFormCategoryPicker(!showFormCategoryPicker); setFormCategorySearch(""); }}
              style={{ backgroundColor: "#fff", padding: 12, borderRadius: 8, borderWidth: 1, borderColor: "#E5E7EB", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
            >
              <Text style={{ fontSize: 14, color: formCategory ? "#11181C" : "#9BA1A6" }}>
                {formCategory ? (categories?.find((c) => c.id === formCategory)?.name || "Unknown") : "None (no category)"}
              </Text>
              <Text style={{ fontSize: 12, color: "#9BA1A6" }}>{showFormCategoryPicker ? "▲" : "▼"}</Text>
            </TouchableOpacity>
            {showFormCategoryPicker && (
              <View style={{ backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: "#E5E7EB", maxHeight: 220, overflow: "hidden" }}>
                <TextInput
                  placeholder="Search categories..."
                  value={formCategorySearch}
                  onChangeText={setFormCategorySearch}
                  style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: "#E5E7EB", fontSize: 13, color: "#11181C" }}
                  placeholderTextColor="#9BA1A6"
                  autoFocus
                />
                <ScrollView style={{ maxHeight: 170 }} keyboardShouldPersistTaps="handled">
                  <TouchableOpacity
                    onPress={() => { setFormCategory(undefined); setShowFormCategoryPicker(false); }}
                    style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: "#f5f5f5", backgroundColor: formCategory === undefined ? "#e0f7fa" : "#fff" }}
                  >
                    <Text style={{ fontSize: 13, color: formCategory === undefined ? "#0a7ea4" : "#687076", fontWeight: formCategory === undefined ? "700" : "400" }}>None (no category)</Text>
                  </TouchableOpacity>
                  {sortedCategoriesForPicker
                    .filter((cat) => !formCategorySearch || cat.name.toLowerCase().includes(formCategorySearch.toLowerCase()))
                    .map((cat) => (
                      <TouchableOpacity
                        key={cat.id}
                        onPress={() => { setFormCategory(cat.id); setShowFormCategoryPicker(false); }}
                        style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: "#f5f5f5", backgroundColor: formCategory === cat.id ? "#e0f7fa" : "#fff" }}
                      >
                        <Text style={{ fontSize: 13, color: formCategory === cat.id ? "#0a7ea4" : "#11181C", fontWeight: formCategory === cat.id ? "700" : "400" }}>{cat.name}</Text>
                      </TouchableOpacity>
                    ))}
                </ScrollView>
              </View>
            )}

            {/* Stock status */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 12, color: "#687076", fontWeight: "600" }}>In Stock</Text>
              <Switch
                value={formStockStatus === "in_stock"}
                onValueChange={(v) => setFormStockStatus(v ? "in_stock" : "out_of_stock")}
                trackColor={{ false: "#E5E7EB", true: "#22C55E" }}
              />
            </View>

            <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
              <TouchableOpacity
                onPress={() => {
                  if (!formName.trim() || !formPrice.trim()) {
                    webAlert("Please fill in name and price");
                    return;
                  }
                  addProductMut.mutate({
                    storeId: storeId!,
                    name: formName.trim(),
                    description: formDescription.trim() || undefined,
                    price: formPrice.trim(),
                    categoryId: formCategory,
                    stockStatus: formStockStatus,
                  });
                }}
                style={{ flex: 1, backgroundColor: "#22C55E", padding: 14, borderRadius: 10, alignItems: "center" }}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
                  {addProductMut.isPending ? "Adding..." : "Add Product"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setShowAddForm(false); resetForm(); }}
                style={{ flex: 1, backgroundColor: "#f5f5f5", padding: 14, borderRadius: 10, alignItems: "center" }}
              >
                <Text style={{ color: "#687076", fontWeight: "600", fontSize: 15 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Product Count */}
        <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          <Text style={{ fontSize: 12, color: "#9BA1A6" }}>
            Showing {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""}
            {filterCategory !== null ? ` in ${selectedCategoryName}` : ""}
            {stockFilter !== "all" ? ` (${stockFilter === "in_stock" ? "in stock" : "out of stock"})` : ""}
          </Text>
        </View>

        {/* Product List */}
        {isLoading ? (
          <View style={{ padding: 40, alignItems: "center" }}>
            <ActivityIndicator size="large" color="#0a7ea4" />
          </View>
        ) : filteredProducts.length === 0 ? (
          <View style={{ padding: 40, alignItems: "center" }}>
            <RNImage
              source={require("@/assets/images/Weshop4ulogo.jpg")}
              style={{ width: 72, height: 72, borderRadius: 36, marginBottom: 8 }}
              resizeMode="cover"
            />
            <Text style={{ color: "#687076", fontSize: 14 }}>
              {searchQuery ? "No products match your search" : "No products yet. Tap + Add to create one."}
            </Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16, gap: 8 }}>
            {filteredProducts.map((product) => {
              const imageUrl = getFirstImageUrl((product as any).images);
              return (
                <View
                  key={product.id}
                  style={{
                    backgroundColor: "#fff",
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: product.stockStatus === "out_of_stock" ? "#fecaca" : "#E5E7EB",
                    overflow: "hidden",
                  }}
                >
                  {editingId === product.id ? (
                    /* Edit Mode */
                    <View style={{ padding: 14, gap: 8 }}>
                      <TextInput
                        value={editName}
                        onChangeText={setEditName}
                        style={{ backgroundColor: "#f5f5f5", padding: 10, borderRadius: 8, fontSize: 14, color: "#11181C", fontWeight: "600" }}
                      />
                      <TextInput
                        value={editDescription}
                        onChangeText={setEditDescription}
                        placeholder="Description"
                        multiline
                        style={{ backgroundColor: "#f5f5f5", padding: 10, borderRadius: 8, fontSize: 13, color: "#11181C", minHeight: 50 }}
                        placeholderTextColor="#9BA1A6"
                      />
                      <TextInput
                        value={editPrice}
                        onChangeText={setEditPrice}
                        keyboardType="decimal-pad"
                        style={{ backgroundColor: "#f5f5f5", padding: 10, borderRadius: 8, fontSize: 14, color: "#11181C" }}
                      />
                      {/* Category picker - dropdown */}
                      <Text style={{ fontSize: 11, color: "#687076", fontWeight: "600" }}>Category</Text>
                      <TouchableOpacity
                        onPress={() => { setShowEditCategoryPicker(!showEditCategoryPicker); setEditCategorySearch(""); }}
                        style={{ backgroundColor: "#f5f5f5", padding: 10, borderRadius: 8, borderWidth: 1, borderColor: "#E5E7EB", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
                      >
                        <Text style={{ fontSize: 13, color: editCategory ? "#11181C" : "#9BA1A6" }}>
                          {editCategory ? (categories?.find((c) => c.id === editCategory)?.name || "Unknown") : "None (no category)"}
                        </Text>
                        <Text style={{ fontSize: 11, color: "#9BA1A6" }}>{showEditCategoryPicker ? "▲" : "▼"}</Text>
                      </TouchableOpacity>
                      {showEditCategoryPicker && (
                        <View style={{ backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: "#E5E7EB", maxHeight: 220, overflow: "hidden" }}>
                          <TextInput
                            placeholder="Search categories..."
                            value={editCategorySearch}
                            onChangeText={setEditCategorySearch}
                            style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: "#E5E7EB", fontSize: 13, color: "#11181C" }}
                            placeholderTextColor="#9BA1A6"
                            autoFocus
                          />
                          <ScrollView style={{ maxHeight: 170 }} keyboardShouldPersistTaps="handled">
                            <TouchableOpacity
                              onPress={() => { setEditCategory(undefined); setShowEditCategoryPicker(false); }}
                              style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: "#f5f5f5", backgroundColor: editCategory === undefined ? "#e0f7fa" : "#fff" }}
                            >
                              <Text style={{ fontSize: 13, color: editCategory === undefined ? "#0a7ea4" : "#687076", fontWeight: editCategory === undefined ? "700" : "400" }}>None (no category)</Text>
                            </TouchableOpacity>
                            {sortedCategoriesForPicker
                              .filter((cat) => !editCategorySearch || cat.name.toLowerCase().includes(editCategorySearch.toLowerCase()))
                              .map((cat) => (
                                <TouchableOpacity
                                  key={cat.id}
                                  onPress={() => { setEditCategory(cat.id); setShowEditCategoryPicker(false); }}
                                  style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: "#f5f5f5", backgroundColor: editCategory === cat.id ? "#e0f7fa" : "#fff" }}
                                >
                                  <Text style={{ fontSize: 13, color: editCategory === cat.id ? "#0a7ea4" : "#11181C", fontWeight: editCategory === cat.id ? "700" : "400" }}>{cat.name}</Text>
                                </TouchableOpacity>
                              ))}
                          </ScrollView>
                        </View>
                      )}
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <TouchableOpacity
                          onPress={() => {
                            updateProductMut.mutate({
                              productId: product.id,
                              name: editName.trim(),
                              description: editDescription.trim(),
                              price: editPrice.trim(),
                              categoryId: editCategory ?? null,
                            });
                          }}
                          style={{ flex: 1, backgroundColor: "#0a7ea4", padding: 10, borderRadius: 8, alignItems: "center" }}
                        >
                          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>
                            {updateProductMut.isPending ? "Saving..." : "Save"}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setEditingId(null)}
                          style={{ flex: 1, backgroundColor: "#f5f5f5", padding: 10, borderRadius: 8, alignItems: "center" }}
                        >
                          <Text style={{ color: "#687076", fontWeight: "600", fontSize: 13 }}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    /* Display Mode */
                    <View style={{ padding: 14 }}>
                      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                        {/* Product Image Thumbnail */}
                        {imageUrl ? (
                          <RNImage
                            source={{ uri: imageUrl }}
                            style={{
                              width: 56,
                              height: 56,
                              borderRadius: 8,
                              marginRight: 12,
                              backgroundColor: "#f5f5f5",
                            }}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={{
                            width: 56,
                            height: 56,
                            borderRadius: 8,
                            marginRight: 12,
                            backgroundColor: "#f0f0f0",
                            alignItems: "center",
                            justifyContent: "center",
                          }}>
                            <Text style={{ fontSize: 24 }}>📦</Text>
                          </View>
                        )}

                        {/* Product Info */}
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={{ fontSize: 15, fontWeight: "700", color: "#11181C" }}>{product.name}</Text>
                          {product.description && (
                            <Text style={{ fontSize: 12, color: "#687076", marginTop: 2 }} numberOfLines={2}>{product.description}</Text>
                          )}
                          {product.categoryName && (
                            <View style={{ flexDirection: "row", marginTop: 4 }}>
                              <Text style={{ fontSize: 11, color: "#0a7ea4", backgroundColor: "#f0f9ff", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                                {product.categoryName}
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* Price */}
                        <Text style={{ fontSize: 18, fontWeight: "800", color: "#22C55E" }}>€{parseFloat(product.price).toFixed(2)}</Text>
                      </View>

                      {/* Action Row */}
                      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10, gap: 8 }}>
                        {/* Stock Toggle */}
                        <TouchableOpacity
                          onPress={() => {
                            const newStatus = product.stockStatus === "in_stock" ? "out_of_stock" : "in_stock";
                            toggleStockMut.mutate({ productId: product.id, stockStatus: newStatus });
                          }}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            borderRadius: 6,
                            backgroundColor: product.stockStatus === "in_stock" ? "#f0fdf4" : "#fef2f2",
                            borderWidth: 1,
                            borderColor: product.stockStatus === "in_stock" ? "#bbf7d0" : "#fecaca",
                          }}
                        >
                          <Text style={{
                            fontSize: 11,
                            fontWeight: "700",
                            color: product.stockStatus === "in_stock" ? "#22C55E" : "#EF4444",
                          }}>
                            {product.stockStatus === "in_stock" ? "✓ In Stock" : "✕ Out of Stock"}
                          </Text>
                        </TouchableOpacity>

                        {/* DRS Badge */}
                        {product.isDrs && (
                          <View style={{
                            paddingHorizontal: 8,
                            paddingVertical: 5,
                            borderRadius: 6,
                            backgroundColor: "#fef3c7",
                            borderWidth: 1,
                            borderColor: "#fcd34d",
                          }}>
                            <Text style={{ fontSize: 11, fontWeight: "700", color: "#b45309" }}>♻ DRS</Text>
                          </View>
                        )}

                        <View style={{ flex: 1 }} />

                        {/* Edit */}
                        <TouchableOpacity
                          onPress={() => startEdit(product)}
                          style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: "#f0f9ff" }}
                        >
                          <Text style={{ fontSize: 12, color: "#0a7ea4", fontWeight: "600" }}>Edit</Text>
                        </TouchableOpacity>

                        {/* Delete */}
                        <TouchableOpacity
                          onPress={() => {
                            if (webConfirm(`Delete "${product.name}"? This will hide it from customers.`)) {
                              deleteProductMut.mutate({ productId: product.id });
                            }
                          }}
                          style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: "#fef2f2" }}
                        >
                          <Text style={{ fontSize: 12, color: "#EF4444", fontWeight: "600" }}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
