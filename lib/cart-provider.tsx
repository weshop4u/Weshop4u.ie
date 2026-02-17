import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
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

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartState>({
    storeId: null,
    storeName: null,
    items: [],
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const isSavingRef = useRef(false);

  // Load cart from storage on mount
  useEffect(() => {
    loadCart();
  }, []);

  // Save cart to storage whenever it changes (but not on initial load)
  // Use a ref to prevent infinite loops during rapid state changes
  useEffect(() => {
    if (isInitialized && !isSavingRef.current) {
      isSavingRef.current = true;
      saveCart().finally(() => {
        isSavingRef.current = false;
      });
    }
  }, [cart, isInitialized]);

  const loadCart = async () => {
    try {
      const cartData = await AsyncStorage.getItem(CART_STORAGE_KEY);
      if (cartData) {
        setCart(JSON.parse(cartData));
      }
    } catch (error) {
      console.error("Failed to load cart:", error);
    } finally {
      // Mark as initialized after first load
      setIsInitialized(true);
    }
  };

  const saveCart = async () => {
    try {
      await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch (error) {
      console.error("Failed to save cart:", error);
    }
  };

  const addToCart = async (
    storeId: number,
    storeName: string,
    item: CartItem
  ): Promise<boolean> => {
    // Check if adding from different store
    if (cart.storeId !== null && cart.storeId !== storeId) {
      // Return false to trigger confirmation dialog
      return false;
    }

    setCart((prev) => {
      // Check if item already exists
      const existingItemIndex = prev.items.findIndex(
        (i) => i.productId === item.productId
      );

      if (existingItemIndex >= 0) {
        // Update quantity
        const newItems = [...prev.items];
        newItems[existingItemIndex].quantity += item.quantity;
        return {
          ...prev,
          items: newItems,
        };
      } else {
        // Add new item
        return {
          storeId,
          storeName,
          items: [...prev.items, item],
        };
      }
    });

    return true;
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => {
      const newItems = prev.items.filter((item) => item.productId !== productId);
      
      // If cart is empty, reset store info
      if (newItems.length === 0) {
        return {
          storeId: null,
          storeName: null,
          items: [],
        };
      }

      return {
        ...prev,
        items: newItems,
      };
    });
  };

  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.productId === productId ? { ...item, quantity } : item
      ),
    }));
  };

  const clearCart = () => {
    setCart({
      storeId: null,
      storeName: null,
      items: [],
    });
  };

  const getItemCount = () => {
    return cart.items.reduce((total, item) => total + item.quantity, 0);
  };

  const getCartTotal = () => {
    return cart.items.reduce(
      (total, item) => total + parseFloat(item.productPrice) * item.quantity,
      0
    );
  };

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
