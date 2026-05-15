import { describe, it, expect } from "vitest";

// ===== Discount Code Types =====
interface DiscountCode {
  id: number;
  code: string;
  description: string | null;
  discountType: "percentage" | "fixed_amount" | "free_delivery";
  discountValue: string;
  minOrderValue: string;
  maxDiscountAmount: string | null;
  storeId: number | null;
  maxUsesTotal: number | null;
  maxUsesPerCustomer: number;
  currentUsesTotal: number;
  startsAt: Date | null;
  expiresAt: Date | null;
  isActive: boolean;
}

// ===== Validation Logic (mirrors server/routers/discounts.ts) =====
function validateDiscountCode(
  code: DiscountCode,
  input: { storeId: number; orderTotal: number; customerId: number; customerUsageCount: number }
): { valid: boolean; error?: string; discountAmount?: number; isFreeDelivery?: boolean } {
  if (!code.isActive) {
    return { valid: false, error: "This discount code is no longer active" };
  }

  // Check store restriction
  if (code.storeId && code.storeId !== input.storeId) {
    return { valid: false, error: "This code is not valid for this store" };
  }

  // Check validity period
  const now = new Date();
  if (code.startsAt && now < code.startsAt) {
    return { valid: false, error: "This discount code is not active yet" };
  }
  if (code.expiresAt && now > code.expiresAt) {
    return { valid: false, error: "This discount code has expired" };
  }

  // Check total usage limit
  if (code.maxUsesTotal && code.currentUsesTotal >= code.maxUsesTotal) {
    return { valid: false, error: "This discount code has reached its usage limit" };
  }

  // Check per-customer usage limit
  if (code.maxUsesPerCustomer && input.customerUsageCount >= code.maxUsesPerCustomer) {
    return { valid: false, error: "You've already used this discount code" };
  }

  // Check minimum order value
  const minOrder = parseFloat(code.minOrderValue) || 0;
  if (input.orderTotal < minOrder) {
    return { valid: false, error: `Minimum order of €${minOrder.toFixed(2)} required for this code` };
  }

  // Calculate discount amount
  let discountAmount = 0;
  const discountValue = parseFloat(code.discountValue) || 0;
  const maxDiscount = code.maxDiscountAmount ? parseFloat(code.maxDiscountAmount) : null;

  switch (code.discountType) {
    case "percentage":
      discountAmount = (input.orderTotal * discountValue) / 100;
      if (maxDiscount && discountAmount > maxDiscount) {
        discountAmount = maxDiscount;
      }
      break;
    case "fixed_amount":
      discountAmount = Math.min(discountValue, input.orderTotal);
      break;
    case "free_delivery":
      discountAmount = 0;
      break;
  }

  return {
    valid: true,
    discountAmount: Math.round(discountAmount * 100) / 100,
    isFreeDelivery: code.discountType === "free_delivery",
  };
}

// ===== Total Calculation (mirrors cart page) =====
function calculateTotal(
  subtotal: number,
  serviceFee: number,
  deliveryFee: number,
  tipAmount: number,
  discountAmount: number,
  isFreeDelivery: boolean
): number {
  const effectiveDeliveryFee = isFreeDelivery ? 0 : deliveryFee;
  return Math.max(0, Math.round((subtotal + serviceFee + effectiveDeliveryFee + tipAmount - discountAmount) * 100) / 100);
}

// ===== Test Data =====
const mockCodes: DiscountCode[] = [
  {
    id: 1,
    code: "WELCOME10",
    description: "10% off your first order",
    discountType: "percentage",
    discountValue: "10",
    minOrderValue: "0",
    maxDiscountAmount: null,
    storeId: null,
    maxUsesTotal: null,
    maxUsesPerCustomer: 1,
    currentUsesTotal: 0,
    startsAt: null,
    expiresAt: null,
    isActive: true,
  },
  {
    id: 2,
    code: "FREEDELIVERY",
    description: "Free delivery on any order",
    discountType: "free_delivery",
    discountValue: "0",
    minOrderValue: "15",
    maxDiscountAmount: null,
    storeId: null,
    maxUsesTotal: 100,
    maxUsesPerCustomer: 1,
    currentUsesTotal: 50,
    startsAt: null,
    expiresAt: null,
    isActive: true,
  },
  {
    id: 3,
    code: "FLASH5",
    description: "€5 off flash sale",
    discountType: "fixed_amount",
    discountValue: "5",
    minOrderValue: "20",
    maxDiscountAmount: null,
    storeId: 1, // Spar only
    maxUsesTotal: 50,
    maxUsesPerCustomer: 1,
    currentUsesTotal: 50, // maxed out
    startsAt: null,
    expiresAt: null,
    isActive: true,
  },
  {
    id: 4,
    code: "EXPIRED20",
    description: "Expired code",
    discountType: "percentage",
    discountValue: "20",
    minOrderValue: "0",
    maxDiscountAmount: "10",
    storeId: null,
    maxUsesTotal: null,
    maxUsesPerCustomer: 1,
    currentUsesTotal: 0,
    startsAt: null,
    expiresAt: new Date("2025-01-01"),
    isActive: true,
  },
  {
    id: 5,
    code: "DISABLED",
    description: "Disabled code",
    discountType: "percentage",
    discountValue: "15",
    minOrderValue: "0",
    maxDiscountAmount: null,
    storeId: null,
    maxUsesTotal: null,
    maxUsesPerCustomer: 1,
    currentUsesTotal: 0,
    startsAt: null,
    expiresAt: null,
    isActive: false,
  },
  {
    id: 6,
    code: "FUTURE50",
    description: "Future scheduled code",
    discountType: "percentage",
    discountValue: "50",
    minOrderValue: "0",
    maxDiscountAmount: null,
    storeId: null,
    maxUsesTotal: null,
    maxUsesPerCustomer: 1,
    currentUsesTotal: 0,
    startsAt: new Date("2030-01-01"),
    expiresAt: null,
    isActive: true,
  },
  {
    id: 7,
    code: "CAPPED20",
    description: "20% off capped at €8",
    discountType: "percentage",
    discountValue: "20",
    minOrderValue: "10",
    maxDiscountAmount: "8",
    storeId: null,
    maxUsesTotal: null,
    maxUsesPerCustomer: 3,
    currentUsesTotal: 0,
    startsAt: null,
    expiresAt: null,
    isActive: true,
  },
];

describe("Discount Code Validation", () => {
  it("should validate a valid percentage discount code", () => {
    const result = validateDiscountCode(mockCodes[0], {
      storeId: 1,
      orderTotal: 50,
      customerId: 1,
      customerUsageCount: 0,
    });
    expect(result.valid).toBe(true);
    expect(result.discountAmount).toBe(5); // 10% of €50
  });

  it("should validate a free delivery code", () => {
    const result = validateDiscountCode(mockCodes[1], {
      storeId: 1,
      orderTotal: 25,
      customerId: 1,
      customerUsageCount: 0,
    });
    expect(result.valid).toBe(true);
    expect(result.isFreeDelivery).toBe(true);
    expect(result.discountAmount).toBe(0);
  });

  it("should reject a disabled code", () => {
    const result = validateDiscountCode(mockCodes[4], {
      storeId: 1,
      orderTotal: 50,
      customerId: 1,
      customerUsageCount: 0,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("no longer active");
  });

  it("should reject an expired code", () => {
    const result = validateDiscountCode(mockCodes[3], {
      storeId: 1,
      orderTotal: 50,
      customerId: 1,
      customerUsageCount: 0,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("expired");
  });

  it("should reject a future-scheduled code", () => {
    const result = validateDiscountCode(mockCodes[5], {
      storeId: 1,
      orderTotal: 50,
      customerId: 1,
      customerUsageCount: 0,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("not active yet");
  });

  it("should reject when total usage limit reached", () => {
    const result = validateDiscountCode(mockCodes[2], {
      storeId: 1,
      orderTotal: 30,
      customerId: 1,
      customerUsageCount: 0,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("usage limit");
  });

  it("should reject when per-customer usage limit reached", () => {
    const result = validateDiscountCode(mockCodes[0], {
      storeId: 1,
      orderTotal: 50,
      customerId: 1,
      customerUsageCount: 1, // already used once, limit is 1
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("already used");
  });

  it("should reject when order is below minimum", () => {
    const result = validateDiscountCode(mockCodes[1], {
      storeId: 1,
      orderTotal: 10, // min is €15
      customerId: 1,
      customerUsageCount: 0,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Minimum order");
  });

  it("should reject store-specific code for wrong store", () => {
    const result = validateDiscountCode(mockCodes[2], {
      storeId: 3, // code is for store 1
      orderTotal: 30,
      customerId: 1,
      customerUsageCount: 0,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("not valid for this store");
  });

  it("should cap percentage discount at maxDiscountAmount", () => {
    const result = validateDiscountCode(mockCodes[6], {
      storeId: 1,
      orderTotal: 100, // 20% = €20, but capped at €8
      customerId: 1,
      customerUsageCount: 0,
    });
    expect(result.valid).toBe(true);
    expect(result.discountAmount).toBe(8);
  });

  it("should allow multiple uses per customer when limit is higher", () => {
    const result = validateDiscountCode(mockCodes[6], {
      storeId: 1,
      orderTotal: 50,
      customerId: 1,
      customerUsageCount: 2, // limit is 3
    });
    expect(result.valid).toBe(true);
    expect(result.discountAmount).toBe(8); // 20% of 50 = 10, capped at 8
  });

  it("should not allow fixed_amount discount to exceed order total", () => {
    // Create a code with €50 off
    const bigFixedCode: DiscountCode = {
      ...mockCodes[2],
      discountValue: "50",
      currentUsesTotal: 0,
      storeId: null,
      minOrderValue: "0",
    };
    const result = validateDiscountCode(bigFixedCode, {
      storeId: 1,
      orderTotal: 20,
      customerId: 1,
      customerUsageCount: 0,
    });
    expect(result.valid).toBe(true);
    expect(result.discountAmount).toBe(20); // capped at order total
  });
});

describe("Total Calculation with Discounts", () => {
  it("should subtract percentage discount from total", () => {
    const total = calculateTotal(50, 5, 3.50, 0, 5, false);
    // 50 + 5 + 3.50 + 0 - 5 = 53.50
    expect(total).toBe(53.5);
  });

  it("should make delivery free with free_delivery code", () => {
    const total = calculateTotal(50, 5, 3.50, 0, 0, true);
    // 50 + 5 + 0 + 0 - 0 = 55
    expect(total).toBe(55);
  });

  it("should handle both discount amount and free delivery", () => {
    // If a code gives both free delivery AND a discount amount
    const total = calculateTotal(50, 5, 3.50, 0, 5, true);
    // 50 + 5 + 0 + 0 - 5 = 50
    expect(total).toBe(50);
  });

  it("should include tip in total", () => {
    const total = calculateTotal(50, 5, 3.50, 2, 5, false);
    // 50 + 5 + 3.50 + 2 - 5 = 55.50
    expect(total).toBe(55.5);
  });

  it("should never go below zero", () => {
    const total = calculateTotal(10, 1, 2, 0, 100, false);
    // 10 + 1 + 2 + 0 - 100 = -87 → capped at 0
    expect(total).toBe(0);
  });

  it("should round to 2 decimal places", () => {
    const total = calculateTotal(33.33, 3.333, 2.50, 0, 1.11, false);
    // 33.33 + 3.333 + 2.50 - 1.11 = 38.053 → rounded
    expect(total).toBe(38.05);
  });
});

describe("Discount Code Formatting", () => {
  it("should format percentage discount label correctly", () => {
    const code = mockCodes[0];
    const label = code.discountType === "percentage"
      ? `${parseFloat(code.discountValue)}% off`
      : code.discountType === "free_delivery"
        ? "Free Delivery"
        : `€${parseFloat(code.discountValue).toFixed(2)} off`;
    expect(label).toBe("10% off");
  });

  it("should format fixed amount discount label correctly", () => {
    const code = mockCodes[2];
    const label = code.discountType === "percentage"
      ? `${parseFloat(code.discountValue)}% off`
      : code.discountType === "free_delivery"
        ? "Free Delivery"
        : `€${parseFloat(code.discountValue).toFixed(2)} off`;
    expect(label).toBe("€5.00 off");
  });

  it("should format free delivery discount label correctly", () => {
    const code = mockCodes[1];
    const label = code.discountType === "percentage"
      ? `${parseFloat(code.discountValue)}% off`
      : code.discountType === "free_delivery"
        ? "Free Delivery"
        : `€${parseFloat(code.discountValue).toFixed(2)} off`;
    expect(label).toBe("Free Delivery");
  });

  it("should uppercase discount codes", () => {
    const input = "welcome10";
    const formatted = input.toUpperCase().replace(/\s/g, "");
    expect(formatted).toBe("WELCOME10");
  });

  it("should strip spaces from discount codes", () => {
    const input = "FLASH 5";
    const formatted = input.toUpperCase().replace(/\s/g, "");
    expect(formatted).toBe("FLASH5");
  });
});

describe("Discount Code Status Detection", () => {
  it("should detect expired codes", () => {
    const code = mockCodes[3];
    const isExpired = code.expiresAt ? new Date(code.expiresAt) < new Date() : false;
    expect(isExpired).toBe(true);
  });

  it("should detect not-yet-started codes", () => {
    const code = mockCodes[5];
    const isNotStarted = code.startsAt ? new Date(code.startsAt) > new Date() : false;
    expect(isNotStarted).toBe(true);
  });

  it("should detect active codes with no time restrictions", () => {
    const code = mockCodes[0];
    const isExpired = code.expiresAt ? new Date(code.expiresAt) < new Date() : false;
    const isNotStarted = code.startsAt ? new Date(code.startsAt) > new Date() : false;
    expect(isExpired).toBe(false);
    expect(isNotStarted).toBe(false);
    expect(code.isActive).toBe(true);
  });

  it("should detect maxed-out usage codes", () => {
    const code = mockCodes[2];
    const isMaxedOut = code.maxUsesTotal !== null && code.currentUsesTotal >= code.maxUsesTotal;
    expect(isMaxedOut).toBe(true);
  });
});
