import { ScrollView, Text, View, TouchableOpacity, TextInput, ActivityIndicator, Switch, RefreshControl, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";

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

export default function ManageStoresScreen() {
  const colors = useColors();
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

  const { data: storesList, isLoading, refetch } = trpc.admin.getAllStoresAdmin.useQuery();
  const updateStoreMutation = trpc.admin.updateStore.useMutation();
  const updateHoursMutation = trpc.admin.updateStoreHours.useMutation();
  const toggleActiveMutation = trpc.admin.toggleStoreActive.useMutation();
  const updateLogoMutation = trpc.admin.updateStoreLogo.useMutation();

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

  const updateDayHours = (day: string, field: keyof DayHours, value: string | boolean) => {
    setWeekHours(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  const selectedStore = storesList?.find(s => s.id === selectedStoreId);

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color="#00E5FF" />
        <Text className="text-foreground mt-4">Loading stores...</Text>
      </ScreenContainer>
    );
  }

  // Store List View
  if (!selectedStoreId) {
    return (
      <ScreenContainer className="bg-background">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00E5FF" />}
        >
          <View className="p-4">
            <Text className="text-2xl font-bold text-foreground mb-1">Manage Stores</Text>
            <Text className="text-sm text-muted mb-4">{storesList?.length || 0} stores registered</Text>

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

                  {/* Quick toggle */}
                  <View style={[styles.toggleRow, { borderTopColor: colors.border }]}>
                    <Text style={{ fontSize: 13, color: colors.muted }}>Store Active</Text>
                    <Switch
                      value={store.isActive ?? true}
                      onValueChange={() => handleToggleActive(store.id, store.isActive ?? true)}
                      trackColor={{ false: "#E5E7EB", true: "#86EFAC" }}
                      thumbColor={store.isActive ? "#22C55E" : "#9CA3AF"}
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
        </View>

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
        {activeTab === "details" && (
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

            {/* Sort Position */}
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

            {/* GPS Coordinates (read-only) */}
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
        )}

        {/* Hours Tab */}
        {activeTab === "hours" && (
          <View className="p-4 gap-4">
            {/* 24/7 Toggle */}
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

            {/* Per-day hours */}
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
                          <Text style={{ fontSize: 16, color: colors.muted, marginTop: 14 }}>—</Text>
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
        )}

        {/* Logo Tab */}
        {activeTab === "logo" && (
          <View className="p-4 gap-4">
            {/* Current Logo */}
            <View style={[styles.infoBox, { backgroundColor: colors.surface, borderColor: colors.border, alignItems: "center", padding: 20 }]}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground, marginBottom: 12 }}>Current Logo</Text>
              {selectedStore?.logo ? (
                <Image source={{ uri: selectedStore.logo }} style={{ width: 120, height: 120, borderRadius: 16 }} contentFit="cover" />
              ) : (
                <View style={{ width: 120, height: 120, borderRadius: 16, backgroundColor: "#E0F7FA", justifyContent: "center", alignItems: "center" }}>
                  <Text style={{ fontSize: 40 }}>🏪</Text>
                  <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>No logo set</Text>
                </View>
              )}
            </View>

            {/* Logo URL Input */}
            <View>
              <Text style={styles.label}>Logo URL</Text>
              <TextInput
                value={selectedStore?.logo || ""}
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.muted }]}
                editable={false}
                placeholder="No logo URL set"
                placeholderTextColor={colors.muted}
              />
              <Text style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>
                To upload a new logo, use the "Upload Store Logos" tool from the dashboard
              </Text>
            </View>
          </View>
        )}
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
