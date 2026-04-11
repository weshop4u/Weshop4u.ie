# WSS (WeShop4U Stock) Feature - Implementation Summary

## Overview

The WSS feature allows WeShop4U to mark certain products as "office fulfillment" items. These items are:
- **Charged to customers** at full price (customer pays for everything)
- **Hidden from store receipts** (store staff only see non-WSS items)
- **Fulfilled by the office** (next door to the store)
- **Tracked in admin** (you see the complete order with all items)

## Implementation Details

### 1. Database Schema

**Column Added:**
- `products.wss` (BOOLEAN, default: false)

This column marks which products are WSS items. When `wss = true`, the product is handled by the office; when `false`, it's a normal store item.

### 2. Admin Product Management UI

**Location:** Admin → Products page

**New Column:** "WSS" toggle column (between PIN and ACTIONS)
- Red X (❌) = WSS disabled (normal product)
- Green checkmark (✅) = WSS enabled (office fulfillment)
- Click to toggle on/off

**Usage:**
1. Go to Admin → Products
2. Find the product you want to mark as WSS
3. Click the X in the WSS column to toggle it to a checkmark
4. The product is now marked as WSS

### 3. Order Processing Logic

**When a customer places an order:**

1. **Order Creation:**
   - Customer orders items (some WSS, some normal)
   - Customer pays FULL PRICE for everything
   - Order is created with `subtotal` = all items

2. **Store Receipt Calculation:**
   - Only non-WSS items are included in store receipt
   - `storeReceiptSubtotal` = sum of non-WSS items only
   - Store notification shows only non-WSS items and their total

3. **Admin Order View:**
   - You see the COMPLETE order with all items
   - You see the full price breakdown
   - Each item shows whether it's WSS or not

4. **Driver View:**
   - Driver sees only non-WSS items (same as store)
   - If order contains WSS items, driver gets "Contact Office" notification
   - Driver picks up non-WSS items from store, WSS items from office

### 4. Order Scenarios

#### Scenario A: Mixed Order (WSS + Normal)
```
Customer Orders:
- 20 JPS Blue (WSS) = £17.45
- Can of Coke (Normal) = £2.50

Customer Pays: £19.95 (full price)

Store Sees:
- Can of Coke = £2.50
- (JPS Blue is hidden)

Driver Sees:
- Can of Coke = £2.50
- Notification: "Contact Office" (for JPS Blue)

Admin Sees:
- 20 JPS Blue (WSS) = £17.45
- Can of Coke = £2.50
- Total: £19.95
```

#### Scenario B: WSS-Only Order
```
Customer Orders:
- 20 JPS Blue (WSS) = £17.45

Customer Pays: £17.45

Store Sees:
- (Nothing - empty receipt)

Driver Sees:
- (Nothing - empty order)
- Notification: "Contact Office" (for JPS Blue)

Admin Sees:
- 20 JPS Blue (WSS) = £17.45
- Total: £17.45
```

#### Scenario C: Normal Order (No WSS)
```
Customer Orders:
- Can of Coke = £2.50

Customer Pays: £2.50

Store Sees:
- Can of Coke = £2.50

Driver Sees:
- Can of Coke = £2.50
- (No "Contact Office" notification)

Admin Sees:
- Can of Coke = £2.50
- Total: £2.50
```

## Key Features

### ✅ What's Implemented

1. **Database:**
   - `wss` boolean column added to products table
   - Defaults to `false` (normal product)

2. **Admin UI:**
   - WSS toggle in product management table
   - Easy on/off switching with visual indicators

3. **Order Processing:**
   - WSS items tracked during order creation
   - Store receipt calculated excluding WSS items
   - Store notifications only sent if non-WSS items exist
   - Admin sees full order with all items

4. **Order Item Data:**
   - Each order item includes `isWss` flag
   - Drivers can see which items are WSS (if needed)
   - Admin can filter/identify WSS items

5. **TypeScript Safety:**
   - All type checks passing
   - Proper type annotations for WSS fields

### 🔄 Order Flow

```
Customer Places Order
    ↓
Order Created (full price charged)
    ↓
Items Split:
  - WSS items → Office fulfillment
  - Normal items → Store fulfillment
    ↓
Store Notification (only non-WSS items)
    ↓
Driver Notification (includes "Contact Office" if WSS items)
    ↓
Driver Accepts Order
    ↓
Driver Picks Up:
  - Non-WSS items from store
  - WSS items from office (next door)
    ↓
Order Delivered to Customer
```

## Testing

### Manual Testing Checklist

- [ ] **Admin UI:** Toggle WSS on/off for a product
- [ ] **Mixed Order:** Place order with WSS + normal items
  - [ ] Verify customer is charged full price
  - [ ] Verify store receipt shows only normal items
  - [ ] Verify admin sees full order
- [ ] **WSS-Only Order:** Place order with only WSS items
  - [ ] Verify customer is charged
  - [ ] Verify store sees nothing
  - [ ] Verify driver gets "Contact Office" notification
- [ ] **Normal Order:** Place order with no WSS items
  - [ ] Verify everything works as before
  - [ ] Verify no "Contact Office" notification

## Database Queries

### Check if a product is WSS
```sql
SELECT id, name, wss FROM products WHERE wss = true;
```

### Get all WSS products for a store
```sql
SELECT id, name, price, wss FROM products 
WHERE storeId = ? AND wss = true;
```

### Find orders with WSS items
```sql
SELECT DISTINCT o.id, o.orderNumber 
FROM orders o
JOIN orderItems oi ON o.id = oi.orderId
JOIN products p ON oi.productId = p.id
WHERE p.wss = true;
```

## Notes

- **Temporary Feature:** This is a short-term revenue strategy while orders ramp up
- **No Store Visibility:** Store staff will never know about WSS items
- **Office Coordination:** Office staff tell drivers what to pick up from the office
- **Customer Transparency:** Customers see WSS items as normal products (no special label)
- **Full Payment:** Customers always pay full price (no hidden charges)

## Future Enhancements

- [ ] WSS inventory tracking
- [ ] Office fulfillment dashboard
- [ ] Automatic driver routing to office
- [ ] WSS item analytics/reporting
- [ ] Scheduled WSS item availability
