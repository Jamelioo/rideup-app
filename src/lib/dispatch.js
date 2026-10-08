// Which drivers are offered a trip. Shared by the driver app (src/lib/useDriver.js lists requests within this
// distance) and the server (api/_notifyDrivers.js: the "New trip request" alerts and the booking screen's
// "can a car come?" check), so all three always agree. No Vue or Vite imports: the server loads this file.

// 25 miles reaches all of New Providence and Paradise Island from anywhere on the island (about 18 miles end to
// end; Clifton to Paradise Island alone is 15), so every online driver hears about every trip. Lower it once
// there are enough drivers that someone across the island shouldn't be offered a pickup.
export const MAX_PICKUP_MILES = 25
