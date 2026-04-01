import { Text, View, TouchableOpacity, FlatList, TextInput, StyleSheet, Platform, ActivityIndicator, Alert, Modal, ScrollView } from "react-native";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { AdminDesktopLayout } from "@/components/admin-desktop-layout";
import { useQueryClient } from "@tanstack/react-query";

const IS_WEB = Platform.OS === "web";
const PAGE_SIZE = 50;

function getFirstImageUrl(images: any): string | null {
  if (!images) return null;
  if (Array.isArray(images) && images.length > 0 && typeof images[0] === "string") {
    return images[0];
  }
  if (typeof images === "string") {
    try {
      const arr = JSON.parse(images);
      if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === "string") {
        return arr[0];
      }
    } catch {}
  }
  return null;
}

type ActionMenuState = {
  visible: boolean;
  productId: number | null;
  productName: string;
  currentCategoryId: number | null;
  currentCategoryName: string;
  currentStockStatus: string;
  isPinned: boolean;
};

type SubMenuType = "category" | "moveStore" | "duplicateStore" | null;
type BulkAction = "category" | "price" | "salePrice" | "duplicateStore" | "moveStore" | "delete" | "stockToggle" | null;

function ProductPricesContent() {
  const router = useRouter();
  const colors = useColors();
  const queryClient = useQueryClient();

  // Store selector
  const { data: stores } = trpc.stores.getAll.useQuery();
  const [selectedStore, setSelectedStore] = useState<number | null>(null);

  // Category filter
  const [selectedCategory, setSelectedCategory] = useState<number | "all">("all");
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Out of Stock filter
  const [showOOSOnly, setShowOOSOnly] = useState(false);

  // Price Verified filter
  const [pvFilter, setPvFilter] = useState<"all" | "verified" | "unverified">("all");

  // Pagination
  const [page, setPage] = useState(0);

  // Price changes tracking
  const [priceChanges, setPriceChanges] = useState<Record<number, { price?: string; salePrice?: string }>>({});

  // Saving state
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<BulkAction>(null);
  const [bulkCategorySearch, setBulkCategorySearch] = useState("");
  const [bulkPriceValue, setBulkPriceValue] = useState("");
  const [bulkSalePriceValue, setBulkSalePriceValue] = useState("");
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  // Action menu state
  const [actionMenu, setActionMenu] = useState<ActionMenuState>({
    visible: false, productId: null, productName: "", currentCategoryId: null, currentCategoryName: "", currentStockStatus: "in_stock", isPinned: false,
  });
  const [subMenu, setSubMenu] = useState<SubMenuType>(null);
  const [subMenuSearch, setSubMenuSearch] = useState("");

  // Fetch all categories for the category picker
  const { data: allCategories } = trpc.store.getCategories.useQuery(
    { storeId: selectedStore! },
    { enabled: !!selectedStore }
  );

  // Mutations
  const changeCategoryMutation = trpc.store.changeProductCategory.useMutation();
  const moveToStoreMutation = trpc.store.moveProductToStore.useMutation();
  const duplicateToStoreMutation = trpc.store.duplicateProductToStore.useMutation();
  const toggleStockMutation = trpc.store.toggleProductStock.useMutation();
  const togglePvMutation = trpc.stores.togglePriceVerified.useMutation();
  const updateProductMutation = trpc.stores.updateProduct.useMutation();
  const bulkChangeCategoryMutation = trpc.store.bulkChangeCategory.useMutation();
  const bulkSetPriceMutation = trpc.store.bulkSetPrice.useMutation();
  const bulkDuplicateToStoreMutation = trpc.store.bulkDuplicateToStore.useMutation();
  const bulkMoveToStoreMutation = trpc.store.bulkMoveToStore.useMutation();
  const bulkDeleteProductsMutation = trpc.store.bulkDeleteProducts.useMutation();
  const bulkSetStockStatusMutation = trpc.store.bulkSetStockStatus.useMutation();

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => { setPage(0); }, [selectedStore, selectedCategory, debouncedSearch, showOOSOnly, pvFilter]);

  useEffect(() => {
    if (stores && stores.length > 0 && !selectedStore) {
      setSelectedStore(stores[0].id);
    }
  }, [stores]);

  useEffect(() => { setPriceChanges({}); setSelectedIds(new Set()); }, [selectedStore]);

  // Clear selection when filters change
  useEffect(() => { setSelectedIds(new Set()); }, [selectedCategory, debouncedSearch, showOOSOnly, pvFilter, page]);

  // Fetch products
  const { data: productsData, isLoading, refetch } = trpc.stores.getProducts.useQuery(
    {
      storeId: selectedStore!,
      search: debouncedSearch || undefined,
      categoryId: selectedCategory !== "all" ? selectedCategory : undefined,
      filter: showOOSOnly ? "out_of_stock" as const : undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    },
    { enabled: !!selectedStore }
  );

  const products = productsData?.items || [];
  const totalCount = productsData?.total || 0;
  const categorySummary = productsData?.categories || [];


  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const bulkUpdateMutation = trpc.store.bulkUpdatePrices.useMutation();

  const CATEGORY_PRIORITY_ORDER = [
    "Deli", "Fizzy Drinks", "Energy Drinks", "Water and Flavoured Water",
    "Chocolate Bars", "Chocolates Multi packs and Boxes", "Crisps and Nuts",
    "Biscuits and Cookies", "Tobacco and Cigars and Papers", "Vapes and Vape Oils",
    "Spirits", "Cans and Bottles", "Flavored Alcohol", "Wines", "Nicotine Products",
  ];

  const sortedCategories = useMemo(() => {
    const cats = [...categorySummary];
    cats.sort((a: any, b: any) => {
      const aIdx = CATEGORY_PRIORITY_ORDER.findIndex(p => a.name?.toLowerCase().includes(p.toLowerCase()));
      const bIdx = CATEGORY_PRIORITY_ORDER.findIndex(p => b.name?.toLowerCase().includes(p.toLowerCase()));
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return (a.name || "").localeCompare(b.name || "");
    });
    return cats;
  }, [categorySummary]);

  const filteredCategoriesForDropdown = useMemo(() => {
    if (!categorySearch.trim()) return sortedCategories;
    const term = categorySearch.toLowerCase();
    return sortedCategories.filter((c: any) => c.name?.toLowerCase().includes(term));
  }, [sortedCategories, categorySearch]);

  const changesCount = Object.keys(priceChanges).length;
  const selectedCount = selectedIds.size;
  const verifiedCount = useMemo(() => products.filter((p: any) => p.priceVerified).length, [products]);
  const unverifiedCount = useMemo(() => products.filter((p: any) => !p.priceVerified).length, [products]);

  // Bulk selection handlers
  const toggleSelectItem = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === products.length && products.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((p: any) => p.id)));
    }
  }, [products, selectedIds.size]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setBulkAction(null);
    setBulkCategorySearch("");
    setBulkPriceValue("");
    setBulkSalePriceValue("");
  }, []);

  // Bulk action handlers
  const handleBulkChangeCategory = useCallback(async (categoryId: number, categoryName: string) => {
    if (selectedCount === 0) return;
    setIsBulkSaving(true);
    try {
      await bulkChangeCategoryMutation.mutateAsync({ productIds: Array.from(selectedIds), categoryId });
      clearSelection();
      refetch();
      showToast(`${selectedCount} product${selectedCount > 1 ? "s" : ""} moved to ${categoryName}`, "success");
    } catch (err) {
      showToast("Failed to change category for selected products", "error");
    } finally {
      setIsBulkSaving(false);
    }
  }, [selectedIds, selectedCount]);

  const handleBulkSetPrice = useCallback(async () => {
    if (selectedCount === 0 || !bulkPriceValue.trim()) return;
    setIsBulkSaving(true);
    try {
      await bulkSetPriceMutation.mutateAsync({ productIds: Array.from(selectedIds), price: bulkPriceValue.trim() });
      clearSelection();
      refetch();
      showToast(`Price set to €${bulkPriceValue.trim()} for ${selectedCount} product${selectedCount > 1 ? "s" : ""}`, "success");
    } catch (err) {
      showToast("Failed to update prices", "error");
    } finally {
      setIsBulkSaving(false);
    }
  }, [selectedIds, selectedCount, bulkPriceValue]);

  const handleBulkClearSalePrice = useCallback(async () => {
    if (selectedCount === 0) return;
    setIsBulkSaving(true);
    try {
      await bulkSetPriceMutation.mutateAsync({ productIds: Array.from(selectedIds), salePrice: null });
      clearSelection();
      refetch();
      showToast(`Sale price cleared for ${selectedCount} product${selectedCount > 1 ? "s" : ""}`, "success");
    } catch (err) {
      showToast("Failed to clear sale prices", "error");
    } finally {
      setIsBulkSaving(false);
    }
  }, [selectedIds, selectedCount]);

  const handleBulkSetSalePrice = useCallback(async () => {
    if (selectedCount === 0 || !bulkSalePriceValue.trim()) return;
    setIsBulkSaving(true);
    try {
      await bulkSetPriceMutation.mutateAsync({ productIds: Array.from(selectedIds), salePrice: bulkSalePriceValue.trim() });
      clearSelection();
      refetch();
      showToast(`Sale price set to €${bulkSalePriceValue.trim()} for ${selectedCount} product${selectedCount > 1 ? "s" : ""}`, "success");
    } catch (err) {
      showToast("Failed to update sale prices", "error");
    } finally {
      setIsBulkSaving(false);
    }
  }, [selectedIds, selectedCount, bulkSalePriceValue]);

  const handleBulkDuplicateToStore = useCallback(async (targetStoreId: number, storeName: string) => {
    if (selectedCount === 0) return;
    setIsBulkSaving(true);
    try {
      await bulkDuplicateToStoreMutation.mutateAsync({ productIds: Array.from(selectedIds), targetStoreId });
      clearSelection();
      showToast(`${selectedCount} product${selectedCount > 1 ? "s" : ""} duplicated to ${storeName}`, "success");
    } catch (err) {
      showToast("Failed to duplicate products", "error");
    } finally {
      setIsBulkSaving(false);
    }
  }, [selectedIds, selectedCount]);

  const handleBulkMoveToStore = useCallback(async (targetStoreId: number, storeName: string) => {
    if (selectedCount === 0) return;
    setIsBulkSaving(true);
    try {
      await bulkMoveToStoreMutation.mutateAsync({ productIds: Array.from(selectedIds), targetStoreId });
      clearSelection();
      refetch();
      showToast(`${selectedCount} product${selectedCount > 1 ? "s" : ""} moved to ${storeName}`, "success");
    } catch (err) {
      showToast("Failed to move products", "error");
    } finally {
      setIsBulkSaving(false);
    }
  }, [selectedIds, selectedCount]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedCount === 0) return;
    setIsBulkSaving(true);
    try {
      await bulkDeleteProductsMutation.mutateAsync({ productIds: Array.from(selectedIds) });
      clearSelection();
      refetch();
      showToast(`${selectedCount} product${selectedCount > 1 ? "s" : ""} deleted`, "success");
    } catch (err) {
      showToast("Failed to delete products", "error");
    } finally {
      setIsBulkSaving(false);
    }
  }, [selectedIds, selectedCount]);

  const handleBulkStockToggle = useCallback(async (status: "in_stock" | "out_of_stock") => {
    if (selectedCount === 0) return;
    setIsBulkSaving(true);
    try {
      await bulkSetStockStatusMutation.mutateAsync({ productIds: Array.from(selectedIds), stockStatus: status });
      clearSelection();
      refetch();
      const label = status === "in_stock" ? "In Stock" : "Out of Stock";
      showToast(`${selectedCount} product${selectedCount > 1 ? "s" : ""} set to ${label}`, "success");
    } catch (err) {
      showToast("Failed to update stock status", "error");
    } finally {
      setIsBulkSaving(false);
    }
  }, [selectedIds, selectedCount]);

  const handlePriceChange = useCallback((productId: number, field: "price" | "salePrice", value: string, originalValue: string) => {
    setPriceChanges(prev => {
      const existing = prev[productId] || {};
      const updated = { ...existing, [field]: value };
      if (value === originalValue) { delete updated[field]; }
      if (Object.keys(updated).length === 0) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productId]: updated };
    });
  }, []);

  const handleSaveAll = useCallback(async () => {
    if (changesCount === 0) return;
    setIsSaving(true);
    try {
      const updates = Object.entries(priceChanges).map(([id, changes]) => ({
        productId: parseInt(id),
        price: changes.price || products.find((p: any) => p.id === parseInt(id))?.price || "0",
        salePrice: changes.salePrice !== undefined ? changes.salePrice : undefined,
      }));
      await bulkUpdateMutation.mutateAsync({ updates });
      setPriceChanges({});
      refetch();
      setMessage(`${updates.length} price${updates.length > 1 ? "s" : ""} updated successfully`);
      setMessageType("success");
      setTimeout(() => { setMessage(""); setMessageType(""); }, 3000);
    } catch (err) {
      setMessage("Failed to save prices. Please try again.");
      setMessageType("error");
      setTimeout(() => { setMessage(""); setMessageType(""); }, 3000);
    } finally {
      setIsSaving(false);
    }
  }, [priceChanges, changesCount, products]);

  const handleDiscardAll = useCallback(() => {
    if (changesCount === 0) return;
    if (IS_WEB) {
      if (confirm(`Discard ${changesCount} unsaved price change${changesCount > 1 ? "s" : ""}?`)) {
        setPriceChanges({});
      }
    } else {
      Alert.alert("Discard Changes", `Discard ${changesCount} unsaved price change${changesCount > 1 ? "s" : ""}?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: () => setPriceChanges({}) },
      ]);
    }
  }, [changesCount]);

  // Open action menu — centered on screen instead of at click position
  const openActionMenu = useCallback((product: any) => {
    setActionMenu({
      visible: true,
      productId: product.id,
      productName: product.name,
      currentCategoryId: product.categoryId || product.category?.id || null,
      currentCategoryName: product.category?.name || "Uncategorized",
      currentStockStatus: product.stockStatus || "in_stock",
      isPinned: product.pinnedToTrending ?? false,
    });
    setSubMenu(null);
    setSubMenuSearch("");
  }, []);

  const closeActionMenu = useCallback(() => {
    setActionMenu(prev => ({ ...prev, visible: false, productId: null }));
    setSubMenu(null);
    setSubMenuSearch("");
  }, []);

  const showToast = useCallback((msg: string, type: "success" | "error") => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => { setMessage(""); setMessageType(""); }, 3000);
  }, []);

  const handleChangeCategory = useCallback(async (categoryId: number | null, categoryName: string) => {
    if (!actionMenu.productId) return;
    try {
      await changeCategoryMutation.mutateAsync({ productId: actionMenu.productId, categoryId });
      closeActionMenu();
      refetch();
      showToast(`"${actionMenu.productName}" moved to ${categoryName}`, "success");
    } catch (err) {
      showToast("Failed to change category", "error");
    }
  }, [actionMenu]);

  const handleMoveToStore = useCallback(async (targetStoreId: number, storeName: string) => {
    if (!actionMenu.productId) return;
    try {
      await moveToStoreMutation.mutateAsync({ productId: actionMenu.productId, targetStoreId });
      closeActionMenu();
      refetch();
      showToast(`"${actionMenu.productName}" moved to ${storeName}`, "success");
    } catch (err) {
      showToast("Failed to move product", "error");
    }
  }, [actionMenu]);

  const handleDuplicateToStore = useCallback(async (targetStoreId: number, storeName: string) => {
    if (!actionMenu.productId) return;
    try {
      await duplicateToStoreMutation.mutateAsync({ productId: actionMenu.productId, targetStoreId });
      closeActionMenu();
      showToast(`"${actionMenu.productName}" duplicated to ${storeName}`, "success");
    } catch (err) {
      showToast("Failed to duplicate product", "error");
    }
  }, [actionMenu]);

  const handleTogglePin = useCallback(async () => {
    if (!actionMenu.productId) return;
    const newPinned = !actionMenu.isPinned;
    try {
      await updateProductMutation.mutateAsync({ id: actionMenu.productId, pinnedToTrending: newPinned });
      closeActionMenu();
      refetch();
      showToast(newPinned ? `"${actionMenu.productName}" pinned to trending` : `"${actionMenu.productName}" unpinned from trending`, "success");
    } catch (err) {
      showToast("Failed to update pin status", "error");
    }
  }, [actionMenu]);

  const handleToggleStock = useCallback(async () => {
    if (!actionMenu.productId) return;
    const newStatus = actionMenu.currentStockStatus === "out_of_stock" ? "in_stock" : "out_of_stock";
    try {
      await toggleStockMutation.mutateAsync({ productId: actionMenu.productId, stockStatus: newStatus });
      closeActionMenu();
      refetch();
      showToast(
        `"${actionMenu.productName}" marked as ${newStatus === "out_of_stock" ? "Out of Stock" : "In Stock"}`,
        "success"
      );
    } catch (err) {
      showToast("Failed to update stock status", "error");
    }
  }, [actionMenu]);

  const filteredAllCategories = useMemo(() => {
    if (!allCategories) return [];
    const sorted = [...allCategories].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    if (!subMenuSearch.trim()) return sorted;
    const term = subMenuSearch.toLowerCase();
    return sorted.filter(c => c.name?.toLowerCase().includes(term));
  }, [allCategories, subMenuSearch]);

  const filteredBulkCategories = useMemo(() => {
    if (!allCategories) return [];
    const sorted = [...allCategories].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    if (!bulkCategorySearch.trim()) return sorted;
    const term = bulkCategorySearch.toLowerCase();
    return sorted.filter(c => c.name?.toLowerCase().includes(term));
  }, [allCategories, bulkCategorySearch]);

  const otherStores = useMemo(() => {
    if (!stores) return [];
    return stores.filter(s => s.id !== selectedStore);
  }, [stores, selectedStore]);

  const isAllSelected = products.length > 0 && selectedIds.size === products.length;

  // Render checkbox
  const renderCheckbox = useCallback((checked: boolean, onPress: () => void, size: number = 20) => (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.checkbox, { width: size, height: size, borderRadius: 4 }, checked && styles.checkboxChecked]}
    >
      {checked && <Text style={[styles.checkboxMark, { fontSize: size - 6 }]}>✓</Text>}
    </TouchableOpacity>
  ), []);

  // Render product row
  const renderProduct = useCallback(({ item }: { item: any }) => {
    const imageUrl = getFirstImageUrl(item.images);
    const changes = priceChanges[item.id];
    const currentPrice = changes?.price ?? item.price ?? "";
    const currentSalePrice = changes?.salePrice ?? item.salePrice ?? "";
    const priceChanged = changes?.price !== undefined;
    const salePriceChanged = changes?.salePrice !== undefined;
    const isOutOfStock = item.stockStatus === "out_of_stock";
    const isSelected = selectedIds.has(item.id);

    return (
      <View style={[styles.row, (priceChanged || salePriceChanged) && styles.rowChanged, isOutOfStock && styles.rowOutOfStock, isSelected && styles.rowSelected]}>
        <View style={styles.checkboxCell}>
          {renderCheckbox(isSelected, () => toggleSelectItem(item.id))}
        </View>

        <View style={styles.imageCell}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={[styles.productImage, isOutOfStock && { opacity: 0.4 }]} contentFit="cover" />
          ) : (
            <View style={[styles.productImage, styles.noImage]}>
              <Text style={{ fontSize: 16 }}>📦</Text>
            </View>
          )}
        </View>

        <View style={styles.nameCell}>
          <Text style={[styles.productName, { color: isOutOfStock ? "#999" : colors.foreground }]} numberOfLines={2}>
            {item.name}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
            <Text style={[styles.categoryLabel, { color: colors.muted }]} numberOfLines={1}>
              {item.category?.name || "Uncategorized"}
            </Text>
            {isOutOfStock && (
              <View style={styles.oosTag}>
                <Text style={styles.oosTagText}>OOS</Text>
              </View>
            )}
            {item.pinnedToTrending && (
              <View style={{ backgroundColor: "#F59E0B20", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                <Text style={{ color: "#F59E0B", fontSize: 9, fontWeight: "700" }}>★ PIN</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.priceCell}>
          <Text style={[styles.priceLabel, { color: colors.muted }]}>Current</Text>
          <Text style={[styles.currentPrice, { color: colors.foreground }]}>
            €{parseFloat(item.price || "0").toFixed(2)}
          </Text>
        </View>

        <View style={styles.priceCell}>
          <Text style={[styles.priceLabel, { color: colors.muted }]}>Price</Text>
          <View style={[styles.priceInputWrapper, priceChanged && styles.priceInputChanged]}>
            <Text style={styles.euroSign}>€</Text>
            <TextInput
              style={[styles.priceInput, { color: colors.foreground }]}
              value={currentPrice}
              onChangeText={(val) => handlePriceChange(item.id, "price", val, item.price || "")}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={colors.muted}
            />
          </View>
        </View>

        <View style={styles.priceCell}>
          <Text style={[styles.priceLabel, { color: colors.muted }]}>Sale</Text>
          <View style={[styles.priceInputWrapper, salePriceChanged && styles.priceInputChanged]}>
            <Text style={styles.euroSign}>€</Text>
            <TextInput
              style={[styles.priceInput, { color: colors.foreground }]}
              value={currentSalePrice}
              onChangeText={(val) => handlePriceChange(item.id, "salePrice", val, item.salePrice || "")}
              keyboardType="decimal-pad"
              placeholder="—"
              placeholderTextColor={colors.muted}
            />
          </View>
        </View>

        <TouchableOpacity
          onPress={() => {

            togglePvMutation.mutate({ productId: item.id }, {
              onSuccess: () => {

                const refetchResult = refetch();

                refetchResult.then((result) => {

                }).catch((err) => {

                });
              },
              onError: (err) => {
              },
            });
          }}
          style={[styles.actionBtn, { justifyContent: "center", alignItems: "center" }]}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              borderWidth: 2,
              borderColor: item.priceVerified ? "#22C55E" : "#EF4444",
              backgroundColor: item.priceVerified ? "#22C55E20" : "#EF444420",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text style={{ color: item.priceVerified ? "#22C55E" : "#EF4444", fontSize: 14, fontWeight: "700" }}>
              {item.priceVerified ? "✓" : "✗"}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => openActionMenu(item)}
          style={styles.actionBtn}
        >
          <Text style={styles.actionBtnText}>⋯</Text>
        </TouchableOpacity>
      </View>
    );
  }, [priceChanges, colors, handlePriceChange, openActionMenu, selectedIds, toggleSelectItem, renderCheckbox, togglePvMutation, refetch]);

  const ListHeader = useMemo(() => (
    <View style={styles.tableHeader}>
      <View style={styles.checkboxCell}>
        {renderCheckbox(isAllSelected, toggleSelectAll)}
      </View>
      <View style={styles.imageCell}>
        <Text style={[styles.headerText, { color: colors.muted }]}>IMG</Text>
      </View>
      <View style={styles.nameCell}>
        <Text style={[styles.headerText, { color: colors.muted }]}>PRODUCT</Text>
      </View>
      <View style={styles.priceCell}>
        <Text style={[styles.headerText, { color: colors.muted }]}>CURRENT</Text>
      </View>
      <View style={styles.priceCell}>
        <Text style={[styles.headerText, { color: colors.muted }]}>PRICE</Text>
      </View>
      <View style={styles.priceCell}>
        <Text style={[styles.headerText, { color: colors.muted }]}>SALE</Text>
      </View>
      <View style={styles.actionCol}>
        <Text style={[styles.headerText, { color: colors.muted }]}></Text>
      </View>
    </View>
  ), [colors, isAllSelected, toggleSelectAll, renderCheckbox]);

  const selectedCategoryName = selectedCategory === "all"
    ? "All Categories"
    : sortedCategories.find((c: any) => c.id === selectedCategory)?.name || "Unknown";

  // Render the bulk action popup
  const renderBulkActionPopup = () => {
    if (!bulkAction) return null;

    const popupContent = (
      <View style={styles.popupContainer}>
        <View style={styles.popupHeader}>
          <Text style={styles.popupProductName} numberOfLines={1}>
            {bulkAction === "category" ? "Move to Category" : bulkAction === "price" ? "Set Price" : "Set Sale Price"}
            {" "}({selectedCount} items)
          </Text>
          <TouchableOpacity onPress={() => setBulkAction(null)} style={styles.popupClose}>
            <Text style={styles.popupCloseText}>✕</Text>
          </TouchableOpacity>
        </View>

        {bulkAction === "category" && (
          <View>
            <TextInput
              style={styles.popupSearchInput}
              placeholder="Search categories..."
              placeholderTextColor="#999"
              value={bulkCategorySearch}
              onChangeText={setBulkCategorySearch}
              autoFocus
            />
            <ScrollView style={styles.popupScrollList}>
              {filteredBulkCategories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => handleBulkChangeCategory(cat.id, cat.name)}
                  style={styles.popupListItem}
                >
                  <Text style={styles.popupListItemText} numberOfLines={1}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
              {filteredBulkCategories.length === 0 && (
                <Text style={styles.popupEmpty}>No categories found</Text>
              )}
            </ScrollView>
            {isBulkSaving && (
              <View style={{ padding: 12, alignItems: "center" }}>
                <ActivityIndicator size="small" color="#0a7ea4" />
              </View>
            )}
          </View>
        )}

        {bulkAction === "price" && (
          <View style={{ padding: 14 }}>
            <Text style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>
              Set the same price for all {selectedCount} selected product{selectedCount > 1 ? "s" : ""}:
            </Text>
            <View style={[styles.priceInputWrapper, { marginBottom: 12 }]}>
              <Text style={styles.euroSign}>€</Text>
              <TextInput
                style={[styles.priceInput, { color: "#333", width: "100%" as any, flex: 1 }]}
                value={bulkPriceValue}
                onChangeText={setBulkPriceValue}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#999"
                autoFocus
              />
            </View>
            <TouchableOpacity
              onPress={handleBulkSetPrice}
              style={[styles.saveBtn, { paddingVertical: 10, alignItems: "center" }]}
              disabled={isBulkSaving || !bulkPriceValue.trim()}
            >
              {isBulkSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Apply Price</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {bulkAction === "salePrice" && (
          <View style={{ padding: 14 }}>
            <Text style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>
              Set sale price for all {selectedCount} selected product{selectedCount > 1 ? "s" : ""}:
            </Text>
            <View style={[styles.priceInputWrapper, { marginBottom: 12 }]}>
              <Text style={styles.euroSign}>€</Text>
              <TextInput
                style={[styles.priceInput, { color: "#333", width: "100%" as any, flex: 1 }]}
                value={bulkSalePriceValue}
                onChangeText={setBulkSalePriceValue}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#999"
                autoFocus
              />
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                onPress={handleBulkClearSalePrice}
                style={[styles.discardBtn, { flex: 1, paddingVertical: 10, alignItems: "center" }]}
                disabled={isBulkSaving}
              >
                <Text style={styles.discardBtnText}>Clear Sale Prices</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleBulkSetSalePrice}
                style={[styles.saveBtn, { flex: 1, paddingVertical: 10, alignItems: "center" }]}
                disabled={isBulkSaving || !bulkSalePriceValue.trim()}
              >
                {isBulkSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Apply Sale Price</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {bulkAction === "duplicateStore" && (
          <View>
            <Text style={styles.popupSubTitle}>Duplicate {selectedCount} product{selectedCount > 1 ? "s" : ""} to which store?</Text>
            {(stores || []).map((store) => (
              <TouchableOpacity
                key={store.id}
                onPress={() => handleBulkDuplicateToStore(store.id, store.name)}
                style={[styles.popupListItem, store.id === selectedStore && styles.popupListItemActive]}
                disabled={isBulkSaving}
              >
                <Text style={[styles.popupListItemText, store.id === selectedStore && { color: "#999" }]}>
                  {store.name}{store.id === selectedStore ? " (current)" : ""}
                </Text>
              </TouchableOpacity>
            ))}
            {isBulkSaving && (
              <View style={{ padding: 12, alignItems: "center" }}>
                <ActivityIndicator size="small" color="#0a7ea4" />
              </View>
            )}
          </View>
        )}

        {bulkAction === "moveStore" && (
          <View>
            <Text style={styles.popupSubTitle}>Move {selectedCount} product{selectedCount > 1 ? "s" : ""} to which store?</Text>
            <Text style={{ fontSize: 11, color: "#EF4444", paddingHorizontal: 14, marginBottom: 8 }}>Products will be removed from the current store.</Text>
            {(stores || []).filter(s => s.id !== selectedStore).map((store) => (
              <TouchableOpacity
                key={store.id}
                onPress={() => handleBulkMoveToStore(store.id, store.name)}
                style={styles.popupListItem}
                disabled={isBulkSaving}
              >
                <Text style={styles.popupListItemText}>{store.name}</Text>
              </TouchableOpacity>
            ))}
            {isBulkSaving && (
              <View style={{ padding: 12, alignItems: "center" }}>
                <ActivityIndicator size="small" color="#0a7ea4" />
              </View>
            )}
          </View>
        )}

        {bulkAction === "stockToggle" && (
          <View style={{ padding: 14 }}>
            <Text style={{ fontSize: 13, color: "#666", marginBottom: 12 }}>
              Set stock status for {selectedCount} selected product{selectedCount > 1 ? "s" : ""}:
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                onPress={() => handleBulkStockToggle("in_stock")}
                style={[styles.saveBtn, { flex: 1, paddingVertical: 12, alignItems: "center", backgroundColor: "#22C55E" }]}
                disabled={isBulkSaving}
              >
                {isBulkSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>\u2705 Mark In Stock</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleBulkStockToggle("out_of_stock")}
                style={[styles.saveBtn, { flex: 1, paddingVertical: 12, alignItems: "center", backgroundColor: "#EF4444" }]}
                disabled={isBulkSaving}
              >
                {isBulkSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>\u26D4 Mark Out of Stock</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {bulkAction === "delete" && (
          <View style={{ padding: 14 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#EF4444", marginBottom: 8 }}>
              \u26A0\uFE0F Delete {selectedCount} product{selectedCount > 1 ? "s" : ""}?
            </Text>
            <Text style={{ fontSize: 13, color: "#666", marginBottom: 14 }}>
              This action cannot be undone. The selected products will be permanently removed.
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                onPress={() => setBulkAction(null)}
                style={[styles.discardBtn, { flex: 1, paddingVertical: 12, alignItems: "center" }]}
              >
                <Text style={styles.discardBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleBulkDelete}
                style={[styles.saveBtn, { flex: 1, paddingVertical: 12, alignItems: "center", backgroundColor: "#EF4444" }]}
                disabled={isBulkSaving}
              >
                {isBulkSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Delete Permanently</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );

    if (IS_WEB) {
      return (
        <View style={styles.webOverlay as any}>
          <TouchableOpacity onPress={() => setBulkAction(null)} style={styles.webOverlayBackdrop as any} activeOpacity={1} />
          <View style={styles.webOverlayContent}>
            {popupContent}
          </View>
        </View>
      );
    }

    return (
      <Modal visible={!!bulkAction} transparent animationType="fade" onRequestClose={() => setBulkAction(null)}>
        <TouchableOpacity onPress={() => setBulkAction(null)} style={styles.modalBackdrop} activeOpacity={1}>
          <View style={styles.modalContent}>
            {popupContent}
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  // Render the action popup — always centered on screen
  const renderActionPopup = () => {
    if (!actionMenu.visible) return null;

    const isOOS = actionMenu.currentStockStatus === "out_of_stock";

    const popupContent = (
      <View style={styles.popupContainer}>
        <View style={styles.popupHeader}>
          <Text style={styles.popupProductName} numberOfLines={1}>{actionMenu.productName}</Text>
          <TouchableOpacity onPress={closeActionMenu} style={styles.popupClose}>
            <Text style={styles.popupCloseText}>✕</Text>
          </TouchableOpacity>
        </View>

        {!subMenu && (
          <View>
            {/* Out of Stock toggle */}
            <TouchableOpacity onPress={handleToggleStock} style={styles.popupAction}>
              <Text style={styles.popupActionIcon}>{isOOS ? "✅" : "🚫"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.popupActionText}>
                  {isOOS ? "Mark In Stock" : "Mark Out of Stock"}
                </Text>
                <Text style={styles.popupActionSub}>
                  {isOOS ? "Currently: Out of Stock" : "Currently: In Stock"}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleTogglePin} style={styles.popupAction}>
              <Text style={styles.popupActionIcon}>{actionMenu.isPinned ? "⭐" : "☆"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.popupActionText}>
                  {actionMenu.isPinned ? "Unpin from Trending" : "Pin to Trending"}
                </Text>
                <Text style={styles.popupActionSub}>
                  {actionMenu.isPinned ? "Currently: Pinned ★" : "Not pinned — ranked by sales only"}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => { setSubMenu("category"); setSubMenuSearch(""); }} style={styles.popupAction}>
              <Text style={styles.popupActionIcon}>📂</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.popupActionText}>Change Category</Text>
                <Text style={styles.popupActionSub}>Currently: {actionMenu.currentCategoryName}</Text>
              </View>
              <Text style={styles.popupChevron}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => { setSubMenu("moveStore"); setSubMenuSearch(""); }} style={styles.popupAction}>
              <Text style={styles.popupActionIcon}>📦</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.popupActionText}>Move to Store</Text>
                <Text style={styles.popupActionSub}>Remove from current store</Text>
              </View>
              <Text style={styles.popupChevron}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => { setSubMenu("duplicateStore"); setSubMenuSearch(""); }} style={styles.popupAction}>
              <Text style={styles.popupActionIcon}>📋</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.popupActionText}>Duplicate to Store</Text>
                <Text style={styles.popupActionSub}>Copy to another store</Text>
              </View>
              <Text style={styles.popupChevron}>›</Text>
            </TouchableOpacity>
          </View>
        )}

        {subMenu === "category" && (
          <View>
            <TouchableOpacity onPress={() => setSubMenu(null)} style={styles.popupBackBtn}>
              <Text style={styles.popupBackText}>← Back</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.popupSearchInput}
              placeholder="Search categories..."
              placeholderTextColor="#999"
              value={subMenuSearch}
              onChangeText={setSubMenuSearch}
              autoFocus
            />
            <ScrollView style={styles.popupScrollList}>
              {filteredAllCategories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => handleChangeCategory(cat.id, cat.name)}
                  style={[styles.popupListItem, cat.id === actionMenu.currentCategoryId && styles.popupListItemActive]}
                >
                  <Text style={[styles.popupListItemText, cat.id === actionMenu.currentCategoryId && styles.popupListItemTextActive]} numberOfLines={1}>
                    {cat.name}
                  </Text>
                  {cat.id === actionMenu.currentCategoryId && (
                    <Text style={styles.popupCheckmark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
              {filteredAllCategories.length === 0 && (
                <Text style={styles.popupEmpty}>No categories found</Text>
              )}
            </ScrollView>
          </View>
        )}

        {subMenu === "moveStore" && (
          <View>
            <TouchableOpacity onPress={() => setSubMenu(null)} style={styles.popupBackBtn}>
              <Text style={styles.popupBackText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.popupSubTitle}>Move to which store?</Text>
            {otherStores.map((store) => (
              <TouchableOpacity
                key={store.id}
                onPress={() => handleMoveToStore(store.id, store.name)}
                style={styles.popupListItem}
              >
                <Text style={styles.popupListItemText}>{store.name}</Text>
              </TouchableOpacity>
            ))}
            {otherStores.length === 0 && (
              <Text style={styles.popupEmpty}>No other stores available</Text>
            )}
          </View>
        )}

        {subMenu === "duplicateStore" && (
          <View>
            <TouchableOpacity onPress={() => setSubMenu(null)} style={styles.popupBackBtn}>
              <Text style={styles.popupBackText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.popupSubTitle}>Duplicate to which store?</Text>
            {(stores || []).map((store) => (
              <TouchableOpacity
                key={store.id}
                onPress={() => handleDuplicateToStore(store.id, store.name)}
                style={[styles.popupListItem, store.id === selectedStore && styles.popupListItemActive]}
              >
                <Text style={[styles.popupListItemText, store.id === selectedStore && { color: "#999" }]}>
                  {store.name}{store.id === selectedStore ? " (current)" : ""}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );

    // Use a centered overlay for both web and mobile
    if (IS_WEB) {
      return (
        <View style={styles.webOverlay as any}>
          <TouchableOpacity onPress={closeActionMenu} style={styles.webOverlayBackdrop as any} activeOpacity={1} />
          <View style={styles.webOverlayContent}>
            {popupContent}
          </View>
        </View>
      );
    }

    return (
      <Modal visible={actionMenu.visible} transparent animationType="fade" onRequestClose={closeActionMenu}>
        <TouchableOpacity onPress={closeActionMenu} style={styles.modalBackdrop} activeOpacity={1}>
          <View style={styles.modalContent}>
            {popupContent}
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  return (
    <ScreenContainer>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={{ color: "#0a7ea4", fontSize: 16 }}>← Back</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>Product Prices</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.storeSelector}>
          {stores?.map((store) => (
            <TouchableOpacity
              key={store.id}
              onPress={() => { setSelectedStore(store.id); setSelectedCategory("all"); setSearchQuery(""); setPage(0); }}
              style={[styles.storeTab, selectedStore === store.id && styles.storeTabActive]}
            >
              <Text style={[styles.storeTabText, selectedStore === store.id && styles.storeTabTextActive]}>
                {store.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.searchRow}>
          <TextInput
            style={[styles.searchInput, { color: colors.foreground, borderColor: colors.border }]}
            placeholder="Search products..."
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Out of Stock filter toggle */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            onPress={() => setShowOOSOnly(!showOOSOnly)}
            style={[styles.oosFilterBtn, showOOSOnly && styles.oosFilterBtnActive]}
          >
            <Text style={[styles.oosFilterText, showOOSOnly && styles.oosFilterTextActive]}>
              🚫 Out of Stock Only
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setPvFilter(pvFilter === "verified" ? "all" : "verified")}
            style={[styles.oosFilterBtn, pvFilter === "verified" && styles.oosFilterBtnActive, { backgroundColor: pvFilter === "verified" ? "#22C55E" : "transparent" }]}
          >
            <Text style={[styles.oosFilterText, pvFilter === "verified" && styles.oosFilterTextActive, { color: pvFilter === "verified" ? "#fff" : colors.foreground }]}>
              PV ✓ ({verifiedCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setPvFilter(pvFilter === "unverified" ? "all" : "unverified")}
            style={[styles.oosFilterBtn, pvFilter === "unverified" && styles.oosFilterBtnActive, { backgroundColor: pvFilter === "unverified" ? "#EF4444" : "transparent" }]}
          >
            <Text style={[styles.oosFilterText, pvFilter === "unverified" && styles.oosFilterTextActive, { color: pvFilter === "unverified" ? "#fff" : colors.foreground }]}>
              PV ✗ ({unverifiedCount})
            </Text>
          </TouchableOpacity>
          {(showOOSOnly || pvFilter !== "all") && (
            <TouchableOpacity onPress={() => { setShowOOSOnly(false); setPvFilter("all"); }}>
              <Text style={{ fontSize: 13, color: "#0a7ea4", fontWeight: "600" }}>Show All</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.categoryRow}>
          <TouchableOpacity
            onPress={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
            style={[styles.categoryDropdown, { borderColor: colors.border }]}
          >
            <Text style={[styles.categoryDropdownText, { color: colors.foreground }]} numberOfLines={1}>
              {selectedCategoryName}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{totalCount} products</Text>
            <Text style={{ color: colors.muted }}>▼</Text>
          </TouchableOpacity>

          {changesCount > 0 && (
            <View style={styles.changesBar}>
              <Text style={styles.changesText}>{changesCount} change{changesCount > 1 ? "s" : ""}</Text>
              <TouchableOpacity onPress={handleDiscardAll} style={styles.discardBtn}>
                <Text style={styles.discardBtnText}>Discard</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveAll} style={styles.saveBtn} disabled={isSaving}>
                {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save All</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {categoryDropdownOpen && (
          <View style={[styles.dropdownList, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <TextInput
              style={[styles.dropdownSearch, { color: colors.foreground, borderColor: colors.border }]}
              placeholder="Search categories..."
              placeholderTextColor={colors.muted}
              value={categorySearch}
              onChangeText={setCategorySearch}
              autoFocus
            />
            <TouchableOpacity
              onPress={() => { setSelectedCategory("all"); setCategoryDropdownOpen(false); setCategorySearch(""); }}
              style={[styles.dropdownItem, selectedCategory === "all" && styles.dropdownItemActive]}
            >
              <Text style={[styles.dropdownItemText, { color: colors.foreground }]}>All Categories</Text>
              <Text style={[styles.dropdownItemCount, { color: colors.muted }]}>
                {categorySummary.reduce((sum: number, c: any) => sum + c.count, 0)}
              </Text>
            </TouchableOpacity>
            {filteredCategoriesForDropdown.map((cat: any) => (
              <TouchableOpacity
                key={cat.id || "uncategorized"}
                onPress={() => { setSelectedCategory(cat.id || "all"); setCategoryDropdownOpen(false); setCategorySearch(""); }}
                style={[styles.dropdownItem, selectedCategory === cat.id && styles.dropdownItemActive]}
              >
                <Text style={[styles.dropdownItemText, { color: colors.foreground }]} numberOfLines={1}>
                  {cat.name || "Uncategorized"}
                </Text>
                <Text style={[styles.dropdownItemCount, { color: colors.muted }]}>{cat.count}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Bulk action bar */}
        {selectedCount > 0 && (
          <View style={styles.bulkBar}>
            <Text style={styles.bulkBarText}>{selectedCount} selected</Text>
            <TouchableOpacity onPress={() => { setBulkAction("price"); setBulkPriceValue(""); }} style={styles.bulkBtn}>
              <Text style={styles.bulkBtnText}>Set Price</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setBulkAction("salePrice"); setBulkSalePriceValue(""); }} style={styles.bulkBtn}>
              <Text style={styles.bulkBtnText}>Sale Price</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setBulkAction("category"); setBulkCategorySearch(""); }} style={styles.bulkBtn}>
              <Text style={styles.bulkBtnText}>Move Category</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setBulkAction("duplicateStore")} style={styles.bulkBtn}>
              <Text style={styles.bulkBtnText}>Duplicate to Store</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setBulkAction("moveStore")} style={styles.bulkBtn}>
              <Text style={styles.bulkBtnText}>Move to Store</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setBulkAction("stockToggle")} style={styles.bulkBtn}>
              <Text style={styles.bulkBtnText}>Stock Status</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setBulkAction("delete")} style={[styles.bulkBtn, { backgroundColor: "#EF4444" }]}>
              <Text style={styles.bulkBtnText}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={clearSelection} style={styles.bulkClearBtn}>
              <Text style={styles.bulkClearBtnText}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}

        {message !== "" && (
          <View style={[styles.messageBar, messageType === "success" ? styles.messageSuccess : styles.messageError]}>
            <Text style={styles.messageText}>{message}</Text>
          </View>
        )}

        <Text style={[styles.countText, { color: colors.muted }]}>
          Showing {products.length} of {totalCount} products (page {page + 1}/{Math.max(totalPages, 1)})
        </Text>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={products.filter((product: any) => {
              if (pvFilter === "verified") return product.priceVerified;
              if (pvFilter === "unverified") return !product.priceVerified;
              return true;
            })}
            keyExtractor={(item: any) => String(item.id)}
            renderItem={renderProduct}
            ListHeaderComponent={ListHeader}
            stickyHeaderIndices={[0]}
            style={styles.list}
            contentContainerStyle={{ paddingBottom: 100 }}
          />
        )}

        {totalPages > 1 && (
          <View style={styles.pagination}>
            <TouchableOpacity
              onPress={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              style={[styles.pageBtn, page === 0 && styles.pageBtnDisabled]}
            >
              <Text style={[styles.pageBtnText, page === 0 && { color: "#999" }]}>← Prev</Text>
            </TouchableOpacity>
            <Text style={[styles.pageInfo, { color: colors.foreground }]}>Page {page + 1} of {totalPages}</Text>
            <TouchableOpacity
              onPress={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              style={[styles.pageBtn, page >= totalPages - 1 && styles.pageBtnDisabled]}
            >
              <Text style={[styles.pageBtnText, page >= totalPages - 1 && { color: "#999" }]}>Next →</Text>
            </TouchableOpacity>
          </View>
        )}

        {changesCount > 0 && (
          <View style={styles.floatingSaveBar}>
            <Text style={styles.floatingText}>{changesCount} unsaved change{changesCount > 1 ? "s" : ""}</Text>
            <TouchableOpacity onPress={handleDiscardAll} style={styles.floatingDiscard}>
              <Text style={styles.floatingDiscardText}>Discard</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSaveAll} style={styles.floatingSave} disabled={isSaving}>
              {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.floatingSaveText}>Save All Prices</Text>}
            </TouchableOpacity>
          </View>
        )}

        {renderActionPopup()}
        {renderBulkActionPopup()}
      </View>
    </ScreenContainer>
  );
}

export default function ProductPricesScreen() {
  return (
    <AdminDesktopLayout>
      <ProductPricesContent />
    </AdminDesktopLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  backBtn: { width: 60 },
  title: { fontSize: 20, fontWeight: "700", textAlign: "center" },

  storeSelector: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  storeTab: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: "#f0f0f0", borderWidth: 1, borderColor: "#e0e0e0",
  },
  storeTabActive: { backgroundColor: "#0a7ea4", borderColor: "#0a7ea4" },
  storeTabText: { fontSize: 13, fontWeight: "600", color: "#666" },
  storeTabTextActive: { color: "#fff" },

  searchRow: { marginBottom: 10 },
  searchInput: {
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
  },

  categoryRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" },
  categoryDropdown: {
    flex: 1, minWidth: 200, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, gap: 8,
  },
  categoryDropdownText: { fontSize: 14, fontWeight: "600", flex: 1 },
  dropdownList: {
    borderWidth: 1, borderRadius: 8, maxHeight: 300, marginBottom: 8,
    ...(IS_WEB ? { overflowY: "auto" } : {}),
  } as any,
  dropdownSearch: {
    borderBottomWidth: 1, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14,
  },
  dropdownItem: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 10,
  },
  dropdownItemActive: { backgroundColor: "rgba(10, 126, 164, 0.1)" },
  dropdownItemText: { fontSize: 14, flex: 1 },
  dropdownItemCount: { fontSize: 12, marginLeft: 8, fontWeight: "600" },

  changesBar: { flexDirection: "row", alignItems: "center", gap: 8 },
  changesText: { fontSize: 13, fontWeight: "600", color: "#F59E0B" },
  discardBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: "#f0f0f0" },
  discardBtnText: { fontSize: 12, fontWeight: "600", color: "#666" },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 6, backgroundColor: "#22C55E" },
  saveBtnText: { fontSize: 12, fontWeight: "700", color: "#fff" },

  messageBar: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginBottom: 8 },
  messageSuccess: { backgroundColor: "#dcfce7" },
  messageError: { backgroundColor: "#fee2e2" },
  messageText: { fontSize: 13, fontWeight: "600" },

  // OOS filter
  filterRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  oosFilterBtn: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16, borderWidth: 1, borderColor: "#e0e0e0", backgroundColor: "#f8f8f8",
  },
  oosFilterBtnActive: { borderColor: "#EF4444", backgroundColor: "#FEF2F2" },
  oosFilterText: { fontSize: 12, fontWeight: "600", color: "#888" },
  oosFilterTextActive: { color: "#EF4444" },

  // Bulk action bar
  bulkBar: {
    flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8,
    backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#BFDBFE",
    flexWrap: "wrap",
  },
  bulkBarText: { fontSize: 13, fontWeight: "700", color: "#1D4ED8", marginRight: 4 },
  bulkBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
    backgroundColor: "#0a7ea4",
  },
  bulkBtnText: { fontSize: 12, fontWeight: "600", color: "#fff" },
  bulkClearBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
    backgroundColor: "#f0f0f0",
  },
  bulkClearBtnText: { fontSize: 12, fontWeight: "600", color: "#666" },

  // Checkbox
  checkbox: {
    borderWidth: 2, borderColor: "#ccc", alignItems: "center", justifyContent: "center",
    backgroundColor: "#fff",
  },
  checkboxChecked: {
    backgroundColor: "#0a7ea4", borderColor: "#0a7ea4",
  },
  checkboxMark: { color: "#fff", fontWeight: "800", lineHeight: 16 },
  checkboxCell: { width: 32, alignItems: "center", justifyContent: "center" },

  countText: { fontSize: 12, marginBottom: 6 },

  tableHeader: {
    flexDirection: "row", alignItems: "center", paddingVertical: 8,
    paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: "#e0e0e0",
    backgroundColor: "#f8f9fa",
  },
  headerText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },

  row: {
    flexDirection: "row", alignItems: "center", paddingVertical: 8,
    paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: "#eee",
  },
  rowChanged: { backgroundColor: "#FFFBEB" },
  rowOutOfStock: { backgroundColor: "#FEF2F2" },
  rowSelected: { backgroundColor: "#EFF6FF" },

  imageCell: { width: 44, marginRight: 8 },
  productImage: { width: 40, height: 40, borderRadius: 6 },
  noImage: { backgroundColor: "#f0f0f0", justifyContent: "center", alignItems: "center" },
  nameCell: { flex: 1, marginRight: 8 },
  productName: { fontSize: 13, fontWeight: "600", lineHeight: 18 },
  categoryLabel: { fontSize: 11 },
  priceCell: { width: 90, alignItems: "center" },
  priceLabel: { fontSize: 9, marginBottom: 2 },
  currentPrice: { fontSize: 14, fontWeight: "700" },

  // Out of stock tag
  oosTag: {
    backgroundColor: "#EF4444", borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1,
  },
  oosTagText: { fontSize: 8, fontWeight: "800", color: "#fff", letterSpacing: 0.5 },

  priceInputWrapper: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderColor: "#ddd", borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 4, backgroundColor: "#fff",
  },
  priceInputChanged: { borderColor: "#F59E0B", backgroundColor: "#FFFBEB" },
  euroSign: { fontSize: 13, color: "#666", marginRight: 2 },
  priceInput: { fontSize: 13, fontWeight: "600", width: 55, textAlign: "right", padding: 0 },

  actionBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
    marginLeft: 4,
  },
  actionBtnText: { fontSize: 18, fontWeight: "700", color: "#888", letterSpacing: 2 },
  actionCol: { width: 36 },

  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 40 },
  list: { flex: 1 },

  pagination: {
    flexDirection: "row", justifyContent: "center", alignItems: "center",
    gap: 16, paddingVertical: 12,
  },
  pageBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, backgroundColor: "#0a7ea4" },
  pageBtnDisabled: { backgroundColor: "#e0e0e0" },
  pageBtnText: { fontSize: 13, fontWeight: "600", color: "#fff" },
  pageInfo: { fontSize: 13, fontWeight: "600" },

  floatingSaveBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 12, paddingVertical: 12, paddingHorizontal: 16,
    backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e0e0e0",
    ...(IS_WEB ? { boxShadow: "0 -2px 8px rgba(0,0,0,0.1)" } : {}),
  } as any,
  floatingText: { fontSize: 13, fontWeight: "600", color: "#F59E0B" },
  floatingDiscard: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: "#f0f0f0" },
  floatingDiscardText: { fontSize: 13, fontWeight: "600", color: "#666" },
  floatingSave: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8, backgroundColor: "#22C55E" },
  floatingSaveText: { fontSize: 13, fontWeight: "700", color: "#fff" },

  // Centered overlay for web
  webOverlay: {
    position: "fixed" as any,
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 9998,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as any,
  webOverlayBackdrop: {
    position: "absolute" as any,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0,0,0,0.3)",
  } as any,
  webOverlayContent: {
    zIndex: 9999,
  },

  modalBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center", alignItems: "center",
  },
  modalContent: {
    width: "90%", maxWidth: 320,
  },
  popupContainer: {
    width: 280, backgroundColor: "#fff", borderRadius: 12,
    ...(IS_WEB ? { boxShadow: "0 8px 32px rgba(0,0,0,0.18)" } : {}),
    borderWidth: IS_WEB ? 0 : 1, borderColor: "#e0e0e0",
    overflow: "hidden",
  } as any,
  popupHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "#f0f0f0",
    backgroundColor: "#fafafa",
  },
  popupProductName: { fontSize: 13, fontWeight: "700", color: "#333", flex: 1, marginRight: 8 },
  popupClose: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#f0f0f0" },
  popupCloseText: { fontSize: 12, color: "#666", fontWeight: "700" },

  popupAction: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: "#f0f0f0",
  },
  popupActionIcon: { fontSize: 16, width: 24, textAlign: "center" },
  popupActionText: { fontSize: 13, fontWeight: "600", color: "#333" },
  popupActionSub: { fontSize: 11, color: "#999", marginTop: 1 },
  popupChevron: { fontSize: 18, color: "#ccc", fontWeight: "300" },

  popupBackBtn: { paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: "#f0f0f0" },
  popupBackText: { fontSize: 13, color: "#0a7ea4", fontWeight: "600" },

  popupSubTitle: { fontSize: 12, color: "#666", fontWeight: "600", paddingHorizontal: 14, paddingVertical: 8 },

  popupSearchInput: {
    paddingHorizontal: 14, paddingVertical: 8,
    fontSize: 13, borderBottomWidth: 1, borderBottomColor: "#f0f0f0",
    color: "#333",
  },
  popupScrollList: { maxHeight: 250 },
  popupListItem: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 0.5, borderBottomColor: "#f5f5f5",
  },
  popupListItemActive: { backgroundColor: "rgba(10, 126, 164, 0.08)" },
  popupListItemText: { fontSize: 13, color: "#333", flex: 1 },
  popupListItemTextActive: { color: "#0a7ea4", fontWeight: "600" },
  popupCheckmark: { fontSize: 14, color: "#0a7ea4", fontWeight: "700", marginLeft: 8 },
  popupEmpty: { fontSize: 13, color: "#999", textAlign: "center", paddingVertical: 16 },
});
