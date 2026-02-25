import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  useWindowDimensions,
  StyleSheet,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { AdminDesktopLayout } from "@/components/admin-desktop-layout";
import { trpc } from "@/lib/trpc";
import { useState, useCallback } from "react";

// ===== Types =====
interface TemplateOption {
  id?: number;
  name: string;
  price: string;
  isDefault: boolean;
  available: boolean;
  sortOrder: number;
  isNew?: boolean;
}

interface TemplateForm {
  id?: number;
  name: string;
  type: "single" | "multi";
  required: boolean;
  minSelections: number;
  maxSelections: number;
  options: TemplateOption[];
}

const EMPTY_TEMPLATE: TemplateForm = {
  name: "",
  type: "single",
  required: false,
  minSelections: 0,
  maxSelections: 0,
  options: [],
};

// ===== Main Component =====
function ModifierTemplatesContent() {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === "web" && width >= 900;
  const utils = trpc.useUtils();

  const { data: templates, isLoading, refetch } = trpc.modifierTemplates.list.useQuery();

  const [editingTemplate, setEditingTemplate] = useState<TemplateForm | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const createMutation = trpc.modifierTemplates.create.useMutation();
  const updateMutation = trpc.modifierTemplates.update.useMutation();
  const deleteMutation = trpc.modifierTemplates.delete.useMutation();
  const addOptionMutation = trpc.modifierTemplates.addOption.useMutation();
  const updateOptionMutation = trpc.modifierTemplates.updateOption.useMutation();
  const deleteOptionMutation = trpc.modifierTemplates.deleteOption.useMutation();

  const showAlert = useCallback((title: string, msg: string) => {
    if (Platform.OS === "web") {
      window.alert(`${title}: ${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  }, []);

  const handleCreateNew = () => {
    setEditingTemplate({ ...EMPTY_TEMPLATE, options: [] });
    setIsCreating(true);
  };

  const handleEdit = (template: any) => {
    setEditingTemplate({
      id: template.id,
      name: template.name,
      type: template.type,
      required: template.required ?? false,
      minSelections: template.minSelections ?? 0,
      maxSelections: template.maxSelections ?? 0,
      options: (template.options || []).map((o: any) => ({
        id: o.id,
        name: o.name,
        price: String(o.price ?? "0.00"),
        isDefault: o.isDefault ?? false,
        available: o.available !== false,
        sortOrder: o.sortOrder ?? 0,
      })),
    });
    setIsCreating(false);
  };

  const handleDelete = async (templateId: number, templateName: string) => {
    const doDelete = async () => {
      try {
        await deleteMutation.mutateAsync({ id: templateId });
        await refetch();
        showAlert("Deleted", `Template "${templateName}" deleted`);
      } catch (e: any) {
        showAlert("Error", e.message);
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm(`Delete template "${templateName}"? This will also remove it from all categories and products.`)) {
        await doDelete();
      }
    } else {
      Alert.alert("Delete Template", `Delete "${templateName}"? This will also remove it from all categories and products.`, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const handleSave = async () => {
    if (!editingTemplate) return;
    if (!editingTemplate.name.trim()) {
      showAlert("Error", "Template name is required");
      return;
    }

    setSaving(true);
    try {
      if (isCreating) {
        // Create new template with options
        const result = await createMutation.mutateAsync({
          name: editingTemplate.name.trim(),
          type: editingTemplate.type,
          required: editingTemplate.required,
          minSelections: editingTemplate.minSelections,
          maxSelections: editingTemplate.maxSelections,
          options: editingTemplate.options.map((o, i) => ({
            name: o.name.trim(),
            price: o.price || "0.00",
            isDefault: o.isDefault,
            sortOrder: i,
          })),
        });
        showAlert("Success", `Template "${editingTemplate.name}" created`);
      } else if (editingTemplate.id) {
        // Update existing template
        await updateMutation.mutateAsync({
          id: editingTemplate.id,
          name: editingTemplate.name.trim(),
          type: editingTemplate.type,
          required: editingTemplate.required,
          minSelections: editingTemplate.minSelections,
          maxSelections: editingTemplate.maxSelections,
        });

        // Handle options: update existing, create new, delete removed
        const existingOptions = (templates || []).find((t) => t.id === editingTemplate.id)?.options || [];
        const currentOptionIds = editingTemplate.options.filter((o) => o.id).map((o) => o.id!);

        // Delete removed options
        for (const existing of existingOptions) {
          if (!currentOptionIds.includes(existing.id)) {
            await deleteOptionMutation.mutateAsync({ id: existing.id });
          }
        }

        // Update existing and create new options
        for (let i = 0; i < editingTemplate.options.length; i++) {
          const opt = editingTemplate.options[i];
          if (opt.id) {
            await updateOptionMutation.mutateAsync({
              id: opt.id,
              name: opt.name.trim(),
              price: opt.price || "0.00",
              isDefault: opt.isDefault,
              available: opt.available,
              sortOrder: i,
            });
          } else {
            await addOptionMutation.mutateAsync({
              templateId: editingTemplate.id,
              name: opt.name.trim(),
              price: opt.price || "0.00",
              isDefault: opt.isDefault,
              available: opt.available,
              sortOrder: i,
            });
          }
        }

        showAlert("Success", `Template "${editingTemplate.name}" updated`);
      }

      await refetch();
      setEditingTemplate(null);
      setIsCreating(false);
    } catch (e: any) {
      showAlert("Error", e.message);
    } finally {
      setSaving(false);
    }
  };

  const addOption = () => {
    if (!editingTemplate) return;
    setEditingTemplate({
      ...editingTemplate,
      options: [
        ...editingTemplate.options,
        { name: "", price: "0.00", isDefault: false, available: true, sortOrder: editingTemplate.options.length, isNew: true },
      ],
    });
  };

  const updateOption = (index: number, field: keyof TemplateOption, value: any) => {
    if (!editingTemplate) return;
    const updated = [...editingTemplate.options];
    updated[index] = { ...updated[index], [field]: value };
    setEditingTemplate({ ...editingTemplate, options: updated });
  };

  const removeOption = (index: number) => {
    if (!editingTemplate) return;
    const updated = editingTemplate.options.filter((_, i) => i !== index);
    setEditingTemplate({ ...editingTemplate, options: updated });
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 80 }}>
        <ActivityIndicator size="large" color="#00E5FF" />
        <Text className="text-foreground mt-4">Loading templates...</Text>
      </View>
    );
  }

  // ===== Edit/Create Form =====
  if (editingTemplate) {
    const formContent = (
      <View style={{ padding: 16, gap: 16, maxWidth: 700 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={s.heading}>{isCreating ? "Create Template" : "Edit Template"}</Text>
          <TouchableOpacity
            onPress={() => { setEditingTemplate(null); setIsCreating(false); }}
            style={[s.btn, { backgroundColor: "#6B7280" }]}
          >
            <Text style={s.btnText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {/* Template Name */}
        <View>
          <Text style={s.label}>Template Name *</Text>
          <TextInput
            style={s.input}
            value={editingTemplate.name}
            onChangeText={(v) => setEditingTemplate({ ...editingTemplate, name: v })}
            placeholder="e.g. Chinese Sides, Deli Fillings, Dinner Sides"
          />
        </View>

        {/* Type */}
        <View>
          <Text style={s.label}>Selection Type</Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <TouchableOpacity
              onPress={() => setEditingTemplate({ ...editingTemplate, type: "single" })}
              style={[s.typeBtn, editingTemplate.type === "single" && s.typeBtnActive]}
            >
              <Text style={[s.typeBtnText, editingTemplate.type === "single" && s.typeBtnTextActive]}>
                Single (Pick One)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setEditingTemplate({ ...editingTemplate, type: "multi" })}
              style={[s.typeBtn, editingTemplate.type === "multi" && s.typeBtnActive]}
            >
              <Text style={[s.typeBtnText, editingTemplate.type === "multi" && s.typeBtnTextActive]}>
                Multi (Pick Many)
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Required */}
        <TouchableOpacity
          onPress={() => setEditingTemplate({ ...editingTemplate, required: !editingTemplate.required })}
          style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
        >
          <View style={[s.checkbox, editingTemplate.required && s.checkboxActive]}>
            {editingTemplate.required && <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>✓</Text>}
          </View>
          <Text style={s.label}>Required (customer must select)</Text>
        </TouchableOpacity>

        {/* Min/Max for multi */}
        {editingTemplate.type === "multi" && (
          <View style={{ flexDirection: "row", gap: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Min Selections</Text>
              <TextInput
                style={s.input}
                value={String(editingTemplate.minSelections)}
                onChangeText={(v) => setEditingTemplate({ ...editingTemplate, minSelections: parseInt(v) || 0 })}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Max Selections (0 = unlimited)</Text>
              <TextInput
                style={s.input}
                value={String(editingTemplate.maxSelections)}
                onChangeText={(v) => setEditingTemplate({ ...editingTemplate, maxSelections: parseInt(v) || 0 })}
                keyboardType="numeric"
              />
            </View>
          </View>
        )}

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: "#E5E7EB", marginVertical: 8 }} />

        {/* Options */}
        <View>
          <Text style={[s.heading, { fontSize: 16 }]}>Options</Text>
          <Text style={{ color: "#687076", fontSize: 13, marginBottom: 12 }}>
            Add the choices customers can pick from. Set price to 0.00 for included options.
          </Text>

          {editingTemplate.options.map((opt, idx) => (
            <View key={idx} style={[s.optionRow, !opt.available && { opacity: 0.5, backgroundColor: "#F9FAFB" }]}>
              <View style={{ flex: 2 }}>
                <Text style={s.optLabel}>Name</Text>
                <TextInput
                  style={s.input}
                  value={opt.name}
                  onChangeText={(v) => updateOption(idx, "name", v)}
                  placeholder="e.g. Boiled Rice"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.optLabel}>Price (€)</Text>
                <TextInput
                  style={s.input}
                  value={opt.price}
                  onChangeText={(v) => updateOption(idx, "price", v)}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                />
              </View>
              <TouchableOpacity
                onPress={() => updateOption(idx, "available", !opt.available)}
                style={{
                  width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center", marginBottom: 2,
                  backgroundColor: opt.available ? "#DCFCE7" : "#FEE2E2",
                  borderWidth: 1, borderColor: opt.available ? "#22C55E" : "#EF4444",
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: "700", color: opt.available ? "#16A34A" : "#EF4444" }}>
                  {opt.available ? "✓" : "✕"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => removeOption(idx)}
                style={s.deleteBtn}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity onPress={addOption} style={[s.btn, { backgroundColor: "#00BCD4", alignSelf: "flex-start", marginTop: 8 }]}>
            <Text style={s.btnText}>+ Add Option</Text>
          </TouchableOpacity>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={[s.btn, { backgroundColor: saving ? "#9CA3AF" : "#16A34A", paddingVertical: 14, marginTop: 16 }]}
        >
          <Text style={[s.btnText, { fontSize: 16 }]}>{saving ? "Saving..." : "Save Template"}</Text>
        </TouchableOpacity>
      </View>
    );

    if (isDesktopWeb) {
      return <AdminDesktopLayout>{formContent}</AdminDesktopLayout>;
    }
    return (
      <ScreenContainer edges={["top", "left", "right"]}>
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>{formContent}</ScrollView>
      </ScreenContainer>
    );
  }

  // ===== Template List =====
  const listContent = (
    <View style={{ padding: 16, gap: 16, maxWidth: 800 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View>
          <Text style={s.heading}>Modifier Templates</Text>
          <Text style={{ color: "#687076", fontSize: 13 }}>
            Create reusable modifier groups, then assign them to categories or individual products.
          </Text>
        </View>
        <TouchableOpacity onPress={handleCreateNew} style={[s.btn, { backgroundColor: "#00BCD4" }]}>
          <Text style={s.btnText}>+ New Template</Text>
        </TouchableOpacity>
      </View>

      {(!templates || templates.length === 0) ? (
        <View style={s.emptyCard}>
          <Text style={{ fontSize: 40, marginBottom: 8 }}>🔧</Text>
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#374151" }}>No Templates Yet</Text>
          <Text style={{ fontSize: 13, color: "#687076", textAlign: "center", marginTop: 4 }}>
            Create your first modifier template (e.g. "Chinese Sides", "Deli Fillings") to get started.
          </Text>
        </View>
      ) : (
        templates.map((template) => (
          <View key={template.id} style={s.card}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#0F172A" }}>{template.name}</Text>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                  <View style={[s.badge, { backgroundColor: template.type === "single" ? "#DBEAFE" : "#E0E7FF" }]}>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: template.type === "single" ? "#2563EB" : "#4F46E5" }}>
                      {template.type === "single" ? "Pick One" : "Pick Many"}
                    </Text>
                  </View>
                  {template.required && (
                    <View style={[s.badge, { backgroundColor: "#FEE2E2" }]}>
                      <Text style={{ fontSize: 11, fontWeight: "600", color: "#DC2626" }}>Required</Text>
                    </View>
                  )}
                  <View style={[s.badge, { backgroundColor: "#F3F4F6" }]}>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: "#6B7280" }}>
                      {template.options?.length || 0} options
                    </Text>
                  </View>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity onPress={() => handleEdit(template)} style={[s.btn, { backgroundColor: "#00BCD4" }]}>
                  <Text style={s.btnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(template.id, template.name)} style={[s.btn, { backgroundColor: "#EF4444" }]}>
                  <Text style={s.btnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Show options preview */}
            {template.options && template.options.length > 0 && (
              <View style={{ marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#E5E7EB" }}>
                {template.options.map((opt: any) => (
                  <View key={opt.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 3, opacity: opt.available === false ? 0.4 : 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      {opt.available === false && (
                        <View style={{ backgroundColor: "#FEE2E2", paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3 }}>
                          <Text style={{ fontSize: 9, fontWeight: "700", color: "#EF4444" }}>OUT</Text>
                        </View>
                      )}
                      <Text style={{ fontSize: 13, color: opt.available === false ? "#9CA3AF" : "#374151", textDecorationLine: opt.available === false ? "line-through" : "none" }}>{opt.name}</Text>
                    </View>
                    <Text style={{ fontSize: 13, color: parseFloat(String(opt.price)) > 0 ? "#16A34A" : "#9CA3AF", fontWeight: "600" }}>
                      {parseFloat(String(opt.price)) > 0 ? `+€${parseFloat(String(opt.price)).toFixed(2)}` : "Included"}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))
      )}
    </View>
  );

  if (isDesktopWeb) {
    return <AdminDesktopLayout>{listContent}</AdminDesktopLayout>;
  }
  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>{listContent}</ScrollView>
    </ScreenContainer>
  );
}

export default function ModifierTemplatesScreen() {
  return <ModifierTemplatesContent />;
}

// ===== Styles =====
const s = StyleSheet.create({
  heading: { fontSize: 20, fontWeight: "800", color: "#0F172A" },
  label: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 4 },
  optLabel: { fontSize: 12, color: "#687076", marginBottom: 2 },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0F172A",
    backgroundColor: "#fff",
  },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  typeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    backgroundColor: "#fff",
  },
  typeBtnActive: { borderColor: "#00BCD4", backgroundColor: "#E0F7FA" },
  typeBtnText: { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  typeBtnTextActive: { color: "#00838F" },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  checkboxActive: { backgroundColor: "#00BCD4", borderColor: "#00BCD4" },
  optionRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-end",
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  emptyCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
});
