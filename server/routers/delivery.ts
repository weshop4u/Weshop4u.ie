import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { stores } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { geocodeAddress, calculateDistance, calculateDeliveryFee } from "../services/geocoding";

export const deliveryRouter = router({
  // Calculate delivery fee based on store and customer address
  calculateFee: publicProcedure
    .input(
      z.object({
        storeId: z.number(),
        customerAddress: z.string().min(1, "Address is required"),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Get store details
      const storeResult = await db
        .select()
        .from(stores)
        .where(eq(stores.id, input.storeId))
        .limit(1);

      if (storeResult.length === 0) {
        throw new Error("Store not found");
      }

      const store = storeResult[0];

      // Geocode customer address
      const customerLocation = await geocodeAddress(input.customerAddress);
      if (!customerLocation) {
        throw new Error("Could not find customer address. Please check the address or Eircode and try again.");
      }

      // Get store coordinates (use existing lat/lng or geocode store address)
      let storeLat: number;
      let storeLng: number;

      if (store.latitude && store.longitude) {
        storeLat = parseFloat(store.latitude);
        storeLng = parseFloat(store.longitude);
      } else {
        // Geocode store address if coordinates not available
        const storeAddress = store.eircode || store.address;
        const storeLocation = await geocodeAddress(storeAddress);
        
        if (!storeLocation) {
          throw new Error("Could not determine store location");
        }

        storeLat = storeLocation.latitude;
        storeLng = storeLocation.longitude;
      }

      // Calculate distance
      const distance = calculateDistance(
        storeLat,
        storeLng,
        customerLocation.latitude,
        customerLocation.longitude
      );

      // Calculate delivery fee
      const deliveryFee = calculateDeliveryFee(distance);

      return {
        distance,
        deliveryFee,
        customerAddress: customerLocation.formattedAddress,
        storeAddress: store.address,
        deliveryLatitude: customerLocation.latitude,
        deliveryLongitude: customerLocation.longitude,
      };
    }),
});
