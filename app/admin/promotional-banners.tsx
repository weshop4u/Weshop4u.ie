import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, Switch, Platform, Alert, useWindowDimensions } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { AdminDesktopLayout } from "@/components/admin-desktop-layout";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import { StyleSheet } from "react-native";

type Banner = {
  id: number;
  title: string;
  subtitle: string | null;
  discountCode: string | null;
  backgroundColor: string | null;
  accentColor: string | null;
  isActive: boolean;
  sortPosition: number;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type FormData = {
  title: string;
  subtitle: string;
  discountCode: string;
  backgroundColor: string;
  accentColor: string;
  isActive: boolean;
  sortPosition: string;
  startDate: string;
  endDate: string;
};

const EMPTY_FORM: FormData = {
  title: "",
  subtitle: "",
  discountCode: "",
  backgroundColor: "#0F172A",
  accentColor: "#00E5FF",
  isActive: true,
  sortPosition: "0",
  startDate: "",
  endDate: "",
};

const COLOR_PRESETS = [
  { label: "Dark Navy", bg: "#0F172A", accent: "#00E5FF" },
  { label: "Deep Purple", bg: "#1E1B4B", accent: "#A78BFA" },
  { label: "Forest Green", bg: "#052E16", accent: "#4ADE80" },
  { label: "Midnight Red", bg: "#1C1917", accent: "#F87171" },
  { label: "Ocean Blue", bg: "#0C4A6E", accent: "#38BDF8" },
  { label: "Warm Gold", bg: "#1C1917", accent: "#FBBF24" },
];

export default function PromotionalBannersScreen() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 900;
  const utils = trpc.useUtils();

  const { data: banners, isLoading } = trpc.banners.list.useQuery();
  const createMutation = trpc.banners.create.useMutation({ onSuccess: () => utils.banners.list.invalidate() });
  const updateMutation = trpc.banners.update.useMutation({ onSuccess: () => utils.banners.list.invalidate() });
  const deleteMutation = trpc.banners.delete.useMutation({ onSuccess: () => utils.banners.list.invalidate() });
  const toggleMutation = trpc.banners.toggleActive.useMutation({ onSuccess: () => utils.banners.list.invalidate() });

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);

  const handleEdit = (banner: Banner) => {
    setForm({
      title: banner.title,
      subtitle: banner.subtitle || "",
      discountCode: banner.discountCode || "",
      backgroundColor: banner.backgroundColor || "#0F172A",
      accentColor: banner.accentColor || "#00E5FF",
      isActive: banner.isActive,
      sortPosition: String(banner.sortPosition),
      startDate: banner.startDate ? new Date(banner.startDate).toISOString().split("T")[0] : "",
      endDate: banner.endDate ? new Date(banner.endDate).toISOString().split("T")[0] : "",
    });
    setEditingId(banner.id);
    setShowForm(true);
  };

  const handleCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      Alert.alert("Error", "Title is required");
      return;
    }
    try {
      const payload = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || undefined,
        discountCode: form.discountCode.trim() || undefined,
        backgroundColor: form.backgroundColor,
        accentColor: form.accentColor,
        isActive: form.isActive,
        sortPosition: parseInt(form.sortPosition) || 0,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
      };

      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, ...payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      setShowForm(false);
      setEditingId(null);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to save banner");
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert("Delete Banner", "Are you sure you want to delete this banner?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate({ id }) },
    ]);
  };

  const handleToggle = (id: number, currentActive: boolean) => {
    toggleMutation.mutate({ id, isActive: !currentActive });
  };

  const content = (
    <ScrollView contentContainerStyle={{ padding: isDesktop ? 32 : 16, paddingBottom: 100 }}>
      {/* Header */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <View>
          <Text style={{ fontSize: 24, fontWeight: "800", color: colors.foreground }}>Promotional Banners</Text>
          <Text style={{ fontSize: 14, color: colors.muted, marginTop: 4 }}>
            Manage banners shown on the home screen
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleCreate}
          style={{ backgroundColor: "#00E5FF", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 }}
        >
          <Text style={{ color: "#0F172A", fontWeight: "700", fontSize: 14 }}>+ New Banner</Text>
        </TouchableOpacity>
      </View>

      {/* Create/Edit Form */}
      {showForm && (
        <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 24 }]}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground, marginBottom: 16 }}>
            {editingId ? "Edit Banner" : "Create New Banner"}
          </Text>

          {/* Title */}
          <Text style={s.label}>Title *</Text>
          <TextInput
            style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            value={form.title}
            onChangeText={(t) => setForm({ ...form, title: t })}
            placeholder="e.g., 10% OFF Your First Order!"
            placeholderTextColor={colors.muted}
          />

          {/* Subtitle */}
          <Text style={s.label}>Subtitle</Text>
          <TextInput
            style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            value={form.subtitle}
            onChangeText={(t) => setForm({ ...form, subtitle: t })}
            placeholder="e.g., Sign up and save on your first delivery"
            placeholderTextColor={colors.muted}
          />

          {/* Discount Code */}
          <Text style={s.label}>Discount Code (optional)</Text>
          <TextInput
            style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            value={form.discountCode}
            onChangeText={(t) => setForm({ ...form, discountCode: t.toUpperCase() })}
            placeholder="e.g., WELCOME10"
            placeholderTextColor={colors.muted}
            autoCapitalize="characters"
          />

          {/* Color Presets */}
          <Text style={s.label}>Color Theme</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {COLOR_PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset.label}
                onPress={() => setForm({ ...form, backgroundColor: preset.bg, accentColor: preset.accent })}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                  borderWidth: 1.5,
                  borderColor: form.backgroundColor === preset.bg && form.accentColor === preset.accent ? preset.accent : colors.border,
                  backgroundColor: form.backgroundColor === preset.bg && form.accentColor === preset.accent ? preset.bg : colors.background,
                }}
              >
                <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: preset.accent }} />
                <Text style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: form.backgroundColor === preset.bg && form.accentColor === preset.accent ? preset.accent : colors.foreground,
                }}>
                  {preset.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Custom Colors Row */}
          <View style={{ flexDirection: "row", gap: 16, marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Background Color</Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                value={form.backgroundColor}
                onChangeText={(t) => setForm({ ...form, backgroundColor: t })}
                placeholder="#0F172A"
                placeholderTextColor={colors.muted}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Accent Color</Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                value={form.accentColor}
                onChangeText={(t) => setForm({ ...form, accentColor: t })}
                placeholder="#00E5FF"
                placeholderTextColor={colors.muted}
              />
            </View>
          </View>

          {/* Scheduling */}
          <View style={{ flexDirection: "row", gap: 16, marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Start Date (optional)</Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                value={form.startDate}
                onChangeText={(t) => setForm({ ...form, startDate: t })}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.muted}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>End Date (optional)</Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                value={form.endDate}
                onChangeText={(t) => setForm({ ...form, endDate: t })}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.muted}
              />
            </View>
          </View>

          {/* Sort Position & Active */}
          <View style={{ flexDirection: "row", gap: 16, alignItems: "center", marginBottom: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Sort Position</Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                value={form.sortPosition}
                onChangeText={(t) => setForm({ ...form, sortPosition: t })}
                placeholder="0"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 20 }}>
              <Switch value={form.isActive} onValueChange={(v) => setForm({ ...form, isActive: v })} />
              <Text style={{ fontSize: 14, color: colors.foreground, fontWeight: "600" }}>Active</Text>
            </View>
          </View>

          {/* Preview */}
          <Text style={[s.label, { marginBottom: 8 }]}>Preview</Text>
          <View style={{
            borderRadius: 14,
            overflow: "hidden",
            backgroundColor: form.backgroundColor,
            padding: 20,
            marginBottom: 16,
            position: "relative",
          }}>
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, backgroundColor: form.accentColor }} />
            <Text style={{ fontSize: 17, fontWeight: "800", color: form.accentColor, marginBottom: 6 }}>
              {form.title || "Banner Title"}
            </Text>
            {form.subtitle ? (
              <Text style={{ fontSize: 13, color: "#CBD5E1", marginBottom: 10, lineHeight: 18 }}>{form.subtitle}</Text>
            ) : null}
            {form.discountCode ? (
              <View style={{
                alignSelf: "flex-start",
                backgroundColor: `${form.accentColor}20`,
                borderWidth: 1.5,
                borderColor: form.accentColor,
                borderStyle: "dashed",
                borderRadius: 8,
                paddingHorizontal: 14,
                paddingVertical: 6,
              }}>
                <Text style={{ fontSize: 16, fontWeight: "900", color: form.accentColor, letterSpacing: 2 }}>
                  {form.discountCode}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Actions */}
          <View style={{ flexDirection: "row", gap: 12, justifyContent: "flex-end" }}>
            <TouchableOpacity
              onPress={() => { setShowForm(false); setEditingId(null); }}
              style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}
            >
              <Text style={{ color: colors.muted, fontWeight: "600" }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              style={{ backgroundColor: "#00E5FF", paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 }}
            >
              <Text style={{ color: "#0F172A", fontWeight: "700" }}>{editingId ? "Update" : "Create"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Banners List */}
      {isLoading ? (
        <Text style={{ color: colors.muted, textAlign: "center", marginTop: 40 }}>Loading banners...</Text>
      ) : !banners || banners.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: 60 }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>📢</Text>
          <Text style={{ fontSize: 16, color: colors.muted }}>No promotional banners yet</Text>
          <Text style={{ fontSize: 13, color: colors.muted, marginTop: 4 }}>Create your first banner to promote offers on the home screen</Text>
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          {banners.map((banner: Banner) => {
            const isExpired = banner.endDate && new Date(banner.endDate) < new Date();
            const isScheduled = banner.startDate && new Date(banner.startDate) > new Date();

            return (
              <View
                key={banner.id}
                style={[s.card, {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: banner.isActive ? 1 : 0.6,
                }]}
              >
                {/* Banner Preview Mini */}
                <View style={{
                  borderRadius: 10,
                  overflow: "hidden",
                  backgroundColor: banner.backgroundColor || "#0F172A",
                  padding: 16,
                  marginBottom: 12,
                  position: "relative",
                }}>
                  <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, backgroundColor: banner.accentColor || "#00E5FF" }} />
                    <Text style={{ fontSize: 15, fontWeight: "800", color: banner.accentColor || "#00E5FF", marginBottom: 4 }}>
                    {banner.title}
                  </Text>
                  {banner.subtitle && (
                    <Text style={{ fontSize: 12, color: "#CBD5E1", marginBottom: 8 }} numberOfLines={1}>{banner.subtitle}</Text>
                  )}
                  {banner.discountCode && (
                    <View style={{
                      alignSelf: "flex-start",
                      backgroundColor: `${banner.accentColor || "#00E5FF"}20`,
                      borderWidth: 1,
                      borderColor: banner.accentColor || "#00E5FF",
                      borderStyle: "dashed",
                      borderRadius: 6,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                    }}>
                        <Text style={{ fontSize: 13, fontWeight: "900", color: banner.accentColor || "#00E5FF", letterSpacing: 1.5 }}>
                        {banner.discountCode}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Status & Info */}
                <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                  <View style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 6,
                    backgroundColor: banner.isActive ? "#DCFCE7" : "#FEE2E2",
                  }}>
                    <Text style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: banner.isActive ? "#16A34A" : "#DC2626",
                    }}>
                      {banner.isActive ? "ACTIVE" : "INACTIVE"}
                    </Text>
                  </View>
                  {isExpired && (
                    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: "#FEF3C7" }}>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: "#D97706" }}>EXPIRED</Text>
                    </View>
                  )}
                  {isScheduled && (
                    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: "#DBEAFE" }}>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: "#2563EB" }}>SCHEDULED</Text>
                    </View>
                  )}
                  <Text style={{ fontSize: 12, color: colors.muted }}>Position: {banner.sortPosition}</Text>
                  {banner.startDate && (
                    <Text style={{ fontSize: 12, color: colors.muted }}>From: {new Date(banner.startDate).toLocaleDateString()}</Text>
                  )}
                  {banner.endDate && (
                    <Text style={{ fontSize: 12, color: colors.muted }}>Until: {new Date(banner.endDate).toLocaleDateString()}</Text>
                  )}
                </View>

                {/* Actions */}
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => handleToggle(banner.id, banner.isActive)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 7,
                      borderRadius: 8,
                      backgroundColor: banner.isActive ? "#FEF3C7" : "#DCFCE7",
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "700", color: banner.isActive ? "#D97706" : "#16A34A" }}>
                      {banner.isActive ? "Disable" : "Enable"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleEdit(banner)}
                    style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: "#E0E7FF" }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#4338CA" }}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(banner.id)}
                    style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: "#FEE2E2" }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#DC2626" }}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );

  if (isDesktop) {
    return (
      <AdminDesktopLayout title="Promotional Banners">
        {content}
      </AdminDesktopLayout>
    );
  }

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      {content}
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 12,
  },
});
