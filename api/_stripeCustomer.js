import { admin } from './_auth.js'

// A Stripe customer id that exists for the Stripe key in use. A customer saved while the app ran on test keys
// doesn't exist in live mode (and vice versa), and Stripe rejects every request that names it. In that case
// make a fresh customer and forget the old card, which can't be charged with these keys either.
export async function usableCustomerId(stripe, { userId, savedId, email, name }) {
  if (savedId) {
    try {
      const existing = await stripe.customers.retrieve(savedId)
      if (!existing.deleted) return savedId
    } catch (err) {
      if (err?.code !== 'resource_missing') throw err
    }
  }
  const customer = await stripe.customers.create({
    name: name || undefined,
    email: email || undefined,
    metadata: { supabase_user_id: userId },
  })
  const clearOldCard = savedId ? { payment_method_id: null, card_brand: null, card_last4: null } : {}
  await admin.from('riders').update({ stripe_customer_id: customer.id, ...clearOldCard }).eq('auth_user_id', userId)
  return customer.id
}

// What to tell the rider when Stripe itself refuses the request because the server's key is wrong or missing.
export function stripeConfigMessage(err) {
  return err?.type === 'StripeAuthenticationError' || err?.type === 'StripePermissionError'
    ? 'Card payments aren’t available right now. Please contact RideUp support.'
    : null
}
