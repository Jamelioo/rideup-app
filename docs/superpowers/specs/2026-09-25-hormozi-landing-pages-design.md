# Hormozi-Style Landing Pages for RideUp Nassau

**Date:** 2026-09-25
**Status:** Approved

## Overview

Two high-conversion landing pages using the Hormozi value equation framework — one for riders (demand side) and one for drivers (supply side). Each page targets a specific avatar, leads with a guarantee, and captures leads via phone number before redirecting to the app.

## Decisions Made

- **Rider niche:** Daily commuters (locals getting to work) — year-round recurring demand
- **Rider headline:** "Your Ride to Work. On Time. Every Time. Or It's Free."
- **Rider guarantee:** On-time guarantee — if your scheduled ride is late, it's 100% free
- **Rider lead magnet:** $20 credit for first week's commute (phone number capture)
- **Driver headline:** "Make $200/Day Driving in Nassau. Keep More Than Any Other Platform."
- **Driver risk reversal:** "Drive for one week. If you don't earn more per ride than your current platform, we'll match it + $100 bonus."
- **Driver CTA:** "Apply in 60 Seconds"

## Routes

- `/welcome` — Rider landing page (public, no auth required)
- `/drive` — Driver landing page (public, no auth required)
- `/` — Main app (booking screen, requires login)

## Page 1: Rider Landing (`/welcome`)

### Section 1: Hero (Above the Fold)
- Dark background (#16241F) with white text
- Small green tag: "RideUp Nassau · Open 24/7"
- **H1:** "Your Ride to Work. On Time. Every Time. Or It's Free."
- **Sub:** "Schedule your morning ride the night before. Background-checked drivers. Flat pricing across New Providence."
- **Lead capture form:** Phone number input + "Get Your $20 Credit" green button
- Small trust text below: "2,000+ rides completed · 4.9★ average rating"

### Section 2: Social Proof Bar
- Row of metrics: "4.9★ Rating" · "2,000+ Rides" · "100+ Drivers" · "24/7 Service"
- Optional: 3 small circular driver photos with verified badge

### Section 3: Value Equation (3 Cards)
Addresses the Hormozi value equation: Dream Outcome, Likelihood of Success, Time Delay, Effort/Sacrifice.

- **Card 1 — 5-Minute Pickup:** "Your driver arrives in under 5 minutes. No roadside waiting." (icon: clock)
- **Card 2 — Flat Pricing:** "The price you see is the price you pay. No surge, no surprises." (icon: dollar)
- **Card 3 — Background-Checked:** "Every driver verified — license, vehicle, background check." (icon: shield)

### Section 4: How It Works (3 Steps)
Simple horizontal 3-step layout:
1. "Enter your phone number" — Get $20 credit instantly
2. "Schedule your ride" — Pick your time, pickup, and destination
3. "Your driver arrives on time" — Tracked in real-time, guaranteed

### Section 5: Popular Routes with Pricing
Table/cards showing common Nassau commute routes with flat pricing:
- Cable Beach → Downtown Nassau: $8
- LPIA Airport → Bahamar: $12
- Paradise Island → Bay Street: $10
- Carmichael Road → Downtown: $7

Purpose: Make pricing concrete and show how affordable it is vs. taxis.

### Section 6: The Guarantee (Risk Reversal)
Highlighted section with green accent:
- **Headline:** "The RideUp On-Time Guarantee"
- **Body:** "If your scheduled ride is late by even 1 minute, your ride is 100% free. No questions asked. No fine print."
- This is the key differentiator — bold, centered, impossible to miss.

### Section 7: Final CTA (Repeat Lead Capture)
- Same phone number capture form as hero
- "Get Your $20 Credit — Start Riding This Week"
- Below: App Store + Google Play badges (future)

### Section 8: Footer
- RideUp logo, Nassau Bahamas
- Links: Privacy, Terms, Contact
- "© 2026 RideUp Nassau"

## Page 2: Driver Landing (`/drive`)

### Section 1: Hero (Above the Fold)
- Dark background (#16241F)
- Small green tag: "Drive with RideUp"
- **H1:** "Make $200/Day Driving in Nassau. Keep More Than Any Other Platform."
- **Sub:** "Lowest commission in The Bahamas. Your car, your hours, your money."
- **CTA button:** "Apply in 60 Seconds" (green, links to driver application form or WhatsApp)

### Section 2: Earnings Comparison
Visual comparison showing RideUp vs. competitors:
- **RideUp:** Keep 80% of fares (green bar, wider)
- **Others:** Keep 60-70% (gray bar, narrower)
- Example: "$25 fare → You keep $20 with RideUp vs $15 with others"
- Bold text: "That's $1,200+ extra per month in your pocket."

### Section 3: Value Stack (4 Benefits)
Each with icon + headline + one-line description:
1. **💵 Keep 80% of Every Fare** — Lowest commission rate in Nassau
2. **⚡ Instant Cashout** — Cash out after every completed trip, no waiting
3. **🛡️ Fully Insured** — Commercial liability coverage while you drive
4. **📊 Earnings Dashboard** — Track your daily, weekly, and monthly earnings

### Section 4: 3-Step Onboarding
Combat friction — show how easy it is to start:
1. **Input your vehicle & driver details** — "Takes 60 seconds"
2. **Complete a free local safety check** — "We verify your vehicle"
3. **Open the app and start accepting rides** — "Earn money today"

### Section 5: The Guarantee (Risk Reversal)
Highlighted section:
- **Headline:** "The RideUp Driver Guarantee"
- **Body:** "Drive for one week. If you don't earn more per ride than your current platform, we'll match your earnings + give you a $100 bonus. Zero risk to switch."

### Section 6: Driver Testimonials
2-3 testimonial cards (demo/placeholder for now):
- Photo + Name + "Driving since [date]"
- Quote: e.g., "I switched and make $300 more per week"
- Earnings stat: "$1,800/week average"

### Section 7: Final CTA
- "Ready to Earn More?"
- "Apply in 60 Seconds — Start Earning This Week" (green button)
- Below: "Questions? WhatsApp us at (242) 452-9911"

### Section 8: Footer
- Same as rider page footer

## Design System

Both pages use the existing RideUp design tokens:
- **Primary green:** #34C796
- **Dark green:** #22A67E
- **Dark background:** #16241F
- **Font serif:** Fraunces (headlines, hero text)
- **Font sans:** Manrope (body, CTAs)
- **Border radius:** rounded-2xl for cards, rounded-xl for buttons
- **Spacing:** Tailwind utility classes, mobile-first

## Technical Notes

- Both pages are public — no auth required
- Phone number capture stores to Supabase `leads` table (new table: phone, source, created_at)
- Lead capture form validates phone format before submit
- After submit, redirect to app download page or `/login`
- Pages are mobile-first but should look good on desktop (max-w-4xl centered)
- Use existing Tailwind setup, no new dependencies

## Out of Scope

- Actual SMS follow-up automation (future — Twilio integration)
- App Store / Google Play listings (app is web-only for now)
- A/B testing infrastructure
- Analytics/conversion tracking (future — add later)
