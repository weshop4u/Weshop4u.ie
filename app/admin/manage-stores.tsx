import { ScrollView, Text, View, TouchableOpacity, TextInput, ActivityIndicator, Switch, RefreshControl, StyleSheet, Platform, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";

import { AdminDesktopLayout } from "@/components/admin-desktop-layout";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const CATEGORIES = ["convenience", "restaurant", "hardware", "electrical", "clothing", "grocery", "pharmacy", "other"] as const;

type DayHours = { open: string; close: string; closed: boolean };
type WeekHours = Record<string, DayHours>;

const DEFAULT_HOURS: WeekHours = Object.fromEntries(
  DAYS.map(d => [d, { open: "08:00", close: "22:00", closed: false }])
);

function parseOpeningHours(json: string | null): WeekHours {
  if (!json) return { ...DEFAULT_HOURS };
  try {
    const parsed = JSON.parse(json);
    const result: WeekHours = {};
    for (const day of DAYS) {
      result[day] = parsed[day] || { open: "08:00", close: "22:00", closed: false };
    }
    return result;
  } catch {
    return { ...DEFAULT_HOURS };
  }
}

function ManageStoresScreenContent() {
  const colors = useColors();
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && windowWidth >= 1000;
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "hours" | "logo">("details");
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState<string>("convenience");
  const [editAddress, setEditAddress] = useState("");
  const [editEircode, setEditEircode] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editSortPosition, setEditSortPosition] = useState("999");

  // Hours state
  const [isOpen247, setIsOpen247] = useState(false);
  const [weekHours, setWeekHours] = useState<WeekHours>(DEFAULT_HOURS);

  // Add new store state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState<string>("convenience");
  const [newAddress, setNewAddress] = useState("");
  const [newEircode, setNewEircode] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newShortCode, setNewShortCode] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Duplicate store state
  const [showDuplicateForm, setShowDuplicateForm] = useState(false);
  const [dupName, setDupName] = useState("");
  const [dupAddress, setDupAddress] = useState("");
  const [dupEircode, setDupEircode] = useState("");
  const [dupShortCode, setDupShortCode] = useState("");
  const [dupPhone, setDupPhone] = useState("");
  const [dupEmail, setDupEmail] = useState("");
  const [dupCopyProducts, setDupCopyProducts] = useState(true);
  const [dupCopyModifiers, setDupCopyModifiers] = useState(true);
  const [duplicating, setDuplicating] = useState(false);

  const { data: storesList, isLoading, refetch } = trpc.admin.getAllStoresAdmin.useQuery();
  const updateStoreMutation = trpc.admin.updateStore.useMutation();
  const updateHoursMutation = trpc.admin.updateStoreHours.useMutation();
  const toggleActiveMutation = trpc.admin.toggleStoreActive.useMutation();
  const toggleFeaturedMutation = trpc.admin.toggleStoreFeatured.useMutation();
  const updateLogoMutation = trpc.admin.updateStoreLogo.useMutation();
  const uploadLogoMutation = trpc.stores.uploadLogo.useMutation();
  const createStoreMutation = trpc.admin.createStore.useMutation();
  const deleteStoreMutation = trpc.admin.deleteStore.useMutation();
  const duplicateStoreMutation = trpc.admin.duplicateStore.useMutation();

  // Logo upload state
  const [logoPreviewUri, setLogoPreviewUri] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const readImageAsBase64 = async (uri: string): Promise<{ base64: string; mimeType: string }> => {
    if (Platform.OS === "web") {
      const response = await fetch(uri);
      const blob = await response.blob();
      const mimeType = blob.type || "image/jpeg";
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          const base64 = dataUrl.split(",")[1];
          resolve({ base64, mimeType });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } else {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const ext = uri.split(".").pop()?.toLowerCase() || "jpg";
      const mimeMap: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" };
      const mimeType = mimeMap[ext] || "image/jpeg";
      return { base64, mimeType };
    }
  };

  const handlePickLogo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setLogoPreviewUri(result.assets[0].uri);
      }
    } catch (error: any) {
      setMessage(error.message || "Failed to pick image");
      setMessageType("error");
    }
  };

  const handleUploadLogo = async () => {
    if (!selectedStoreId || !logoPreviewUri) return;
    setIsUploadingLogo(true);
    setMessage("");
    try {
      const { base64, mimeType } = await readImageAsBase64(logoPreviewUri);
      const response = await uploadLogoMutation.mutateAsync({ base64, mimeType });
      await updateLogoMutation.mutateAsync({ storeId: selectedStoreId, logoUrl: response.url });
      setMessage("Logo uploaded successfully!");
      setMessageType("success");
      setLogoPreviewUri(null);
      refetch();
    } catch (error: any) {
      setMessage(error.message || "Failed to upload logo");
      setMessageType("error");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSaveLogoUrl = async (url: string) => {
    if (!selectedStoreId || !url.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      await updateLogoMutation.mutateAsync({ storeId: selectedStoreId, logoUrl: url.trim() });
      setMessage("Logo URL saved successfully!");
      setMessageType("success");
      refetch();
    } catch (error: any) {
      setMessage(error.message || "Failed to save logo URL");
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const selectStore = (store: any) => {
    setSelectedStoreId(store.id);
    setEditName(store.name || "");
    setEditDescription(store.description || "");
    setEditCategory(store.category || "convenience");
    setEditAddress(store.address || "");
    setEditEircode(store.eircode || "");
    setEditPhone(store.phone || "");
    setEditEmail(store.email || "");
    setEditSortPosition(String(store.sortPosition ?? 999));
    setIsOpen247(store.isOpen247 || false);
    setWeekHours(parseOpeningHours(store.openingHours));
    setActiveTab("details");
    setMessage("");
  };

  const handleSaveDetails = async () => {
    if (!selectedStoreId) return;
    setSaving(true);
    setMessage("");
    try {
      await updateStoreMutation.mutateAsync({
        storeId: selectedStoreId,
        name: editName.trim(),
        description: editDescription.trim(),
        category: editCategory as any,
        address: editAddress.trim(),
        eircode: editEircode.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim(),
        sortPosition: parseInt(editSortPosition) || 999,
      });
      setMessage("Store details updated successfully!");
      setMessageType("success");
      refetch();
    } catch (error: any) {
      setMessage(error.message || "Failed to update store");
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveHours = async () => {
    if (!selectedStoreId) return;
    setSaving(true);
    setMessage("");
    try {
      await updateHoursMutation.mutateAsync({
        storeId: selectedStoreId,
        isOpen247,
        openingHours: isOpen247 ? undefined : JSON.stringify(weekHours),
      });
      setMessage("Opening hours updated successfully!");
      setMessageType("success");
      refetch();
    } catch (error: any) {
      setMessage(error.message || "Failed to update hours");
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (storeId: number, currentActive: boolean) => {
    try {
      await toggleActiveMutation.mutateAsync({ storeId, isActive: !currentActive });
      refetch();
    } catch (error: any) {
      setMessage(error.message || "Failed to toggle store");
      setMessageType("error");
    }
  };

  const handleToggleFeatured = async (storeId: number, currentFeatured: boolean) => {
    try {
      await toggleFeaturedMutation.mutateAsync({ storeId, isFeatured: !currentFeatured });
      refetch();
    } catch (error: any) {
      setMessage(error.message || "Failed to toggle featured");
      setMessageType("error");
    }
  };

  const updateDayHours = (day: string, field: keyof DayHours, value: string | boolean) => {
    setWeekHours(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  const selectedStore = storesList?.find(s => s.id === selectedStoreId);

  const resetAddForm = () => {
    setNewName("");
    setNewDescription("");
    setNewCategory("convenience");
    setNewAddress("");
    setNewEircode("");
    setNewPhone("");
    setNewEmail("");
    setNewShortCode("");
  };

  const handleCreateStore = async () => {
    if (!newName.trim() || !newAddress.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      const result = await createStoreMutation.mutateAsync({
        name: newName.trim(),
        description: newDescription.trim() || undefined,
        category: newCategory as any,
        address: newAddress.trim(),
        eircode: newEircode.trim() || undefined,
        phone: newPhone.trim() || undefined,
        email: newEmail.trim() || undefined,
        shortCode: newShortCode.trim() || undefined,
      });
      setMessage(`Store "${newName.trim()}" created successfully!`);
      setMessageType("success");
      resetAddForm();
      setShowAddForm(false);
      await refetch();
      // Select the new store
      setSelectedStoreId(result.storeId);
    } catch (error: any) {
      setMessage(error.message || "Failed to create store");
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicateStore = async () => {
    if (!selectedStoreId || !dupName.trim() || !dupAddress.trim()) return;
    setDuplicating(true);
    setMessage("");
    try {
      const result = await duplicateStoreMutation.mutateAsync({
        sourceStoreId: selectedStoreId,
        newName: dupName.trim(),
        newAddress: dupAddress.trim(),
        newEircode: dupEircode.trim() || undefined,
        newShortCode: dupShortCode.trim() || undefined,
        newPhone: dupPhone.trim() || undefined,
        newEmail: dupEmail.trim() || undefined,
        copyProducts: dupCopyProducts,
        copyModifiers: dupCopyModifiers,
      });
      const stats = result.stats;
      setMessage(`Store duplicated! ${stats.productsCopied} products, ${stats.modifiersCopied} modifiers, ${stats.dealsCopied} deals copied. New store is set to Inactive — activate it when ready.`);
      setMessageType("success");
      setShowDuplicateForm(false);
      setDupName(""); setDupAddress(""); setDupEircode(""); setDupShortCode(""); setDupPhone(""); setDupEmail("");
      await refetch();
      setSelectedStoreId(result.storeId);
    } catch (error: any) {
      setMessage(error.message || "Failed to duplicate store");
      setMessageType("error");
    } finally {
      setDuplicating(false);
    }
  };

  // ─── Duplicate Store Form ───
  const renderDuplicateForm = () => (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", zIndex: 100 }}>
      <ScrollView style={{ maxHeight: "80%", width: "90%", maxWidth: 500 }} contentContainerStyle={{ flexGrow: 0 }}>
        <View style={{ backgroundColor: colors.background, borderRadius: 16, padding: 24, gap: 14 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground }}>Duplicate Store</Text>
            <TouchableOpacity onPress={() => setShowDuplicateForm(false)}>
              <Text style={{ fontSize: 14, color: colors.muted }}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <View style={{ backgroundColor: "#E0F7FA", borderRadius: 10, padding: 12 }}>
            <Text style={{ fontSize: 13, color: "#00838F", lineHeight: 18 }}>Cloning from: <Text style={{ fontWeight: "700" }}>{selectedStore?.name}</Text>. This will copy the store settings, opening hours{dupCopyProducts ? ", all products" : ""}{dupCopyModifiers ? ", modifiers & deals" : ""} to a new store.</Text>
          </View>
          <View>
            <Text style={styles.label}>New Store Name *</Text>
            <TextInput value={dupName} onChangeText={setDupName} style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]} placeholder={`e.g. ${selectedStore?.name?.replace(/Balbriggan/i, "Swords") || "Store Name"}`} placeholderTextColor={colors.muted} />
          </View>
          <View>
            <Text style={styles.label}>New Address *</Text>
            <TextInput value={dupAddress} onChangeText={setDupAddress} style={[styles.input, styles.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]} placeholder="Full address of new location" placeholderTextColor={colors.muted} multiline numberOfLines={2} />
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Eircode</Text>
              <TextInput value={dupEircode} onChangeText={setDupEircode} style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]} placeholder="e.g. K67 D868" placeholderTextColor={colors.muted} autoCapitalize="characters" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Short Code</Text>
              <TextInput value={dupShortCode} onChangeText={setDupShortCode} style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]} placeholder="e.g. SPS" placeholderTextColor={colors.muted} autoCapitalize="characters" maxLength={5} />
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Phone</Text>
              <TextInput value={dupPhone} onChangeText={setDupPhone} style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]} placeholder="Phone" placeholderTextColor={colors.muted} keyboardType="phone-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Email</Text>
              <TextInput value={dupEmail} onChangeText={setDupEmail} style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]} placeholder="Email" placeholderTextColor={colors.muted} keyboardType="email-address" autoCapitalize="none" />
            </View>
          </View>
          <View style={{ gap: 10, paddingTop: 4 }}>
            <TouchableOpacity onPress={() => setDupCopyProducts(!dupCopyProducts)} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: dupCopyProducts ? colors.primary : colors.border, backgroundColor: dupCopyProducts ? colors.primary : "transparent", justifyContent: "center", alignItems: "center" }}>
                {dupCopyProducts && <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>✓</Text>}
              </View>
              <Text style={{ fontSize: 14, color: colors.foreground }}>Copy all products</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setDupCopyModifiers(!dupCopyModifiers)} style={{ flexDirection: "row", alignItems: "center", gap: 10, opacity: dupCopyProducts ? 1 : 0.4 }} disabled={!dupCopyProducts}>
              <View style={{ width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: dupCopyModifiers && dupCopyProducts ? colors.primary : colors.border, backgroundColor: dupCopyModifiers && dupCopyProducts ? colors.primary : "transparent", justifyContent: "center", alignItems: "center" }}>
                {dupCopyModifiers && dupCopyProducts && <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>✓</Text>}
              </View>
              <Text style={{ fontSize: 14, color: colors.foreground }}>Copy modifiers & multi-buy deals</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={handleDuplicateStore} disabled={duplicating || !dupName.trim() || !dupAddress.trim()} style={[styles.saveButton, { backgroundColor: colors.primary, opacity: duplicating || !dupName.trim() || !dupAddress.trim() ? 0.5 : 1, marginTop: 4 }]}>
            {duplicating ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Duplicate Store</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );

  const handleDeleteStore = async () => {
    if (!selectedStoreId) return;
    setDeleting(true);
    setMessage("");
    try {
      await deleteStoreMutation.mutateAsync({ storeId: selectedStoreId });
      setMessage("Store deleted successfully.");
      setMessageType("success");
      setSelectedStoreId(null);
      setShowDeleteConfirm(false);
      refetch();
    } catch (error: any) {
      setMessage(error.message || "Failed to delete store");
      setMessageType("error");
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  // ─── Add New Store Form ───
  const renderAddStoreForm = () => (
    <View style={{ padding: 16, gap: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <Text style={{ fontSize: 20, fontWeight: "700", color: colors.foreground }}>Add New Store</Text>
        <TouchableOpacity onPress={() => { setShowAddForm(false); resetAddForm(); setMessage(""); }}>
          <Text style={{ fontSize: 14, color: colors.muted }}>Cancel</Text>
        </TouchableOpacity>
      </View>
      <View>
        <Text style={styles.label}>Store Name *</Text>
        <TextInput value={newName} onChangeText={setNewName} style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]} placeholder="e.g. Spar Swords" placeholderTextColor={colors.muted} />
      </View>
      <View>
        <Text style={styles.label}>Description</Text>
        <TextInput value={newDescription} onChangeText={setNewDescription} style={[styles.input, styles.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]} placeholder="Brief store description" placeholderTextColor={colors.muted} multiline numberOfLines={2} />
      </View>
      <View>
        <Text style={styles.label}>Category *</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity key={cat} onPress={() => setNewCategory(cat)} style={[styles.categoryChip, { borderColor: newCategory === cat ? colors.primary : colors.border, backgroundColor: newCategory === cat ? "#E0F7FA" : colors.surface }]}>
              <Text style={{ fontSize: 13, fontWeight: newCategory === cat ? "700" : "500", color: newCategory === cat ? colors.primary : colors.foreground }}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View>
        <Text style={styles.label}>Address *</Text>
        <TextInput value={newAddress} onChangeText={setNewAddress} style={[styles.input, styles.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]} placeholder="Full address" placeholderTextColor={colors.muted} multiline numberOfLines={2} />
      </View>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Eircode</Text>
          <TextInput value={newEircode} onChangeText={setNewEircode} style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]} placeholder="e.g. K32 D868" placeholderTextColor={colors.muted} autoCapitalize="characters" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Short Code</Text>
          <TextInput value={newShortCode} onChangeText={setNewShortCode} style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]} placeholder="e.g. SPR" placeholderTextColor={colors.muted} autoCapitalize="characters" maxLength={5} />
          <Text style={{ fontSize: 10, color: colors.muted, marginTop: 2 }}>Used in order numbers</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Phone</Text>
          <TextInput value={newPhone} onChangeText={setNewPhone} style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]} placeholder="Phone number" placeholderTextColor={colors.muted} keyboardType="phone-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Email</Text>
          <TextInput value={newEmail} onChangeText={setNewEmail} style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]} placeholder="Email" placeholderTextColor={colors.muted} keyboardType="email-address" autoCapitalize="none" />
        </View>
      </View>
      <TouchableOpacity onPress={handleCreateStore} disabled={saving || !newName.trim() || !newAddress.trim()} style={[styles.saveButton, { backgroundColor: "#22C55E", opacity: saving || !newName.trim() || !newAddress.trim() ? 0.5 : 1 }]}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Create Store</Text>}
      </TouchableOpacity>
    </View>
  );

  // ─── Delete Confirmation Modal ───
  const renderDeleteConfirm = () => (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", zIndex: 100 }}>
      <View style={{ backgroundColor: colors.background, borderRadius: 16, padding: 24, maxWidth: 400, width: "90%", gap: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground }}>Delete Store?</Text>
        <Text style={{ fontSize: 14, color: colors.muted, lineHeight: 20 }}>Are you sure you want to delete "{selectedStore?.name}"? This will also delete all products in this store. This action cannot be undone.</Text>
        <Text style={{ fontSize: 13, color: colors.error, fontWeight: "600" }}>Note: Stores with existing orders cannot be deleted — they can only be deactivated.</Text>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <TouchableOpacity onPress={() => setShowDeleteConfirm(false)} style={{ flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: "center" }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDeleteStore} disabled={deleting} style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: "#EF4444", alignItems: "center", opacity: deleting ? 0.5 : 1 }}>
            {deleting ? <ActivityIndicator color="#fff" /> : <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>Delete</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  // ─── Shared render functions for tab content (used by both desktop and mobile) ───
  const renderDetailsTab = () => (
    <View className="p-4 gap-4">
      <View>
        <Text style={styles.label}>Store Name *</Text>
        <TextInput
          value={editName}
          onChangeText={setEditName}
          style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
          placeholder="Store name"
          placeholderTextColor={colors.muted}
        />
      </View>
      <View>
        <Text style={styles.label}>Description</Text>
        <TextInput
          value={editDescription}
          onChangeText={setEditDescription}
          style={[styles.input, styles.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
          placeholder="Store description"
          placeholderTextColor={colors.muted}
          multiline
          numberOfLines={3}
        />
      </View>
      <View>
        <Text style={styles.label}>Category</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat}
              onPress={() => setEditCategory(cat)}
              style={[
                styles.categoryChip,
                { borderColor: editCategory === cat ? colors.primary : colors.border, backgroundColor: editCategory === cat ? "#E0F7FA" : colors.surface },
              ]}
            >
              <Text style={{ fontSize: 13, fontWeight: editCategory === cat ? "700" : "500", color: editCategory === cat ? colors.primary : colors.foreground }}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View>
        <Text style={styles.label}>Address</Text>
        <TextInput
          value={editAddress}
          onChangeText={setEditAddress}
          style={[styles.input, styles.textArea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
          placeholder="Full address"
          placeholderTextColor={colors.muted}
          multiline
          numberOfLines={2}
        />
      </View>
      <View>
        <Text style={styles.label}>Eircode</Text>
        <TextInput
          value={editEircode}
          onChangeText={setEditEircode}
          style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
          placeholder="e.g. K32 D868"
          placeholderTextColor={colors.muted}
          autoCapitalize="characters"
        />
        <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>Updating Eircode will re-calculate store GPS coordinates</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Phone</Text>
          <TextInput
            value={editPhone}
            onChangeText={setEditPhone}
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            placeholder="Phone number"
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={editEmail}
            onChangeText={setEditEmail}
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            placeholder="Email"
            placeholderTextColor={colors.muted}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>
      </View>
      <View>
        <Text style={[styles.label, { color: colors.foreground }]}>Display Position (1 = top of list)</Text>
        <TextInput
          value={editSortPosition}
          onChangeText={setEditSortPosition}
          style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
          placeholder="999"
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
        />
        <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>Lower number = higher in customer store list. Set 1 for featured/top position.</Text>
      </View>
      {selectedStore?.latitude && selectedStore?.longitude ? (
        <View style={[styles.infoBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ fontSize: 12, color: colors.muted }}>GPS Coordinates</Text>
          <Text style={{ fontSize: 13, color: colors.foreground, fontWeight: "600", marginTop: 2 }}>
            {parseFloat(selectedStore.latitude).toFixed(6)}, {parseFloat(selectedStore.longitude).toFixed(6)}
          </Text>
        </View>
      ) : null}
      <TouchableOpacity
        onPress={handleSaveDetails}
        disabled={saving || !editName.trim()}
        style={[styles.saveButton, { opacity: saving || !editName.trim() ? 0.5 : 1 }]}
      >
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Details</Text>}
      </TouchableOpacity>
    </View>
  );

  const renderHoursTab = () => (
    <View className="p-4 gap-4">
      <View style={[styles.toggleCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>Open 24/7</Text>
          <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>Store is always open, no specific hours</Text>
        </View>
        <Switch
          value={isOpen247}
          onValueChange={setIsOpen247}
          trackColor={{ false: "#E5E7EB", true: "#86EFAC" }}
          thumbColor={isOpen247 ? "#22C55E" : "#9CA3AF"}
        />
      </View>
      {!isOpen247 && (
        <View className="gap-3">
          {DAYS.map(day => {
            const dh = weekHours[day];
            return (
              <View key={day} style={[styles.dayRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <Text style={{ fontSize: 15, fontWeight: "600", color: dh.closed ? colors.muted : colors.foreground }}>{day}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ fontSize: 12, color: colors.muted }}>{dh.closed ? "Closed" : "Open"}</Text>
                    <Switch
                      value={!dh.closed}
                      onValueChange={(val) => updateDayHours(day, "closed", !val)}
                      trackColor={{ false: "#FEE2E2", true: "#86EFAC" }}
                      thumbColor={!dh.closed ? "#22C55E" : "#EF4444"}
                    />
                  </View>
                </View>
                {!dh.closed && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 4 }}>Opens</Text>
                      <TextInput
                        value={dh.open}
                        onChangeText={(v) => updateDayHours(day, "open", v)}
                        style={[styles.timeInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                        placeholder="08:00"
                        placeholderTextColor={colors.muted}
                      />
                    </View>
                    <Text style={{ fontSize: 16, color: colors.muted, marginTop: 14 }}>&mdash;</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 4 }}>Closes</Text>
                      <TextInput
                        value={dh.close}
                        onChangeText={(v) => updateDayHours(day, "close", v)}
                        style={[styles.timeInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                        placeholder="22:00"
                        placeholderTextColor={colors.muted}
                      />
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
      <TouchableOpacity
        onPress={handleSaveHours}
        disabled={saving}
        style={[styles.saveButton, { opacity: saving ? 0.5 : 1 }]}
      >
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Hours</Text>}
      </TouchableOpacity>
    </View>
  );

  const [logoUrlInput, setLogoUrlInput] = useState("");

  const renderLogoTab = () => (
    <View className="p-4 gap-4">
      {/* Current Logo */}
      <View style={[styles.infoBox, { backgroundColor: colors.surface, borderColor: colors.border, alignItems: "center", padding: 20 }]}>
        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground, marginBottom: 12 }}>Current Logo</Text>
        {selectedStore?.logo ? (
          <Image source={{ uri: selectedStore.logo }} style={{ width: 120, height: 120, borderRadius: 16 }} contentFit="cover" />
        ) : (
          <View style={{ width: 120, height: 120, borderRadius: 16, backgroundColor: "#E0F7FA", justifyContent: "center", alignItems: "center" }}>
            <Text style={{ fontSize: 40 }}>{"\ud83c\udfea"}</Text>
            <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>No logo set</Text>
          </View>
        )}
      </View>

      {/* Upload Image */}
      <View style={[styles.infoBox, { backgroundColor: colors.surface, borderColor: colors.border, padding: 20 }]}>
        <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground, marginBottom: 12 }}>Upload Image</Text>
        {logoPreviewUri ? (
          <View style={{ alignItems: "center", gap: 12 }}>
            <Image source={{ uri: logoPreviewUri }} style={{ width: 120, height: 120, borderRadius: 16 }} contentFit="cover" />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={handleUploadLogo}
                disabled={isUploadingLogo}
                style={{ backgroundColor: "#22C55E", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, opacity: isUploadingLogo ? 0.5 : 1 }}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
                  {isUploadingLogo ? "Uploading..." : "Save Logo"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setLogoPreviewUri(null)}
                disabled={isUploadingLogo}
                style={{ backgroundColor: colors.border, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}
              >
                <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 13 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            onPress={handlePickLogo}
            style={{ backgroundColor: "#00E5FF", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, alignItems: "center" }}
          >
            <Text style={{ color: "#0F172A", fontWeight: "700", fontSize: 14 }}>Choose Image from Device</Text>
          </TouchableOpacity>
        )}
        <Text style={{ fontSize: 11, color: colors.muted, marginTop: 8 }}>Select a square image for best results (JPG, PNG)</Text>
      </View>

      {/* Logo URL (manual) */}
      <View style={[styles.infoBox, { backgroundColor: colors.surface, borderColor: colors.border, padding: 20 }]}>
        <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground, marginBottom: 12 }}>Logo URL</Text>
        <TextInput
          value={logoUrlInput}
          onChangeText={setLogoUrlInput}
          style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
          placeholder={selectedStore?.logo || "Paste logo URL here..."}
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          onPress={() => handleSaveLogoUrl(logoUrlInput)}
          disabled={saving || !logoUrlInput.trim()}
          style={{ backgroundColor: "#0284C7", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, alignSelf: "flex-start", marginTop: 10, opacity: saving || !logoUrlInput.trim() ? 0.5 : 1 }}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>{saving ? "Saving..." : "Save URL"}</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 11, color: colors.muted, marginTop: 6 }}>Or paste a direct URL to an image hosted elsewhere</Text>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color="#00E5FF" />
        <Text className="text-foreground mt-4">Loading stores...</Text>
      </ScreenContainer>
    );
  }

  // ─── DESKTOP: Side-by-side layout (store list left, edit panel right) ───
  if (isDesktop) {
    return (
      <View style={{ flex: 1, flexDirection: "row" }}>
        {showDeleteConfirm && renderDeleteConfirm()}
        {showDuplicateForm && renderDuplicateForm()}
        {/* Left: Store List */}
        <ScrollView style={{ width: 340, borderRightWidth: 1, borderRightColor: colors.border, backgroundColor: colors.surface }}>
          <View style={{ padding: 16 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground }}>Stores</Text>
              <TouchableOpacity onPress={() => { setShowAddForm(true); setSelectedStoreId(null); resetAddForm(); setMessage(""); }} style={{ backgroundColor: "#22C55E", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>+ Add</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 16 }}>{storesList?.length || 0} registered</Text>
            {storesList?.map((store) => (
              <TouchableOpacity
                key={store.id}
                onPress={() => selectStore(store)}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 10, marginBottom: 8,
                  backgroundColor: selectedStoreId === store.id ? "#E0F7FA" : colors.background,
                  borderWidth: 1, borderColor: selectedStoreId === store.id ? "#00E5FF" : colors.border,
                }}
              >
                {store.logo ? (
                  <Image source={{ uri: store.logo }} style={{ width: 40, height: 40, borderRadius: 8 }} contentFit="cover" />
                ) : (
                  <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: "#E0F7FA", justifyContent: "center", alignItems: "center" }}>
                    <Text style={{ fontSize: 18 }}>🏪</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }} numberOfLines={1}>{store.name}</Text>
                  <Text style={{ fontSize: 11, color: colors.muted }}>{store.category} {store.isActive ? "\u00b7 Active" : "\u00b7 Inactive"}</Text>
                </View>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: store.isActive ? "#22C55E" : "#EF4444" }} />
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Right: Edit Panel */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
          {showAddForm ? (
            <View>
              {message ? (
                <View style={[styles.messageBox, { borderColor: messageType === "error" ? colors.error : "#22C55E", backgroundColor: messageType === "error" ? "#FEE2E2" : "#DCFCE7", marginBottom: 16 }]}>
                  <Text style={{ color: messageType === "error" ? colors.error : "#16A34A", fontWeight: "600" }}>{message}</Text>
                </View>
              ) : null}
              {renderAddStoreForm()}
            </View>
          ) : selectedStoreId && selectedStore ? (
            <View>
              {/* Store Header */}
              <View style={{ marginBottom: 20 }}>
                {/* Top row: logo + name */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 12 }}>
                  {selectedStore.logo ? (
                    <Image source={{ uri: selectedStore.logo }} style={{ width: 56, height: 56, borderRadius: 12 }} contentFit="cover" />
                  ) : (
                    <View style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: "#E0F7FA", justifyContent: "center", alignItems: "center" }}>
                      <Text style={{ fontSize: 24 }}>🏪</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 22, fontWeight: "700", color: colors.foreground }} numberOfLines={1}>{selectedStore.name}</Text>
                    <Text style={{ fontSize: 13, color: colors.muted }}>
                      {selectedStore.category.charAt(0).toUpperCase() + selectedStore.category.slice(1)}
                      {selectedStore.isActive ? " \u00b7 Active" : " \u00b7 Inactive"}
                    </Text>
                  </View>
                </View>
                {/* Controls row: toggles + buttons */}
                <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
                    <Text style={{ fontSize: 12, color: colors.muted }}>Active</Text>
                    <Switch
                      value={selectedStore.isActive ?? true}
                      onValueChange={() => handleToggleActive(selectedStore.id, selectedStore.isActive ?? true)}
                      trackColor={{ false: "#E5E7EB", true: "#86EFAC" }}
                      thumbColor={selectedStore.isActive ? "#22C55E" : "#9CA3AF"}
                    />
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}>
                    <Text style={{ fontSize: 12, color: colors.muted }}>Featured</Text>
                    <Switch
                      value={(selectedStore as any).isFeatured ?? false}
                      onValueChange={() => handleToggleFeatured(selectedStore.id, (selectedStore as any).isFeatured ?? false)}
                      trackColor={{ false: "#E5E7EB", true: "#B2EBF2" }}
                      thumbColor={(selectedStore as any).isFeatured ? "#00E5FF" : "#9CA3AF"}
                    />
                  </View>
                  <TouchableOpacity onPress={() => setShowDuplicateForm(true)} style={{ backgroundColor: "#E0F2FE", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: "#BAE6FD" }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#0284C7" }}>Duplicate</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowDeleteConfirm(true)} style={{ backgroundColor: "#FEE2E2", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: "#FECACA" }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#EF4444" }}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Tabs */}
              <View style={[styles.tabBar, { borderBottomColor: colors.border, marginBottom: 20 }]}>
                {(["details", "hours", "logo"] as const).map(tab => (
                  <TouchableOpacity
                    key={tab}
                    onPress={() => { setActiveTab(tab); setMessage(""); }}
                    style={[styles.tab, activeTab === tab && { borderBottomColor: "#00E5FF", borderBottomWidth: 2 }]}
                  >
                    <Text style={{ fontSize: 14, fontWeight: activeTab === tab ? "700" : "500", color: activeTab === tab ? "#00E5FF" : colors.muted }}>
                      {tab === "details" ? "\u2699\ufe0f Details" : tab === "hours" ? "\u23f0 Hours" : "\ud83d\uddbc\ufe0f Logo"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Message */}
              {message ? (
                <View style={[styles.messageBox, { borderColor: messageType === "error" ? colors.error : "#22C55E", backgroundColor: messageType === "error" ? "#FEE2E2" : "#DCFCE7", marginBottom: 16 }]}>
                  <Text style={{ color: messageType === "error" ? colors.error : "#16A34A", fontWeight: "600" }}>{message}</Text>
                </View>
              ) : null}

              {/* Render the same tab content as mobile */}
              {activeTab === "details" && renderDetailsTab()}
              {activeTab === "hours" && renderHoursTab()}
              {activeTab === "logo" && renderLogoTab()}
            </View>
          ) : (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 80 }}>
              <Text style={{ fontSize: 48, marginBottom: 16 }}>🏪</Text>
              <Text style={{ fontSize: 18, fontWeight: "600", color: colors.foreground }}>Select a store</Text>
              <Text style={{ fontSize: 14, color: colors.muted, marginTop: 4 }}>Choose a store from the left panel to edit its details</Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // ─── MOBILE: Store List View ───
  if (!selectedStoreId) {
    return (
      <ScreenContainer className="bg-background">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00E5FF" />}
        >
          <View className="p-4">
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <Text className="text-2xl font-bold text-foreground">Manage Stores</Text>
              <TouchableOpacity onPress={() => { setShowAddForm(true); resetAddForm(); setMessage(""); }} style={{ backgroundColor: "#22C55E", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>+ Add Store</Text>
              </TouchableOpacity>
            </View>
            <Text className="text-sm text-muted mb-4">{storesList?.length || 0} stores registered</Text>

            {showAddForm && (
              <View style={[styles.storeCard, { backgroundColor: colors.surface, borderColor: colors.primary, marginBottom: 16 }]}>
                {renderAddStoreForm()}
              </View>
            )}

            {message ? (
              <View style={[styles.messageBox, { borderColor: messageType === "error" ? colors.error : "#22C55E", backgroundColor: messageType === "error" ? "#FEE2E2" : "#DCFCE7" }]}>
                <Text style={{ color: messageType === "error" ? colors.error : "#16A34A", fontWeight: "600" }}>{message}</Text>
              </View>
            ) : null}

            <View className="gap-3">
              {storesList?.map((store) => (
                <TouchableOpacity
                  key={store.id}
                  onPress={() => selectStore(store)}
                  style={[styles.storeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={styles.storeCardRow}>
                    {store.logo ? (
                      <Image source={{ uri: store.logo }} style={styles.storeLogo} contentFit="cover" />
                    ) : (
                      <View style={[styles.storeLogo, { backgroundColor: "#E0F7FA", justifyContent: "center", alignItems: "center" }]}>
                        <Text style={{ fontSize: 22 }}>🏪</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground, flex: 1 }}>{store.name}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: store.isActive ? "#DCFCE7" : "#FEE2E2" }]}>
                          <Text style={{ fontSize: 11, fontWeight: "700", color: store.isActive ? "#16A34A" : "#DC2626" }}>
                            {store.isActive ? "Active" : "Inactive"}
                          </Text>
                        </View>
                        {(store as any).isFeatured && (
                          <View style={[styles.statusBadge, { backgroundColor: "#E0F7FA" }]}>
                            <Text style={{ fontSize: 11, fontWeight: "700", color: "#00838F" }}>
                              Featured
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>
                        {store.category.charAt(0).toUpperCase() + store.category.slice(1)}
                        {store.isOpen247 ? " · Open 24/7" : ""}
                      </Text>
                      {store.address ? (
                        <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }} numberOfLines={1}>{store.address}</Text>
                      ) : null}
                      {store.phone ? (
                        <Text style={{ fontSize: 12, color: colors.muted, marginTop: 1 }}>{store.phone}</Text>
                      ) : null}
                    </View>
                    <Text style={{ fontSize: 20, color: colors.muted }}>›</Text>
                  </View>

                  {/* Quick toggles */}
                  <View style={[styles.toggleRow, { borderTopColor: colors.border }]}>
                    <Text style={{ fontSize: 13, color: colors.muted }}>Store Active</Text>
                    <Switch
                      value={store.isActive ?? true}
                      onValueChange={() => handleToggleActive(store.id, store.isActive ?? true)}
                      trackColor={{ false: "#E5E7EB", true: "#86EFAC" }}
                      thumbColor={store.isActive ? "#22C55E" : "#9CA3AF"}
                    />
                  </View>
                  <View style={[styles.toggleRow, { borderTopColor: colors.border }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={{ fontSize: 13, color: colors.muted }}>Featured on Homepage</Text>
                      {(store as any).isFeatured && <Text style={{ fontSize: 11, color: "#00E5FF", fontWeight: "700" }}>⭐</Text>}
                    </View>
                    <Switch
                      value={(store as any).isFeatured ?? false}
                      onValueChange={() => handleToggleFeatured(store.id, (store as any).isFeatured ?? false)}
                      trackColor={{ false: "#E5E7EB", true: "#B2EBF2" }}
                      thumbColor={(store as any).isFeatured ? "#00E5FF" : "#9CA3AF"}
                    />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // Store Edit View
  return (
    <ScreenContainer className="bg-background">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Back + Store Name */}
        <View style={[styles.editHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => { setSelectedStoreId(null); setMessage(""); }} style={{ padding: 4 }}>
            <Text style={{ fontSize: 28, color: colors.primary, fontWeight: "300" }}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground }}>{selectedStore?.name}</Text>
            <Text style={{ fontSize: 13, color: colors.muted }}>
              {selectedStore?.category ? selectedStore.category.charAt(0).toUpperCase() + selectedStore.category.slice(1) : ""}
              {selectedStore?.isActive ? " · Active" : " · Inactive"}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setShowDuplicateForm(true)} style={{ backgroundColor: "#E0F2FE", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginRight: 6 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#0284C7" }}>Duplicate</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowDeleteConfirm(true)} style={{ backgroundColor: "#FEE2E2", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#EF4444" }}>Delete</Text>
          </TouchableOpacity>
        </View>
        {showDeleteConfirm && renderDeleteConfirm()}
        {showDuplicateForm && renderDuplicateForm()}

        {/* Tab Bar */}
        <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
          {(["details", "hours", "logo"] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              onPress={() => { setActiveTab(tab); setMessage(""); }}
              style={[styles.tab, activeTab === tab && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            >
              <Text style={{ fontSize: 14, fontWeight: activeTab === tab ? "700" : "500", color: activeTab === tab ? colors.primary : colors.muted }}>
                {tab === "details" ? "Details" : tab === "hours" ? "Hours" : "Logo"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Message */}
        {message ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <View style={[styles.messageBox, { borderColor: messageType === "error" ? colors.error : "#22C55E", backgroundColor: messageType === "error" ? "#FEE2E2" : "#DCFCE7" }]}>
              <Text style={{ color: messageType === "error" ? colors.error : "#16A34A", fontWeight: "600" }}>{message}</Text>
            </View>
          </View>
        ) : null}

        {/* Details Tab */}
        {activeTab === "details" && renderDetailsTab()}

        {/* Hours Tab */}
        {activeTab === "hours" && renderHoursTab()}

        {/* Logo Tab */}
        {activeTab === "logo" && renderLogoTab()}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  storeCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  storeCardRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  storeLogo: {
    width: 48,
    height: 48,
    borderRadius: 10,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  editHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#687076",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  textArea: {
    minHeight: 60,
    textAlignVertical: "top",
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  infoBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  saveButton: {
    backgroundColor: "#0a7ea4",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  toggleCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  dayRow: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  timeInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    textAlign: "center",
  },
  messageBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
});

export default function ManageStoresScreen() {
  return (
    <AdminDesktopLayout title="Manage Stores">
      <ManageStoresScreenContent />
    </AdminDesktopLayout>
  );
}
