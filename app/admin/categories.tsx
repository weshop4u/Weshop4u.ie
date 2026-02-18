import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, TextInput, Platform, Modal } from "react-native";
import { Image } from "expo-image";
import { ScreenContainer } from "@/components/screen-container";
import { useState, useCallback } from "react";
import { useRouter } from "expo-router";
import { trpc } from "@/lib/trpc";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useColors } from "@/hooks/use-colors";
import { StyleSheet } from "react-native";

type DaySchedule = { open: string; close: string };
type AvailabilitySchedule = {
  mon?: DaySchedule;
  tue?: DaySchedule;
  wed?: DaySchedule;
  thu?: DaySchedule;
  fri?: DaySchedule;
  sat?: DaySchedule;
  sun?: DaySchedule;
} | null;

const DAYS = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
] as const;

const ALCOHOL_SCHEDULE: AvailabilitySchedule = {
  mon: { open: "10:30", close: "22:00" },
  tue: { open: "10:30", close: "22:00" },
  wed: { open: "10:30", close: "22:00" },
  thu: { open: "10:30", close: "22:00" },
  fri: { open: "10:30", close: "22:00" },
  sat: { open: "10:30", close: "22:00" },
  sun: { open: "12:30", close: "22:00" },
};

export default function CategoriesScreen() {
  const router = useRouter();
  const colors = useColors();
  const [selectedCategory, setSelectedCategory] = useState<any | null>(null);
  const [editMode, setEditMode] = useState<"image" | "settings" | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editAgeRestricted, setEditAgeRestricted] = useState(false);
  const [editSchedule, setEditSchedule] = useState<AvailabilitySchedule>(null);
  const [editSortOrder, setEditSortOrder] = useState("0");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);

  const { data: categories, refetch } = trpc.categories.getAllWithCounts.useQuery({ storeId: 1 });
  const updateImageMutation = trpc.categories.updateImage.useMutation();
  const uploadMutation = trpc.categories.uploadImage.useMutation();
  const renameMutation = trpc.categories.rename.useMutation();
  const updateSettingsMutation = trpc.categories.updateSettings.useMutation();
  const deleteMutation = trpc.categories.delete.useMutation();
  const mergeMutation = trpc.categories.merge.useMutation();

  const openSettings = useCallback((category: any) => {
    setSelectedCategory(category);
    setEditMode("settings");
    setEditName(category.name);
    setEditAgeRestricted(category.ageRestricted || false);
    setEditSortOrder(String(category.sortOrder || 0));
    const schedule = category.availabilitySchedule
      ? (typeof category.availabilitySchedule === "string"
          ? JSON.parse(category.availabilitySchedule)
          : category.availabilitySchedule)
      : null;
    setEditSchedule(schedule);
    setScheduleEnabled(!!schedule);
    setMessage("");
  }, []);

  const openImageEdit = useCallback((category: any) => {
    setSelectedCategory(category);
    setEditMode("image");
    setImageUrl(category.icon && category.icon.startsWith("http") ? category.icon : "");
    setPreviewUri(null);
    setMessage("");
  }, []);

  const closeModal = useCallback(() => {
    setSelectedCategory(null);
    setEditMode(null);
    setMessage("");
  }, []);

  const handleSaveSettings = async () => {
    if (!selectedCategory) return;
    setIsSaving(true);
    setMessage("");

    try {
      // Rename if changed
      if (editName.trim() && editName.trim() !== selectedCategory.name) {
        await renameMutation.mutateAsync({ id: selectedCategory.id, name: editName.trim() });
      }

      // Update settings
      await updateSettingsMutation.mutateAsync({
        id: selectedCategory.id,
        ageRestricted: editAgeRestricted,
        availabilitySchedule: scheduleEnabled ? editSchedule : null,
        sortOrder: parseInt(editSortOrder) || 0,
      });

      setMessage("Category updated successfully!");
      setMessageType("success");
      refetch();
      setTimeout(closeModal, 1000);
    } catch (error: any) {
      setMessage(error.message || "Failed to update category");
      setMessageType("error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!selectedCategory) return;
    setIsSaving(true);
    try {
      await deleteMutation.mutateAsync({ id: selectedCategory.id });
      setMessage("Category deleted, products moved to General");
      setMessageType("success");
      refetch();
      setTimeout(closeModal, 1000);
    } catch (error: any) {
      setMessage(error.message || "Failed to delete category");
      setMessageType("error");
    } finally {
      setIsSaving(false);
    }
  };

  const updateDaySchedule = (day: string, field: "open" | "close", value: string) => {
    setEditSchedule((prev) => {
      const current = prev || {};
      const dayData = (current as any)[day] || { open: "10:30", close: "22:00" };
      return { ...current, [day]: { ...dayData, [field]: value } };
    });
  };

  const toggleDay = (day: string) => {
    setEditSchedule((prev) => {
      const current = prev || {};
      if ((current as any)[day]) {
        const { [day]: _, ...rest } = current as any;
        return Object.keys(rest).length > 0 ? rest : null;
      } else {
        return { ...current, [day]: { open: "10:30", close: "22:00" } };
      }
    });
  };

  const applyAlcoholPreset = () => {
    setEditSchedule(ALCOHOL_SCHEDULE);
    setScheduleEnabled(true);
    setEditAgeRestricted(true);
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setPreviewUri(result.assets[0].uri);
        setImageUrl("");
      }
    } catch (error: any) {
      setMessage(error.message || "Failed to pick image");
      setMessageType("error");
    }
  };

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
      return { base64, mimeType: mimeMap[ext] || "image/jpeg" };
    }
  };

  const handleUpdateImage = async () => {
    if (!selectedCategory) return;
    if (!previewUri && !imageUrl.trim()) {
      setMessage("Please pick an image or enter a URL");
      setMessageType("error");
      return;
    }
    setIsUploading(true);
    setMessage("");
    try {
      let finalImageUrl = imageUrl.trim();
      if (previewUri) {
        const { base64, mimeType } = await readImageAsBase64(previewUri);
        const uploadResult = await uploadMutation.mutateAsync({ base64, mimeType });
        finalImageUrl = uploadResult.url;
      }
      if (!finalImageUrl) throw new Error("No image URL available");
      await updateImageMutation.mutateAsync({ id: selectedCategory.id, imageUrl: finalImageUrl });
      setMessage("Category image updated!");
      setMessageType("success");
      refetch();
      setTimeout(closeModal, 1000);
    } catch (error: any) {
      setMessage(error.message || "Failed to update image");
      setMessageType("error");
    } finally {
      setIsUploading(false);
    }
  };

  // Sort categories: by sortOrder, then by name
  const sortedCategories = categories
    ? [...categories].sort((a, b) => {
        const orderDiff = (a.sortOrder || 0) - (b.sortOrder || 0);
        if (orderDiff !== 0) return orderDiff;
        return a.name.localeCompare(b.name);
      })
    : [];

  return (
    <ScreenContainer className="bg-background">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="p-4 gap-4">
          {/* Header */}
          <View className="bg-surface rounded-xl p-4 border border-border">
            <Text className="text-lg font-semibold text-foreground mb-1">Category Management</Text>
            <Text className="text-sm text-muted">
              Tap a category to edit its name, set time restrictions, or update its image.
              {"\n"}Categories with a clock icon have time availability restrictions.
            </Text>
          </View>

          {/* Summary */}
          <View className="flex-row gap-3">
            <View className="flex-1 bg-surface rounded-xl p-3 border border-border items-center">
              <Text className="text-2xl font-bold text-primary">{sortedCategories.length}</Text>
              <Text className="text-xs text-muted">Categories</Text>
            </View>
            <View className="flex-1 bg-surface rounded-xl p-3 border border-border items-center">
              <Text className="text-2xl font-bold text-primary">
                {sortedCategories.filter((c) => c.ageRestricted).length}
              </Text>
              <Text className="text-xs text-muted">Age Restricted</Text>
            </View>
            <View className="flex-1 bg-surface rounded-xl p-3 border border-border items-center">
              <Text className="text-2xl font-bold text-primary">
                {sortedCategories.filter((c) => c.availabilitySchedule).length}
              </Text>
              <Text className="text-xs text-muted">Time Limited</Text>
            </View>
          </View>

          {/* Global message */}
          {message && !editMode ? (
            <View style={[styles.messageBox, { borderColor: messageType === "error" ? colors.error : "#22C55E", backgroundColor: messageType === "error" ? "#FEE2E2" : "#DCFCE7" }]}>
              <Text style={{ color: messageType === "error" ? colors.error : "#16A34A", fontWeight: "600" }}>{message}</Text>
            </View>
          ) : null}

          {/* Categories List */}
          <View className="gap-2">
            {sortedCategories.map((category) => {
              const hasSchedule = !!category.availabilitySchedule;
              const isRestricted = category.ageRestricted;

              return (
                <View key={category.id} className="bg-surface rounded-xl border border-border overflow-hidden">
                  <View className="flex-row items-center p-3 gap-3">
                    {/* Category Image */}
                    <TouchableOpacity
                      onPress={() => openImageEdit(category)}
                      style={[styles.imageContainer, { backgroundColor: colors.primary + "15" }]}
                    >
                      {category.icon && category.icon.startsWith("http") ? (
                        <Image source={{ uri: category.icon }} style={styles.categoryImage} contentFit="cover" />
                      ) : (
                        <Text style={{ fontSize: 22 }}>📦</Text>
                      )}
                    </TouchableOpacity>

                    {/* Category Info */}
                    <TouchableOpacity
                      onPress={() => openSettings(category)}
                      style={{ flex: 1 }}
                    >
                      <View className="flex-row items-center gap-1">
                        <Text className="font-semibold text-foreground" numberOfLines={1}>
                          {category.name}
                        </Text>
                        {isRestricted ? <Text style={{ fontSize: 12 }}>🔞</Text> : null}
                        {hasSchedule ? <Text style={{ fontSize: 12 }}>🕐</Text> : null}
                      </View>
                      <Text className="text-xs text-muted">
                        {(category as any).productCount || 0} products
                      </Text>
                    </TouchableOpacity>

                    {/* Edit Button */}
                    <TouchableOpacity
                      onPress={() => openSettings(category)}
                      style={[styles.editBtn, { backgroundColor: colors.primary + "15" }]}
                    >
                      <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Settings Modal */}
      <Modal visible={editMode === "settings"} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Modal Header */}
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-lg font-bold text-foreground">Edit Category</Text>
                <TouchableOpacity onPress={closeModal} style={[styles.closeBtn, { backgroundColor: colors.surface }]}>
                  <Text className="text-foreground font-semibold">✕</Text>
                </TouchableOpacity>
              </View>

              {/* Message */}
              {message && editMode === "settings" ? (
                <View style={[styles.messageBox, { borderColor: messageType === "error" ? colors.error : "#22C55E", backgroundColor: messageType === "error" ? "#FEE2E2" : "#DCFCE7", marginBottom: 12 }]}>
                  <Text style={{ color: messageType === "error" ? colors.error : "#16A34A", fontWeight: "600" }}>{message}</Text>
                </View>
              ) : null}

              {/* Category Name */}
              <View className="mb-4">
                <Text className="text-sm font-semibold text-foreground mb-2">Category Name</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Category name"
                  placeholderTextColor={colors.muted}
                />
              </View>

              {/* Age Restriction Toggle */}
              <View className="mb-4">
                <TouchableOpacity
                  onPress={() => setEditAgeRestricted(!editAgeRestricted)}
                  style={[styles.toggleRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View className="flex-1">
                    <Text className="font-semibold text-foreground">🔞 Age Restricted (18+)</Text>
                    <Text className="text-xs text-muted mt-1">
                      Shows 18+ badge on products in this category
                    </Text>
                  </View>
                  <View style={[styles.toggle, editAgeRestricted ? styles.toggleOn : styles.toggleOff]}>
                    <View style={[styles.toggleThumb, editAgeRestricted ? styles.thumbOn : styles.thumbOff]} />
                  </View>
                </TouchableOpacity>
              </View>

              {/* Time Availability Toggle */}
              <View className="mb-4">
                <TouchableOpacity
                  onPress={() => setScheduleEnabled(!scheduleEnabled)}
                  style={[styles.toggleRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View className="flex-1">
                    <Text className="font-semibold text-foreground">🕐 Time Availability</Text>
                    <Text className="text-xs text-muted mt-1">
                      Restrict when products can be ordered (e.g., alcohol hours)
                    </Text>
                  </View>
                  <View style={[styles.toggle, scheduleEnabled ? styles.toggleOn : styles.toggleOff]}>
                    <View style={[styles.toggleThumb, scheduleEnabled ? styles.thumbOn : styles.thumbOff]} />
                  </View>
                </TouchableOpacity>
              </View>

              {/* Preset Button */}
              {scheduleEnabled ? (
                <View className="mb-4">
                  <TouchableOpacity
                    onPress={applyAlcoholPreset}
                    style={[styles.presetBtn, { backgroundColor: colors.warning + "20", borderColor: colors.warning }]}
                  >
                    <Text style={{ color: colors.warning, fontWeight: "700", fontSize: 13 }}>
                      🍺 Apply Irish Alcohol Hours Preset
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
                      Mon-Sat 10:30-22:00, Sun 12:30-22:00
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {/* Per-Day Schedule */}
              {scheduleEnabled ? (
                <View className="mb-4">
                  <Text className="text-sm font-semibold text-foreground mb-2">Schedule by Day</Text>
                  <View className="gap-2">
                    {DAYS.map(({ key, label }) => {
                      const dayData = editSchedule ? (editSchedule as any)[key] : null;
                      const isEnabled = !!dayData;

                      return (
                        <View key={key} style={[styles.dayRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                          <TouchableOpacity
                            onPress={() => toggleDay(key)}
                            style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
                          >
                            <View style={[styles.checkbox, isEnabled ? styles.checkboxOn : styles.checkboxOff]}>
                              {isEnabled ? <Text style={{ color: "#fff", fontSize: 10, fontWeight: "bold" }}>✓</Text> : null}
                            </View>
                            <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 13, marginLeft: 8, width: 80 }}>
                              {label}
                            </Text>
                          </TouchableOpacity>

                          {isEnabled ? (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <TextInput
                                style={[styles.timeInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                                value={dayData?.open || "10:30"}
                                onChangeText={(v) => updateDaySchedule(key, "open", v)}
                                placeholder="10:30"
                                placeholderTextColor={colors.muted}
                                maxLength={5}
                              />
                              <Text style={{ color: colors.muted, fontSize: 12 }}>to</Text>
                              <TextInput
                                style={[styles.timeInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                                value={dayData?.close || "22:00"}
                                onChangeText={(v) => updateDaySchedule(key, "close", v)}
                                placeholder="22:00"
                                placeholderTextColor={colors.muted}
                                maxLength={5}
                              />
                            </View>
                          ) : (
                            <Text style={{ color: colors.muted, fontSize: 12, fontStyle: "italic" }}>Not available</Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {/* Sort Order */}
              <View className="mb-4">
                <Text className="text-sm font-semibold text-foreground mb-2">Sort Order</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground, width: 100 }]}
                  value={editSortOrder}
                  onChangeText={setEditSortOrder}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={colors.muted}
                />
                <Text className="text-xs text-muted mt-1">Lower numbers appear first</Text>
              </View>

              {/* Save Button */}
              <TouchableOpacity
                onPress={handleSaveSettings}
                disabled={isSaving}
                style={[styles.saveButton, { opacity: isSaving ? 0.5 : 1 }]}
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>

              {/* Delete Button */}
              <TouchableOpacity
                onPress={handleDeleteCategory}
                disabled={isSaving}
                style={[styles.deleteButton, { opacity: isSaving ? 0.5 : 1 }]}
              >
                <Text style={styles.deleteButtonText}>Delete Category</Text>
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Image Edit Modal */}
      <Modal visible={editMode === "image"} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Modal Header */}
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-lg font-bold text-foreground">
                  Update Image: {selectedCategory?.name}
                </Text>
                <TouchableOpacity onPress={closeModal} style={[styles.closeBtn, { backgroundColor: colors.surface }]}>
                  <Text className="text-foreground font-semibold">✕</Text>
                </TouchableOpacity>
              </View>

              {/* Message */}
              {message && editMode === "image" ? (
                <View style={[styles.messageBox, { borderColor: messageType === "error" ? colors.error : "#22C55E", backgroundColor: messageType === "error" ? "#FEE2E2" : "#DCFCE7", marginBottom: 12 }]}>
                  <Text style={{ color: messageType === "error" ? colors.error : "#16A34A", fontWeight: "600" }}>{message}</Text>
                </View>
              ) : null}

              {/* Pick from device */}
              <TouchableOpacity
                onPress={handlePickImage}
                disabled={isUploading}
                className={`py-4 rounded-xl border-2 border-dashed mb-4 ${isUploading ? "border-muted bg-muted/10" : "border-primary bg-primary/5"} active:opacity-70`}
              >
                <Text className="text-primary text-center font-semibold">
                  📷 Choose Image from Device
                </Text>
              </TouchableOpacity>

              {/* Preview */}
              {previewUri ? (
                <View className="items-center mb-4">
                  <Image source={{ uri: previewUri }} style={{ width: 200, height: 200, borderRadius: 12 }} contentFit="cover" />
                  <TouchableOpacity
                    onPress={() => { setPreviewUri(null); setImageUrl(""); }}
                    className="mt-3 px-4 py-2 bg-error/10 rounded-lg active:opacity-70"
                  >
                    <Text className="text-error font-semibold">Remove</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {/* OR divider */}
              {!previewUri ? (
                <Text className="text-sm text-muted text-center mb-4">— OR paste a URL —</Text>
              ) : null}

              {/* URL Input */}
              {!previewUri ? (
                <View className="mb-4">
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                    placeholder="https://example.com/image.jpg"
                    placeholderTextColor={colors.muted}
                    value={imageUrl}
                    onChangeText={setImageUrl}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                  />
                </View>
              ) : null}

              {/* Save */}
              <TouchableOpacity
                onPress={handleUpdateImage}
                disabled={isUploading || (!previewUri && !imageUrl.trim())}
                style={[styles.saveButton, { opacity: isUploading || (!previewUri && !imageUrl.trim()) ? 0.5 : 1 }]}
              >
                {isUploading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>{previewUri ? "Upload & Save" : "Save Image URL"}</Text>
                )}
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  messageBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
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
  deleteButton: {
    backgroundColor: "#FEE2E2",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 12,
  },
  deleteButtonText: {
    color: "#EF4444",
    fontSize: 16,
    fontWeight: "700",
  },
  imageContainer: {
    width: 48,
    height: 48,
    borderRadius: 10,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  categoryImage: {
    width: 48,
    height: 48,
  },
  editBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "90%",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    padding: 2,
  },
  toggleOn: {
    backgroundColor: "#0a7ea4",
  },
  toggleOff: {
    backgroundColor: "#D1D5DB",
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  thumbOn: {
    alignSelf: "flex-end",
  },
  thumbOff: {
    alignSelf: "flex-start",
  },
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: {
    backgroundColor: "#0a7ea4",
  },
  checkboxOff: {
    backgroundColor: "#D1D5DB",
  },
  timeInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    width: 65,
    textAlign: "center",
  },
  presetBtn: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
});
