import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { orders, storeStaff, users, stores } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { offerOrderToQueue } from "./drivers";
import { sendNewOrderNotification, sendPushNotification } from "../services/notifications";
import { sendOrderConfirmationSMS } from "../sms";


// Elavon EPG API base URL (production EU)
const ELAVON_API_BASE = "https://api.eu.convergepay.com";

function getElavonAuth() {
  const merchantAlias = process.env.ELAVON_MERCHANT_ALIAS;
  const secretKey = process.env.ELAVON_SECRET_KEY;
  if (!merchantAlias || !secretKey) {
    throw new Error("Elavon credentials not configured");
  }
  return Buffer.from(`${merchantAlias}:${secretKey}`).toString("base64");
}

async function elavonRequest(method: string, path: string, body?: any) {
  const auth = getElavonAuth();
  const url = `${ELAVON_API_BASE}${path}`;

  const options: RequestInit = {
    method,
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/json;charset=UTF-8",
      "Accept": "application/json",
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Elavon] ${method} ${path} failed (${response.status}):`, errorText);
    throw new Error(`Elavon API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

export const paymentsRouter = router({
  // Create an Elavon payment session for a card order
  createPaymentSession: publicProcedure
    .input(z.object({
      orderId: z.number(),
      returnUrl: z.string(),
      cancelUrl: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = (await getDb())!;

      // Get the order
      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, input.orderId));

      if (!order) {
        throw new Error("Order not found");
      }

      if (order.paymentMethod !== "card") {
        throw new Error("Order is not a card payment");
      }

      if (order.paymentStatus === "completed") {
        throw new Error("Payment already completed");
      }

      // Reset payment status to pending on retry (e.g. after a failed/expired session)
      if (order.paymentStatus === "failed") {
        await db
          .update(orders)
          .set({ paymentStatus: "pending" })
          .where(eq(orders.id, input.orderId));
      }

      const totalAmount = parseFloat(order.total);

      // Step 1: Create an Elavon Order
      const elavonOrder = await elavonRequest("POST", "/orders", {
        total: {
          amount: totalAmount.toFixed(2),
          currencyCode: "EUR",
        },
        description: `WeShop4U Order ${order.orderNumber}`,
        orderReference: order.orderNumber,
        shopperEmailAddress: order.guestEmail || undefined,
      });

      console.log("[Elavon] Order response:", JSON.stringify(elavonOrder, null, 2));
      const elavonOrderId = elavonOrder.id;
      const elavonOrderHref = elavonOrder.href;

      // Step 2: Create a Payment Session with return/cancel URLs
      const paymentSession = await elavonRequest("POST", "/payment-sessions", {
        order: elavonOrderHref,
        returnUrl: `${input.returnUrl}?orderId=${input.orderId}`,
        cancelUrl: `${input.cancelUrl}?orderId=${input.orderId}`,
        doCreateTransaction: true,
        hppType: "fullPageRedirect",
      });

      console.log("[Elavon] Payment session response:", JSON.stringify(paymentSession, null, 2));
      const sessionId = paymentSession.id;

      // Save Elavon IDs to the order
      await db
        .update(orders)
        .set({
          elavonOrderId: elavonOrderId,
          elavonSessionId: sessionId,
        })
        .where(eq(orders.id, input.orderId));

      // Use the 'url' field from the payment session response directly
      // Format: https://hpp.eu.convergepay.com?sessionId={sessionId}
      const paymentPageUrl = paymentSession.url || `https://hpp.eu.convergepay.com?sessionId=${sessionId}`;

      return {
        paymentUrl: paymentPageUrl,
        sessionId: sessionId,
        elavonOrderId: elavonOrderId,
      };
    }),

  // Check payment status after customer returns from Elavon
  checkPaymentStatus: publicProcedure
    .input(z.object({
      orderId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = (await getDb())!;

      // Get the order
      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, input.orderId));

      if (!order) {
        throw new Error("Order not found");
      }

      // Already completed
      if (order.paymentStatus === "completed") {
        return {
          status: "completed" as const,
          paymentStatus: "completed",
          transactionId: order.elavonTransactionId,
        };
      }

      if (!order.elavonSessionId) {
        return { status: "no_session" as const, paymentStatus: order.paymentStatus };
      }

      // ─── Helper: confirm payment, notify, dispatch ────────────────────────
      // Extracted so both the session path and the reference-search path can
      // call the same logic without duplicating code.
      const confirmPayment = async (transactionId: string | null, source: string) => {
        // If order was cancelled due to payment appearing to fail, reactivate it
const reactivate = order.status === "cancelled";
await db
  .update(orders)
  .set({
    paymentStatus: "completed",
    elavonTransactionId: transactionId,
    ...(reactivate ? { status: "pending", cancelledAt: null, cancellationReason: null } : {}),
  })
  .where(eq(orders.id, input.orderId));

if (reactivate) {
  console.log(`[Payment] Reactivating cancelled order ${order.orderNumber} — payment confirmed`);
}

        console.log(`[Payment] Order ${order.orderNumber} confirmed via ${source} — txn: ${transactionId}`);

        // Customer notification
        try {
          let smsPhone: string | null = null;
          let hasPushToken = false;
          if (order.customerId) {
            const [customerRecord] = await db
              .select({ phone: users.phone, pushToken: users.pushToken })
              .from(users)
              .where(eq(users.id, order.customerId))
              .limit(1);
            if (customerRecord?.pushToken) {
              hasPushToken = true;
              await sendPushNotification(customerRecord.pushToken, {
                title: "Order Placed! \uD83C\uDF89",
                body: `Your order #${order.orderNumber} is confirmed! We'll notify you when the driver arrives.`,
                data: { type: "order_update", orderId: input.orderId, status: "pending" },
                channelId: "orders",
              });
            } else {
              smsPhone = customerRecord?.phone || null;
            }
          } else {
            smsPhone = order.guestPhone || null;
          }
          if (!hasPushToken && smsPhone) {
            const [storeRecord] = await db.select({ name: stores.name }).from(stores).where(eq(stores.id, order.storeId)).limit(1);
            await sendOrderConfirmationSMS(smsPhone, storeRecord?.name || "the store", input.orderId);
          }
        } catch (e) {
          console.error(`[Payment] Notification failed for order ${input.orderId}:`, e);
        }

        // Store staff notification
        try {
          const storeStaffMembers = await db
            .select({ userId: storeStaff.userId, pushToken: users.pushToken })
            .from(storeStaff)
            .innerJoin(users, eq(storeStaff.userId, users.id))
            .where(eq(storeStaff.storeId, order.storeId));
          const customerName = order.guestName || (order.customerId ? "Customer" : "Unknown");
          for (const staff of storeStaffMembers) {
            if (staff.pushToken) {
              await sendNewOrderNotification(staff.pushToken, input.orderId, customerName, 0, parseFloat(order.total));
            }
          }
        } catch (e) {
          console.error(`[Payment] Store notification failed for order ${input.orderId}:`, e);
        }

        // Dispatch now happens only once the order is accepted (store/POS/
        // admin), not immediately at payment confirmation — see
        // acceptOrder / acceptOrderFromPOS / updateOrderStatus.

        return { status: "completed" as const, paymentStatus: "completed", transactionId };
      };

      // ─── Step 1: Check the payment session ───────────────────────────────
      try {
        const session = await elavonRequest("GET", `/payment-sessions/${order.elavonSessionId}`);

        // Session has a transaction — payment confirmed via session
        if (session.transaction) {
          const transactionHref = typeof session.transaction === "string"
            ? session.transaction
            : session.transaction.href || session.transaction.id;
          const transactionId = transactionHref ? String(transactionHref).split("/").pop() : null;
          return await confirmPayment(transactionId, "session");
        }

        // Session not yet expired — still processing (3DS/Apple Pay in progress)
        if (!session.expiresAt || new Date(session.expiresAt) >= new Date()) {
          return { status: "pending" as const, paymentStatus: "pending" };
        }

        // ─── Step 2: Session expired but no transaction on it ─────────────
        // This is the critical gap: Apple Pay / 3DS verification completed
        // AFTER the session object's window closed. The session no longer
        // carries the transaction reference, but Elavon DID capture the money.
        // Search directly by order reference — this is the reliable source of
        // truth regardless of session age, and is how the Elavon portal itself
        // looks up transactions.
        console.log(`[Payment] Session expired for order ${order.orderNumber} — searching by order reference`);
        try {
          const txSearch = await elavonRequest(
            "GET",
            `/transactions?order-reference=${encodeURIComponent(order.orderNumber)}&limit=5`
          );
          

          // Elavon returns transactions in _embedded.transactions or transactions array
          const txList: any[] =
  txSearch?._embedded?.transactions ||
  txSearch?.transactions ||
  txSearch?.items ||
  (txSearch?.id ? [txSearch] : []);

          // Look for a captured/settled/authorised transaction
          const captured = txList.find((tx: any) => {
  // Must match our order number
  const ref = (tx.orderReference || tx.order_reference || "").toUpperCase();
  if (ref !== order.orderNumber.toUpperCase()) return false;
  // Explicitly exclude declined transactions first
  const s = (tx.status || tx.transactionStatus || "").toUpperCase();
  if (s === "DECLINED" || s === "FAILED" || s === "REJECTED" || s === "CANCELLED") return false;
  // Elavon uses "type":"sale" for captures — but only count it if not declined above
  const type = (tx.type || "").toLowerCase();
  return type === "sale" || type === "capture" || 
         s === "CAPTURED" || s === "SETTLED" || s === "AUTHORIZED" || s === "AUTHORISED" || s === "SUCCESS";
});

          if (captured) {
            const transactionId = captured.id || captured.transactionId ||
              captured._links?.self?.href?.split("/").pop() || null;
            console.log(`[Payment] Found transaction ${transactionId} for order ${order.orderNumber} via reference search`);
            return await confirmPayment(transactionId, "reference-search");
          }

          // Reference search returned nothing yet.
          // Only give up if the order is older than 30 minutes — before that,
          // the customer may still be completing Apple Pay / 3DS verification,
          // and we should keep checking rather than prematurely failing them.
          const orderAgeMs = Date.now() - new Date(order.createdAt).getTime();
          const GIVE_UP_AFTER_MS = 30 * 60 * 1000; // 30 minutes

          if (orderAgeMs < GIVE_UP_AFTER_MS) {
            console.log(`[Payment] No transaction yet for order ${order.orderNumber} (age: ${Math.round(orderAgeMs / 60000)}m) — keeping pending`);
            return { status: "pending" as const, paymentStatus: "pending" };
          }

          // Order is older than 30 minutes and Elavon has no transaction for it
          // anywhere — safe to call it genuinely failed/abandoned.
          console.log(`[Payment] No transaction found for order ${order.orderNumber} after 30 minutes — marking failed`);
        } catch (searchErr) {
          console.error(`[Payment] Reference search failed for order ${order.orderNumber}:`, searchErr);
          // Search itself errored — don't mark as failed, keep pending
          return { status: "pending" as const, paymentStatus: "pending" };
        }

        // Confirmed: session expired, order older than 30 minutes, no transaction found
        await db
          .update(orders)
          .set({ paymentStatus: "failed" })
          .where(eq(orders.id, input.orderId));
        return { status: "expired" as const, paymentStatus: "failed" };

      } catch (error) {
        console.error("[Elavon] Error checking payment status:", error);
        return { status: "error" as const, paymentStatus: order.paymentStatus };
      }
    }),

  // Cancel a pending card payment and update order status
  cancelPayment: publicProcedure
    .input(z.object({
      orderId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = (await getDb())!;

      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, input.orderId));

      if (!order) {
        throw new Error("Order not found");
      }

      if (order.paymentStatus === "completed") {
        throw new Error("Cannot cancel a completed payment");
      }

      // Mark order as cancelled
      await db
        .update(orders)
        .set({
          paymentStatus: "failed",
          status: "cancelled",
        })
        .where(eq(orders.id, input.orderId));

      return { success: true };
    }),
});
