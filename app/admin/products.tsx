import { Text, View, TouchableOpacity, FlatList, TextInput, ScrollView, Modal, StyleSheet, Platform, useWindowDimensions, ActivityIndicator, Alert } from "react-native";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useQueryClient } from "@tanstack/react-query";

import { AdminDesktopLayout } from "@/components/admin-desktop-layout";

const IS_WEB = Platform.OS === "web";
const PAGE_SIZE = 100;

type StockStatus = "in_stock" | "out_of_stock" | "low_stock";

const STOCK_STATUS_OPTIONS: { value: StockStatus; label: string; color: string }[] = [
  { value: "in_stock", label: "In Stock", color: "#22C55E" },
  { value: "out_of_stock", label: "Out of Stock", color: "#EF4444" },
  { value: "low_stock", label: "Low Stock", color: "#F59E0B" },
];

function ProductsManagementScreenContent() {
  const router = useRouter();
  const colors = useColors();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedStore, setSelectedStore] = useState<number | null>(null);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [pendingImageBase64, setPendingImageBase64] = useState<string | null>(null);
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | "no_desc" | "no_image" | "drs" | "out_of_stock">("all");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<number | "all">("all");
  const [showBulkDrs, setShowBulkDrs] = useState(false);
  const [selectedBulkIds, setSelectedBulkIds] = useState<Set<number>>(new Set());
  const [selectedStockIds, setSelectedStockIds] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [page, setPage] = useState(0);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateTargetStoreIds, setDuplicateTargetStoreIds] = useState<number[]>([]);
  const [categorySearch, setCategorySearch] = useState("");
  const [pvFilter, setPvFilter] = useState<"all" | "verified" | "unverified">("all"); // PV filter state
  const [wssFilter, setWssFilter] = useState<"all" | "wss" | "non_wss">("all"); // WSS filter state
  const [editingModifier, setEditingModifier] = useState<any>(null);
  const [showModifierEditor, setShowModifierEditor] = useState(false);
  const [modifierSelections, setModifierSelections] = useState<Map<number, number[]>>(new Map());

  // Add product form state
  const [addForm, setAddForm] = useState({
    name: "",
    description: "",
    price: "",
    categoryId: null as number | null,
    stockStatus: "in_stock" as StockStatus,
    isDrs: false,
    pinnedToTrending: false,
    storeIds: [] as number[],
  });
  const [addImageBase64, setAddImageBase64] = useState<string | null>(null);
  const [addImageUri, setAddImageUri] = useState<string | null>(null);
  const [addCategorySearch, setAddCategorySearch] = useState("");

  // Debounce search
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(0);
    }, 300);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [searchQuery]);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [activeFilter, selectedCategoryFilter]);

  const { data: stores } = trpc.stores.getAll.useQuery();
  const { data: productsData, refetch, isLoading: productsLoading } = trpc.stores.getProducts.useQuery(
    {
      storeId: selectedStore!,
      search: debouncedSearch || undefined,
      filter: activeFilter !== "all" ? activeFilter : undefined,
      categoryId: selectedCategoryFilter !== "all" ? selectedCategoryFilter : undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    },
    { enabled: !!selectedStore }
  );
  const { data: categories } = trpc.categories.getAll.useQuery();

  const updateMutation = trpc.stores.updateProduct.useMutation();
  const togglePvMutation = trpc.stores.togglePriceVerified.useMutation();
  const deleteMutation = trpc.stores.deleteProduct.useMutation();
  const bulkDrsMutation = trpc.stores.bulkToggleDrs.useMutation();
  const bulkStockMutation = trpc.stores.bulkUpdateStock.useMutation();
  const uploadImageMutation = trpc.stores.uploadProductImage.useMutation();
  const addProductMutation = trpc.stores.addProduct.useMutation();
  const duplicateProductMutation = trpc.stores.duplicateProduct.useMutation();
  const { data: drsSuggestions, refetch: refetchSuggestions } = trpc.stores.suggestDrs.useQuery(
    { storeId: selectedStore! },
    { enabled: !!selectedStore && showBulkDrs }
  );

  // Active stores for multi-select
  const activeStores = useMemo(() => {
    return stores?.filter(s => s.isActive) || [];
  }, [stores]);

  // Extract data from new API shape
  const products = productsData?.items || [];
  const totalProducts = productsData?.total || 0;
  const storeCategories = useMemo(() => {
    return (productsData?.categories || [])
      .filter((c: any) => c.id != null)
      .sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
  }, [productsData]);
  const missingDescCount = productsData?.counts?.noDesc || 0;
  const missingImageCount = productsData?.counts?.noImage || 0;
  const drsCount = productsData?.counts?.drs || 0;
  const outOfStockCount = productsData?.counts?.outOfStock || 0;
  const verifiedCount = useMemo(() => products.filter((p: any) => p.priceVerified).length, [products]);
  const unverifiedCount = useMemo(() => products.filter((p: any) => !p.priceVerified).length, [products]);

  const totalPages = Math.ceil(totalProducts / PAGE_SIZE);

  // Filtered categories for edit modal search
  const filteredCategories = useMemo(() => {
    const allCats = categories || [];
    if (!categorySearch.trim()) return allCats;
    const q = categorySearch.toLowerCase();
    return allCats.filter((c: any) => c.name?.toLowerCase().includes(q));
  }, [categories, categorySearch]);

  // Get current store name for edit modal
  const currentStoreName = useMemo(() => {
    if (!editingProduct?.storeId) return stores?.find(s => s.id === selectedStore)?.name || "";
    return stores?.find(s => s.id === editingProduct.storeId)?.name || "";
  }, [editingProduct, stores, selectedStore]);

  // Other stores for duplication (exclude current)
  const otherStores = useMemo(() => {
    const currentStoreId = editingProduct?.storeId || selectedStore;
    return activeStores.filter(s => s.id !== currentStoreId);
  }, [activeStores, editingProduct, selectedStore]);

  const handleDuplicate = async () => {
    if (!editingProduct || duplicateTargetStoreIds.length === 0 || isSaving) return;
    setIsSaving(true);
    try {
      const result = await duplicateProductMutation.mutateAsync({
        productId: editingProduct.id,
        targetStoreIds: duplicateTargetStoreIds,
      });
      setMessage(`Product duplicated to ${result.count} store${result.count > 1 ? "s" : ""}!`);
      setMessageType("success");
      setShowDuplicateModal(false);
      setDuplicateTargetStoreIds([]);
    } catch (error: any) {
      setMessage(error.message || "Failed to duplicate product");
      setMessageType("error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (product: any) => {
    setEditingProduct({
      ...product,
      _stockStatus: product.stockStatus || "in_stock",
      _categoryId: product.category?.id || null,
    });
    setShowEditModal(true);
    setPendingImageBase64(null);
    setPendingImageUri(null);
    setMessage("");
  };

  const handlePickImage = async (mode: "edit" | "add") => {
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

        if (mode === "edit") {
          if (base64Data) {
            setPendingImageBase64(base64Data);
            setPendingImageUri(asset.uri);
          }
        } else {
          if (base64Data) {
            setAddImageBase64(base64Data);
            setAddImageUri(asset.uri);
          }
        }
      }
    } catch (error: any) {
      setMessage(error.message || "Failed to pick image");
      setMessageType("error");
    }
  };

  const handleSave = async () => {
    if (!editingProduct || isSaving) return;
    setIsSaving(true);

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
        pinnedToTrending: editingProduct.pinnedToTrending ?? false,
      };

      if (pendingImageBase64) {
        payload.image = `data:image/jpeg;base64,${pendingImageBase64}`;
      }

      await updateMutation.mutateAsync(payload);

      setMessage("Product updated successfully!");
      setMessageType("success");
      setShowEditModal(false);
      setEditingProduct(null);
      setPendingImageBase64(null);
      setPendingImageUri(null);
      refetch();
    } catch (error: any) {
      setMessage(error.message || "Failed to update product");
      setMessageType("error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddProduct = async () => {
    if (!addForm.name.trim() || !addForm.price.trim() || isSaving) return;
    if (addForm.storeIds.length === 0) {
      setMessage("Please select at least one store");
      setMessageType("error");
      return;
    }
    setIsSaving(true);

    try {
      let imageUrl: string | undefined;
      if (addImageBase64) {
        const uploadResult = await uploadImageMutation.mutateAsync({
          base64: addImageBase64,
          mimeType: "image/jpeg",
        });
        imageUrl = uploadResult.url;
      }

      await addProductMutation.mutateAsync({
        storeIds: addForm.storeIds,
        name: addForm.name.trim(),
        description: addForm.description.trim() || undefined,
        price: addForm.price.trim(),
        categoryId: addForm.categoryId || undefined,
        stockStatus: addForm.stockStatus,
         isDrs: addForm.isDrs,
        pinnedToTrending: addForm.pinnedToTrending,
        imageUrl,
      });
      const storeCount = addForm.storeIds.length;
      setMessage(`Product added to ${storeCount} store${storeCount > 1 ? "s" : ""} successfully!`);
      setMessageType("success");
      setShowAddModal(false);
      resetAddForm();
      refetch();
    } catch (error: any) {
      setMessage(error.message || "Failed to add product");
      setMessageType("error");
    } finally {
      setIsSaving(false);
    }
  };

  const resetAddForm = () => {
    setAddForm({
      name: "",
      description: "",
      price: "",
      categoryId: null,
      stockStatus: "in_stock",
      isDrs: false,
      pinnedToTrending: false,
      storeIds: selectedStore ? [selectedStore] : [],
    });
    setAddImageBase64(null);
    setAddImageUri(null);
    setAddCategorySearch("");
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

  const { width: windowWidth } = useWindowDimensions();
  const isDesktopTable = IS_WEB && windowWidth >= 1000;

  const getStockBadge = (status: string) => {
    const opt = STOCK_STATUS_OPTIONS.find(o => o.value === status);
    return opt || STOCK_STATUS_OPTIONS[0];
  };

  const getProductImageUri = (product: any) => {
    if (!product.images || product.images.length === 0) return null;
    const img = Array.isArray(product.images) ? product.images[0] : product.images;
    return img || null;
  };

  const handleQuickMarkInStock = (productId: number, targetStatus: "in_stock" | "out_of_stock" = "in_stock") => {
    const label = targetStatus === "in_stock" ? "In Stock" : "Out of Stock";
    if (Platform.OS === "web") {
      const confirmed = window.confirm(`Mark this product as ${label}?`);
      if (!confirmed) return;
      doToggleStock(productId, targetStatus);
    } else {
      Alert.alert(
        "Update Stock Status",
        `Mark this product as ${label}?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Yes", onPress: () => doToggleStock(productId, targetStatus) },
        ]
      );
    }
  };

  const doToggleStock = async (productId: number, targetStatus: "in_stock" | "out_of_stock") => {
    try {
      await bulkStockMutation.mutateAsync({ productIds: [productId], stockStatus: targetStatus });
      setMessage(targetStatus === "in_stock" ? "Product marked as In Stock!" : "Product marked as Out of Stock!");
      setMessageType("success");
      refetch();
    } catch (err) {
      setMessage("Failed to update stock status");
      setMessageType("error");
    }
  };

  const handleBulkMarkInStock = async () => {
    if (selectedStockIds.size === 0) return;
    try {
      await bulkStockMutation.mutateAsync({ productIds: Array.from(selectedStockIds), stockStatus: "in_stock" });
      setMessage(`${selectedStockIds.size} products marked as In Stock!`);
      setMessageType("success");
      setSelectedStockIds(new Set());
      refetch();
    } catch (err) {
      setMessage("Failed to update stock status");
      setMessageType("error");
    }
  };

  const renderProductItem = ({ item: product }: { item: any }) => {
    const hasDesc = product.description && product.description.trim() !== "";
    const stockBadge = getStockBadge(product.stockStatus);
    const imageUri = getProductImageUri(product);

    return (
      <View style={[itemStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={{ flexDirection: "row", gap: 12 }}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={{ width: 60, height: 60, borderRadius: 8 }}
              contentFit="cover"
            />
          ) : (
            <TouchableOpacity
              onPress={() => handleEdit(product)}
              style={{ width: 60, height: 60, borderRadius: 8, backgroundColor: colors.border, justifyContent: "center", alignItems: "center" }}
            >
              <Text style={{ fontSize: 18 }}>📷</Text>
              <Text style={{ fontSize: 8, color: colors.muted, marginTop: 2 }}>Add</Text>
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14, flex: 1 }} numberOfLines={1}>{product.name}</Text>
              {!hasDesc && (
                <View style={{ backgroundColor: "#F59E0B20", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ color: "#F59E0B", fontSize: 10, fontWeight: "700" }}>NO DESC</Text>
                </View>
              )}
              {!imageUri && (
                <View style={{ backgroundColor: "#8B5CF620", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ color: "#8B5CF6", fontSize: 10, fontWeight: "700" }}>NO IMG</Text>
                </View>
              )}
            </View>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
              {product.description || "No description"}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
              <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 14 }}>€{product.price}</Text>
              <TouchableOpacity
                onPress={() => handleQuickMarkInStock(product.id, product.stockStatus === "out_of_stock" ? "in_stock" : "out_of_stock")}
                style={{ backgroundColor: stockBadge.color + "20", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: stockBadge.color + "40" }}
              >
                <Text style={{ color: stockBadge.color, fontSize: 10, fontWeight: "700" }}>{stockBadge.label} ↻</Text>
              </TouchableOpacity>
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
            {product.pinnedToTrending && (
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
                <View style={{ backgroundColor: "#F59E0B20", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                  <Text style={{ color: "#F59E0B", fontSize: 10, fontWeight: "700" }}>★ PINNED</Text>
                </View>
              </View>
            )}
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
          {activeFilter === "out_of_stock" && (
            <TouchableOpacity
              onPress={() => {
                const newSet = new Set(selectedStockIds);
                if (newSet.has(product.id)) newSet.delete(product.id);
                else newSet.add(product.id);
                setSelectedStockIds(newSet);
              }}
              style={[itemStyles.actionBtn, { backgroundColor: selectedStockIds.has(product.id) ? "#22C55E20" : colors.surface, borderWidth: 1, borderColor: selectedStockIds.has(product.id) ? "#22C55E" : colors.border }]}
            >
              <Text style={{ color: selectedStockIds.has(product.id) ? "#22C55E" : colors.foreground, textAlign: "center", fontWeight: "600", fontSize: 13 }}>{selectedStockIds.has(product.id) ? "✓ Selected" : "Select"}</Text>
            </TouchableOpacity>
          )}
          {activeFilter === "out_of_stock" && (
            <TouchableOpacity
              onPress={() => handleQuickMarkInStock(product.id)}
              style={[itemStyles.actionBtn, { backgroundColor: "#22C55E" }]}
            >
              <Text style={{ color: "#fff", textAlign: "center", fontWeight: "600", fontSize: 13 }}>Mark In Stock</Text>
            </TouchableOpacity>
          )}
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

  // Pagination controls
  const PaginationBar = () => {
    if (totalPages <= 1) return null;
    return (
      <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 16 }}>
        <TouchableOpacity
          disabled={page === 0}
          onPress={() => setPage(Math.max(0, page - 1))}
          style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: page === 0 ? colors.border : colors.primary, borderRadius: 8 }}
        >
          <Text style={{ color: page === 0 ? colors.muted : "#fff", fontWeight: "600", fontSize: 13 }}>← Prev</Text>
        </TouchableOpacity>
        <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>
          Page {page + 1} of {totalPages} ({totalProducts} products)
        </Text>
        <TouchableOpacity
          disabled={page >= totalPages - 1}
          onPress={() => setPage(Math.min(totalPages - 1, page + 1))}
          style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: page >= totalPages - 1 ? colors.border : colors.primary, borderRadius: 8 }}
        >
          <Text style={{ color: page >= totalPages - 1 ? colors.muted : "#fff", fontWeight: "600", fontSize: 13 }}>Next →</Text>
        </TouchableOpacity>
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
          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View>
              <TouchableOpacity onPress={() => { setSelectedStore(null); setSearchQuery(""); setDebouncedSearch(""); setActiveFilter("all"); setSelectedCategoryFilter("all"); setPage(0); }}>
                <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "600" }}>‹ Change Store</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground, marginTop: 6 }}>
                {stores?.find(s => s.id === selectedStore)?.name} — {totalProducts} products
              </Text>
            </View>
            {/* Add Product Button */}
            <TouchableOpacity
              onPress={() => {
                resetAddForm();
                setAddForm(prev => ({ ...prev, storeIds: [selectedStore] }));
                setShowAddModal(true);
              }}
              style={{ backgroundColor: "#22C55E", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, marginTop: 4 }}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>+ Add Product</Text>
            </TouchableOpacity>
          </View>

          {/* Message */}
          {message ? (
            <TouchableOpacity onPress={() => setMessage("")} style={{ marginHorizontal: 16, marginBottom: 8 }}>
              <View style={{ borderRadius: 12, padding: 12, backgroundColor: messageType === "error" ? "#EF444415" : "#22C55E15", borderWidth: 1, borderColor: messageType === "error" ? "#EF4444" : "#22C55E" }}>
                <Text style={{ color: messageType === "error" ? "#EF4444" : "#22C55E", fontSize: 13 }}>{message}</Text>
              </View>
            </TouchableOpacity>
          ) : null}

          {/* Desktop: single ScrollView for search + filters + table */}
          {isDesktopTable ? (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
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

              {/* Filters row - wrapping on desktop */}
              <View style={{ paddingHorizontal: 16, marginBottom: 8, flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                {/* Missing desc filter */}
                <TouchableOpacity
                  onPress={() => setActiveFilter(activeFilter === "no_desc" ? "all" : "no_desc")}
                  style={[itemStyles.filterPill, { backgroundColor: activeFilter === "no_desc" ? "#F59E0B" : colors.surface, borderColor: activeFilter === "no_desc" ? "#F59E0B" : colors.border }]}
                >
                  <Text style={{ color: activeFilter === "no_desc" ? "#fff" : colors.foreground, fontSize: 12, fontWeight: "600" }}>
                    No Desc ({missingDescCount})
                  </Text>
                </TouchableOpacity>

                {/* Missing image filter */}
                <TouchableOpacity
                  onPress={() => setActiveFilter(activeFilter === "no_image" ? "all" : "no_image")}
                  style={[itemStyles.filterPill, { backgroundColor: activeFilter === "no_image" ? "#8B5CF6" : colors.surface, borderColor: activeFilter === "no_image" ? "#8B5CF6" : colors.border }]}
                >
                  <Text style={{ color: activeFilter === "no_image" ? "#fff" : colors.foreground, fontSize: 12, fontWeight: "600" }}>
                    No Image ({missingImageCount})
                  </Text>
                </TouchableOpacity>

                {/* DRS filter */}
                <TouchableOpacity
                  onPress={() => setActiveFilter(activeFilter === "drs" ? "all" : "drs")}
                  style={[itemStyles.filterPill, { backgroundColor: activeFilter === "drs" ? "#0EA5E9" : colors.surface, borderColor: activeFilter === "drs" ? "#0EA5E9" : colors.border }]}
                >
                  <Text style={{ color: activeFilter === "drs" ? "#fff" : colors.foreground, fontSize: 12, fontWeight: "600" }}>
                    DRS ({drsCount})
                  </Text>
                </TouchableOpacity>

                {/* Out of Stock filter */}
                <TouchableOpacity
                  onPress={() => setActiveFilter(activeFilter === "out_of_stock" ? "all" : "out_of_stock")}
                  style={[itemStyles.filterPill, { backgroundColor: activeFilter === "out_of_stock" ? "#EF4444" : colors.surface, borderColor: activeFilter === "out_of_stock" ? "#EF4444" : colors.border }]}
                >
                  <Text style={{ color: activeFilter === "out_of_stock" ? "#fff" : colors.foreground, fontSize: 12, fontWeight: "600" }}>
                    Out of Stock ({outOfStockCount})
                  </Text>
                </TouchableOpacity>

                {/* Price Verified filter */}
                <TouchableOpacity
                  onPress={() => setPvFilter(pvFilter === "verified" ? "all" : "verified")}
                  style={[itemStyles.filterPill, { backgroundColor: pvFilter === "verified" ? "#22C55E" : colors.surface, borderColor: pvFilter === "verified" ? "#22C55E" : colors.border }]}
                >
                  <Text style={{ color: pvFilter === "verified" ? "#fff" : colors.foreground, fontSize: 12, fontWeight: "600" }}>
                    PV ✓ ({verifiedCount})
                  </Text>
                </TouchableOpacity>

                {/* Price Unverified filter */}
                <TouchableOpacity
                  onPress={() => setPvFilter(pvFilter === "unverified" ? "all" : "unverified")}
                  style={[itemStyles.filterPill, { backgroundColor: pvFilter === "unverified" ? "#EF4444" : colors.surface, borderColor: pvFilter === "unverified" ? "#EF4444" : colors.border }]}
                >
                  <Text style={{ color: pvFilter === "unverified" ? "#fff" : colors.foreground, fontSize: 12, fontWeight: "600" }}>
                    PV ✗ ({unverifiedCount})
                  </Text>
                </TouchableOpacity>

                {/* Category filters */}
                <TouchableOpacity
                  onPress={() => setSelectedCategoryFilter("all")}
                  style={[itemStyles.filterPill, { backgroundColor: selectedCategoryFilter === "all" ? colors.primary : colors.surface, borderColor: selectedCategoryFilter === "all" ? colors.primary : colors.border }]}
                >
                  <Text style={{ color: selectedCategoryFilter === "all" ? "#fff" : colors.foreground, fontSize: 12, fontWeight: "600" }}>All</Text>
                </TouchableOpacity>
                {storeCategories.map((cat: any) => (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setSelectedCategoryFilter(cat.id === selectedCategoryFilter ? "all" : cat.id)}
                    style={[itemStyles.filterPill, { backgroundColor: selectedCategoryFilter === cat.id ? colors.primary : colors.surface, borderColor: selectedCategoryFilter === cat.id ? colors.primary : colors.border }]}
                  >
                    <Text style={{ color: selectedCategoryFilter === cat.id ? "#fff" : colors.foreground, fontSize: 12, fontWeight: "600" }} numberOfLines={1}>{cat.name} ({cat.count})</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Bulk DRS Action Button */}
              <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
                <TouchableOpacity
                  onPress={() => { setShowBulkDrs(true); setSelectedBulkIds(new Set()); }}
                  style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, backgroundColor: "#0EA5E915", borderWidth: 1, borderColor: "#0EA5E9", borderRadius: 10 }}
                >
                  <Text style={{ color: "#0EA5E9", fontSize: 13, fontWeight: "700" }}>Bulk DRS Flag — Auto-Detect Drinks</Text>
                </TouchableOpacity>
              </View>

              {/* Bulk Mark In Stock bar - shown when Out of Stock filter is active */}
              {activeFilter === "out_of_stock" && !productsLoading && products.length > 0 && (
                <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: "#22C55E10", borderWidth: 1, borderColor: "#22C55E", borderRadius: 10 }}>
                    <TouchableOpacity
                      onPress={() => {
                        if (selectedStockIds.size === products.length) {
                          setSelectedStockIds(new Set());
                        } else {
                          setSelectedStockIds(new Set(products.map((p: any) => p.id)));
                        }
                      }}
                      style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: selectedStockIds.size === products.length ? "#22C55E" : colors.surface, borderRadius: 6, borderWidth: 1, borderColor: "#22C55E" }}
                    >
                      <Text style={{ color: selectedStockIds.size === products.length ? "#fff" : "#22C55E", fontSize: 12, fontWeight: "700" }}>{selectedStockIds.size === products.length ? "Deselect All" : "Select All"}</Text>
                    </TouchableOpacity>
                    <Text style={{ color: "#22C55E", fontSize: 13, fontWeight: "600", flex: 1 }}>{selectedStockIds.size} selected</Text>
                    <TouchableOpacity
                      onPress={handleBulkMarkInStock}
                      style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: selectedStockIds.size > 0 ? "#22C55E" : colors.border, borderRadius: 8 }}
                    >
                      <Text style={{ color: selectedStockIds.size > 0 ? "#fff" : colors.muted, fontSize: 13, fontWeight: "700" }}>{bulkStockMutation.isPending ? "Updating..." : `Mark ${selectedStockIds.size} In Stock`}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Loading */}
              {productsLoading && (
                <View style={{ alignItems: "center", paddingVertical: 40 }}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={{ color: colors.muted, marginTop: 8, fontSize: 13 }}>Loading products...</Text>
                </View>
              )}

              {/* Desktop Table */}
              {!productsLoading && (
              <View style={{ paddingHorizontal: 16 }}>
              <PaginationBar />
              {/* Desktop Table Header */}
              <View style={tableStyles.headerRow}>
                <Text style={[tableStyles.headerCell, { width: 50 }]}>#</Text>
                <Text style={[tableStyles.headerCell, { width: 60 }]}>Image</Text>
                <Text style={[tableStyles.headerCell, { flex: 2, minWidth: 200 }]}>Product Name</Text>
                <Text style={[tableStyles.headerCell, { width: 100 }]}>Price</Text>
                <Text style={[tableStyles.headerCell, { width: 100 }]}>Stock</Text>
                <Text style={[tableStyles.headerCell, { flex: 1, minWidth: 120 }]}>Category</Text>
                <Text style={[tableStyles.headerCell, { width: 70 }]}>SKU</Text>
                <Text style={[tableStyles.headerCell, { width: 50 }]}>DRS</Text>
                <Text style={[tableStyles.headerCell, { width: 50 }]}>PIN</Text>
                <Text style={[tableStyles.headerCell, { width: 50 }]}>PV</Text>
                <Text style={[tableStyles.headerCell, { width: 50 }]}>WSS</Text>
                <Text style={[tableStyles.headerCell, { width: 140 }]}>Actions</Text>
              </View>
              {/* Desktop Table Rows */}
              {products.filter((product: any) => {
                if (pvFilter === "verified") return product.priceVerified;
                if (pvFilter === "unverified") return !product.priceVerified;
                return true;
              }).map((product: any, idx: number) => {
                const stockBadge = getStockBadge(product.stockStatus);
                const hasDesc = product.description && product.description.trim() !== "";
                const imageUri = getProductImageUri(product);
                return (
                  <View key={product.id} style={[tableStyles.row, idx % 2 === 0 ? tableStyles.rowEven : tableStyles.rowOdd]}>
                    <Text style={[tableStyles.cell, { width: 50, color: colors.muted }]}>{page * PAGE_SIZE + idx + 1}</Text>
                    <View style={[tableStyles.cell, { width: 60 }]}>
                      {imageUri ? (
                        <Image
                          source={{ uri: imageUri }}
                          style={{ width: 40, height: 40, borderRadius: 6 }}
                          contentFit="cover"
                        />
                      ) : (
                        <TouchableOpacity
                          onPress={() => handleEdit(product)}
                          style={{ width: 40, height: 40, borderRadius: 6, backgroundColor: colors.border, justifyContent: "center", alignItems: "center" }}
                        >
                          <Text style={{ fontSize: 14 }}>📷</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <View style={[tableStyles.cell, { flex: 2, minWidth: 200 }]}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 13 }} numberOfLines={1}>{product.name}</Text>
                        {!hasDesc && (
                          <View style={{ backgroundColor: "#F59E0B20", paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3 }}>
                            <Text style={{ color: "#F59E0B", fontSize: 9, fontWeight: "700" }}>NO DESC</Text>
                          </View>
                        )}
                        {!imageUri && (
                          <View style={{ backgroundColor: "#8B5CF620", paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3 }}>
                            <Text style={{ color: "#8B5CF6", fontSize: 9, fontWeight: "700" }}>NO IMG</Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }} numberOfLines={1}>{product.description || "No description"}</Text>
                    </View>
                    <Text style={[tableStyles.cell, { width: 100, color: colors.primary, fontWeight: "700", fontSize: 14 }]}>€{product.price}</Text>
                    <View style={[tableStyles.cell, { width: 100 }]}>
                      <TouchableOpacity
                        onPress={() => handleQuickMarkInStock(product.id, product.stockStatus === "out_of_stock" ? "in_stock" : "out_of_stock")}
                        style={{ backgroundColor: stockBadge.color + "20", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: "flex-start", borderWidth: 1, borderColor: stockBadge.color + "40" }}
                      >
                        <Text style={{ color: stockBadge.color, fontSize: 11, fontWeight: "700" }}>{stockBadge.label} ↻</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={[tableStyles.cell, { flex: 1, minWidth: 120, color: colors.muted, fontSize: 12 }]} numberOfLines={1}>{product.category?.name || "—"}</Text>
                    <Text style={[tableStyles.cell, { width: 70, color: colors.muted, fontSize: 11 }]} numberOfLines={1}>{product.sku || "—"}</Text>
                    <View style={[tableStyles.cell, { width: 50 }]}>
                      {product.isDrs ? (
                        <View style={{ backgroundColor: "#0EA5E920", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                          <Text style={{ color: "#0EA5E9", fontSize: 10, fontWeight: "700" }}>DRS</Text>
                        </View>
                      ) : (
                        <Text style={{ color: colors.border, fontSize: 11 }}>—</Text>
                      )}
                    </View>
                    <View style={[tableStyles.cell, { width: 50 }]}>
                      {product.pinnedToTrending ? (
                        <View style={{ backgroundColor: "#F59E0B20", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                          <Text style={{ color: "#F59E0B", fontSize: 10, fontWeight: "700" }}>★</Text>
                        </View>
                      ) : (
                        <Text style={{ color: colors.border, fontSize: 11 }}>—</Text>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        const newVerifiedStatus = !product.priceVerified;
                        queryClient.setQueryData(
                          ['stores', 'getProducts'],
                          (oldData: any) => {
                            if (!oldData) return oldData;
                            return {
                              ...oldData,
                              items: oldData.items.map((p: any) =>
                                p.id === product.id ? { ...p, priceVerified: newVerifiedStatus } : p
                              ),
                            };
                          }
                        );
                        togglePvMutation.mutate({ productId: product.id }, {
                          onSuccess: () => {
                          },
                          onError: (err) => {
                            queryClient.setQueryData(
                              ['stores', 'getProducts'],
                              (oldData: any) => {
                                if (!oldData) return oldData;
                                return {
                                  ...oldData,
                                  items: oldData.items.map((p: any) =>
                                    p.id === product.id ? { ...p, priceVerified: product.priceVerified } : p
                                  ),
                                };
                              }
                            );
                          },
                        });
                      }}
                      style={[tableStyles.cell, { width: 50, justifyContent: "center", alignItems: "center" }]}
                    >
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          borderWidth: 2,
                          borderColor: product.priceVerified ? "#22C55E" : "#EF4444",
                          backgroundColor: product.priceVerified ? "#22C55E20" : "#EF444420",
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <Text style={{ color: product.priceVerified ? "#22C55E" : "#EF4444", fontSize: 14, fontWeight: "700" }}>
                          {product.priceVerified ? "✓" : "✗"}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        const newWssStatus = !product.isWss;
                        queryClient.setQueryData(
                          ['stores', 'getProducts'],
                          (oldData: any) => {
                            if (!oldData) return oldData;
                            return {
                              ...oldData,
                              items: oldData.items.map((p: any) =>
                                p.id === product.id ? { ...p, isWss: newWssStatus } : p
                              ),
                            };
                          }
                        );
                        trpc.stores.toggleWss.useMutation().mutate({ productId: product.id, isWss: newWssStatus }, {
                          onError: (err) => {
                            queryClient.setQueryData(
                              ['stores', 'getProducts'],
                              (oldData: any) => {
                                if (!oldData) return oldData;
                                return {
                                  ...oldData,
                                  items: oldData.items.map((p: any) =>
                                    p.id === product.id ? { ...p, isWss: product.isWss } : p
                                  ),
                                };
                              }
                            );
                          },
                        });
                      }}
                      style={[tableStyles.cell, { width: 50, justifyContent: "center", alignItems: "center" }]}
                    >
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          borderWidth: 2,
                          borderColor: product.isWss ? "#8B5CF6" : "#EF4444",
                          backgroundColor: product.isWss ? "#8B5CF620" : "#EF444420",
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <Text style={{ color: product.isWss ? "#8B5CF6" : "✗", fontSize: 14, fontWeight: "700" }}>
                          {product.isWss ? "✓" : "✗"}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <View style={[tableStyles.cell, { width: activeFilter === "out_of_stock" ? 260 : 140, flexDirection: "row", gap: 6 }]}>
                      {activeFilter === "out_of_stock" && (
                        <TouchableOpacity
                          onPress={() => {
                            const newSet = new Set(selectedStockIds);
                            if (newSet.has(product.id)) newSet.delete(product.id);
                            else newSet.add(product.id);
                            setSelectedStockIds(newSet);
                          }}
                          style={{ width: 28, height: 28, borderRadius: 6, borderWidth: 2, borderColor: selectedStockIds.has(product.id) ? "#22C55E" : colors.muted, backgroundColor: selectedStockIds.has(product.id) ? "#22C55E" : "transparent", justifyContent: "center", alignItems: "center" }}
                        >
                          {selectedStockIds.has(product.id) && <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>✓</Text>}
                        </TouchableOpacity>
                      )}
                      {activeFilter === "out_of_stock" && (
                        <TouchableOpacity
                          onPress={() => handleQuickMarkInStock(product.id)}
                          style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#22C55E", borderRadius: 6 }}
                        >
                          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 11 }}>In Stock</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        onPress={() => handleEdit(product)}
                        style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.primary + "15", borderRadius: 6 }}
                      >
                        <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 12 }}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setDeleteConfirmId(product.id)}
                        style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#EF444415", borderRadius: 6 }}
                      >
                        <Text style={{ color: "#EF4444", fontWeight: "600", fontSize: 12 }}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
              {/* Pagination bottom */}
              <PaginationBar />
              </View>
              )}
            </ScrollView>
          ) : (
            /* Mobile layout */
            <View style={{ flex: 1 }}>
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
                <TouchableOpacity
                  onPress={() => setActiveFilter(activeFilter === "no_desc" ? "all" : "no_desc")}
                  style={[itemStyles.filterPill, { backgroundColor: activeFilter === "no_desc" ? "#F59E0B" : colors.surface, borderColor: activeFilter === "no_desc" ? "#F59E0B" : colors.border }]}
                >
                  <Text style={{ color: activeFilter === "no_desc" ? "#fff" : colors.foreground, fontSize: 12, fontWeight: "600" }}>No Desc ({missingDescCount})</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setActiveFilter(activeFilter === "no_image" ? "all" : "no_image")}
                  style={[itemStyles.filterPill, { backgroundColor: activeFilter === "no_image" ? "#8B5CF6" : colors.surface, borderColor: activeFilter === "no_image" ? "#8B5CF6" : colors.border }]}
                >
                  <Text style={{ color: activeFilter === "no_image" ? "#fff" : colors.foreground, fontSize: 12, fontWeight: "600" }}>No Image ({missingImageCount})</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setActiveFilter(activeFilter === "drs" ? "all" : "drs")}
                  style={[itemStyles.filterPill, { backgroundColor: activeFilter === "drs" ? "#0EA5E9" : colors.surface, borderColor: activeFilter === "drs" ? "#0EA5E9" : colors.border }]}
                >
                  <Text style={{ color: activeFilter === "drs" ? "#fff" : colors.foreground, fontSize: 12, fontWeight: "600" }}>DRS ({drsCount})</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setActiveFilter(activeFilter === "out_of_stock" ? "all" : "out_of_stock")}
                  style={[itemStyles.filterPill, { backgroundColor: activeFilter === "out_of_stock" ? "#EF4444" : colors.surface, borderColor: activeFilter === "out_of_stock" ? "#EF4444" : colors.border }]}
                >
                  <Text style={{ color: activeFilter === "out_of_stock" ? "#fff" : colors.foreground, fontSize: 12, fontWeight: "600" }}>Out of Stock ({outOfStockCount})</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setPvFilter(pvFilter === "verified" ? "all" : "verified")}
                  style={[itemStyles.filterPill, { backgroundColor: pvFilter === "verified" ? "#22C55E" : colors.surface, borderColor: pvFilter === "verified" ? "#22C55E" : colors.border }]}
                >
                  <Text style={{ color: pvFilter === "verified" ? "#fff" : colors.foreground, fontSize: 12, fontWeight: "600" }}>PV ✓ ({verifiedCount})</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setPvFilter(pvFilter === "unverified" ? "all" : "unverified")}
                  style={[itemStyles.filterPill, { backgroundColor: pvFilter === "unverified" ? "#EF4444" : colors.surface, borderColor: pvFilter === "unverified" ? "#EF4444" : colors.border }]}
                >
                  <Text style={{ color: pvFilter === "unverified" ? "#fff" : colors.foreground, fontSize: 12, fontWeight: "600" }}>PV ✗ ({unverifiedCount})</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setSelectedCategoryFilter("all")}
                  style={[itemStyles.filterPill, { backgroundColor: selectedCategoryFilter === "all" ? colors.primary : colors.surface, borderColor: selectedCategoryFilter === "all" ? colors.primary : colors.border }]}
                >
                  <Text style={{ color: selectedCategoryFilter === "all" ? "#fff" : colors.foreground, fontSize: 12, fontWeight: "600" }}>All</Text>
                </TouchableOpacity>
                {storeCategories.map((cat: any) => (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setSelectedCategoryFilter(cat.id === selectedCategoryFilter ? "all" : cat.id)}
                    style={[itemStyles.filterPill, { backgroundColor: selectedCategoryFilter === cat.id ? colors.primary : colors.surface, borderColor: selectedCategoryFilter === cat.id ? colors.primary : colors.border }]}
                  >
                    <Text style={{ color: selectedCategoryFilter === cat.id ? "#fff" : colors.foreground, fontSize: 12, fontWeight: "600" }} numberOfLines={1}>{cat.name} ({cat.count})</Text>
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

              {/* Bulk Mark In Stock bar - mobile */}
              {activeFilter === "out_of_stock" && !productsLoading && products.length > 0 && (
                <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: "#22C55E10", borderWidth: 1, borderColor: "#22C55E", borderRadius: 10, flexWrap: "wrap" }}>
                    <TouchableOpacity
                      onPress={() => {
                        if (selectedStockIds.size === products.length) {
                          setSelectedStockIds(new Set());
                        } else {
                          setSelectedStockIds(new Set(products.map((p: any) => p.id)));
                        }
                      }}
                      style={{ paddingHorizontal: 10, paddingVertical: 5, backgroundColor: selectedStockIds.size === products.length ? "#22C55E" : colors.surface, borderRadius: 6, borderWidth: 1, borderColor: "#22C55E" }}
                    >
                      <Text style={{ color: selectedStockIds.size === products.length ? "#fff" : "#22C55E", fontSize: 11, fontWeight: "700" }}>{selectedStockIds.size === products.length ? "Deselect All" : "Select All"}</Text>
                    </TouchableOpacity>
                    <Text style={{ color: "#22C55E", fontSize: 12, fontWeight: "600", flex: 1 }}>{selectedStockIds.size} selected</Text>
                    <TouchableOpacity
                      onPress={handleBulkMarkInStock}
                      style={{ paddingHorizontal: 14, paddingVertical: 6, backgroundColor: selectedStockIds.size > 0 ? "#22C55E" : colors.border, borderRadius: 8 }}
                    >
                      <Text style={{ color: selectedStockIds.size > 0 ? "#fff" : colors.muted, fontSize: 12, fontWeight: "700" }}>{bulkStockMutation.isPending ? "Updating..." : `Mark ${selectedStockIds.size} In Stock`}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Loading */}
              {productsLoading && (
                <View style={{ alignItems: "center", paddingVertical: 40 }}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={{ color: colors.muted, marginTop: 8, fontSize: 13 }}>Loading products...</Text>
                </View>
              )}

              {!productsLoading && (
              <>
              <FlatList
                data={products}
                renderItem={renderProductItem}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20, gap: 10 }}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={{ alignItems: "center", paddingVertical: 40 }}>
                    <Text style={{ color: colors.muted, fontSize: 14 }}>
                      {debouncedSearch ? `No products matching "${debouncedSearch}"` : "No products found"}
                    </Text>
                  </View>
                }
              />
              <PaginationBar />
            </>
              )}
            </View>
          )}
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
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <Text style={{ fontSize: 20, fontWeight: "700", color: colors.foreground }}>Edit Product</Text>
              <TouchableOpacity onPress={() => { setShowEditModal(false); setEditingProduct(null); setPendingImageBase64(null); setPendingImageUri(null); setCategorySearch(""); }}>
                <Text style={{ fontSize: 28, color: colors.muted }}>×</Text>
              </TouchableOpacity>
            </View>
            {/* Current Store Label */}
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 8 }}>
              <View style={{ backgroundColor: colors.primary + "20", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
                <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "700" }}>📍 {currentStoreName}</Text>
              </View>
              <TouchableOpacity
                onPress={() => { setDuplicateTargetStoreIds([]); setShowDuplicateModal(true); }}
                style={{ backgroundColor: "#8B5CF620", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <Text style={{ color: "#8B5CF6", fontSize: 12, fontWeight: "700" }}>📋 Duplicate to Store</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ gap: 16, paddingBottom: 20 }} showsVerticalScrollIndicator={true} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
              {/* Image - always show, with upload option */}
              <View style={{ alignItems: "center" }}>
                {pendingImageUri ? (
                  <Image
                    source={{ uri: pendingImageUri }}
                    style={{ width: 120, height: 120, borderRadius: 12 }}
                    contentFit="cover"
                  />
                ) : editingProduct?.images && editingProduct.images.length > 0 ? (
                  <Image
                    source={{ uri: Array.isArray(editingProduct.images) ? editingProduct.images[0] : editingProduct.images }}
                    style={{ width: 120, height: 120, borderRadius: 12 }}
                    contentFit="cover"
                  />
                ) : (
                  <View style={{ width: 120, height: 120, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border, borderStyle: "dashed", justifyContent: "center", alignItems: "center" }}>
                    <Text style={{ fontSize: 32 }}>📷</Text>
                    <Text style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>No image</Text>
                  </View>
                )}
                <TouchableOpacity
                  onPress={() => handlePickImage("edit")}
                  style={{ marginTop: 8, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.primary + "20", borderRadius: 8 }}
                >
                  <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>
                    {editingProduct?.images?.length > 0 || pendingImageUri ? "Change Image" : "Upload Image"}
                  </Text>
                </TouchableOpacity>
              </View>

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

              {/* Category - searchable */}
              <View>
                <Text style={[editStyles.label, { color: colors.foreground }]}>Category</Text>
                {/* Current category display */}
                {editingProduct?._categoryId && (
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 8 }}>
                    <Text style={{ fontSize: 12, color: colors.muted }}>Current:</Text>
                    <View style={{ backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
                      <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>
                        {categories?.find((c: any) => c.id === editingProduct._categoryId)?.name || "Unknown"}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => setEditingProduct({ ...editingProduct, _categoryId: null })}>
                      <Text style={{ color: colors.error, fontSize: 12 }}>✕ Clear</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {/* Category search input */}
                <TextInput
                  style={[editStyles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground, marginBottom: 8 }]}
                  value={categorySearch}
                  onChangeText={setCategorySearch}
                  placeholder="Search categories..."
                  placeholderTextColor={colors.muted}
                  returnKeyType="done"
                />
                {/* Scrollable wrapping category grid */}
                <ScrollView style={{ maxHeight: 140 }} nestedScrollEnabled showsVerticalScrollIndicator>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {filteredCategories.map((cat: any) => (
                      <TouchableOpacity
                        key={cat.id}
                        onPress={() => { setEditingProduct({ ...editingProduct, _categoryId: cat.id }); setCategorySearch(""); }}
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
                    {filteredCategories.length === 0 && (
                      <Text style={{ color: colors.muted, fontSize: 12, padding: 8 }}>No categories match "{categorySearch}"</Text>
                    )}
                  </View>
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

              {/* Pin to Trending Toggle */}
              <View>
                <Text style={[editStyles.label, { color: colors.foreground }]}>Pin to Trending</Text>
                <TouchableOpacity
                  onPress={() => setEditingProduct({ ...editingProduct, pinnedToTrending: !editingProduct?.pinnedToTrending })}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    backgroundColor: editingProduct?.pinnedToTrending ? "#F59E0B15" : colors.surface,
                    borderWidth: 1,
                    borderColor: editingProduct?.pinnedToTrending ? "#F59E0B" : colors.border,
                    borderRadius: 12,
                  }}
                >
                  <View style={{
                    width: 22,
                    height: 22,
                    borderRadius: 4,
                    borderWidth: 2,
                    borderColor: editingProduct?.pinnedToTrending ? "#F59E0B" : colors.muted,
                    backgroundColor: editingProduct?.pinnedToTrending ? "#F59E0B" : "transparent",
                    justifyContent: "center",
                    alignItems: "center",
                  }}>
                    {editingProduct?.pinnedToTrending && <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>★</Text>}
                  </View>
                  <Text style={{ color: colors.foreground, fontSize: 13, flex: 1 }}>
                    {editingProduct?.pinnedToTrending ? "Pinned — always shows in trending section" : "Not pinned — ranked by sales only"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* ===== MODIFIER TEMPLATES (Inherited + Manual) ===== */}
              <InlineTemplatesSection productId={editingProduct?.id} categoryId={editingProduct?._categoryId} colors={colors} setEditingModifier={setEditingModifier} setShowModifierEditor={setShowModifierEditor} />

              {/* ===== INLINE PRODUCT OPTIONS (Custom per-product) ===== */}
              <InlineModifiersSection productId={editingProduct?.id} colors={colors} />

              {/* ===== INLINE MULTI-BUY DEALS ===== */}
              <InlineDealsSection productId={editingProduct?.id} colors={colors} />

            </ScrollView>

            {/* Buttons */}
            <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
              <TouchableOpacity
                onPress={() => {
                  setShowEditModal(false);
                  setEditingProduct(null);
                  setPendingImageBase64(null);
                  setPendingImageUri(null);
                }}
                style={{ flex: 1, paddingVertical: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, alignItems: "center" }}
              >
                <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 15 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                disabled={isSaving}
                style={{ flex: 1, paddingVertical: 14, backgroundColor: isSaving ? colors.muted : colors.primary, borderRadius: 12, alignItems: "center" }}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
                  {isSaving ? "Saving..." : "Save Changes"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modifier Editor Modal */}
      <Modal visible={showModifierEditor} animationType="fade" transparent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" }}>
          <View style={{ backgroundColor: colors.background, borderRadius: 16, padding: 24, width: "90%", maxWidth: 500, maxHeight: "80%" }}>
            {editingModifier && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground }}>Edit {editingModifier.template?.name}</Text>
                  <TouchableOpacity onPress={() => setShowModifierEditor(false)}>
                    <Text style={{ fontSize: 24, color: colors.muted }}>✕</Text>
                  </TouchableOpacity>
                </View>

                <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 12 }}>
                  {editingModifier.template?.type === "single" ? "Select one option" : "Select multiple options"}
                </Text>

                <View style={{ gap: 8, marginBottom: 16 }}>
                  {editingModifier.template?.options?.map((option: any) => {
                    const isSelected = editingModifier.selectedOptions?.includes(option.id);
                    return (
                      <TouchableOpacity
                        key={option.id}
                        onPress={() => {
                          if (editingModifier.template?.type === "single") {
                            setEditingModifier({
                              ...editingModifier,
                              selectedOptions: [option.id],
                            });
                          } else {
                            const newSelected = isSelected
                              ? editingModifier.selectedOptions?.filter((id: number) => id !== option.id) || []
                              : [...(editingModifier.selectedOptions || []), option.id];
                            setEditingModifier({
                              ...editingModifier,
                              selectedOptions: newSelected,
                            });
                          }
                        }}
                        style={{
                          padding: 12,
                          borderRadius: 8,
                          borderWidth: 2,
                          borderColor: isSelected ? colors.primary : colors.border,
                          backgroundColor: isSelected ? colors.primary + "15" : colors.surface,
                        }}
                      >
                        <Text style={{ color: colors.foreground, fontWeight: isSelected ? "600" : "400" }}>
                          {isSelected ? "✓ " : ""}{option.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={{ flexDirection: "row", gap: 12 }}>
                  <TouchableOpacity
                    onPress={() => setShowModifierEditor(false)}
                    style={{ flex: 1, paddingVertical: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, alignItems: "center" }}
                  >
                    <Text style={{ color: colors.foreground, fontWeight: "600" }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setShowModifierEditor(false);
                    }}
                    style={{ flex: 1, paddingVertical: 12, backgroundColor: colors.primary, borderRadius: 8, alignItems: "center" }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700" }}>Save</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Duplicate to Store Modal */}
      <Modal visible={showDuplicateModal} animationType="fade" transparent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" }}>
          <View style={{ backgroundColor: colors.background, borderRadius: 16, padding: 24, width: "90%", maxWidth: 420, maxHeight: "70%" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground }}>Duplicate to Store</Text>
              <TouchableOpacity onPress={() => setShowDuplicateModal(false)}>
                <Text style={{ fontSize: 24, color: colors.muted }}>×</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 12 }}>
              Copy "{editingProduct?.name}" to selected stores:
            </Text>
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator>
              {otherStores.map(store => {
                const isSelected = duplicateTargetStoreIds.includes(store.id);
                return (
                  <TouchableOpacity
                    key={store.id}
                    onPress={() => {
                      setDuplicateTargetStoreIds(prev =>
                        isSelected ? prev.filter(id => id !== store.id) : [...prev, store.id]
                      );
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      marginBottom: 6,
                      backgroundColor: isSelected ? "#8B5CF615" : colors.surface,
                      borderWidth: 1,
                      borderColor: isSelected ? "#8B5CF6" : colors.border,
                      borderRadius: 10,
                    }}
                  >
                    <View style={{
                      width: 22, height: 22, borderRadius: 4, borderWidth: 2,
                      borderColor: isSelected ? "#8B5CF6" : colors.muted,
                      backgroundColor: isSelected ? "#8B5CF6" : "transparent",
                      justifyContent: "center", alignItems: "center",
                    }}>
                      {isSelected && <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>✓</Text>}
                    </View>
                    <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "500" }}>{store.name}</Text>
                  </TouchableOpacity>
                );
              })}
              {otherStores.length === 0 && (
                <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center", padding: 20 }}>No other active stores available</Text>
              )}
            </ScrollView>
            <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
              <TouchableOpacity
                onPress={() => setShowDuplicateModal(false)}
                style={{ flex: 1, paddingVertical: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, alignItems: "center" }}
              >
                <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDuplicate}
                disabled={isSaving || duplicateTargetStoreIds.length === 0}
                style={{
                  flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center",
                  backgroundColor: (isSaving || duplicateTargetStoreIds.length === 0) ? colors.muted : "#8B5CF6",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>
                  {isSaving ? "Duplicating..." : duplicateTargetStoreIds.length > 0 ? `Duplicate to ${duplicateTargetStoreIds.length} Store${duplicateTargetStoreIds.length > 1 ? "s" : ""}` : "Select Stores"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Product Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24, maxHeight: "92%" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: "700", color: colors.foreground }}>Add New Product</Text>
              <TouchableOpacity onPress={() => { setShowAddModal(false); resetAddForm(); }}>
                <Text style={{ fontSize: 28, color: colors.muted }}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ gap: 16, paddingBottom: 20 }} showsVerticalScrollIndicator={true} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
              {/* Image Upload */}
              <View style={{ alignItems: "center" }}>
                {addImageUri ? (
                  <Image
                    source={{ uri: addImageUri }}
                    style={{ width: 120, height: 120, borderRadius: 12 }}
                    contentFit="cover"
                  />
                ) : (
                  <View style={{ width: 120, height: 120, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border, borderStyle: "dashed", justifyContent: "center", alignItems: "center" }}>
                    <Text style={{ fontSize: 32 }}>📷</Text>
                    <Text style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>Add image</Text>
                  </View>
                )}
                <TouchableOpacity
                  onPress={() => handlePickImage("add")}
                  style={{ marginTop: 8, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.primary + "20", borderRadius: 8 }}
                >
                  <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>
                    {addImageUri ? "Change Image" : "Upload Image"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Name */}
              <View>
                <Text style={[editStyles.label, { color: colors.foreground }]}>Name *</Text>
                <TextInput
                  style={[editStyles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                  value={addForm.name}
                  onChangeText={(text) => setAddForm({ ...addForm, name: text })}
                  placeholder="e.g. Pepsi 330ml"
                  placeholderTextColor={colors.muted}
                  returnKeyType="done"
                />
              </View>

              {/* Description */}
              <View>
                <Text style={[editStyles.label, { color: colors.foreground }]}>Description</Text>
                <TextInput
                  style={[editStyles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground, minHeight: 60, textAlignVertical: "top" }]}
                  value={addForm.description}
                  onChangeText={(text) => setAddForm({ ...addForm, description: text })}
                  multiline
                  numberOfLines={3}
                  placeholder="Product description..."
                  placeholderTextColor={colors.muted}
                />
              </View>

              {/* Price */}
              <View>
                <Text style={[editStyles.label, { color: colors.foreground }]}>Price (€) *</Text>
                <TextInput
                  style={[editStyles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                  value={addForm.price}
                  onChangeText={(text) => setAddForm({ ...addForm, price: text })}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.muted}
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
                      onPress={() => setAddForm({ ...addForm, stockStatus: opt.value })}
                      style={[
                        editStyles.stockPill,
                        {
                          backgroundColor: addForm.stockStatus === opt.value ? opt.color : colors.surface,
                          borderColor: addForm.stockStatus === opt.value ? opt.color : colors.border,
                        },
                      ]}
                    >
                      <Text style={{
                        color: addForm.stockStatus === opt.value ? "#fff" : colors.foreground,
                        fontSize: 12,
                        fontWeight: "600",
                      }}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Category */}
              <View>
                <Text style={[editStyles.label, { color: colors.foreground }]}>Category</Text>
                {addForm.categoryId && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <View style={{ backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
                      <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>
                        {storeCategories.find((c: any) => c.id === addForm.categoryId)?.name || categories?.find((c: any) => c.id === addForm.categoryId)?.name || "Unknown"}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => setAddForm({ ...addForm, categoryId: null })}>
                      <Text style={{ color: colors.error, fontSize: 12 }}>✕ Clear</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <TextInput
                  style={[editStyles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground, marginBottom: 8 }]}
                  value={addCategorySearch}
                  onChangeText={setAddCategorySearch}
                  placeholder="Search categories..."
                  placeholderTextColor={colors.muted}
                  returnKeyType="done"
                />
                <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled showsVerticalScrollIndicator>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {(addCategorySearch.trim()
                      ? storeCategories.filter((c: any) => c.name?.toLowerCase().includes(addCategorySearch.toLowerCase().trim()))
                      : storeCategories
                    ).map((cat: any) => (
                      <TouchableOpacity
                        key={cat.id}
                        onPress={() => { setAddForm({ ...addForm, categoryId: addForm.categoryId === cat.id ? null : cat.id }); setAddCategorySearch(""); }}
                        style={[
                          editStyles.stockPill,
                          {
                            backgroundColor: addForm.categoryId === cat.id ? colors.primary : colors.surface,
                            borderColor: addForm.categoryId === cat.id ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: addForm.categoryId === cat.id ? "#fff" : colors.foreground,
                            fontSize: 12,
                            fontWeight: "600",
                          }}
                          numberOfLines={1}
                        >{cat.name}</Text>
                      </TouchableOpacity>
                    ))}
                    {addCategorySearch.trim() && storeCategories.filter((c: any) => c.name?.toLowerCase().includes(addCategorySearch.toLowerCase().trim())).length === 0 && (
                      <Text style={{ color: colors.muted, fontSize: 12, padding: 8 }}>No categories match "{addCategorySearch}"</Text>
                    )}
                  </View>
                </ScrollView>
              </View>

              {/* DRS Toggle */}
              <View>
                <Text style={[editStyles.label, { color: colors.foreground }]}>DRS (Deposit Return Scheme)</Text>
                <TouchableOpacity
                  onPress={() => setAddForm({ ...addForm, isDrs: !addForm.isDrs })}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    backgroundColor: addForm.isDrs ? "#0EA5E915" : colors.surface,
                    borderWidth: 1,
                    borderColor: addForm.isDrs ? "#0EA5E9" : colors.border,
                    borderRadius: 12,
                  }}
                >
                  <View style={{
                    width: 22,
                    height: 22,
                    borderRadius: 4,
                    borderWidth: 2,
                    borderColor: addForm.isDrs ? "#0EA5E9" : colors.muted,
                    backgroundColor: addForm.isDrs ? "#0EA5E9" : "transparent",
                    justifyContent: "center",
                    alignItems: "center",
                  }}>
                    {addForm.isDrs && <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>✓</Text>}
                  </View>
                  <Text style={{ color: colors.foreground, fontSize: 13, flex: 1 }}>
                    {addForm.isDrs ? "DRS deposit included" : "No DRS deposit"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Pin to Trending Toggle */}
              <View>
                <Text style={[editStyles.label, { color: colors.foreground }]}>Pin to Trending</Text>
                <TouchableOpacity
                  onPress={() => setAddForm({ ...addForm, pinnedToTrending: !addForm.pinnedToTrending })}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    backgroundColor: addForm.pinnedToTrending ? "#F59E0B15" : colors.surface,
                    borderWidth: 1,
                    borderColor: addForm.pinnedToTrending ? "#F59E0B" : colors.border,
                    borderRadius: 12,
                  }}
                >
                  <View style={{
                    width: 22,
                    height: 22,
                    borderRadius: 4,
                    borderWidth: 2,
                    borderColor: addForm.pinnedToTrending ? "#F59E0B" : colors.muted,
                    backgroundColor: addForm.pinnedToTrending ? "#F59E0B" : "transparent",
                    justifyContent: "center",
                    alignItems: "center",
                  }}>
                    {addForm.pinnedToTrending && <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>★</Text>}
                  </View>
                  <Text style={{ color: colors.foreground, fontSize: 13, flex: 1 }}>
                    {addForm.pinnedToTrending ? "Pinned — always shows in trending" : "Not pinned — ranked by sales only"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Multi-Store Selection */}
              <View>
                <Text style={[editStyles.label, { color: colors.foreground }]}>Add to Stores *</Text>
                <Text style={{ color: colors.muted, fontSize: 11, marginBottom: 8 }}>
                  Select which stores should receive this product. A copy will be created in each selected store.
                </Text>
                <View style={{ gap: 6 }}>
                  {activeStores.map(store => {
                    const isSelected = addForm.storeIds.includes(store.id);
                    return (
                      <TouchableOpacity
                        key={store.id}
                        onPress={() => {
                          const newIds = isSelected
                            ? addForm.storeIds.filter(id => id !== store.id)
                            : [...addForm.storeIds, store.id];
                          setAddForm({ ...addForm, storeIds: newIds });
                        }}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          backgroundColor: isSelected ? colors.primary + "10" : colors.surface,
                          borderWidth: 1,
                          borderColor: isSelected ? colors.primary : colors.border,
                          borderRadius: 10,
                        }}
                      >
                        <View style={{
                          width: 22,
                          height: 22,
                          borderRadius: 4,
                          borderWidth: 2,
                          borderColor: isSelected ? colors.primary : colors.muted,
                          backgroundColor: isSelected ? colors.primary : "transparent",
                          justifyContent: "center",
                          alignItems: "center",
                        }}>
                          {isSelected && <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>✓</Text>}
                        </View>
                        <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "500" }}>{store.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            {/* Buttons */}
            <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
              <TouchableOpacity
                onPress={() => { setShowAddModal(false); resetAddForm(); }}
                style={{ flex: 1, paddingVertical: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, alignItems: "center" }}
              >
                <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 15 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAddProduct}
                disabled={isSaving || !addForm.name.trim() || !addForm.price.trim() || addForm.storeIds.length === 0}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  backgroundColor: (isSaving || !addForm.name.trim() || !addForm.price.trim() || addForm.storeIds.length === 0) ? colors.muted : "#22C55E",
                  borderRadius: 12,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
                  {isSaving ? "Adding..." : addForm.storeIds.length > 1 ? `Add to ${addForm.storeIds.length} Stores` : "Add Product"}
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

// ===== INLINE TEMPLATES SECTION (Category-inherited + Manually assigned) =====
function InlineTemplatesSection({ productId, categoryId, colors, setEditingModifier, setShowModifierEditor }: { productId: number | undefined; categoryId: number | undefined | null; colors: any; setEditingModifier: any; setShowModifierEditor: any }) {
  const [expanded, setExpanded] = useState(true);

  // All available templates
  const { data: allTemplates } = trpc.modifierTemplates.list.useQuery();

  // Templates inherited from category
  const { data: categoryTemplates } = trpc.modifierTemplates.getForCategory.useQuery(
    { categoryId: categoryId! },
    { enabled: !!categoryId }
  );

  // Templates manually assigned to this product
  const { data: productTemplates, refetch: refetchProductTemplates } = trpc.modifierTemplates.getForProduct.useQuery(
    { productId: productId! },
    { enabled: !!productId }
  );

  // Exclusions (category templates opted out for this product)
  const { data: exclusions, refetch: refetchExclusions } = trpc.modifierTemplates.getExclusions.useQuery(
    { productId: productId! },
    { enabled: !!productId }
  );

  const assignMut = trpc.modifierTemplates.assignToProduct.useMutation();
  const removeMut = trpc.modifierTemplates.removeFromProduct.useMutation();
  const excludeMut = trpc.modifierTemplates.excludeTemplate.useMutation();
  const includeMut = trpc.modifierTemplates.includeTemplate.useMutation();

  if (!productId) return null;

  const excludedIds = new Set((exclusions || []).map((e: any) => e.templateId));
  const productTemplateIds = new Set((productTemplates || []).map((pt: any) => pt.template?.id));
  const categoryTemplateIds = new Set((categoryTemplates || []).map((ct: any) => ct.template?.id));

  // Templates available to add (not already assigned to product, not inherited from category)
  const availableToAdd = (allTemplates || []).filter((t: any) =>
    !productTemplateIds.has(t.id) && !categoryTemplateIds.has(t.id)
  );

  const totalCount = (categoryTemplates?.length || 0) + (productTemplates?.length || 0);

  return (
    <View style={{ borderWidth: 1, borderColor: "#00BCD440", borderRadius: 12, overflow: "hidden" }}>
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, backgroundColor: "#00BCD410" }}
      >
        <Text style={{ fontSize: 14, fontWeight: "700", color: "#00838F" }}>
          Modifier Templates {totalCount > 0 ? `(${totalCount})` : ""}
        </Text>
        <Text style={{ fontSize: 16, color: "#00838F" }}>{expanded ? "\u25B2" : "\u25BC"}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={{ padding: 14, gap: 10 }}>
          {/* Category-inherited templates */}
          {categoryTemplates && categoryTemplates.length > 0 && (
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Inherited from Category
              </Text>
              {categoryTemplates.map((ct: any) => {
                const isExcluded = excludedIds.has(ct.template?.id);
                return (
                  <View key={ct.linkId} style={{
                    flexDirection: "row", alignItems: "center", gap: 8, padding: 10,
                    backgroundColor: isExcluded ? "#F3F4F6" : "#E0F7FA",
                    borderRadius: 8, borderWidth: 1, borderColor: isExcluded ? "#D1D5DB" : "#00BCD440",
                    opacity: isExcluded ? 0.6 : 1,
                  }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: isExcluded ? "#9CA3AF" : "#00838F", textDecorationLine: isExcluded ? "line-through" : "none" }}>
                        {ct.template?.name}
                      </Text>
                      <Text style={{ fontSize: 11, color: "#687076" }}>
                        {ct.template?.type === "single" ? "Pick One" : "Pick Many"}
                        {ct.template?.required ? " \u2022 Required" : ""}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={async () => {
                        try {
                          if (isExcluded) {
                            await includeMut.mutateAsync({ productId: productId!, templateId: ct.template.id });
                          } else {
                            await excludeMut.mutateAsync({ productId: productId!, templateId: ct.template.id });
                          }
                          refetchExclusions();
                        } catch (e) { /* ignore */ }
                      }}
                      style={{
                        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
                        backgroundColor: isExcluded ? "#DCFCE7" : "#FEE2E2",
                      }}
                    >
                      <Text style={{ color: isExcluded ? "#16A34A" : "#EF4444", fontWeight: "700", fontSize: 11 }}>
                        {isExcluded ? "Re-enable" : "Exclude"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}

          {/* Manually assigned templates */}
          {productTemplates && productTemplates.length > 0 && (
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Manually Assigned
              </Text>
              {productTemplates.map((pt: any) => (
                <TouchableOpacity
                  key={pt.linkId}
                  onPress={() => {
                    setEditingModifier(pt);
                    setShowModifierEditor(true);
                  }}
                  style={{
                    flexDirection: "row", alignItems: "center", gap: 8, padding: 10,
                    backgroundColor: "#E0F2FE", borderRadius: 8, borderWidth: 1, borderColor: "#0EA5E940",
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#0369A1" }}>
                      {pt.template?.name}
                    </Text>
                    <Text style={{ fontSize: 11, color: "#687076" }}>
                      {pt.template?.type === "single" ? "Pick One" : "Pick Many"}
                      {pt.template?.required ? " \u2022 Required" : ""}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={async (e) => {
                      try {
                        await removeMut.mutateAsync({ linkId: pt.linkId });
                        refetchProductTemplates();
                      } catch (e) { /* ignore */ }
                    }}
                    style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: "#FEE2E2" }}
                  >
                    <Text style={{ color: "#EF4444", fontWeight: "700", fontSize: 11 }}>Remove</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Add template picker */}
          {availableToAdd.length > 0 && (
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Add Template
              </Text>
              {availableToAdd.map((t: any) => (
                <TouchableOpacity
                  key={t.id}
                  onPress={async () => {
                    try {
                      await assignMut.mutateAsync({
                        productId: productId!,
                        templateId: t.id,
                        sortOrder: (productTemplates?.length || 0),
                      });
                      refetchProductTemplates();
                    } catch (e) { /* ignore */ }
                  }}
                  style={{
                    flexDirection: "row", alignItems: "center", gap: 8, padding: 10,
                    backgroundColor: "#F0FDF4", borderRadius: 8, borderWidth: 1, borderColor: "#22C55E40",
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#16A34A" }}>{t.name}</Text>
                    <Text style={{ fontSize: 11, color: "#687076" }}>
                      {t.options?.length || 0} options \u2022 {t.type === "single" ? "Pick One" : "Pick Many"}
                    </Text>
                  </View>
                  <Text style={{ color: "#22C55E", fontWeight: "700", fontSize: 20 }}>+</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Empty state */}
          {totalCount === 0 && availableToAdd.length === 0 && (
            <Text style={{ color: colors.muted, fontSize: 12, fontStyle: "italic", textAlign: "center", paddingVertical: 8 }}>
              No modifier templates available. Create templates in the Modifier Templates page first.
            </Text>
          )}

          {totalCount === 0 && availableToAdd.length === 0 && !allTemplates?.length && (
            <Text style={{ color: colors.muted, fontSize: 12, fontStyle: "italic", textAlign: "center" }}>
              Use the custom Product Options below for one-off modifiers.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

// ===== INLINE MODIFIERS SECTION (Botble-style) =====
function InlineModifiersSection({ productId, colors }: { productId: number | undefined; colors: any }) {
  const [expanded, setExpanded] = useState(true);
  const [localGroups, setLocalGroups] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [savingState, setSavingState] = useState<string | null>(null);

  const { data: serverData, refetch } = trpc.modifiers.getForProduct.useQuery(
    { productId: productId! },
    { enabled: !!productId }
  );

  const createGroupMut = trpc.modifiers.createGroup.useMutation();
  const updateGroupMut = trpc.modifiers.updateGroup.useMutation();
  const deleteGroupMut = trpc.modifiers.deleteGroup.useMutation();
  const createModMut = trpc.modifiers.createModifier.useMutation();
  const updateModMut = trpc.modifiers.updateModifier.useMutation();
  const deleteModMut = trpc.modifiers.deleteModifier.useMutation();

  // Load server data into local state
  useEffect(() => {
    if (serverData?.groups && !loaded) {
      setLocalGroups(serverData.groups.map(g => ({
        ...g,
        _isNew: false,
        modifiers: g.modifiers.map(m => ({ ...m, _isNew: false })),
      })));
      setLoaded(true);
    }
  }, [serverData, loaded]);

  // Reset when productId changes
  useEffect(() => {
    setLoaded(false);
    setLocalGroups([]);
  }, [productId]);

  const addGroup = () => {
    setLocalGroups(prev => [...prev, {
      id: Date.now(), // temp ID
      _isNew: true,
      name: "",
      type: "single",
      required: false,
      minSelections: 0,
      maxSelections: 0,
      sortOrder: prev.length,
      modifiers: [],
    }]);
  };

  const updateLocalGroup = (idx: number, field: string, value: any) => {
    setLocalGroups(prev => prev.map((g, i) => i === idx ? { ...g, [field]: value } : g));
  };

  const removeGroup = async (idx: number) => {
    const group = localGroups[idx];
    if (!group._isNew && group.id) {
      setSavingState(`Deleting ${group.name}...`);
      try {
        await deleteGroupMut.mutateAsync({ id: group.id });
      } catch (e) { /* ignore */ }
      setSavingState(null);
    }
    setLocalGroups(prev => prev.filter((_, i) => i !== idx));
  };

  const addModifier = (groupIdx: number) => {
    setLocalGroups(prev => prev.map((g, i) => {
      if (i !== groupIdx) return g;
      return {
        ...g,
        modifiers: [...g.modifiers, {
          id: Date.now(),
          _isNew: true,
          name: "",
          price: "0.00",
          isDefault: false,
          sortOrder: g.modifiers.length,
        }],
      };
    }));
  };

  const updateLocalMod = (groupIdx: number, modIdx: number, field: string, value: any) => {
    setLocalGroups(prev => prev.map((g, gi) => {
      if (gi !== groupIdx) return g;
      return {
        ...g,
        modifiers: g.modifiers.map((m: any, mi: number) => mi === modIdx ? { ...m, [field]: value } : m),
      };
    }));
  };

  const removeMod = async (groupIdx: number, modIdx: number) => {
    const mod = localGroups[groupIdx].modifiers[modIdx];
    if (!mod._isNew && mod.id) {
      try {
        await deleteModMut.mutateAsync({ id: mod.id });
      } catch (e) { /* ignore */ }
    }
    setLocalGroups(prev => prev.map((g, gi) => {
      if (gi !== groupIdx) return g;
      return { ...g, modifiers: g.modifiers.filter((_: any, mi: number) => mi !== modIdx) };
    }));
  };

  const saveAllGroups = async () => {
    if (!productId) return;
    setSavingState("Saving options...");
    try {
      for (const group of localGroups) {
        if (!group.name.trim()) continue;
        let groupId = group.id;

        if (group._isNew) {
          const res = await createGroupMut.mutateAsync({
            productId,
            name: group.name.trim(),
            type: group.type,
            required: group.required,
            minSelections: group.minSelections,
            maxSelections: group.maxSelections,
            sortOrder: group.sortOrder,
          });
          groupId = res.id;
        } else {
          await updateGroupMut.mutateAsync({
            id: groupId,
            name: group.name.trim(),
            type: group.type,
            required: group.required,
            minSelections: group.minSelections,
            maxSelections: group.maxSelections,
            sortOrder: group.sortOrder,
          });
        }

        // Save modifiers
        for (const mod of group.modifiers) {
          if (!mod.name.trim()) continue;
          if (mod._isNew) {
            await createModMut.mutateAsync({
              groupId,
              name: mod.name.trim(),
              price: mod.price || "0.00",
              isDefault: mod.isDefault || false,
              sortOrder: mod.sortOrder || 0,
            });
          } else {
            await updateModMut.mutateAsync({
              id: mod.id,
              name: mod.name.trim(),
              price: mod.price || "0.00",
              isDefault: mod.isDefault || false,
              sortOrder: mod.sortOrder || 0,
            });
          }
        }
      }
      setSavingState("Saved!");
      setLoaded(false);
      refetch();
      setTimeout(() => setSavingState(null), 1500);
    } catch (e: any) {
      setSavingState(`Error: ${e.message}`);
      setTimeout(() => setSavingState(null), 3000);
    }
  };

  if (!productId) return null;

  return (
    <View style={{ borderWidth: 1, borderColor: "#8B5CF640", borderRadius: 12, overflow: "hidden" }}>
      {/* Header */}
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, backgroundColor: "#8B5CF610" }}
      >
        <Text style={{ fontSize: 14, fontWeight: "700", color: "#8B5CF6" }}>
          Product Options {localGroups.length > 0 ? `(${localGroups.length})` : ""}
        </Text>
        <Text style={{ fontSize: 16, color: "#8B5CF6" }}>{expanded ? "▲" : "▼"}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={{ padding: 14, gap: 14 }}>
          {localGroups.map((group, gi) => (
            <View key={group.id} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, gap: 10, backgroundColor: colors.surface }}>
              {/* Group header row */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.muted }}>#{gi + 1}</Text>
                <View style={{ flex: 1 }} />
                <TouchableOpacity onPress={() => removeGroup(gi)} style={{ backgroundColor: "#EF444420", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
                  <Text style={{ color: "#EF4444", fontSize: 12, fontWeight: "700" }}>Delete</Text>
                </TouchableOpacity>
              </View>

              {/* Group fields */}
              <View style={{ gap: 8 }}>
                <View>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: colors.muted, marginBottom: 4 }}>Name</Text>
                  <TextInput
                    style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, fontSize: 13, color: colors.foreground, backgroundColor: colors.background }}
                    value={group.name}
                    onChangeText={(t) => updateLocalGroup(gi, "name", t)}
                    placeholder="e.g. Choose your side"
                    placeholderTextColor={colors.muted}
                    returnKeyType="done"
                  />
                </View>

                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: colors.muted, marginBottom: 4 }}>Type</Text>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      {(["single", "multi"] as const).map(t => (
                        <TouchableOpacity
                          key={t}
                          onPress={() => updateLocalGroup(gi, "type", t)}
                          style={{
                            flex: 1,
                            paddingVertical: 8,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: group.type === t ? "#8B5CF6" : colors.border,
                            backgroundColor: group.type === t ? "#8B5CF615" : colors.background,
                            alignItems: "center",
                          }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: "600", color: group.type === t ? "#8B5CF6" : colors.foreground }}>
                            {t === "single" ? "Radio" : "Checkbox"}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={{ justifyContent: "flex-end" }}>
                    <TouchableOpacity
                      onPress={() => updateLocalGroup(gi, "required", !group.required)}
                      style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 }}
                    >
                      <View style={{
                        width: 20, height: 20, borderRadius: 4, borderWidth: 2,
                        borderColor: group.required ? "#8B5CF6" : colors.muted,
                        backgroundColor: group.required ? "#8B5CF6" : "transparent",
                        justifyContent: "center", alignItems: "center",
                      }}>
                        {group.required && <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>✓</Text>}
                      </View>
                      <Text style={{ fontSize: 11, fontWeight: "600", color: colors.foreground }}>Required</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Modifier values */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>Values</Text>
                {group.modifiers.map((mod: any, mi: number) => (
                  <View key={mod.id} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <TextInput
                      style={{ flex: 3, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 8, fontSize: 12, color: colors.foreground, backgroundColor: colors.background }}
                      value={mod.name}
                      onChangeText={(t) => updateLocalMod(gi, mi, "name", t)}
                      placeholder="Option name"
                      placeholderTextColor={colors.muted}
                      returnKeyType="done"
                    />
                    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.background, paddingHorizontal: 6 }}>
                      <Text style={{ fontSize: 12, color: colors.muted }}>€</Text>
                      <TextInput
                        style={{ flex: 1, padding: 8, fontSize: 12, color: colors.foreground }}
                        value={mod.price}
                        onChangeText={(t) => updateLocalMod(gi, mi, "price", t)}
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                        placeholderTextColor={colors.muted}
                        returnKeyType="done"
                      />
                    </View>
                    <TouchableOpacity onPress={() => removeMod(gi, mi)} style={{ padding: 6 }}>
                      <Text style={{ color: "#EF4444", fontSize: 16, fontWeight: "700" }}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  onPress={() => addModifier(gi)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 6 }}
                >
                  <Text style={{ color: "#8B5CF6", fontSize: 12, fontWeight: "600" }}>+ Add value</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {/* Add new option group */}
          <TouchableOpacity
            onPress={addGroup}
            style={{ paddingVertical: 10, borderWidth: 1, borderColor: "#8B5CF640", borderRadius: 10, borderStyle: "dashed", alignItems: "center" }}
          >
            <Text style={{ color: "#8B5CF6", fontWeight: "700", fontSize: 13 }}>+ Add new option</Text>
          </TouchableOpacity>

          {/* Save options button */}
          {localGroups.length > 0 && (
            <TouchableOpacity
              onPress={saveAllGroups}
              style={{ paddingVertical: 10, backgroundColor: "#8B5CF6", borderRadius: 10, alignItems: "center" }}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
                {savingState || "Save Options"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

// ===== INLINE DEALS SECTION =====
function InlineDealsSection({ productId, colors }: { productId: number | undefined; colors: any }) {
  const [expanded, setExpanded] = useState(true);
  const [localDeals, setLocalDeals] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [savingState, setSavingState] = useState<string | null>(null);

  const { data: serverDeals, refetch } = trpc.modifiers.getDeals.useQuery(
    { productId: productId! },
    { enabled: !!productId }
  );

  const createDealMut = trpc.modifiers.createDeal.useMutation();
  const updateDealMut = trpc.modifiers.updateDeal.useMutation();
  const deleteDealMut = trpc.modifiers.deleteDeal.useMutation();

  useEffect(() => {
    if (serverDeals && !loaded) {
      setLocalDeals(serverDeals.map(d => ({ ...d, _isNew: false })));
      setLoaded(true);
    }
  }, [serverDeals, loaded]);

  useEffect(() => {
    setLoaded(false);
    setLocalDeals([]);
  }, [productId]);

  const addDeal = () => {
    setLocalDeals(prev => [...prev, {
      id: Date.now(),
      _isNew: true,
      quantity: 2,
      dealPrice: "",
      label: "",
    }]);
  };

  const updateLocalDeal = (idx: number, field: string, value: any) => {
    setLocalDeals(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  };

  const removeDeal = async (idx: number) => {
    const deal = localDeals[idx];
    if (!deal._isNew && deal.id) {
      try {
        await deleteDealMut.mutateAsync({ id: deal.id });
      } catch (e) { /* ignore */ }
    }
    setLocalDeals(prev => prev.filter((_, i) => i !== idx));
  };

  const saveAllDeals = async () => {
    if (!productId) return;
    setSavingState("Saving deals...");
    try {
      for (const deal of localDeals) {
        if (!deal.dealPrice) continue;
        const label = deal.label || `${deal.quantity} for €${deal.dealPrice}`;
        if (deal._isNew) {
          await createDealMut.mutateAsync({
            productId,
            quantity: Number(deal.quantity),
            dealPrice: String(deal.dealPrice),
            label,
          });
        } else {
          await updateDealMut.mutateAsync({
            id: deal.id,
            quantity: Number(deal.quantity),
            dealPrice: String(deal.dealPrice),
            label,
          });
        }
      }
      setSavingState("Saved!");
      setLoaded(false);
      refetch();
      setTimeout(() => setSavingState(null), 1500);
    } catch (e: any) {
      setSavingState(`Error: ${e.message}`);
      setTimeout(() => setSavingState(null), 3000);
    }
  };

  if (!productId) return null;

  return (
    <View style={{ borderWidth: 1, borderColor: "#F59E0B40", borderRadius: 12, overflow: "hidden" }}>
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, backgroundColor: "#F59E0B10" }}
      >
        <Text style={{ fontSize: 14, fontWeight: "700", color: "#92400E" }}>
          Multi-Buy Deals {localDeals.length > 0 ? `(${localDeals.length})` : ""}
        </Text>
        <Text style={{ fontSize: 16, color: "#92400E" }}>{expanded ? "▲" : "▼"}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={{ padding: 14, gap: 10 }}>
          {localDeals.map((deal, di) => (
            <View key={deal.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
                <TextInput
                  style={{ width: 50, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 8, fontSize: 13, color: colors.foreground, backgroundColor: colors.background, textAlign: "center" }}
                  value={String(deal.quantity)}
                  onChangeText={(t) => updateLocalDeal(di, "quantity", parseInt(t) || 2)}
                  keyboardType="number-pad"
                  returnKeyType="done"
                />
                <Text style={{ fontSize: 13, color: colors.muted, fontWeight: "600" }}>for €</Text>
                <TextInput
                  style={{ width: 70, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 8, fontSize: 13, color: colors.foreground, backgroundColor: colors.background }}
                  value={String(deal.dealPrice)}
                  onChangeText={(t) => updateLocalDeal(di, "dealPrice", t)}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.muted}
                  returnKeyType="done"
                />
              </View>
              <TouchableOpacity onPress={() => removeDeal(di)} style={{ padding: 6 }}>
                <Text style={{ color: "#EF4444", fontSize: 16, fontWeight: "700" }}>×</Text>
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity
            onPress={addDeal}
            style={{ paddingVertical: 10, borderWidth: 1, borderColor: "#F59E0B40", borderRadius: 10, borderStyle: "dashed", alignItems: "center" }}
          >
            <Text style={{ color: "#92400E", fontWeight: "700", fontSize: 13 }}>+ Add deal</Text>
          </TouchableOpacity>

          {localDeals.length > 0 && (
            <TouchableOpacity
              onPress={saveAllDeals}
              style={{ paddingVertical: 10, backgroundColor: "#F59E0B", borderRadius: 10, alignItems: "center" }}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
                {savingState || "Save Deals"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
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

const tableStyles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderBottomWidth: 2,
    borderBottomColor: "#E2E8F0",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  headerCell: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  rowEven: {
    backgroundColor: "#ffffff",
  },
  rowOdd: {
    backgroundColor: "#FAFBFC",
  },
  cell: {
    paddingHorizontal: 6,
    justifyContent: "center",
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
