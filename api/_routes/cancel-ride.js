import Stripe from 'stripe'
import { admin, requireUser, rideRoles, fail } from '../_auth.js'
import { rateLimit } from '../_rateLimit.js'
import { chargeOf } from '../../src/lib/discounts.js'
import { cancellationFeeCents, noShowFeeCents, noShowAllowed, splitFee } from '../_fees.js'
import { sendEmail, cancellationFeeEmail } from '../_email.js'
import { pushToUser, rideParticipants } from '../_push.js'
import { notifyNearbyDrivers } from '../_notifyDrivers.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const checkRate = rateLimit({ maxRequests: 20, windowMs: 60_000 })

// Policy (Uber-style). Override with env vars; set CANCEL_FEE_CENTS=0 to disable fees entirely.
const FEE_CENTS = Math.max(0, parseInt(process.env.CANCEL_FEE_CENTS || '500', 10) || 0)
const GRACE_SECONDS = Math.max(0, parseInt(process.env.CANCEL_GRACE_SECONDS || '120', 10) || 0)
const FREE_WAIT_SECONDS = Math.max(0, parseInt(process.env.FREE_WAIT_SECONDS || '300', 10) || 0)

const CANCELLABLE = ['requested', 'pending_driver_response', 'accepted', 'driver_arrived']

// One endpoint for every cancellation, so the ride status and the card hold always change together.
//   body: { rideId, preview?: boolean, noShow?: boolean }
//   rider  → free until GRACE_SECONDS after a driver accepts, then FEE_CENTS
//   driver → free for the rider, or (noShow) FEE_CENTS once the driver has waited FREE_WAIT_SECONDS at pickup
//   admin  → free
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const blocked = checkRate(req)
  if (blocked) {
    res.setHeader('Retry-After', blocked.retryAfter)
    return res.status(429).json({ error: 'Too many requests. Try again shortly.' })
  }

  const user = await requireUser(req, res)
  if (!user) return

  const { rideId, preview, noShow } = req.body || {}
  if (!rideId) return res.status(400).json({ error: 'rideId is required' })

  try {
    const { data: ride } = await admin
      .from('rides')
      .select('id, rider_id, driver_id, status, fare_cents, promo_discount_cents, credit_applied_cents, accepted_at, arrived_at, payment_intent_id, payment_status, pickup_address')
      .eq('id', rideId)
      .maybeSingle()
    if (!ride) return res.status(404).json({ error: 'Ride not found' })

    const roles = await rideRoles(ride, user)
    const actor = roles.admin ? 'admin' : roles.driver ? 'driver' : roles.rider ? 'rider' : null
    if (!actor) return res.status(403).json({ error: 'Not allowed' })

    if (!CANCELLABLE.includes(ride.status) && !(actor === 'admin' && ride.status === 'in_progress')) {
      return res.status(409).json({ error: ride.status === 'in_progress' ? 'The trip has already started.' : 'This ride is already finished.' })
    }

    let feeCents = 0
    if (actor === 'rider') {
      feeCents = cancellationFeeCents({
        role: 'rider', status: ride.status, paymentStatus: ride.payment_status,
        acceptedAt: ride.accepted_at, fareCents: chargeOf(ride), feeCents: FEE_CENTS, graceSeconds: GRACE_SECONDS,
      })
    } else if (actor === 'driver' && noShow) {
      if (!noShowAllowed({ status: ride.status, arrivedAt: ride.arrived_at, waitSeconds: FREE_WAIT_SECONDS })) {
        return res.status(409).json({ error: `You can mark a no-show after waiting ${Math.round(FREE_WAIT_SECONDS / 60)} minutes at the pickup.` })
      }
      feeCents = noShowFeeCents({
        status: ride.status, paymentStatus: ride.payment_status, arrivedAt: ride.arrived_at,
        fareCents: chargeOf(ride), feeCents: FEE_CENTS, waitSeconds: FREE_WAIT_SECONDS,
      })
    }

    if (preview) {
      return res.status(200).json({
        fee_cents: feeCents,
        grace_seconds: GRACE_SECONDS,
        free_wait_seconds: FREE_WAIT_SECONDS,
        no_show_allowed: actor === 'driver' && noShowAllowed({ status: ride.status, arrivedAt: ride.arrived_at, waitSeconds: FREE_WAIT_SECONDS }),
      })
    }

    // 1. Claim the cancellation atomically (guards against a race with accept/arrive/start).
    const reason = actor === 'driver' ? (noShow ? 'rider_no_show' : 'driver_cancelled') : actor === 'admin' ? 'admin_cancelled' : 'rider_cancelled'
    const { data: claimed, error: claimErr } = await admin
      .from('rides')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: actor,
        cancel_reason: reason,
        ...(feeCents > 0 ? { cancel_fee_cents: feeCents, ...splitFee(feeCents) } : { platform_fee_cents: 0, driver_payout_cents: 0 }),
      })
      .eq('id', rideId)
      .eq('status', ride.status)
      .select('id')
    if (claimErr) throw claimErr
    if (!claimed?.length) return res.status(409).json({ error: 'The ride changed just now. Please try again.' })

    // 2. Money: take the fee from the hold, or release the hold entirely.
    if (ride.payment_intent_id && ride.payment_status === 'authorized') {
      try {
        if (feeCents > 0) {
          await stripe.paymentIntents.capture(ride.payment_intent_id, { amount_to_capture: feeCents }, { idempotencyKey: `cancel-fee-${rideId}` })
          await admin.from('rides').update({ payment_status: 'captured', paid_at: new Date().toISOString() }).eq('id', rideId)
        } else {
          await stripe.paymentIntents.cancel(ride.payment_intent_id)
          await admin.from('rides').update({ payment_status: 'cancelled' }).eq('id', rideId)
        }
      } catch (err) {
        // The ride is cancelled either way; a hold we couldn't release expires on its own within 7 days.
        console.error('Cancel ride payment step failed:', err.message)
        if (feeCents > 0) await admin.from('rides').update({ cancel_fee_cents: 0, platform_fee_cents: 0, driver_payout_cents: 0 }).eq('id', rideId)
        feeCents = 0
      }
    }

    // 3. Free the driver. If the driver cancelled, keep the rider's trip going with a new request
    //    (same route, same upfront price, not offered to this driver again), like Uber's automatic re-match.
    if (ride.driver_id) {
      await admin.from('drivers').update({ status: 'online' }).eq('id', ride.driver_id).eq('status', 'on_trip')
    }
    const rebookedRideId = actor === 'driver' && !noShow ? await rebook(rideId, ride.driver_id) : null

    // 4. Tell the other side.
    const people = await rideParticipants(rideId)
    if (actor === 'rider' && people.driverUserId) {
      await pushToUser(people.driverUserId, { title: 'Ride cancelled', body: 'The rider cancelled this trip.', url: '/driver/dashboard', tag: `ride-${rideId}` })
    } else if (actor !== 'rider' && people.riderUserId) {
      const minutes = Math.round(FREE_WAIT_SECONDS / 60)
      const body = noShow
        ? `Your driver waited ${minutes} minutes and marked the ride as a no-show.`
        : rebookedRideId
          ? 'Your driver had to cancel. We’re finding you another driver now. You weren’t charged.'
          : 'Your ride was cancelled. You weren’t charged. Request again and we’ll find you a driver.'
      await pushToUser(people.riderUserId, { title: rebookedRideId ? 'Finding you a new driver' : 'Ride cancelled', body, url: '/book', tag: `ride-${rideId}` })
    }
    if (feeCents > 0 && people.riderEmail) {
      await sendEmail({ to: people.riderEmail, ...cancellationFeeEmail({ ride, feeCents, noShow: !!noShow }) })
    }

    return res.status(200).json({ success: true, fee_cents: feeCents, rebooked_ride_id: rebookedRideId })
  } catch (err) {
    return fail(res, 'Cancel ride error', err)
  }
}

// Creates a fresh request for the rider after their driver cancelled. Best effort: if it fails the rider
// simply sees "ride cancelled" and can request again.
async function rebook(rideId, cancellingDriverId) {
  try {
    const { data: old } = await admin
      .from('rides')
      .select('rider_id, rider_name, pickup_address, pickup_lat, pickup_lng, dropoff_address, dropoff_lat, dropoff_lng, vehicle_type, distance_miles, duration_minutes, fare_cents, booking_fee_cents, airport_fee_cents, promo_code, promo_discount_cents, credit_applied_cents')
      .eq('id', rideId)
      .maybeSingle()
    if (!old) return null
    const { data: fresh, error } = await admin
      .from('rides')
      .insert({ ...old, status: 'requested', declined_by: cancellingDriverId ? [cancellingDriverId] : [] })
      .select('id')
      .single()
    if (error || !fresh) {
      console.error('Rebook after driver cancel failed:', error?.message)
      return null
    }
    await admin.from('rides').update({ replaced_by_ride_id: fresh.id }).eq('id', rideId)
    await notifyNearbyDrivers(fresh.id)
    return fresh.id
  } catch (err) {
    console.error('Rebook after driver cancel failed:', err.message)
    return null
  }
}
