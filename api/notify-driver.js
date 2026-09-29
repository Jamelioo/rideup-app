import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { rateLimit } from './_rateLimit.js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const checkRate = rateLimit({ maxRequests: 5, windowMs: 60_000 })

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const blocked = checkRate(req)
  if (blocked) {
    res.setHeader('Retry-After', blocked.retryAfter)
    return res.status(429).json({ error: 'Too many requests. Try again shortly.' })
  }

  const { driverId, type } = req.body

  if (!driverId || !type) {
    return res.status(400).json({ error: 'Missing driverId or type' })
  }

  try {
    const { data: driver } = await supabase
      .from('drivers')
      .select('name, email, auth_user_id')
      .eq('id', driverId)
      .single()

    if (!driver || !driver.email) {
      return res.status(200).json({ sent: false, reason: 'No email on file' })
    }

    const driverName = driver.name || 'Driver'
    const fromAddress = process.env.EMAIL_FROM || 'RideUp <noreply@rideupnassau.com>'

    const templates = {
      approved: {
        subject: "You're approved to drive with RideUp!",
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
            <div style="text-align:center;margin-bottom:24px;">
              <span style="font-size:24px;font-weight:700;color:#191f1c;">Ride</span><span style="font-size:24px;font-weight:700;color:#2b8659;">Up</span>
            </div>
            <h1 style="font-size:22px;color:#191f1c;margin-bottom:8px;">Welcome aboard, ${driverName}!</h1>
            <p style="font-size:15px;color:#555;line-height:1.6;">Your driver application has been approved. You can now start accepting rides and earning money on your schedule.</p>
            <a href="https://www.rideupnassau.com/driver/dashboard" style="display:inline-block;background:#2b8659;color:white;padding:14px 32px;border-radius:12px;font-weight:600;font-size:15px;text-decoration:none;margin:24px 0;">Open Driver Dashboard</a>
            <p style="font-size:13px;color:#999;margin-top:32px;">— The RideUp Nassau Team</p>
          </div>`,
      },
      rejected: {
        subject: 'Update on your RideUp driver application',
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
            <div style="text-align:center;margin-bottom:24px;">
              <span style="font-size:24px;font-weight:700;color:#191f1c;">Ride</span><span style="font-size:24px;font-weight:700;color:#2b8659;">Up</span>
            </div>
            <h1 style="font-size:22px;color:#191f1c;margin-bottom:8px;">Hi ${driverName},</h1>
            <p style="font-size:15px;color:#555;line-height:1.6;">Thank you for your interest in driving with RideUp. Unfortunately, we're unable to approve your application at this time.</p>
            <p style="font-size:15px;color:#555;line-height:1.6;">If you believe this was in error, please contact our support team.</p>
            <a href="https://www.rideupnassau.com/support" style="display:inline-block;background:#2b8659;color:white;padding:14px 32px;border-radius:12px;font-weight:600;font-size:15px;text-decoration:none;margin:24px 0;">Contact Support</a>
            <p style="font-size:13px;color:#999;margin-top:32px;">— The RideUp Nassau Team</p>
          </div>`,
      },
    }

    const template = templates[type]
    if (!template) {
      return res.status(400).json({ error: `Unknown notification type: ${type}` })
    }

    if (resend) {
      await resend.emails.send({
        from: fromAddress,
        to: driver.email,
        subject: template.subject,
        html: template.html,
      })
      return res.status(200).json({ sent: true, email: driver.email })
    }

    // No email service configured — log and return
    console.log(`[NOTIFY] ${type}: ${driverName} (${driver.email})`)
    res.status(200).json({ sent: false, reason: 'No email service configured (add RESEND_API_KEY)' })
  } catch (err) {
    console.error('Notify error:', err.message)
    res.status(500).json({ error: 'Failed to send notification' })
  }
}
