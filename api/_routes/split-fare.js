import { admin, requireUser, getRiderForUser, fail } from '../_auth.js'
import { rateLimit } from '../_rateLimit.js'
import { chargeOf, splitShares, MAX_SPLIT_FRIENDS } from '../../src/lib/discounts.js'
import { pushToUser } from '../_push.js'
import { sendEmail, splitInviteEmail } from '../_email.js'

const checkRate = rateLimit({ maxRequests: 30, windowMs: 60_000 })
const SPLITTABLE = ['accepted', 'driver_arrived', 'in_progress']
const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || 'A friend'
const digits = (s) => String(s || '').replace(/\D/g, '')

// Split fare (Uber-style). Everything goes through here so the right people are notified and nobody
// can add themselves to someone else's trip.
//   { action: 'list', rideId }                 rider who booked: who was invited and their answer
//   { action: 'invite', rideId, contact }      rider who booked: invite a RideUp rider by phone or email
//   { action: 'get', splitId }                 invited rider: trip summary and estimated share
//   { action: 'respond', splitId, accept }     invited rider: join or decline
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const blocked = checkRate(req)
  if (blocked) {
    res.setHeader('Retry-After', blocked.retryAfter)
    return res.status(429).json({ error: 'Too many requests. Try again shortly.' })
  }
  const user = await requireUser(req, res)
  if (!user) return

  const { action } = req.body || {}
  try {
    const me = await getRiderForUser(user.id)
    if (!me) return res.status(403).json({ error: 'Book a ride first to use split fare.' })
    if (action === 'list' || action === 'invite') return await ownerAction(req, res, me, action)
    if (action === 'get' || action === 'respond') return await friendAction(req, res, me, action)
    return res.status(400).json({ error: 'Unknown action' })
  } catch (err) {
    return fail(res, 'Split fare error', err)
  }
}

async function loadRide(rideId) {
  const { data } = await admin
    .from('rides')
    .select('id, rider_id, rider_name, status, payment_status, pickup_address, dropoff_address, fare_cents, promo_discount_cents, credit_applied_cents')
    .eq('id', rideId)
    .maybeSingle()
  return data
}

async function splitsFor(rideId) {
  const { data } = await admin
    .from('fare_splits')
    .select('id, status, share_cents, created_at, riders:rider_id(name)')
    .eq('ride_id', rideId)
    .order('created_at')
  return (data || []).map((s) => ({ id: s.id, status: s.status, share_cents: s.share_cents, name: firstName(s.riders?.name) }))
}

async function ownerAction(req, res, me, action) {
  const { rideId, contact } = req.body
  if (!rideId) return res.status(400).json({ error: 'rideId is required' })
  const ride = await loadRide(rideId)
  if (!ride) return res.status(404).json({ error: 'Ride not found' })
  if (ride.rider_id !== me.id) return res.status(403).json({ error: 'Only the rider who booked can split this fare.' })

  if (action === 'list') {
    const splits = await splitsFor(rideId)
    const joined = splits.filter((s) => ['accepted', 'paid'].includes(s.status)).length
    return res.status(200).json({ splits, total_cents: chargeOf(ride), ...splitShares(chargeOf(ride), joined) })
  }

  if (!SPLITTABLE.includes(ride.status) || ride.payment_status !== 'authorized') {
    return res.status(409).json({ error: 'You can split the fare once a driver has accepted, until the trip ends.' })
  }
  const value = String(contact || '').trim()
  if (!value || value.length > 120) return res.status(400).json({ error: 'Enter your friend’s phone number or email.' })

  const existing = await splitsFor(rideId)
  if (existing.filter((s) => s.status !== 'declined').length >= MAX_SPLIT_FRIENDS) {
    return res.status(409).json({ error: `You can split with up to ${MAX_SPLIT_FRIENDS} friends.` })
  }
  if (splitShares(chargeOf(ride), existing.filter((s) => s.status !== 'declined').length + 1).friends === 0) {
    return res.status(409).json({ error: 'This trip is too cheap to split.' })
  }

  // Find the friend's RideUp account: exact email, or the last 10 digits of the phone number.
  let friend = null
  if (value.includes('@')) {
    const { data } = await admin.from('riders').select('id, auth_user_id, name, email, suspended').ilike('email', value.replace(/[%_\\]/g, '\\$&')).is('deleted_at', null).limit(2)
    friend = data?.length === 1 ? data[0] : null
  } else {
    const d = digits(value).slice(-10)
    if (d.length < 7) return res.status(400).json({ error: 'Enter a full phone number.' })
    const { data: ids, error: findErr } = await admin.rpc('find_riders_by_phone', { p_digits: d })
    if (findErr) throw findErr
    const list = (ids || []).map((r) => (typeof r === 'string' ? r : r.find_riders_by_phone))
    if (list.length === 1) {
      const { data } = await admin.from('riders').select('id, auth_user_id, name, email, suspended').eq('id', list[0]).maybeSingle()
      friend = data
    }
  }
  if (!friend || !friend.auth_user_id || friend.suspended) {
    return res.status(404).json({ error: 'We couldn’t find a RideUp rider with that phone or email. Ask your friend to sign up first.' })
  }
  if (friend.id === me.id) return res.status(400).json({ error: 'That’s you. Enter a friend’s phone or email.' })

  const { data: split, error } = await admin
    .from('fare_splits')
    .insert({ ride_id: rideId, rider_id: friend.id, invited_by: me.id })
    .select('id')
    .single()
  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'You already invited this friend.' })
    throw error
  }

  const { data: booker } = await admin.from('riders').select('name').eq('id', ride.rider_id).maybeSingle()
  const inviter = firstName(booker?.name || ride.rider_name)
  const url = `/split/${split.id}`
  await pushToUser(friend.auth_user_id, { title: 'Split a ride?', body: `${inviter} wants to split the fare for a trip to ${ride.dropoff_address?.split(',')[0] || 'their destination'}.`, url, tag: `split-${split.id}` })
  if (friend.email) await sendEmail({ to: friend.email, ...splitInviteEmail({ inviter, ride, url: `${process.env.APP_URL || 'https://rideupnassau.com'}${url}` }) })

  return res.status(200).json({ ok: true, name: firstName(friend.name), splits: await splitsFor(rideId) })
}

async function friendAction(req, res, me, action) {
  const { splitId, accept } = req.body
  if (!splitId) return res.status(400).json({ error: 'splitId is required' })
  const { data: split } = await admin.from('fare_splits').select('id, ride_id, rider_id, status, share_cents').eq('id', splitId).maybeSingle()
  if (!split || split.rider_id !== me.id) return res.status(404).json({ error: 'This invite isn’t for your account.' })
  const ride = await loadRide(split.ride_id)
  if (!ride) return res.status(404).json({ error: 'Ride not found' })

  const open = SPLITTABLE.includes(ride.status) && ride.payment_status === 'authorized'
  const others = (await splitsFor(ride.id)).filter((s) => s.id !== split.id && ['accepted', 'paid'].includes(s.status)).length
  const estimate = splitShares(chargeOf(ride), others + 1).friendShare

  if (action === 'get') {
    const { data: card } = await admin.from('riders').select('payment_method_id, card_brand, card_last4').eq('id', me.id).maybeSingle()
    return res.status(200).json({
      status: split.status,
      open: open && split.status === 'invited',
      inviter: firstName((await admin.from('riders').select('name').eq('id', ride.rider_id).maybeSingle()).data?.name || ride.rider_name),
      pickup: ride.pickup_address,
      dropoff: ride.dropoff_address,
      share_cents: split.share_cents || estimate,
      has_card: !!card?.payment_method_id,
      card: card?.card_last4 ? `${card.card_brand || 'Card'} •••• ${card.card_last4}` : '',
    })
  }

  if (split.status !== 'invited') return res.status(409).json({ error: 'You’ve already answered this invite.' })
  if (!open) return res.status(409).json({ error: 'This trip has ended, so the fare can’t be split any more.' })
  if (accept) {
    const { data: card } = await admin.from('riders').select('payment_method_id').eq('id', me.id).maybeSingle()
    if (!card?.payment_method_id) return res.status(400).json({ error: 'Add a card first, then accept.', reason: 'no_card' })
  }
  const { data: updated } = await admin
    .from('fare_splits')
    .update({ status: accept ? 'accepted' : 'declined', responded_at: new Date().toISOString() })
    .eq('id', split.id)
    .eq('status', 'invited')
    .select('id')
  if (!updated?.length) return res.status(409).json({ error: 'You’ve already answered this invite.' })

  const { data: owner } = await admin.from('riders').select('auth_user_id').eq('id', ride.rider_id).maybeSingle()
  const { data: friend } = await admin.from('riders').select('name').eq('id', me.id).maybeSingle()
  await pushToUser(owner?.auth_user_id, {
    title: accept ? 'Fare split accepted' : 'Fare split declined',
    body: `${firstName(friend?.name)} ${accept ? 'is splitting this fare with you.' : 'declined to split the fare.'}`,
    url: `/ride/${ride.id}`,
    tag: `ride-${ride.id}`,
  })
  return res.status(200).json({ ok: true, status: accept ? 'accepted' : 'declined' })
}
