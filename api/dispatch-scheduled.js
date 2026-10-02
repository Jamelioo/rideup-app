import Stripe from 'stripe'
import { admin } from './_auth.js'
import { calculateFare } from '../src/lib/pricing.js'
import { pushToUser } from './_push.js'
import { captureRide } from './_capture.js'
import { notifyNearbyDrivers } from './_notifyDrivers.js'

// Turns due scheduled rides into live ride requests and clears stale unanswered requests.
// Call every minute (Vercel Cron on Pro, Supabase pg_cron + pg_net, or any external pinger) with
//   Authorization: Bearer $CRON_SECRET
// Vercel Cron sends that header automatically when CRON_SECRET is set.

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const DISPATCH_WINDOW_MIN = 3     // create the request this many minutes before pickup time
const STALE_REQUEST_MIN = 5       // requests nobody answered within this long are cancelled
const CAPTURE_GRACE_MIN = 2       // the driver's app captures at drop-off; after this the sweeper does it
const PAYMENT_CONFIRM_SEC = 90     // a ride stuck in "confirming payment" this long is cancelled
const DRIVER_IDLE_MIN = 3         // online drivers whose app hasn't checked in for this long are taken offline

function straightLineMiles(aLat, aLng, bLat, bLng) {
  const rad = (d) => (d * Math.PI) / 180
  const a = Math.sin(rad(bLat - aLat) / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(rad(bLng - aLng) / 2) ** 2
  return 2 * 3958.8 * Math.asin(Math.min(1, Math.sqrt(a)))
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET
  if (!admin || !secret) return res.status(500).json({ error: 'Server is not configured' })
  if (req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'Unauthorized' })

  const result = { expired: 0, dispatched: 0, failed: 0, captured: 0, capture_failed: 0, drivers_offlined: 0, stuck_cancelled: 0 }

  try {
    const staleBefore = new Date(Date.now() - STALE_REQUEST_MIN * 60_000).toISOString()
    const { data: stale } = await admin
      .from('rides')
      .update({ status: 'cancelled', cancel_reason: 'no_drivers', cancelled_at: new Date().toISOString() })
      .eq('status', 'requested')
      .lt('created_at', staleBefore)
      .select('id')
    result.expired = stale?.length || 0

    const dueBy = new Date(Date.now() + DISPATCH_WINDOW_MIN * 60_000).toISOString()
    const { data: due } = await admin
      .from('scheduled_rides')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', dueBy)
      .order('scheduled_at', { ascending: true })
      .limit(50)

    for (const sr of due || []) {
      // Claim it first so an overlapping run can't dispatch it twice.
      const { data: claimed } = await admin
        .from('scheduled_rides')
        .update({ status: 'dispatching' })
        .eq('id', sr.id)
        .eq('status', 'scheduled')
        .select('id')
      if (!claimed?.length) continue

      const fail = async (reason) => {
        result.failed++
        await admin.from('scheduled_rides').update({ status: reason }).eq('id', sr.id)
      }

      const { data: rider } = await admin
        .from('riders')
        .select('id, name, payment_method_id, auth_user_id')
        .eq('id', sr.rider_id)
        .maybeSingle()
      if (!rider) { await fail('failed'); continue }
      if (!rider.payment_method_id) { await fail('payment_required'); continue }

      // Same floors as the DB trigger: never cheaper than the straight line.
      const straight = straightLineMiles(sr.pickup_lat, sr.pickup_lng, sr.dropoff_lat, sr.dropoff_lng)
      const distance = Math.round(Math.max(Number(sr.distance_miles) || 0, straight) * 100) / 100
      const duration = Math.round(Math.max(Number(sr.duration_minutes) || 0, distance * 3) * 100) / 100
      const vehicleType = ['standard', 'xl', 'premium'].includes(sr.vehicle_type) ? sr.vehicle_type : 'standard'

      const { data: ride, error } = await admin
        .from('rides')
        .insert({
          rider_id: rider.id,
          rider_name: rider.name,
          status: 'requested',
          pickup_address: sr.pickup_address, pickup_lat: sr.pickup_lat, pickup_lng: sr.pickup_lng,
          dropoff_address: sr.dropoff_address, dropoff_lat: sr.dropoff_lat, dropoff_lng: sr.dropoff_lng,
          vehicle_type: vehicleType,
          distance_miles: distance,
          duration_minutes: duration,
          fare_cents: calculateFare(distance, duration, vehicleType),
        })
        .select('id')
        .single()
      if (error || !ride) { console.error('Dispatch insert error:', error?.message); await fail('failed'); continue }

      await admin.from('scheduled_rides').update({ status: 'dispatched', dispatched_ride_id: ride.id }).eq('id', sr.id)
      await notifyNearbyDrivers(ride.id)
      await pushToUser(rider.auth_user_id, {
        title: 'Finding your scheduled ride',
        body: `We're matching you with a driver for ${sr.pickup_address}.`,
        url: '/book',
        tag: `ride-${ride.id}`,
      })
      result.dispatched++
    }

    // Rides stuck between "driver accepted" and "card held" (the driver's app died, or the card check never
    // finished): cancel them so the rider isn't left waiting and the driver can take other trips.
    const stuckBefore = new Date(Date.now() - PAYMENT_CONFIRM_SEC * 1000).toISOString()
    const { data: stuck } = await admin
      .from('rides')
      .update({ status: 'cancelled', cancel_reason: 'payment_failed', cancelled_at: new Date().toISOString() })
      .eq('status', 'pending_driver_response')
      .lt('accepted_at', stuckBefore)
      .select('id, payment_intent_id, payment_status')
    for (const r of stuck || []) {
      if (r.payment_intent_id && r.payment_status === 'authorized') {
        await stripe.paymentIntents.cancel(r.payment_intent_id).catch((e) => console.error('Release stuck hold failed:', e.message))
      }
    }
    result.stuck_cancelled = stuck?.length || 0

    // Drivers who closed the app without going offline (like Uber, they stop being "online" after a few minutes).
    const idleBefore = new Date(Date.now() - DRIVER_IDLE_MIN * 60_000).toISOString()
    const { data: idle } = await admin
      .from('drivers')
      .update({ status: 'offline' })
      .eq('status', 'online')
      .or(`last_seen_at.is.null,last_seen_at.lt.${idleBefore}`)
      .select('id')
    result.drivers_offlined = idle?.length || 0

    // Safety net: charge completed trips whose capture call never arrived (e.g. the driver lost signal at drop-off).
    const captureBefore = new Date(Date.now() - CAPTURE_GRACE_MIN * 60_000).toISOString()
    const { data: uncaptured } = await admin
      .from('rides')
      .select('id')
      .eq('status', 'completed')
      .eq('payment_status', 'authorized')
      .lt('completed_at', captureBefore)
      .order('completed_at', { ascending: true })
      .limit(20)
    for (const r of uncaptured || []) {
      try {
        const out = await captureRide(r.id)
        if (out.ok) result.captured++
        else result.capture_failed++
      } catch (err) {
        console.error('Sweeper capture failed:', r.id, err.message)
        result.capture_failed++
      }
    }

    return res.status(200).json(result)
  } catch (err) {
    console.error('Dispatch scheduled error:', err.message)
    return res.status(500).json({ error: 'Dispatch failed' })
  }
}
