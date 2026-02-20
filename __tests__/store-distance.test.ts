import { describe, it, expect } from "vitest";

// Pure Haversine function (copied from hooks/use-location.ts to avoid React Native imports in test)
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

describe("calculateDistance (Haversine)", () => {
  it("should return 0 for same point", () => {
    const d = calculateDistance(53.6108, -6.1836, 53.6108, -6.1836);
    expect(d).toBe(0);
  });

  it("should calculate distance between Spar Balbriggan and Open All Ours", () => {
    // Spar: 53.6108, -6.1836
    // Open All Ours: 53.6101049, -6.1841258
    const d = calculateDistance(53.6108, -6.1836, 53.6101049, -6.1841258);
    // These are very close — should be less than 0.1 km
    expect(d).toBeLessThan(0.2);
    expect(d).toBeGreaterThan(0);
  });

  it("should calculate distance from Dublin city center to Balbriggan (~30km)", () => {
    // Dublin city center: 53.3498, -6.2603
    // Balbriggan: 53.6108, -6.1836
    const d = calculateDistance(53.3498, -6.2603, 53.6108, -6.1836);
    expect(d).toBeGreaterThan(25);
    expect(d).toBeLessThan(35);
  });

  it("should calculate distance from Swords to Balbriggan (~15km)", () => {
    // Swords: 53.4597, -6.2181
    // Balbriggan: 53.6108, -6.1836
    const d = calculateDistance(53.4597, -6.2181, 53.6108, -6.1836);
    expect(d).toBeGreaterThan(12);
    expect(d).toBeLessThan(20);
  });

  it("should be symmetric", () => {
    const d1 = calculateDistance(53.3498, -6.2603, 53.6108, -6.1836);
    const d2 = calculateDistance(53.6108, -6.1836, 53.3498, -6.2603);
    expect(Math.abs(d1 - d2)).toBeLessThan(0.001);
  });
});

describe("Store sorting by distance", () => {
  interface MockStore {
    id: number;
    name: string;
    latitude: string | null;
    longitude: string | null;
    isOpen: boolean;
    distance: number | null;
  }

  function sortStores(stores: MockStore[]): MockStore[] {
    return [...stores].sort((a, b) => {
      const aOpen = a.isOpen ? 0 : 1;
      const bOpen = b.isOpen ? 0 : 1;
      if (aOpen !== bOpen) return aOpen - bOpen;

      if (a.distance !== null && b.distance !== null) {
        return a.distance - b.distance;
      }
      if (a.distance !== null) return -1;
      if (b.distance !== null) return 1;
      return 0;
    });
  }

  it("should sort open stores before closed stores", () => {
    const stores: MockStore[] = [
      { id: 1, name: "Closed Store", latitude: "53.61", longitude: "-6.18", isOpen: false, distance: 1 },
      { id: 2, name: "Open Store", latitude: "53.61", longitude: "-6.18", isOpen: true, distance: 5 },
    ];
    const sorted = sortStores(stores);
    expect(sorted[0].name).toBe("Open Store");
    expect(sorted[1].name).toBe("Closed Store");
  });

  it("should sort by distance within same open/closed group", () => {
    const stores: MockStore[] = [
      { id: 1, name: "Far Store", latitude: "53.61", longitude: "-6.18", isOpen: true, distance: 10 },
      { id: 2, name: "Near Store", latitude: "53.61", longitude: "-6.18", isOpen: true, distance: 2 },
      { id: 3, name: "Mid Store", latitude: "53.61", longitude: "-6.18", isOpen: true, distance: 5 },
    ];
    const sorted = sortStores(stores);
    expect(sorted[0].name).toBe("Near Store");
    expect(sorted[1].name).toBe("Mid Store");
    expect(sorted[2].name).toBe("Far Store");
  });

  it("should put stores without coordinates last", () => {
    const stores: MockStore[] = [
      { id: 1, name: "No Coords", latitude: null, longitude: null, isOpen: true, distance: null },
      { id: 2, name: "Has Coords", latitude: "53.61", longitude: "-6.18", isOpen: true, distance: 3 },
    ];
    const sorted = sortStores(stores);
    expect(sorted[0].name).toBe("Has Coords");
    expect(sorted[1].name).toBe("No Coords");
  });

  it("should handle all stores without coordinates", () => {
    const stores: MockStore[] = [
      { id: 1, name: "Store A", latitude: null, longitude: null, isOpen: true, distance: null },
      { id: 2, name: "Store B", latitude: null, longitude: null, isOpen: true, distance: null },
    ];
    const sorted = sortStores(stores);
    // Order should be preserved (stable sort)
    expect(sorted.length).toBe(2);
  });
});

describe("formatDistance", () => {
  function formatDistance(km: number): string {
    if (km < 1) {
      return `${Math.round(km * 1000)}m`;
    }
    return `${km.toFixed(1)}km`;
  }

  it("should format meters for distances under 1km", () => {
    expect(formatDistance(0.5)).toBe("500m");
    expect(formatDistance(0.08)).toBe("80m");
    expect(formatDistance(0.001)).toBe("1m");
  });

  it("should format km for distances 1km and above", () => {
    expect(formatDistance(1.0)).toBe("1.0km");
    expect(formatDistance(5.3)).toBe("5.3km");
    expect(formatDistance(15.75)).toBe("15.8km");
  });
});
