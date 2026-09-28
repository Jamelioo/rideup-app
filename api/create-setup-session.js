import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email } = req.body

  try {
    const domain = process.env.DOMAIN || 'https://rideupnassau.com'

    // Find or create a Stripe customer for this user
    const customers = await stripe.customers.list({ email, limit: 1 })
    let customer = customers.data[0]
    if (!customer) {
      customer = await stripe.customers.create({ email })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'setup',
      ui_mode: 'hosted_page',
      customer: customer.id,
      success_url: `${domain}/payments?card=added`,
      cancel_url: `${domain}/payments`,
      payment_method_types: ['card'],
    })

    res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('Setup session error:', err.message)
    res.status(500).json({ error: err.message })
  }
}
