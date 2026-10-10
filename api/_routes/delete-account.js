import Stripe from 'stripe'
import { admin, requireUser, fail } from '../_auth.js'
import { rateLimit } from '../_rateLimit.js'

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null
const docFolder = (uid) => `driver-documents/${uid}` // same as src/lib/driverDocs.js
const checkRate = rateLimit({ maxRequests: 5, windowMs: 60_000 })

const BLOCKERS = {
  active_ride: 'Finish or cancel your current trip first.',
  unpaid_balance: 'You have an unpaid trip. Update your card in Payments, then try again.',
  payout_owed: 'You have earnings waiting to be paid out. Contact support so we can pay you before your account is deleted.',
  cash_unpaid: 'A driver reported an unpaid cash fare on your account. Contact support to sort it out, then try again.',
  cash_owed: 'You’re holding cash from trips that belongs to RideUp. Contact support to settle up before your account is deleted.',
}

// In-app account deletion (required by the App Store and Google Play). Erases personal data and the login;
// trips and payments stay on record without the person's name, as the Privacy Policy describes.
//   body: { confirm: 'DELETE', check?: true }  (check only reports whether deletion is possible)
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const blocked = checkRate(req)
  if (blocked) {
    res.setHeader('Retry-After', blocked.retryAfter)
    return res.status(429).json({ error: 'Too many requests. Try again shortly.' })
  }

  const user = await requireUser(req, res)
  if (!user) return

  const { confirm, check } = req.body || {}

  try {
    const { data: reason, error: blockErr } = await admin.rpc('account_deletion_blocker', { p_user: user.id })
    if (blockErr) throw blockErr
    if (reason) return res.status(409).json({ error: BLOCKERS[reason] || 'Your account can’t be deleted right now.', reason })
    if (check) return res.status(200).json({ ok: true })
    if (confirm !== 'DELETE') return res.status(400).json({ error: 'Type DELETE to confirm.' })

    const { data: rider } = await admin.from('riders').select('stripe_customer_id').eq('auth_user_id', user.id).maybeSingle()

    // Saved cards go first: deleting the Stripe customer removes them. Payment history stays with Stripe.
    if (rider?.stripe_customer_id && stripe) {
      await stripe.customers.del(rider.stripe_customer_id).catch((err) => {
        if (err.code !== 'resource_missing') throw err
      })
    }

    // Profile photo and driver documents.
    const { data: docs } = await admin.storage.from('documents').list(docFolder(user.id), { limit: 100 })
    if (docs?.length) await admin.storage.from('documents').remove(docs.map((f) => `${docFolder(user.id)}/${f.name}`))
    const { data: avatars } = await admin.storage.from('avatars').list('avatars', { search: user.id, limit: 20 })
    const mine = (avatars || []).filter((f) => f.name.startsWith(`${user.id}.`)).map((f) => `avatars/${f.name}`)
    if (mine.length) await admin.storage.from('avatars').remove(mine)

    const { error: eraseErr } = await admin.rpc('erase_account_data', { p_user: user.id })
    if (eraseErr) throw eraseErr

    const { error: delErr } = await admin.auth.admin.deleteUser(user.id)
    if (delErr) throw delErr

    return res.status(200).json({ ok: true })
  } catch (err) {
    return fail(res, 'Delete account error', err)
  }
}
