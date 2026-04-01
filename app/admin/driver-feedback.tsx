import { View, Text, ScrollView, Platform, StyleSheet, TouchableOpacity, ActivityIndicator, useWindowDimensions } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { AdminDesktopLayout } from "@/components/admin-desktop-layout";
import { formatIrishSmartDateTime } from "@/lib/timezone";

function StarDisplay({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map(star => (
        <Text key={star} style={{ fontSize: size, opacity: star <= rating ? 1 : 0.2 }}>
          {"\u2B50"}
        </Text>
      ))}
    </View>
  );
}

function DriverFeedbackContent() {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 900;
  const [selectedDriver, setSelectedDriver] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(0);
  const limit = 30;

  const { data, isLoading, refetch } = trpc.admin.getDriverFeedback.useQuery(
    { driverId: selectedDriver, limit, offset: page * limit },
    { refetchInterval: 30000 }
  );

  // Get driver list for filter
  const { data: driverPerf } = trpc.admin.getDriverPerformance.useQuery();

  if (isLoading && !data) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color="#F59E0B" />
        <Text style={{ marginTop: 12, color: "#64748B" }}>Loading feedback...</Text>
      </ScreenContainer>
    );
  }

  const stats = data?.stats;
  const ratings = data?.ratings || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: isDesktop ? 24 : 16 }}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Driver Feedback</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => refetch()} activeOpacity={0.7}>
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Stats overview */}
      {stats && (
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderLeftColor: "#F59E0B" }]}>
            <Text style={styles.statNumber}>{stats.totalRatings}</Text>
            <Text style={styles.statLabel}>Total Ratings</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: "#22C55E" }]}>
            <Text style={styles.statNumber}>{stats.avgRating > 0 ? stats.avgRating.toFixed(1) : "—"}</Text>
            <Text style={styles.statLabel}>Average Rating</Text>
          </View>
          {/* Rating distribution */}
          <View style={[styles.statCard, { borderLeftColor: "#0EA5E9", flex: 2, minWidth: 280 }]}>
            <Text style={[styles.statLabel, { marginBottom: 8 }]}>Rating Distribution</Text>
            {stats.ratingDistribution.slice().reverse().map(d => {
              const pct = stats.totalRatings > 0 ? (d.count / stats.totalRatings) * 100 : 0;
              return (
                <View key={d.star} style={styles.distRow}>
                  <Text style={styles.distStar}>{d.star}{"\u2B50"}</Text>
                  <View style={styles.distBarBg}>
                    <View style={[styles.distBarFill, { width: `${pct}%`, backgroundColor: d.star >= 4 ? "#22C55E" : d.star === 3 ? "#F59E0B" : "#EF4444" }]} />
                  </View>
                  <Text style={styles.distCount}>{d.count}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Driver filter */}
      <View style={styles.filterRow}>
        <Text style={styles.filterLabel}>Filter by driver:</Text>
        <TouchableOpacity
          style={[styles.filterBtn, !selectedDriver && styles.filterBtnActive]}
          onPress={() => { setSelectedDriver(undefined); setPage(0); }}
          activeOpacity={0.7}
        >
          <Text style={[styles.filterBtnText, !selectedDriver && styles.filterBtnTextActive]}>All Drivers</Text>
        </TouchableOpacity>
        {driverPerf?.drivers.map(d => (
          <TouchableOpacity
            key={d.userId}
            style={[styles.filterBtn, selectedDriver === d.userId && styles.filterBtnActive]}
            onPress={() => { setSelectedDriver(d.userId); setPage(0); }}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterBtnText, selectedDriver === d.userId && styles.filterBtnTextActive]}>
              D{d.displayNumber} {d.name.split(" ")[0]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Feedback list */}
      <View style={styles.feedbackContainer}>
        {ratings.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 40, marginBottom: 8 }}>{"\u2B50"}</Text>
            <Text style={{ fontSize: 16, color: "#64748B", fontWeight: "600" }}>No feedback yet</Text>
            <Text style={{ fontSize: 13, color: "#94A3B8", marginTop: 4 }}>Ratings will appear here after customers rate their deliveries</Text>
          </View>
        ) : (
          ratings.map((r, index) => (
            <View key={r.id} style={[styles.feedbackCard, index % 2 === 0 ? styles.feedbackEven : styles.feedbackOdd]}>
              <View style={styles.feedbackHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                  <View style={styles.driverBadge}>
                    <Text style={styles.driverBadgeText}>D{r.driverNumber}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.driverName}>{r.driverName}</Text>
                    <Text style={styles.orderInfo}>Order #{r.orderNumber}</Text>
                  </View>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <StarDisplay rating={r.rating} size={14} />
                  <Text style={styles.dateText}>{formatIrishSmartDateTime(r.createdAt)}</Text>
                </View>
              </View>
              {r.comment && (
                <View style={styles.commentBox}>
                  <Text style={styles.commentText}>"{r.comment}"</Text>
                  <Text style={styles.customerName}>— {r.customerName}</Text>
                </View>
              )}
              {!r.comment && (
                <Text style={styles.noComment}>No comment left</Text>
              )}
            </View>
          ))
        )}
      </View>

      {/* Pagination */}
      {totalPages > 1 && (
        <View style={styles.pagination}>
          <TouchableOpacity
            style={[styles.pageBtn, page === 0 && styles.pageBtnDisabled]}
            onPress={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            activeOpacity={0.7}
          >
            <Text style={[styles.pageBtnText, page === 0 && { color: "#CBD5E1" }]}>{"\u25C0"} Previous</Text>
          </TouchableOpacity>
          <Text style={styles.pageInfo}>Page {page + 1} of {totalPages} ({total} ratings)</Text>
          <TouchableOpacity
            style={[styles.pageBtn, page >= totalPages - 1 && styles.pageBtnDisabled]}
            onPress={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            activeOpacity={0.7}
          >
            <Text style={[styles.pageBtnText, page >= totalPages - 1 && { color: "#CBD5E1" }]}>Next {"\u25B6"}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>Feedback refreshes every 30 seconds</Text>
      </View>
    </ScrollView>
  );
}

export default function AdminDriverFeedbackPage() {
  return (
    <AdminDesktopLayout title="Driver Feedback">
      <DriverFeedbackContent />
    </AdminDesktopLayout>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0F172A",
  },
  refreshBtn: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  refreshText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
    flexWrap: "wrap",
  },
  statCard: {
    flex: 1,
    minWidth: 120,
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0F172A",
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#64748B",
    marginTop: 2,
  },
  distRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  distStar: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
    width: 30,
  },
  distBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: "#F1F5F9",
    borderRadius: 4,
    overflow: "hidden",
  },
  distBarFill: {
    height: "100%",
    borderRadius: 4,
    minWidth: 2,
  },
  distCount: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    width: 30,
    textAlign: "right",
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
  },
  filterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  filterBtnActive: {
    backgroundColor: "#F59E0B",
    borderColor: "#F59E0B",
  },
  filterBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  filterBtnTextActive: {
    color: "#ffffff",
  },
  feedbackContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    marginBottom: 20,
  },
  feedbackCard: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  feedbackEven: {
    backgroundColor: "#ffffff",
  },
  feedbackOdd: {
    backgroundColor: "#FAFBFC",
  },
  feedbackHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  driverBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#0EA5E9",
    alignItems: "center",
    justifyContent: "center",
  },
  driverBadgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  driverName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  orderInfo: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 1,
  },
  dateText: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 4,
  },
  commentBox: {
    marginTop: 10,
    backgroundColor: "#FFF7ED",
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#F59E0B",
  },
  commentText: {
    fontSize: 14,
    color: "#1E293B",
    fontStyle: "italic",
    lineHeight: 20,
  },
  customerName: {
    fontSize: 12,
    color: "#78716C",
    marginTop: 6,
    fontWeight: "500",
  },
  noComment: {
    marginTop: 8,
    fontSize: 12,
    color: "#CBD5E1",
    fontStyle: "italic",
  },
  emptyState: {
    alignItems: "center",
    padding: 60,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  pageBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
  },
  pageBtnDisabled: {
    opacity: 0.5,
  },
  pageBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  pageInfo: {
    fontSize: 13,
    color: "#64748B",
  },
  footer: {
    alignItems: "center",
    paddingVertical: 12,
  },
  footerText: {
    fontSize: 12,
    color: "#94A3B8",
  },
});
