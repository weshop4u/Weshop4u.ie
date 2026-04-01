# WESHOP4U Mobile App Design

## Design Philosophy
- **Mobile-first**: Optimized for portrait orientation (9:16) and one-handed usage
- **iOS HIG compliant**: Follows Apple Human Interface Guidelines for native feel
- **Neon aesthetic**: Cyan (#00E5FF) and Magenta (#FF00FF) brand colors with dark navy background
- **24/7 delivery focus**: Emphasize speed, convenience, and real-time tracking

## Screen List

### Customer App

1. **Home / Store Listing**
   - Hero section with WESHOP4U logo and tagline
   - Category filter tabs (All, Convenience, Restaurant, Grocery, etc.)
   - Grid of store cards with logo, name, category, 24/7 badge
   - Each card shows estimated delivery time

2. **Store Detail / Product Browsing**
   - Store header with name, category, address
   - Search bar for products
   - Product grid with images, names, prices
   - Add to cart buttons
   - Floating cart button (bottom-right) with item count badge

3. **Shopping Cart**
   - List of cart items with quantity controls (+/-)
   - Subtotal calculation
   - "Proceed to Checkout" button

4. **Checkout**
   - Delivery address input with GPS location
   - Distance and delivery fee display (calculated in real-time)
   - Order summary:
     - Products subtotal
     - Service fee (10%)
     - Delivery fee (distance-based)
     - Total
   - Payment method selection (Card / Cash on Delivery)
   - "Allow substitution if out of stock" checkbox
   - Customer notes textarea
   - "Place Order" button

5. **Order Tracking**
   - Order status timeline (Pending → Accepted → Preparing → On the Way → Delivered)
   - Driver location on map (when assigned)
   - Estimated delivery time
   - Order details summary
   - Contact driver button

6. **Order History**
   - List of past orders with date, store, total
   - Tap to view order details
   - "Reorder" button

### Driver App

1. **Driver Dashboard**
   - Online/Offline toggle
   - Current earnings today
   - Total deliveries today
   - "Waiting for jobs..." state

2. **Job Offer**
   - Full-screen modal with 15-second countdown timer
   - Store name and address
   - Customer delivery address
   - Delivery fee
   - Distance
   - Accept / Decline buttons

3. **Active Delivery**
   - Order details (items, customer info)
   - Navigation map to store (if not picked up)
   - Navigation map to customer (if picked up)
   - "Order Picked Up" button
   - "Order on the Way" button
   - "Delivered" button

### Store Dashboard (Web)

1. **Login**
   - Store selection dropdown
   - Email/password login

2. **Order Dashboard**
   - Incoming orders list with alarm sound
   - Order cards showing:
     - Order number
     - Customer name
     - Items list
     - Total amount
     - Delivery address
   - Accept / Reject buttons
   - "Mark Ready for Pickup" button

## Key User Flows

### Customer: Browse and Order
1. Open app → See store list
2. Tap store → Browse products
3. Add items to cart → Tap cart icon
4. Review cart → Tap "Checkout"
5. Enter delivery address → See distance and delivery fee calculated
6. Select payment method → Place order
7. Receive confirmation → Track order in real-time

### Driver: Accept and Deliver
1. Driver toggles "Online"
2. Job offer appears with 15-second timer
3. Driver taps "Accept"
4. Navigate to store → Pick up order
5. Tap "Order on the Way"
6. Navigate to customer → Deliver
7. Tap "Delivered" → Return to waiting state

### Store: Manage Orders
1. Store staff logs in
2. Alarm sounds for new order
3. Staff reviews order details
4. Taps "Accept"
5. Picks items from shelves
6. Taps "Ready for Pickup"
7. Driver arrives and collects

## Color Palette

- **Primary (Cyan)**: #00E5FF - Buttons, highlights, active states
- **Secondary (Magenta)**: #FF00FF - Accents, badges, notifications
- **Background**: #0A0E27 - Dark navy
- **Surface**: #1A1E3F - Cards, elevated surfaces
- **Text**: #FFFFFF - Primary text
- **Muted**: #9BA1A6 - Secondary text

## Typography

- **Headings**: Bold, 24-32px
- **Body**: Regular, 16px
- **Small**: Regular, 14px
- **Button**: Semibold, 16px

## Components

- **Store Card**: Rounded corners, shadow, logo, name, category badge
- **Product Card**: Image, name, price, add button
- **Button**: Rounded, gradient (cyan to magenta), white text
- **Badge**: Small pill shape, magenta background
- **Timer**: Large countdown with progress ring (for driver job offers)
