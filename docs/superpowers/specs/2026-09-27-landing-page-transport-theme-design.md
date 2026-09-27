# RideUp Landing Page — Transportation Theme Redesign

## Goal

Redesign the rider landing page (`src/pages/RiderLanding.vue`) to feel like a real rideshare app (Uber/Lyft/Bolt) with a transportation-focused visual identity. Replace the current abstract dark hero with gradient blobs, feature card grids, "how it works" steps, and lead capture form with patterns used by actual top rideshare apps.

## Design Principles

- Follow Uber/Lyft/Bolt landing page patterns — no generic startup template patterns
- No feature card grids, no "how it works" numbered steps, no FAQ sections, no app download buttons
- Full-width sections with real photos (Unsplash, copyright-free) instead of placeholder illustrations
- Social proof through big numbers
- All mockups designed mobile-first

## Architecture

Single file change: `src/pages/RiderLanding.vue`. No new components, no new dependencies. Google Maps Static API image for the hero (API key already configured in the project for the booking screen).

## Page Structure (Top to Bottom)

### 1. Navigation Bar

Same as current — sticky white nav with RideUp logo, Ride/Drive links (desktop), Log in / Sign up buttons. No changes needed.

### 2. Hero Section

**Layout:** Full-width Google Maps Static API image of Nassau as background. On mobile, content fades up from the bottom over the map via a white gradient overlay. On desktop, side-by-side with a white gradient overlay on the left fading into the map on the right.

**Map details:**
- Google Maps Static API styled map of New Providence (muted colors, minimal labels to match brand)
- Labeled map pins for key locations: Paradise Island, Cable Beach, Downtown Nassau, LPIA Airport
- Dashed green route lines connecting landmarks
- "New Providence, Bahamas" label in the bottom-right corner

**Content (overlaid on map):**
- Headline: "Request a ride, hop in, and go." (serif, large)
- Subtitle: "Flat upfront pricing across New Providence. Verified drivers. 24/7."
- Booking widget: pickup input, destination input, "See prices" button — clicking any of these navigates to `/book`
- Stats row: 4.9★ Rider rating | 5 min Avg. pickup | 24/7 Availability

**Mobile behavior:** Map fills the full hero area. Content sits in the lower portion with a `linear-gradient(to top, white 60%, transparent 100%)` overlay so text is readable over the map. Map pins and route lines are visible in the upper portion.

**Desktop behavior:** Two-column layout. Left side has a `linear-gradient(to right, rgba(255,255,255,0.95) 70%, transparent 100%)` overlay with text + booking widget. Right side shows the full map with pins and routes.

### 3. Stats Banner

Dark (#1a1a1a) full-width bar with three large green/white numbers:
- **5k+** Rides completed (green)
- **4.9★** Average rating (white with green star)
- **<5m** Avg. pickup (white)

Separated by thin vertical dividers. The stats row from the hero moves here as a standalone social proof section (remove stats from hero to avoid duplication).

### 4. Value Props — Full-Width Sections

Replace the 4-column feature card grid with Uber-style full-width sections. Each value prop gets its own block:

**Block 1: "Know your fare before you ride"**
- Full-width photo (Unsplash: car driving on a road / city street)
- Below photo: headline + body text explaining upfront pricing, no surge

**Block 2: "Safety first, always"**
- Inline layout: green circle icon (shield checkmark) + headline + body text
- Explains verified drivers, real-time tracking, share trip with family
- Separated from blocks above/below by thin `#f0f0f0` dividers

**Block 3: "Anywhere across Nassau"**
- Full-width visual: stylized route map SVG showing pickup pin → dashed route → destination pin
- Below: headline + body text about island-wide coverage, 24/7 availability

### 5. Popular Routes

Clean list layout like Uber's fare estimator (not a table):
- Heading: "Go anywhere in Nassau" + subtitle "Flat fares. No surge pricing."
- Each route is a row: green dot bullet, route name (bold), time estimate (muted), and price (bold, right-aligned)
- Routes: Cable Beach → Downtown ($8, ~12 min), LPIA Airport → Bahamar ($12, ~18 min), Paradise Island → Bay St ($10, ~15 min), Carmichael Rd → Downtown ($7, ~10 min)
- Rows separated by thin `#f0f0f0` borders
- "See all prices" button below (dark #1a1a1a background) → navigates to `/book`

### 6. Driver Recruitment CTA

Card with photo + text (like Uber's "Drive with Uber" section):
- Photo area: Unsplash photo of a driver behind the wheel (dark gradient overlay)
- Below: "Earn on your schedule" headline, "Drive with RideUp and keep 80% of every fare. No shifts, no minimums." body text
- Green "Apply to drive" button → navigates to `/driver/apply`

### 7. Final CTA

Simple centered section:
- "Ready to ride?" headline
- "Book in seconds. No app download needed." subtitle
- Green "Book a ride now" button → navigates to `/book`

### 8. Footer

Dark (#1a1a1a) footer:
- RideUp logo (white with green "Up")
- 2-column link grid: Ride, Drive, Support, About, Privacy, Terms
- Social icons: Instagram (links to @rideupnassau), WhatsApp (links to wa.me/12424529911)
- Thin divider
- Copyright: "© 2026 RideUp Nassau. All rights reserved."

## Photos

Use Unsplash copyright-free photos. Store in `public/images/` directory:
- `fare-photo.jpg` — Car on a road or city street scene (for "Know your fare" section)
- `driver-photo.jpg` — Person driving a car (for driver recruitment CTA)

Keep photos small (compressed, max 200KB each) for fast loading.

## Colors

- Primary green: `#58cc02`
- Dark: `#1a1a1a`
- Surface gray: `#f8f8f8` / `#f5f5f5`
- Dividers: `#f0f0f0`
- Muted text: `#888` / `#999`
- White: `#ffffff`

## What Gets Removed

- Dark hero with gradient blobs, dot grid, floating map pins, decorative route lines
- 4-column feature card grid ("Why ride with RideUp?")
- "How it works" 3-step section with phone mockup
- Wave SVG dividers between sections
- Lead capture CTA with phone number input
- Topographic/decorative SVG illustrations
- Old footer with gradient and newsletter form

## What Gets Added

- Google Maps Static API image as hero background
- Labeled map pins for Nassau landmarks
- Stats banner (dark bar with big numbers)
- Full-width photo sections for value props
- Uber-style route list
- Driver recruitment photo card
- "Book a ride now" final CTA
- Clean dark footer with social links

## Routing Context

The landing page now lives at `/` (root). Logged-in users are auto-redirected to `/book` (booking screen). The "See prices" and "Book a ride now" buttons navigate to `/book`. `/welcome` redirects to `/`.
