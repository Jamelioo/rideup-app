# Auth Flow Design Spec

## Overview

Add email+password authentication to RideUp using Supabase Auth. Everyone signs up as a rider. Driver onboarding is a separate, future flow. Phone OTP will replace email+password once Twilio is configured.

## Decisions

- **Auth method:** Email + password (swap to phone OTP later)
- **Signup model:** Unified rider signup only. Drivers apply separately (existing WhatsApp flow).
- **Post-auth redirect:** Return user to the page they were trying to reach, default to `/`.
- **Protected routes:** Profile, Edit Profile, My Rides, Payments, ride request flow. Everything else is public.
- **State management:** Composable (no Pinia). Follows existing `useLeadCapture`/`useGoogleMaps` patterns.

## Architecture

### 1. `useAuth` composable — `src/lib/useAuth.js`

A module-level singleton. All components that call `useAuth()` share the same reactive state.

**Reactive state (module-level, not per-call):**

- `user` — `ref(null)` — the Supabase `user` object, or `null` when logged out
- `loading` — `ref(true)` — `true` while restoring the session on app load, `false` once resolved

**Methods:**

- `init()` — Called once from `App.vue` on mount. Calls `supabase.auth.getSession()` to restore an existing session, sets `user` and flips `loading` to `false`. Then subscribes to `supabase.auth.onAuthStateChange()` to keep `user` in sync across tabs, token refreshes, and sign-outs.

- `signUp(email, password, name)` — Calls `supabase.auth.signUp()` with `options.data: { name }` to store the display name in `user_metadata`. Returns `{ error }`. Does NOT auto-sign-in (Supabase sends a confirmation email by default).

- `signIn(email, password)` — Calls `supabase.auth.signInWithPassword()`. Returns `{ error }`. On success, `onAuthStateChange` updates `user` automatically.

- `signOut()` — Calls `supabase.auth.signOut()`. `onAuthStateChange` clears `user` automatically.

**Demo mode:** When `supabaseConfigured` is `false` (from `src/lib/supabase.js`), all methods return `{ error: { message: 'Auth not configured' } }` and `user` stays `null`. The app continues to work in demo mode without auth.

### 2. Route guards — `src/router/index.js`

Add `meta: { requiresAuth: true }` to these route definitions:

- `/profile`
- `/edit-profile`
- `/my-rides`
- `/payments`
- `/rider/searching` (and any nested rider flow routes that represent an active ride)

Add a `router.beforeEach` guard:

1. Import `useAuth` and read `user` and `loading`.
2. If `loading` is `true`, return a promise that resolves when `loading` becomes `false` (use a `watchEffect` or polling pattern), then re-evaluate. This ensures the guard doesn't redirect to `/login` before the session has been checked.
3. If the route has `meta.requiresAuth` and `user` is `null`: redirect to `/login?redirect=<originalPath>`.
4. If the route is `/login` or `/signup` and `user` is not `null`: redirect to `/`.
5. Otherwise: allow navigation.

### 3. Login page — `src/pages/Login.vue`

Replace the current phone number input with:

- **Email input** — `type="email"`, required
- **Password input** — `type="password"`, required
- **Submit button** — Calls `signIn(email, password)`
- **Error display** — Shows Supabase error message below the form (e.g., "Invalid login credentials")
- **On success** — Redirect to `route.query.redirect` or `/`
- **Links** — "Don't have an account? Sign up" links to `/signup`

Keep the existing visual design: back button, RideUp branding, centered card layout.

### 4. Signup page — `src/pages/Signup.vue`

Replace current name + phone with:

- **Full name input** — `type="text"`, required
- **Email input** — `type="email"`, required
- **Password input** — `type="password"`, required, minimum 6 characters
- **Confirm password input** — `type="password"`, must match password
- **Submit button** — Client-side validation first (passwords match, length check, email format), then calls `signUp(email, password, name)`
- **Error display** — Shows validation errors or Supabase error messages
- **On success** — Show message: "Check your email to confirm your account", then redirect to `/login` after 3 seconds
- **Links** — "Already have an account? Log in" links to `/login`

Keep the existing visual design.

### 5. Profile page — `src/pages/Profile.vue`

- Replace hardcoded `"Demo User"` and `"demo@rideup.bs"` with `user.user_metadata.name` and `user.email` from `useAuth().user`
- Wire the logout button to call `signOut()`, then `router.push('/welcome')`
- If `user` is `null` (shouldn't happen due to route guard, but defensive): redirect to `/login`

### 6. SideMenu — `src/components/SideMenu.vue`

- **Logged in:** Show user name (`user.user_metadata.name`) and email (`user.email`). Logout menu item calls `signOut()` and navigates to `/welcome`.
- **Logged out:** Show "Log in" and "Sign up" links instead of user info. Hide menu items that require auth (My Rides, Payments, Profile).

### 7. App.vue

- Import `useAuth` and call `init()` in `onMounted`.
- No loading spinner needed — the route guard handles waiting for auth to resolve before redirecting.

### 8. Landing page nav bars

- **RiderLanding.vue:** If `user` is not `null`, replace "Log in" / "Sign up" buttons with user's name linking to `/profile`.
- **DriverLanding.vue:** Nav already simplified to "Already a driver? Log in" — no change needed.

## Out of scope

- Phone OTP / SMS verification (requires Twilio setup)
- Driver signup/onboarding flow
- Password reset / email change
- Social auth (Google, Apple)
- Creating a row in the `riders` table on signup (ties into booking flow — separate spec)
- Session refresh UI (Supabase handles automatically)
- Email template customization

## File changes summary

| File | Action |
|------|--------|
| `src/lib/useAuth.js` | Create |
| `src/router/index.js` | Modify — add meta + beforeEach guard |
| `src/pages/Login.vue` | Modify — email+password form, signIn call |
| `src/pages/Signup.vue` | Modify — name+email+password form, signUp call |
| `src/pages/Profile.vue` | Modify — real user data, working logout |
| `src/components/SideMenu.vue` | Modify — auth-aware menu |
| `src/App.vue` | Modify — call init() on mount |
| `src/pages/RiderLanding.vue` | Modify — auth-aware nav |
