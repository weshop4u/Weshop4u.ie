import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface CartItemModifier {
  groupName: string;
  modifierId: number;
  modifierName: string;
  modifierPrice: string; // decimal as string, e.g. "1.50"
}

export interface CartItemDeal {
  dealId: number;
  quantity: number;
  dealPrice: string; // decimal as string
  label: string;
}

export interface CartItem {
  productId: number;
  productName: string;
  productPrice: string;
  quantity: number;
  image?: string;
  /** Unique key to distinguish same product with different modifiers */
  cartItemKey?: string;
  /** Selected modifiers for this item */
  modifiers?: CartItemModifier[];
  /** Active multi-buy deal (auto-applied) */
  deal?: CartItemDeal | null;
}

export interface CartState {
  storeId: number | null;
  storeName: string | null;
  items: CartItem[];
}

interface CartContextType {
  cart: CartState;
  addToCart: (storeId: number, storeName: string, item: CartItem) => Promise<boolean>;
  removeFromCart: (productId: number, cartItemKey?: string) => void;
  updateQuantity: (productId: number, quantity: number, cartItemKey?: string) => void;
  clearCart: () => void;
  getItemCount: () => number;
  getCartTotal: () => number;
  getProductQuantity: (productId: number) => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = "@weshop4u_cart";

const EMPTY_CART: CartState = {
  storeId: null,
  storeName: null,
  items: [],
};

/**
 * Generate a unique key for a cart item based on productId + selected modifiers.
 * Same product with different modifiers = different cart items.
 */
function generateCartItemKey(productId: number, modifiers?: CartItemModifier[]): string {
  if (!modifiers || modifiers.length === 0) return `p_${productId}`;
  const modKey = modifiers
    .map(m => `${m.modifierId}`)
    .sort()
    .join("_");
  return `p_${productId}_m_${modKey}`;
}

/**
 * Calculate the unit price for a cart item including modifier extras.
 */
export function getItemUnitPrice(item: CartItem): number {
  const basePrice = parseFloat(item.productPrice);
  const modifierTotal = (item.modifiers || []).reduce(
    (sum, m) => sum + parseFloat(m.modifierPrice || "0"),
    0
  );
  return basePrice + modifierTotal;
}

/**
 * Calculate the line total for a cart item, applying multi-buy deals if present.
 */
export function getItemLineTotal(item: CartItem): number {
  const unitPrice = getItemUnitPrice(item);

  if (item.deal && item.quantity >= item.deal.quantity) {
    // Apply deal: how many full deal sets + remainder at unit price
    const dealSets = Math.floor(item.quantity / item.deal.quantity);
    const remainder = item.quantity % item.deal.quantity;
    const dealTotal = dealSets * parseFloat(item.deal.dealPrice);
    const remainderTotal = remainder * unitPrice;
    return dealTotal + remainderTotal;
  }

  return unitPrice * item.quantity;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartState>(EMPTY_CART);

  // Keep a ref that always mirrors the latest cart state
  const cartRef = useRef<CartState>(EMPTY_CART);

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  // Load cart from storage on mount
  useEffect(() => {
    (async () => {
      try {
        const cartData = await AsyncStorage.getItem(CART_STORAGE_KEY);
        if (cartData) {
          const parsed = JSON.parse(cartData) as CartState;
          cartRef.current = parsed;
          setCart(parsed);
        }
      } catch (error) {
        console.error("Failed to load cart:", error);
      }
    })();
  }, []);

  const saveCart = useCallback((cartData: CartState) => {
    AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartData)).catch(
      (error) => console.error("Failed to save cart:", error)
    );
  }, []);

  const addToCart = useCallback(async (
    storeId: number,
    storeName: string,
    item: CartItem
  ): Promise<boolean> => {
    const current = cartRef.current;

    // Check if adding from different store
    if (current.storeId !== null && current.storeId !== storeId) {
      return false;
    }

    // Generate key based on product + modifiers
    const key = item.cartItemKey || generateCartItemKey(item.productId, item.modifiers);
    const itemWithKey = { ...item, cartItemKey: key };

    // Find existing item with same key (same product + same modifiers)
    const existingItemIndex = current.items.findIndex(
      (i) => (i.cartItemKey || generateCartItemKey(i.productId, i.modifiers)) === key
    );

    let nextCart: CartState;
    if (existingItemIndex >= 0) {
      const newItems = [...current.items];
      newItems[existingItemIndex] = {
        ...newItems[existingItemIndex],
        quantity: newItems[existingItemIndex].quantity + item.quantity,
      };
      nextCart = { ...current, items: newItems };
    } else {
      nextCart = {
        storeId,
        storeName,
        items: [...current.items, itemWithKey],
      };
    }

    cartRef.current = nextCart;
    setCart(nextCart);
    saveCart(nextCart);

    return true;
  }, [saveCart]);

  const removeFromCart = useCallback((productId: number, cartItemKey?: string) => {
    const current = cartRef.current;
    const newItems = current.items.filter((item) => {
      if (cartItemKey) {
        const itemKey = item.cartItemKey || generateCartItemKey(item.productId, item.modifiers);
        if (itemKey === cartItemKey) return false;
        // Also match by productId if the item has no cartItemKey (old data)
        if (!item.cartItemKey && item.productId === productId) return false;
        return true;
      }
      return item.productId !== productId;
    });

    const nextCart: CartState = newItems.length === 0
      ? EMPTY_CART
      : { ...current, items: newItems };

    cartRef.current = nextCart;
    setCart(nextCart);
    saveCart(nextCart);
  }, [saveCart]);

  const updateQuantity = useCallback((productId: number, quantity: number, cartItemKey?: string) => {
    if (quantity <= 0) {
      removeFromCart(productId, cartItemKey);
      return;
    }

    const current = cartRef.current;
    const nextCart: CartState = {
      ...current,
      items: current.items.map((item) => {
        if (cartItemKey) {
          const key = item.cartItemKey || generateCartItemKey(item.productId, item.modifiers);
          if (key === cartItemKey) return { ...item, quantity };
          // Also match by productId if the item has no cartItemKey (old data)
          if (!item.cartItemKey && item.productId === productId) return { ...item, quantity };
          return item;
        }
        return item.productId === productId ? { ...item, quantity } : item;
      }),
    };

    cartRef.current = nextCart;
    setCart(nextCart);
    saveCart(nextCart);
  }, [removeFromCart, saveCart]);

  const clearCart = useCallback(() => {
    cartRef.current = EMPTY_CART;
    setCart(EMPTY_CART);
    saveCart(EMPTY_CART);
  }, [saveCart]);

  const getItemCount = useCallback(() => {
    return cartRef.current.items.reduce((total, item) => total + item.quantity, 0);
  }, []);

  const getCartTotal = useCallback(() => {
    return cartRef.current.items.reduce(
      (total, item) => total + getItemLineTotal(item),
      0
    );
  }, []);

  const getProductQuantity = useCallback((productId: number) => {
    return cartRef.current.items
      .filter(item => item.productId === productId)
      .reduce((total, item) => total + item.quantity, 0);
  }, []);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getItemCount,
        getCartTotal,
        getProductQuantity,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
