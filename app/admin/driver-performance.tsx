import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, useWindowDimensions, Platform, Modal, Alert } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { AdminDesktopLayout } from "@/components/admin-desktop-layout";
import { formatIrishDateShort } from "@/lib/timezone";

type SortField = "deliveries30d" | "earningsToday" | "earningsThisWeek" | "earnings30d" | "avgDeliveryTime" | "rating" | "name";
type SortDir = "asc" | "desc";
type TimeFilter = "today" | "week" | "30d";
type PageTab = "performance" | "settlements";

// ============================================================
// PERFORMANCE TAB (existing)
// ============================================================
function PerformanceTab() {
  const { data, isLoading, refetch } = trpc.admin.getDriverPerformance.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 900;

  const [sortField, setSortField] = useState<SortField>("deliveries30d");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("30d");
  const [expandedDriver, setExpandedDriver] = useState<number | null>(null);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const sortedDrivers = useMemo(() => {
    if (!data?.drivers) return [];
    return [...data.drivers].sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];
      if (sortField === "name") {
        aVal = (aVal || "").toLowerCase();
        bVal = (bVal || "").toLowerCase();
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      aVal = aVal ?? -1;
      bVal = bVal ?? -1;
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [data?.drivers, sortField, sortDir]);

  if (isLoading) {
    return (
      <View style={{ alignItems: "center", justifyContent: "center", padding: 40 }}>
        <ActivityIndicator size="large" color="#00E5FF" />
        <Text style={{ marginTop: 12, color: "#64748B" }}>Loading performance data...</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={{ alignItems: "center", justifyContent: "center", padding: 40 }}>
        <Text style={{ color: "#EF4444", fontSize: 16 }}>Failed to load performance data</Text>
      </View>
    );
  }

  const { totals } = data;

  const getEarnings = (driver: (typeof sortedDrivers)[0]) => {
    if (timeFilter === "today") return driver.earningsToday;
    if (timeFilter === "week") return driver.earningsThisWeek;
    return driver.earnings30d;
  };

  const getDeliveries = (driver: (typeof sortedDrivers)[0]) => {
    if (timeFilter === "today") return driver.deliveriesToday;
    if (timeFilter === "week") return driver.deliveriesThisWeek;
    return driver.deliveries30d;
  };

  return (
    <>
      {/* Summary cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { borderLeftColor: "#0EA5E9" }]}>
          <Text style={styles.summaryNumber}>{totals.totalDrivers}</Text>
          <Text style={styles.summaryLabel}>Total Drivers</Text>
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: "#22C55E" }]}>
          <Text style={styles.summaryNumber}>{totals.onlineNow}</Text>
          <Text style={styles.summaryLabel}>Online Now</Text>
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: "#F59E0B" }]}>
          <Text style={styles.summaryNumber}>{totals.totalDeliveries30d}</Text>
          <Text style={styles.summaryLabel}>Deliveries (30d)</Text>
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: "#8B5CF6" }]}>
          <Text style={styles.summaryNumber}>{"\u20AC"}{totals.totalEarnings30d.toFixed(2)}</Text>
          <Text style={styles.summaryLabel}>Total Earnings (30d)</Text>
        </View>
      </View>

      {/* Time filter */}
      <View style={styles.filterRow}>
        <Text style={styles.filterLabel}>Period:</Text>
        {(["today", "week", "30d"] as TimeFilter[]).map(tf => (
          <TouchableOpacity
            key={tf}
            style={[styles.filterBtn, timeFilter === tf && styles.filterBtnActive]}
            onPress={() => setTimeFilter(tf)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterBtnText, timeFilter === tf && styles.filterBtnTextActive]}>
              {tf === "today" ? "Today" : tf === "week" ? "This Week" : "Last 30 Days"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Driver table */}
      <View style={styles.tableContainer}>
        {/* Table header */}
        <View style={[styles.tableRow, styles.tableHeader]}>
          <TouchableOpacity style={[styles.tableCell, { flex: 0.5 }]} onPress={() => toggleSort("name")}>
            <Text style={styles.tableHeaderText}>#</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tableCell, { flex: 2 }]} onPress={() => toggleSort("name")}>
            <Text style={styles.tableHeaderText}>Driver {sortField === "name" ? (sortDir === "asc" ? "\u25B2" : "\u25BC") : ""}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tableCell} onPress={() => toggleSort("deliveries30d")}>
            <Text style={styles.tableHeaderText}>Deliveries {sortField === "deliveries30d" ? (sortDir === "asc" ? "\u25B2" : "\u25BC") : ""}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tableCell} onPress={() => toggleSort("earnings30d")}>
            <Text style={styles.tableHeaderText}>Earnings {sortField === "earnings30d" ? (sortDir === "asc" ? "\u25B2" : "\u25BC") : ""}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tableCell} onPress={() => toggleSort("avgDeliveryTime")}>
            <Text style={styles.tableHeaderText}>Avg Time {sortField === "avgDeliveryTime" ? (sortDir === "asc" ? "\u25B2" : "\u25BC") : ""}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tableCell} onPress={() => toggleSort("rating")}>
            <Text style={styles.tableHeaderText}>Rating {sortField === "rating" ? (sortDir === "asc" ? "\u25B2" : "\u25BC") : ""}</Text>
          </TouchableOpacity>
          <View style={[styles.tableCell, { flex: 0.8 }]}>
            <Text style={styles.tableHeaderText}>Status</Text>
          </View>
        </View>

        {/* Driver rows */}
        {sortedDrivers.map((driver, index) => {
          const isExpanded = expandedDriver === driver.id;
          const deliveries = getDeliveries(driver);
          const earnings = getEarnings(driver);

          return (
            <View key={driver.id}>
              <TouchableOpacity
                style={[styles.tableRow, index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd, isExpanded && styles.tableRowExpanded]}
                onPress={() => setExpandedDriver(isExpanded ? null : driver.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.tableCell, { flex: 0.5 }]}>
                  <View style={[styles.driverBadge, { backgroundColor: driver.isOnline ? "#22C55E" : "#94A3B8" }]}>
                    <Text style={styles.driverBadgeText}>{driver.displayNumber || "?"}</Text>
                  </View>
                </View>
                <View style={[styles.tableCell, { flex: 2 }]}>
                  <Text style={styles.driverName}>{driver.name}</Text>
                  {driver.phone ? <Text style={styles.driverPhone}>{driver.phone}</Text> : null}
                </View>
                <View style={styles.tableCell}>
                  <Text style={styles.cellValue}>{deliveries}</Text>
                </View>
                <View style={styles.tableCell}>
                  <Text style={[styles.cellValue, { color: "#059669" }]}>{"\u20AC"}{earnings.toFixed(2)}</Text>
                </View>
                <View style={styles.tableCell}>
                  <Text style={styles.cellValue}>
                    {driver.avgDeliveryTime != null ? `${driver.avgDeliveryTime} min` : "\u2014"}
                  </Text>
                </View>
                <View style={styles.tableCell}>
                  <Text style={styles.cellValue}>
                    {driver.rating != null ? `${driver.rating.toFixed(1)} \u2605` : "\u2014"}
                  </Text>
                </View>
                <View style={[styles.tableCell, { flex: 0.8 }]}>
                  <View style={[styles.statusPill, { backgroundColor: driver.isOnline ? "#D1FAE5" : "#F1F5F9" }]}>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: driver.isOnline ? "#059669" : "#64748B" }}>
                      {driver.isOnline ? "Online" : "Offline"}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* Expanded detail row */}
              {isExpanded && (
                <View style={styles.expandedRow}>
                  <View style={styles.expandedGrid}>
                    <View style={styles.expandedStat}>
                      <Text style={styles.expandedStatLabel}>Today</Text>
                      <Text style={styles.expandedStatValue}>{driver.deliveriesToday} deliveries</Text>
                      <Text style={styles.expandedStatMoney}>{"\u20AC"}{driver.earningsToday.toFixed(2)}</Text>
                    </View>
                    <View style={styles.expandedStat}>
                      <Text style={styles.expandedStatLabel}>This Week</Text>
                      <Text style={styles.expandedStatValue}>{driver.deliveriesThisWeek} deliveries</Text>
                      <Text style={styles.expandedStatMoney}>{"\u20AC"}{driver.earningsThisWeek.toFixed(2)}</Text>
                    </View>
                    <View style={styles.expandedStat}>
                      <Text style={styles.expandedStatLabel}>Last 30 Days</Text>
                      <Text style={styles.expandedStatValue}>{driver.deliveries30d} deliveries</Text>
                      <Text style={styles.expandedStatMoney}>{"\u20AC"}{driver.earnings30d.toFixed(2)}</Text>
                    </View>
                    <View style={styles.expandedStat}>
                      <Text style={styles.expandedStatLabel}>All Time</Text>
                      <Text style={styles.expandedStatValue}>{driver.totalDeliveries} deliveries</Text>
                      <Text style={styles.expandedStatMeta}>{driver.totalReturns} returns</Text>
                    </View>
                  </View>

                  {/* 7-day chart */}
                  <Text style={styles.chartTitle}>Last 7 Days</Text>
                  <View style={styles.chartContainer}>
                    {driver.dailyBreakdown.map((day, i) => {
                      const maxDeliveries = Math.max(...driver.dailyBreakdown.map(d => d.deliveries), 1);
                      const barHeight = Math.max((day.deliveries / maxDeliveries) * 80, 4);
                      const dayLabel = new Date(day.date + "T12:00:00").toLocaleDateString("en-IE", { weekday: "short" });
                      return (
                        <View key={i} style={styles.chartBar}>
                          <Text style={styles.chartBarCount}>{day.deliveries > 0 ? day.deliveries : ""}</Text>
                          <View style={[styles.chartBarFill, { height: barHeight, backgroundColor: day.deliveries > 0 ? "#0EA5E9" : "#E2E8F0" }]} />
                          <Text style={styles.chartBarLabel}>{dayLabel}</Text>
                          <Text style={styles.chartBarEarnings}>{day.earnings > 0 ? `\u20AC${day.earnings.toFixed(0)}` : ""}</Text>
                        </View>
                      );
                    })}
                  </View>

                  <View style={styles.expandedFooter}>
                    <Text style={styles.expandedFooterText}>
                      Vehicle: {driver.vehicleType || "Not set"} | Joined: {formatIrishDateShort(driver.joinedAt)}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          );
        })}

        {sortedDrivers.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 16, color: "#64748B" }}>No drivers found</Text>
          </View>
        )}
      </View>
    </>
  );
}

// ============================================================
// SETTLEMENTS TAB (new)
// ============================================================
function SettlementsTab() {
  const { data, isLoading, refetch } = trpc.admin.getDriverSettlements.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const utils = trpc.useUtils();
  const markSettledMutation = trpc.admin.markSettled.useMutation({
    onSuccess: () => { refetch(); },
  });
  const markAllSettledMutation = trpc.admin.markAllSettled.useMutation({
    onSuccess: () => { refetch(); },
  });

  const [expandedDriver, setExpandedDriver] = useState<number | null>(null);
  const [detailShiftId, setDetailShiftId] = useState<number | null>(null);

  // Fetch shift detail when a shift is selected
  const { data: shiftDetail, isLoading: detailLoading } = trpc.admin.getSettlementDetail.useQuery(
    { shiftId: detailShiftId! },
    { enabled: !!detailShiftId }
  );

  if (isLoading) {
    return (
      <View style={{ alignItems: "center", justifyContent: "center", padding: 40 }}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={{ marginTop: 12, color: "#64748B" }}>Loading settlement data...</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={{ alignItems: "center", justifyContent: "center", padding: 40 }}>
        <Text style={{ color: "#EF4444", fontSize: 16 }}>Failed to load settlement data</Text>
      </View>
    );
  }

  const handleMarkSettled = (shiftId: number) => {
    if (Platform.OS === "web") {
      if (confirm("Mark this shift as settled? This means the cash has been reconciled.")) {
        markSettledMutation.mutate({ shiftId, adminUserId: 150001 });
      }
    } else {
      Alert.alert("Settle Shift", "Mark this shift as settled? This means the cash has been reconciled.", [
        { text: "Cancel", style: "cancel" },
        { text: "Settle", onPress: () => markSettledMutation.mutate({ shiftId, adminUserId: 150001 }) },
      ]);
    }
  };

  const handleMarkAllSettled = (driverId: number, driverName: string) => {
    if (Platform.OS === "web") {
      if (confirm(`Settle ALL unsettled shifts for ${driverName}?`)) {
        markAllSettledMutation.mutate({ driverId, adminUserId: 150001 });
      }
    } else {
      Alert.alert("Settle All", `Settle ALL unsettled shifts for ${driverName}?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Settle All", onPress: () => markAllSettledMutation.mutate({ driverId, adminUserId: 150001 }) },
      ]);
    }
  };

  const formatTime = (isoStr: string) => {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    return d.toLocaleDateString("en-IE", { day: "numeric", month: "short" }) + " " + d.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <>
      {/* Summary cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { borderLeftColor: "#7C3AED" }]}>
          <Text style={styles.summaryNumber}>{data.totals.driversWithUnsettled}</Text>
          <Text style={styles.summaryLabel}>Drivers to Settle</Text>
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: data.totals.totalUnsettledAmount >= 0 ? "#DC2626" : "#16A34A" }]}>
          <Text style={[styles.summaryNumber, { color: data.totals.totalUnsettledAmount >= 0 ? "#DC2626" : "#16A34A" }]}>
            {"\u20AC"}{Math.abs(data.totals.totalUnsettledAmount).toFixed(2)}
          </Text>
          <Text style={styles.summaryLabel}>
            {data.totals.totalUnsettledAmount >= 0 ? "Drivers Owe You" : "You Owe Drivers"}
          </Text>
        </View>
      </View>

      {data.drivers.length === 0 ? (
        <View style={{ alignItems: "center", padding: 40, backgroundColor: "#fff", borderRadius: 12 }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>{"\u2705"}</Text>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#0F172A", marginBottom: 4 }}>All Settled!</Text>
          <Text style={{ fontSize: 14, color: "#64748B", textAlign: "center" }}>No unsettled driver shifts. When drivers end their shift, settlements will appear here.</Text>
        </View>
      ) : (
        <View style={styles.tableContainer}>
          {/* Table header */}
          <View style={[styles.tableRow, styles.tableHeader]}>
            <View style={[styles.tableCell, { flex: 0.5 }]}>
              <Text style={styles.tableHeaderText}>#</Text>
            </View>
            <View style={[styles.tableCell, { flex: 2 }]}>
              <Text style={styles.tableHeaderText}>Driver</Text>
            </View>
            <View style={styles.tableCell}>
              <Text style={styles.tableHeaderText}>Shifts</Text>
            </View>
            <View style={styles.tableCell}>
              <Text style={styles.tableHeaderText}>Jobs</Text>
            </View>
            <View style={styles.tableCell}>
              <Text style={styles.tableHeaderText}>Cash Collected</Text>
            </View>
            <View style={styles.tableCell}>
              <Text style={styles.tableHeaderText}>Fees Earned</Text>
            </View>
            <View style={styles.tableCell}>
              <Text style={styles.tableHeaderText}>Card Tips</Text>
            </View>
            <View style={[styles.tableCell, { flex: 1.2 }]}>
              <Text style={styles.tableHeaderText}>Net Owed</Text>
            </View>
            <View style={[styles.tableCell, { flex: 1 }]}>
              <Text style={styles.tableHeaderText}>Action</Text>
            </View>
          </View>

          {/* Driver settlement rows */}
          {data.drivers.map((driver, index) => {
            const isExpanded = expandedDriver === driver.userId;
            return (
              <View key={driver.userId}>
                <TouchableOpacity
                  style={[styles.tableRow, index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd, isExpanded && styles.tableRowExpanded]}
                  onPress={() => setExpandedDriver(isExpanded ? null : driver.userId)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.tableCell, { flex: 0.5 }]}>
                    <View style={[styles.driverBadge, { backgroundColor: driver.isOnline ? "#22C55E" : "#94A3B8" }]}>
                      <Text style={styles.driverBadgeText}>{driver.displayNumber || "?"}</Text>
                    </View>
                  </View>
                  <View style={[styles.tableCell, { flex: 2 }]}>
                    <Text style={styles.driverName}>{driver.name}</Text>
                  </View>
                  <View style={styles.tableCell}>
                    <Text style={styles.cellValue}>{driver.unsettledShiftCount}</Text>
                  </View>
                  <View style={styles.tableCell}>
                    <Text style={styles.cellValue}>{driver.totalJobs}</Text>
                  </View>
                  <View style={styles.tableCell}>
                    <Text style={styles.cellValue}>{"\u20AC"}{driver.totalCashCollected.toFixed(2)}</Text>
                  </View>
                  <View style={styles.tableCell}>
                    <Text style={[styles.cellValue, { color: "#059669" }]}>{"\u20AC"}{driver.totalFeesEarned.toFixed(2)}</Text>
                  </View>
                  <View style={styles.tableCell}>
                    <Text style={[styles.cellValue, { color: "#0EA5E9" }]}>{"\u20AC"}{driver.totalCardTips.toFixed(2)}</Text>
                  </View>
                  <View style={[styles.tableCell, { flex: 1.2 }]}>
                    <View style={[styles.statusPill, {
                      backgroundColor: driver.totalUnsettled > 0 ? "#FEE2E2" : driver.totalUnsettled < 0 ? "#D1FAE5" : "#F1F5F9",
                    }]}>
                      <Text style={{
                        fontSize: 12,
                        fontWeight: "700",
                        color: driver.totalUnsettled > 0 ? "#DC2626" : driver.totalUnsettled < 0 ? "#16A34A" : "#64748B",
                      }}>
                        {driver.totalUnsettled > 0 ? "Owes " : driver.totalUnsettled < 0 ? "Owed " : ""}{"\u20AC"}{Math.abs(driver.totalUnsettled).toFixed(2)}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.tableCell, { flex: 1 }]}>
                    <TouchableOpacity
                      style={{ backgroundColor: "#7C3AED", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}
                      onPress={(e) => { e.stopPropagation(); handleMarkAllSettled(driver.userId, driver.name); }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700", textAlign: "center" }}>Settle All</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>

                {/* Expanded: individual shifts */}
                {isExpanded && (
                  <View style={styles.expandedRow}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: "#334155", marginBottom: 10 }}>Unsettled Shifts</Text>
                    {driver.shifts.map((shift, si) => (
                      <View key={shift.id} style={{
                        backgroundColor: "#fff",
                        borderRadius: 8,
                        padding: 12,
                        marginBottom: 8,
                        borderWidth: 1,
                        borderColor: "#E2E8F0",
                      }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <View>
                            <Text style={{ fontSize: 13, fontWeight: "600", color: "#0F172A" }}>
                              {formatTime(shift.startedAt)} {"\u2192"} {formatTime(shift.endedAt)}
                            </Text>
                            <Text style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                              {shift.totalJobs} delivery{shift.totalJobs !== 1 ? "ies" : "y"}
                            </Text>
                          </View>
                          <View style={{ flexDirection: "row", gap: 8 }}>
                            <TouchableOpacity
                              style={{ backgroundColor: "#F1F5F9", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}
                              onPress={() => setDetailShiftId(shift.id)}
                              activeOpacity={0.7}
                            >
                              <Text style={{ fontSize: 11, fontWeight: "600", color: "#475569" }}>Detail</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={{ backgroundColor: "#7C3AED", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}
                              onPress={() => handleMarkSettled(shift.id)}
                              activeOpacity={0.7}
                            >
                              <Text style={{ fontSize: 11, fontWeight: "700", color: "#fff" }}>Settle</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                        <View style={{ flexDirection: "row", gap: 16 }}>
                          <View>
                            <Text style={{ fontSize: 10, color: "#64748B" }}>Cash Collected</Text>
                            <Text style={{ fontSize: 13, fontWeight: "700", color: "#0F172A" }}>{"\u20AC"}{shift.cashCollected.toFixed(2)}</Text>
                          </View>
                          <View>
                            <Text style={{ fontSize: 10, color: "#64748B" }}>Fees Earned</Text>
                            <Text style={{ fontSize: 13, fontWeight: "700", color: "#059669" }}>{"\u20AC"}{shift.deliveryFeesEarned.toFixed(2)}</Text>
                          </View>
                          <View>
                            <Text style={{ fontSize: 10, color: "#64748B" }}>Card Tips</Text>
                            <Text style={{ fontSize: 13, fontWeight: "700", color: "#0EA5E9" }}>{"\u20AC"}{shift.cardTipsEarned.toFixed(2)}</Text>
                          </View>
                          <View>
                            <Text style={{ fontSize: 10, color: "#64748B" }}>Net Owed</Text>
                            <Text style={{
                              fontSize: 13,
                              fontWeight: "800",
                              color: shift.netOwed > 0 ? "#DC2626" : shift.netOwed < 0 ? "#16A34A" : "#64748B",
                            }}>
                              {shift.netOwed > 0 ? "+" : ""}{"\u20AC"}{shift.netOwed.toFixed(2)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Settlement Detail Modal */}
      <Modal
        visible={!!detailShiftId}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailShiftId(null)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 24, width: "90%", maxWidth: 600, maxHeight: "80%" }}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {detailLoading ? (
                <View style={{ alignItems: "center", padding: 40 }}>
                  <ActivityIndicator size="large" color="#7C3AED" />
                </View>
              ) : shiftDetail ? (
                <>
                  <Text style={{ fontSize: 20, fontWeight: "800", color: "#0F172A", marginBottom: 4 }}>Shift Detail</Text>
                  <Text style={{ fontSize: 13, color: "#64748B", marginBottom: 16 }}>
                    {shiftDetail.shift.driverName} {"\u2022"} {formatTime(shiftDetail.shift.startedAt)} {"\u2192"} {formatTime(shiftDetail.shift.endedAt)}
                  </Text>

                  {/* Summary */}
                  <View style={{ backgroundColor: "#F8FAFC", borderRadius: 10, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "#E2E8F0" }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                      <Text style={{ fontSize: 14, color: "#475569" }}>Cash Collected</Text>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: "#0F172A" }}>{"\u20AC"}{shiftDetail.shift.cashCollected.toFixed(2)}</Text>
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                      <Text style={{ fontSize: 14, color: "#475569" }}>Delivery Fees (driver keeps)</Text>
                      <Text style={{ fontSize: 14, fontWeight: "600", color: "#16A34A" }}>-{"\u20AC"}{shiftDetail.shift.deliveryFeesEarned.toFixed(2)}</Text>
                    </View>
                    {shiftDetail.shift.cardTipsEarned > 0 && (
                      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                        <Text style={{ fontSize: 14, color: "#475569" }}>Card Tips (owed to driver)</Text>
                        <Text style={{ fontSize: 14, fontWeight: "600", color: "#16A34A" }}>-{"\u20AC"}{shiftDetail.shift.cardTipsEarned.toFixed(2)}</Text>
                      </View>
                    )}
                    <View style={{ borderTopWidth: 1, borderTopColor: "#CBD5E1", paddingTop: 8, marginTop: 4 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ fontSize: 15, fontWeight: "700", color: "#0F172A" }}>
                          {shiftDetail.shift.netOwed > 0 ? "Driver Owes" : shiftDetail.shift.netOwed < 0 ? "You Owe Driver" : "Even"}
                        </Text>
                        <Text style={{
                          fontSize: 18,
                          fontWeight: "800",
                          color: shiftDetail.shift.netOwed > 0 ? "#DC2626" : shiftDetail.shift.netOwed < 0 ? "#16A34A" : "#64748B",
                        }}>
                          {"\u20AC"}{Math.abs(shiftDetail.shift.netOwed).toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Order breakdown */}
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#334155", marginBottom: 8 }}>
                    Orders ({shiftDetail.orders.length})
                  </Text>
                  {shiftDetail.orders.map((order, oi) => (
                    <View key={order.id} style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingVertical: 8,
                      borderBottomWidth: oi < shiftDetail.orders.length - 1 ? 1 : 0,
                      borderBottomColor: "#F1F5F9",
                    }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: "600", color: "#0F172A" }}>{order.orderNumber}</Text>
                        <Text style={{ fontSize: 11, color: "#64748B" }}>{order.storeName}</Text>
                      </View>
                      <View style={{ alignItems: "center", minWidth: 60 }}>
                        <View style={{
                          backgroundColor: order.paymentMethod === "cash_on_delivery" ? "#FEF3C7" : "#EFF6FF",
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 4,
                        }}>
                          <Text style={{
                            fontSize: 10,
                            fontWeight: "600",
                            color: order.paymentMethod === "cash_on_delivery" ? "#92400E" : "#1D4ED8",
                          }}>
                            {order.paymentMethod === "cash_on_delivery" ? "Cash" : "Card"}
                          </Text>
                        </View>
                      </View>
                      <View style={{ alignItems: "flex-end", minWidth: 80 }}>
                        <Text style={{ fontSize: 12, fontWeight: "600", color: "#059669" }}>Fee: {"\u20AC"}{order.deliveryFee.toFixed(2)}</Text>
                        {order.tipAmount > 0 && (
                          <Text style={{ fontSize: 10, color: "#0EA5E9" }}>Tip: {"\u20AC"}{order.tipAmount.toFixed(2)}</Text>
                        )}
                        {order.paymentMethod === "cash_on_delivery" && (
                          <Text style={{ fontSize: 10, color: "#92400E" }}>Collected: {"\u20AC"}{order.total.toFixed(2)}</Text>
                        )}
                      </View>
                    </View>
                  ))}
                </>
              ) : (
                <Text style={{ color: "#EF4444" }}>Failed to load shift detail</Text>
              )}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setDetailShiftId(null)}
              style={{ backgroundColor: "#F1F5F9", borderRadius: 10, padding: 14, alignItems: "center", marginTop: 16 }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 15, fontWeight: "700", color: "#334155" }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ============================================================
// MAIN PAGE WITH TABS
// ============================================================
function DriverPerformanceContent() {
  const [activeTab, setActiveTab] = useState<PageTab>("performance");
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 900;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: isDesktop ? 24 : 16 }}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Driver Performance</Text>
      </View>

      {/* Tab switcher */}
      <View style={{ flexDirection: "row", marginBottom: 20, backgroundColor: "#F1F5F9", borderRadius: 10, padding: 3 }}>
        <TouchableOpacity
          style={{
            flex: 1,
            paddingVertical: 10,
            borderRadius: 8,
            backgroundColor: activeTab === "performance" ? "#fff" : "transparent",
            alignItems: "center",
            ...(activeTab === "performance" ? { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 } : {}),
          }}
          onPress={() => setActiveTab("performance")}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 14, fontWeight: "700", color: activeTab === "performance" ? "#0F172A" : "#64748B" }}>
            Performance
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{
            flex: 1,
            paddingVertical: 10,
            borderRadius: 8,
            backgroundColor: activeTab === "settlements" ? "#fff" : "transparent",
            alignItems: "center",
            ...(activeTab === "settlements" ? { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 } : {}),
          }}
          onPress={() => setActiveTab("settlements")}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 14, fontWeight: "700", color: activeTab === "settlements" ? "#7C3AED" : "#64748B" }}>
            Settlements
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === "performance" ? <PerformanceTab /> : <SettlementsTab />}

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Data refreshes every 30 seconds</Text>
      </View>
    </ScrollView>
  );
}

export default function AdminDriverPerformancePage() {
  return (
    <AdminDesktopLayout title="Driver Performance">
      <DriverPerformanceContent />
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
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
    flexWrap: "wrap",
  },
  summaryCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0F172A",
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#64748B",
    marginTop: 2,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
  },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  filterBtnActive: {
    backgroundColor: "#0EA5E9",
    borderColor: "#0EA5E9",
  },
  filterBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  filterBtnTextActive: {
    color: "#ffffff",
  },
  tableContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    marginBottom: 20,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  tableHeader: {
    backgroundColor: "#F8FAFC",
    borderBottomWidth: 2,
    borderBottomColor: "#E2E8F0",
  },
  tableRowEven: {
    backgroundColor: "#ffffff",
  },
  tableRowOdd: {
    backgroundColor: "#FAFBFC",
  },
  tableRowExpanded: {
    backgroundColor: "#F0F9FF",
    borderBottomWidth: 0,
  },
  tableCell: {
    flex: 1,
    paddingHorizontal: 4,
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    textTransform: "uppercase",
  },
  driverBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  driverBadgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  driverName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  driverPhone: {
    fontSize: 11,
    color: "#0369A1",
    marginTop: 1,
  },
  cellValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  expandedRow: {
    backgroundColor: "#F0F9FF",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  expandedGrid: {
    flexDirection: "row",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  expandedStat: {
    flex: 1,
    minWidth: 120,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  expandedStatLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  expandedStatValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  expandedStatMoney: {
    fontSize: 14,
    fontWeight: "600",
    color: "#059669",
    marginTop: 2,
  },
  expandedStatMeta: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 8,
  },
  chartContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    height: 130,
    marginBottom: 12,
  },
  chartBar: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  chartBarCount: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0EA5E9",
    marginBottom: 4,
  },
  chartBarFill: {
    width: "80%",
    borderRadius: 4,
    minHeight: 4,
  },
  chartBarLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 4,
  },
  chartBarEarnings: {
    fontSize: 9,
    color: "#059669",
    fontWeight: "500",
  },
  expandedFooter: {
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 8,
    marginTop: 4,
  },
  expandedFooterText: {
    fontSize: 12,
    color: "#64748B",
  },
  emptyState: {
    alignItems: "center",
    padding: 40,
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
