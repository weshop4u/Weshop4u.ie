# Guest Checkout & Tiered Trust System

**Platform:** WESHOP4U Mobile App + Website
**Purpose:** Allow customers to order without creating an account, with fraud prevention through tiered spending limits
**Date:** February 2026

---

## 1. Overview

Guest checkout is essential for maximising order conversion. Many customers — especially first-time users — will abandon checkout if forced to create an account. WESHOP4U's previous website supported guest ordering, and customers expect this to continue. However, guest checkout combined with cash-on-delivery creates a fraud risk: someone can place a fake order, and the store prepares items that are never collected or paid for. The tiered trust system addresses this by starting guests with conservative limits and progressively unlocking higher limits as trust is established.

---

## 2. User Tiers

The system defines three user tiers, each with different capabilities and spending limits. A customer naturally progresses from Guest to Verified to Trusted as they interact with the platform.

| Tier | Who | How They Get Here | Cash Limit | Card Limit | Features |
|------|-----|-------------------|-----------|-----------|----------|
| **Guest** | Anyone, no account | Visit the site/app and start ordering | €25 per order | €100 per order | Basic ordering, must provide name + phone + address |
| **Verified** | Registered user with confirmed email | Create account + click email verification link | €50 per order | €200 per order | Order history, saved addresses, reorder, higher limits |
| **Trusted** | Verified user with 3+ successful orders | Automatically upgraded after third completed delivery | €100 per order | No limit | Full access, priority support, all payment methods |

> **Key principle:** Card payments carry less risk than cash because the payment is secured before the store prepares the order. Therefore, card limits are always higher than cash limits at every tier.

---

## 3. Guest Checkout User Flow

The following describes the complete guest checkout experience, step by step.

### 3.1 Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    CUSTOMER ARRIVES                          │
│              (App or Website, not logged in)                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              BROWSE STORES & PRODUCTS                        │
│         (No login required — full catalogue visible)         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  ADD ITEMS TO CART                            │
│          Cart total shown with fees in real-time              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│               TAP "PROCEED TO CHECKOUT"                      │
│                                                              │
│   ┌──────────────┐              ┌──────────────────┐        │
│   │ Already have  │──── Yes ───▶│  Login Screen     │        │
│   │ an account?   │              │  (email+password) │        │
│   └──────┬───────┘              └────────┬─────────┘        │
│          │ No                             │                   │
│          ▼                               ▼                   │
│   ┌──────────────┐              ┌──────────────────┐        │
│   │ Continue as   │              │ Logged in —       │        │
│   │ Guest         │              │ Verified/Trusted  │        │
│   └──────┬───────┘              │ limits apply      │        │
│          │                       └────────┬─────────┘        │
└──────────┼───────────────────────────────┼──────────────────┘
           │                               │
           ▼                               │
┌─────────────────────────────────┐        │
│     GUEST DETAILS FORM          │        │
│                                  │        │
│  Full Name:     [____________]  │        │
│  Phone Number:  [____________]  │        │
│  Delivery Addr: [____________]  │        │
│  Eircode:       [____________]  │        │
│  Email (opt):   [____________]  │        │
│                                  │        │
│  ☐ Save details (create account)│        │
│                                  │        │
└──────────┬──────────────────────┘        │
           │                               │
           ▼                               ▼
┌─────────────────────────────────────────────────────────────┐
│              SELECT PAYMENT METHOD                           │
│                                                              │
│   ┌─────────────────────┐    ┌─────────────────────┐        │
│   │  💵 Cash on Delivery │    │  💳 Pay by Card      │        │
│   │                      │    │                      │        │
│   │  Guest limit: €25    │    │  Guest limit: €100   │        │
│   └──────────┬──────────┘    └──────────┬──────────┘        │
│              │                           │                   │
└──────────────┼───────────────────────────┼──────────────────┘
               │                           │
               ▼                           ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│  CART TOTAL CHECK         │  │  CART TOTAL CHECK         │
│                           │  │                           │
│  Total ≤ €25?             │  │  Total ≤ €100?            │
│  ├─ Yes → Place Order     │  │  ├─ Yes → Open Elavon    │
│  └─ No  → Show message:  │  │  │         payment page   │
│     "Guest cash orders    │  │  └─ No  → Show message:  │
│      limited to €25.      │  │     "Guest card orders    │
│      Create an account    │  │      limited to €100.     │
│      for higher limits."  │  │      Create an account    │
│                           │  │      for higher limits."  │
└──────────┬───────────────┘  └──────────┬───────────────┘
           │                              │
           ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    ORDER PLACED                              │
│                                                              │
│  Order confirmation shown with:                              │
│  • Order number                                              │
│  • Estimated delivery time                                   │
│  • Tracking link                                             │
│                                                              │
│  ┌────────────────────────────────────────────────────┐      │
│  │  💡 Create an account to:                          │      │
│  │     • Track your order history                     │      │
│  │     • Save your address for faster checkout        │      │
│  │     • Unlock higher spending limits                │      │
│  │                                                    │      │
│  │  [Create Account]  [No thanks, continue as guest]  │      │
│  └────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Key Design Decisions

**Phone number is required for guests.** This is the minimum verification for cash-on-delivery orders. The store or driver can call the customer if there's an issue at the door. It also provides a way to blacklist repeat offenders.

**Email is optional for guests.** Making email mandatory would add friction and reduce conversion. However, if the guest provides an email, they receive order confirmation and tracking updates, which improves the experience and encourages account creation.

**"Save details" checkbox.** After entering their details, the guest sees an option to save their information by creating an account. If they check this box, they're prompted to set a password, and their account is created with their details pre-filled. This is a soft upsell — no pressure, but the option is always there.

**Limit messaging is friendly, not punitive.** When a guest hits a spending limit, the message explains the limit and offers a clear path to unlock higher limits (create an account). It does not shame or block the customer — it frames account creation as a benefit.

---

## 4. Tier Progression

Customers naturally move through the tiers as they use the platform. The progression is automatic and requires no admin intervention.

```
┌──────────┐     Create account      ┌──────────────┐     3 successful     ┌───────────┐
│          │     + verify email       │              │     deliveries       │           │
│  GUEST   │ ───────────────────────▶ │   VERIFIED   │ ──────────────────▶  │  TRUSTED  │
│          │                          │              │                      │           │
│ Cash: €25│                          │ Cash: €50    │                      │ Cash: €100│
│ Card:€100│                          │ Card: €200   │                      │ Card: None│
└──────────┘                          └──────────────┘                      └───────────┘
                                             │
                                             │ Cancelled/no-show
                                             │ order detected
                                             ▼
                                      ┌──────────────┐
                                      │              │
                                      │  RESTRICTED  │
                                      │              │
                                      │ Cash: €0     │
                                      │ Card only    │
                                      └──────────────┘
```

### 4.1 Progression Rules

| Trigger | Action |
|---------|--------|
| Guest places first order | Guest tier limits apply |
| Guest creates account + verifies email | Upgraded to **Verified** |
| Verified user completes 3rd successful delivery | Upgraded to **Trusted** |
| Any user has a no-show on a cash order | Downgraded to **Restricted** (card-only, no cash) |
| Restricted user completes 2 successful card orders | Restored to previous tier |

### 4.2 What Counts as a "Successful Delivery"

A delivery is considered successful when the order status reaches "delivered" and either the cash payment was collected by the driver or the card payment was confirmed by Elavon. Cancelled orders, refunded orders, and no-show orders do not count toward tier progression.

---

## 5. Fraud Prevention Measures

The tiered system is the primary fraud prevention mechanism, but additional safeguards are recommended.

### 5.1 Phone Number Verification (Future Enhancement)

For cash-on-delivery orders above a threshold (e.g., €15), the system could send an SMS verification code to the customer's phone number. The customer enters the code to confirm the order. This adds a small amount of friction but significantly reduces fake orders. This can be implemented later using a service like Twilio or MessageBird — it is not required for launch.

### 5.2 Address Blacklisting

If a delivery to a specific address results in a no-show (customer doesn't answer the door, refuses to pay), that address is flagged in the system. Future cash orders to that address are blocked, and a message is shown: "Cash on delivery is not available for this address. Please pay by card." The admin can manage the blacklist through the admin dashboard.

### 5.3 Rate Limiting

Guests are limited to a maximum of 3 orders per day from the same phone number. This prevents someone from placing multiple small cash orders to circumvent the per-order limit. Registered users have no daily order limit.

### 5.4 Duplicate Detection

If a guest places an order with the same phone number and delivery address as a currently active order, the system warns them: "You already have an active order being delivered to this address. Would you like to add items to your existing order instead?" This prevents accidental duplicates and deliberate abuse.

---

## 6. Database Changes

The following changes support the tiered system.

### 6.1 Users Table Updates

| Column | Type | Description |
|--------|------|-------------|
| trust_tier | varchar | "guest", "verified", "trusted", "restricted" |
| successful_deliveries | integer | Count of completed deliveries |
| no_show_count | integer | Count of no-show incidents |
| tier_updated_at | timestamp | When the tier last changed |

### 6.2 Guest Orders Table (New)

Guest orders need to be tracked separately since the guest has no user account.

| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| phone_number | varchar | Guest's phone number (primary identifier) |
| full_name | varchar | Guest's name |
| email | varchar | Optional email |
| delivery_address | text | Full delivery address |
| eircode | varchar | Eircode |
| order_id | integer | Foreign key to orders table |
| created_at | timestamp | When the guest order was placed |

### 6.3 Address Blacklist Table (New)

| Column | Type | Description |
|--------|------|-------------|
| id | serial | Primary key |
| address | text | Blacklisted delivery address |
| eircode | varchar | Blacklisted Eircode |
| reason | varchar | Why it was blacklisted (e.g., "no-show") |
| blocked_payment_methods | varchar | "cash" or "all" |
| created_by | integer | Admin user who added it |
| created_at | timestamp | When it was blacklisted |

---

## 7. UI/UX Considerations

### 7.1 Guest Checkout Form

The guest checkout form should be minimal and fast. Only four fields are required: name, phone, address, and Eircode. The email field is shown but marked as optional. The form should auto-detect the Eircode from the address if possible (using an Eircode lookup API), and auto-fill the address from the Eircode if the customer enters that first.

### 7.2 Limit Reached Message

When a guest or verified user hits their spending limit, the message should be helpful rather than blocking. An example for a guest hitting the €25 cash limit:

> **Your cart total is €32.50**
>
> Guest cash orders are limited to €25 for security. You have two options:
>
> 1. **Pay by card** — Guest card orders are accepted up to €100
> 2. **Create a free account** — Unlock €50 cash limit and save your details for faster checkout next time
>
> [Pay by Card] [Create Account] [Reduce Cart]

### 7.3 Post-Order Account Prompt

After a guest successfully places an order, the order confirmation screen includes a soft prompt to create an account. The prompt highlights practical benefits (order tracking, saved address, higher limits) rather than abstract ones. If the guest provided an email, the account creation only requires setting a password — all other details are pre-filled from the order.

---

## 8. Implementation Priority

The tiered system can be implemented incrementally. Not everything is needed for launch.

| Priority | Feature | When |
|----------|---------|------|
| 1 | Guest checkout (name, phone, address) | Launch |
| 2 | Per-order spending limits (guest vs registered) | Launch |
| 3 | Friendly limit-reached messages with upsell | Launch |
| 4 | Post-order account creation prompt | Launch |
| 5 | Tier progression (guest → verified → trusted) | Week 1 post-launch |
| 6 | Address blacklisting | Week 1 post-launch |
| 7 | Rate limiting (3 orders/day for guests) | Week 1 post-launch |
| 8 | Duplicate order detection | Week 2 post-launch |
| 9 | Phone number SMS verification | Future (when volume justifies cost) |
| 10 | Restricted tier (auto-downgrade on no-show) | Week 2 post-launch |

---

## 9. Summary

The guest checkout with tiered trust system balances two competing goals: making it as easy as possible for legitimate customers to place orders, and making it as difficult as possible for bad actors to abuse the cash-on-delivery system. By starting with conservative limits and progressively unlocking higher limits as trust is established, WESHOP4U can offer the convenience of guest checkout without exposing the business to significant fraud risk. The system is designed to be invisible to good customers — they naturally progress through the tiers without even noticing the limits — while creating meaningful barriers for anyone attempting to abuse the platform.
