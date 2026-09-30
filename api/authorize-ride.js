import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { rideId } = req.body

  if (!rideId) {
    return res.status(400).json({ error: 'rideId is required' })
  }

  try {
    const { data: ride, error: rideErr } = await supabase
      .from('rides')
      .select('fare_cents, rider_id')
      .eq('id', rideId)
      .single()

    if (rideErr || !ride) {
      return res.status(404).json({ error: 'Ride not found' })
    }

    const { data: rider, error: riderErr } = await supabase
      .from('riders')
      .select('stripe_customer_id, payment_method_id')
      .eq('id', ride.rider_id)
      .single()

    if (riderErr || !rider) {
      return res.status(404).json({ error: 'Rider not found' })
    }

    if (!rider.stripe_customer_id || !rider.payment_method_id) {
      await supabase
        .from('rides')
        .update({ status: 'cancelled', cancel_reason: 'payment_failed' })
        .eq('id', rideId)
      return res.status(400).json({ success: false, error: 'no_payment_method' })
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: ride.fare_cents,
      currency: 'usd',
      customer: rider.stripe_customer_id,
      payment_method: rider.payment_method_id,
      capture_method: 'manual',
      confirm: true,
      off_session: true,
      metadata: { ride_id: rideId },
    })

    if (paymentIntent.status === 'requires_capture') {
      await supabase
        .from('rides')
        .update({
          payment_intent_id: paymentIntent.id,
          payment_status: 'authorized',
        })
        .eq('id', rideId)

      return res.status(200).json({ success: true, payment_intent_id: paymentIntent.id })
    }

    await supabase
      .from('rides')
      .update({ status: 'cancelled', cancel_reason: 'payment_failed' })
      .eq('id', rideId)

    return res.status(400).json({ success: false, error: 'payment_failed' })
  } catch (err) {
    console.error('Authorize ride error:', err.message)

    if (err.type === 'StripeCardError') {
      await supabase
        .from('rides')
        .update({ status: 'cancelled', cancel_reason: 'payment_failed' })
        .eq('id', rideId)
      return res.status(400).json({ success: false, error: 'card_declined' })
    }

    res.status(500).json({ error: err.message })
  }
}
