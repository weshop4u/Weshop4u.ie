import { Text, View, TouchableOpacity, TextInput, ScrollView, Modal, StyleSheet, Platform, ActivityIndicator, Switch } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState, useMemo } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { AdminDesktopLayout } from "@/components/admin-desktop-layout";

function ProductModifiersContent() {
  const router = useRouter();
  const colors = useColors();
  const { productId, productName } = useLocalSearchParams<{ productId: string; productName: string }>();
  const pid = parseInt(productId || "0");

  const [showAddGroup, setShowAddGroup] = useState(false);
  const [showAddModifier, setShowAddModifier] = useState<number | null>(null);
  const [editingGroup, setEditingGroup] = useState<any>(null);
  const [editingModifier, setEditingModifier] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [isSaving, setIsSaving] = useState(false);

  // Form state for new group
  const [groupForm, setGroupForm] = useState({
    name: "",
    type: "single" as "single" | "multi",
    required: false,
    minSelections: 0,
    maxSelections: 1,
    sortOrder: 0,
  });

  // Form state for new modifier
  const [modForm, setModForm] = useState({
    name: "",
    price: "0.00",
    sortOrder: 0,
  });

  const { data: groupsData, refetch, isLoading } = trpc.modifiers.getForProduct.useQuery(
    { productId: pid },
    { enabled: pid > 0 }
  );

  const createGroupMutation = trpc.modifiers.createGroup.useMutation();
  const updateGroupMutation = trpc.modifiers.updateGroup.useMutation();
  const deleteGroupMutation = trpc.modifiers.deleteGroup.useMutation();
  const createModifierMutation = trpc.modifiers.createModifier.useMutation();
  const updateModifierMutation = trpc.modifiers.updateModifier.useMutation();
  const deleteModifierMutation = trpc.modifiers.deleteModifier.useMutation();

  const showMsg = (text: string, type: "success" | "error") => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => { setMessage(""); setMessageType(""); }, 3000);
  };

  const handleCreateGroup = async () => {
    if (!groupForm.name.trim() || isSaving) return;
    setIsSaving(true);
    try {
      await createGroupMutation.mutateAsync({
        productId: pid,
        name: groupForm.name.trim(),
        type: groupForm.type,
        required: groupForm.required,
        minSelections: groupForm.minSelections,
        maxSelections: groupForm.maxSelections,
        sortOrder: groupForm.sortOrder,
      });
      showMsg("Group created!", "success");
      setShowAddGroup(false);
      setGroupForm({ name: "", type: "single", required: false, minSelections: 0, maxSelections: 1, sortOrder: 0 });
      refetch();
    } catch (e: any) {
      showMsg(e.message || "Failed to create group", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateGroup = async () => {
    if (!editingGroup || isSaving) return;
    setIsSaving(true);
    try {
      await updateGroupMutation.mutateAsync({
        id: editingGroup.id,
        name: editingGroup.name,
        type: editingGroup.type,
        required: editingGroup.required,
        minSelections: editingGroup.minSelections,
        maxSelections: editingGroup.maxSelections,
        sortOrder: editingGroup.sortOrder,
      });
      showMsg("Group updated!", "success");
      setEditingGroup(null);
      refetch();
    } catch (e: any) {
      showMsg(e.message || "Failed to update group", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGroup = async (groupId: number) => {
    try {
      await deleteGroupMutation.mutateAsync({ id: groupId });
      showMsg("Group deleted", "success");
      refetch();
    } catch (e: any) {
      showMsg(e.message || "Failed to delete group", "error");
    }
  };

  const handleCreateModifier = async (groupId: number) => {
    if (!modForm.name.trim() || isSaving) return;
    setIsSaving(true);
    try {
      await createModifierMutation.mutateAsync({
        groupId,
        name: modForm.name.trim(),
        price: modForm.price,
        sortOrder: modForm.sortOrder,
      });
      showMsg("Option added!", "success");
      setShowAddModifier(null);
      setModForm({ name: "", price: "0.00", sortOrder: 0 });
      refetch();
    } catch (e: any) {
      showMsg(e.message || "Failed to add option", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateModifier = async () => {
    if (!editingModifier || isSaving) return;
    setIsSaving(true);
    try {
      await updateModifierMutation.mutateAsync({
        id: editingModifier.id,
        name: editingModifier.name,
        price: editingModifier.price,
        sortOrder: editingModifier.sortOrder,
      });
      showMsg("Option updated!", "success");
      setEditingModifier(null);
      refetch();
    } catch (e: any) {
      showMsg(e.message || "Failed to update option", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteModifier = async (modifierId: number) => {
    try {
      await deleteModifierMutation.mutateAsync({ id: modifierId });
      showMsg("Option deleted", "success");
      refetch();
    } catch (e: any) {
      showMsg(e.message || "Failed to delete option", "error");
    }
  };

  return (
    <ScreenContainer className="p-4">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 12 }}>
          <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "600" }}>← Back to Products</Text>
        </TouchableOpacity>

        <Text style={{ fontSize: 22, fontWeight: "700", color: colors.foreground, marginBottom: 4 }}>
          Manage Add-ons
        </Text>
        <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 16 }}>
          {decodeURIComponent(productName || "")}
        </Text>

        {/* Message */}
        {message ? (
          <View style={{ backgroundColor: messageType === "success" ? "#22C55E15" : "#EF444415", padding: 12, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: messageType === "success" ? "#22C55E" : "#EF4444" }}>
            <Text style={{ color: messageType === "success" ? "#22C55E" : "#EF4444", fontWeight: "600", fontSize: 13 }}>{message}</Text>
          </View>
        ) : null}

        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Existing Groups */}
            {(groupsData?.groups || []).map((group: any) => (
              <View key={group.id} style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
                {/* Group Header */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>{group.name}</Text>
                      <View style={{ backgroundColor: group.type === "single" ? "#0EA5E920" : "#8B5CF620", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                        <Text style={{ fontSize: 10, fontWeight: "700", color: group.type === "single" ? "#0EA5E9" : "#8B5CF6" }}>
                          {group.type === "single" ? "PICK ONE" : "PICK MANY"}
                        </Text>
                      </View>
                      {group.required && (
                        <View style={{ backgroundColor: "#EF444420", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ fontSize: 10, fontWeight: "700", color: "#EF4444" }}>REQUIRED</Text>
                        </View>
                      )}
                    </View>
                    {group.type === "multi" && (
                      <Text style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>
                        Min: {group.minSelections} / Max: {group.maxSelections}
                      </Text>
                    )}
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => setEditingGroup({ ...group })}
                      style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.primary + "15", borderRadius: 8 }}
                    >
                      <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 12 }}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteGroup(group.id)}
                      style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#EF444415", borderRadius: 8 }}
                    >
                      <Text style={{ color: "#EF4444", fontWeight: "600", fontSize: 12 }}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Modifiers in this group */}
                {(group.modifiers || []).map((mod: any, idx: number) => (
                  <View key={mod.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderTopWidth: idx === 0 ? 1 : 0, borderBottomWidth: 1, borderColor: colors.border + "60" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, color: colors.foreground, fontWeight: "500" }}>{mod.name}</Text>
                    </View>
                    <Text style={{ fontSize: 14, color: parseFloat(mod.price) > 0 ? colors.primary : colors.muted, fontWeight: "600", marginRight: 12 }}>
                      {parseFloat(mod.price) > 0 ? `+€${parseFloat(mod.price).toFixed(2)}` : "Free"}
                    </Text>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      <TouchableOpacity
                        onPress={() => setEditingModifier({ ...mod })}
                        style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.primary + "10", borderRadius: 6 }}
                      >
                        <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "600" }}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteModifier(mod.id)}
                        style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: "#EF444410", borderRadius: 6 }}
                      >
                        <Text style={{ color: "#EF4444", fontSize: 11, fontWeight: "600" }}>Del</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}

                {/* Add option button */}
                <TouchableOpacity
                  onPress={() => { setShowAddModifier(group.id); setModForm({ name: "", price: "0.00", sortOrder: (group.modifiers?.length || 0) }); }}
                  style={{ marginTop: 10, paddingVertical: 10, backgroundColor: "#22C55E10", borderWidth: 1, borderColor: "#22C55E", borderRadius: 10, alignItems: "center" }}
                >
                  <Text style={{ color: "#22C55E", fontWeight: "700", fontSize: 13 }}>+ Add Option</Text>
                </TouchableOpacity>

                {/* Inline add modifier form */}
                {showAddModifier === group.id && (
                  <View style={{ marginTop: 12, padding: 12, backgroundColor: colors.background, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground, marginBottom: 8 }}>New Option</Text>
                    <TextInput
                      style={s.input(colors)}
                      placeholder="Option name (e.g. Lettuce, Basmati Rice)"
                      placeholderTextColor={colors.muted}
                      value={modForm.name}
                      onChangeText={(t) => setModForm({ ...modForm, name: t })}
                      returnKeyType="done"
                    />
                    <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 4 }}>Extra Price (€)</Text>
                        <TextInput
                          style={s.input(colors)}
                          placeholder="0.00"
                          placeholderTextColor={colors.muted}
                          value={modForm.price}
                          onChangeText={(t) => setModForm({ ...modForm, price: t })}
                          keyboardType="decimal-pad"
                          returnKeyType="done"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 4 }}>Sort Order</Text>
                        <TextInput
                          style={s.input(colors)}
                          placeholder="0"
                          placeholderTextColor={colors.muted}
                          value={modForm.sortOrder.toString()}
                          onChangeText={(t) => setModForm({ ...modForm, sortOrder: parseInt(t) || 0 })}
                          keyboardType="number-pad"
                          returnKeyType="done"
                        />
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                      <TouchableOpacity
                        onPress={() => setShowAddModifier(null)}
                        style={{ flex: 1, paddingVertical: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, alignItems: "center" }}
                      >
                        <Text style={{ color: colors.foreground, fontWeight: "600" }}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleCreateModifier(group.id)}
                        disabled={isSaving}
                        style={{ flex: 1, paddingVertical: 10, backgroundColor: isSaving ? colors.muted : "#22C55E", borderRadius: 10, alignItems: "center" }}
                      >
                        <Text style={{ color: "#fff", fontWeight: "700" }}>{isSaving ? "Adding..." : "Add Option"}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            ))}

            {/* Add Group Button */}
            <TouchableOpacity
              onPress={() => setShowAddGroup(true)}
              style={{ paddingVertical: 14, backgroundColor: "#8B5CF615", borderWidth: 2, borderColor: "#8B5CF6", borderRadius: 14, alignItems: "center", borderStyle: "dashed" }}
            >
              <Text style={{ color: "#8B5CF6", fontWeight: "700", fontSize: 15 }}>+ Add Modifier Group</Text>
              <Text style={{ color: "#8B5CF680", fontSize: 11, marginTop: 2 }}>e.g. "Choose your side", "Toppings", "Sauce"</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Add Group Modal */}
      <Modal visible={showAddGroup} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "80%" }}>
            <ScrollView>
              <Text style={{ fontSize: 20, fontWeight: "700", color: colors.foreground, marginBottom: 16 }}>New Modifier Group</Text>

              <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 4 }}>Group Name</Text>
              <TextInput
                style={s.input(colors)}
                placeholder="e.g. Choose your side, Toppings, Sauce"
                placeholderTextColor={colors.muted}
                value={groupForm.name}
                onChangeText={(t) => setGroupForm({ ...groupForm, name: t })}
                returnKeyType="done"
              />

              <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 4, marginTop: 12 }}>Selection Type</Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                  onPress={() => setGroupForm({ ...groupForm, type: "single", maxSelections: 1 })}
                  style={{ flex: 1, paddingVertical: 12, backgroundColor: groupForm.type === "single" ? "#0EA5E915" : colors.surface, borderWidth: 2, borderColor: groupForm.type === "single" ? "#0EA5E9" : colors.border, borderRadius: 12, alignItems: "center" }}
                >
                  <Text style={{ fontWeight: "700", color: groupForm.type === "single" ? "#0EA5E9" : colors.foreground, fontSize: 13 }}>Pick One</Text>
                  <Text style={{ fontSize: 10, color: colors.muted, marginTop: 2 }}>Radio buttons</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setGroupForm({ ...groupForm, type: "multi", maxSelections: 5 })}
                  style={{ flex: 1, paddingVertical: 12, backgroundColor: groupForm.type === "multi" ? "#8B5CF615" : colors.surface, borderWidth: 2, borderColor: groupForm.type === "multi" ? "#8B5CF6" : colors.border, borderRadius: 12, alignItems: "center" }}
                >
                  <Text style={{ fontWeight: "700", color: groupForm.type === "multi" ? "#8B5CF6" : colors.foreground, fontSize: 13 }}>Pick Many</Text>
                  <Text style={{ fontSize: 10, color: colors.muted, marginTop: 2 }}>Checkboxes</Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16, paddingVertical: 12, paddingHorizontal: 12, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ fontSize: 14, color: colors.foreground, fontWeight: "500" }}>Required?</Text>
                <Switch
                  value={groupForm.required}
                  onValueChange={(v) => setGroupForm({ ...groupForm, required: v })}
                  trackColor={{ false: colors.border, true: "#22C55E" }}
                />
              </View>

              {groupForm.type === "multi" && (
                <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 4 }}>Min Selections</Text>
                    <TextInput
                      style={s.input(colors)}
                      value={groupForm.minSelections.toString()}
                      onChangeText={(t) => setGroupForm({ ...groupForm, minSelections: parseInt(t) || 0 })}
                      keyboardType="number-pad"
                      returnKeyType="done"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 4 }}>Max Selections</Text>
                    <TextInput
                      style={s.input(colors)}
                      value={groupForm.maxSelections.toString()}
                      onChangeText={(t) => setGroupForm({ ...groupForm, maxSelections: parseInt(t) || 0 })}
                      keyboardType="number-pad"
                      returnKeyType="done"
                    />
                  </View>
                </View>
              )}

              <View style={{ flex: 1, marginTop: 12 }}>
                <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 4 }}>Sort Order</Text>
                <TextInput
                  style={s.input(colors)}
                  value={groupForm.sortOrder.toString()}
                  onChangeText={(t) => setGroupForm({ ...groupForm, sortOrder: parseInt(t) || 0 })}
                  keyboardType="number-pad"
                  returnKeyType="done"
                />
              </View>
            </ScrollView>

            <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
              <TouchableOpacity
                onPress={() => setShowAddGroup(false)}
                style={{ flex: 1, paddingVertical: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, alignItems: "center" }}
              >
                <Text style={{ color: colors.foreground, fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateGroup}
                disabled={isSaving}
                style={{ flex: 1, paddingVertical: 14, backgroundColor: isSaving ? colors.muted : "#8B5CF6", borderRadius: 12, alignItems: "center" }}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>{isSaving ? "Creating..." : "Create Group"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Group Modal */}
      <Modal visible={!!editingGroup} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "80%" }}>
            <ScrollView>
              <Text style={{ fontSize: 20, fontWeight: "700", color: colors.foreground, marginBottom: 16 }}>Edit Group</Text>

              <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 4 }}>Group Name</Text>
              <TextInput
                style={s.input(colors)}
                value={editingGroup?.name || ""}
                onChangeText={(t) => setEditingGroup({ ...editingGroup, name: t })}
                returnKeyType="done"
              />

              <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 4, marginTop: 12 }}>Selection Type</Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                  onPress={() => setEditingGroup({ ...editingGroup, type: "single", maxSelections: 1 })}
                  style={{ flex: 1, paddingVertical: 12, backgroundColor: editingGroup?.type === "single" ? "#0EA5E915" : colors.surface, borderWidth: 2, borderColor: editingGroup?.type === "single" ? "#0EA5E9" : colors.border, borderRadius: 12, alignItems: "center" }}
                >
                  <Text style={{ fontWeight: "700", color: editingGroup?.type === "single" ? "#0EA5E9" : colors.foreground, fontSize: 13 }}>Pick One</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setEditingGroup({ ...editingGroup, type: "multi", maxSelections: 5 })}
                  style={{ flex: 1, paddingVertical: 12, backgroundColor: editingGroup?.type === "multi" ? "#8B5CF615" : colors.surface, borderWidth: 2, borderColor: editingGroup?.type === "multi" ? "#8B5CF6" : colors.border, borderRadius: 12, alignItems: "center" }}
                >
                  <Text style={{ fontWeight: "700", color: editingGroup?.type === "multi" ? "#8B5CF6" : colors.foreground, fontSize: 13 }}>Pick Many</Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16, paddingVertical: 12, paddingHorizontal: 12, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ fontSize: 14, color: colors.foreground, fontWeight: "500" }}>Required?</Text>
                <Switch
                  value={editingGroup?.required || false}
                  onValueChange={(v) => setEditingGroup({ ...editingGroup, required: v })}
                  trackColor={{ false: colors.border, true: "#22C55E" }}
                />
              </View>

              {editingGroup?.type === "multi" && (
                <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 4 }}>Min Selections</Text>
                    <TextInput
                      style={s.input(colors)}
                      value={(editingGroup?.minSelections || 0).toString()}
                      onChangeText={(t) => setEditingGroup({ ...editingGroup, minSelections: parseInt(t) || 0 })}
                      keyboardType="number-pad"
                      returnKeyType="done"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 4 }}>Max Selections</Text>
                    <TextInput
                      style={s.input(colors)}
                      value={(editingGroup?.maxSelections || 0).toString()}
                      onChangeText={(t) => setEditingGroup({ ...editingGroup, maxSelections: parseInt(t) || 0 })}
                      keyboardType="number-pad"
                      returnKeyType="done"
                    />
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
              <TouchableOpacity
                onPress={() => setEditingGroup(null)}
                style={{ flex: 1, paddingVertical: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, alignItems: "center" }}
              >
                <Text style={{ color: colors.foreground, fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleUpdateGroup}
                disabled={isSaving}
                style={{ flex: 1, paddingVertical: 14, backgroundColor: isSaving ? colors.muted : colors.primary, borderRadius: 12, alignItems: "center" }}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>{isSaving ? "Saving..." : "Save"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Modifier Modal */}
      <Modal visible={!!editingModifier} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", paddingHorizontal: 24 }}>
          <View style={{ backgroundColor: colors.background, borderRadius: 20, padding: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground, marginBottom: 16 }}>Edit Option</Text>

            <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 4 }}>Name</Text>
            <TextInput
              style={s.input(colors)}
              value={editingModifier?.name || ""}
              onChangeText={(t) => setEditingModifier({ ...editingModifier, name: t })}
              returnKeyType="done"
            />

            <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 4, marginTop: 12 }}>Extra Price (€)</Text>
            <TextInput
              style={s.input(colors)}
              value={editingModifier?.price || "0.00"}
              onChangeText={(t) => setEditingModifier({ ...editingModifier, price: t })}
              keyboardType="decimal-pad"
              returnKeyType="done"
            />

            <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 4, marginTop: 12 }}>Sort Order</Text>
            <TextInput
              style={s.input(colors)}
              value={(editingModifier?.sortOrder || 0).toString()}
              onChangeText={(t) => setEditingModifier({ ...editingModifier, sortOrder: parseInt(t) || 0 })}
              keyboardType="number-pad"
              returnKeyType="done"
            />

            <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
              <TouchableOpacity
                onPress={() => setEditingModifier(null)}
                style={{ flex: 1, paddingVertical: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, alignItems: "center" }}
              >
                <Text style={{ color: colors.foreground, fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleUpdateModifier}
                disabled={isSaving}
                style={{ flex: 1, paddingVertical: 14, backgroundColor: isSaving ? colors.muted : colors.primary, borderRadius: 12, alignItems: "center" }}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>{isSaving ? "Saving..." : "Save"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const s = {
  input: (colors: any) => ({
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    color: colors.foreground,
    fontSize: 14,
    marginBottom: 4,
  }),
};

export default function ProductModifiersScreen() {
  return (
    <AdminDesktopLayout>
      <ProductModifiersContent />
    </AdminDesktopLayout>
  );
}
