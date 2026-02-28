import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Platform, StyleSheet } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { AdminDesktopLayout } from "@/components/admin-desktop-layout";
import { trpc } from "@/lib/trpc";
import { useRouter } from "expo-router";
import { useState } from "react";

export default function DriverApplicationsScreen() {
  const router = useRouter();
  const isWeb = Platform.OS === "web";
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [toast, setToast] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const { data: pendingDrivers, isLoading, refetch } = trpc.admin.getPendingDrivers.useQuery();
  const approveMutation = trpc.admin.approveDriver.useMutation();
  const rejectMutation = trpc.admin.rejectDriver.useMutation();

  const showToast = (text: string, type: "success" | "error") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleApprove = async (driverId: number, name: string) => {
    setActionLoading(driverId);
    try {
      await approveMutation.mutateAsync({ driverId });
      showToast(`${name} has been approved!`, "success");
      refetch();
    } catch (err: any) {
      showToast(err.message || "Failed to approve driver", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (driverId: number, name: string) => {
    setActionLoading(driverId);
    try {
      await rejectMutation.mutateAsync({ driverId });
      showToast(`${name} has been rejected`, "error");
      refetch();
    } catch (err: any) {
      showToast(err.message || "Failed to reject driver", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "Unknown";
    const d = new Date(date);
    return d.toLocaleDateString("en-IE", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const content = (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: isWeb ? 24 : 16, paddingBottom: 40 }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>&larr; Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Driver Applications</Text>
      </View>

      {/* Toast */}
      {toast && (
        <View style={[styles.toast, toast.type === "success" ? styles.toastSuccess : styles.toastError]}>
          <Text style={styles.toastText}>{toast.text}</Text>
        </View>
      )}

      {/* Loading */}
      {isLoading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0a7ea4" />
          <Text style={styles.loadingText}>Loading applications...</Text>
        </View>
      )}

      {/* Empty State */}
      {!isLoading && (!pendingDrivers || pendingDrivers.length === 0) && (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 48 }}>✅</Text>
          <Text style={styles.emptyTitle}>No Pending Applications</Text>
          <Text style={styles.emptySubtitle}>All driver applications have been reviewed.</Text>
        </View>
      )}

      {/* Applications List */}
      {pendingDrivers && pendingDrivers.length > 0 && (
        <View style={styles.list}>
          <Text style={styles.countText}>
            {pendingDrivers.length} pending application{pendingDrivers.length !== 1 ? "s" : ""}
          </Text>

          {pendingDrivers.map((driver) => (
            <View key={driver.driverId} style={styles.card}>
              {/* Driver Header */}
              <View style={styles.cardHeader}>
                <View style={styles.driverBadge}>
                  <Text style={styles.driverBadgeText}>#{driver.displayNumber}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.driverName}>{driver.name}</Text>
                  <Text style={styles.appliedDate}>Applied {formatDate(driver.createdAt)}</Text>
                </View>
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingBadgeText}>PENDING</Text>
                </View>
              </View>

              {/* Driver Details */}
              <View style={styles.detailsGrid}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Phone</Text>
                  <Text style={styles.detailValue}>{driver.phone || "Not provided"}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Email</Text>
                  <Text style={styles.detailValue}>{driver.email}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Town / Area</Text>
                  <Text style={styles.detailValue}>{driver.town || "Not specified"}</Text>
                </View>
                {driver.address && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Address</Text>
                    <Text style={styles.detailValue}>{driver.address}</Text>
                  </View>
                )}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Vehicle</Text>
                  <Text style={styles.detailValue}>{driver.vehicleType} — {driver.vehicleNumber}</Text>
                </View>
                {driver.licenseNumber && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>License</Text>
                    <Text style={styles.detailValue}>{driver.licenseNumber}</Text>
                  </View>
                )}
              </View>

              {/* Action Buttons */}
              <View style={styles.actionRow}>
                {actionLoading === driver.driverId ? (
                  <ActivityIndicator size="small" color="#0a7ea4" />
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.rejectButton}
                      onPress={() => handleReject(driver.driverId, driver.name)}
                    >
                      <Text style={styles.rejectButtonText}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.approveButton}
                      onPress={() => handleApprove(driver.driverId, driver.name)}
                    >
                      <Text style={styles.approveButtonText}>Approve</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );

  if (isWeb) {
    return <AdminDesktopLayout>{content}</AdminDesktopLayout>;
  }

  return <ScreenContainer>{content}</ScreenContainer>;
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 20,
  },
  backLink: {
    color: "#0a7ea4",
    fontSize: 16,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#11181C",
  },
  toast: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  toastSuccess: {
    backgroundColor: "#dcfce7",
    borderWidth: 1,
    borderColor: "#22C55E",
  },
  toastError: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#EF4444",
  },
  toastText: {
    fontWeight: "600",
    fontSize: 14,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    color: "#687076",
    fontSize: 16,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    backgroundColor: "#f5f5f5",
    borderRadius: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#11181C",
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#687076",
    marginTop: 4,
  },
  list: {
    gap: 16,
  },
  countText: {
    fontSize: 14,
    color: "#687076",
    marginBottom: 4,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  driverBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#0a7ea4",
    alignItems: "center",
    justifyContent: "center",
  },
  driverBadgeText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  driverName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#11181C",
  },
  appliedDate: {
    fontSize: 13,
    color: "#687076",
    marginTop: 2,
  },
  pendingBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  pendingBadgeText: {
    color: "#92400E",
    fontWeight: "bold",
    fontSize: 11,
  },
  detailsGrid: {
    gap: 8,
    marginBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailLabel: {
    fontSize: 14,
    color: "#687076",
    fontWeight: "500",
  },
  detailValue: {
    fontSize: 14,
    color: "#11181C",
    fontWeight: "600",
    textAlign: "right",
    flex: 1,
    marginLeft: 16,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  rejectButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#EF4444",
    backgroundColor: "#fef2f2",
  },
  rejectButtonText: {
    color: "#EF4444",
    fontWeight: "bold",
    fontSize: 14,
  },
  approveButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#22C55E",
  },
  approveButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
});
