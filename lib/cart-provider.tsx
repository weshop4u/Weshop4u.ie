import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface CartItem {
  productId: number;
  productName: string;
  productPrice: string;
  quantity: number;
  image?: string;
}

export interface CartState {
  storeId: number | null;
  storeName: string | null;
  items: CartItem[];
}

interface CartContextType {
  cart: CartState;
  addToCart: (storeId: number, storeName: string, item: CartItem) => Promise<boolean>;
  removeFromCart: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
  getItemCount: () => number;
  getCartTotal: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = "@weshop4u_cart";

const EMPTY_CART: CartState = {
  storeId: null,
  storeName: null,
  items: [],
};

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartState>(EMPTY_CART);

  // Keep a ref that always mirrors the latest cart state
  // This avoids closure/race issues when reading current state in async functions
  const cartRef = useRef<CartState>(EMPTY_CART);

  // Update ref whenever cart state changes - NO other side effects here
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

  // Fire-and-forget save - no state changes, no re-renders
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

    // Compute next state synchronously from the ref
    const existingItemIndex = current.items.findIndex(
      (i) => i.productId === item.productId
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
        items: [...current.items, item],
      };
    }

    // Update ref immediately so subsequent calls see the latest state
    cartRef.current = nextCart;
    // Update React state
    setCart(nextCart);
    // Persist (fire-and-forget, no state changes)
    saveCart(nextCart);

    return true;
  }, [saveCart]);

  const removeFromCart = useCallback((productId: number) => {
    const current = cartRef.current;
    const newItems = current.items.filter((item) => item.productId !== productId);

    const nextCart: CartState = newItems.length === 0
      ? EMPTY_CART
      : { ...current, items: newItems };

    cartRef.current = nextCart;
    setCart(nextCart);
    saveCart(nextCart);
  }, [saveCart]);

  const updateQuantity = useCallback((productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const current = cartRef.current;
    const nextCart: CartState = {
      ...current,
      items: current.items.map((item) =>
        item.productId === productId ? { ...item, quantity } : item
      ),
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
      (total, item) => total + parseFloat(item.productPrice) * item.quantity,
      0
    );
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
