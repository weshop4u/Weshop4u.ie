import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { orders } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { offerOrderToQueue } from "./drivers";

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

      // Check the payment session status with Elavon
      try {
        const session = await elavonRequest("GET", `/payment-sessions/${order.elavonSessionId}`);

        // Check if transaction was created (payment completed)
        if (session.transaction) {
          const transactionHref = typeof session.transaction === "string"
            ? session.transaction
            : session.transaction.href || session.transaction.id;
          const transactionId = transactionHref ? String(transactionHref).split("/").pop() : null;

          // Update order as paid
          await db
            .update(orders)
            .set({
              paymentStatus: "completed",
              elavonTransactionId: transactionId || null,
            })
            .where(eq(orders.id, input.orderId));

          // Dispatch order to driver queue now that payment is confirmed
          try {
            await offerOrderToQueue(input.orderId);
            console.log(`[Payment] Order ${input.orderId} dispatched to driver queue after card payment confirmed`);
          } catch (e) {
            console.error(`[Payment] Failed to dispatch order ${input.orderId} to driver queue:`, e);
          }

          return {
            status: "completed" as const,
            paymentStatus: "completed",
            transactionId: transactionId,
          };
        }

        // Check if session expired
        if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
          await db
            .update(orders)
            .set({ paymentStatus: "failed" })
            .where(eq(orders.id, input.orderId));

          return { status: "expired" as const, paymentStatus: "failed" };
        }

        return { status: "pending" as const, paymentStatus: "pending" };
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
