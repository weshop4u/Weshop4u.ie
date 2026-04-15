/**
 * Receipt Calculator Service
 * Handles calculation of dual receipts (customer vs store) for WSS orders
 */

export interface ReceiptItem {
  id: number;
  quantity: number;
  productName: string;
  subtotal: string;
  notes?: string;
  isWss: boolean;
  modifiers?: Array<{
    groupName: string;
    modifierName: string;
    modifierPrice: string;
  }>;
}

export interface Receipt {
  items: ReceiptItem[];
  subtotal: number;
  serviceFee: number;
  deliveryFee: number;
  total: number;
}

export interface ReceiptData {
  customerReceipt: Receipt;
  storeReceipt: Receipt;
  hasWssItems: boolean;
}

/**
 * Calculate dual receipts for an order
 * @param items - All order items with WSS flag
 * @param subtotal - Total subtotal of all items
 * @param serviceFee - Service fee for all items
 * @param deliveryFee - Delivery fee
 * @returns Receipt data with both customer and store receipts
 */
export function calculateDualReceipts(
  items: ReceiptItem[],
  subtotal: number,
  serviceFee: number,
  deliveryFee: number
): ReceiptData {
  // Check if order has any WSS items
  const hasWssItems = items.some(item => item.isWss);

  // If no WSS items, both receipts are identical
  if (!hasWssItems) {
    const receipt: Receipt = {
      items,
      subtotal,
      serviceFee,
      deliveryFee,
      total: subtotal + serviceFee + deliveryFee,
    };
    return {
      customerReceipt: receipt,
      storeReceipt: receipt,
      hasWssItems: false,
    };
  }

  // Calculate store receipt (excluding WSS items)
  const storeItems = items.filter(item => !item.isWss);
  const storeSubtotal = storeItems.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);

  // Calculate proportional fees for store receipt
  const itemRatio = storeSubtotal / subtotal;
  const storeServiceFee = Math.round(serviceFee * itemRatio * 100) / 100;
  const storeDeliveryFee = Math.round(deliveryFee * itemRatio * 100) / 100;
  const storeTotal = storeSubtotal + storeServiceFee + storeDeliveryFee;

  // Customer receipt includes all items with full fees
  const customerReceipt: Receipt = {
    items,
    subtotal,
    serviceFee,
    deliveryFee,
    total: subtotal + serviceFee + deliveryFee,
  };

  // Store receipt excludes WSS items
  const storeReceipt: Receipt = {
    items: storeItems,
    subtotal: storeSubtotal,
    serviceFee: storeServiceFee,
    deliveryFee: storeDeliveryFee,
    total: storeTotal,
  };

  return {
    customerReceipt,
    storeReceipt,
    hasWssItems: true,
  };
}

/**
 * Get the appropriate receipt based on viewer type
 * @param receiptData - Receipt data containing both versions
 * @param viewerType - Type of viewer: 'customer', 'store', 'driver', or 'admin'
 * @returns The appropriate receipt for the viewer
 */
export function getReceiptForViewer(
  receiptData: ReceiptData,
  viewerType: 'customer' | 'store' | 'driver' | 'admin'
): Receipt {
  switch (viewerType) {
    case 'customer':
      return receiptData.customerReceipt;
    case 'store':
    case 'driver':
      return receiptData.storeReceipt;
    case 'admin':
      // Admin can see both, but return customer receipt as default
      return receiptData.customerReceipt;
    default:
      return receiptData.customerReceipt;
  }
}
