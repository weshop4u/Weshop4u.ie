import { describe, it, expect } from "vitest";

describe("Google Maps Geocoding API", () => {
  it("should successfully geocode an Irish Eircode", async () => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    expect(apiKey).toBeDefined();
    expect(apiKey).not.toBe("");

    // Test with a real Irish Eircode (Dublin city center)
    const eircode = "D02 X285";
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(eircode)}&region=ie&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    // Check that the API call was successful
    expect(response.status).toBe(200);
    
    // Log the full response for debugging
    if (data.status !== "OK") {
      console.log("Google Maps API Response:", JSON.stringify(data, null, 2));
    }
    
    expect(data.status).toBe("OK");
    expect(data.results).toBeDefined();
    expect(data.results.length).toBeGreaterThan(0);

    // Check that we got valid coordinates
    const location = data.results[0].geometry.location;
    expect(location.lat).toBeDefined();
    expect(location.lng).toBeDefined();
    expect(typeof location.lat).toBe("number");
    expect(typeof location.lng).toBe("number");

    // Dublin coordinates should be roughly in this range
    expect(location.lat).toBeGreaterThan(53);
    expect(location.lat).toBeLessThan(54);
    expect(location.lng).toBeGreaterThan(-7);
    expect(location.lng).toBeLessThan(-6);
  }, 10000); // 10 second timeout for API call
});
