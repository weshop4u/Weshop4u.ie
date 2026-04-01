# Cart Bug Analysis

## Issue
"Big Hoops Bbq 70g" is stuck in the cart, cannot be removed even when logging in as guest.

## Root Cause Analysis

The cart logic itself (updateQuantity → removeFromCart) looks correct. The flow is:
1. − button calls `updateQuantity(product.id, -1, key)` 
2. Cart page finds currentItem in `cartContext.items` by `cartItemKey`
3. Calculates `newQty = 1 + (-1) = 0`
4. Calls `updateCartQuantity(productId, 0, cartItemKey)`
5. In provider, `quantity <= 0` triggers `removeFromCart`
6. `removeFromCart` filters out the item and saves to AsyncStorage

## Likely Issues

1. **AsyncStorage on web = localStorage** - The cart persists across page reloads and even across "guest" sessions because localStorage is shared across all tabs/sessions for the same domain.

2. **No "Remove" button** - There's no explicit remove/delete button on cart items. The only way to remove is to tap − until quantity reaches 0. If the − button doesn't work for some reason (e.g. the `key` doesn't match), the item is stuck.

3. **Possible key mismatch** - If the item was added before the cartItemKey feature was implemented (or the stored data doesn't have cartItemKey), the key lookup might fail:
   - Cart page: `key = ci?.cartItemKey || p_${product.id}` → generates `p_123`
   - updateQuantity: looks for `cartContext.items.find(i => i.cartItemKey === "p_123")`
   - But if the stored item has `cartItemKey: undefined` (old data), the find returns undefined
   - `if (!currentItem) return;` → silently exits, nothing happens

## Fix
1. Add a swipe-to-delete or explicit "Remove" button on each cart item
2. Fix the key lookup to handle items without cartItemKey (fallback to productId match)
3. Add a "Clear Cart" button visible in the cart UI
