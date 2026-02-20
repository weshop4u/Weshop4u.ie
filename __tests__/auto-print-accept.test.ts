import { describe, it, expect } from "vitest";

describe("Auto-print on order accept", () => {
  it("should have autoCreatePrintJob exported from print router", async () => {
    // Verify the function exists and is exported
    const printModule = await import("../server/routers/print");
    expect(typeof printModule.autoCreatePrintJob).toBe("function");
    expect(typeof printModule.formatReceipt).toBe("function");
  });

  it("should import autoCreatePrintJob in store router", async () => {
    const fs = await import("fs");
    const storeContent = fs.readFileSync("server/routers/store.ts", "utf-8");
    
    // Verify the import exists
    expect(storeContent).toContain('import { autoCreatePrintJob } from "./print"');
    
    // Verify it's called in acceptOrder
    expect(storeContent).toContain("autoCreatePrintJob(input.orderId, input.storeId)");
  });

  it("should import autoCreatePrintJob in orders router", async () => {
    const fs = await import("fs");
    const ordersContent = fs.readFileSync("server/routers/orders.ts", "utf-8");
    
    // Verify the import exists
    expect(ordersContent).toContain('import { autoCreatePrintJob } from "./print"');
    
    // Verify it's called when status is accepted or preparing
    expect(ordersContent).toContain('input.status === "accepted" || input.status === "preparing"');
    expect(ordersContent).toContain("autoCreatePrintJob(input.orderId, orderData.storeId)");
  });

  it("should auto-print in admin router when accepting orders", async () => {
    const fs = await import("fs");
    const adminContent = fs.readFileSync("server/routers/admin.ts", "utf-8");
    
    // Verify dynamic import and call exists
    expect(adminContent).toContain('autoCreatePrintJob');
    expect(adminContent).toContain('input.status === "accepted" || input.status === "preparing"');
  });

  it("formatReceipt should produce valid receipt content", async () => {
    const { formatReceipt } = await import("../server/routers/print");
    
    const mockOrder = {
      orderNumber: "WS4U-TEST-001",
      createdAt: new Date("2026-02-20T10:00:00Z"),
      paymentMethod: "cash",
      deliveryAddress: "123 Test Street, Dublin, D01 ABC1",
      customerNotes: "Ring the bell",
      subtotal: "10.00",
      serviceFee: "1.00",
      deliveryFee: "3.50",
      tipAmount: "0",
      total: "14.50",
      customerId: null,
      guestName: "John Test",
    };

    const mockStore = { name: "Spar Balbriggan" };
    
    const mockItems = [
      {
        quantity: 2,
        productName: "Chicken Wings x6",
        subtotal: "8.98",
        productPrice: "4.49",
        notes: null,
      },
      {
        quantity: 1,
        productName: "Coca Cola 500ml",
        subtotal: "1.50",
        productPrice: "1.50",
        notes: "Cold please",
      },
    ];

    const receipt = formatReceipt(mockOrder, mockStore, mockItems, "John Test");
    
    // Check receipt contains key sections
    expect(receipt).toContain("WESHOP4U");
    expect(receipt).toContain("24/7 Delivery Platform");
    expect(receipt).toContain("SPAR BALBRIGGAN");
    expect(receipt).toContain("WS4U-TEST-001");
    expect(receipt).toContain("Cash");
    expect(receipt).toContain("John Test");
    expect(receipt).toContain("123 Test Street");
    expect(receipt).toContain("Ring the bell");
    expect(receipt).toContain("PICK LIST");
    expect(receipt).toContain("Chicken Wings");
    expect(receipt).toContain("Coca Cola");
    expect(receipt).toContain("Cold please");
    expect(receipt).toContain("€14.50");
    expect(receipt).toContain("Thank you!");
  });
});
