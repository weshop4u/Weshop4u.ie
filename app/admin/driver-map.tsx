import { View, Text, ScrollView, Platform, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useState, useEffect, useRef } from "react";
import { AdminDesktopLayout } from "@/components/admin-desktop-layout";

// Balbriggan center coordinates
const BALBRIGGAN_LAT = 53.6108;
const BALBRIGGAN_LNG = -6.1811;

function timeAgo(isoString: string | null): string {
  if (!isoString) return "No location";
  const diff = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function DriverMapContent() {
  const { data: driverLocations, isLoading, refetch } = trpc.admin.getDriverLocations.useQuery(undefined, {
    refetchInterval: 10000, // Refresh every 10 seconds
  });
  const [selectedDriver, setSelectedDriver] = useState<number | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Record<number, any>>({});
  const [mapReady, setMapReady] = useState(false);

  // Initialize Leaflet map (web only)
  useEffect(() => {
    if (Platform.OS !== "web") return;

    // Load Leaflet CSS
    const linkEl = document.createElement("link");
    linkEl.rel = "stylesheet";
    linkEl.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(linkEl);

    // Load Leaflet JS
    const scriptEl = document.createElement("script");
    scriptEl.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    scriptEl.onload = () => {
      if (!mapContainerRef.current || mapRef.current) return;
      const L = (window as any).L;
      const map = L.map(mapContainerRef.current).setView([BALBRIGGAN_LAT, BALBRIGGAN_LNG], 14);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
      setMapReady(true);
    };
    document.head.appendChild(scriptEl);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update markers when data changes
  useEffect(() => {
    if (!mapReady || !mapRef.current || !driverLocations) return;
    const L = (window as any).L;
    if (!L) return;

    // Clear existing markers
    Object.values(markersRef.current).forEach(m => m.remove());
    markersRef.current = {};

    const onlineWithLocation = driverLocations.filter(d => d.isOnline && d.latitude && d.longitude);
    const offlineWithLocation = driverLocations.filter(d => !d.isOnline && d.latitude && d.longitude);

    // Add online driver markers (green)
    onlineWithLocation.forEach(driver => {
      const isDelivering = driver.activeOrders.length > 0;
      const color = isDelivering ? "#F59E0B" : "#22C55E"; // amber if delivering, green if available
      const statusText = isDelivering
        ? `Delivering: ${driver.activeOrders.map(o => o.orderNumber).join(", ")}`
        : driver.isAvailable ? "Available" : "Online (busy)";

      const icon = L.divIcon({
        className: "custom-driver-marker",
        html: `<div style="
          background: ${color};
          color: white;
          border: 3px solid white;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 13px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          position: relative;
        ">${driver.displayNumber || "?"}</div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      const marker = L.marker([driver.latitude, driver.longitude], { icon })
        .addTo(mapRef.current)
        .bindPopup(`
          <div style="min-width: 180px; font-family: system-ui, sans-serif;">
            <div style="font-weight: 700; font-size: 15px; margin-bottom: 4px;">${driver.label}</div>
            <div style="color: ${color}; font-weight: 600; font-size: 13px; margin-bottom: 6px;">${statusText}</div>
            ${driver.vehicleType ? `<div style="color: #64748B; font-size: 12px;">Vehicle: ${driver.vehicleType}</div>` : ""}
            <div style="color: #64748B; font-size: 12px;">Last update: ${timeAgo(driver.lastLocationUpdate)}</div>
            ${driver.activeOrders.length > 0 ? driver.activeOrders.map(o =>
              `<div style="margin-top: 6px; padding: 4px 8px; background: #FEF3C7; border-radius: 4px; font-size: 12px;">
                <strong>${o.orderNumber}</strong> — ${o.status.replace(/_/g, " ")}
                <div style="color: #92400E; font-size: 11px;">${o.deliveryAddress}</div>
              </div>`
            ).join("") : ""}
          </div>
        `);

      markersRef.current[driver.id] = marker;
    });

    // Add offline driver markers (grey, smaller)
    offlineWithLocation.forEach(driver => {
      const icon = L.divIcon({
        className: "custom-driver-marker-offline",
        html: `<div style="
          background: #94A3B8;
          color: white;
          border: 2px solid white;
          border-radius: 50%;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 11px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.2);
          opacity: 0.6;
        ">${driver.displayNumber || "?"}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([driver.latitude, driver.longitude], { icon })
        .addTo(mapRef.current)
        .bindPopup(`
          <div style="min-width: 160px; font-family: system-ui, sans-serif;">
            <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px;">${driver.label}</div>
            <div style="color: #94A3B8; font-weight: 600; font-size: 13px;">Offline</div>
            <div style="color: #64748B; font-size: 12px;">Last seen: ${timeAgo(driver.lastLocationUpdate)}</div>
          </div>
        `);

      markersRef.current[driver.id] = marker;
    });

    // If we have online drivers, fit bounds to show them all
    if (onlineWithLocation.length > 0) {
      const bounds = L.latLngBounds(onlineWithLocation.map((d: any) => [d.latitude, d.longitude]));
      // Add some padding
      mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [driverLocations, mapReady]);

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color="#00E5FF" />
      </ScreenContainer>
    );
  }

  const allDrivers = driverLocations || [];
  const onlineDrivers = allDrivers.filter(d => d.isOnline);
  const offlineDrivers = allDrivers.filter(d => !d.isOnline);
  const driversWithLocation = allDrivers.filter(d => d.latitude && d.longitude);
  const deliveringDrivers = onlineDrivers.filter(d => d.activeOrders.length > 0);

  // Center map on a specific driver and open their popup
  const centerOnDriver = (driverId: number, lat: number | null, lng: number | null) => {
    if (!mapRef.current || !lat || !lng) return;
    setSelectedDriver(driverId);
    mapRef.current.flyTo([lat, lng], 17, { duration: 0.8 });
    // Open the marker popup
    const marker = markersRef.current[driverId];
    if (marker) {
      setTimeout(() => marker.openPopup(), 400);
    }
  };

  // Reset map to show all drivers
  const showAllDrivers = () => {
    if (!mapRef.current) return;
    setSelectedDriver(null);
    // Close any open popups
    mapRef.current.closePopup();
    const L = (window as any).L;
    if (!L) return;
    const allWithLocation = allDrivers.filter(d => d.latitude && d.longitude);
    if (allWithLocation.length > 0) {
      const bounds = L.latLngBounds(allWithLocation.map((d: any) => [d.latitude, d.longitude]));
      mapRef.current.flyToBounds(bounds, { padding: [50, 50], maxZoom: 15, duration: 0.8 });
    } else {
      mapRef.current.flyTo([BALBRIGGAN_LAT, BALBRIGGAN_LNG], 14, { duration: 0.8 });
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Driver Locations</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {selectedDriver !== null && (
              <TouchableOpacity onPress={showAllDrivers} style={styles.showAllBtn} activeOpacity={0.7}>
                <Text style={styles.showAllText}>🗺️ Show All</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => refetch()} style={styles.refreshBtn} activeOpacity={0.7}>
              <Text style={styles.refreshText}>🔄 Refresh</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats bar */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderLeftColor: "#22C55E" }]}>
            <Text style={styles.statNumber}>{onlineDrivers.length}</Text>
            <Text style={styles.statLabel}>Online</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: "#F59E0B" }]}>
            <Text style={styles.statNumber}>{deliveringDrivers.length}</Text>
            <Text style={styles.statLabel}>Delivering</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: "#94A3B8" }]}>
            <Text style={styles.statNumber}>{offlineDrivers.length}</Text>
            <Text style={styles.statLabel}>Offline</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: "#0EA5E9" }]}>
            <Text style={styles.statNumber}>{driversWithLocation.length}</Text>
            <Text style={styles.statLabel}>With GPS</Text>
          </View>
        </View>

        {/* Map (web only) */}
        {Platform.OS === "web" ? (
          <View style={styles.mapWrapper}>
            <div
              ref={(el: any) => { mapContainerRef.current = el; }}
              style={{ width: "100%", height: 500, borderRadius: 12, overflow: "hidden" }}
            />
            {!mapReady && (
              <View style={styles.mapLoading}>
                <ActivityIndicator size="large" color="#00E5FF" />
                <Text style={{ color: "#64748B", marginTop: 8 }}>Loading map...</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.noMapBox}>
            <Text style={styles.noMapText}>Map view is available on the web admin panel.</Text>
            <Text style={styles.noMapSub}>Open the admin panel in a browser to see the driver map.</Text>
          </View>
        )}

        {/* Driver list */}
        <View style={styles.listSection}>
          <Text style={styles.listTitle}>All Drivers</Text>

          {/* Online drivers first */}
          {onlineDrivers.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <Text style={styles.groupLabel}>🟢 Online ({onlineDrivers.length})</Text>
              {onlineDrivers.map(driver => (
                <TouchableOpacity
                  key={driver.id}
                  style={[
                    styles.driverRow,
                    styles.driverRowOnline,
                    selectedDriver === driver.id && styles.driverRowSelected,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => centerOnDriver(driver.id, driver.latitude, driver.longitude)}
                  disabled={!driver.latitude || !driver.longitude}
                >
                  <View style={[styles.driverBadge, { backgroundColor: driver.activeOrders.length > 0 ? "#F59E0B" : "#22C55E" }]}>
                    <Text style={styles.driverBadgeText}>{driver.displayNumber || "?"}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.driverName}>{driver.label}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}>
                      {driver.latitude ? (
                        <Text style={styles.driverMeta}>📍 {driver.latitude.toFixed(4)}, {driver.longitude?.toFixed(4)}</Text>
                      ) : (
                        <Text style={[styles.driverMeta, { color: "#EF4444" }]}>No GPS</Text>
                      )}
                      <Text style={styles.driverMeta}>• {timeAgo(driver.lastLocationUpdate)}</Text>
                    </View>
                    {driver.activeOrders.length > 0 && (
                      <View style={{ marginTop: 4 }}>
                        {driver.activeOrders.map((o, i) => (
                          <Text key={i} style={styles.orderTag}>
                            🚗 {o.orderNumber} — {o.status.replace(/_/g, " ")}
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    {driver.activeOrders.length > 0 ? (
                      <View style={[styles.statusPill, { backgroundColor: "#FEF3C7" }]}>
                        <Text style={{ color: "#92400E", fontSize: 11, fontWeight: "600" }}>Delivering</Text>
                      </View>
                    ) : driver.isAvailable ? (
                      <View style={[styles.statusPill, { backgroundColor: "#DCFCE7" }]}>
                        <Text style={{ color: "#166534", fontSize: 11, fontWeight: "600" }}>Available</Text>
                      </View>
                    ) : (
                      <View style={[styles.statusPill, { backgroundColor: "#E0F2FE" }]}>
                        <Text style={{ color: "#0369A1", fontSize: 11, fontWeight: "600" }}>Busy</Text>
                      </View>
                    )}
                    {driver.latitude && driver.longitude && (
                      <Text style={styles.locateHint}>Tap to locate</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Offline drivers */}
          {offlineDrivers.length > 0 && (
            <View>
              <Text style={styles.groupLabel}>⚫ Offline ({offlineDrivers.length})</Text>
              {offlineDrivers.map(driver => (
                <TouchableOpacity
                  key={driver.id}
                  style={[
                    styles.driverRow,
                    styles.driverRowOffline,
                    selectedDriver === driver.id && styles.driverRowSelected,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => centerOnDriver(driver.id, driver.latitude, driver.longitude)}
                  disabled={!driver.latitude || !driver.longitude}
                >
                  <View style={[styles.driverBadge, { backgroundColor: "#94A3B8" }]}>
                    <Text style={styles.driverBadgeText}>{driver.displayNumber || "?"}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.driverName, { color: "#64748B" }]}>{driver.label}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}>
                      {driver.latitude ? (
                        <Text style={styles.driverMeta}>Last: {driver.latitude.toFixed(4)}, {driver.longitude?.toFixed(4)}</Text>
                      ) : (
                        <Text style={styles.driverMeta}>No location data</Text>
                      )}
                      {driver.lastLocationUpdate && (
                        <Text style={styles.driverMeta}>• {timeAgo(driver.lastLocationUpdate)}</Text>
                      )}
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <View style={[styles.statusPill, { backgroundColor: "#F1F5F9" }]}>
                      <Text style={{ color: "#64748B", fontSize: 11, fontWeight: "600" }}>Offline</Text>
                    </View>
                    {driver.latitude && driver.longitude && (
                      <Text style={styles.locateHint}>Tap to locate</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {allDrivers.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>🗺️</Text>
              <Text style={{ fontSize: 16, fontWeight: "600", color: "#334155" }}>No Drivers Yet</Text>
              <Text style={{ fontSize: 14, color: "#64748B", marginTop: 4 }}>Create driver accounts to see them here.</Text>
            </View>
          )}
        </View>

        {/* Auto-refresh notice */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Auto-refreshes every 10 seconds • Drivers report GPS every 10 seconds when online</Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

export default function AdminDriverMapPage() {
  return (
    <AdminDesktopLayout title="Driver Locations">
      <DriverMapContent />
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
  showAllBtn: {
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  showAllText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0369A1",
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
    flexWrap: "wrap",
  },
  statCard: {
    flex: 1,
    minWidth: 100,
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 14,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0F172A",
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#64748B",
    marginTop: 2,
  },
  mapWrapper: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    position: "relative" as any,
  },
  mapLoading: {
    position: "absolute" as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  noMapBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  noMapText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 4,
  },
  noMapSub: {
    fontSize: 14,
    color: "#64748B",
  },
  listSection: {
    marginBottom: 20,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 12,
  },
  groupLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 8,
  },
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 10,
    marginBottom: 6,
  },
  driverRowOnline: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  driverRowOffline: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  driverRowSelected: {
    borderColor: "#0EA5E9",
    borderWidth: 2,
    backgroundColor: "#F0F9FF",
  },
  driverBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  driverBadgeText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  driverName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
  },
  driverMeta: {
    fontSize: 12,
    color: "#64748B",
  },
  orderTag: {
    fontSize: 12,
    color: "#92400E",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: "flex-start",
    overflow: "hidden",
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  emptyState: {
    alignItems: "center",
    padding: 40,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  footer: {
    alignItems: "center",
    paddingVertical: 12,
  },
  locateHint: {
    fontSize: 10,
    color: "#0EA5E9",
    fontWeight: "500",
  },
  footerText: {
    fontSize: 12,
    color: "#94A3B8",
  },
});
