import Stripe from 'stripe'
import { buffer } from 'micro'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export const config = {
  api: { bodyParser: false },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const buf = await buffer(req)
  const sig = req.headers['stripe-signature']
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET

  let event

  try {
    event = stripe.webhooks.constructEvent(buf, sig, endpointSecret)
  } catch (err) {
    console.log('Webhook signature verification failed:', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      console.log('Checkout completed:', session.id)
      console.log('Amount:', session.amount_total, 'Currency:', session.currency)
      console.log('Customer email:', session.customer_details?.email)

      if (session.consent?.promotions === 'opt_in') {
        console.log('Customer opted in for promotional emails:', session.customer_details?.email)
      }
      break
    }
    default:
      console.log('Unhandled event type:', event.type)
  }

  res.status(200).json({ received: true })
}
