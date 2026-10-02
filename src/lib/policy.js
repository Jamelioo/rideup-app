// Trip policy shown in the app. The server enforces the real values (api/cancel-ride.js, env overridable);
// keep these defaults in sync with it.
export const CANCEL_GRACE_SECONDS = 120   // free cancellation window after a driver accepts
export const FREE_WAIT_SECONDS = 300      // free waiting time once the driver arrives (then no-show is allowed)
export const EMERGENCY_NUMBER = '919'     // Royal Bahamas Police Force emergency line
