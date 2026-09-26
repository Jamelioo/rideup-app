# Fare Calculation Design

## Goal

Update the client-side fare calculation rates in `src/lib/pricing.js` to reflect competitive Nassau market pricing, targeting ~$16 for a typical 7-mile, 13-minute ride (Soldier Rd → Baha Mar) on Standard.

## Context

- Nassau taxis charge ~$18 for Soldier Rd → Baha Mar (government-set zone rates)
- Previous Uber-style service charged $18 for the same route
- Gas in Nassau is ~$6.74/gallon — expensive, factored into rates
- RideUp differentiates on experience (app, tracking, cashless, no haggling), not price
- Rates should be competitive with taxis, slightly better deal

## Approach

Client-side calculation only. No backend changes. Update the `RATES` object in `pricing.js` with new per-mile/per-minute values. The existing `calculateFare(distanceMiles, durationMinutes, vehicleType)` function and `formatFare(cents)` helper remain unchanged.

Zone-based fixed pricing is deferred to a future iteration.

## Updated Rates (in cents)

| Vehicle Type | Base | Per Mile | Per Minute | Minimum |
|---|---|---|---|---|
| Standard | 250 | 165 | 20 | 600 |
| XL | 450 | 230 | 30 | 1000 |
| Premium | 700 | 320 | 40 | 1500 |

## Sample Fare Checks

| Route (approx) | Miles | Minutes | Standard | XL | Premium |
|---|---|---|---|---|---|
| Soldier Rd → Baha Mar | 7 | 13 | $16.65 | $20.50 | $34.60 |
| Short trip (2 mi, 5 min) | 2 | 5 | $6.80 | $10.10 | $15.80 |
| Minimum fare trip | 1 | 3 | $6.00 (min) | $10.00 (min) | $15.00 (min) |

## Scope

- **In scope:** Update `RATES` object values in `pricing.js`
- **Out of scope:** Zone-based fixed pricing, server-side calculation, night surcharge, extra passenger charges, promo codes (existing promo logic unchanged)

## File Changed

- `src/lib/pricing.js` — update `RATES` constant only
