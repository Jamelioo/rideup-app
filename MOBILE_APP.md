# RideUp on the App Store and Google Play

The store apps are a native shell (Capacitor) around the live site, https://rideupnassau.com.
Every Vercel deploy updates the apps straight away; you only resubmit to the stores when the
shell itself changes (icon, name, permissions, Capacitor version).

App ID (both stores): `com.rideupnassau.app`

## What you need

| | iPhone (App Store) | Android (Google Play) |
|---|---|---|
| Account | Apple Developer Program, $99/year | Google Play Console, $25 once |
| Computer | A Mac with Xcode (latest) | Any computer with Android Studio |
| Business | D-U-N-S number if you enrol as a company | Business details for the developer profile |

## One-time setup

```bash
npm install
npm run build
npx cap add ios        # Mac only
npx cap add android
```

Commit the new `ios/` and `android/` folders.

### Icons and splash screen

```bash
npm install -D @capacitor/assets
# put a 1024x1024 icon at assets/icon.png and a 2732x2732 splash at assets/splash.png
npx capacitor-assets generate --iconBackgroundColor '#2b8659' --splashBackgroundColor '#ffffff'
```

### Location permission text (iOS)

In Xcode, open `ios/App/App/Info.plist` and add:

- `NSLocationWhenInUseUsageDescription`: "RideUp uses your location to set your pickup point and show your driver where you are."
- Drivers: `NSLocationAlwaysAndWhenInUseUsageDescription`: "RideUp shares your location with your rider during a trip."

### Location permission (Android)

`android/app/src/main/AndroidManifest.xml` needs:

```xml
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

## Build and upload

```bash
npm run app:ios       # builds, syncs, opens Xcode → Product › Archive → Distribute App
npm run app:android   # builds, syncs, opens Android Studio → Build › Generate Signed App Bundle
```

Upload the `.aab` to Play Console (start with Internal testing). Upload the iOS archive to
App Store Connect, then use TestFlight before submitting for review.

## Store review checklist (how Uber-style apps get approved)

- **Privacy policy URL:** https://rideupnassau.com/privacy
- **Terms:** https://rideupnassau.com/terms
- **Support URL / email:** required by both stores
- **Account deletion:** Apple requires that people can delete their account from inside the app. Profile › Delete account
  currently sends them to support by phone/WhatsApp; that needs to become a real in-app deletion before the iOS submission.
- **Demo accounts for reviewers:** create one rider account (with Stripe test card) and one approved driver account, and put both logins in the review notes.
- **Payments:** rides are real-world services, so Stripe is allowed (no Apple/Google in-app purchase needed).
- **Data safety / privacy labels:** declare location (precise), name, email, phone, payment info (handled by Stripe), and usage analytics.
- **Native value:** Apple rejects "just a website" apps (guideline 4.2). Location, trip alerts and the full booking flow
  are what get it approved; adding native push (`@capacitor/push-notifications`) makes approval much more likely.

## Notes

- Google Maps key: add the app's Android package name / iOS bundle ID to the key restrictions only if you later
  switch to native map SDKs. The web map keeps working with the existing website restriction.
- The "Add to Home Screen" banner hides itself inside the store apps.
