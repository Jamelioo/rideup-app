# Map Integration Design

## Goal

Add a full-screen interactive Google Map to the booking flow. The map serves as the visual backdrop behind a floating booking card. Users can set pickup/dropoff by typing (autocomplete) or by tapping/dragging on the map.

## Architecture

### New Component: `src/components/GoogleMap.vue`

A reusable map component that:
- Renders a full-screen Google Map centered on Nassau (25.0443, -77.3504), zoom level 13
- Accepts `pickup` and `dropoff` props (objects with `lat`, `lng`, `address` or null)
- Renders a green (#58cc02) circle marker for pickup, dark (#1a1a1a) square marker for dropoff
- Draws a route polyline (green, #58cc02) between the two points when both are set
- Auto-fits bounds to show both markers + route when both are set
- Emits `map-tap(latlng)` event when user taps the map
- Markers are draggable; emits `marker-drag(type, latlng)` when a marker is dragged to a new position
- Uses the existing `useGoogleMaps.js` composable to load the Maps JS API

### Modified: `src/pages/rider/RiderBooking.vue`

- Layout changes from stacked vertical to full-screen map + floating bottom card
- Map fills the entire viewport behind the UI
- Booking card is a fixed-position panel at the bottom with rounded top corners
- Card contains: pickup/dropoff inputs (with existing autocomplete), vehicle type selector, fare display, confirm button
- On `map-tap`: reverse geocode the tapped location using `google.maps.Geocoder`, fill into whichever input is active (pickup or dropoff)
- On `marker-drag`: reverse geocode the new position, update the corresponding input
- When both locations set: request Directions API route (existing logic), draw polyline on map, show fare

### Modified: `src/lib/useGoogleMaps.js`

- Ensure `Geocoder` is available (may need no changes — already loads Maps JS API)
- Expose a `reverseGeocode(lat, lng)` helper that returns formatted address

## User Flow

1. Page loads → full-screen map centered on Nassau, booking card at bottom
2. User taps pickup input → types → autocomplete dropdown → selects → green marker on map, map pans
3. OR user taps the map → green marker drops (if pickup is active input), address reverse-geocoded into input
4. User taps dropoff input → same flow with dark marker
5. Markers are draggable → dragging updates the address via reverse geocode
6. Both set → route polyline drawn, map fits to bounds, fare calculated and shown
7. User selects vehicle type → sees fare → taps "Confirm" → transitions to searching screen

## Map Styling

- Default Google Maps style (no custom theme for now)
- Polyline: #58cc02, weight 4, opacity 0.8
- Pickup marker: green circle (#58cc02)
- Dropoff marker: dark square (#1a1a1a)
- Map UI: hide default Google controls except zoom buttons

## Active Input Tracking

- A ref `activeInput` tracks which field ('pickup' or 'dropoff') is currently focused
- Defaults to 'pickup' on load
- When user selects pickup, automatically switches to 'dropoff'
- Map taps and reverse geocode results go to whichever input is active

## Scope

**In scope:**
- Full-screen map rendering
- Tap-to-place pins with reverse geocode
- Draggable markers with address update
- Route polyline between pickup and dropoff
- Auto-fit bounds
- Floating bottom card with existing booking UI
- Reverse geocode helper in useGoogleMaps.js

**Out of scope:**
- Custom map theme/styling
- Live driver positions on map
- Turn-by-turn navigation
- Map on the searching/matched screen (future)
- Street View

## Files Changed

- Create: `src/components/GoogleMap.vue`
- Modify: `src/pages/rider/RiderBooking.vue`
- Modify: `src/lib/useGoogleMaps.js` (add reverseGeocode helper)
