# Expo Push Notifications Research

## Key Findings:
1. **FCM is REQUIRED for Android push notifications** - You must configure Firebase Cloud Messaging
2. **google-services.json is needed** for standalone APK builds
3. **expo-notifications plugin** must be in app.config.ts plugins array
4. **Push notifications don't work on emulators** - real device required
5. **The module itself should not crash** if properly configured - the crash was likely from:
   - Calling `getExpoPushTokenAsync` without a valid projectId
   - Calling `setNotificationChannelAsync` before Firebase is initialized
   - Calling `scheduleNotificationAsync` which requires native notification channels

## Safe Approach:
- Wrap ALL notification calls in try/catch
- Check `Device.isDevice` before registering
- Use lazy/dynamic import pattern to avoid module-level crashes
- Only call notification APIs after confirming platform support
- Use local notifications (scheduleNotificationAsync) only within try/catch
- For the APK without FCM: notifications will silently fail but NOT crash

## Implementation Plan:
1. Create a safe notification helper module that wraps all expo-notifications calls
2. All calls go through this helper which catches errors
3. Re-add notification listeners in screens but through the safe wrapper
4. The wrapper checks Platform.OS and wraps in try/catch
