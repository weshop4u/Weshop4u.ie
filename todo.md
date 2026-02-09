# WESHOP4U Project TODO

## Branding & Design
- [x] Update theme colors to neon cyan and magenta
- [x] Integrate WESHOP4U logo into app
- [x] Create app icon from logo
- [x] Update app name and branding in config

## Database Schema
- [x] Users table (customers, drivers, store staff, admin)
- [x] Stores table (name, address, hours, contact, logo)
- [x] Products table (name, description, price, images, SKU, stock)
- [x] Product categories table
- [x] Orders table (customer, store, status, payment method, delivery fee)
- [x] Order items table (order, product, quantity, price)
- [x] Drivers table (user, vehicle info, zone, status)
- [x] Delivery zones table
- [x] Order tracking table (driver location, status updates)

## Backend API
- [ ] User authentication (register, login, JWT)
- [x] Store management endpoints
- [x] Product CRUD endpoints
- [x] Order creation and management
- [ ] Driver assignment logic
- [x] Distance calculation for delivery fees
- [ ] Real-time order status updates
- [ ] Push notification system

## Customer App
- [ ] User registration and login
- [x] Browse stores by category
- [x] View store details and hours
- [x] Browse products within store
- [ ] Search products
- [x] Shopping cart
- [x] Checkout flow
- [x] Payment method selection (Card/Cash on Delivery)
- [x] Order confirmation
- [x] Real-time order tracking screen
- [ ] Order history
- [ ] User profile management
- [ ] "Get something similar if out of stock" option

## Driver App
- [ ] Driver login
- [ ] Online/Offline status toggle
- [ ] Job offer notifications with 15-second timer
- [ ] Accept/Decline job offers
- [ ] View order details
- [ ] Navigation to store
- [ ] "Order on the way" button
- [ ] Navigation to customer
- [ ] "Job complete" button
- [ ] Daily earnings summary
- [ ] Order history

## Store Web Dashboard
- [ ] Store staff login
- [ ] Incoming order notifications with alarm
- [ ] Accept/Reject orders
- [ ] View order details
- [ ] Product management (add, edit, delete)
- [ ] Inventory management
- [ ] Order history
- [ ] Store settings

## Real-time Features
- [ ] Driver location tracking
- [ ] Order status updates
- [ ] Push notifications for customers
- [ ] Push notifications for drivers
- [ ] Push notifications for stores
- [ ] Automatic driver dispatch system
- [ ] 15-second job offer timeout

## Payment Integration
- [ ] Elavon payment gateway integration
- [ ] Card payment processing
- [x] Cash on Delivery support
- [x] 10% service fee calculation
- [x] Distance-based delivery fee calculation
- [ ] Payment status tracking

## Additional Features
- [ ] Multi-store support
- [ ] Store categories (convenience, restaurant, hardware, etc.)
- [ ] Product import from CSV
- [ ] Driver zones management
- [ ] Order analytics for admin
- [ ] Store onboarding system

## UI Improvements (User Feedback)
- [x] Remove 24/7 badges from store listings
- [x] Show product categories first in store detail screen
- [x] Display products grouped by category

## Store Management Updates
- [x] Add Eircode field to stores table
- [x] Hide stores except Spar Balbriggan and Open All Ours
- [x] Update distance calculation to use Eircode/address
- [x] Add proper address and Eircode data to active stores

## Geocoding Integration
- [x] Set up Google Maps API key in environment variables
- [x] Create geocoding service to convert Eircode to GPS coordinates
- [x] Update checkout flow to accept Eircode input
- [x] Integrate real-time distance calculation using geocoded coordinates
- [x] Update delivery fee calculation to use actual distance

## Delivery Fee Update
- [x] Update base distance from 3.5km to 2.8km in backend calculation
- [x] Update base distance from 3.5km to 2.8km in frontend calculation
- [x] Test new formula: 3.2km should = €3.90

## Customer Order Flow Completion
- [x] Create order placement API endpoint
- [x] Integrate order placement with checkout screen
- [x] Build order confirmation screen with order details
- [x] Create order tracking screen with status visualization
- [ ] Add order history view for customers
- [x] Test complete flow: browse → cart → checkout → place order → track

## Checkout UX Improvements
- [x] Split address input into separate "Street Address" and "Eircode" fields
- [x] Add clearer placeholder text for Irish addresses
- [x] Test address + Eircode geocoding

## Driver App Development
- [x] Create driver app navigation structure (tabs)
- [x] Build driver home screen with online/offline toggle
- [x] Create job offer screen with order details
- [x] Implement 15-second countdown timer for job offers
- [x] Build accept/decline functionality
- [x] Create active delivery screen
- [x] Add navigation to store location
- [x] Add navigation to customer location
- [x] Implement "Picked Up Order" status update
- [x] Implement "Delivery Complete" status update
- [x] Build daily earnings summary screen
- [x] Create driver backend API endpoints
- [x] Test complete driver flow

## Store Dashboard (Web Interface)
- [x] Create store dashboard layout and navigation
- [x] Build main counter view showing all incoming orders
- [x] Add accept/reject order functionality
- [x] Implement order status updates (Accepted → Preparing → Ready for Pickup)
- [x] Create deli-specific view filtered by deli category products
- [x] Add flexible "Mark Ready" buttons (accessible by both counter and deli staff)
- [ ] Implement audio/visual alerts for new orders
- [ ] Build order history and daily sales view
- [x] Create store backend API endpoints
- [ ] Add store authentication and login
- [x] Test complete store workflow (accept → prepare → ready → driver pickup)

## User Authentication System
- [x] Create authentication backend API endpoints (register, login, logout)
- [x] Implement password hashing with bcrypt
- [x] Build customer registration screen
- [x] Build customer login screen
- [x] Create driver registration screen with vehicle details
- [x] Create driver login screen (uses same login screen with role-based routing)
- [x] Build store staff login screen
- [x] Implement role-based routing (customer → home, driver → driver home, store → store dashboard)
- [ ] Add session management and token storage
- [ ] Create profile management screens
- [ ] Add "Remember Me" functionality
- [x] Test complete authentication flow for all user roles
