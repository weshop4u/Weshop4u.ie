import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
  StyleSheet,
  Modal,
  Switch,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { AdminDesktopLayout } from "@/components/admin-desktop-layout";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";

type DiscountType = "percentage" | "fixed_amount" | "free_delivery";

interface CreateForm {
  code: string;
  description: string;
  discountType: DiscountType;
  discountValue: string;
  minOrderValue: string;
  maxDiscountAmount: string;
  storeId: number | null;
  maxUsesTotal: string;
  maxUsesPerCustomer: string;
  startsAt: string;
  expiresAt: string;
}

const emptyForm: CreateForm = {
  code: "",
  description: "",
  discountType: "percentage",
  discountValue: "",
  minOrderValue: "",
  maxDiscountAmount: "",
  storeId: null,
  maxUsesTotal: "",
  maxUsesPerCustomer: "1",
  startsAt: "",
  expiresAt: "",
};

export default function DiscountCodesScreen() {
  const colors = useColors();
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [form, setForm] = useState<CreateForm>({ ...emptyForm });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [toast, setToast] = useState("");

  const { data: codes, refetch } = trpc.discounts.list.useQuery(
    { includeInactive: showInactive }
  );
  const { data: stores } = trpc.stores.getAll.useQuery();

  const createMutation = trpc.discounts.create.useMutation({
    onSuccess: () => {
      refetch();
      setShowCreate(false);
      setForm({ ...emptyForm });
      showToast("Discount code created");
    },
    onError: (err) => showToast(err.message),
  });

  const updateMutation = trpc.discounts.update.useMutation({
    onSuccess: () => {
      refetch();
      setShowCreate(false);
      setEditingId(null);
      setForm({ ...emptyForm });
      showToast("Discount code updated");
    },
    onError: (err) => showToast(err.message),
  });

  const toggleMutation = trpc.discounts.toggleActive.useMutation({
    onSuccess: () => {
      refetch();
      showToast("Status updated");
    },
  });

  const deleteMutation = trpc.discounts.delete.useMutation({
    onSuccess: () => {
      refetch();
      showToast("Discount code deleted");
    },
  });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  function handleCreate() {
    const val = parseFloat(form.discountValue) || 0;
    const payload = {
      code: form.code,
      description: form.description || undefined,
      discountType: form.discountType,
      discountValue: form.discountType === "free_delivery" ? 0 : val,
      minOrderValue: parseFloat(form.minOrderValue) || 0,
      maxDiscountAmount: form.maxDiscountAmount ? parseFloat(form.maxDiscountAmount) : null,
      storeId: form.storeId,
      maxUsesTotal: form.maxUsesTotal ? parseInt(form.maxUsesTotal) : null,
      maxUsesPerCustomer: parseInt(form.maxUsesPerCustomer) || 1,
      startsAt: form.startsAt || null,
      expiresAt: form.expiresAt || null,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function handleEdit(code: NonNullable<typeof codes>[0]) {
    setEditingId(code.id);
    setForm({
      code: code.code,
      description: code.description || "",
      discountType: code.discountType as DiscountType,
      discountValue: code.discountValue?.toString() || "",
      minOrderValue: code.minOrderValue?.toString() || "0",
      maxDiscountAmount: code.maxDiscountAmount?.toString() || "",
      storeId: code.storeId,
      maxUsesTotal: code.maxUsesTotal?.toString() || "",
      maxUsesPerCustomer: code.maxUsesPerCustomer?.toString() || "1",
      startsAt: code.startsAt ? new Date(code.startsAt).toISOString().slice(0, 16) : "",
      expiresAt: code.expiresAt ? new Date(code.expiresAt).toISOString().slice(0, 16) : "",
    });
    setShowCreate(true);
  }

  function handleDelete(id: number, codeName: string) {
    if (Platform.OS === "web") {
      if (confirm(`Delete discount code "${codeName}"? This cannot be undone.`)) {
        deleteMutation.mutate({ id });
      }
    } else {
      Alert.alert("Delete Code", `Delete "${codeName}"? This cannot be undone.`, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate({ id }) },
      ]);
    }
  }

  function formatDiscountLabel(type: string, value: string | null) {
    const v = parseFloat(value || "0");
    switch (type) {
      case "percentage": return `${v}% off`;
      case "fixed_amount": return `€${v.toFixed(2)} off`;
      case "free_delivery": return "Free Delivery";
      default: return type;
    }
  }

  function isExpired(expiresAt: Date | string | null) {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  }

  function isNotStarted(startsAt: Date | string | null) {
    if (!startsAt) return false;
    return new Date(startsAt) > new Date();
  }

  const content = (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
          <Text style={[styles.backBtn, { color: colors.primary }]}>← Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Discount Codes</Text>
        <Pressable
          onPress={() => {
            setEditingId(null);
            setForm({ ...emptyForm });
            setShowCreate(true);
          }}
          style={({ pressed }) => [styles.createBtn, { backgroundColor: colors.primary }, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.createBtnText}>+ New Code</Text>
        </Pressable>
      </View>

      {/* Show inactive toggle */}
      <View style={styles.filterRow}>
        <Text style={[styles.filterLabel, { color: colors.muted }]}>Show disabled codes</Text>
        <Switch
          value={showInactive}
          onValueChange={setShowInactive}
          trackColor={{ true: colors.primary }}
        />
      </View>

      {/* Codes list */}
      {!codes || codes.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.emptyText, { color: colors.muted }]}>
            No discount codes yet. Tap "+ New Code" to create your first one.
          </Text>
        </View>
      ) : (
        codes.map((code) => {
          const expired = isExpired(code.expiresAt);
          const notStarted = isNotStarted(code.startsAt);
          return (
            <View
              key={code.id}
              style={[
                styles.codeCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: !code.isActive || expired ? colors.error : colors.border,
                  opacity: !code.isActive || expired ? 0.6 : 1,
                },
              ]}
            >
              <View style={styles.codeHeader}>
                <View style={{ flex: 1 }}>
                  <View style={styles.codeNameRow}>
                    <Text style={[styles.codeName, { color: colors.foreground }]}>{code.code}</Text>
                    {!code.isActive && (
                      <View style={[styles.badge, { backgroundColor: "#EF4444" }]}>
                        <Text style={styles.badgeText}>DISABLED</Text>
                      </View>
                    )}
                    {expired && code.isActive && (
                      <View style={[styles.badge, { backgroundColor: "#F59E0B" }]}>
                        <Text style={styles.badgeText}>EXPIRED</Text>
                      </View>
                    )}
                    {notStarted && code.isActive && (
                      <View style={[styles.badge, { backgroundColor: "#3B82F6" }]}>
                        <Text style={styles.badgeText}>SCHEDULED</Text>
                      </View>
                    )}
                  </View>
                  {code.description && (
                    <Text style={[styles.codeDesc, { color: colors.muted }]}>{code.description}</Text>
                  )}
                </View>
                <View style={[styles.discountBadge, { backgroundColor: colors.primary + "20" }]}>
                  <Text style={[styles.discountLabel, { color: colors.primary }]}>
                    {formatDiscountLabel(code.discountType, code.discountValue)}
                  </Text>
                </View>
              </View>

              {/* Details */}
              <View style={styles.detailsGrid}>
                {code.storeName && (
                  <View style={styles.detailItem}>
                    <Text style={[styles.detailLabel, { color: colors.muted }]}>Store</Text>
                    <Text style={[styles.detailValue, { color: colors.foreground }]}>{code.storeName}</Text>
                  </View>
                )}
                {parseFloat(code.minOrderValue as string) > 0 && (
                  <View style={styles.detailItem}>
                    <Text style={[styles.detailLabel, { color: colors.muted }]}>Min Order</Text>
                    <Text style={[styles.detailValue, { color: colors.foreground }]}>
                      €{parseFloat(code.minOrderValue as string).toFixed(2)}
                    </Text>
                  </View>
                )}
                {code.maxDiscountAmount && (
                  <View style={styles.detailItem}>
                    <Text style={[styles.detailLabel, { color: colors.muted }]}>Max Discount</Text>
                    <Text style={[styles.detailValue, { color: colors.foreground }]}>
                      €{parseFloat(code.maxDiscountAmount as string).toFixed(2)}
                    </Text>
                  </View>
                )}
                <View style={styles.detailItem}>
                  <Text style={[styles.detailLabel, { color: colors.muted }]}>Uses</Text>
                  <Text style={[styles.detailValue, { color: colors.foreground }]}>
                    {code.currentUsesTotal || 0}
                    {code.maxUsesTotal ? ` / ${code.maxUsesTotal}` : " (unlimited)"}
                  </Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={[styles.detailLabel, { color: colors.muted }]}>Per Customer</Text>
                  <Text style={[styles.detailValue, { color: colors.foreground }]}>
                    {code.maxUsesPerCustomer || "Unlimited"}
                  </Text>
                </View>
                {code.expiresAt && (
                  <View style={styles.detailItem}>
                    <Text style={[styles.detailLabel, { color: colors.muted }]}>Expires</Text>
                    <Text style={[styles.detailValue, { color: expired ? "#EF4444" : colors.foreground }]}>
                      {new Date(code.expiresAt).toLocaleString()}
                    </Text>
                  </View>
                )}
              </View>

              {/* Actions */}
              <View style={styles.actionRow}>
                <Pressable
                  onPress={() => handleEdit(code)}
                  style={({ pressed }) => [styles.actionBtn, { borderColor: colors.border }, pressed && { opacity: 0.7 }]}
                >
                  <Text style={[styles.actionBtnText, { color: colors.primary }]}>Edit</Text>
                </Pressable>
                <Pressable
                  onPress={() => toggleMutation.mutate({ id: code.id })}
                  style={({ pressed }) => [styles.actionBtn, { borderColor: colors.border }, pressed && { opacity: 0.7 }]}
                >
                  <Text style={[styles.actionBtnText, { color: code.isActive ? "#F59E0B" : "#22C55E" }]}>
                    {code.isActive ? "Disable" : "Enable"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => handleDelete(code.id, code.code)}
                  style={({ pressed }) => [styles.actionBtn, { borderColor: "#EF4444" }, pressed && { opacity: 0.7 }]}
                >
                  <Text style={[styles.actionBtnText, { color: "#EF4444" }]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          );
        })
      )}

      {/* Create/Edit Modal */}
      <Modal visible={showCreate} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <ScrollView>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {editingId ? "Edit Discount Code" : "Create Discount Code"}
              </Text>

              {/* Code */}
              {!editingId && (
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.foreground }]}>Code *</Text>
                  <TextInput
                    value={form.code}
                    onChangeText={(t) => setForm({ ...form, code: t.toUpperCase().replace(/\s/g, "") })}
                    placeholder="e.g. WESHOP10, FLASH20, FREE3D"
                    placeholderTextColor={colors.muted}
                    style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                    autoCapitalize="characters"
                  />
                </View>
              )}

              {/* Description */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.foreground }]}>Description</Text>
                <TextInput
                  value={form.description}
                  onChangeText={(t) => setForm({ ...form, description: t })}
                  placeholder="e.g. Welcome 10% off first order"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                />
              </View>

              {/* Discount Type */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.foreground }]}>Discount Type *</Text>
                <View style={styles.typeRow}>
                  {(["percentage", "fixed_amount", "free_delivery"] as DiscountType[]).map((type) => (
                    <Pressable
                      key={type}
                      onPress={() => setForm({ ...form, discountType: type })}
                      style={[
                        styles.typeBtn,
                        {
                          borderColor: form.discountType === type ? colors.primary : colors.border,
                          backgroundColor: form.discountType === type ? colors.primary + "15" : colors.surface,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.typeBtnText,
                          { color: form.discountType === type ? colors.primary : colors.muted },
                        ]}
                      >
                        {type === "percentage" ? "% Off" : type === "fixed_amount" ? "€ Off" : "Free Delivery"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Discount Value */}
              {form.discountType !== "free_delivery" && (
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.foreground }]}>
                    {form.discountType === "percentage" ? "Percentage (1-100)" : "Amount (€)"}
                  </Text>
                  <TextInput
                    value={form.discountValue}
                    onChangeText={(t) => setForm({ ...form, discountValue: t })}
                    placeholder={form.discountType === "percentage" ? "e.g. 10" : "e.g. 5.00"}
                    placeholderTextColor={colors.muted}
                    keyboardType="decimal-pad"
                    style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                  />
                </View>
              )}

              {/* Min Order Value */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.foreground }]}>Minimum Order (€)</Text>
                <TextInput
                  value={form.minOrderValue}
                  onChangeText={(t) => setForm({ ...form, minOrderValue: t })}
                  placeholder="0 = no minimum"
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                  style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                />
              </View>

              {/* Max Discount Amount (for percentage) */}
              {form.discountType === "percentage" && (
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.foreground }]}>Max Discount Cap (€)</Text>
                  <TextInput
                    value={form.maxDiscountAmount}
                    onChangeText={(t) => setForm({ ...form, maxDiscountAmount: t })}
                    placeholder="Empty = no cap"
                    placeholderTextColor={colors.muted}
                    keyboardType="decimal-pad"
                    style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                  />
                </View>
              )}

              {/* Store-specific */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.foreground }]}>Store (optional)</Text>
                <View style={styles.typeRow}>
                  <Pressable
                    onPress={() => setForm({ ...form, storeId: null })}
                    style={[
                      styles.typeBtn,
                      {
                        borderColor: form.storeId === null ? colors.primary : colors.border,
                        backgroundColor: form.storeId === null ? colors.primary + "15" : colors.surface,
                      },
                    ]}
                  >
                    <Text style={[styles.typeBtnText, { color: form.storeId === null ? colors.primary : colors.muted }]}>
                      All Stores
                    </Text>
                  </Pressable>
                  {stores?.map((store) => (
                    <Pressable
                      key={store.id}
                      onPress={() => setForm({ ...form, storeId: store.id })}
                      style={[
                        styles.typeBtn,
                        {
                          borderColor: form.storeId === store.id ? colors.primary : colors.border,
                          backgroundColor: form.storeId === store.id ? colors.primary + "15" : colors.surface,
                        },
                      ]}
                    >
                      <Text style={[styles.typeBtnText, { color: form.storeId === store.id ? colors.primary : colors.muted }]}>
                        {store.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Usage limits */}
              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={[styles.formLabel, { color: colors.foreground }]}>Total Uses</Text>
                  <TextInput
                    value={form.maxUsesTotal}
                    onChangeText={(t) => setForm({ ...form, maxUsesTotal: t })}
                    placeholder="Unlimited"
                    placeholderTextColor={colors.muted}
                    keyboardType="number-pad"
                    style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={[styles.formLabel, { color: colors.foreground }]}>Per Customer</Text>
                  <TextInput
                    value={form.maxUsesPerCustomer}
                    onChangeText={(t) => setForm({ ...form, maxUsesPerCustomer: t })}
                    placeholder="1"
                    placeholderTextColor={colors.muted}
                    keyboardType="number-pad"
                    style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                  />
                </View>
              </View>

              {/* Validity period */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.foreground }]}>Starts At (optional)</Text>
                <TextInput
                  value={form.startsAt}
                  onChangeText={(t) => setForm({ ...form, startsAt: t })}
                  placeholder="YYYY-MM-DDTHH:MM (empty = now)"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.foreground }]}>Expires At (optional)</Text>
                <TextInput
                  value={form.expiresAt}
                  onChangeText={(t) => setForm({ ...form, expiresAt: t })}
                  placeholder="YYYY-MM-DDTHH:MM (empty = never)"
                  placeholderTextColor={colors.muted}
                  style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                />
              </View>

              {/* Quick expiry buttons */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.foreground }]}>Quick Expiry</Text>
                <View style={styles.typeRow}>
                  {[
                    { label: "1 Hour", hours: 1 },
                    { label: "3 Hours", hours: 3 },
                    { label: "24 Hours", hours: 24 },
                    { label: "7 Days", hours: 168 },
                    { label: "30 Days", hours: 720 },
                  ].map((opt) => (
                    <Pressable
                      key={opt.label}
                      onPress={() => {
                        const now = new Date();
                        const expires = new Date(now.getTime() + opt.hours * 60 * 60 * 1000);
                        setForm({
                          ...form,
                          startsAt: now.toISOString().slice(0, 16),
                          expiresAt: expires.toISOString().slice(0, 16),
                        });
                      }}
                      style={[styles.quickBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
                    >
                      <Text style={[styles.quickBtnText, { color: colors.primary }]}>{opt.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Buttons */}
              <View style={styles.modalActions}>
                <Pressable
                  onPress={() => {
                    setShowCreate(false);
                    setEditingId(null);
                    setForm({ ...emptyForm });
                  }}
                  style={({ pressed }) => [styles.cancelBtn, { borderColor: colors.border }, pressed && { opacity: 0.7 }]}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.muted }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleCreate}
                  style={({ pressed }) => [styles.saveBtn, { backgroundColor: colors.primary }, pressed && { opacity: 0.8 }]}
                >
                  <Text style={styles.saveBtnText}>
                    {editingId ? "Update Code" : "Create Code"}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Toast */}
      {toast !== "" && (
        <View style={[styles.toast, { backgroundColor: "#22C55E" }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </ScrollView>
  );

  if (Platform.OS === "web") {
    return <AdminDesktopLayout>{content}</AdminDesktopLayout>;
  }

  return <ScreenContainer>{content}</ScreenContainer>;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    flexWrap: "wrap",
    gap: 8,
  },
  backBtn: { fontSize: 16, fontWeight: "600" },
  title: { fontSize: 24, fontWeight: "700", flex: 1, textAlign: "center" },
  createBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  createBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginBottom: 16,
    gap: 8,
  },
  filterLabel: { fontSize: 13 },
  emptyCard: {
    padding: 32,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  emptyText: { fontSize: 14, textAlign: "center" },
  codeCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  codeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  codeNameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  codeName: { fontSize: 18, fontWeight: "700", letterSpacing: 1 },
  codeDesc: { fontSize: 13, marginTop: 4 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  discountBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  discountLabel: { fontSize: 15, fontWeight: "700" },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 12,
  },
  detailItem: { minWidth: 100 },
  detailLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  detailValue: { fontSize: 13, marginTop: 2 },
  actionRow: { flexDirection: "row", gap: 8 },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1 },
  actionBtnText: { fontSize: 13, fontWeight: "600" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContent: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "90%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
  },
  modalTitle: { fontSize: 20, fontWeight: "700", marginBottom: 20 },
  formGroup: { marginBottom: 16 },
  formLabel: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  formRow: { flexDirection: "row" },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  typeBtnText: { fontSize: 13, fontWeight: "600" },
  quickBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1 },
  quickBtnText: { fontSize: 12, fontWeight: "600" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 8 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
  cancelBtnText: { fontSize: 14, fontWeight: "600" },
  saveBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  toast: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  toastText: { color: "#fff", fontWeight: "600", fontSize: 14 },
});
