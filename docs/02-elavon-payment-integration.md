# Elavon Converge Payment Integration Plan

**Platform:** WESHOP4U Mobile App + Website
**Gateway:** Elavon Converge (formerly Virtual Merchant)
**Currency:** EUR
**Date:** February 2026

---

## 1. Overview

Elavon Converge is the payment gateway that will enable WESHOP4U to accept card payments alongside the existing cash-on-delivery option. Converge supports credit and debit card transactions and provides multiple integration methods suited to different platforms [1] [2]. This document outlines the step-by-step integration plan for both the mobile app and the website, using the approach that minimises PCI compliance burden while providing a smooth customer experience.

---

## 2. Recommended Integration Approach

Elavon Converge offers three integration methods. The table below compares them for the WESHOP4U use case.

| Method | How It Works | PCI Level | Best For | UX Quality |
|--------|-------------|-----------|----------|------------|
| **Hosted Payment Page (HPP)** | Customer is redirected to Elavon's hosted page to enter card details, then redirected back | SAQ A (lowest) | Mobile app | Good — redirect-based |
| **Checkout.js** | JavaScript library embeds a payment form directly in your page; card data goes straight to Converge | SAQ A-EP | Website | Excellent — no redirect |
| **XML API (Direct)** | Your server collects card data and sends it to Converge | SAQ D (highest) | Not recommended | N/A — too much PCI burden |

**Recommendation:** Use **Hosted Payment Page (HPP)** for the mobile app and **Checkout.js** for the website. This gives the best balance of security, compliance, and user experience across both platforms.

---

## 3. Required Credentials

Three credentials are needed from the Elavon Converge account. These are found in the Converge admin portal (Virtual Merchant) [3].

| Credential | Parameter Name | Where to Find |
|-----------|---------------|---------------|
| **Merchant ID** (Account ID) | `ssl_account_id` | Converge admin → Account settings |
| **User ID** | `ssl_user_id` | Converge admin → Users → Must be an API-type user |
| **PIN** | `ssl_pin` | Converge admin → Terminal → Terminal Name/PIN |

> **Important:** The User ID must be set up as an **API user** (not a regular admin user) with permission to generate session tokens. This is configured in Converge under Terminal → User settings [2].

These credentials will be stored as environment variables on the WESHOP4U server and never exposed to the client.

---

## 4. Integration Steps

### Step 1: Configure Converge Account

Before writing any code, the Converge account needs to be configured correctly.

1. Log into the Converge admin portal at [www.convergepay.com](https://www.convergepay.com)
2. Navigate to **Terminal → Users** and create a new user with **API User** status
3. Note the **User ID** assigned to this API user
4. Navigate to **Terminal → Terminal Name/PIN** and note the **PIN**
5. Navigate to **Account Settings** and note the **Merchant ID** (Account ID)
6. Under **Terminal → Payment Fields**, ensure the required fields are set to minimal (reduces friction at checkout)
7. Under **Terminal → Hosted Payments**, add the WESHOP4U callback URLs to the whitelist:
   - `https://api.weshop4u.ie/api/payment/callback` (production)
   - `http://localhost:3000/api/payment/callback` (development)

### Step 2: Store Credentials Securely

The three credentials are stored as server-side environment variables. They are never sent to the client.

| Environment Variable | Value |
|---------------------|-------|
| `ELAVON_MERCHANT_ID` | Your ssl_account_id |
| `ELAVON_USER_ID` | Your ssl_user_id |
| `ELAVON_PIN` | Your ssl_pin |
| `ELAVON_ENVIRONMENT` | `demo` for testing, `production` for live |

The API endpoints differ by environment:

| Environment | Endpoint |
|------------|----------|
| Demo/Sandbox | `https://api.demo.convergepay.com/VirtualMerchant/process.do` |
| Production | `https://api.convergepay.com/VirtualMerchant/process.do` |

### Step 3: Build Server-Side Payment Endpoints

The server handles all communication with Converge. Three endpoints are needed.

**Endpoint 1: Create Session Token** — When a customer is ready to pay, the server requests a session token from Converge. This token is a short-lived credential that authorises a single payment attempt.

```
POST /api/payment/create-session

Server sends to Converge:
  ssl_merchant_id    → Merchant ID
  ssl_user_id        → API User ID
  ssl_pin            → PIN
  ssl_transaction_type → ccsale
  ssl_amount         → Order total (e.g., "8.44")
  ssl_invoice_number → Order ID (e.g., "WS4U-1771409592153-974")

Converge returns:
  ssl_txn_id         → Session token
```

The server returns this session token to the client, which uses it to open the payment form.

**Endpoint 2: Payment Callback** — After the customer completes (or cancels) payment on Converge, Elavon sends the result to this callback URL.

```
POST /api/payment/callback

Converge sends:
  ssl_txn_id         → Transaction ID
  ssl_result          → 0 (approved) or other (declined)
  ssl_result_message  → "APPROVAL" or error message
  ssl_approval_code   → Approval code (if approved)
  ssl_amount          → Amount charged
  ssl_invoice_number  → Order ID

Server actions:
  If approved → Update order payment status to "paid", proceed with order
  If declined → Update order payment status to "failed", notify customer
```

**Endpoint 3: Check Payment Status** — The client polls this endpoint to check if payment has been completed (useful when returning from the HPP redirect).

```
GET /api/payment/status/:orderId

Returns:
  status: "pending" | "paid" | "failed"
  transactionId: string (if paid)
```

### Step 4: Integrate into Mobile App (HPP Approach)

For the mobile app, the Hosted Payment Page approach works as follows.

1. Customer taps "Pay by Card" at checkout
2. App calls the server's `/api/payment/create-session` endpoint with the order total
3. Server returns the session token and the HPP URL
4. App opens the HPP URL in an in-app browser (WebBrowser from expo-web-browser)
5. Customer enters card details on Elavon's secure page
6. After payment, Elavon redirects back to the app via the deep link scheme
7. App calls `/api/payment/status/:orderId` to confirm payment was successful
8. If confirmed, the order proceeds; if not, the customer is shown an error

The customer never enters card details inside the WESHOP4U app — all card data is handled by Elavon's secure page.

### Step 5: Integrate into Website (Checkout.js Approach)

For the website, Checkout.js provides a smoother experience without redirects.

1. Customer clicks "Pay by Card" at checkout
2. Website calls the server's `/api/payment/create-session` endpoint
3. Server returns the session token
4. Website loads the Converge Checkout.js library and opens the payment lightbox using the session token
5. Customer enters card details in the lightbox (data goes directly to Converge, never touches the WESHOP4U server)
6. Converge processes the payment and returns the result via JavaScript callback
7. Website receives the callback, sends the transaction result to the server for verification
8. Server confirms with Converge that the transaction is genuine, then updates the order

```html
<!-- Checkout.js script inclusion -->
<script src="https://api.convergepay.com/hosted-payments/Checkout.js"></script>

<!-- Payment button triggers the lightbox -->
<script>
  const callback = {
    onError: function(error) { /* handle error */ },
    onDeclined: function(response) { /* handle decline */ },
    onApproval: function(response) { /* handle success */ }
  };
  
  // Open payment lightbox with session token
  ConvergeEmbeddedPayment.pay(sessionToken, callback);
</script>
```

### Step 6: Handle Payment in Order Flow

The checkout flow needs to be updated to support both payment methods.

| Step | Cash on Delivery | Card Payment |
|------|-----------------|--------------|
| 1. Customer selects payment | "Cash" selected | "Card" selected |
| 2. Customer taps "Place Order" | Order created immediately with status "pending" | Order created with status "awaiting_payment" |
| 3. Payment processing | N/A | HPP or Checkout.js opens |
| 4. Payment result | N/A | Callback updates order to "pending" (success) or "payment_failed" |
| 5. Store notification | Immediate | After successful payment only |
| 6. Receipt | Shows "Cash on Delivery" | Shows "Paid by Card" with last 4 digits |

### Step 7: Testing

Elavon provides a demo/sandbox environment for testing before going live.

1. Use the demo endpoint (`api.demo.convergepay.com`) during development
2. Test with Elavon's test card numbers (provided in Converge documentation)
3. Test successful payments, declined cards, and cancelled transactions
4. Verify that the order status updates correctly in all cases
5. Test refund flow (admin can trigger refund via Converge admin or API)
6. Switch to production endpoint and credentials when ready to go live

### Step 8: Go Live

1. Switch `ELAVON_ENVIRONMENT` from `demo` to `production`
2. Update the API endpoint to the production URL
3. Update callback URLs in Converge admin to production domain
4. Process a small test transaction (€0.50) with a real card
5. Verify the transaction appears in Converge admin
6. Void the test transaction
7. Card payments are now live

---

## 5. Database Changes

A `payment_transactions` table will be added to track all card payment attempts.

| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| order_id | integer | Foreign key to orders table |
| txn_id | varchar | Converge transaction ID |
| amount | decimal | Amount charged |
| status | varchar | pending, approved, declined, voided, refunded |
| approval_code | varchar | Elavon approval code |
| card_last_four | varchar | Last 4 digits of card (for receipt display) |
| error_message | varchar | Error details if declined |
| created_at | timestamp | When the transaction was initiated |
| updated_at | timestamp | Last status update |

---

## 6. Security Considerations

Card payment integration requires careful attention to security.

**PCI Compliance** — By using HPP and Checkout.js, card data never touches the WESHOP4U server. This keeps the PCI compliance level at SAQ A or SAQ A-EP, which is the lowest burden. No card numbers are stored in the WESHOP4U database.

**Credential Security** — Merchant ID, User ID, and PIN are stored as server-side environment variables, never exposed in client-side code or API responses.

**Callback Verification** — When Converge sends a payment callback, the server verifies the transaction by checking the transaction ID against Converge's API before updating the order status. This prevents spoofed callbacks.

**HTTPS** — All payment-related communication uses HTTPS. The website and API must have valid SSL certificates.

---

## 7. Refund Process

When an order needs to be refunded (e.g., cancelled after payment), the admin can trigger a refund through the admin dashboard. The server sends a `ccreturn` transaction to Converge with the original transaction ID and refund amount. Partial refunds are supported.

---

## References

[1]: https://developer.elavon.com/products/hosted-payment-page/v1/overview "Elavon Hosted Payment Page Overview"
[2]: https://developer.elavon.com/products/checkout-js/v1 "Elavon Checkout.js Documentation"
[3]: https://www.revindex.com/Resources/Knowledge-Base/Revindex-Storefront/elavon-converge-xml-api "Elavon Converge XML API - Credentials Guide"
