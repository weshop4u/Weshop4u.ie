# WESHOP4U Website Development Plan

**Domain:** weshop4u.ie
**Project:** Full-featured customer-facing website mirroring the mobile app
**Date:** February 2026

---

## 1. Executive Summary

The WESHOP4U website at weshop4u.ie will serve as a full-featured ordering platform that mirrors the mobile app's functionality, providing customers with an alternative way to browse stores, place orders, and track deliveries through any web browser. The website will share the same backend, database, and authentication system as the mobile app, ensuring all orders, products, and user accounts remain in sync across both platforms. In the event the mobile app experiences downtime, the website acts as a complete fallback, and vice versa.

The website will also serve as a marketing and SEO presence, making WESHOP4U discoverable through search engines and providing essential business information such as delivery areas, store partners, and contact details.

---

## 2. Architecture Overview

The website and mobile app will share a unified backend, meaning every order placed on the website appears instantly on the store's tablet dashboard, the driver's app, and the admin panel — exactly as if it were placed through the mobile app.

| Component | Technology | Notes |
|-----------|-----------|-------|
| Frontend | React (Next.js or standalone React) | Server-side rendering for SEO, responsive design |
| Backend | Existing Express + tRPC server | Shared with mobile app — no duplication |
| Database | Existing PostgreSQL | Same orders, users, products, stores |
| Authentication | Shared auth system | Same accounts work on app and website |
| Hosting | Vercel, Railway, or VPS | Connected to weshop4u.ie domain |
| CDN/Assets | Existing S3 storage | Same product images and store logos |

---

## 3. Key Features

### 3.1 Public Pages (No Login Required)

These pages are accessible to everyone and serve both marketing and functional purposes.

**Home Page** — The landing page features the WESHOP4U neon logo on a dark header bar, a hero section explaining the 24/7 delivery service, a list of available stores with logos and open/closed status, and a clear "Order Now" call-to-action. The page is optimised for SEO with proper meta tags, structured data, and fast loading times.

**Store Browsing** — Customers can browse any store's full product catalogue organised by category, view product images, descriptions, and prices, and use search and sort filters (A-Z, price low/high). This mirrors the mobile app's store detail screen exactly.

**About Us** — A page describing WESHOP4U's mission, delivery areas covered, and the 24/7 promise. Content can be migrated from the existing weshop4u.ie website.

**Contact Page** — Displays the phone number (0894 626262), email (Weshop4u247@gmail.com), and optionally a contact form. This is important for customer trust and for Google Business Profile linking.

**Terms & Conditions and Privacy Policy** — Essential legal pages required for GDPR compliance in Ireland and for app store submissions. These cover data collection, cookie usage, payment processing, and delivery terms.

### 3.2 Customer Ordering Flow

The core ordering experience on the website follows the same flow as the mobile app.

**Guest Checkout** — Customers can place orders without creating an account. They provide their name, phone number, delivery address, and Eircode at checkout. Guest orders are subject to tiered limits (detailed in the Guest Checkout document). This is critical for conversion — many customers abandon checkout when forced to register.

**Registered User Checkout** — Customers who create an account benefit from saved addresses, order history, faster repeat ordering, and higher spending limits. Registration requires email verification.

**Shopping Cart** — A persistent cart that survives page refreshes (stored in localStorage or cookies). Customers can add items from a single store, adjust quantities, and see a running total including service fee and delivery fee.

**Checkout** — The checkout page collects delivery address and Eircode (with auto-geocoding for delivery fee calculation), payment method selection (cash on delivery or card via Elavon), optional delivery notes, and the substitution preference checkbox.

**Order Tracking** — After placing an order, customers see a real-time tracking page showing order status updates (accepted, preparing, ready for pickup, on the way, delivered), driver assignment with display number, estimated delivery time, and live chat with the driver.

**Order History** — Registered users can view past orders, reorder previous items, and see receipts.

### 3.3 User Authentication

**Registration** — Email and password registration with mandatory email verification. The verification email contains a confirmation link that activates the account.

**Login** — Email and password login, shared with the mobile app. A customer who registers on the website can log into the mobile app with the same credentials, and vice versa.

**Password Reset** — Standard forgot-password flow via email link.

### 3.4 Store Dashboard (Web Access)

The existing store dashboard (currently accessed through the mobile app) will also be accessible through the website. Store staff can open it in Chrome on any device — including the POS terminal or a laptop — to manage incoming orders, accept/reject them, and trigger receipt printing.

### 3.5 Admin Dashboard (Web Access)

The admin dashboard is already built and accessible via the web. It will be linked from the website's admin login route.

---

## 4. Responsive Design Strategy

The website must work well across three breakpoints, with mobile-first design principles.

| Breakpoint | Target | Layout |
|-----------|--------|--------|
| Mobile (< 640px) | Phone browsers | Single column, bottom navigation, touch-optimised buttons |
| Tablet (640px–1024px) | iPad, Android tablets | Two-column product grid, side cart panel |
| Desktop (> 1024px) | Laptop/desktop | Three-column product grid, persistent cart sidebar, full navigation bar |

The mobile web experience should feel nearly identical to the native app, so customers switching between the two feel at home.

---

## 5. SEO and Marketing Considerations

The website provides WESHOP4U with a searchable web presence that the mobile app alone cannot offer.

**Search Engine Optimisation** — Each store page and category page will have unique, descriptive URLs (e.g., weshop4u.ie/stores/spar-balbriggan/drinks), proper title tags and meta descriptions, Open Graph tags for social media sharing, and structured data (JSON-LD) for local business and product listings.

**Google Business Profile** — The website URL can be linked to a Google Business Profile for "WESHOP4U" in Balbriggan, improving local search visibility for queries like "delivery near me" or "24 hour delivery Balbriggan."

**Social Media Integration** — Share buttons on the homepage and store pages, and proper Open Graph images so links shared on Facebook, WhatsApp, or Twitter display the WESHOP4U logo and description.

---

## 6. Development Timeline

The timeline below assumes focused development sessions. Each phase builds on the previous one.

| Phase | Duration | Deliverables |
|-------|----------|-------------|
| **Phase 1: Foundation** | 1–2 sessions | Project setup, routing, shared API client, responsive layout shell, home page with store list |
| **Phase 2: Store & Products** | 1–2 sessions | Store detail page, category browsing, product grid, search/sort, product detail modal |
| **Phase 3: Cart & Checkout** | 1–2 sessions | Shopping cart, guest checkout flow, address/Eircode entry, delivery fee calculation, order placement |
| **Phase 4: Elavon Payment** | 1 session | Card payment integration via Elavon Converge (detailed in separate document) |
| **Phase 5: User Accounts** | 1 session | Registration with email verification, login, password reset, order history, saved addresses |
| **Phase 6: Order Tracking** | 1 session | Real-time order status page, driver info, live chat |
| **Phase 7: Static Pages** | 1 session | About us, contact, terms & conditions, privacy policy, FAQ |
| **Phase 8: Polish & Deploy** | 1–2 sessions | SEO optimisation, performance tuning, domain connection, SSL, final testing |

**Total estimated effort:** 8–12 development sessions

---

## 7. Domain and Hosting

You already own **weshop4u.ie**. When the website is ready for deployment, the steps are:

1. Choose a hosting provider (Vercel is recommended for React/Next.js — free tier available, automatic SSL, fast global CDN)
2. Point the weshop4u.ie DNS records to the hosting provider
3. Configure SSL certificate (automatic with Vercel/Cloudflare)
4. Set up the backend API endpoint (either as a subdomain like api.weshop4u.ie or on the same server)
5. Test all flows end-to-end on the live domain

---

## 8. Content Migration

The existing weshop4u.ie website has content that should be migrated or adapted for the new site, including the About Us page content, any existing customer testimonials, store descriptions and images, and contact information. This ensures continuity for existing customers who know the brand.

---

## 9. Dependencies and Prerequisites

Before starting website development, the following should be in place:

| Prerequisite | Status | Notes |
|-------------|--------|-------|
| Backend API running | Done | Shared with mobile app |
| Product data imported | Done | Spar (2,910) and Open All Ours (154) |
| Store logos uploaded | Done | Both stores have logos |
| Elavon credentials | Available | Needed for card payment integration |
| Email service | Needed | For email verification and order confirmations (e.g., SendGrid, Resend, or AWS SES) |
| WESHOP4U logo (high-res) | Available | Neon logo PNG provided |
| Terms & conditions text | Needed | Legal content for T&C and privacy policy pages |

---

## 10. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Website goes down | Mobile app continues to work independently (separate deployment) |
| Mobile app goes down | Website serves as complete fallback for ordering |
| Both go down | Phone orders via admin dashboard (already built) |
| SEO takes time | Start with Google Business Profile for immediate local visibility |
| Guest checkout abuse | Tiered limits and phone verification (detailed in Guest Checkout document) |
