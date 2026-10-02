import Stripe from 'stripe'
import { buffer } from 'micro'
import { admin as supabase } from './_auth.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export const config = {
  api: { bodyParser: false },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!supabase) return res.status(500).json({ error: 'Server is not configured' })

  const buf = await buffer(req)
  const sig = req.headers['stripe-signature']
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET

  let event

  try {
    event = stripe.webhooks.constructEvent(buf, sig, endpointSecret)
  } catch (err) {
    console.log('Webhook signature verification failed:', err.message)
    return res.status(400).send('Webhook signature verification failed')
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object

      // Card added from the Payments page (Checkout setup mode): store the verified card on the rider.
      if (session.mode === 'setup' && session.setup_intent && session.customer) {
        const si = await stripe.setupIntents.retrieve(session.setup_intent, { expand: ['payment_method'] })
        const pm = si.payment_method
        if (si.status === 'succeeded' && pm) {
          await supabase
            .from('riders')
            .update({
              payment_method_id: pm.id,
              card_brand: pm.card?.brand || null,
              card_last4: pm.card?.last4 || null,
            })
            .eq('stripe_customer_id', session.customer)
        }
        break
      }

      const rideId = session.metadata?.rideId

      // Only a fully paid session counts; never touch rides.status (it's the ride lifecycle, not payment).
      if (rideId && session.payment_status === 'paid') {
        await supabase
          .from('rides')
          .update({
            payment_status: 'paid',
            payment_session_id: session.id,
            paid_at: new Date().toISOString(),
          })
          .eq('id', rideId)
      }
      break
    }
    case 'charge.refunded': {
      const charge = event.data.object
      if (charge.payment_intent) {
        // Partial captures (cancellation fees, split fares) charge less than was held: compare with what was captured.
        const status = charge.amount_refunded >= (charge.amount_captured || charge.amount) ? 'refunded' : 'partially_refunded'
        await supabase.from('rides').update({ payment_status: status }).eq('payment_intent_id', charge.payment_intent)
      }
      break
    }
    case 'charge.dispute.created': {
      // Flag the ride so it shows up for follow-up; respond with evidence in the Stripe dashboard before the deadline.
      const dispute = event.data.object
      if (dispute.payment_intent) {
        await supabase.from('rides').update({ payment_status: 'disputed' }).eq('payment_intent_id', dispute.payment_intent)
      }
      console.warn(`[DISPUTE] ride payment ${dispute.payment_intent} disputed (${dispute.reason}); respond in the Stripe dashboard before the evidence deadline`)
      break
    }
    case 'payment_intent.payment_failed': {
      const rideId = event.data.object.metadata?.ride_id
      // Only the trip's own payment: a failed tip, or a friend's split-fare share (which falls back to the
      // rider at capture), doesn't make the trip unpaid.
      if (rideId && !['tip', 'split'].includes(event.data.object.metadata?.type)) {
        await supabase.from('rides').update({ payment_status: 'failed' }).eq('id', rideId)
      }
      break
    }
    default:
      break
  }

  res.status(200).json({ received: true })
}
