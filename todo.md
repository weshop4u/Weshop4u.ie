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
- [x] Restrict guests to card payment only (hide cash option) — UPDATED: now guests can use cash with €30 limit
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

## Product Management Features
- [x] Create product management page in admin panel
- [x] Display all products with search and filter
- [x] Add product editing with image upload
- [x] Add product deletion functionality
- [x] Test product CRUD operations

## Store Logo Upload
- [x] Add logo field to stores database schema
- [x] Create store logo upload in admin panel
- [x] Display store logos on store cards
- [x] Display store logos on store detail pages
- [x] Test store logo upload and display

## Order Status Notifications
- [x] Set up push notification permissions
- [x] Create notification service for order updates
- [x] Send notifications on order status changes
- [x] Test push notifications on device

## Order History with Reorder
- [x] Create order history page displaying past orders
- [x] Add reorder button to each order
- [x] Implement reorder functionality to add items to cart
- [x] Test order history and reorder feature

## Real-time Order Tracking Map
- [x] Create order tracking page with map
- [x] Display driver location on map
- [x] Calculate and show estimated arrival time
- [x] Update driver location in real-time
- [x] Test order tracking map functionality

## Driver App Interface
- [x] Create driver dashboard with available jobs list
- [x] Add accept/reject buttons for job offers
- [x] Implement navigation to pickup and delivery locations
- [x] Add order completion workflow
- [x] Test driver app interface

## Store Dashboard Improvements
- [x] Add real-time order notifications
- [x] Implement audio alerts for new orders
- [x] Create order queue management interface
- [x] Add quick status update buttons
- [x] Test store dashboard improvements

## Payment Method Selection
- [x] Add payment method selection to checkout
- [x] Support multiple payment options (card, cash on delivery)
- [x] Restrict cash option to logged-in users only
- [x] Test payment method selection

## SMS Notification System
- [x] Create SMS service integration for sending text messages
- [x] Send order confirmation SMS after order placement with store name
- [x] Send on-the-way SMS with tracking link when driver picks up order
- [x] Include store name in both SMS messages
- [x] Test SMS delivery for both confirmation and tracking messages

## Twilio SMS Integration
- [ ] Install Twilio SDK package
- [ ] Update SMS service with Twilio API calls
- [ ] Add environment variables for Twilio credentials
- [ ] Test SMS delivery with Twilio

## Twilio SMS Integration
- [x] Install Twilio SDK package
- [x] Update SMS service with Twilio API integration
- [x] Configure Twilio environment variables (Account SID, Auth Token, Phone Number)
- [x] Test Twilio credentials validation
- [x] Restart server with new environment variables

## Web Preview Fix
- [x] Fix React Native Maps import to work on web
- [x] Add conditional import for Maps components (native only)
- [x] Enable web preview for testing and development

## SMS Notification Bug Fix
- [x] Fix SMS not sending to logged-in users (only works for guest orders)
- [x] Fetch phone number from user profile for registered customers
- [x] Test SMS delivery after fix
- [x] Auto-fill delivery address from user profile in checkout
- [x] Leave Eircode field blank for user to enter manually

## Driver Login Redirect Bug
- [ ] Fix driver login redirect (currently shows customer home instead of driver dashboard)
- [ ] Test driver login and verify correct redirect
- [x] Fix logout not clearing session properly (user remains logged in after logout)
- [x] Create "Login Required" screen for profile tab when user is logged out
- [x] Add page reload after logout to clear all cached data
- [x] Test complete logout and driver login flow
- [x] Fix logout cookie clearing - switched to REST API logout endpoint with proper cookie handling
- [x] Fix logout - user remains logged in as Barry even after logout and login as Fergus (session not clearing)
- [x] Fix logout - ROOT CAUSE: sdk.authenticateRequest was hardcoded to return user ID 1 instead of looking up user from database
- [x] Fix authentication - replaced mock user with real database lookup by email from session cookie
- [x] Test complete authentication flow - login, logout, and role switching all working correctly

## Driver Login Redirect Bug (After Auth Fix)
- [x] Fix driver login redirect - drivers see customer home page instead of driver dashboard after login
- [x] Check login screen role-based routing logic
- [x] Updated login to use window.location.href on web for reliable redirect with full page reload
- [x] Ensure drivers are redirected to /driver after successful login
- [ ] Test driver login flow end-to-end

## Parallel Visibility Workflow Implementation
- [x] Fix driver available jobs query to show pending, accepted, and ready_for_pickup orders
- [x] Add status badges to driver job list (Waiting for Store, Being Prepared, Ready to Pick Up)
- [x] Remove reject button from store dashboard (only Accept & Start Preparing)
- [ ] Test complete flow: customer creates order → both store and driver see it immediately
- [ ] Verify driver can see order status changes in real-time

## Driver Active Delivery Screen Issues
- [x] Add back button to active delivery screen (driver gets stuck after accepting job)
- [x] Fix "Picked Up Order" button - now calls backend API to update status
- [x] Remove Alert.alert calls (not compatible with web)
- [x] Add loading and error states
- [ ] Test complete driver workflow: accept job → pick up → deliver

## Driver Dashboard Stats Not Updating
- [x] Fix driver dashboard to show real earnings from completed deliveries
- [x] Fix job count to show actual number of completed deliveries
- [x] Create backend query to calculate driver stats (total earned, jobs completed)
- [x] Update dashboard to fetch real stats instead of showing mock data
- [ ] Test stats update after completing a delivery

## Customer Notes Not Visible in Available Jobs
- [x] Add customer notes to available jobs query (backend)
- [x] Display customer notes in available jobs list (frontend)
- [x] Show notes prominently so drivers can see special instructions before accepting

## Customer Notes Not Showing on Active Delivery (Bug Fix)
- [x] Root cause: active delivery screen used mock data instead of real order data
- [x] Rewrote active delivery screen to use real order data from getById endpoint
- [x] Customer notes now shown at TOP of active delivery screen regardless of delivery status
- [x] Updated getById to include store info and product names for items
- [x] Real order items, payment info, store address all now from database

## Driver Stats Not Calculating Correctly (Bug Fix)
- [x] Root cause 1: updateStatus didn't set deliveredAt timestamp when marking delivered
- [x] Root cause 2: getStats filtered by deliveredAt which was null for old orders
- [x] Fix: updateStatus now sets acceptedAt, pickedUpAt, deliveredAt, cancelledAt timestamps
- [x] Fix: getStats uses createdAt as fallback when deliveredAt is null
- [x] Fix: getStats safely handles null deliveryFee values (no NaN)
- [x] Fix: acceptJob no longer changes status to picked_up (just assigns driver)
- [x] Verified: API returns correct stats (8 deliveries, €28.17 total)

## Driver Queue System
- [x] Create driver_queue and order_offers tables in database
- [x] Backend: queue management endpoints (join queue, leave queue, get position)
- [x] Backend: order assignment logic - offer to #1 driver with 15s accept window
- [x] Backend: cascade to next driver if current driver declines or 15s expires
- [x] Backend: after accepting delivery, driver moves to back of queue
- [x] Frontend: show queue position on driver dashboard ("#1 of 3 drivers online")
- [x] Frontend: polling every 3s to check for new order offers
- [x] Frontend: show incoming order offer with 15s countdown timer
- [x] Frontend: auto-expire and cascade if timer reaches 0
- [x] Update toggleOnline to add/remove driver from queue
- [x] Fix ID mismatch: all endpoints now use userId (30001) not driver table ID (1)
- [x] Trigger offerOrderToQueue when new order is placed
- [x] All API endpoints tested and working correctly

## Driver Offer System Bugs
- [x] Fix: offers not showing to driver when order is placed while driver is online
- [x] Fix: when driver goes online, offer any existing unassigned pending orders
- [x] Fix: getCurrentOffer re-offers unassigned orders when no active offer exists
- [x] Fix: ID mismatch - toggleOnlineStatus and getProfile now use userId
- [x] Tested: toggle online → offer created, offer expires → re-offered, full details returned

## Return Job Feature
- [x] Backend: create returnJob endpoint (clear driverId, revert status, re-offer to queue)
- [x] Backend: move returning driver to back of queue
- [x] Frontend: add "Return Job" button on active delivery screen (only before pickup)
- [x] Frontend: confirm dialog with reason selection (Car trouble, Personal emergency, Too far away, Other)
- [x] Button hidden after pickup (can't return once you have the food)
- [x] Test: accept job → return job → order status reverted to pending, driverId cleared, re-offered

## Return Job - Take Driver Offline
- [x] Change returnJob to remove driver from queue and set isOnline=false instead of moving to back
- [x] Driver must toggle back online when ready (naturally placed at back of queue)
- [x] Tested: accept → return → driver offline, removed from queue, 0 drivers online

## Return Job Tracker & Reason Required
- [x] Create job_returns table to log every return (driver_id, order_id, reason, returned_at)
- [x] Add totalReturns column to drivers table for lifetime count
- [x] Update returnJob backend to log return and increment counter
- [x] Add getReturnCount endpoint to check today's returns for a driver
- [x] Enforce reason required after 3+ returns in a day (backend validation with REASON_REQUIRED error)
- [x] Update frontend: show return count warning, make reason mandatory after threshold
- [x] Frontend shows warning badge with today's return count and error messages

## Offer Card Decline/Expiry Bugs
- [x] Fix: decline button doesn't remove offer from screen - timer just resets
- [x] Fix: timer counting to 0 resets to 16 instead of removing offer
- [x] Root cause: polling re-offers same order to same driver after decline/expiry
- [x] Backend: prevent re-offering an order to a driver who already declined/expired it
- [x] Frontend: properly clear offer state on decline and timer expiry

## Force-Offer FIFO System (No Cherry-Picking)
- [x] When driver goes online, auto-offer the OLDEST unassigned order (not just show a list)
- [x] Drivers must accept or decline the offered order — no browsing/picking from a list
- [x] Remove or hide the "View Available Jobs" button and available-jobs screen
- [x] Orders offered in FIFO order (oldest first) regardless of when driver came online
- [x] If driver declines, offer the NEXT oldest order they haven't declined yet
- [x] If no eligible orders exist, show "Waiting for delivery requests" state

## Decline = Auto-Offline + Re-offer on Toggle Online
- [x] Declining a job should auto-toggle the driver offline (remove from queue)
- [x] Frontend must update isOnline state to false after decline
- [x] When driver toggles back online, clear their decline/expiry history so ALL waiting jobs are eligible again
- [x] The same declined job should be re-offered if it's still the oldest unassigned order
- [x] FIFO force-offer must keep working for drivers toggling on/off repeatedly

## Active Delivery Screen Improvements
- [x] Add "Confirm Return" button after selecting a return reason (currently flow stops after selecting reason)
- [x] On confirm return: return job to queue, toggle driver offline, navigate back to driver dashboard
- [x] Fix "Back to Available Jobs" link → change to "Back to Dashboard"
- [x] Add delivery destination section showing customer address with Navigate button
- [x] "Keep Job" button should dismiss the return panel

## Active Delivery Flow Fixes (v2)
- [x] Remove "Back to Dashboard" button on active delivery — driver must complete or return the job
- [x] Fix return job confirm step not appearing after selecting a reason (e.g. Car trouble)
- [x] Driver flow should be locked: Pick Up → Navigate/Deliver Complete, OR Return Job to Queue

## Return Job Continue Button Bug (v3)
- [x] Continue button not visible - simplified to single-step: select reason → confirm section appears inline with Keep Job + Confirm Return buttons

## Confirm Return Button Invisible (v4)
- [x] Confirm Return button text/background not visible on device - switched to explicit inline styles (#EF4444 bg, #FFFFFF text)

## Waiting Orders Count on Driver Dashboard
- [x] Backend: add endpoint to return count of unassigned pending orders
- [x] Frontend: show waiting orders count/badge on driver dashboard when offline

## New Offer Notification Sound/Vibration
- [x] Trigger haptic vibration (double Warning pattern) when new offer arrives
- [x] Only trigger once per new offer (tracked via lastNotifiedOfferId ref)
- [x] Platform-safe: skips haptics on web

## Estimated Delivery Distance on Offer Card
- [x] Backend: calculate distance between store and customer using Haversine formula on lat/lng
- [x] Show estimated distance (km) on the offer card in a blue badge before driver accepts
- [x] Shows store-to-customer distance (null if coordinates unavailable)

## Earnings Breakdown Screen
- [x] Rewrote earnings screen with real data from enhanced getEarnings endpoint
- [x] 7-day bar chart showing daily earnings and delivery counts
- [x] Today/week/all-time summary cards with real data
- [x] Per-delivery breakdown with store name, order number, date, and amount
- [x] Stats overview with total earnings, deliveries, and average per delivery
- [x] Navigate back to driver dashboard

## Delivery Timer on Active Delivery Screen
- [x] Show elapsed time since driver accepted the order on the active delivery screen
- [x] Timer counts up (MM:SS format) updating every second, turns red after 30 minutes
- [x] Uses driverAssignedAt timestamp for accurate elapsed time

## Delivery Destination on Offer Card
- [x] Delivery address already shown on offer card (was implemented earlier)
- [x] Also shown on active delivery screen with Preview Route button

## Push Notifications for Background Order Alerts
- [x] Local push notification fired when new offer appears (expo-notifications)
- [x] Shows store name, delivery fee, and urgency message
- [x] Works when app is backgrounded with sound and max priority
- [x] Notification permissions requested on mount (native only)

## Delivery Summary Screen
- [x] Show a summary screen after driver completes delivery (inline on active-delivery page)
- [x] Display: earnings for this delivery, time taken, order number, store name
- [x] "Great job!" congratulatory message with confetti emoji
- [x] Button to return to dashboard (auto-offline)

## Real-Time Order Tracking for Customers
- [x] Customer order screen shows real-time status updates (polling every 5s)
- [x] Status timeline with timestamps: Placed → Accepted → Preparing → Ready → Picked Up → On The Way → Delivered
- [x] Show driver name when assigned in blue info card
- [x] Separate active orders (with tracking) from past orders

## Driver Rating System
- [x] Backend: created driver_ratings table and rateDriver endpoint
- [x] Customer UI: "Rate Your Driver" prompt on delivered orders with star rating and optional comment
- [x] Star rating selector (1-5 stars) with optional comment field
- [x] Backend: recalculates driver's average rating after each new rating
- [x] Prevents duplicate ratings per order

## Privacy: Remove Driver Info from Customer Tracking
- [x] Remove driver name from customer order tracking screen
- [x] Remove any driver vehicle/personal info from customer-facing screens
- [x] Keep "Rate Your Driver" feature available after delivery (anonymous rating)

## Customer Push Notifications for Status Changes
- [x] Send local push notification when order status changes (accepted, preparing, picked up, on the way, delivered)
- [x] Notifications work when app is backgrounded via expo-notifications
- [x] Show relevant message for each status with store name

## Estimated Delivery Time on Customer Tracking
- [x] Calculate estimated delivery time based on distance (~3 min/km + prep buffer)
- [x] Show estimated arrival time range on customer tracking screen
- [x] Estimate updates as status progresses (accepted → preparing → picked up → on the way)

## Daily Earnings on Driver Dashboard
- [x] Show daily earnings (today) alongside weekly earnings on the driver dashboard

## Driver Tipping (Card Payments Only)
- [x] Add tipAmount field to orders table in database schema
- [x] Show tip selection on checkout page only when payment method is card
- [x] Quick-select buttons: No Tip (default), €1, €2, €3, €5, Custom
- [x] Tip added to order total in real-time on checkout page
- [x] Breakdown shows: Subtotal, Delivery Fee, Driver Tip, Total
- [x] Backend: store tipAmount with order, include in total charge
- [x] Driver earnings: show tips separately from delivery fee
- [x] No tip option for cash orders (customer tips in person)
- [x] No post-delivery tipping — tip is locked at checkout
- [x] Driver offer card shows tip amount when present
- [x] Active delivery screen shows tip breakdown in delivery summary
- [x] Customer order history shows tip in order details
- [x] Driver earnings page shows tip totals (today, week, all-time)
- [x] Driver dashboard shows tip totals in earnings summary
- [x] Unit tests for tip calculation logic (13 tests passing)

## Server-Side Push Notifications
- [x] Review existing notification infrastructure (push tokens, notification service)
- [x] Driver push notifications: send real push alert when new job offer is assigned
- [x] Driver push notifications: alert when order is ready for pickup at store
- [x] Store push notifications: send push alert when new order comes in (fixed to query storeStaff table, sends to ALL staff)
- [x] Store dashboard: improved audio alert with repeating sound every 30s while orders pending
- [x] Store dashboard: flash banner and haptic feedback on new order arrival
- [x] Customer push notifications: server-triggered status change alerts (accepted, preparing, picked up, on the way, delivered)
- [x] Client-side push token registration hook (usePushNotifications) added to all user roles
- [x] Push notification listener on customer orders screen for instant refetch
- [x] Push notification listener on store dashboard for instant refetch
- [x] AppState listener on customer/store screens for foreground refetch
- [x] Root layout configures notification handler and channels
- [x] Unit tests for push notification service (16 tests passing)
- [x] All 41 tests passing across 3 test suites

## Authentication Improvements
- [x] Session persistence: keep users logged in across app restarts
- [x] Store auth token in SecureStore for persistent native sessions
- [x] REST login endpoint returns sessionToken for native storage
- [x] Customer login stores token in SecureStore + caches user in AsyncStorage
- [x] Store login stores token in SecureStore + caches user in AsyncStorage
- [x] useAuth hook validates cached user and restores session on launch
- [x] Web: instant display from localStorage cache, background API validation
- [x] Native: instant display from AsyncStorage cache, token-based auth
- [x] Auto-clear session on invalid/expired token
- [x] Password reset flow already existed (forgot-password screen)

## Saved Address Auto-Fill at Checkout
- [x] Fetch user's saved addresses on checkout screen
- [x] Horizontal scrollable address picker with saved addresses
- [x] Auto-fill default saved address on page load
- [x] Fall back to most recent order address if no saved addresses
- [x] Tap to switch between saved addresses (highlights selected)
- [x] "+New Address" button to clear and enter manually
- [x] Resets delivery fee calculation when address changes
- [x] Hidden for guest users (no saved addresses)

## Order Cancellation
- [x] Backend: cancelOrder endpoint (only allows pending status)
- [x] Expires pending order offers when order is cancelled
- [x] Sends push notification to store staff on cancellation
- [x] Cancel button on customer orders screen (only for pending orders)
- [x] Confirmation dialog before cancelling ("Are you sure?")
- [x] Clear error messages for non-cancellable orders
- [x] Cancelled orders show in past orders section
- [x] Unit tests for all three features (17 tests passing)
- [x] All 58 tests passing across 4 test suites

## Store Hours Enforcement
- [x] Opening hours fields already existed in stores table (isOpen247, openingHours JSON)
- [x] Set opening hours for existing stores (Spar 07:00-23:00, Centra 07:00-22:00)
- [x] Created store-hours utility (isStoreOpen, getTodayHours, getNextOpenTime, getWeeklyHoursSummary)
- [x] Display open/closed badge on store cards (home screen) with color coding
- [x] Show today's hours on store detail page with expandable weekly schedule
- [x] Block ordering from closed stores with clear banner and alert
- [x] "Opens at" message shown when store is closed
- [x] Handles midnight-crossing hours and closed days

## Product Search
- [x] Category search bar on store detail page (filters categories by name)
- [x] Product search bar within each category (filters by name and description)
- [x] Case-insensitive search with real-time filtering
- [x] "No results" state with clear search button
- [x] Search uses useMemo for performance

## Basic Admin Panel
- [x] Backend admin router with getDashboardStats, getAllOrders, getAllDrivers endpoints
- [x] Dashboard overview: today's orders, revenue, service fees, delivery fees, tips
- [x] Revenue summary: this week, this month, all time with order counts
- [x] Live status: active orders, online/available drivers, active stores
- [x] Order status breakdown with color-coded badges
- [x] Orders management page: filterable by status, expandable details with full breakdown
- [x] Driver management page: online/offline status, earnings today, vehicle info, ratings
- [x] Auto-refresh every 15-30 seconds for live data
- [x] Pull-to-refresh on all admin screens
- [x] Admin layout updated with all screen routes
- [x] Unit tests for store hours, admin stats, and product search (16 tests)
- [x] All 74 tests passing across 5 test suites

## Store Staff Test Account
- [x] Create store staff user account for Spar Balbriggan (spar@weshop4u.ie)
- [x] Link user to Spar store in store_staff table (user_id: 60001, store_id: 1, role: manager)
- [x] Verified store staff link in database

## Bug Fix: Store Dashboard Buttons Not Working
- [x] Root cause: /app/store/index.tsx was using mock data instead of real backend API
- [x] Rewrote /app/store/index.tsx with real tRPC API calls (updateStatus mutation)
- [x] Fixed getUserOrders backend to return store orders when user is store_staff
- [x] "Accept & Start Preparing" button now calls API to set status to preparing
- [x] "Mark Ready for Pickup" button now calls API to set status to ready_for_pickup
- [x] Orders move between tabs after status change (auto-refetch)
- [x] Added confirmation dialogs before status changes
- [x] Added push notification listener for new order alerts
- [x] Added pull-to-refresh and auto-refresh every 5 seconds

## Bug Fix: Store Dashboard Workflow Not Completing
- [x] Root cause: store/index.tsx was calling trpc.orders.updateStatus (doesn't exist) instead of trpc.store.acceptOrder/markOrderReady
- [x] Rewrote store/index.tsx to use correct store router endpoints with storeId parameter
- [x] Accept button now calls trpc.store.acceptOrder → moves order to Preparing tab
- [x] Mark Ready button now calls trpc.store.markOrderReady → moves order to Ready for Pickup
- [x] Preparing tab now shows orders correctly (uses store.getOrders with storeId)
- [x] Rewrote deli.tsx to use real backend data from trpc.store.getDeliOrders
- [x] Deli view now shows real orders with deli items, individual and bulk mark-ready buttons
- [x] Added confirmation dialogs, haptic feedback, pull-to-refresh, and auto-refresh to both views

## Bug Fix: Store Dashboard Buttons Still Not Working (Round 3)
- [x] Root cause: Alert.alert() doesn't work on web — replaced with window.confirm() for web
- [x] Switched buttons from className to style prop for reliable rendering
- [x] Added per-button loading state (acceptingId/markingReadyId) instead of global mutation state
- [x] Created Deli product category with 6 deli products (Chicken Fillet Roll, Breakfast Roll, Spicy Chicken Wrap, BLT Sandwich, Ham & Cheese Toastie, Sausage Roll)
- [x] Fixed getDeliOrders to dynamically find deli category by name instead of hardcoded categoryId 1
- [x] Deli view now uses real backend data with correct category filtering

## Store Dashboard: Missing Logout & Deli View
- [x] Add logout button to store dashboard header
- [x] Fix deli view web compatibility (replaced Alert.alert with window.confirm)
- [x] Deli view connected to real backend (trpc.store.getDeliOrders)

## Feature: Store Hours Management from Dashboard
- [x] Add backend endpoint for store staff to update opening hours (store.updateOpeningHours)
- [x] Add "Store Hours" screen accessible from store dashboard quick actions bar
- [x] Allow editing hours for each day of the week (24h time input)
- [x] Allow toggling open/closed for each day with Switch
- [x] Open 24/7 toggle option
- [x] Quick presets (7am-11pm, 8am-10pm, Mon-Sat 9-6)
- [x] "Apply to all days" shortcut per day
- [x] Save changes to database with staff authorization check

## Feature: Customer Order Tracking Improvements
- [x] Enhanced status timeline with numbered steps, colored indicators, and timestamps
- [x] Estimated delivery time banner based on distance and current status (~X min)
- [x] Improved visual design: card-based layout, delivery banner, progress indicators
- [x] Detailed timeline section showing all timestamps (placed, accepted, assigned, picked up, delivered)
- [x] Status-specific descriptions ("Your order is being prepared now", etc.)
- [x] Elapsed time display for current step
- [x] Delivered celebration banner and cancelled state handling
- [x] Auto-refresh every 8 seconds

## Feature: Driver Location Tracking
- [x] Add backend endpoint for driver to update location (drivers.updateLocation)
- [x] Add backend endpoint to get driver location for an order (drivers.getDriverLocation)
- [x] Update driver active-delivery screen to send location updates every 15s (web geolocation + native expo-location)
- [x] Show driver location on customer order tracking screen with Leaflet live map
- [x] Map shows store (shop emoji), delivery address (house emoji), and driver (car emoji) markers
- [x] Auto-fit bounds to show all markers
- [x] Native fallback message for non-web platforms
- [x] Location data also logged to order_tracking table for history

## Feature: Arrived at Store Step in Driver Flow
- [x] Add "Arrived at Store" button to driver active-delivery screen (between Going to Store and Picked Up)
- [x] Send notification to customer when driver arrives at store (drivers.notifyDriverAtStore endpoint)
- [x] Update driver delivery flow: Going to Store → Arrived at Store → Picked Up → Delivering → Delivered
- [x] Update customer order tracking timeline to show "Driver at Store" step (8 steps now)
- [x] Confirmation banner shown to driver after notifying ("Customer has been notified")
- [x] driver_at_store notification message added to notification service
- [x] Estimated delivery time updated for driver_at_store status

## Bug: Active delivery orders not visible on store dashboard
- [x] Fixed: storeId detection now uses store_staff table (see fix below)
- [x] Store dashboard correctly queries all active orders for the correct store

## Bug: Order not visible on store dashboard during active delivery
- [x] Root cause: storeId was being detected from getUserOrders (customer orders) instead of store_staff table
- [x] Added store.getMyStore endpoint to properly look up storeId from store_staff table
- [x] Updated store dashboard to use getMyStore for reliable storeId detection

## Bug: Driver cannot navigate back to dashboard during active delivery
- [x] Added "← Back to Dashboard" link at top of active-delivery screen
- [x] Added "Active Delivery in Progress" banner on driver dashboard that links back to active delivery
- [x] Banner shows order number and store name, polls every 5 seconds

## Feature: Driver at Store indicator on store dashboard
- [x] Show a visual indicator on the store dashboard when a driver has arrived at the store for an order
- [x] Include driver name and order number in the indicator (blue banner + per-order card indicator)
- [x] Make it prominent so staff can prepare the order (top-level banner + "Hand order to driver" action)
- [x] Backend updated to include tracking events and driver name in getOrders response

## Feature: Completed orders tab on store dashboard
- [x] Add a "Completed" tab to the store dashboard tab bar (scrollable tabs)
- [x] Show delivered and cancelled orders with timestamps
- [x] Display order totals and completion times
- [x] Sorted by most recently updated first

## Feature: Driver auto-redirect to active delivery on login
- [x] When driver logs in or opens the app, check for active delivery via getActiveDelivery query
- [x] Automatically redirect to active-delivery screen if one exists
- [x] Uses hasAutoRedirected flag to prevent redirect loops
- [x] Active delivery banner still visible on dashboard if driver navigates back

## Feature: Store notification sound
- [x] Play audio alert when a new order comes in on store dashboard (ascending major chord chime, plays twice)
- [x] Play audio alert when a driver arrives at the store (two quick high pings)
- [x] Use web Audio API for web platform (synthetic tones, no audio files needed)
- [x] Chat message notification sound (single soft ping)
- [x] Haptic feedback on native for both events

## Feature: Order preparation timer
- [x] Show elapsed time since order moved to "Preparing" status on each order card
- [x] Live-updating timer (MM:SS format, ticks every second)
- [x] Visual warning at 10+ min (amber) and overdue at 15+ min (red with border)
- [x] Timer uses tracking events or acceptedAt/updatedAt timestamps

## Feature: Customer-driver in-app chat
- [x] Created chat_messages database table (order_id, sender_id, sender_role, message)
- [x] Created backend endpoints: chat.sendMessage, chat.getMessages, chat.getUnreadCount
- [x] Reusable ChatPanel component with bubble-style messages
- [x] Added chat to customer order tracking screen (shows when driver assigned)
- [x] Added chat to driver active-delivery screen
- [x] Real-time polling (3s when expanded, 10s when collapsed)
- [x] Unread message count badge on collapsed chat button
- [x] Chat message notification sound for incoming messages
- [x] Auto-scroll to latest message
- [x] Chat only available during active order statuses

## Feature: Order receipt/invoice
- [x] Created receipt screen at /receipt/[orderId] with itemized order breakdown
- [x] Shows delivery fee, service fee, tip, and total with clear formatting
- [x] Added "View Receipt" button on delivered order tracking screen
- [x] Shows store name, order number, date, payment method, and delivery address

## Feature: Store product management
- [x] Added backend CRUD endpoints: getProducts, addProduct, updateProduct, deleteProduct, toggleProductStock
- [x] Added backend endpoints: getCategories, addCategory
- [x] Created product management screen at /store/products with search and category filter
- [x] Stats bar showing total, in-stock, and out-of-stock counts
- [x] Inline edit for product name, description, price, category
- [x] Toggle in-stock/out-of-stock with colored indicators
- [x] Soft delete (marks as inactive)
- [x] Add new category inline
- [x] Products button added to store dashboard quick actions

## Feature: Driver earnings dashboard
- [x] Enhanced earnings screen with period tabs (Today/Week/All Time)
- [x] Hero card with dynamic earnings, deliveries, tips, avg/delivery based on selected period
- [x] Delivery history filtered by selected period with count
- [x] Tip breakdown shown per delivery (fee + tip split)
- [x] Career summary section with total earnings, tips, deliveries, average
- [x] 7-day bar chart with daily breakdown
- [x] Payment schedule info banner

## Bug: Expo Go errors on Android
- [x] Fix expo-notifications Android warning — all notification calls wrapped with isExpoGo check + try/catch
- [x] Fix RNMapsAirModule not found — removed react-native-maps import from [id].tsx, redirects to Leaflet-based [orderId].tsx
- [x] Fix push token projectId missing — skip registration when no projectId available or in Expo Go
- [x] Fixed in: lib/notifications.ts, lib/notification-provider.tsx, hooks/use-push-notifications.ts
- [x] Fixed in: app/(tabs)/orders.tsx, app/driver/index.tsx, app/store/index.tsx, app/store-dashboard/index.tsx

## Bug: Logout doesn't fully clear auth state (FIXED)
- [x] Rewrote useAuth with shared auth state (event emitter pattern) so logout in one component updates ALL instances
- [x] Fixed profile.tsx logout to use useAuth().logout() + clear tRPC cache + clear AsyncStorage
- [x] Fixed store/index.tsx logout to use useAuth().logout() + clear tRPC cache
- [x] Native fetchUser now always validates against API (not just trusts SecureStore cache)
- [x] After logout, home screen shows login button immediately via shared state notification

## Bug: Store dashboard grey border area pushes order cards down (FIXED)
- [x] Root cause: ScrollView className="flex-1 p-4" caused layout issues on native
- [x] Fixed: replaced with style={{ flex: 1 }} + contentContainerStyle={{ padding: 16 }}
- [x] Removed flexGrow: 1 from contentContainerStyle which was stretching empty space
- [x] Empty state view uses inline style for reliable centering

## Bug: Driver "I've Arrived at Store" button not working (FIXED)
- [x] Investigate why button press doesn't trigger any action
- [x] Check backend endpoint drivers.notifyDriverAtStore
- [x] Check frontend button handler in active-delivery screen
- [x] Added console logging and disabled prop to prevent multiple presses
- [x] Implemented optimistic UI update - state changes immediately on button press
- [x] Added error handling to revert state if API call fails
- [ ] Test fix on Expo Go

## Bug: Driver job offer system not working (FIXED)
- [x] 8 orders waiting for driver but not being offered when driver logs in - ROOT CAUSE: getActiveDelivery was missing ready_for_pickup status
- [x] Driver "Arrived at Store" button not responding (no action on press) - Added debugging and button improvements
- [x] Active delivery disappears when driver navigates back to dashboard - Fixed by including ready_for_pickup in getActiveDelivery
- [x] Investigate driver queue/offer logic - Orders were assigned to driver but not showing as active
- [x] Fix job offer system to properly offer waiting orders - Fixed getActiveDelivery to include ready_for_pickup status
- [x] Fix active delivery persistence across navigation - Driver dashboard auto-redirect now works correctly
- [ ] Test complete workflow on Expo Go

## Bug: Platform-specific issues (FIXED)
- [x] "Arrived at Store" button works on web preview but not on Expo Go mobile - Replaced TouchableOpacity with Pressable for better native support
- [x] Customer chat panel not showing on customer order tracking screen - Added "accepted" status to showChat condition
- [x] Investigate TouchableOpacity behavior difference between web and native - Issue was with style array syntax
- [x] Simplified button styling with Pressable and function-based style prop

## Bug: "Arrived at Store" button still not working on Expo Go (CRITICAL)
- [ ] Button works on web preview but not on native Expo Go
- [ ] Pressable change didn't fix the issue
- [ ] Need to investigate if onPress is being called at all
- [ ] Check if deliveryStatus state is correct when button shows
- [ ] Verify API endpoint is reachable from native

## Bug: Checkout button infinite loading on Expo Go (CRITICAL)
- [ ] Customer can add items to cart but checkout button shows infinite loading spinner
- [ ] API call is failing or timing out
- [ ] Check server logs for errors
- [ ] Investigate orders.createOrder endpoint

## Bug: Driver "I've Arrived at Store" button error (FIXED)
- [x] Button shows Alert "Missing order or user information" - Fixed navigation in job-offer.tsx
- [x] orderId was not being passed in router.push from job-offer screen
- [x] Removed debug Alert dialogs


## Known Issues (To Fix Next Session)
- [ ] Driver buttons not working on Expo Go native (work on web preview)
  - [ ] "I've Arrived at Store" button shows "Missing orderId or userId" error
  - [ ] useAuth returns undefined on native but server logs show user is authenticated
  - [ ] Need to fix authentication persistence on native
- [ ] Order data not loading properly on native
  - [ ] order.driverId is undefined when button is pressed
  - [ ] May need to add loading states to disable buttons until data loads
- [x] Calculate Delivery Fee button was invisible (FIXED - changed to bg-primary with conditional text color)


## Bug: Driver receives job offers when offline (FIXED)
- [x] Jobs were being offered because local isOnline state wasn't synced with DB on mount
- [x] Fix: Load driver profile from DB on mount and sync isOnline state so polling is disabled when offline
- [x] Server already checks isOnline and isAvailable before offering
- [x] Tested: offline drivers don't receive offers


## Bug: Profile tab shows login prompt when user is already logged in (FIXED)
- [x] Root cause: Auth.User type didn't include role field, so profile couldn't detect user role
- [x] Fix: Added role to Auth.User type, useAuth stores role from API, login caches role in Auth.User
- [x] Profile tab now correctly detects logged-in user with role
- [x] Role-based sections (driver mode, store dashboard, admin) now visible

## Bug: Order tracking status not updating in real-time (FIXED)
- [x] Root cause: Manual setInterval(refetch, 8000) was unreliable and too slow
- [x] Fix: Switched to tRPC built-in refetchInterval: 5000 for more reliable 5-second polling
- [x] Status updates are correctly saved to database by updateStatus endpoint
- [x] Order tracking screen now polls every 5 seconds
- [x] Status mapping between driver actions and customer view verified


## Bug: Chat not visible on native (Expo Go) - only works on web preview (FIXED)
- [x] Root cause: currentUserId was loaded from AsyncStorage.getItem("userId") which was never set during login
- [x] Fix: Use useAuth().user?.id as primary source, added AsyncStorage.setItem("userId") during login, added fallback chain
- [x] Chat component renders correctly with userId from useAuth
- [x] Driver active-delivery already uses useAuth().user?.id correctly
- [x] Customer order-tracking now uses useAuth as primary source with AsyncStorage fallback


## Bug: Orders tab visible when not logged in (FIXED)
- [x] Orders tab was showing past orders even when user is not authenticated
- [x] Fix: Added useAuth check at top of OrderHistoryScreen, shows login prompt if !user
- [x] Orders are now only visible after authentication

## Bug: Profile tab shows login prompt after successful login (FIXED)
- [x] Root cause: useAuth state wasn't synced after login, so profile tab still saw user as null
- [x] Fix: Call await refreshAuth() after storing session token and before navigation
- [x] This ensures all useAuth instances have the latest user state when landing on home screen
- [x] Profile tab now correctly shows user info and role-based sections after login


## Bug: React Hooks order violation in Orders tab (FIXED)
- [x] "React has detected a change in the order of Hooks called by OrderHistoryScreen"
- [x] Root cause: tRPC query was called after conditional early return, violating Rules of Hooks
- [x] Fix: Moved tRPC query before the conditional return, added enabled: !!user option
- [x] Query is now disabled when user is not authenticated, preventing unnecessary API calls


## Bug: Chat button stuck at bottom of screen overlapping other UI elements (FIXED)
- [x] In active delivery screen, "Chat with Customer" button was positioned at the very bottom
- [x] Button was overlapping with back button and navigation elements
- [x] Fix: Added useSafeAreaInsets() and set marginBottom: Math.max(insets.bottom, 8) + 8
- [x] Chat button now has proper spacing from bottom edge on all devices

## Bug: Driver job not visible on login until toggling offline/online (FIXED)
- [x] Root cause: Local isOnline state starts as false, DB loads with true, but offer query doesn't trigger
- [x] Fix: When driverProfile loads with isOnline=true and local state was false, trigger immediate refetchOffer()
- [x] Driver online status is loaded from database on mount and applied immediately
- [x] If there's a pending offer when driver opens dashboard, it now appears without requiring toggle
- [x] Added 500ms delay to ensure query is enabled before refetch


## Bug: Chat text input hidden under keyboard on driver side (FIXED)
- [x] When driver expands chat panel, the text input field was hidden behind the keyboard/bottom UI
- [x] Root cause: Expanded chat panel was wrapped in View instead of KeyboardAvoidingView
- [x] Fix: Wrapped expanded chat panel in KeyboardAvoidingView with behavior="padding" on iOS, "height" on Android
- [x] Text input now moves up when keyboard appears, user can see what they're typing

## Bug: No visible chat button on customer side (FIXED)
- [x] Customer order tracking shows "Picked Up" status but chat button wasn't appearing
- [x] Root cause: currentUserId loading was async and showChat condition was evaluated before userId loaded
- [x] Fix: Simplified async loading logic, added debug logging, ensured useAuth is primary source
- [x] Chat button now appears correctly when driver picks up the order and all conditions are met

## Bug: Driver returns to wrong screen after completing delivery (FIXED)
- [x] After marking delivery as complete, driver was sent back to "Going to Store" / "At Store" screen
- [x] Root cause: No useEffect to sync local deliveryStatus state with order.status from server
- [x] Fix: Added useEffect that maps order.status to deliveryStatus on mount and when status changes
- [x] Driver now stays on "Delivered" screen with summary and "Back to Dashboard" button works correctly


## Bug: Driver chat button expanded but text input not pressable (FIXED)
- [x] Chat panel was visible and expanded on driver side
- [x] "Message customer..." text input field was visible but couldn't be tapped/focused
- [x] Root cause: KeyboardAvoidingView had fixed maxHeight: 350 which caused layout issues
- [x] Fix: Changed maxHeight to "50%" and added keyboardVerticalOffset for proper keyboard handling
- [x] Text input is now accessible and keyboard moves the input up correctly

## Bug: Customer chat button not visible at all (IN PROGRESS)
- [x] Order tracking shows "Picked Up" status with driver assigned
- [x] No chat button appears at the bottom of the customer order tracking screen
- [x] Added debug banner to show why chat isn't visible (displays values when showChat is false)
- [x] Removed redundant currentUserId check in ChatPanel rendering condition
- [ ] Waiting for user to test and report what the debug banner shows
- [ ] Likely causes: currentUserId is null, or status/driverId mismatch


## Bug: Driver keyboard hidden behind Android navigation bar (FIXED)
- [x] Chat text input "Message customer..." was at the very bottom of the screen
- [x] Android navigation bar (back button, home, recents) covered the text input
- [x] Fix: Added +8px to paddingBottom calculation in chat-panel.tsx input container
- [x] Now uses Math.max(insets.bottom, 8) + 8 for proper spacing above Android nav bar

## Bug: Timer keeps running after delivery complete (ALREADY FIXED)
- [x] Timer was continuing to run after driver marked delivery as complete
- [x] Fix was already implemented in previous session (lines 130-138 of active-delivery.tsx)
- [x] Timer properly checks if deliveryStatus === "delivered" and clears interval
- [x] No additional changes needed

## Bug: Customer chat not visible and debug banner not showing (FIXED)
- [x] Customer order tracking showed "Picked Up" but no chat button appeared
- [x] Debug banner was also not rendering
- [x] Root cause: Both ChatPanel and debug banner were inside ScrollView and being clipped
- [x] Fix: Moved both ChatPanel and debug banner outside ScrollView in order-tracking/[orderId].tsx
- [x] Chat button and debug banner now render correctly at the bottom of the screen

## Bug: Driver job not visible on login until toggle (FIXED)
- [x] When driver logs in, dashboard shows "You're Online" but no job offer appears
- [x] Job offer only appears after toggling offline then back online
- [x] Root cause: The offer query has enabled: !!user?.id && isOnline
- [x] When driverProfile loads and sets isOnline=true, the query doesn't re-run because isOnline state change happens in same render
- [x] Fix: Created separate useEffect that watches isOnline state and triggers refetchOffer() when it becomes true
- [x] This ensures the offer check runs AFTER isOnline state is updated and query is enabled

## Bug: Customer chat panel not visible (FIXED)
- [x] Driver can send messages and chat panel works on driver side
- [x] Customer order tracking shows "Picked Up" status but NO chat button/panel appears at all
- [x] Root cause: currentUserId was undefined because guest users don't have authUser
- [x] Fix: Changed loadUserId() to check AsyncStorage FIRST for guestUserId, userId, or user object
- [x] Only falls back to authUser if AsyncStorage checks fail
- [x] Added console logging to track which user ID source is used

## Bug: React render error when tracking new order (FIXED)
- [x] When customer places order and immediately clicks "Track Order", app shows red error screen
- [x] Error: "Maximum update depth exceeded" in cart-provider.tsx line 32
- [x] Root cause: saveCart() effect runs on every cart change, including initial load from AsyncStorage
- [x] loadCart() sets cart state → saveCart() runs → writes to AsyncStorage → triggers re-render → infinite loop
- [x] Fix: Added isInitialized flag that prevents saveCart() from running until after first loadCart() completes
- [x] Now saveCart() only runs when cart changes AFTER initialization

## Bug: Customer chat STILL not visible after fix (FIXED)
- [x] Previous fix did not work - customer still sees no chat panel when order is "Picked Up"
- [x] Order shows "Picked Up" status at 05:40, driver is assigned, but no chat button appears
- [x] Root cause: Customer was viewing order from "My Orders" tab (orders.tsx), not the order-tracking route
- [x] The order-tracking/[orderId].tsx screen has the chat panel, but orders.tsx did not have a way to access it
- [x] Fix: Added "Chat with Driver" button to active orders in orders.tsx that navigates to order-tracking route
- [x] Button only shows when driver is assigned and order status is active (accepted, preparing, ready_for_pickup, picked_up, on_the_way)

## Bug: React hooks ordering error when clicking "Track Order" after checkout (FIXED)
- [x] When customer places order and clicks "Track Order" button on receipt page, app crashes
- [x] Error: "React has detected a change in the order of Hooks called by OrderTrackingScreen"
- [x] Error: "Rendered more hooks than during the previous render"
- [x] Root cause: isTerminal and isActiveDelivery values changed between renders when order loaded
- [x] Fix: Added explicit || false to ensure these values are always boolean, preventing hooks from seeing different dependencies

## Bug: Infinite loop when clicking "Chat with Driver" button (FIXED)
- [x] When customer clicks "Chat with Driver" button in Orders tab, app crashes
- [x] Error: "Maximum update depth exceeded" in cart-provider.tsx line 32
- [x] Root cause: saveCart() was being called repeatedly during rapid state changes (navigation transitions)
- [x] Fix: Added isSavingRef to track if save is in progress and prevent concurrent saves
- [x] Now saveCart() waits for previous save to complete before running again

## Bug: Previous fixes applied to wrong files - errors still occurring on native (FIXED)
- [x] Error 1: "React has detected a change in the order of Hooks" still happening in /order-tracking/[id].tsx at line 51
- [x] Error 2: "Rendered more hooks than during the previous render" in /order-tracking/[id].tsx at line 11
- [x] Error 3: "Maximum update depth exceeded" still happening in cart-provider.tsx at line 32
- [x] Root cause: There are TWO order tracking files - [id].tsx and [orderId].tsx - fixes were applied to [orderId].tsx but errors are in [id].tsx
- [x] Fixed by moving useEffect hook before conditional returns in [id].tsx (lines 19-23)
- [x] Cart provider fix was already correctly applied with isSavingRef guard (lines 39, 49-54)
- [x] Both "Track Order" button and "Chat with Driver" button should now work without crashes

## Bug: Cart save loop still happening despite isSavingRef fix (FIXED)
- [x] Error: "Maximum update depth exceeded" in cart-provider.tsx line 32
- [x] REAL Root cause: TWO dynamic route files in order-tracking/ directory ([id].tsx and [orderId].tsx)
- [x] [id].tsx redirects to /order-tracking/${orderId} which matches [id].tsx again → infinite redirect loop
- [x] CartProvider error was a RED HERRING - it's the top-level component so React reports it there
- [x] Solution: Deleted [id].tsx entirely, keeping only [orderId].tsx as the single route
- [x] Also improved cart-provider with useRef/useCallback pattern and fixed reorder forEach(async) race condition

## Bug: Driver job offer system needs fixes
- [x] When countdown expires (driver doesn't accept), driver should be auto-toggled offline
- [x] When offline, banner should show "X jobs waiting" (e.g., "1 job waiting", "3 jobs waiting")
- [x] When driver toggles back online, they should be offered the oldest job first (longest waiting) - already implemented in server
- [x] Expired/declined jobs should go back into the queue - already implemented in server
- [x] Updated waitingOrdersCount to include all unassigned orders (pending, accepted, preparing, ready_for_pickup)

- [x] Remove "Chat Debug Info" box from order tracking screen - visible to customers
- [x] Bug: Driver not auto-toggled offline when countdown expires - fixed with autoToggleOffline callback, isAutoTogglingOffRef guard, and lastExpiredOfferId tracking

## Feature: Driver numbering system
- [x] Add driverNumber field to drivers table in DB schema
- [x] Admin can assign driver numbers (Driver 01, Driver 02, etc.)
- [x] Customer-facing screens show "Driver 01" instead of real name (chat, tracking, notifications)
- [x] Admin dashboard shows display number for orders
- [x] Driver number is reusable if driver leaves
- [x] Fixed orders.driverId join bug (was joining on drivers.id, now correctly joins on drivers.userId)

## Feature: Substitution checkbox visibility
- [x] Ensure cart has single global "get something similar" checkbox for entire order
- [x] Save substitution preference with the order in DB
- [x] Show "Customer allows substitutions" notice on store dashboard (only when ticked)
- [x] Show "Substitutions allowed" notice on driver offer card (only when ticked)
- [x] Show "Substitutions allowed" notice on driver active delivery screen (only when ticked)
- [x] Show nothing extra when box is NOT ticked

## Fix: Bottom safe area padding on Android
- [x] Audit all screens with bottom action buttons
- [x] Add useSafeAreaInsets().bottom padding to order confirmation screen
- [x] Add bottom padding to cart/checkout screen
- [x] Add bottom padding to order tracking screen
- [x] Add bottom padding to driver index screen
- [x] Add bottom padding to driver active delivery screen
- [x] Add bottom padding to store dashboard screen
- [x] Ensure buttons are not overlapped by Android navigation bar

## Future: GPS-Based Store Visibility (when expanding to multiple towns)
- [ ] Add location prompt or Eircode input to home screen before showing stores
- [ ] Update getStores API to accept latitude/longitude and filter by proximity
- [ ] Sort store results by distance from customer
- [ ] Cache customer location in AsyncStorage (with "Change location" option)
- [ ] Ensure store names include town (e.g., "Spar Balbriggan" vs "Spar Swords")
- [ ] Per-store maxDeliveryRadius field (default ~8 km)
- [ ] Note: Database and Haversine calculation already in place — straightforward to add when needed

## Future: Store Open/Closed Visibility (Option C — show all, sort open first)
- [ ] Show all stores at all times regardless of opening hours
- [ ] Open stores appear at top with green "Open" badge (already exists)
- [ ] Closed stores pushed to bottom with greyed-out styling and "Closed — Opens at X:XX AM" label
- [ ] Allow customers to tap into closed stores and browse menu
- [ ] Disable checkout/order placement for closed stores
- [ ] Show next opening time on closed store cards
- [ ] Note: Both current stores are 24/7 — implement when onboarding stores with limited hours

## Phase 1: Admin Dashboard (Priority — build first)
- [ ] Live order board showing all orders in real time with status (pending, accepted, preparing, ready, in delivery, delivered, cancelled)
- [ ] Order actions: assign/reassign driver, cancel order, complete order
- [ ] Driver management panel: view all drivers, online/offline status, assign display numbers
- [ ] Phone order entry form: select store, browse/search products, add items, enter customer name/phone/address/Eircode, select payment method, substitution preference
- [ ] Tag orders by source (app / website / phone) for reporting
- [ ] Customer lookup by phone number for repeat callers (pull up previous orders and saved address)
- [ ] Store monitoring: which stores have pending orders, order wait times
- [ ] Basic reporting: orders today, revenue, active drivers
- [ ] Alert when order pending too long without driver assignment (e.g., 5+ minutes)
- [ ] Admin authentication: admin role login at /admin route
- [ ] Real-time updates via polling or WebSockets

## Phase 2: Customer-Facing Website (weshop4u.ie)
- [ ] Home page with branding, hero banner, "Order Now" button, store listings
- [ ] Store detail page with product browsing by category
- [ ] Shopping cart and checkout flow (address, Eircode, payment method, substitution preference)
- [ ] Order tracking page with live status updates
- [ ] User registration and login (shared auth with mobile app)
- [ ] Order history page
- [ ] About us page (migrate content from old weshop4u.ie)
- [ ] Contact page (phone: 0894 626262, email: Weshop4u247@gmail.com)
- [ ] Terms & conditions and privacy policy pages
- [ ] Responsive design (desktop, tablet, mobile browser)
- [ ] Consistent branding matching the mobile app

## Phase 3: Integration & Polish
- [ ] Shared authentication between app and website
- [ ] End-to-end testing of all flows (app order, website order, phone order via admin)
- [ ] Migrate content/images from old weshop4u.ie
- [ ] DNS/domain setup guidance for pointing weshop4u.ie to new site
- [ ] SMS order confirmation for phone orders (optional)

## Admin Dashboard Enhancement (Current Sprint)
- [x] Add order action buttons: assign driver, reassign driver, cancel order, update status
- [x] Add order detail view with driver info, price breakdown, delivery address
- [x] Add phone order creation form (4-step: store select, product search, customer details, confirm)
- [x] Add driver display number assignment in driver management
- [x] Add order source tagging (phone orders get WS4U-PH prefix)
- [x] Add real-time auto-refresh (10s for orders, 15s for drivers, 30s for dashboard)
- [x] Add pending order alerts (yellow banner for orders waiting 5+ min without driver)
- [x] Enhance admin dashboard home with phone order quick-action button
- [x] Add cash/substitution badges to admin order views
- [x] Server: add admin endpoints for updateOrderStatus, assignDriver, createPhoneOrder, setDriverDisplayNumber, getAvailableDrivers, getStores, getStoreProducts

## Fix: Eircode required in phone order
- [x] Make Eircode field required (not optional) in phone order form
- [x] Update validation to prevent submission without Eircode

## Fix: Phone order improvements
- [x] Show service fee + delivery fee in step 3 (customer details) as soon as Eircode is entered, and in step 4 (review)
- [x] Fix Create Order button not working — replaced Alert.alert with web-compatible confirm modal overlay and success screen
- [x] Auto-fill customer name, address, eircode when phone number matches previous order (tRPC lookupCustomerByPhone endpoint)
- [x] Added server endpoint: calculatePhoneOrderFees (geocodes Eircode, calculates distance, delivery fee, service fee, total)
- [x] Added server endpoint: lookupCustomerByPhone (checks registered users and guest orders by phone)
- [x] Phone number field moved to top of customer details form with "enter first to auto-fill" hint
- [x] Fee preview box shows green "COST BREAKDOWN (tell customer)" panel with all fees in step 3
- [x] Eircode auto-triggers fee calculation after debounce (1 second)

## Bug Fix: Order Created screen text barely visible in light mode
- [x] Fix text colors on phone order success screen — replaced hardcoded dark theme colors with useColors() theme-aware colors
- [x] Use theme-aware colors (colors.foreground, colors.muted, colors.surface, colors.border)

## Bug Fix: Driver creation fails with NaN user_id
- [x] Fix SQL insert error: NaN for user_id — changed db.insert() to use array destructuring [result] to properly access insertId
- [x] Fixed same issue in registerCustomer endpoint for consistency
- [x] Both registerDriver and registerCustomer now use same pattern as working admin.createPhoneOrder

## Driver Display Number Improvements
- [x] Fix display number input field closing when tapped — moved expanded details outside TouchableOpacity, only header row triggers collapse
- [x] Auto-assign next available display number when creating a new driver account (finds lowest gap: 01, 02, 03...)
- [x] Recycle display numbers when a driver is deleted — algorithm always finds lowest available, so deleted numbers get reused
- [x] Show assigned display number in create-driver success message and in driver management list badge
- [x] Replaced Alert.alert in driver management with inline success/error messages (web-compatible)
- [x] Used theme-aware colors for display number input field

## Bug Fix: Display number not visible after saving
- [x] Display number saves but input field shows placeholder — fixed: added displayNumber to getAllDrivers select query
- [x] Added "Driver Number" row in expanded details section under Vehicle row showing #02 or "Not assigned"
- [x] Input field now shows current saved value after refetch (removed `as any` casts since type is now correct)
- [x] Header badge also shows #XX next to driver name when display number is set

## Feature: Manage Stores (Admin Dashboard)
- [x] Store list screen showing all stores with status, category, quick active toggle, and tap to edit
- [x] Store edit screen with 3 tabs: Details, Hours, Logo
- [x] Details tab: name, description, category picker, address, Eircode (auto-geocodes), phone, email, GPS display
- [x] Hours tab: 24/7 toggle, per-day open/close times with closed toggle per day
- [x] Logo tab: shows current logo, links to Upload Store Logos tool
- [x] Toggle store active/inactive from store list with Switch
- [x] Added "Manage Stores" button to admin dashboard (teal, prominent placement)
- [x] Server endpoints: getAllStoresAdmin, getStoreDetail, updateStore, updateStoreHours, toggleStoreActive, updateStoreLogo
- [x] Eircode change auto-triggers GPS re-geocoding

## Bug Fix: Store Logos "Invalid hook call" error
- [x] Fixed useMutation called inside handleUpload function — moved to component top level
- [x] uploadMutation now declared alongside updateMutation at component level, used in handler via mutateAsync

## Bug Fix: Category images showing garbled text instead of actual images
- [x] Root cause: local file:// URIs saved to DB instead of S3 URLs; server tried axios.get on local URI
- [x] Fixed: client now reads image as base64, sends to server, server uploads to S3 via storagePut
- [x] Fixed same issue in store-logos.tsx (uploadLogo was returning URI as-is)
- [x] Both categories and store logos now properly upload to S3 and display correctly
- [x] Also fixed useMutation hook-in-handler bug in both screens (moved to component level)

## Proactive Audit: Admin Dashboard Fixes
- [x] orders.tsx: Replaced Alert.alert with web-compatible cancel confirmation overlay + inline error banner
- [x] orders.tsx: Replaced all hardcoded dark theme colors with useColors() theme-aware colors in Assign Driver and Update Status modals
- [x] products.tsx: Replaced window.confirm with web-compatible delete confirmation overlay
- [x] products.tsx: Product image edit now reads base64 and sends data URI for S3 upload
- [x] products.tsx: Edit modal now uses theme-aware colors via useColors()
- [x] All admin screens verified: no remaining Alert.alert or window.confirm calls

## Proactive Audit: Customer-Facing Screens
- [x] cart/[storeId].tsx: Replaced 6x Alert.alert with inline error banners (web-compatible)
- [x] cart/[storeId].tsx: Fixed hardcoded colors in saved address picker and tip picker — uses theme tokens
- [x] (tabs)/orders.tsx: Replaced 3x Alert.alert with web-compatible cancel confirm overlay + inline messages
- [x] (tabs)/orders.tsx: Fixed hardcoded colors throughout — uses theme tokens for dark mode support

## Proactive Audit: Driver App Screens
- [x] active-delivery.tsx: Replaced Alert.alert with inline error state + banner
- [x] active-delivery.tsx: Fixed hardcoded colors in timer badge and delivery summary
- [x] job-offer.tsx: Replaced Alert.alert with inline state-based UI
- [x] earnings.tsx: Rewrote with full theme-aware colors via useColors()
- [x] driver/index.tsx: Already clean, no issues found

## Feature: Delete Driver (Admin)
- [x] Added deleteDriver server endpoint — checks for active deliveries before allowing deletion
- [x] Added red "Delete Driver Account" button in expanded driver details
- [x] Added confirmation overlay with warning text before deletion
- [x] Deletes driver record and associated user account
- [x] Returns freed display number in success message
- [x] Display number auto-recycled: registerDriver always picks lowest available number

## Product Import from CSV (Spar Balbriggan)
- [x] Build server endpoint to import products from CSV data
- [x] Filter CSV to only Spar/WeShop4U Main products (2,910 items)
- [x] Map CSV categories to app categories (create new categories as needed)
- [x] Strip HTML from product descriptions
- [x] Use existing weshop4u.ie image URLs directly
- [x] Handle uncategorized products (assign to "General" category)
- [x] Skip pending/draft products (only import published)
- [x] Handle duplicate product names within same store
- [x] Execute bulk import of 2,900 Spar products into store_id=1
- [ ] Verify imported products appear in customer app

## Category Management (Admin Dashboard)
- [x] Rename category feature
- [x] Time availability per category (per-day schedule for alcohol restrictions)
- [x] Option B: Show restricted products greyed out with "Available from X" message
- [x] 18+ age restriction badge on alcohol/tobacco categories
- [x] Category edit screen in admin dashboard (rename, time availability, age restriction, merge, delete, sort)
- [x] Irish alcohol hours preset (Mon-Sat 10:30-22:00, Sun 12:30-22:00)
- [x] Auto-detected 6 age-restricted categories during import
- [x] Block add-to-cart for restricted products outside hours with alert
- [x] Category availability utility with unit tests (21 tests passing)
- [x] Product images displayed in store product list

## Product Import from CSV (Open All Ours)
- [x] Filter CSV for Open All Ours products only (154 found)
- [x] Check Open All Ours store ID in database (store_id=2)
- [x] Create new categories from CSV data for Open All Ours (11 new categories)
- [x] Strip HTML from product descriptions
- [x] Use existing weshop4u.ie image URLs directly
- [x] Clean category names (removed 'Open All Ours' suffix from all categories)
- [x] Import all 154 products (both published and pending, per user request)
- [x] Execute bulk import of Open All Ours products — 154 inserted, 0 skipped
- [x] Verify imported products appear in customer app (157 total including 3 pre-existing)

## Bug: Store detail screen crashes when opening category (FIXED)
- [x] "Rendered more hooks than during the previous render" error at app/store/[id].tsx line 345
- [x] Root cause: useMemo for filteredProducts and getProductQuantity were after conditional return (selectedCategoryId === null)
- [x] Fix: Moved selectedCategory, categoryProducts, catAvailable, catAvailMsg, filteredProducts useMemo, and getProductQuantity before all conditional returns

## Feature: Product Sorting Filters
- [x] Add sort bar below search field with pill-shaped buttons
- [x] Sort options: A-Z, Z-A, Price Low to High, Price High to Low
- [x] Apply sorting to filtered products list
- [x] Persist sort selection while browsing category
- [x] 17 unit tests passing (sort + filter + combined)

## Feature: Product Detail Modal
- [x] Tap product card to open bottom sheet / modal
- [x] Large product image at top (or placeholder icon)
- [x] Full product name and full description (untruncated)
- [x] Price prominently displayed
- [x] Stock status indicator (out of stock badge)
- [x] Add to Cart button with quantity selector (+/-)
- [x] 18+ badge for age-restricted categories
- [x] Category availability message if restricted
- [x] Quick "Add" button on list still works for fast adds
- [x] Shows total price based on quantity (e.g. "Add to Cart · €7.00")
- [x] Shows "already in cart" indicator
- [x] Close button and tap-outside-to-dismiss
- [x] Haptic feedback on interactions

## Feature: AI-Generated Product Descriptions
- [x] Read server LLM capabilities from server/README.md
- [x] Build server endpoint to generate product descriptions via built-in LLM
- [x] Create bulk script to find all products missing descriptions
- [x] Run AI description generation on all 1,976 products without descriptions (0 errors, 139 batches)
- [x] Ensure admin dashboard has product description edit capability
- [x] Add indicator in admin for products missing descriptions (NO DESC badge + filter)

## Feature: Admin Product Editing
- [x] Product edit screen in admin dashboard (enhanced with full editing)
- [x] Edit product name
- [x] Edit product description (multi-line text area with MISSING indicator)
- [x] Edit product price
- [x] Edit product SKU
- [x] Edit product stock status (in stock / out of stock / low stock)
- [x] Edit product image (pick from gallery)
- [x] Change product category (horizontal scrollable category pills)
- [x] Delete product (with confirmation dialog)
- [x] Indicator for products missing descriptions (yellow NO DESC badge + filter pill)
- [x] Server endpoint for updating product details (name, desc, price, sku, stockStatus, categoryId)
- [x] Server endpoint for deleting products
- [x] Category filter pills in product list
- [x] Search by name or SKU
- [x] FlatList for performance with large product lists

## Bug: Driver earnings card text visibility (FIXED)
- [x] White text on cyan card had poor contrast — labels used rgba(255,255,255,0.7) which was too faint
- [x] Changed all labels to solid #ffffff, increased font size from 11 to 12, added fontWeight 600
- [x] Tips value changed from cyan (#00E5FF) to white for consistency

## Bug: Admin products screen - category bar clipped and edit modal empty (FIXED)
- [x] Category filter bar was clipped — removed maxHeight: 36, added paddingVertical: 4
- [x] Edit modal was empty — ScrollView had flex: 1 which collapsed to 0 inside the modal; changed to flexGrow: 0, flexShrink: 1 and added nestedScrollEnabled

## Bug: Category bar still clipped + JSON parse error on save (FIXED)
- [x] Category filter pills — added minHeight: 40 and alignItems: center to ensure full visibility
- [x] JSON Parse error — root cause: images stored as JSON string in DB, server was returning raw string. Fixed server to parse images JSON and return arrays. Removed all client-side JSON.parse of images. Also fixed handleSave to only send image when actually changed (not sending huge existing URLs unnecessarily)

## Bug: Product image disappears after editing (FIXED)
- [x] Root cause: previous code version was sending image field even when unchanged, corrupting the DB
- [x] Client fix: only send image in payload when a new image is actually picked (pendingImageBase64)
- [x] Server fix: added guard to only update images when value is a valid URL (http) or base64 (data:) and length > 10
- [x] Restored Mushrooms 250g image in database
- [x] No other corrupted images found in database

## Store Logo Display Bug
- [x] Fix store logos not visible on home page (showing generic emoji instead of actual logos)

## POS Printing System
- [x] Create print_jobs database table (store_id, order_id, status, content, created_at)
- [x] Build server endpoints for print job CRUD (create, poll, mark printed)
- [x] Build receipt formatting engine for 58mm thermal printer (58mm/32-char width)
- [x] Add "Print Pick List" button to store dashboard order view
- [x] Add auto-print toggle with item threshold in store settings
- [x] Build POS printer mode page (cloud print listener)
- [x] Add local print detection for POS standalone mode
- [x] Receipt format: order number, timestamp, customer name, address, items with quantities
- [x] Write tests for print job system (27 tests passing)
- [x] Fix Print button not visible on store dashboard - move outside expanded section so it's always visible on accepted/preparing orders

## Planning Documents
- [x] Website development plan for weshop4u.ie with key features and timeline
- [x] Elavon/Converge payment integration steps outline
- [x] Guest checkout user flow diagram with tiered system (guest limits, verified accounts)
- [x] Fix POS print showing page screenshot instead of formatted receipt — changed from hidden iframe to new window with receipt-only content

## Guest Checkout Flow
- [x] Add "Continue as Guest" / "Log In or Create Account" choice at checkout
- [x] Guest users can order with cash (€30 limit) or card
- [x] Guest checkout collects: name, phone number, address, Eircode
- [x] No account creation required for guest orders
- [x] Show guest limitations clearly (cash €30 limit, card available)
- [x] Verified/logged-in users get full access (card payments, no limit)

## Delivery Fee Warning Popup
- [x] Show warning popup when delivery fee is €10 or more
- [x] Message: "Delivery fee is over €10. Your delivery fee is €X.XX. Delivery may take longer than usual."
- [x] Popup appears after delivery fee is calculated on checkout screen
- [x] User must acknowledge before proceeding to place order

## Store Sorting by Distance
- [x] Get user's current location (GPS) or use delivery address
- [x] Calculate distance from user to each store
- [x] Sort stores by nearest first on home screen
- [x] Show distance badge on each store card
- [x] Handle location permission denied gracefully (fall back to default sort)

## POS Printer APK Research
- [x] Research 6000V-Lite PrinterTools SDK/API
- [x] Identified: /dev/ttyMT1 (mtk-uart) at 115200 baud via PrinterTools port settings
- [x] Built APK with native serial port printer integration

## POS Receipt Printer APK
- [x] Build standalone Android APK for 6000V-Lite POS
- [x] Serial port communication: /dev/ttyMT1 at 115200 baud
- [x] ESC/POS receipt formatting (store name, items, prices, totals)
- [x] Poll server for new orders and auto-print (5-second polling)
- [ ] Manual reprint button for past orders (future enhancement)
- [x] Generated signed APK file (weshop4u-printer.apk, 20KB)

## Feature: Auto-print receipt when staff accepts order
- [x] Auto-create print job when store staff accepts an order
- [x] Receipt prints automatically on POS without manual Print button tap
- [x] Flow: customer orders → staff accepts → print job created → POS APK prints receipt

## Feature: Persistent Alert Sounds for Orders
- [x] Source free alert sound options for driver/store notifications
- [x] Present sound samples to user for selection (user chose Option 1: Classic Alarm)
- [x] Implement repeating alarm sound on driver screen when new order offer arrives
- [x] Sound loops until driver accepts or declines the order
- [x] Phone vibrates in pattern alongside sound
- [ ] Screen wakes up to show order details (requires native build, not available in Expo Go)
- [x] Implement repeating alert on store dashboard for new incoming orders
- [x] Sound plays in iOS silent mode (setAudioModeAsync playsInSilentMode)

## Receipt Formatting Fixes
- [x] Replace € symbol with EUR in receipt formatting (fixes garbled characters on thermal printer)
- [x] Simplify order numbers to daily sequential format (001, 002, 003...)
- [x] Add phone number footer to receipt (Any problems Ring 089-4 626262)
- [x] Update receipt footer: remove "WESHOP4U -", keep only "weshop4u.ie"
- [x] Change "Thank you!" to "Thank You!"

## POS Print Changes
- [x] Remove auto-print on order accept (make printing manual only via Print Pick List button)
- [x] Ensure Print Pick List button always creates a new print job each time pressed

## Receipt Substitution Note
- [x] Add substitution preference to printed receipt (SUBSTITUTIONS ALLOWED / NO SUBSTITUTIONS)

## Driver & Receipt Improvements
- [x] Add customer phone number to printed receipt
- [x] Driver starts offline by default on login (must toggle online to receive jobs)
- [x] Fix sound alert when job offer arrives for driver

## Driver Alarm Sound Fix
- [x] Make alarm sound loop continuously every 3-4 seconds until driver accepts/declines or countdown expires
- [x] Only stop alarm on explicit user action (accept/decline), not on data refetch

## Store Order Numbers & Features
- [x] Implement store-specific sequential order numbers (WS4U/SPR/001, WS4U/OAO/001)
- [x] Add store short code field to stores table (SPR for Spar, OAO for Open All Ours)
- [x] Add looping alarm sound to store dashboard when new order arrives
- [x] Build quick test print endpoint (no login required)
- [x] Completed orders: show last 24 hours only, add order history for older orders

## Store Position/Placement Feature
- [x] Add sortPosition field to stores table in database
- [x] Update customer-facing store list to sort by position first, then distance
- [x] Add position control to admin panel for each store

## Bug Fixes
- [x] Fix "Rendered more hooks" error in store dashboard (useState for showAllHistory called conditionally)

## Irish Timezone (Europe/Dublin) for All Timestamps
- [x] Update receipt formatter to display Irish time on printed receipts
- [x] Update store dashboard to display order times in Irish timezone
- [x] Update driver app to display times in Irish timezone
- [x] Update customer app (order tracking, order history) to display Irish timezone
- [x] Update admin panel to display times in Irish timezone

## Logo Placement
- [x] Replace shopping cart icon on Profile/Login screen with WeShop4U logo
- [x] Replace package emoji on Orders tab login screen with WeShop4U logo
- [x] Add WeShop4U logo to other key screens (auth login, register, forgot-password, store-login, register-driver, receipt header, cart empty state, store dashboard empty state, order tracking not found, store products empty state)

## Registration & Address
- [x] Make phone number mandatory on registration form (remove "Optional" label, add validation)
- [x] Make phone number required in server-side registration API validation
- [x] Ensure delivery address and Eircode auto-fill from previous orders with option to change (already implemented)

## Store Dashboard Improvements
- [x] Show customer name and phone number on order cards in store dashboard

## Customer-Facing Website (weshop4u.ie)
- [x] Website landing page with hero, store listing, and WeShop4U branding
- [x] Web-specific navigation header with logo, cart icon, and login/signup
- [x] Web footer with branding, links, and contact info
- [x] Hide mobile tab bar on web, use header navigation instead
- [x] Platform detection to route web users to web pages vs app screens
- [x] Store page with product catalogue wrapped in WebLayout
- [x] Web cart and checkout page wrapped in WebLayout
- [x] Web login, register, forgot-password pages wrapped in WebLayout
- [x] Web order tracking page wrapped in WebLayout
- [x] Web receipt page wrapped in WebLayout
- [x] Orders tab and profile tab wrapped in WebLayout
- [x] Responsive design (mobile-first, works on desktop/tablet)

## Website Homepage Polish
- [x] Fix rough header layout on web (clean up overlapping elements)
- [x] Update tagline to "Your Local Store to Your Door"
- [x] Update description to "Order groceries, food, and essentials from local stores in your area and get them delivered straight to your door within minutes!"
- [x] Remove Balbriggan/town-specific references from website copy
- [x] Fix email address to weshop4u247@gmail.com
- [x] Add "Download Our App" link/section on homepage
- [x] Emphasise fast express delivery messaging

## Website Header & Copy Fix
- [x] Redesign web header for mobile - use hamburger menu on small screens, full nav on desktop
- [x] Update description to "straight to your door, office or wherever you are"

## Popular Stores Section & New Stores
- [x] Add "Popular Stores" split-view section on homepage with two side-by-side cards (Spar + Open All Hours)
- [x] Make featured/popular stores configurable via admin panel (can swap which stores appear)
- [x] Add Apple Green store to the system
- [x] Add Chinese restaurant store to the system
- [x] Ensure McDonald's, Hamlet Bar remain in system but not featured initially

## Store Logo Uploads & Product Imports
- [x] Upload AppleGreen logo to store (from applegreenlogo.jpg)
- [x] Upload Treasure Bowl logo to store (from treasurebowllogo.jpg)
- [x] Import AppleGreen products from CSV into store_id for AppleGreen (305 products, 27 categories)
- [x] Import Treasure Bowl products from CSV into store_id for Treasure Bowl (235 products, 34 categories)

## Future: Product Modifier System (Discussion Only — Not Building Yet)
- [ ] Modifier groups (Salad, Sauces, Extras, Bread Choice, Side Choice, Rice Choice)
- [ ] Modifier options with individual pricing (free, +€0.50, +€1.00, etc.)
- [ ] Product-to-modifier linking (per store, per product)
- [ ] Required single-choice groups (pick one side) vs optional multi-select (pick any add-ons)
- [ ] Order item modifier storage and receipt printing
- [ ] Use cases: deli rolls/wraps, restaurant sides, Chinese takeaway rice/chips tiers

## Store Address Updates
- [x] Update AppleGreen Balbriggan address: Naul Road, Balbriggan, K32 Y180, phone 0894626262
- [x] Update Treasure Bowl Balbriggan address: Castlemill, Balbriggan, K32 Y198, phone 0894626262

## Nav Bar & Store Card Fixes
- [x] Remove duplicate WESHOP4U logo from top nav bar (keep hamburger menu only)
- [x] Fix broken emoji characters on store cards (clock, store, arrow)

## Smart Search & Logo Fixes
- [x] Build unified smart search bar (searches both stores and products from one input)
- [x] Add backend product search endpoint for cross-store product searching
- [x] Show store results and product results (grouped by store) in search dropdown
- [x] Verify and fix AppleGreen and Treasure Bowl logos displaying on the site (logos uploaded and accessible via CDN)

## Bug: Search Dropdown Issues
- [x] Fix search dropdown transparency (solid white background, elevation, zIndex 1000)
- [x] Fix product search not finding many products (was case-sensitive LIKE, now uses LOWER() for case-insensitive search)
