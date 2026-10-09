import Stripe from 'stripe'
import { admin } from './_auth.js'
import { calculateFare, BOOKING_FEE_CENTS, isAirportPickup, AIRPORT_FEE_CENTS } from '../src/lib/pricing.js'
import { pushToUser, rideParticipants, usersWithPush } from './_push.js'
import { captureRide } from './_capture.js'
import { notifyNearbyDrivers, DRIVER_IDLE_MIN, DRIVER_BACKGROUND_MIN } from './_notifyDrivers.js'
import { alertRideRequest } from './_staffAlerts.js'
import { captureServerError } from './_monitor.js'
import { sendEmail, docExpiryEmail } from './_email.js'

// Turns due scheduled rides into live ride requests and clears stale unanswered requests.
// Call every minute (Vercel Cron on Pro, Supabase pg_cron + pg_net, or any external pinger) with
//   Authorization: Bearer $CRON_SECRET
// Vercel Cron sends that header automatically when CRON_SECRET is set.

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const DISPATCH_WINDOW_MIN = 3     // create the request this many minutes before pickup time
const STALE_REQUEST_MIN = 5       // requests nobody answered within this long are cancelled
const CAPTURE_GRACE_MIN = 2       // the driver's app captures at drop-off; after this the sweeper does it
const PAYMENT_CONFIRM_SEC = 90     // a ride stuck in "confirming payment" this long is cancelled
const CHECKIN_STOPPED_MIN = 8     // trip check-in: the car hasn't moved for this long (while the driver's app is reporting)
const CHECKIN_ESCALATE_MIN = 5    // no "I'm OK" within this long → safety report for the admin

function straightLineMiles(aLat, aLng, bLat, bLng) {
  const rad = (d) => (d * Math.PI) / 180
  const a = Math.sin(rad(bLat - aLat) / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(rad(bLng - aLng) / 2) ** 2
  return 2 * 3958.8 * Math.asin(Math.min(1, Math.sqrt(a)))
}

// Trip check-ins (Uber's RideCheck): a trip that stopped moving, or is running far longer than expected,
// gets an "Everything OK?" to both rider and driver; no answer in a few minutes opens a safety report.
async function tripCheckins(result) {
  const now = Date.now()
  const { data: trips } = await admin
    .from('rides')
    .select('id, started_at, duration_minutes, last_moved_at, driver_location_at, pickup_address, dropoff_address, rider_id, driver_id')
    .eq('status', 'in_progress')
    .is('safety_checkin_at', null)
    .limit(200)
  for (const t of trips || []) {
    const started = new Date(t.started_at || now).getTime()
    const appReporting = t.driver_location_at && now - new Date(t.driver_location_at).getTime() < 2 * 60_000
    const lastMoved = new Date(t.last_moved_at || t.started_at || now).getTime()
    const stopped = appReporting && now - lastMoved > CHECKIN_STOPPED_MIN * 60_000
    const expectedMs = (Number(t.duration_minutes) || 20) * 2 * 60_000 + 20 * 60_000
    const tooLong = now - started > expectedMs
    if (!stopped && !tooLong) continue
    const reason = stopped ? 'stopped' : 'long_trip'
    const { data: marked } = await admin.from('rides')
      .update({ safety_checkin_at: new Date().toISOString(), safety_checkin_reason: reason })
      .eq('id', t.id).is('safety_checkin_at', null).select('id')
    if (!marked?.length) continue
    result.checkins++
    const people = await rideParticipants(t.id)
    const body = stopped ? 'Your trip seems to have stopped. Is everything OK?' : 'Your trip is taking much longer than expected. Is everything OK?'
    await pushToUser(people.riderUserId, { title: 'Everything OK?', body, url: `/ride/${t.id}`, tag: `checkin-${t.id}` })
    await pushToUser(people.driverUserId, { title: 'Everything OK?', body, url: '/driver/active-ride', tag: `checkin-${t.id}` })
  }

  const escalateBefore = new Date(now - CHECKIN_ESCALATE_MIN * 60_000).toISOString()
  const { data: unanswered } = await admin
    .from('rides')
    .select('id, safety_checkin_reason, status')
    .eq('status', 'in_progress') // a trip that ended normally needs no follow-up
    .lt('safety_checkin_at', escalateBefore)
    .is('safety_checkin_ok_at', null)
    .is('safety_escalated_at', null)
    .limit(50)
  for (const r of unanswered || []) {
    const { data: marked } = await admin.from('rides')
      .update({ safety_escalated_at: new Date().toISOString() })
      .eq('id', r.id).is('safety_escalated_at', null).select('id')
    if (!marked?.length) continue
    await admin.from('safety_reports').insert({
      ride_id: r.id,
      category: 'trip_check',
      description: `Automatic trip check-in (${r.safety_checkin_reason === 'stopped' ? 'the car stopped moving' : 'trip running much longer than expected'}) got no “I’m OK” from the rider or driver within ${CHECKIN_ESCALATE_MIN} minutes. Trip status: ${r.status}. Call both people.`,
      status: 'open',
    })
    result.escalated++
  }
}

// Driver licence / insurance reminders, like Uber: 30 days and 7 days before expiry, and on the day it lapses
// (when the driver is also taken offline). Checked once an hour; each reminder is sent once.
// Drivers whose app stopped checking in without going offline. Those we can still alert stay online in the
// background for DRIVER_BACKGROUND_MIN (requests arrive as notifications); everyone else goes offline after
// DRIVER_IDLE_MIN. Drivers who had notifications get told, so they don't think they're still getting trips.
async function offlineIdleDrivers(result) {
  const idleBefore = new Date(Date.now() - DRIVER_IDLE_MIN * 60_000).toISOString()
  const backgroundBefore = Date.now() - DRIVER_BACKGROUND_MIN * 60_000
  const { data: idle } = await admin
    .from('drivers')
    .select('id, auth_user_id, last_seen_at')
    .eq('status', 'online')
    .or(`last_seen_at.is.null,last_seen_at.lt.${idleBefore}`)
  if (!idle?.length) { result.drivers_offlined = 0; return }
  const reachable = await usersWithPush(idle.map((d) => d.auth_user_id))
  const due = idle.filter((d) => !d.last_seen_at || !reachable.has(d.auth_user_id) || new Date(d.last_seen_at).getTime() < backgroundBefore)
  if (!due.length) { result.drivers_offlined = 0; return }
  const { data: offlined } = await admin
    .from('drivers')
    .update({ status: 'offline' })
    .in('id', due.map((d) => d.id))
    .eq('status', 'online')
    .or(`last_seen_at.is.null,last_seen_at.lt.${idleBefore}`)
    .select('id, auth_user_id')
  result.drivers_offlined = offlined?.length || 0
  await Promise.all((offlined || []).filter((d) => reachable.has(d.auth_user_id)).map((d) => pushToUser(d.auth_user_id, {
    title: 'You’re offline',
    body: 'RideUp hasn’t been open for a while, so we stopped sending you trips. Open the app to go back online.',
    url: '/driver/dashboard',
    tag: 'driver-offline',
  })))
}

const DOC_LABEL = { license: 'driver’s licence', insurance: 'insurance' }
async function docExpiryReminders(result) {
  const { data: last } = await admin.from('system_heartbeats').select('last_run_at').eq('name', 'doc_reminders').maybeSingle()
  if (last && Date.now() - new Date(last.last_run_at).getTime() < 60 * 60_000) return
  await admin.from('system_heartbeats').upsert({ name: 'doc_reminders', last_run_at: new Date().toISOString(), last_ok: true })

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Nassau' }) // YYYY-MM-DD
  const in30 = new Date(Date.now() + 30 * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'America/Nassau' })
  const { data: drivers } = await admin
    .from('drivers')
    .select('id, auth_user_id, name, email, status, license_expires_on, insurance_expires_on')
    .eq('approved', true)
    .is('deleted_at', null)
    .or(`license_expires_on.lte.${in30},insurance_expires_on.lte.${in30}`)
    .limit(500)
  for (const d of drivers || []) {
    let expiredNow = false
    for (const doc of ['license', 'insurance']) {
      const expires = d[`${doc}_expires_on`]
      if (!expires || expires > in30) continue
      const daysLeft = Math.round((new Date(`${expires}T12:00:00`) - new Date(`${today}T12:00:00`)) / 86_400_000)
      const stage = daysLeft < 0 ? 'expired' : daysLeft <= 7 ? '7d' : '30d'
      if (stage === 'expired') expiredNow = true
      const { data: fresh } = await admin.from('driver_doc_reminders')
        .upsert({ driver_id: d.id, doc, stage, expires_on: expires }, { onConflict: 'driver_id,doc,stage,expires_on', ignoreDuplicates: true })
        .select('driver_id')
      if (!fresh?.length) continue // already reminded at this stage
      result.doc_reminders++
      const when = new Date(`${expires}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
      const body = stage === 'expired'
        ? `Your ${DOC_LABEL[doc]} expired on ${when}. Upload the new one to keep driving.`
        : `Your ${DOC_LABEL[doc]} expires on ${when}. Upload the new one in Documents so you can keep driving.`
      await pushToUser(d.auth_user_id, { title: stage === 'expired' ? 'Document expired' : 'Document expiring soon', body, url: '/driver/documents', tag: `doc-${doc}` })
      if (d.email) await sendEmail({ to: d.email, ...docExpiryEmail({ name: d.name, doc: DOC_LABEL[doc], when, expired: stage === 'expired' }) })
    }
    // Expired papers: no new trips (the app already refuses to go online; this ends a session already open).
    if (expiredNow && d.status === 'online') {
      await admin.from('drivers').update({ status: 'offline' }).eq('id', d.id).eq('status', 'online')
      result.expired_offline++
    }
  }
}

// /api/health and the admin pages read this to tell whether the job is still running.
async function heartbeat(ok, result) {
  await admin.from('system_heartbeats')
    .upsert({ name: 'dispatch', last_run_at: new Date().toISOString(), last_ok: ok, last_result: result })
    .then(({ error }) => { if (error) console.error('Heartbeat failed:', error.message) }, () => {})
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET
  if (!admin || !secret) return res.status(500).json({ error: 'Server is not configured' })
  if (req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'Unauthorized' })

  const result = { expired: 0, dispatched: 0, failed: 0, captured: 0, capture_failed: 0, drivers_offlined: 0, stuck_cancelled: 0, checkins: 0, escalated: 0, doc_reminders: 0, expired_offline: 0 }

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
      const duration = Math.round(Math.max(Number(sr.duration_minutes) || 0, distance * 2) * 100) / 100
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
          fare_cents: calculateFare(distance, duration, vehicleType, { pickup: { lat: sr.pickup_lat, lng: sr.pickup_lng } }),
          booking_fee_cents: BOOKING_FEE_CENTS,
          airport_fee_cents: isAirportPickup({ lat: sr.pickup_lat, lng: sr.pickup_lng }) ? AIRPORT_FEE_CENTS : 0,
        })
        .select('id')
        .single()
      if (error || !ride) { console.error('Dispatch insert error:', error?.message); await fail('failed'); continue }

      await admin.from('scheduled_rides').update({ status: 'dispatched', dispatched_ride_id: ride.id }).eq('id', sr.id)
      const notified = await notifyNearbyDrivers(ride.id)
      await alertRideRequest(ride.id, { notified, scheduled: true })
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

    await offlineIdleDrivers(result)

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

    await tripCheckins(result)
    await docExpiryReminders(result)

    await heartbeat(true, result)
    return res.status(200).json(result)
  } catch (err) {
    console.error('Dispatch scheduled error:', err.message)
    await captureServerError('dispatch-scheduled', err, result)
    await heartbeat(false, { ...result, error: err.message })
    return res.status(500).json({ error: 'Dispatch failed' })
  }
}
