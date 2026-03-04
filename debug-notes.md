# Bug Analysis - Mar 4 2026

## Bug 1: Back to Dashboard doesn't navigate away
- The "Back to Dashboard" button calls `router.replace('/driver')` 
- But from the screenshots, the driver stays on the active delivery screen
- This suggests `router.replace('/driver')` isn't working properly on the device
- The driver sees the same WS4U/SPR/097 screen with "Going to Store" status

## Bug 2: Arrived at Store status resets + repeated SMS
- When driver presses "I've Arrived at Store", it calls handleArrivedAtStore which:
  1. Sets local state: deliveryStatus = "at_store", hasNotifiedAtStore = true
  2. Calls notifyAtStoreMutation which sends SMS
- The notifyDriverAtStore endpoint sends SMS to customer
- When component re-renders (or re-mounts after navigation), the useEffect at line 97 runs
- The order status on the server is likely "accepted" (not "ready_for_pickup" yet since store hasn't marked it)
- So the else branch at line 115-118 fires: `setDeliveryStatus("going_to_store")`
- This resets the UI back to showing the "I've Arrived at Store" button
- Driver presses it again → another SMS sent

## Root cause of status reset:
- `handleArrivedAtStore` only updates LOCAL state (deliveryStatus, hasNotifiedAtStore)
- It does NOT update the ORDER STATUS on the server
- The notifyDriverAtStore endpoint sends SMS but doesn't change order.status
- When the useEffect syncs from server, order.status is still "accepted" → resets to going_to_store
- The `hasNotifiedAtStore` state is local and gets reset on re-mount

## Fix needed:
1. notifyDriverAtStore should also update order status to something that persists the "at store" state
   OR store hasNotifiedAtStore in the order record
2. The useEffect should check if order has been notified at store (server-side flag)
3. Back to Dashboard navigation needs to actually work

## Bug 3: Dashboard only shows single banner
- From screenshot at 04:45, dashboard shows "Active Delivery in Progress WS4U/SPR/094"
- This is the OLD banner format, not the new multi-job cards
- This suggests the old code is still being served (cache issue?) OR the getActiveBatch returns only 1 order
- The getActiveBatch query uses `inArray(orders.status, ["pending", "accepted", "preparing", "ready_for_pickup", "picked_up", "on_the_way"])`
- If only one order is assigned to the driver at that point, only one shows
- The other orders haven't been accepted yet (they're still in the offer queue)
- This is actually CORRECT behavior - only accepted orders show on dashboard
