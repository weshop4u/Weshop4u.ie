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
- [ ] Order confirmation
- [ ] Real-time order tracking on map
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
