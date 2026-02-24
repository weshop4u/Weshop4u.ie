import { Text, View, TouchableOpacity, TextInput, ScrollView, Modal, Platform, ActivityIndicator } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useState } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { AdminDesktopLayout } from "@/components/admin-desktop-layout";

function ProductDealsContent() {
  const router = useRouter();
  const colors = useColors();
  const { productId, productName } = useLocalSearchParams<{ productId: string; productName: string }>();
  const pid = parseInt(productId || "0");

  const [showAddDeal, setShowAddDeal] = useState(false);
  const [editingDeal, setEditingDeal] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [isSaving, setIsSaving] = useState(false);

  const [dealForm, setDealForm] = useState({
    quantity: "2",
    dealPrice: "",
    label: "",
  });

  const { data: deals, refetch, isLoading } = trpc.modifiers.getDeals.useQuery(
    { productId: pid },
    { enabled: pid > 0 }
  );

  const createDealMutation = trpc.modifiers.createDeal.useMutation();
  const updateDealMutation = trpc.modifiers.updateDeal.useMutation();
  const deleteDealMutation = trpc.modifiers.deleteDeal.useMutation();

  const showMsg = (text: string, type: "success" | "error") => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => { setMessage(""); setMessageType(""); }, 3000);
  };

  const handleCreateDeal = async () => {
    const qty = parseInt(dealForm.quantity);
    if (!qty || !dealForm.dealPrice.trim() || isSaving) return;
    setIsSaving(true);
    try {
      await createDealMutation.mutateAsync({
        productId: pid,
        quantity: qty,
        dealPrice: dealForm.dealPrice.trim(),
        label: dealForm.label.trim() || `${qty} for €${dealForm.dealPrice.trim()}`,
      });
      showMsg("Deal created!", "success");
      setShowAddDeal(false);
      setDealForm({ quantity: "2", dealPrice: "", label: "" });
      refetch();
    } catch (e: any) {
      showMsg(e.message || "Failed to create deal", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateDeal = async () => {
    if (!editingDeal || isSaving) return;
    setIsSaving(true);
    try {
      await updateDealMutation.mutateAsync({
        id: editingDeal.id,
        quantity: editingDeal.quantity,
        dealPrice: editingDeal.dealPrice,
        label: editingDeal.label,
      });
      showMsg("Deal updated!", "success");
      setEditingDeal(null);
      refetch();
    } catch (e: any) {
      showMsg(e.message || "Failed to update deal", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDeal = async (dealId: number) => {
    try {
      await deleteDealMutation.mutateAsync({ id: dealId });
      showMsg("Deal deleted", "success");
      refetch();
    } catch (e: any) {
      showMsg(e.message || "Failed to delete deal", "error");
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
          Manage Deals
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
            {/* Existing Deals */}
            {(deals || []).map((deal: any) => (
              <View key={deal.id} style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={{ backgroundColor: "#F59E0B20", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                        <Text style={{ fontSize: 14, fontWeight: "700", color: "#92400E" }}>🏷️ {deal.label}</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 12, color: colors.muted, marginTop: 6 }}>
                      Buy {deal.quantity} for €{parseFloat(deal.dealPrice).toFixed(2)} (instead of €{(parseFloat(deal.dealPrice) / deal.quantity * deal.quantity).toFixed(2)} each)
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => setEditingDeal({ ...deal })}
                      style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.primary + "15", borderRadius: 8 }}
                    >
                      <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 12 }}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteDeal(deal.id)}
                      style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#EF444415", borderRadius: 8 }}
                    >
                      <Text style={{ color: "#EF4444", fontWeight: "600", fontSize: 12 }}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}

            {(deals || []).length === 0 && (
              <View style={{ padding: 24, alignItems: "center", marginBottom: 16 }}>
                <Text style={{ fontSize: 40, marginBottom: 8 }}>🏷️</Text>
                <Text style={{ fontSize: 15, color: colors.muted, textAlign: "center" }}>No deals set up yet for this product.</Text>
                <Text style={{ fontSize: 12, color: colors.muted, textAlign: "center", marginTop: 4 }}>Add a multi-buy deal like "2 for €2.50" or "3 for €5"</Text>
              </View>
            )}

            {/* Add Deal Button */}
            <TouchableOpacity
              onPress={() => setShowAddDeal(true)}
              style={{ paddingVertical: 14, backgroundColor: "#F59E0B15", borderWidth: 2, borderColor: "#F59E0B", borderRadius: 14, alignItems: "center", borderStyle: "dashed" }}
            >
              <Text style={{ color: "#92400E", fontWeight: "700", fontSize: 15 }}>+ Add Multi-Buy Deal</Text>
              <Text style={{ color: "#92400E80", fontSize: 11, marginTop: 2 }}>e.g. "2 for €2.50", "3 for €5.00"</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Add Deal Modal */}
      <Modal visible={showAddDeal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", paddingHorizontal: 24 }}>
          <View style={{ backgroundColor: colors.background, borderRadius: 20, padding: 24 }}>
            <Text style={{ fontSize: 20, fontWeight: "700", color: colors.foreground, marginBottom: 16 }}>New Multi-Buy Deal</Text>

            <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 4 }}>Quantity Required</Text>
            <TextInput
              style={s.input(colors)}
              placeholder="e.g. 2"
              placeholderTextColor={colors.muted}
              value={dealForm.quantity}
              onChangeText={(t) => setDealForm({ ...dealForm, quantity: t })}
              keyboardType="number-pad"
              returnKeyType="done"
            />

            <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 4, marginTop: 12 }}>Deal Price (€)</Text>
            <TextInput
              style={s.input(colors)}
              placeholder="e.g. 2.50"
              placeholderTextColor={colors.muted}
              value={dealForm.dealPrice}
              onChangeText={(t) => setDealForm({ ...dealForm, dealPrice: t })}
              keyboardType="decimal-pad"
              returnKeyType="done"
            />

            <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 4, marginTop: 12 }}>Label (optional)</Text>
            <TextInput
              style={s.input(colors)}
              placeholder={`Auto: "${dealForm.quantity} for €${dealForm.dealPrice || '...'}"`}
              placeholderTextColor={colors.muted}
              value={dealForm.label}
              onChangeText={(t) => setDealForm({ ...dealForm, label: t })}
              returnKeyType="done"
            />

            <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
              <TouchableOpacity
                onPress={() => setShowAddDeal(false)}
                style={{ flex: 1, paddingVertical: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, alignItems: "center" }}
              >
                <Text style={{ color: colors.foreground, fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateDeal}
                disabled={isSaving}
                style={{ flex: 1, paddingVertical: 14, backgroundColor: isSaving ? colors.muted : "#F59E0B", borderRadius: 12, alignItems: "center" }}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>{isSaving ? "Creating..." : "Create Deal"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Deal Modal */}
      <Modal visible={!!editingDeal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", paddingHorizontal: 24 }}>
          <View style={{ backgroundColor: colors.background, borderRadius: 20, padding: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground, marginBottom: 16 }}>Edit Deal</Text>

            <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 4 }}>Quantity Required</Text>
            <TextInput
              style={s.input(colors)}
              value={(editingDeal?.quantity || "").toString()}
              onChangeText={(t) => setEditingDeal({ ...editingDeal, quantity: parseInt(t) || 0 })}
              keyboardType="number-pad"
              returnKeyType="done"
            />

            <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 4, marginTop: 12 }}>Deal Price (€)</Text>
            <TextInput
              style={s.input(colors)}
              value={editingDeal?.dealPrice || ""}
              onChangeText={(t) => setEditingDeal({ ...editingDeal, dealPrice: t })}
              keyboardType="decimal-pad"
              returnKeyType="done"
            />

            <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 4, marginTop: 12 }}>Label</Text>
            <TextInput
              style={s.input(colors)}
              value={editingDeal?.label || ""}
              onChangeText={(t) => setEditingDeal({ ...editingDeal, label: t })}
              returnKeyType="done"
            />

            <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
              <TouchableOpacity
                onPress={() => setEditingDeal(null)}
                style={{ flex: 1, paddingVertical: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, alignItems: "center" }}
              >
                <Text style={{ color: colors.foreground, fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleUpdateDeal}
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

export default function ProductDealsScreen() {
  return (
    <AdminDesktopLayout>
      <ProductDealsContent />
    </AdminDesktopLayout>
  );
}
