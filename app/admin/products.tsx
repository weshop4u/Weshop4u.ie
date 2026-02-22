import { ScrollView, Text, View, TouchableOpacity, TextInput, Modal, StyleSheet, Platform, FlatList } from "react-native";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { useState, useMemo } from "react";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";

import { AdminDesktopLayout } from "@/components/admin-desktop-layout";

type StockStatus = "in_stock" | "out_of_stock" | "low_stock";

const STOCK_STATUS_OPTIONS: { value: StockStatus; label: string; color: string }[] = [
  { value: "in_stock", label: "In Stock", color: "#22C55E" },
  { value: "out_of_stock", label: "Out of Stock", color: "#EF4444" },
  { value: "low_stock", label: "Low Stock", color: "#F59E0B" },
];

function ProductsManagementScreenContent() {
  const router = useRouter();
  const colors = useColors();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStore, setSelectedStore] = useState<number | null>(null);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [pendingImageBase64, setPendingImageBase64] = useState<string | null>(null);
  const [filterMissingDesc, setFilterMissingDesc] = useState(false);
  const [filterDrs, setFilterDrs] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<number | "all">("all");
  const [showBulkDrs, setShowBulkDrs] = useState(false);
  const [selectedBulkIds, setSelectedBulkIds] = useState<Set<number>>(new Set());

  const { data: stores } = trpc.stores.getAll.useQuery();
  const { data: products, refetch } = trpc.stores.getProducts.useQuery(
    { storeId: selectedStore! },
    { enabled: !!selectedStore }
  );
  const { data: categories } = trpc.categories.getAll.useQuery();

  const updateMutation = trpc.stores.updateProduct.useMutation();
  const deleteMutation = trpc.stores.deleteProduct.useMutation();
  const bulkDrsMutation = trpc.stores.bulkToggleDrs.useMutation();
  const { data: drsSuggestions, refetch: refetchSuggestions } = trpc.stores.suggestDrs.useQuery(
    { storeId: selectedStore! },
    { enabled: !!selectedStore && showBulkDrs }
  );

  // Get unique categories from products for this store
  const storeCategories = useMemo(() => {
    if (!products) return [];
    const catMap = new Map<number, string>();
    products.forEach(p => {
      if (p.category?.id && p.category?.name) {
        catMap.set(p.category.id, p.category.name);
      }
    });
    return Array.from(catMap.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  // Count products missing descriptions
  const missingDescCount = useMemo(() => {
    if (!products) return 0;
    return products.filter(p => !p.description || p.description.trim() === "").length;
  }, [products]);

  // Count DRS products
  const drsCount = useMemo(() => {
    if (!products) return 0;
    return products.filter(p => p.isDrs).length;
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    let filtered = [...products];

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        (p.sku && p.sku.toLowerCase().includes(query))
      );
    }

    // Filter by missing description
    if (filterMissingDesc) {
      filtered = filtered.filter(p => !p.description || p.description.trim() === "");
    }

    // Filter by DRS
    if (filterDrs) {
      filtered = filtered.filter(p => p.isDrs);
    }

    // Filter by category
    if (selectedCategoryFilter !== "all") {
      filtered = filtered.filter(p => p.category?.id === selectedCategoryFilter);
    }

    return filtered;
  }, [products, searchQuery, filterMissingDesc, filterDrs, selectedCategoryFilter]);

  const handleEdit = (product: any) => {
    setEditingProduct({
      ...product,
      _stockStatus: product.stockStatus || "in_stock",
      _categoryId: product.category?.id || null,
    });
    setShowEditModal(true);
    setPendingImageBase64(null);
    setMessage("");
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        let base64Data = asset.base64;

        if (!base64Data && asset.uri && Platform.OS !== "web") {
          const fileData = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
          base64Data = fileData;
        }

        if (base64Data) {
          setPendingImageBase64(base64Data);
          setEditingProduct({ ...editingProduct, images: [asset.uri], _localPreview: true });
        } else {
          setEditingProduct({ ...editingProduct, images: [asset.uri], _localPreview: true });
        }
      }
    } catch (error: any) {
      setMessage(error.message || "Failed to pick image");
      setMessageType("error");
    }
  };

  const handleSave = async () => {
    if (!editingProduct) return;

    try {
      const payload: any = {
        id: editingProduct.id,
        name: editingProduct.name,
        description: editingProduct.description || "",
        price: editingProduct.price,
        quantity: editingProduct.quantity,
        sku: editingProduct.sku || "",
        stockStatus: editingProduct._stockStatus,
        categoryId: editingProduct._categoryId,
        isDrs: editingProduct.isDrs ?? false,
      };

      // Only send image if it was actually changed (new image picked)
      if (pendingImageBase64) {
        payload.image = `data:image/jpeg;base64,${pendingImageBase64}`;
      }

      await updateMutation.mutateAsync(payload);

      setMessage("Product updated successfully!");
      setMessageType("success");
      setShowEditModal(false);
      setEditingProduct(null);
      setPendingImageBase64(null);
      refetch();
    } catch (error: any) {
      setMessage(error.message || "Failed to update product");
      setMessageType("error");
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteMutation.mutateAsync({ id: deleteConfirmId });
      setMessage("Product deleted successfully!");
      setMessageType("success");
      setDeleteConfirmId(null);
      refetch();
    } catch (error: any) {
      setMessage(error.message || "Failed to delete product");
      setMessageType("error");
      setDeleteConfirmId(null);
    }
  };

  const getStockBadge = (status: string) => {
    const opt = STOCK_STATUS_OPTIONS.find(o => o.value === status);
    return opt || STOCK_STATUS_OPTIONS[0];
  };

  const renderProductItem = ({ item: product }: { item: any }) => {
    const hasDesc = product.description && product.description.trim() !== "";
    const stockBadge = getStockBadge(product.stockStatus);

    return (
      <View style={[itemStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={{ flexDirection: "row", gap: 12 }}>
          {product.images && product.images.length > 0 ? (
            <Image
              source={{ uri: Array.isArray(product.images) ? product.images[0] : product.images }}
              style={{ width: 60, height: 60, borderRadius: 8 }}
              contentFit="cover"
            />
          ) : (
            <View style={{ width: 60, height: 60, borderRadius: 8, backgroundColor: colors.border, justifyContent: "center", alignItems: "center" }}>
              <Text style={{ fontSize: 24 }}>📦</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14, flex: 1 }} numberOfLines={1}>{product.name}</Text>
              {!hasDesc && (
                <View style={{ backgroundColor: "#F59E0B20", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ color: "#F59E0B", fontSize: 10, fontWeight: "700" }}>NO DESC</Text>
                </View>
              )}
            </View>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
              {product.description || "No description"}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
              <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 14 }}>€{product.price}</Text>
              <View style={{ backgroundColor: stockBadge.color + "20", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ color: stockBadge.color, fontSize: 10, fontWeight: "700" }}>{stockBadge.label}</Text>
              </View>
              {product.sku && (
                <Text style={{ color: colors.muted, fontSize: 10 }}>SKU: {product.sku}</Text>
              )}
            </View>
              {product.category?.name && (
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>📁 {product.category.name}</Text>
            )}
            {product.isDrs && (
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
                <View style={{ backgroundColor: "#0EA5E920", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                  <Text style={{ color: "#0EA5E9", fontSize: 10, fontWeight: "700" }}>DRS</Text>
                </View>
              </View>
            )}
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
          <TouchableOpacity
            onPress={() => handleEdit(product)}
            style={[itemStyles.actionBtn, { backgroundColor: colors.primary + "15" }]}
          >
            <Text style={{ color: colors.primary, textAlign: "center", fontWeight: "600", fontSize: 13 }}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setDeleteConfirmId(product.id)}
            style={[itemStyles.actionBtn, { backgroundColor: "#EF444415" }]}
          >
            <Text style={{ color: "#EF4444", textAlign: "center", fontWeight: "600", fontSize: 13 }}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer className="bg-background">
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
        <TouchableOpacity onPress={() => router.back()} style={{ opacity: 1 }}>
          <Text style={{ color: colors.primary, fontSize: 22 }}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground }}>Manage Products</Text>
        <View style={{ width: 48 }} />
      </View>

      {!selectedStore ? (
        /* Store Selection */
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground, marginBottom: 4 }}>Select Store</Text>
          {stores?.map((store) => (
            <TouchableOpacity
              key={store.id}
              onPress={() => setSelectedStore(store.id)}
              style={[itemStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={{ fontWeight: "600", color: colors.foreground, fontSize: 16 }}>{store.name}</Text>
              <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>{(store as any).category || ""}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          {/* Store header + back to stores */}
          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
            <TouchableOpacity onPress={() => { setSelectedStore(null); setSearchQuery(""); setFilterMissingDesc(false); setFilterDrs(false); setSelectedCategoryFilter("all"); }}>
              <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "600" }}>‹ Change Store</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground, marginTop: 6 }}>
              {stores?.find(s => s.id === selectedStore)?.name} — {filteredProducts.length} products
            </Text>
          </View>

          {/* Message */}
          {message ? (
            <TouchableOpacity onPress={() => setMessage("")} style={{ marginHorizontal: 16, marginBottom: 8 }}>
              <View style={{ borderRadius: 12, padding: 12, backgroundColor: messageType === "error" ? "#EF444415" : "#22C55E15", borderWidth: 1, borderColor: messageType === "error" ? "#EF4444" : "#22C55E" }}>
                <Text style={{ color: messageType === "error" ? "#EF4444" : "#22C55E", fontSize: 13 }}>{message}</Text>
              </View>
            </TouchableOpacity>
          ) : null}

          {/* Search */}
          <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
            <TextInput
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, color: colors.foreground, fontSize: 14 }}
              placeholder="Search by name or SKU..."
              placeholderTextColor={colors.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="done"
            />
          </View>

          {/* Filters row */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 16, marginBottom: 8, minHeight: 40 }} contentContainerStyle={{ gap: 8, paddingVertical: 4, alignItems: "center" }}>
            {/* Missing desc filter */}
            <TouchableOpacity
              onPress={() => setFilterMissingDesc(!filterMissingDesc)}
              style={[itemStyles.filterPill, { backgroundColor: filterMissingDesc ? "#F59E0B" : colors.surface, borderColor: filterMissingDesc ? "#F59E0B" : colors.border }]}
            >
              <Text style={{ color: filterMissingDesc ? "#fff" : colors.foreground, fontSize: 12, fontWeight: "600" }}>
                ⚠️ No Desc ({missingDescCount})
              </Text>
            </TouchableOpacity>

            {/* DRS filter */}
            <TouchableOpacity
              onPress={() => setFilterDrs(!filterDrs)}
              style={[itemStyles.filterPill, { backgroundColor: filterDrs ? "#0EA5E9" : colors.surface, borderColor: filterDrs ? "#0EA5E9" : colors.border }]}
            >
              <Text style={{ color: filterDrs ? "#fff" : colors.foreground, fontSize: 12, fontWeight: "600" }}>
                ♻️ DRS ({drsCount})
              </Text>
            </TouchableOpacity>

            {/* Category filters */}
            <TouchableOpacity
              onPress={() => setSelectedCategoryFilter("all")}
              style={[itemStyles.filterPill, { backgroundColor: selectedCategoryFilter === "all" ? colors.primary : colors.surface, borderColor: selectedCategoryFilter === "all" ? colors.primary : colors.border }]}
            >
              <Text style={{ color: selectedCategoryFilter === "all" ? "#fff" : colors.foreground, fontSize: 12, fontWeight: "600" }}>All</Text>
            </TouchableOpacity>
            {storeCategories.map(cat => (
              <TouchableOpacity
                key={cat.id}
                onPress={() => setSelectedCategoryFilter(cat.id === selectedCategoryFilter ? "all" : cat.id)}
                style={[itemStyles.filterPill, { backgroundColor: selectedCategoryFilter === cat.id ? colors.primary : colors.surface, borderColor: selectedCategoryFilter === cat.id ? colors.primary : colors.border }]}
              >
                <Text style={{ color: selectedCategoryFilter === cat.id ? "#fff" : colors.foreground, fontSize: 12, fontWeight: "600" }} numberOfLines={1}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Bulk DRS Action Button */}
          <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
            <TouchableOpacity
              onPress={() => { setShowBulkDrs(true); setSelectedBulkIds(new Set()); }}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, backgroundColor: "#0EA5E915", borderWidth: 1, borderColor: "#0EA5E9", borderRadius: 10 }}
            >
              <Text style={{ color: "#0EA5E9", fontSize: 13, fontWeight: "700" }}>Bulk DRS Flag — Auto-Detect Drinks</Text>
            </TouchableOpacity>
          </View>

          {/* Products List */}
          <FlatList
            data={filteredProducts}
            renderItem={renderProductItem}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20, gap: 10 }}
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}

      {/* Delete Confirmation Overlay */}
      {deleteConfirmId !== null && (
        <View style={styles.overlay}>
          <View style={[styles.confirmBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground, marginBottom: 8 }}>Delete Product?</Text>
            <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 20 }}>
              Are you sure you want to delete this product? This action cannot be undone.
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                onPress={() => setDeleteConfirmId(null)}
                style={[styles.confirmButton, { backgroundColor: colors.border }]}
              >
                <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground, textAlign: "center" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmDelete}
                style={[styles.confirmButton, { backgroundColor: "#DC2626" }]}
              >
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff", textAlign: "center" }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Edit Modal */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24, maxHeight: "92%" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: "700", color: colors.foreground }}>Edit Product</Text>
              <TouchableOpacity onPress={() => { setShowEditModal(false); setEditingProduct(null); setPendingImageBase64(null); }}>
                <Text style={{ fontSize: 28, color: colors.muted }}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ gap: 16, paddingBottom: 20 }} showsVerticalScrollIndicator={true} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
              {/* Image */}
              {editingProduct?.images && editingProduct.images.length > 0 && (
                <View style={{ alignItems: "center" }}>
                  <Image
                    source={{ uri: Array.isArray(editingProduct.images) ? editingProduct.images[0] : editingProduct.images }}
                    style={{ width: 120, height: 120, borderRadius: 12 }}
                    contentFit="cover"
                  />
                  <TouchableOpacity
                    onPress={handlePickImage}
                    style={{ marginTop: 8, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.primary + "20", borderRadius: 8 }}
                  >
                    <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>Change Image</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Name */}
              <View>
                <Text style={[editStyles.label, { color: colors.foreground }]}>Name</Text>
                <TextInput
                  style={[editStyles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                  value={editingProduct?.name}
                  onChangeText={(text) => setEditingProduct({ ...editingProduct, name: text })}
                  returnKeyType="done"
                />
              </View>

              {/* Description */}
              <View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <Text style={[editStyles.label, { color: colors.foreground, marginBottom: 0 }]}>Description</Text>
                  {(!editingProduct?.description || editingProduct.description.trim() === "") && (
                    <View style={{ backgroundColor: "#F59E0B20", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                      <Text style={{ color: "#F59E0B", fontSize: 10, fontWeight: "700" }}>MISSING</Text>
                    </View>
                  )}
                </View>
                <TextInput
                  style={[editStyles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground, minHeight: 80, textAlignVertical: "top" }]}
                  value={editingProduct?.description || ""}
                  onChangeText={(text) => setEditingProduct({ ...editingProduct, description: text })}
                  multiline
                  numberOfLines={4}
                  placeholder="Enter product description..."
                  placeholderTextColor={colors.muted}
                />
              </View>

              {/* Price */}
              <View>
                <Text style={[editStyles.label, { color: colors.foreground }]}>Price (€)</Text>
                <TextInput
                  style={[editStyles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                  value={editingProduct?.price}
                  onChangeText={(text) => setEditingProduct({ ...editingProduct, price: text })}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                />
              </View>

              {/* SKU */}
              <View>
                <Text style={[editStyles.label, { color: colors.foreground }]}>SKU</Text>
                <TextInput
                  style={[editStyles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                  value={editingProduct?.sku || ""}
                  onChangeText={(text) => setEditingProduct({ ...editingProduct, sku: text })}
                  returnKeyType="done"
                />
              </View>

              {/* Stock Status */}
              <View>
                <Text style={[editStyles.label, { color: colors.foreground }]}>Stock Status</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {STOCK_STATUS_OPTIONS.map(opt => (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => setEditingProduct({ ...editingProduct, _stockStatus: opt.value })}
                      style={[
                        editStyles.stockPill,
                        {
                          backgroundColor: editingProduct?._stockStatus === opt.value ? opt.color : colors.surface,
                          borderColor: editingProduct?._stockStatus === opt.value ? opt.color : colors.border,
                        },
                      ]}
                    >
                      <Text style={{
                        color: editingProduct?._stockStatus === opt.value ? "#fff" : colors.foreground,
                        fontSize: 12,
                        fontWeight: "600",
                      }}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Stock Quantity */}
              <View>
                <Text style={[editStyles.label, { color: colors.foreground }]}>Stock Quantity</Text>
                <TextInput
                  style={[editStyles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                  value={editingProduct?.quantity?.toString() || "0"}
                  onChangeText={(text) => setEditingProduct({ ...editingProduct, quantity: parseInt(text) || 0 })}
                  keyboardType="number-pad"
                  returnKeyType="done"
                />
              </View>

              {/* Category */}
              <View>
                <Text style={[editStyles.label, { color: colors.foreground }]}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                  {categories?.map((cat: any) => (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => setEditingProduct({ ...editingProduct, _categoryId: cat.id })}
                      style={[
                        editStyles.stockPill,
                        {
                          backgroundColor: editingProduct?._categoryId === cat.id ? colors.primary : colors.surface,
                          borderColor: editingProduct?._categoryId === cat.id ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: editingProduct?._categoryId === cat.id ? "#fff" : colors.foreground,
                          fontSize: 12,
                          fontWeight: "600",
                        }}
                        numberOfLines={1}
                      >{cat.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              {/* DRS Toggle */}
              <View>
                <Text style={[editStyles.label, { color: colors.foreground }]}>DRS (Deposit Return Scheme)</Text>
                <TouchableOpacity
                  onPress={() => setEditingProduct({ ...editingProduct, isDrs: !editingProduct?.isDrs })}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    backgroundColor: editingProduct?.isDrs ? "#0EA5E915" : colors.surface,
                    borderWidth: 1,
                    borderColor: editingProduct?.isDrs ? "#0EA5E9" : colors.border,
                    borderRadius: 12,
                  }}
                >
                  <View style={{
                    width: 22,
                    height: 22,
                    borderRadius: 4,
                    borderWidth: 2,
                    borderColor: editingProduct?.isDrs ? "#0EA5E9" : colors.muted,
                    backgroundColor: editingProduct?.isDrs ? "#0EA5E9" : "transparent",
                    justifyContent: "center",
                    alignItems: "center",
                  }}>
                    {editingProduct?.isDrs && <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>✓</Text>}
                  </View>
                  <Text style={{ color: colors.foreground, fontSize: 13, flex: 1 }}>
                    {editingProduct?.isDrs ? "DRS deposit included in price" : "No DRS deposit on this product"}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            {/* Buttons */}
            <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
              <TouchableOpacity
                onPress={() => {
                  setShowEditModal(false);
                  setEditingProduct(null);
                  setPendingImageBase64(null);
                }}
                style={{ flex: 1, paddingVertical: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, alignItems: "center" }}
              >
                <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 15 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                style={{ flex: 1, paddingVertical: 14, backgroundColor: colors.primary, borderRadius: 12, alignItems: "center" }}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bulk DRS Modal */}
      <Modal visible={showBulkDrs} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, maxHeight: "85%" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground }}>Bulk DRS Flag</Text>
              <TouchableOpacity onPress={() => setShowBulkDrs(false)}>
                <Text style={{ fontSize: 28, color: colors.muted }}>×</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 12 }}>
              Auto-detected products likely needing DRS flag (cans, bottles, drinks with ml/ltr). Review and select which to flag.
            </Text>

            {drsSuggestions && drsSuggestions.length > 0 ? (
              <>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }}>
                    {drsSuggestions.length} suggestions — {selectedBulkIds.size} selected
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      if (selectedBulkIds.size === drsSuggestions.length) {
                        setSelectedBulkIds(new Set());
                      } else {
                        setSelectedBulkIds(new Set(drsSuggestions.map((p: any) => p.id)));
                      }
                    }}
                    style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: colors.primary + "15", borderRadius: 8 }}
                  >
                    <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>
                      {selectedBulkIds.size === drsSuggestions.length ? "Deselect All" : "Select All"}
                    </Text>
                  </TouchableOpacity>
                </View>

                <FlatList
                  data={drsSuggestions}
                  keyExtractor={(item: any) => String(item.id)}
                  style={{ maxHeight: 400 }}
                  contentContainerStyle={{ gap: 6 }}
                  renderItem={({ item }: { item: any }) => (
                    <TouchableOpacity
                      onPress={() => {
                        const newSet = new Set(selectedBulkIds);
                        if (newSet.has(item.id)) {
                          newSet.delete(item.id);
                        } else {
                          newSet.add(item.id);
                        }
                        setSelectedBulkIds(newSet);
                      }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        paddingVertical: 8,
                        paddingHorizontal: 10,
                        backgroundColor: selectedBulkIds.has(item.id) ? "#0EA5E910" : colors.surface,
                        borderWidth: 1,
                        borderColor: selectedBulkIds.has(item.id) ? "#0EA5E9" : colors.border,
                        borderRadius: 10,
                      }}
                    >
                      <View style={{
                        width: 20,
                        height: 20,
                        borderRadius: 4,
                        borderWidth: 2,
                        borderColor: selectedBulkIds.has(item.id) ? "#0EA5E9" : colors.muted,
                        backgroundColor: selectedBulkIds.has(item.id) ? "#0EA5E9" : "transparent",
                        justifyContent: "center",
                        alignItems: "center",
                      }}>
                        {selectedBulkIds.has(item.id) && <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>✓</Text>}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "500" }} numberOfLines={1}>{item.name}</Text>
                        <Text style={{ color: colors.muted, fontSize: 11 }}>{item.categoryName || "No category"} — €{parseFloat(item.price).toFixed(2)}</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                />

                <TouchableOpacity
                  onPress={async () => {
                    if (selectedBulkIds.size === 0) return;
                    try {
                      await bulkDrsMutation.mutateAsync({
                        productIds: Array.from(selectedBulkIds),
                        isDrs: true,
                      });
                      setMessage(`DRS flag set on ${selectedBulkIds.size} products!`);
                      setMessageType("success");
                      setShowBulkDrs(false);
                      setSelectedBulkIds(new Set());
                      refetch();
                      refetchSuggestions();
                    } catch (error: any) {
                      setMessage(error.message || "Failed to bulk update DRS");
                      setMessageType("error");
                    }
                  }}
                  style={{
                    marginTop: 14,
                    paddingVertical: 14,
                    backgroundColor: selectedBulkIds.size > 0 ? "#0EA5E9" : colors.border,
                    borderRadius: 12,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
                    {bulkDrsMutation.isPending ? "Applying..." : `Flag ${selectedBulkIds.size} Products as DRS`}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={{ alignItems: "center", paddingVertical: 30 }}>
                <Text style={{ fontSize: 14, color: colors.muted, textAlign: "center" }}>
                  {drsSuggestions ? "No unflagged DRS candidates found.\nAll likely products may already be flagged." : "Loading suggestions..."}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const itemStyles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
});

const editStyles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
  },
  stockPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
});

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  confirmBox: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 32,
    width: "85%",
    maxWidth: 360,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
  },
});

export default function ProductsManagementScreen() {
  return (
    <AdminDesktopLayout title="Manage Products">
      <ProductsManagementScreenContent />
    </AdminDesktopLayout>
  );
}
