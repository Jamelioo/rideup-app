// Trip policy shown in the app. The server enforces the real values (api/_routes/cancel-ride.js reads
// CANCEL_GRACE_SECONDS / FREE_WAIT_SECONDS); set the VITE_ copies to the same values so the on-screen
// timers match. Defaults: 2 minutes and 5 minutes, like Uber.
const fromEnv = (value, fallback) => (value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : fallback)

export const CANCEL_GRACE_SECONDS = fromEnv(import.meta.env.VITE_CANCEL_GRACE_SECONDS, 120) // free cancellation window after a driver accepts
export const FREE_WAIT_SECONDS = fromEnv(import.meta.env.VITE_FREE_WAIT_SECONDS, 300) // free waiting time once the driver arrives (then no-show is allowed)
export const EMERGENCY_NUMBER = '919' // Royal Bahamas Police Force emergency line
// The RideUp guarantee credit when a driver cancels after accepting (the server reads DRIVER_CANCEL_CREDIT_CENTS;
// keep this copy equal). 0 hides the guarantee credit from the pages.
export const DRIVER_CANCEL_CREDIT_CENTS = Math.max(0, fromEnv(import.meta.env.VITE_DRIVER_CANCEL_CREDIT_CENTS, 500))
