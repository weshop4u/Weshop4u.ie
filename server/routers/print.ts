import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { printJobs, orders, orderItems, stores, users, products, storeStaff, orderItemModifiers } from "../../drizzle/schema";
import { eq, and, desc, inArray, gte, lt } from "drizzle-orm";
import { formatIrishTime, formatIrishDateShort } from "../lib/timezone";
import { fetchItemModifiers } from "../lib/fetch-item-modifiers";

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

// Modifiers for a statement line: receiptData items carry their own,
// DB items are looked up by order_item id
function itemModifiers(item: any, itemMods?: Record<number, { groupName: string; modifierName: string; modifierPrice: string }[]>): { modifierName: string; modifierPrice: string }[] {
  return (itemMods?.[item.id] || item.modifiers || []) as any[];
}

// Format receipt content for 58mm thermal printer (32 chars per line)
export function formatReceipt(order: any, store: any, items: any[], customerName: string, customerPhone?: string, itemModifiers?: Record<number, { groupName: string; modifierName: string; modifierPrice: string }[]>, receiptData?: any, options?: { hideTime?: boolean }): string {
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

  function wrapText(text: string, maxWidth: number): string[] {
    const lines: string[] = [];
    let remaining = text;
    
    while (remaining.length > 0) {
      if (remaining.length <= maxWidth) {
        lines.push(remaining);
        break;
      }
      
      // Find last space within maxWidth
      let breakPoint = maxWidth;
      const lastSpace = remaining.lastIndexOf(' ', maxWidth);
      if (lastSpace > 0) {
        breakPoint = lastSpace;
      }
      
      lines.push(remaining.substring(0, breakPoint).trim());
      remaining = remaining.substring(breakPoint).trim();
    }
    
    return lines;
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
  const dateStr = formatIrishDateShort(order.createdAt);
  const timeStr = formatIrishTime(order.createdAt);
  lines.push(leftRight("Date:", dateStr));
  if (!options?.hideTime) lines.push(leftRight("Time:", timeStr));
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

    // Item number and quantity - wrap long names word by word
    const prefix = `${i + 1}. ${qty}x `;
    const nameWords = name.split(' ');
    let nameLine = prefix;
    let firstLine = true;
    for (const word of nameWords) {
      if ((nameLine + word).length > LINE_WIDTH) {
        lines.push(nameLine.trimEnd());
        nameLine = firstLine ? ' '.repeat(prefix.length) + word + ' ' : ' '.repeat(prefix.length) + word + ' ';
        firstLine = false;
      } else {
        nameLine += word + ' ';
      }
    }
    if (nameLine.trim()) lines.push(nameLine.trimEnd());
    lines.push(leftRight("", priceStr));

    // Show modifiers/add-ons for this item
    const mods = itemModifiers?.[item.id] || item.modifiers || [];
    if (mods.length > 0) {
      // Group modifiers by group name
      const grouped: Record<string, { name: string; price: string }[]> = {};
      for (const m of mods) {
        if (!grouped[m.groupName]) grouped[m.groupName] = [];
        grouped[m.groupName].push({ name: m.modifierName, price: m.modifierPrice });
      }
      for (const [groupName, options] of Object.entries(grouped)) {
        lines.push(`   ${groupName}:`);
        // Group duplicate options (e.g. Sausage ×3)
        const deduped: { name: string; price: string; count: number }[] = [];
        for (const opt of options) {
          const cleanName = opt.name.replace(/ ×\d+$/, '');
          const existing = deduped.find(d => d.name === cleanName && d.price === opt.price);
          if (existing) { existing.count++; } else { deduped.push({ name: cleanName, price: opt.price, count: 1 }); }
        }
        for (const opt of deduped) {
          const extraPrice = parseFloat(opt.price) * opt.count;
          const extraStr = extraPrice > 0 ? ` +EUR${extraPrice.toFixed(2)}` : "";
          const qtyStr = opt.count > 1 ? ` ×${opt.count}` : "";
          lines.push(`    - ${opt.name}${qtyStr}${extraStr}`);
        }
      }
    }

    if (item.notes) {
      lines.push(`   Note: ${item.notes}`);
    }
  }

  lines.push(divider("-"));

  // Totals - use store receipt totals if available, otherwise use order totals
  let subtotal: number;
  let serviceFee: number;
  let deliveryFee: number;
  let total: number;
  
  if (receiptData && receiptData.storeReceipt) {
    subtotal = receiptData.storeReceipt.subtotal;
    serviceFee = receiptData.storeReceipt.serviceFee;
    deliveryFee = receiptData.storeReceipt.deliveryFee;
    total = receiptData.storeReceipt.total;
  } else {
    subtotal = parseFloat(order.subtotal || "0");
    serviceFee = parseFloat(order.serviceFee || "0");
    deliveryFee = parseFloat(order.deliveryFee || "0");
    total = parseFloat(order.total || "0");
  }
  
  const tipAmount = parseFloat(order.tipAmount || "0");
  const discountAmount = parseFloat(order.discountAmount || "0");

  lines.push(leftRight("Subtotal:", `EUR${subtotal.toFixed(2)}`));
  lines.push(leftRight("Service Fee:", `EUR${serviceFee.toFixed(2)}`));
  lines.push(leftRight("Delivery Fee:", `EUR${deliveryFee.toFixed(2)}`));
  if (tipAmount > 0) {
    lines.push(leftRight("Driver Tip:", `EUR${tipAmount.toFixed(2)}`));
  }
  if (discountAmount > 0) {
    lines.push(leftRight("Discount:", `-EUR${discountAmount.toFixed(2)}`));
  }
  lines.push(divider("="));
  lines.push(leftRight("TOTAL:", `EUR${(total - discountAmount).toFixed(2)}`));
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
export async function autoCreatePrintJob(orderId: number, storeId: number, receiptDataParam?: string): Promise<void> {
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

    // Get items - use store receipt from receiptData to exclude WSS items
    let items: any[] = [];
    let receiptDataObj: any = null;
    
    // Use passed receiptDataParam if provided (to avoid race conditions)
    let receiptDataStr = receiptDataParam || order.receiptData;
    console.log(`[AutoPrint] Order ${order.orderNumber}: receiptData exists? ${!!receiptDataStr}, fromParam? ${!!receiptDataParam}`);
    
    // If receiptData not available from param, retry fetching from DB (handle replication lag)
    if (!receiptDataStr && !receiptDataParam) {
      console.log(`[AutoPrint] Order ${order.orderNumber}: receiptData missing, retrying...`);
      for (let attempt = 1; attempt <= 3; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 200 * attempt));
        const freshOrder = await db
          .select({ receiptData: orders.receiptData })
          .from(orders)
          .where(eq(orders.id, orderId))
          .limit(1);
        if (freshOrder.length > 0 && freshOrder[0].receiptData) {
          receiptDataStr = freshOrder[0].receiptData;
          console.log(`[AutoPrint] Order ${order.orderNumber}: receiptData found on attempt ${attempt}`);
          break;
        }
      }
    }
    
    if (receiptDataStr) {
      try {
        receiptDataObj = JSON.parse(receiptDataStr);
        console.log(`[AutoPrint] Order ${order.orderNumber}: hasWssItems=${receiptDataObj.hasWssItems}, storeItems=${receiptDataObj.storeReceipt?.items?.length || 0}`);
        console.log(`[AutoPrint] Store receipt items:`, JSON.stringify(receiptDataObj.storeReceipt?.items, null, 2));
        items = receiptDataObj.storeReceipt.items;
      } catch (e) {
        console.warn(`[AutoPrint] Order ${order.orderNumber}: Failed to parse receiptData, falling back to all items`, e);
        // Fallback: get all items from database
        items = await db
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
      }
    } else {
      // Old orders without receiptData - get all items and filter out WSS
      console.log(`[AutoPrint] Order ${order.orderNumber}: No receiptData, fetching items from database`);
      const allItems = await db
        .select({
          id: orderItems.id,
          orderId: orderItems.orderId,
          productId: orderItems.productId,
          productName: orderItems.productName,
          productPrice: orderItems.productPrice,
          quantity: orderItems.quantity,
          subtotal: orderItems.subtotal,
          notes: orderItems.notes,
          isWss: products.isWss,
        })
        .from(orderItems)
        .leftJoin(products, eq(orderItems.productId, products.id))
        .where(eq(orderItems.orderId, orderId));
      items = allItems.filter(item => !item.isWss);
    }

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

    // Check if a pending print job already exists for this order (prevent duplicates)
    const existingJob = await db
      .select({ id: printJobs.id })
      .from(printJobs)
      .where(and(
        eq(printJobs.orderId, orderId),
        eq(printJobs.storeId, storeId),
        eq(printJobs.status, "pending")
      ))
      .limit(1);
    if (existingJob.length > 0) {
      console.log(`[AutoPrint] Pending print job already exists for order ${order.orderNumber} — skipping duplicate`);
      return;
    }
    // Fetch modifiers ONLY for DB-sourced items. Items from receiptData carry
    // their own embedded modifiers, and their `id` is the PRODUCT id, not the
    // order_item id — passing product ids to fetchItemModifiers can collide
    // with unrelated order_item ids and print ghost modifiers from other
    // orders (the "Red Bull Syrup" bug).
    const itemMods = receiptDataObj ? undefined : await fetchItemModifiers(items.map(i => i.id));
    // receiptDataObj is already parsed above, use it directly
    // Format and create print job with receiptData
    const receiptContent = formatReceipt(order, storeResult[0], items, customerName, customerPhone, itemMods, receiptDataObj);
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

      // Get order items - use store receipt from receiptData to exclude WSS items
      let items: any[] = [];
      console.log(`[createPrintJob] Order ${input.orderId}: receiptData exists? ${!!order.receiptData}`);
      if (order.receiptData) {
        try {
          const receiptData = JSON.parse(order.receiptData);
          items = receiptData.storeReceipt.items;
        } catch (e) {
          console.warn(`[Print] Failed to parse receiptData for order ${input.orderId}, falling back to filtered items`);
          // Fallback: get all items from database and filter out WSS
          const allItems = await db
            .select({
              id: orderItems.id,
              orderId: orderItems.orderId,
              productId: orderItems.productId,
              productName: orderItems.productName,
              productPrice: orderItems.productPrice,
              quantity: orderItems.quantity,
              subtotal: orderItems.subtotal,
              notes: orderItems.notes,
              isWss: products.isWss,
            })
            .from(orderItems)
            .leftJoin(products, eq(orderItems.productId, products.id))
            .where(eq(orderItems.orderId, input.orderId));
          items = allItems.filter(item => !item.isWss);
        }
      } else {
        // Old orders without receiptData - get all items and filter out WSS
        const allItems = await db
          .select({
            id: orderItems.id,
            orderId: orderItems.orderId,
            productId: orderItems.productId,
            productName: orderItems.productName,
            productPrice: orderItems.productPrice,
            quantity: orderItems.quantity,
            subtotal: orderItems.subtotal,
            notes: orderItems.notes,
            isWss: products.isWss,
          })
          .from(orderItems)
          .leftJoin(products, eq(orderItems.productId, products.id))
          .where(eq(orderItems.orderId, input.orderId));
        items = allItems.filter(item => !item.isWss);
      }

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

      // Parse receiptData for correct totals
      let receiptDataObj: any = null;
      if (order.receiptData) {
        try {
          receiptDataObj = JSON.parse(order.receiptData);
        } catch (e) {
          console.warn(`[Print] Failed to parse receiptData for order ${input.orderId}`);
        }
      }
      // Fetch modifiers ONLY for DB-sourced items (receiptData items embed
      // their own modifiers and their id is a product id — see ghost bug).
      const itemMods = receiptDataObj ? undefined : await fetchItemModifiers(items.map(i => i.id));
      // Format and create print job with receiptData
      const receiptContent = formatReceipt(order, storeResult[0], items, customerName, customerPhone, itemMods, receiptDataObj);

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

  // Daily store statement: every delivered order for one store on one Irish date,
  // compact summary: orders with items, day item tally, totals footer
  printStoreStatement: publicProcedure
    .input(z.object({
      storeId: z.number(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const storeResult = await db.select().from(stores).where(eq(stores.id, input.storeId)).limit(1);
      if (storeResult.length === 0) throw new Error("Store not found");
      const store = storeResult[0];

      // Wide UTC window, then filter to the exact Irish date
      const target = new Date(`${input.date}T12:00:00Z`);
      const from = new Date(target.getTime() - 36 * 3600 * 1000);
      const to = new Date(target.getTime() + 36 * 3600 * 1000);
      const targetDay = formatIrishDateShort(target);

      const candidates = await db
        .select()
        .from(orders)
        .where(and(
          eq(orders.storeId, input.storeId),
          eq(orders.status, "delivered"),
          gte(orders.createdAt, from),
          lt(orders.createdAt, to),
        ))
        .orderBy(orders.createdAt);

      const dayOrders = candidates.filter(o => formatIrishDateShort(o.createdAt) === targetDay);
      if (dayOrders.length === 0) throw new Error(`No delivered orders for ${store.name} on ${targetDay}`);

      const W = 32;
      const center = (t: string) => " ".repeat(Math.max(0, Math.floor((W - t.length) / 2))) + t;
      const lr = (l: string, r: string) => l + " ".repeat(Math.max(1, W - l.length - r.length)) + r;
      // Item line with word-wrap: price sits on the last line of the name
      const itemLines = (label: string, price: string, indent: string): string[] => {
        const out: string[] = [];
        const lead = label.match(/^\s*/)?.[0] || "";
        const words = label.trim().split(" ");
        let cur = lead;
        for (const w of words) {
          const next = cur.trim() ? cur + " " + w : cur + w;
          if (next.length > W - price.length - 1 && cur.trim()) {
            out.push(cur);
            cur = indent + "  " + w;
          } else {
            cur = next;
          }
        }
        out.push(lr(cur, price));
        return out;
      };

      let salesTotal = 0, sfTotal = 0, dfTotal = 0, tipTotal = 0;
      const body: string[] = [];
      const tally = new Map<string, { qty: number; total: number }>();

      for (const order of dayOrders) {
        let receiptDataObj: any = null;
        if (order.receiptData) {
          try { receiptDataObj = JSON.parse(order.receiptData); } catch { receiptDataObj = null; }
        }

        let items: any[];
        if (receiptDataObj?.storeReceipt?.items) {
          items = receiptDataObj.storeReceipt.items;
        } else {
          receiptDataObj = null;
          const allItems = await db
            .select({
              id: orderItems.id,
              orderId: orderItems.orderId,
              productId: orderItems.productId,
              productName: orderItems.productName,
              productPrice: orderItems.productPrice,
              quantity: orderItems.quantity,
              subtotal: orderItems.subtotal,
              notes: orderItems.notes,
              isWss: products.isWss,
            })
            .from(orderItems)
            .leftJoin(products, eq(orderItems.productId, products.id))
            .where(eq(orderItems.orderId, order.id));
          items = allItems.filter(item => !item.isWss);
        }
        const itemMods = receiptDataObj ? undefined : await fetchItemModifiers(items.map(i => i.id));

        const sr = receiptDataObj?.storeReceipt;
        const orderSales = sr ? Number(sr.subtotal) : parseFloat(order.subtotal || "0");
        salesTotal += orderSales;
        sfTotal += sr ? Number(sr.serviceFee) : parseFloat(order.serviceFee || "0");
        dfTotal += sr ? Number(sr.deliveryFee) : parseFloat(order.deliveryFee || "0");
        tipTotal += parseFloat(order.tipAmount || "0");

        body.push(lr(getDisplayOrderNumber(order), `EUR${orderSales.toFixed(2)}`));
        for (const item of items) {
          const qty = item.quantity;
          const name = item.productName || item.product?.name || "Item";
          const price = parseFloat(item.subtotal || item.productPrice || "0") * (item.subtotal ? 1 : qty);
          body.push(...itemLines(` ${qty}x ${name}`, price.toFixed(2), " "));

          // Only paid extras get a line
          const mods = itemModifiers(item, itemMods);
          const paid = new Map<string, number>();
          for (const m of mods) {
            const p = parseFloat(m.modifierPrice || "0");
            if (p > 0) {
              const clean = String(m.modifierName).replace(/ ×\d+$/, "");
              paid.set(clean, (paid.get(clean) || 0) + p);
            }
          }
          for (const [mName, mPrice] of paid) {
            body.push(...itemLines(`   + ${mName}`, mPrice.toFixed(2), "   "));
          }

          const t = tally.get(name) || { qty: 0, total: 0 };
          t.qty += qty;
          t.total += price;
          tally.set(name, t);
        }
        body.push("-".repeat(W));
      }

      const f: string[] = [];
      f.push(center("WESHOP4U"));
      f.push(center("DAILY STATEMENT"));
      f.push(center(store.name.toUpperCase()));
      f.push(center(targetDay));
      f.push("=".repeat(W));
      f.push("ORDERS");
      f.push("-".repeat(W));
      f.push(...body);
      f.push("=".repeat(W));
      f.push("ITEMS SOLD");
      f.push("-".repeat(W));
      const tallySorted = Array.from(tally.entries()).sort((a, b) => b[1].qty - a[1].qty);
      for (const [name, t] of tallySorted) {
        f.push(...itemLines(` ${t.qty}x ${name}`, t.total.toFixed(2), " "));
      }
      f.push("=".repeat(W));
      f.push(lr("Orders:", String(dayOrders.length)));
      f.push(lr("Sales total:", `EUR${salesTotal.toFixed(2)}`));
      f.push(lr("SF total:", `EUR${sfTotal.toFixed(2)}`));
      f.push(lr("DF total:", `EUR${dfTotal.toFixed(2)}`));
      if (tipTotal > 0) f.push(lr("Tips total:", `EUR${tipTotal.toFixed(2)}`));
      f.push("-".repeat(W));
      f.push(lr("GRAND TOTAL:", `EUR${(salesTotal + sfTotal + dfTotal + tipTotal).toFixed(2)}`));
      f.push("=".repeat(W));
      f.push(lr("OWED TO STORE:", `EUR${salesTotal.toFixed(2)}`));
      f.push("=".repeat(W));
      f.push("", "", "");

      const receiptContent = f.join("\n");
      const [result] = await db.insert(printJobs).values({
        storeId: input.storeId,
        orderId: dayOrders[0].id,
        status: "pending",
        receiptContent,
      });

      return { printJobId: result.insertId, orders: dayOrders.length, salesTotal, sfTotal, dfTotal };
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

      // Get items - use store receipt from receiptData to exclude WSS items
      let items: any[] = [];
      if (order.receiptData) {
        try {
          const receiptData = JSON.parse(order.receiptData);
          items = receiptData.storeReceipt.items;
        } catch (e) {
          console.warn(`[Print] Failed to parse receiptData for order ${input.orderId}, falling back to filtered items`);
          const allItems = await db
            .select({
              id: orderItems.id,
              orderId: orderItems.orderId,
              productId: orderItems.productId,
              productName: orderItems.productName,
              productPrice: orderItems.productPrice,
              quantity: orderItems.quantity,
              subtotal: orderItems.subtotal,
              notes: orderItems.notes,
              isWss: products.isWss,
            })
            .from(orderItems)
            .leftJoin(products, eq(orderItems.productId, products.id))
            .where(eq(orderItems.orderId, input.orderId));
          items = allItems.filter(item => !item.isWss);
        }
      } else {
        const allItems = await db
          .select({
            id: orderItems.id,
            orderId: orderItems.orderId,
            productId: orderItems.productId,
            productName: orderItems.productName,
            productPrice: orderItems.productPrice,
            quantity: orderItems.quantity,
            subtotal: orderItems.subtotal,
            notes: orderItems.notes,
            isWss: products.isWss,
          })
          .from(orderItems)
          .leftJoin(products, eq(orderItems.productId, products.id))
          .where(eq(orderItems.orderId, input.orderId));
        items = allItems.filter(item => !item.isWss);
      }

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

      // Parse receiptData for correct totals
      let receiptDataObj: any = null;
      if (order.receiptData) {
        try {
          receiptDataObj = JSON.parse(order.receiptData);
        } catch (e) {
          console.warn(`[Print] Failed to parse receiptData for order ${input.orderId}`);
        }
      }
      // Fetch modifiers ONLY for DB-sourced items (receiptData items embed
      // their own modifiers and their id is a product id — see ghost bug).
      const itemMods = receiptDataObj ? undefined : await fetchItemModifiers(items.map(i => i.id));

      const receiptContent = formatReceipt(order, storeResult[0], items, customerName, customerPhone, itemMods, receiptDataObj);

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
