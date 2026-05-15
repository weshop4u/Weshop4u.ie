/**
 * Geocoding service for converting addresses/Eircodes to GPS coordinates
 * and calculating distances between locations
 */

interface GeocodingResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

/**
 * Convert an Eircode or address to GPS coordinates using Google Maps Geocoding API
 */
export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY is not configured");
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=ie&key=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== "OK" || !data.results || data.results.length === 0) {
      console.error("Geocoding failed:", data.status, data.error_message);
      return null;
    }

    const result = data.results[0];
    const location = result.geometry.location;

    return {
      latitude: location.lat,
      longitude: location.lng,
      formattedAddress: result.formatted_address,
    };
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * Returns distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 100) / 100; // Round to 2 decimal places
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate delivery fee based on distance
 * Base fee: €3.50 for first 2.8km
 * Additional: €1.00 per km over 2.8km
 */
export function calculateDeliveryFee(distanceKm: number): number {
  const BASE_FEE = 3.50;
  const BASE_DISTANCE = 2.8;
  const ADDITIONAL_RATE = 1.00;

  if (distanceKm <= BASE_DISTANCE) {
    return BASE_FEE;
  }

  const additionalDistance = distanceKm - BASE_DISTANCE;
  const additionalFee = additionalDistance * ADDITIONAL_RATE;
  
  return Math.round((BASE_FEE + additionalFee) * 100) / 100; // Round to 2 decimal places
}
