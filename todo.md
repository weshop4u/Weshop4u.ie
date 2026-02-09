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

## Push Notification System
- [x] Set up Expo push notification configuration
- [x] Request notification permissions on app launch
- [x] Register device push tokens in database
- [x] Create backend notification service
- [x] Build notification API endpoints (send to customer, driver, store)
- [x] Customer notifications: order status updates (accepted, preparing, driver assigned, on the way, delivered)
- [ ] Driver notifications: new job offers with countdown timer
- [ ] Driver notifications: order ready for pickup alerts
- [ ] Store notifications: new incoming orders with sound/visual alerts
- [ ] Handle notification tap actions (deep linking to relevant screens)
- [ ] Test complete notification flow for all user roles

## Cart Workflow Fixes
- [x] Create cart context provider for app-wide cart state
- [x] Change product tap behavior from immediate checkout to "Add to Cart"
- [x] Add cart icon with item count badge in store page header
- [x] Implement store restriction logic (prevent mixing stores)
- [x] Add "Replace cart items?" dialog when adding from different store
- [x] Add "View Cart" / "Proceed to Checkout" button
- [x] Test complete cart workflow: browse → add multiple items → checkout

## Cart Bug Fixes
- [x] Fix view cart button blocking back button (adjust positioning)
- [x] Update cart/checkout page to read from cart context instead of AsyncStorage
- [x] Test cart display shows correct items

## View Cart Button Position Fix
- [x] Move view cart button from top-left to bottom fixed position
- [x] Ensure back button is always visible in header

## Cart Page Navigation
- [x] Add back button to cart page header for returning to store

## Continue Shopping & Order History
- [x] Add "Continue Shopping" button to cart page
- [x] Create order history screen showing past orders
- [x] Add order details view (expand order to see items)
- [x] Implement reorder functionality (one-tap reorder from history)
- [x] Add order history navigation to app tabs (Orders tab added to bottom navigation)

## Customer Profile Completion
- [x] Create edit profile screen (update name, email, phone)
- [x] Build saved addresses management (add/edit/delete addresses)
- [x] Create payment methods management screen (placeholder for Elavon integration)
- [x] Implement working logout functionality
- [x] Update profile tab to link to all features
- [x] Test complete profile flow

## Profile Page Button Actions
- [x] Create notification preferences screen
- [x] Create help & support screen with contact info (Phone: 0894 626262, Email: Weshop4u247@gmail.com)
- [x] Create terms & conditions screen
- [x] Create privacy policy screen
- [x] Hide language & region option
- [x] Link all screens from profile tab

## Driver Mode Switching
- [x] Add "Switch to Driver Mode" option in customer profile
- [x] Create role switching logic in app
- [x] Update driver screens with "Switch to Customer Mode" option
- [x] Store current mode in AsyncStorage
- [x] Test switching between customer and driver modes

## Driver Mode Navigation Bug Fix
- [x] Debug router.replace not working - Alert.alert doesn't work on web
- [x] Remove Alert.alert dialogs for web compatibility
- [x] Use router.push for direct navigation
- [x] Verify navigation works end-to-end (customer ↔ driver)

## Driver Authentication & Authorization
- [x] Check backend for driver verification endpoint
- [x] Add driver role check in profile before allowing switch
- [x] Add authentication guard to driver screens
- [x] Show error message if non-driver tries to access
- [x] Test driver authentication flow

## Missing Driver Mode Button
- [x] Debug why button still not visible - conditional rendering hid it
- [x] Remove conditional rendering so button always shows
- [x] Fix button visibility
- [x] Verify button appears in UI between Payment Methods and Notifications

## Driver Access Control Verification
- [ ] Check current logged-in user's role in database
- [ ] Verify if authentication check is working properly
- [ ] Decide UX: hide button from non-drivers vs show error
- [ ] Implement proper role-based button visibility
- [ ] Test with non-driver user account

## Driver Dashboard Blank Screen Crash
- [x] Check browser console for error messages
- [x] Fix driver dashboard crash causing blank screen - added proper handling for not-logged-in state
- [x] Restore navigation functionality
- [x] Authentication guard now redirects gracefully when user not logged in

## Guest Checkout System (Card-Only Payment)
- [x] Update database schema to support guest orders (nullable customerId)
- [x] Add guest fields to orders table (guestName, guestPhone, guestEmail)
- [x] Update orders router to accept guest order data
- [x] Update cart screen to detect logged-in vs guest users
- [x] Add guest information form fields (name, phone, email)
- [x] Restrict guests to card payment only (hide cash option)
- [x] Update order creation to include guest data
- [x] Fix TypeScript errors in notification queries for null customerId
- [x] Write and run tests for guest checkout validation
- [x] Test guest checkout flow end-to-end
- [x] Verify card payment required for guests
- [x] Verify logged-in users still have both payment options

## Logout Functionality Bug
- [x] Investigate why logout button doesn't log user out - Alert.alert doesn't work on web
- [x] Fix logout to clear session/auth token from AsyncStorage
- [x] Fix logout to clear user data from app state (tRPC cache)
- [x] Fix logout to redirect to home screen
- [x] Remove Alert.alert confirmation for web compatibility

## Server-Side Logout Issue
- [x] Check if backend has logout endpoint to clear session cookie
- [x] Implement backend logout endpoint to clear session cookie
- [x] Update client logout to call backend endpoint before clearing local data
- [ ] Test logout fully clears session (user can't access profile after logout)
- [ ] Verify login page is accessible at /auth/login

## Add Login Button to Home Page
- [x] Add authentication detection to home page
- [x] Add "Log In" button to home page header when user not logged in
- [x] Navigate to /auth/login when button clicked
- [x] Test button appears for guests and hides for logged-in users

## Reposition Login Button
- [x] Move login button to better position (separate from hero section)
- [x] Test new placement looks professional and accessible

## Login Button Redesign
- [x] Fix login button positioning - currently awkward in top-left
- [x] Improve button styling to look professional on mobile
- [x] Test button placement looks good on mobile screen

## Login Bug Fix
- [x] Debug login not working after entering email and password
- [x] Check authentication endpoint and error handling
- [x] Fix login flow to properly authenticate users
- [x] Test login works end-to-end

## Authentication Password Hash Fix
- [x] Identified issue: plain text password in database instead of bcrypt hash
- [x] Generated proper bcrypt hash for user password
- [x] Updated database with correct password hash
- [x] Test login with correct credentials

## Remove Driver Sign Up Link
- [x] Remove "Driver Sign Up" link from login page
- [x] Drivers will be registered manually by admin
- [x] Login page automatically routes drivers to driver dashboard based on role

## Authentication System Improvements
- [x] Fix registration page - remove Alert.alert for web compatibility
- [x] Create admin panel for driver management
- [x] Add driver creation form with auto bcrypt hashing
- [x] Implement password reset functionality
- [x] Add forgot password link to login page
- [x] Test complete authentication flow

## Additional Features
- [x] Add admin panel link to Profile tab
- [x] Create driver list view at /admin/drivers
- [x] Display all drivers with vehicle info and status
- [x] Add store search functionality to home page
- [x] Test all new features

## Product Category Browsing
- [x] Add product categories to database schema
- [x] Create sample product categories for stores
- [x] Display real product categories on store page
- [x] Add category search/filter bar on store page
- [x] Improve category layout and visual design
- [x] Test category browsing functionality

## Category Improvements
- [x] Add category icons/images to category display
- [x] Show product count for each category
- [x] Create admin bulk product import tool
- [x] Add CSV upload functionality for products
- [x] Test category images and product import

## Category Image Replacement
- [x] Update category display to show images instead of emoji
- [x] Add image upload functionality to admin panel for categories
- [x] Test category image display on store pages

## Category Image File Upload
- [x] Add file picker to category management page
- [x] Implement image upload to S3 storage
- [x] Auto-save uploaded image URL to database
- [x] Test file upload functionality

## Image Upload Improvements
- [x] Add product image upload to bulk import page
- [x] Add product image upload to individual product editing
- [x] Add image preview before upload to all upload interfaces
- [x] Create batch category image upload with CSV mapping
- [x] Ensure file upload option available everywhere images are needed
- [x] Test all image upload features
