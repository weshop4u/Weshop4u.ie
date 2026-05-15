# WESHOP4U Mobile Testing Guide

## How to Test Your App on Your Phone

Since the web preview doesn't support native features (Maps, Camera, Push Notifications), you need to test on a real mobile device using Expo Go.

### Step 1: Install Expo Go

**iPhone (iOS):**
1. Open the **App Store**
2. Search for **"Expo Go"**
3. Download and install the app

**Android:**
1. Open the **Google Play Store**
2. Search for **"Expo Go"**
3. Download and install the app

### Step 2: Connect to Your App

**Option A: Use the Manus UI (Easiest)**
1. In the Manus chat interface, look for the **Preview card** or **Project card**
2. Click the **QR code icon** or **"Open in Expo Go"** button
3. Scan the QR code with your phone

**Option B: Manual Connection**
1. Make sure your phone is on the **same WiFi network** as your computer
2. Open **Expo Go** app on your phone
3. Tap **"Enter URL manually"**
4. Enter this URL: `exp://192.168.x.x:8081` (replace with your local IP)

### Step 3: Test the Complete Order Flow

Once the app loads on your phone:

1. **Login** with your account: barrygosson1978@gmail.com / 1234
2. **Browse stores** - Tap on "Spar Balbriggan"
3. **Add items to cart** - Browse products and add to cart
4. **Checkout** - Enter delivery address and Eircode
5. **Place order** - Complete the order
6. **Check your phone** - You should receive an SMS confirmation! 📱

### Step 4: Test Driver Flow (Optional)

1. **Switch to Driver Mode** from Profile tab
2. **Accept the order** you just placed
3. **Click "Picked Up Order"**
4. **Check your phone again** - You should receive the "On The Way" SMS with tracking link! 🚗

### Troubleshooting

**App won't load?**
- Make sure your phone and computer are on the same WiFi
- Try restarting the Expo Go app
- Check that the dev server is running in Manus

**SMS not arriving?**
- Verify your phone number is added as a "Verified Caller ID" in Twilio Console
- Check the server logs for SMS delivery status
- Make sure your phone number in your profile includes country code (+353)

**Need help?**
Contact support at Weshop4u247@gmail.com or call 0894 626262
