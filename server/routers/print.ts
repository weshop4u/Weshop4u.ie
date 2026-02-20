import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { printJobs, orders, orderItems, stores, users, products, storeStaff } from "../../drizzle/schema";
import { eq, and, desc, inArray } from "drizzle-orm";

// Display the order number from the database (WS4U/SPR/069 format)
function getDisplayOrderNumber(order: any): string {
  // Use the stored orderNumber which is now in WS4U/SPR/069 format
  if (order.orderNumber && order.orderNumber.includes('/')) {
    return order.orderNumber;
  }
  // Fallback for old orders: use last 3 digits of order ID
  const num = order.id % 1000;
  return String(num).padStart(3, '0');
}

// Format receipt content for 58mm thermal printer (32 chars per line)
export function formatReceipt(order: any, store: any, items: any[], customerName: string, customerPhone?: string): string {
  const LINE_WIDTH = 32;
  const lines: string[] = [];

  function center(text: string): string {
    const pad = Math.max(0, Math.floor((LINE_WIDTH - text.length) / 2));
    return " ".repeat(pad) + text;
  }

  function leftRight(left: string, right: string): string {
    const gap = LINE_WIDTH - left.length - right.length;
    if (gap < 1) return left.substring(0, LINE_WIDTH - right.length - 1) + " " + right;
    return left + " ".repeat(gap) + right;
  }

  function divider(char: string = "-"): string {
    return char.repeat(LINE_WIDTH);
  }

  // Header
  lines.push(center("WESHOP4U"));
  lines.push(center("24/7 Delivery Platform"));
  lines.push(divider("="));
  lines.push("");

  // Store name
  lines.push(center(store.name.toUpperCase()));
  lines.push(divider("-"));

  // Order info - use daily sequential number
  const displayOrderNum = getDisplayOrderNumber(order);
  lines.push(leftRight("Order:", displayOrderNum));
  const orderDate = new Date(order.createdAt);
  const dateStr = orderDate.toLocaleDateString("en-IE", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timeStr = orderDate.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" });
  lines.push(leftRight("Date:", dateStr));
  lines.push(leftRight("Time:", timeStr));
  lines.push(leftRight("Payment:", order.paymentMethod === "card" ? "Card" : "Cash"));
  lines.push(divider("-"));

  // Customer info
  lines.push("CUSTOMER:");
  lines.push(customerName);
  if (customerPhone) {
    lines.push("Ph: " + customerPhone);
  }
  lines.push("");
  lines.push("DELIVER TO:");
  // Wrap long addresses
  const addr = order.deliveryAddress || "N/A";
  const addrWords = addr.split(" ");
  let addrLine = "";
  for (const word of addrWords) {
    if ((addrLine + " " + word).trim().length > LINE_WIDTH) {
      lines.push(addrLine.trim());
      addrLine = word;
    } else {
      addrLine = (addrLine + " " + word).trim();
    }
  }
  if (addrLine) lines.push(addrLine.trim());

  if (order.customerNotes) {
    lines.push("");
    lines.push("NOTES:");
    const noteWords = order.customerNotes.split(" ");
    let noteLine = "";
    for (const word of noteWords) {
      if ((noteLine + " " + word).trim().length > LINE_WIDTH) {
        lines.push(noteLine.trim());
        noteLine = word;
      } else {
        noteLine = (noteLine + " " + word).trim();
      }
    }
    if (noteLine) lines.push(noteLine.trim());
  }

  // Substitution preference - important for staff picking items
  lines.push("");
  if (order.allowSubstitution) {
    lines.push(divider("*"));
    lines.push(center("SUBSTITUTIONS ALLOWED"));
    lines.push(center("if item out of stock"));
    lines.push(divider("*"));
  } else {
    lines.push(divider("!"));
    lines.push(center("NO SUBSTITUTIONS"));
    lines.push(divider("!"));
  }

  lines.push(divider("="));

  // Items - PICK LIST format (large, clear)
  lines.push(center("*** PICK LIST ***"));
  lines.push(divider("-"));

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const qty = item.quantity;
    const name = item.productName || item.product?.name || "Item";
    const price = parseFloat(item.subtotal || item.productPrice || "0") * (item.subtotal ? 1 : qty);
    const priceStr = `EUR${price.toFixed(2)}`;

    // Item number and quantity
    lines.push(`${i + 1}. ${qty}x ${name.length > LINE_WIDTH - 8 ? name.substring(0, LINE_WIDTH - 11) + "..." : name}`);
    lines.push(leftRight("", priceStr));

    if (item.notes) {
      lines.push(`   Note: ${item.notes}`);
    }
  }

  lines.push(divider("-"));

  // Totals
  const subtotal = parseFloat(order.subtotal || "0");
  const serviceFee = parseFloat(order.serviceFee || "0");
  const deliveryFee = parseFloat(order.deliveryFee || "0");
  const tipAmount = parseFloat(order.tipAmount || "0");
  const total = parseFloat(order.total || "0");

  lines.push(leftRight("Subtotal:", `EUR${subtotal.toFixed(2)}`));
  lines.push(leftRight("Service Fee:", `EUR${serviceFee.toFixed(2)}`));
  lines.push(leftRight("Delivery Fee:", `EUR${deliveryFee.toFixed(2)}`));
  if (tipAmount > 0) {
    lines.push(leftRight("Driver Tip:", `EUR${tipAmount.toFixed(2)}`));
  }
  lines.push(divider("="));
  lines.push(leftRight("TOTAL:", `EUR${total.toFixed(2)}`));
  lines.push(divider("="));

  // Item count summary
  const totalItems = items.reduce((sum: number, item: any) => sum + item.quantity, 0);
  lines.push(center(`${totalItems} item${totalItems !== 1 ? "s" : ""} in this order`));
  lines.push("");
  lines.push(center("Thank You!"));
  lines.push("");
  lines.push(center("Any problems Ring"));
  lines.push(center("089-4 626262"));
  lines.push("");
  lines.push(center("weshop4u.ie"));
  lines.push("");
  lines.push(""); // Extra blank lines for paper cut
  lines.push("");

  return lines.join("\n");
}

// Helper function to auto-create a print job (called from other routers)
export async function autoCreatePrintJob(orderId: number, storeId: number): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    // Get order
    const orderResult = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.storeId, storeId)))
      .limit(1);

    if (orderResult.length === 0) return;
    const order = orderResult[0];

    // Get store
    const storeResult = await db
      .select()
      .from(stores)
      .where(eq(stores.id, storeId))
      .limit(1);

    if (storeResult.length === 0) return;

    // Get items
    const items = await db
      .select({
        id: orderItems.id,
        orderId: orderItems.orderId,
        productId: orderItems.productId,
        productName: orderItems.productName,
        productPrice: orderItems.productPrice,
        quantity: orderItems.quantity,
        subtotal: orderItems.subtotal,
        notes: orderItems.notes,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    // Get customer name and phone
    let customerName = "Guest";
    let customerPhone = "";
    if (order.customerId) {
      const customer = await db
        .select({ name: users.name, phone: users.phone })
        .from(users)
        .where(eq(users.id, order.customerId))
        .limit(1);
      if (customer.length > 0) {
        customerName = customer[0].name;
        customerPhone = customer[0].phone || "";
      }
    } else {
      if (order.guestName) customerName = order.guestName;
      if (order.guestPhone) customerPhone = order.guestPhone;
    }

    // Format and create print job
    const receiptContent = formatReceipt(order, storeResult[0], items, customerName, customerPhone);
    await db.insert(printJobs).values({
      storeId,
      orderId,
      status: "pending",
      receiptContent,
    });

    console.log(`[AutoPrint] Created print job for order ${order.orderNumber} at store ${storeId}`);
  } catch (error) {
    console.error(`[AutoPrint] Failed to create print job for order ${orderId}:`, error);
  }
}

export const printRouter = router({
  // Create a print job for an order
  createPrintJob: publicProcedure
    .input(z.object({
      orderId: z.number(),
      storeId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get order with items
      const orderResult = await db
        .select()
        .from(orders)
        .where(and(eq(orders.id, input.orderId), eq(orders.storeId, input.storeId)))
        .limit(1);

      if (orderResult.length === 0) {
        throw new Error("Order not found");
      }

      const order = orderResult[0];

      // Get store info
      const storeResult = await db
        .select()
        .from(stores)
        .where(eq(stores.id, input.storeId))
        .limit(1);

      if (storeResult.length === 0) {
        throw new Error("Store not found");
      }

      // Get order items
      const items = await db
        .select({
          id: orderItems.id,
          orderId: orderItems.orderId,
          productId: orderItems.productId,
          productName: orderItems.productName,
          productPrice: orderItems.productPrice,
          quantity: orderItems.quantity,
          subtotal: orderItems.subtotal,
          notes: orderItems.notes,
        })
        .from(orderItems)
        .where(eq(orderItems.orderId, input.orderId));

      // Get customer name and phone
      let customerName = "Guest";
      let customerPhone = "";
      if (order.customerId) {
        const customer = await db
          .select({ name: users.name, phone: users.phone })
          .from(users)
          .where(eq(users.id, order.customerId))
          .limit(1);
        if (customer.length > 0) {
          customerName = customer[0].name;
          customerPhone = customer[0].phone || "";
        }
      } else {
        if (order.guestName) customerName = order.guestName;
        if (order.guestPhone) customerPhone = order.guestPhone;
      }

      // Format receipt
      const receiptContent = formatReceipt(order, storeResult[0], items, customerName, customerPhone);

      // Create print job
      const [result] = await db.insert(printJobs).values({
        storeId: input.storeId,
        orderId: input.orderId,
        status: "pending",
        receiptContent,
      });

      return {
        printJobId: result.insertId,
        receiptContent,
      };
    }),

  // Poll for pending print jobs (POS device calls this)
  getPendingJobs: publicProcedure
    .input(z.object({
      storeId: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const pendingJobs = await db
        .select()
        .from(printJobs)
        .where(and(
          eq(printJobs.storeId, input.storeId),
          eq(printJobs.status, "pending")
        ))
        .orderBy(printJobs.createdAt);

      return pendingJobs;
    }),

  // Mark a print job as printed
  markPrinted: publicProcedure
    .input(z.object({
      printJobId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(printJobs)
        .set({
          status: "printed",
          printedAt: new Date(),
        })
        .where(eq(printJobs.id, input.printJobId));

      return { success: true };
    }),

  // Mark a print job as failed
  markFailed: publicProcedure
    .input(z.object({
      printJobId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(printJobs)
        .set({ status: "failed" })
        .where(eq(printJobs.id, input.printJobId));

      return { success: true };
    }),

  // Get print history for a store
  getHistory: publicProcedure
    .input(z.object({
      storeId: z.number(),
      limit: z.number().optional().default(50),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const history = await db
        .select({
          id: printJobs.id,
          orderId: printJobs.orderId,
          status: printJobs.status,
          printedAt: printJobs.printedAt,
          createdAt: printJobs.createdAt,
          orderNumber: orders.orderNumber,
        })
        .from(printJobs)
        .leftJoin(orders, eq(printJobs.orderId, orders.id))
        .where(eq(printJobs.storeId, input.storeId))
        .orderBy(desc(printJobs.createdAt))
        .limit(input.limit);

      return history;
    }),

  // Get receipt content for an order (for local/direct printing)
  getReceipt: publicProcedure
    .input(z.object({
      orderId: z.number(),
      storeId: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Get order
      const orderResult = await db
        .select()
        .from(orders)
        .where(and(eq(orders.id, input.orderId), eq(orders.storeId, input.storeId)))
        .limit(1);

      if (orderResult.length === 0) {
        throw new Error("Order not found");
      }

      const order = orderResult[0];

      // Get store
      const storeResult = await db
        .select()
        .from(stores)
        .where(eq(stores.id, input.storeId))
        .limit(1);

      // Get items
      const items = await db
        .select({
          id: orderItems.id,
          orderId: orderItems.orderId,
          productId: orderItems.productId,
          productName: orderItems.productName,
          productPrice: orderItems.productPrice,
          quantity: orderItems.quantity,
          subtotal: orderItems.subtotal,
          notes: orderItems.notes,
        })
        .from(orderItems)
        .where(eq(orderItems.orderId, input.orderId));

      // Get customer name and phone
      let customerName = "Guest";
      let customerPhone = "";
      if (order.customerId) {
        const customer = await db
          .select({ name: users.name, phone: users.phone })
          .from(users)
          .where(eq(users.id, order.customerId))
          .limit(1);
        if (customer.length > 0) {
          customerName = customer[0].name;
          customerPhone = customer[0].phone || "";
        }
      } else {
        if (order.guestName) customerName = order.guestName;
        if (order.guestPhone) customerPhone = order.guestPhone;
      }

      const receiptContent = formatReceipt(order, storeResult[0], items, customerName, customerPhone);

      return {
        receiptContent,
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          total: order.total,
          itemCount: items.length,
          totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
        },
      };
    }),

  // Update store print settings
  updatePrintSettings: publicProcedure
    .input(z.object({
      storeId: z.number(),
      autoPrintEnabled: z.boolean(),
      autoPrintThreshold: z.number().min(1).max(100),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(stores)
        .set({
          autoPrintEnabled: input.autoPrintEnabled,
          autoPrintThreshold: input.autoPrintThreshold,
        })
        .where(eq(stores.id, input.storeId));

      return { success: true };
    }),

  // Get store print settings
  getPrintSettings: publicProcedure
    .input(z.object({
      storeId: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const storeResult = await db
        .select({
          autoPrintEnabled: stores.autoPrintEnabled,
          autoPrintThreshold: stores.autoPrintThreshold,
        })
        .from(stores)
        .where(eq(stores.id, input.storeId))
        .limit(1);

      if (storeResult.length === 0) {
        throw new Error("Store not found");
      }

      return storeResult[0];
    }),
});
