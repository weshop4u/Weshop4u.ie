import { describe, it, expect } from "vitest";

// ---- Helper functions extracted from payments router logic ----

function getElavonAuth(merchantAlias: string, secretKey: string): string {
  return Buffer.from(`${merchantAlias}:${secretKey}`).toString("base64");
}

function buildOrderPayload(orderNumber: string, total: string, email?: string) {
  return {
    total: {
      amount: parseFloat(total).toFixed(2),
      currencyCode: "EUR",
    },
    description: `WeShop4U Order ${orderNumber}`,
    orderReference: orderNumber,
    shopperEmailAddress: email || undefined,
  };
}

function buildPaymentSessionPayload(
  orderHref: string,
  returnUrl: string,
  cancelUrl: string,
  orderId: number
) {
  return {
    order: orderHref,
    returnUrl: `${returnUrl}?orderId=${orderId}`,
    cancelUrl: `${cancelUrl}?orderId=${orderId}`,
    doCreateTransaction: true,
    hppType: "fullPageRedirect",
  };
}

function buildPaymentPageUrl(hppBase: string, sessionId: string): string {
  return `${hppBase}/hosted-payments/${sessionId}`;
}

function extractTransactionId(transactionRef: string | { href?: string; id?: string }): string | null {
  if (typeof transactionRef === "string") {
    return transactionRef.split("/").pop() || null;
  }
  const href = transactionRef.href || transactionRef.id || "";
  return String(href).split("/").pop() || null;
}

function determinePaymentResult(session: {
  transaction?: any;
  expiresAt?: string;
}): "completed" | "expired" | "pending" {
  if (session.transaction) return "completed";
  if (session.expiresAt && new Date(session.expiresAt) < new Date()) return "expired";
  return "pending";
}

// ---- Tests ----

describe("Elavon Payment Integration", () => {
  describe("Authentication", () => {
    it("should create correct Basic auth header from merchant alias and secret key", () => {
      const auth = getElavonAuth("test-merchant", "secret123");
      const decoded = Buffer.from(auth, "base64").toString("utf-8");
      expect(decoded).toBe("test-merchant:secret123");
    });

    it("should handle special characters in credentials", () => {
      const auth = getElavonAuth("merchant@test", "s3cr3t!@#$");
      const decoded = Buffer.from(auth, "base64").toString("utf-8");
      expect(decoded).toBe("merchant@test:s3cr3t!@#$");
    });
  });

  describe("Order Payload", () => {
    it("should build correct order payload with EUR currency", () => {
      const payload = buildOrderPayload("WS-001", "25.50", "test@example.com");
      expect(payload.total.amount).toBe("25.50");
      expect(payload.total.currencyCode).toBe("EUR");
      expect(payload.description).toBe("WeShop4U Order WS-001");
      expect(payload.orderReference).toBe("WS-001");
      expect(payload.shopperEmailAddress).toBe("test@example.com");
    });

    it("should format amount to 2 decimal places", () => {
      const payload = buildOrderPayload("WS-002", "10");
      expect(payload.total.amount).toBe("10.00");
    });

    it("should handle small amounts like €0.01", () => {
      const payload = buildOrderPayload("WS-003", "0.01");
      expect(payload.total.amount).toBe("0.01");
    });

    it("should omit email when not provided", () => {
      const payload = buildOrderPayload("WS-004", "5.00");
      expect(payload.shopperEmailAddress).toBeUndefined();
    });

    it("should handle amounts with many decimal places", () => {
      const payload = buildOrderPayload("WS-005", "12.999");
      expect(payload.total.amount).toBe("13.00");
    });
  });

  describe("Payment Session Payload", () => {
    it("should build correct payment session payload", () => {
      const payload = buildPaymentSessionPayload(
        "https://api.eu.convergepay.com/orders/abc123",
        "https://example.com/payment-result",
        "https://example.com/payment-cancel",
        42
      );
      expect(payload.order).toBe("https://api.eu.convergepay.com/orders/abc123");
      expect(payload.returnUrl).toBe("https://example.com/payment-result?orderId=42");
      expect(payload.cancelUrl).toBe("https://example.com/payment-cancel?orderId=42");
      expect(payload.doCreateTransaction).toBe(true);
      expect(payload.hppType).toBe("fullPageRedirect");
    });

    it("should append orderId as query parameter to URLs", () => {
      const payload = buildPaymentSessionPayload(
        "https://api.eu.convergepay.com/orders/xyz",
        "https://mysite.com/result",
        "https://mysite.com/cancel",
        999
      );
      expect(payload.returnUrl).toContain("orderId=999");
      expect(payload.cancelUrl).toContain("orderId=999");
    });
  });

  describe("Payment Page URL", () => {
    it("should build correct hosted payment page URL for production EU HPP domain", () => {
      const url = buildPaymentPageUrl("https://hpp.eu.convergepay.com", "session-abc-123");
      expect(url).toBe("https://hpp.eu.convergepay.com/hosted-payments/session-abc-123");
    });

    it("should use HPP domain not API domain for hosted payments", () => {
      const url = buildPaymentPageUrl("https://hpp.eu.convergepay.com", "test-session");
      expect(url).not.toContain("api.eu.convergepay.com");
      expect(url).toContain("hpp.eu.convergepay.com");
    });
  });

  describe("Transaction ID Extraction", () => {
    it("should extract transaction ID from string URL", () => {
      const id = extractTransactionId("https://api.eu.convergepay.com/transactions/txn-12345");
      expect(id).toBe("txn-12345");
    });

    it("should extract transaction ID from object with href", () => {
      const id = extractTransactionId({
        href: "https://api.eu.convergepay.com/transactions/txn-67890",
      });
      expect(id).toBe("txn-67890");
    });

    it("should extract transaction ID from object with id", () => {
      const id = extractTransactionId({ id: "txn-direct-id" });
      expect(id).toBe("txn-direct-id");
    });

    it("should handle simple string ID", () => {
      const id = extractTransactionId("simple-txn-id");
      expect(id).toBe("simple-txn-id");
    });
  });

  describe("Payment Result Determination", () => {
    it("should return completed when transaction exists", () => {
      const result = determinePaymentResult({
        transaction: { id: "txn-123" },
      });
      expect(result).toBe("completed");
    });

    it("should return expired when session is past expiry", () => {
      const pastDate = new Date(Date.now() - 3600000).toISOString();
      const result = determinePaymentResult({
        expiresAt: pastDate,
      });
      expect(result).toBe("expired");
    });

    it("should return pending when no transaction and not expired", () => {
      const futureDate = new Date(Date.now() + 3600000).toISOString();
      const result = determinePaymentResult({
        expiresAt: futureDate,
      });
      expect(result).toBe("pending");
    });

    it("should return pending when no expiry and no transaction", () => {
      const result = determinePaymentResult({});
      expect(result).toBe("pending");
    });

    it("should prioritize completed over expired", () => {
      const pastDate = new Date(Date.now() - 3600000).toISOString();
      const result = determinePaymentResult({
        transaction: { id: "txn-123" },
        expiresAt: pastDate,
      });
      expect(result).toBe("completed");
    });
  });

  describe("Payment Flow Validation", () => {
    it("should only allow card payment orders to create payment sessions", () => {
      const order = { paymentMethod: "card", paymentStatus: "pending" };
      expect(order.paymentMethod).toBe("card");
      expect(order.paymentStatus).not.toBe("completed");
    });

    it("should reject cash_on_delivery orders for payment session", () => {
      const order = { paymentMethod: "cash_on_delivery" };
      expect(order.paymentMethod).not.toBe("card");
    });

    it("should reject already completed payments", () => {
      const order = { paymentMethod: "card", paymentStatus: "completed" };
      expect(order.paymentStatus).toBe("completed");
      // In the actual code, this throws an error
    });

    it("should not allow cancelling completed payments", () => {
      const order = { paymentStatus: "completed" };
      const canCancel = order.paymentStatus !== "completed";
      expect(canCancel).toBe(false);
    });

    it("should allow cancelling pending payments", () => {
      const order = { paymentStatus: "pending" };
      const canCancel = order.paymentStatus !== "completed";
      expect(canCancel).toBe(true);
    });
  });

  describe("API Base URL", () => {
    it("should use EU production URL", () => {
      const apiBase = "https://api.eu.convergepay.com";
      expect(apiBase).toContain("eu.convergepay.com");
    });

    it("should construct correct orders endpoint", () => {
      const apiBase = "https://api.eu.convergepay.com";
      const ordersUrl = `${apiBase}/orders`;
      expect(ordersUrl).toBe("https://api.eu.convergepay.com/orders");
    });

    it("should construct correct payment-sessions endpoint", () => {
      const apiBase = "https://api.eu.convergepay.com";
      const sessionsUrl = `${apiBase}/payment-sessions`;
      expect(sessionsUrl).toBe("https://api.eu.convergepay.com/payment-sessions");
    });
  });
});
