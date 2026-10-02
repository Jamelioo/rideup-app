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

## Push notifications (trip alerts)

The app already registers for push and the server sends to both platforms; you only add the keys.

**iPhone (APNs)**
1. Apple Developer › Certificates, IDs & Profiles › Keys › **+** › enable *Apple Push Notifications service* › download the `.p8` file.
2. In Xcode: App target › Signing & Capabilities › **+ Capability** › *Push Notifications* (and *Background Modes › Remote notifications*).
3. In `ios/App/App/AppDelegate.swift` add the two methods from the Capacitor push guide
   (https://capacitorjs.com/docs/apis/push-notifications#ios) that forward the device token.
4. Vercel env vars: `APNS_KEY` (paste the whole `.p8` contents), `APNS_KEY_ID`, `APNS_TEAM_ID`,
   `APNS_BUNDLE_ID=com.rideupnassau.app`, and `APNS_PRODUCTION=1` for TestFlight / App Store builds.

**Android (FCM)**
1. Firebase console › Add project › Add Android app with package `com.rideupnassau.app` › download `google-services.json`
   into `android/app/`.
2. Firebase › Project settings › Service accounts › *Generate new private key*.
3. Vercel env var: `FCM_SERVICE_ACCOUNT` = the whole JSON file contents.

Riders and drivers are asked for permission at the same moments as on the website (after booking, when going online).
Tapping a notification opens the right screen.

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
- **Account deletion:** done in the app (Profile › Delete account, and in the driver profile). Mention it in the review notes.
- **Demo accounts for reviewers:** create one rider account (with Stripe test card) and one approved driver account, and put both logins in the review notes.
- **Payments:** rides are real-world services, so Stripe is allowed (no Apple/Google in-app purchase needed).
- **Data safety / privacy labels:** declare location (precise), name, email, phone, payment info (handled by Stripe), and usage analytics.
- **Native value:** Apple rejects "just a website" apps (guideline 4.2). Native push notifications, location and the full
  booking flow are what get it approved.

## Notes

- Google Maps key: add the app's Android package name / iOS bundle ID to the key restrictions only if you later
  switch to native map SDKs. The web map keeps working with the existing website restriction.
- The "Add to Home Screen" banner hides itself inside the store apps.
