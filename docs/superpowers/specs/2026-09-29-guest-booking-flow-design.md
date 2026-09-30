# Guest Booking Flow — Design Spec

**Goal:** Let riders book a ride without creating an account upfront. Capture name + phone at request time via a bottom sheet, use Supabase anonymous auth for the session, and prompt account creation after the ride completes.

**Architecture:** Client-side only. Supabase anonymous auth provides a real `auth.uid()` so all existing RLS policies, realtime subscriptions, and ride tracking work unchanged. No new API endpoints.

**Tech Stack:** Vue 3, Supabase anonymous auth, existing rider/ride tables.

---

## 1. Guest Booking Flow

The `/book` page is already accessible without login. The change happens only at the "Request Ride" tap:

1. Guest visits `/book` → sets pickup, dropoff, selects vehicle (no change)
2. Taps "Request Ride" → check `supabase.auth.getUser()`
3. **If logged in** → proceed as normal (no change to existing flow)
4. **If not logged in** → bottom sheet slides up:
   - Heading: "Enter your details to request a ride"
   - Name field (text input, required)
   - Phone field (tel input, pre-formatted for Bahamas +1 242, required)
   - "Request Ride" green CTA button
5. On submit:
   - Call `supabase.auth.signInAnonymously()` to create anonymous session
   - Insert rider record: `{ auth_user_id, name, phone, is_guest: true }`
   - Insert ride record (same as current flow)
   - Emit `'requested'` → transition to "Searching for driver"
6. Bottom sheet overlays the booking page — no navigation, no context lost. Booking details (pickup, dropoff, vehicle, fare) are preserved in component state.

### Bottom Sheet Component: `GuestInfoSheet.vue`

- Props: `show` (boolean), fare/vehicle info for display
- Emits: `submit({ name, phone })`, `close`
- Validates: name not empty, phone has 7+ digits
- Styled to match existing app: dark surface, rounded top corners, green CTA
- Dismissible via X button or backdrop tap (returns to booking without action)

## 2. Post-Ride Account Conversion

After ride completes, nudge the guest to create a permanent account:

1. Ride finishes → rider sees ride summary / rating screen
2. Below the rating, show a card:
   - Heading: "Save your account"
   - Subtitle: "Keep your ride history and book faster next time"
   - Email field + Password field
   - "Create Account" green CTA button
   - "Skip" text link below
3. On "Create Account":
   - Call `supabase.auth.updateUser({ email, password })` to convert anonymous → permanent
   - Update rider record: `is_guest: false, email: <email>`
   - Show success toast: "Account created!"
4. On "Skip":
   - Dismiss the card, continue to home
   - Anonymous session persists until it expires
   - Next booking will require name + phone again

## 3. Supabase Setup

1. **Enable anonymous auth:** Supabase Dashboard → Authentication → Providers → toggle "Allow anonymous sign-ins"
2. **Add column:** `ALTER TABLE riders ADD COLUMN IF NOT EXISTS is_guest boolean DEFAULT false;`
3. **RLS:** No changes needed. Anonymous auth provides a real `auth.uid()`, so existing policies (`auth.uid() = auth_user_id`) work for anonymous users identically to permanent users.

## 4. Files to Create or Modify

- **Create:** `src/components/GuestInfoSheet.vue` — bottom sheet for name + phone capture
- **Modify:** `src/pages/rider/RiderBooking.vue` — show GuestInfoSheet when unauthenticated user taps Request Ride; handle submit to create anonymous session + rider + ride
- **Modify:** `src/pages/rider/RiderFlow.vue` or ride completion screen — add account conversion card after ride
- **No new API endpoints**

## 5. Edge Cases

- **Guest requests ride, closes browser, comes back:** Anonymous session persists (Supabase stores it). They can continue or start fresh.
- **Guest enters duplicate phone number:** Allow it — phone uniqueness shouldn't block booking. Multiple anonymous sessions can share a phone number.
- **Guest tries to sign up with email already in use:** Show error "This email is already registered. Log in instead?" with link to login page.
- **Driver needs to contact rider:** Driver sees rider's phone number from the ride record, can call/text directly.
