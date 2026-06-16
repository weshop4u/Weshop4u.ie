import { View, Text, ScrollView, Platform, StyleSheet, TouchableOpacity, ActivityIndicator, Linking } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useState, useEffect, useRef } from "react";
import { AdminDesktopLayout } from "@/components/admin-desktop-layout";
import { useRouter } from "expo-router";

// Balbriggan center coordinates
const BALBRIGGAN_LAT = 53.6108;
const BALBRIGGAN_LNG = -6.1811;

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";

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
    refetchInterval: 5000,
  });
  const [selectedDriver, setSelectedDriver] = useState<number | null>(null);
  const [showOffline, setShowOffline] = useState(true);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Record<number, any>>({});
  const routeLinesRef = useRef<any[]>([]);
  const directionsCacheRef = useRef<Record<number, { result: any; etaText: string; timestamp: number }>>({});
  const lastFitDriverIdsRef = useRef<string>("");
  const [mapReady, setMapReady] = useState(false);
  const router = useRouter();

  // Initialize Google Maps (web only)
  useEffect(() => {
    if (Platform.OS !== "web") return;
    if ((window as any).google?.maps) {
      initMap();
      return;
    }

    let retries = 0;
    const tryInit = () => {
      if ((window as any).google?.maps) {
        initMap();
        return;
      }
      if (!document.querySelector('script[src*="maps.googleapis.com"]')) {
        const scriptEl = document.createElement("script");
        scriptEl.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=maps,marker,directions&callback=__googleMapsAdminReady`;
        (window as any).__googleMapsAdminReady = () => initMap();
        document.head.appendChild(scriptEl);
        return;
      }
      if (retries < 50) {
        retries++;
        setTimeout(tryInit, 300);
      }
    };
    tryInit();

    return () => {
      if (mapRef.current) {
        mapRef.current = null;
      }
    };
  }, []);

  const initMap = () => {
    if (!mapContainerRef.current || mapRef.current) return;
    const google = (window as any).google;
    const map = new google.maps.Map(mapContainerRef.current, {
      center: { lat: BALBRIGGAN_LAT, lng: BALBRIGGAN_LNG },
      zoom: 14,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
      styles: [
        { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
      ],
    });
    mapRef.current = map;
    setMapReady(true);

    // The map can initialize while its container still has a zero/incorrect
    // size (page still laying out), which causes Google's "can't load Google
    // Maps correctly" grey error overlay even though the key/billing is fine.
    // Re-trigger a resize once the container settles into its real size.
    if ((window as any).ResizeObserver) {
      let hasFixedInitialRender = false;
      const resizeObserver = new ResizeObserver(() => {
        google.maps.event.trigger(map, "resize");
        if (!hasFixedInitialRender) {
          hasFixedInitialRender = true;
          map.setCenter({ lat: BALBRIGGAN_LAT, lng: BALBRIGGAN_LNG });
        }
      });
      resizeObserver.observe(mapContainerRef.current);
    }
  };

  // Update markers when data changes
  useEffect(() => {
    if (!mapReady || !mapRef.current || !driverLocations) return;
    const google = (window as any).google;
    if (!google) return;

    // Clear existing markers and route lines
    Object.values(markersRef.current).forEach((m: any) => m.setMap(null));
    markersRef.current = {};
    routeLinesRef.current.forEach((l: any) => l.setMap(null));
    routeLinesRef.current = [];

    const onlineWithLocation = driverLocations.filter(d => (d.isOnline || d.activeOrders.length > 0) && d.latitude && d.longitude);
    const offlineWithLocation = showOffline ? driverLocations.filter(d => !d.isOnline && d.activeOrders.length === 0 && d.latitude && d.longitude) : [];

    const infoWindow = new google.maps.InfoWindow();

    // Add online driver markers
    onlineWithLocation.forEach(driver => {
      const isDelivering = driver.activeOrders.length > 0;
      const color = isDelivering ? "#F59E0B" : "#22C55E";
      const statusText = isDelivering
        ? `On Job: ${driver.activeOrders.map((o: any) => o.orderNumber).join(", ")}`
        : "Free";

      const markerEl = document.createElement("div");
      markerEl.style.cssText = `
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
        cursor: pointer;
      `;
      markerEl.textContent = driver.displayNumber || "?";

      let marker: any;
      try {
        // Try AdvancedMarkerElement first
        marker = new google.maps.marker.AdvancedMarkerElement({
          position: { lat: driver.latitude!, lng: driver.longitude! },
          map: mapRef.current,
          content: markerEl,
          title: driver.label,
        });
      } catch {
        // Fallback to standard Marker
        marker = new google.maps.Marker({
          position: { lat: driver.latitude!, lng: driver.longitude! },
          map: mapRef.current,
          label: { text: driver.displayNumber || "?", color: "white", fontWeight: "bold" },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 20,
            fillColor: color,
            fillOpacity: 1,
            strokeColor: "white",
            strokeWeight: 3,
          },
        });
      }

      const popupContent = `
        <div style="min-width: 200px; font-family: system-ui, sans-serif; padding: 4px;">
          <div style="font-weight: 700; font-size: 15px; margin-bottom: 4px;">${driver.label}</div>
          <div style="color: ${color}; font-weight: 600; font-size: 13px; margin-bottom: 6px;">${statusText}</div>
          ${driver.phone ? `<div style="font-size: 12px; margin-bottom: 2px;">📞 <a href="tel:${driver.phone}" style="color: #0369A1;">${driver.phone}</a></div>` : ""}
          ${driver.vehicleType ? `<div style="color: #64748B; font-size: 12px;">🚗 ${driver.vehicleType}</div>` : ""}
          <div style="color: #64748B; font-size: 12px;">Last update: ${timeAgo(driver.lastLocationUpdate)}</div>
          ${driver.activeOrders.length > 0 ? driver.activeOrders.map((o: any) =>
            `<div style="margin-top: 6px; padding: 6px 8px; background: #FEF3C7; border-radius: 6px; font-size: 12px;">
              <strong>${o.orderNumber}</strong> — ${o.status.replace(/_/g, " ")}
              <div style="color: #92400E; font-size: 11px;">${o.deliveryAddress}</div>
              <div id="eta-admin-${o.id}" style="color: #0a7ea4; font-size: 11px; font-weight: 600; margin-top: 2px;">Calculating ETA...</div>
            </div>`
          ).join("") : ""}
        </div>
      `;

      const clickHandler = () => {
        infoWindow.setContent(popupContent);
        infoWindow.open(mapRef.current, marker);
        setSelectedDriver(driver.id);
      };

      if (marker.addListener) {
        marker.addListener("click", clickHandler);
      } else if (marker.element) {
        marker.element.addEventListener("click", clickHandler);
      }

      markersRef.current[driver.id] = marker;

      // Draw route lines to delivery destinations
      if (driver.activeOrders.length > 0) {
        driver.activeOrders.forEach((order: any) => {
          if (order.deliveryLatitude && order.deliveryLongitude) {
            const directionsRenderer = new google.maps.DirectionsRenderer({
              suppressMarkers: true,
              polylineOptions: {
                strokeColor: "#F59E0B",
                strokeWeight: 4,
                strokeOpacity: 0.8,
              },
            });
            directionsRenderer.setMap(mapRef.current);
            routeLinesRef.current.push(directionsRenderer);

            // Reuse the last route for 30s instead of calling Directions on every 5s poll
            const cached = directionsCacheRef.current[order.id];
            const cacheAge = cached ? Date.now() - cached.timestamp : Infinity;

            if (cached && cacheAge < 30000) {
              directionsRenderer.setDirections(cached.result);
              const etaEl = document.getElementById(`eta-admin-${order.id}`);
              if (etaEl && cached.etaText) etaEl.textContent = cached.etaText;
            } else {
              const directionsService = new google.maps.DirectionsService();
              directionsService.route(
                {
                  origin: { lat: driver.latitude!, lng: driver.longitude! },
                  destination: { lat: order.deliveryLatitude, lng: order.deliveryLongitude },
                  travelMode: google.maps.TravelMode.DRIVING,
                },
                (result: any, status: any) => {
                  if (status === "OK") {
                    directionsRenderer.setDirections(result);
                    const leg = result.routes[0]?.legs[0];
                    const etaText = leg?.duration?.text ? `ETA: ${leg.duration.text}` : "";
                    directionsCacheRef.current[order.id] = { result, etaText, timestamp: Date.now() };
                    const etaEl = document.getElementById(`eta-admin-${order.id}`);
                    if (etaEl && etaText) etaEl.textContent = etaText;
                  }
                }
              );
            }

            // Destination marker
            const destMarker = new google.maps.Marker({
              position: { lat: order.deliveryLatitude, lng: order.deliveryLongitude },
              map: mapRef.current,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: "#EF4444",
                fillOpacity: 1,
                strokeColor: "white",
                strokeWeight: 2,
              },
              title: order.orderNumber,
            });
            destMarker.addListener("click", () => {
              infoWindow.setContent(`
                <div style="font-family: system-ui, sans-serif; padding: 4px;">
                  <div style="font-weight: 700; font-size: 13px;">📦 ${order.orderNumber}</div>
                  <div style="font-size: 12px; color: #64748B;">${order.deliveryAddress}</div>
                  <div style="font-size: 11px; color: #F59E0B; font-weight: 600; margin-top: 4px;">Driver ${driver.displayNumber || "?"} en route</div>
                </div>
              `);
              infoWindow.open(mapRef.current, destMarker);
            });
            routeLinesRef.current.push(destMarker);
          }
        });
      }
    });

    // Add offline driver markers (grey, smaller)
    offlineWithLocation.forEach(driver => {
      const marker = new google.maps.Marker({
        position: { lat: driver.latitude!, lng: driver.longitude! },
        map: mapRef.current,
        label: { text: driver.displayNumber || "?", color: "white", fontWeight: "bold", fontSize: "11px" },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: "#94A3B8",
          fillOpacity: 0.7,
          strokeColor: "white",
          strokeWeight: 2,
        },
        opacity: 0.6,
      });
      marker.addListener("click", () => {
        infoWindow.setContent(`
          <div style="min-width: 160px; font-family: system-ui, sans-serif; padding: 4px;">
            <div style="font-weight: 700; font-size: 14px;">${driver.label}</div>
            <div style="color: #94A3B8; font-size: 13px;">Offline</div>
            ${driver.phone ? `<div style="font-size: 12px;">📞 <a href="tel:${driver.phone}" style="color: #0369A1;">${driver.phone}</a></div>` : ""}
            <div style="color: #64748B; font-size: 12px;">Last seen: ${timeAgo(driver.lastLocationUpdate)}</div>
          </div>
        `);
        infoWindow.open(mapRef.current, marker);
      });
      markersRef.current[driver.id] = marker;
    });

    // Fit bounds only when the set of online drivers actually changes, not on every 5s poll —
    // otherwise manual zoom/pan keeps getting reset
    const currentOnlineIds = onlineWithLocation.map(d => d.id).sort().join(",");
    if (onlineWithLocation.length > 0 && currentOnlineIds !== lastFitDriverIdsRef.current) {
      lastFitDriverIdsRef.current = currentOnlineIds;
      const bounds = new google.maps.LatLngBounds();
      onlineWithLocation.forEach(d => bounds.extend({ lat: d.latitude!, lng: d.longitude! }));
      mapRef.current.fitBounds(bounds, 80);
      // Don't zoom in too much for a single driver
      const listener = google.maps.event.addListenerOnce(mapRef.current, "idle", () => {
        if (mapRef.current.getZoom() > 16) mapRef.current.setZoom(16);
      });
    }
  }, [driverLocations, mapReady, showOffline]);

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color="#00E5FF" />
      </ScreenContainer>
    );
  }

  const allDrivers = driverLocations || [];
  const onlineDrivers = allDrivers.filter(d => d.isOnline || d.activeOrders.length > 0);
  const offlineDrivers = allDrivers.filter(d => !d.isOnline && d.activeOrders.length === 0);
  const driversWithLocation = allDrivers.filter(d => d.latitude && d.longitude);
  const deliveringDrivers = onlineDrivers.filter(d => d.activeOrders.length > 0);

  const centerOnDriver = (driverId: number, lat: number | null, lng: number | null) => {
    if (!mapRef.current || !lat || !lng) return;
    setSelectedDriver(driverId);
    mapRef.current.panTo({ lat, lng });
    mapRef.current.setZoom(17);
    const marker = markersRef.current[driverId];
    if (marker) {
      const google = (window as any).google;
      new google.maps.event.trigger(marker, "click");
    }
  };

  const showAllDrivers = () => {
    if (!mapRef.current) return;
    setSelectedDriver(null);
    const google = (window as any).google;
    const allWithLocation = allDrivers.filter(d => d.latitude && d.longitude);
    if (allWithLocation.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      allWithLocation.forEach((d: any) => bounds.extend({ lat: d.latitude, lng: d.longitude }));
      mapRef.current.fitBounds(bounds, 80);
    } else {
      mapRef.current.panTo({ lat: BALBRIGGAN_LAT, lng: BALBRIGGAN_LNG });
      mapRef.current.setZoom(14);
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
          <TouchableOpacity
            style={[styles.statCard, { borderLeftColor: "#22C55E" }]}
            activeOpacity={0.7}
            onPress={() => router.push("/admin/orders?status=accepted" as any)}
          >
            <Text style={styles.statNumber}>{onlineDrivers.length}</Text>
            <Text style={styles.statLabel}>Online</Text>
            <Text style={styles.statBadgeHint}>View active orders →</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.statCard, { borderLeftColor: "#F59E0B" }]}
            activeOpacity={0.7}
            onPress={() => router.push("/admin/orders?status=on_the_way" as any)}
          >
            <Text style={styles.statNumber}>{deliveringDrivers.length}</Text>
            <Text style={styles.statLabel}>Delivering</Text>
            <Text style={styles.statBadgeHint}>View in-transit →</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.statCard, { borderLeftColor: "#94A3B8" }]}
            activeOpacity={0.7}
            onPress={() => setShowOffline(!showOffline)}
          >
            <Text style={styles.statNumber}>{offlineDrivers.length}</Text>
            <Text style={styles.statLabel}>Offline</Text>
            <Text style={styles.statBadgeHint}>{showOffline ? "Tap to hide" : "Tap to show"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.statCard, { borderLeftColor: "#0EA5E9" }]}
            activeOpacity={0.7}
            onPress={() => router.push("/admin/orders?status=pending" as any)}
          >
            <Text style={styles.statNumber}>{driversWithLocation.length}</Text>
            <Text style={styles.statLabel}>With GPS</Text>
            <Text style={styles.statBadgeHint}>View pending orders →</Text>
          </TouchableOpacity>
        </View>

        {/* Google Map */}
        {Platform.OS === "web" ? (
          <View style={styles.mapWrapper}>
            <div
  ref={(el: any) => { mapContainerRef.current = el; }}
  style={{ width: "100%", height: 500, borderRadius: 12, overflow: "hidden" }}
  suppressHydrationWarning
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
                    {driver.phone ? (
                      <TouchableOpacity onPress={() => { if (Platform.OS === "web") { (window as any).open(`tel:${driver.phone}`, "_self"); } else { Linking.openURL(`tel:${driver.phone}`); } }} activeOpacity={0.7}>
                        <Text style={styles.driverPhone}>📞 {driver.phone}</Text>
                      </TouchableOpacity>
                    ) : null}
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
                        {driver.activeOrders.map((o: any, i: number) => (
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
                        <Text style={{ color: "#92400E", fontSize: 11, fontWeight: "600" }}>On Job</Text>
                      </View>
                    ) : (
                      <View style={[styles.statusPill, { backgroundColor: "#DCFCE7" }]}>
                        <Text style={{ color: "#166534", fontSize: 11, fontWeight: "600" }}>Free</Text>
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

          {showOffline && offlineDrivers.length > 0 && (
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
                    {driver.phone ? (
                      <TouchableOpacity onPress={() => { if (Platform.OS === "web") { (window as any).open(`tel:${driver.phone}`, "_self"); } else { Linking.openURL(`tel:${driver.phone}`); } }} activeOpacity={0.7}>
                        <Text style={[styles.driverPhone, { color: "#64748B" }]}>📞 {driver.phone}</Text>
                      </TouchableOpacity>
                    ) : null}
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

        <View style={styles.footer}>
          <Text style={styles.footerText}>Auto-refreshes every 5 seconds • Drivers report GPS every 5 seconds when online</Text>
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
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 24, fontWeight: "700", color: "#0F172A" },
  refreshBtn: { backgroundColor: "#F1F5F9", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  refreshText: { fontSize: 14, fontWeight: "600", color: "#334155" },
  showAllBtn: { backgroundColor: "#E0F2FE", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  showAllText: { fontSize: 14, fontWeight: "600", color: "#0369A1" },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 20, flexWrap: "wrap" },
  statCard: { flex: 1, minWidth: 100, backgroundColor: "#ffffff", borderRadius: 10, padding: 14, borderLeftWidth: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  statNumber: { fontSize: 24, fontWeight: "800", color: "#0F172A" },
  statLabel: { fontSize: 12, fontWeight: "500", color: "#64748B", marginTop: 2 },
  statBadgeHint: { fontSize: 10, color: "#0EA5E9", fontWeight: "500", marginTop: 4 },
  mapWrapper: { backgroundColor: "#ffffff", borderRadius: 12, overflow: "hidden", marginBottom: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, position: "relative" as any },
  mapLoading: { position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "#F8FAFC" },
  noMapBox: { backgroundColor: "#F8FAFC", borderRadius: 12, padding: 32, alignItems: "center", marginBottom: 20, borderWidth: 1, borderColor: "#E2E8F0" },
  noMapText: { fontSize: 16, fontWeight: "600", color: "#334155", marginBottom: 4 },
  noMapSub: { fontSize: 14, color: "#64748B" },
  listSection: { marginBottom: 20 },
  listTitle: { fontSize: 18, fontWeight: "700", color: "#0F172A", marginBottom: 12 },
  groupLabel: { fontSize: 14, fontWeight: "600", color: "#475569", marginBottom: 8 },
  driverRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 10, marginBottom: 6 },
  driverRowOnline: { backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#E2E8F0" },
  driverRowOffline: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#F1F5F9" },
  driverRowSelected: { borderColor: "#0EA5E9", borderWidth: 2, backgroundColor: "#F0F9FF" },
  driverBadge: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  driverBadgeText: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  driverName: { fontSize: 15, fontWeight: "600", color: "#0F172A" },
  driverPhone: { fontSize: 12, color: "#0369A1", fontWeight: "500", marginTop: 1 },
  driverMeta: { fontSize: 12, color: "#64748B" },
  orderTag: { fontSize: 12, color: "#92400E", backgroundColor: "#FEF3C7", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, alignSelf: "flex-start", overflow: "hidden" },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  emptyState: { alignItems: "center", padding: 40, backgroundColor: "#F8FAFC", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0" },
  footer: { alignItems: "center", paddingVertical: 12 },
  locateHint: { fontSize: 10, color: "#0EA5E9", fontWeight: "500" },
  footerText: { fontSize: 12, color: "#94A3B8" },
});
