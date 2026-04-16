# WSS (WeShop Stock) Feature Specification

## 1. What the WSS Feature is Supposed to Do

The WSS (WeShop Stock) feature is designed to handle orders that contain items from two different sources:

- **Store Items**: Regular products sold by the store (e.g., Spar Peanut Butter, Spar Porridge Oats)
- **WSS Items**: Admin-supplied items managed by WeShop (e.g., 10 ft Micro USB Cable, Amoy Noodles)

**Key Behavior**:
- When a customer places an order with mixed items, the system should create **two separate receipts**:
  - **Customer Receipt**: Shows ALL items (store + WSS) with full pricing
  - **Store Receipt**: Shows ONLY store items (excludes WSS items) with proportional fees
- **Print Behavior**: When the store staff accepts an order and the receipt is printed, it should print the **store receipt** (excluding WSS items)
- **Dashboard Display**: The store dashboard should show only the store items for the order (not WSS items)

**Example**:
- Order contains: USB Cable (WSS), Peanut Butter (Store), Porridge Oats (Store)
- Customer sees receipt with: 3 items, total EUR19.98
- Store sees receipt with: 2 items, total EUR14.98 (proportional fees applied)
- Store dashboard shows: 2 items (USB Cable hidden)

---

## 2. What Has Already Been Tried to Implement

### Attempt 1: Backend Filtering Logic
- **File**: `server/routers/store.ts` (getOrders endpoint)
- **Approach**: Added filtering logic to exclude WSS items from the items array returned to the store
- **Result**: ❌ Failed - The filtering logic was comparing incorrect fields (item.order_items.productId vs si.id)

### Attempt 2: Fixed Filtering Logic in getUserOrders
- **File**: `server/routers/orders.ts` (getUserOrders endpoint)
- **Approach**: Fixed the filter to compare `si.id` with `item.productId` instead of `item.order_items.productId`
- **Result**: ⚠️ Partial - Filtering works for the endpoint, but print jobs still show all items

### Attempt 3: Receipt Data Calculation
- **File**: `server/services/receipt-calculator.ts` (calculateDualReceipts function)
- **Approach**: Created function to split receipts into customer and store receipts based on isWss flag
- **Result**: ✅ Working - Correctly calculates dual receipts and filters WSS items

### Attempt 4: Auto Print Job on Order Accept
- **File**: `server/routers/store.ts` (acceptOrder endpoint)
- **Approach**: Modified to pass receiptData to autoCreatePrintJob to ensure filtered items are used
- **Result**: ❌ Failed - receiptData was not being passed correctly or was undefined

### Attempt 5: Retry Logic for receiptData
- **File**: `server/routers/print.ts` (autoCreatePrintJob function)
- **Approach**: Added retry logic with delays to handle database replication lag
- **Result**: ❌ Failed - receiptData still not being used correctly

---

## 3. What Went Wrong

### Root Causes Identified:

1. **Race Condition in acceptOrder**:
   - When `acceptOrder` is called, it fetches the order but may not include `receiptData` in the select
   - `autoCreatePrintJob` is called immediately with potentially undefined receiptData
   - Falls back to fetching ALL items from database instead of using filtered items

2. **Product isWss Flag Not Being Set Correctly**:
   - The USB Cable product was marked as WSS in the database
   - But when orders are created, the receiptData calculation might not be reading the updated isWss flag
   - Or the product fetch query is not selecting the isWss field

3. **Fallback Logic in autoCreatePrintJob**:
   - When receiptData is missing/undefined, the function falls back to fetching all orderItems from database
   - This fallback doesn't respect the WSS filtering at all
   - Results in receipts showing all items

4. **Mismatch in Item ID Types**:
   - receiptData.storeReceipt.items have `id` as productId (from ReceiptItem structure)
   - But autoCreatePrintJob expects `id` to be orderItemId (for modifier lookups)
   - This causes modifier fetching to fail and items to be displayed incorrectly

---

## 4. What Database Changes Are Needed

### Current Schema (Already Exists):
- `products` table has `isWss` column (boolean, default false)
- `orders` table has `receiptData` column (JSON text)

### Verification Needed:
1. Confirm `products.isWss` is properly indexed for quick lookups
2. Confirm `orders.receiptData` is properly stored and retrievable
3. Verify that when a product's `isWss` flag is updated, new orders use the updated flag

### Potential Changes:
- Add a `created_at` timestamp to products to track when isWss flag was set
- Add a migration to ensure all existing products have isWss explicitly set (not NULL)

---

## 5. What Backend Changes Are Needed

### Priority 1: Fix receiptData Passing in acceptOrder
**File**: `server/routers/store.ts`
- ✅ Already updated: Explicitly select receiptData in the order fetch
- ✅ Already updated: Pass receiptData to autoCreatePrintJob
- ⚠️ Still needs verification: Confirm receiptData is actually being passed

### Priority 2: Fix autoCreatePrintJob Retry Logic
**File**: `server/routers/print.ts`
- ✅ Already updated: Added retry logic with exponential backoff
- ⚠️ Still needs verification: Confirm retry logic is working
- ❌ Still needs: Better fallback when receiptData is missing (don't show all items)

### Priority 3: Fix Item ID Mismatch
**File**: `server/routers/print.ts` and `server/services/receipt-calculator.ts`
- ❌ Not yet fixed: receiptData items need to include orderItemId for modifier lookups
- ❌ Not yet fixed: autoCreatePrintJob needs to map receiptData items to database orderItems

### Priority 4: Ensure isWss Flag is Read Correctly
**File**: `server/routers/orders.ts` (createOrder endpoint)
- ✅ Already correct: Product fetch uses `.select()` which includes all fields
- ⚠️ Still needs verification: Confirm isWss flag is actually being read from database

### Priority 5: Fix Store Dashboard Filtering
**File**: `server/routers/orders.ts` (getUserOrders endpoint)
- ✅ Already fixed: Changed filter from `item.order_items.productId` to `item.productId`
- ⚠️ Still needs verification: Confirm filtering is working for store dashboard

---

## 6. What Frontend Changes Are Needed

### Store Dashboard (`app/store-dashboard/index.tsx`):
- ✅ Already using `getUserOrders` endpoint which should filter items
- ⚠️ Still needs verification: Confirm filtered items are being displayed

### POS Screen (`app/pos-printer.tsx`):
- ⚠️ Needs investigation: Determine if it's showing order items or print job items
- ⚠️ Needs fix: If showing order items, should use filtered items from getUserOrders

### Admin Dashboard:
- ⚠️ Needs investigation: Determine if admin should see all items or filtered items

---

## 7. Files Modified and Changes Made

### server/routers/store.ts
**Changes**:
1. Line 350-370: Modified `acceptOrder` to explicitly select receiptData
   - Changed from `.select()` to `.select({ id, orderNumber, storeId, customerId, guestName, guestPhone, receiptData, status })`
   - Ensures receiptData is included in the order result

2. Line 414: Added logging before calling autoCreatePrintJob
   - `console.log('[acceptOrder] Order ${orderResult[0].orderNumber}: receiptData=${!!orderResult[0].receiptData}')`
   - Helps debug if receiptData is being passed

3. Line 415: Updated autoCreatePrintJob call to pass receiptData
   - `await autoCreatePrintJob(input.orderId, input.storeId, orderResult[0].receiptData || undefined)`
   - Passes receiptData as third parameter to avoid race conditions

### server/routers/print.ts
**Changes**:
1. Line 210: Updated function signature to accept receiptDataParam
   - `export async function autoCreatePrintJob(orderId: number, storeId: number, receiptDataParam?: string)`
   - Allows receiptData to be passed directly

2. Line 238-258: Added retry logic for receiptData fetching
   - If receiptData not provided as param, retries fetching from DB with exponential backoff
   - Waits 200ms, 400ms, 600ms between attempts
   - Handles potential database replication lag

3. Line 240: Added logging for receiptData status
   - `console.log('[AutoPrint] Order ${order.orderNumber}: receiptData exists? ${!!receiptDataStr}, fromParam? ${!!receiptDataParam}')`
   - Helps debug if receiptData is being used

4. Line 246: Added detailed logging of store receipt items
   - `console.log('[AutoPrint] Store receipt items:', JSON.stringify(receiptDataObj.storeReceipt?.items, null, 2))`
   - Shows exactly which items are in the store receipt

### server/routers/orders.ts
**Changes**:
1. Line 640: Fixed WSS filtering in getUserOrders
   - Changed from `item.order_items.productId` to `item.productId`
   - Correctly compares product IDs instead of trying to access non-existent nested field
   - Filters out WSS items from store dashboard display

### server/services/receipt-calculator.ts
**Status**: ✅ No changes needed - Already correctly implements dual receipt calculation

---

## 8. Debugging Steps Completed

1. ✅ Verified that receiptData is being calculated when orders are created
2. ✅ Verified that calculateDualReceipts correctly filters WSS items
3. ✅ Verified that USB Cable product is marked as isWss = true
4. ✅ Identified that autoCreatePrintJob was receiving undefined receiptData
5. ✅ Identified that getUserOrders had incorrect filter logic
6. ⚠️ Still needs verification: Confirm that new orders after fixes show filtered receipts

---

## 9. Next Steps to Complete WSS Implementation

1. **Test with New Order**:
   - Create a new order with USB Cable (WSS), Peanut Butter (Store), Porridge Oats (Store)
   - Accept the order and check if receipt shows only 2 items
   - Check if store dashboard shows only 2 items

2. **Verify receiptData is Being Used**:
   - Check server logs to see if receiptData is being passed to autoCreatePrintJob
   - Check if retry logic is being triggered
   - Verify that store receipt items are being used for printing

3. **Fix Item ID Mismatch** (if still needed):
   - Update receiptData structure to include orderItemId
   - Update autoCreatePrintJob to map receiptData items to database orderItems for modifier lookups

4. **Add Comprehensive Logging**:
   - Add more detailed logging throughout the flow
   - Log what's in receiptData at each stage
   - Log what items are being selected for printing

5. **Create End-to-End Test**:
   - Create test script that validates entire WSS flow
   - Verify customer receipt has all items
   - Verify store receipt has only store items
   - Verify printed receipt shows only store items
   - Verify dashboard shows only store items

---

## 10. Known Issues to Address

1. **receiptData May Be NULL**: When receiptData is missing, the system falls back to showing all items
2. **Item ID Type Mismatch**: receiptData items use productId, but modifier lookup expects orderItemId
3. **No Defensive Checks**: If receiptData is incomplete or malformed, no safeguards prevent showing all items
4. **Replication Lag**: Database might have replication lag between writes and reads
5. **Product Flag Updates**: If product isWss flag is updated after orders are created, old orders won't reflect the change

