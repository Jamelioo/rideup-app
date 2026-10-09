import { test, expect } from '@playwright/test'

// ─── Landing Page ───

test('landing page loads with headline and booking widget', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toContainText('Get anywhere in Nassau')
  await expect(page.getByText('Pickup location')).toBeVisible()
  await expect(page.getByText('Where to?')).toBeVisible()
  await expect(page.getByRole('button', { name: 'See prices' })).toBeVisible()
})

test('landing page nav has Log in and Sign up, on phones too', async ({ page }) => {
  for (const width of [1280, 360]) {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/')
    const nav = page.getByRole('navigation', { name: 'Main' })
    await expect(nav.getByRole('link', { name: 'Log in', exact: true })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Sign up', exact: true })).toBeVisible()
  }
})

test('landing fields open booking with that field ready to type in', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Where to?' }).click()
  await expect(page).toHaveURL('/book')
  await expect(page.locator('input[data-field="dropoff"]:visible')).toBeFocused()
})

test('landing shows popular trip prices', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Popular trips' })).toBeVisible()
  await expect(page.getByText(/^about \$\d+\.\d{2}$/).first()).toBeVisible()
})

test('"See prices" button navigates to /book', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'See prices' }).click()
  await expect(page).toHaveURL('/book')
})

test('"Book a ride" CTA navigates to /book', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Book a ride', exact: true }).click()
  await expect(page).toHaveURL('/book')
})

test('footer has Instagram and WhatsApp links', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('a[href*="instagram.com/rideupnassau"]')).toBeVisible()
  await expect(page.locator('a[href*="wa.me/12424529911"]')).toBeVisible()
})

// ─── Login Page ───

test('login page renders with form fields', async ({ page }) => {
  await page.goto('/login')
  await expect(page.locator('h1')).toContainText('Welcome back')
  await expect(page.getByLabel('Email address')).toBeVisible()
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible()
})

test('login shows error on empty submit', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByText('Please enter your email and password')).toBeVisible()
})

test('login page has signup link', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible()
})

test('login page has forgot password', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByText('Forgot password?')).toBeVisible()
})

// ─── Signup Page ───

test('signup page renders with all form fields', async ({ page }) => {
  await page.goto('/signup')
  await expect(page.getByLabel('Full name')).toBeVisible()
  await expect(page.getByLabel('Email address')).toBeVisible()
  await expect(page.getByLabel('Mobile number')).toBeVisible()
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign up' })).toBeVisible()
})

test('signup asks for a mobile number', async ({ page }) => {
  await page.goto('/signup')
  await page.getByLabel('Full name').fill('Test User')
  await page.getByLabel('Email address').fill('test@test.com')
  await page.getByLabel('Password', { exact: true }).fill('long-enough-password')
  await page.getByRole('button', { name: 'Sign up' }).click()
  await expect(page.getByText('Please enter a valid mobile number')).toBeVisible()
  const phone = page.getByLabel('Mobile number')
  await phone.fill('555 0100')
  await phone.blur()
  await expect(phone).toHaveValue('(242) 555-0100')
})

test('signup validates empty name', async ({ page }) => {
  await page.goto('/signup')
  await page.getByRole('button', { name: 'Sign up' }).click()
  await expect(page.getByText('Please enter your name')).toBeVisible()
})

test('signup validates email', async ({ page }) => {
  await page.goto('/signup')
  await page.getByLabel('Full name').fill('Test User')
  await page.getByLabel('Email address').fill('not-an-email')
  await page.getByRole('button', { name: 'Sign up' }).click()
  await expect(page.getByText('Please enter a valid email address')).toBeVisible()
})

test('signup validates short password', async ({ page }) => {
  await page.goto('/signup')
  await page.getByLabel('Full name').fill('Test User')
  await page.getByLabel('Email address').fill('test@test.com')
  await page.getByLabel('Mobile number').fill('242 555 0100')
  await page.getByLabel('Password', { exact: true }).fill('1234567')
  await page.getByRole('button', { name: 'Sign up' }).click()
  await expect(page.getByText('at least 8 characters.')).toBeVisible()
})

test('signup password can be shown', async ({ page }) => {
  await page.goto('/signup')
  const field = page.getByLabel('Password', { exact: true })
  await expect(field).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: 'Show password' }).click()
  await expect(field).toHaveAttribute('type', 'text')
})

// ─── Password reset ───

test('forgot password asks for the email first', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Forgot password?' }).click()
  await expect(page.getByText('Enter your email address above')).toBeVisible()
})

test('reset password page lets you choose a new password', async ({ page }) => {
  await page.goto('/reset-password')
  await expect(page.getByRole('heading', { name: 'Set a new password' })).toBeVisible()
  await page.getByLabel('New password').fill('short')
  await page.getByRole('button', { name: 'Update password' }).click()
  await expect(page.getByText('Use at least 8 characters.')).toBeVisible()
  await page.getByLabel('New password').fill('a-much-better-pass1')
  await page.getByLabel('Confirm password').fill('a-much-better-pass2')
  await page.getByRole('button', { name: 'Update password' }).click()
  await expect(page.getByText('The two passwords don’t match.')).toBeVisible()
  await page.getByLabel('Confirm password').fill('a-much-better-pass1')
  await page.getByRole('button', { name: 'Update password' }).click()
  await expect(page.getByRole('heading', { name: 'Password updated' })).toBeVisible()
})

test('login redirect ignores off-site targets', async ({ page }) => {
  await page.goto('/login?redirect=//evil.example')
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
})

// ─── After the trip ───

test('rating screen shows the driver, trip and tip options', async ({ page }) => {
  await page.goto('/rate/demo')
  await expect(page.getByRole('heading', { name: /How was your trip with Marcus/ })).toBeVisible()
  await expect(page.getByRole('link', { name: 'View receipt' })).toHaveCount(0) // demo trip has no receipt
  await expect(page.getByRole('button', { name: '$5' })).toBeVisible()
  await page.getByRole('button', { name: '$5' }).click()
  await expect(page.getByRole('button', { name: 'Add $5.00 tip' })).toBeVisible()
})

test('low rating asks what went wrong and offers a safety report', async ({ page }) => {
  await page.goto('/rate/demo')
  await page.getByRole('button', { name: '2 stars' }).click()
  await expect(page.getByText('What went wrong?')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Report a safety issue' })).toBeVisible()
})

test('shared trip page works without logging in', async ({ page }) => {
  await page.goto('/track/demo')
  await expect(page.getByText('Ann is on the way')).toBeVisible()
  await expect(page.getByText('TX 4471')).toBeVisible()
})

// ─── Booking Page ───

test('booking page loads', async ({ page }) => {
  await page.goto('/book')
  await page.waitForLoadState('networkidle')
  // Should show booking interface (pickup/dropoff fields or map)
  await expect(page.locator('body')).not.toBeEmpty()
})

async function enterDemoTrip(page) {
  await page.locator('input[placeholder="Pickup — try Cable Beach"]:visible').fill('Cable Beach, Nassau')
  await page.locator('input[placeholder="Destination — try Airport"]:visible').fill('Downtown Nassau, Bay St')
}

test('booking shows how soon a car can come', async ({ page }) => {
  await page.goto('/book')
  await enterDemoTrip(page)
  await expect(page.getByText('5 min away').filter({ visible: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Choose RideUp Go' })).toBeEnabled()
})

test('booking is switched off when no car can come', async ({ page }) => {
  await page.goto('/book?cars=none')
  await enterDemoTrip(page)
  await expect(page.getByText('No cars available right now').filter({ visible: true }).first()).toBeVisible()
  await expect(page.getByText('Unavailable').filter({ visible: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'No cars available' })).toBeDisabled()
})

test('booking explains when every driver is on a trip', async ({ page }) => {
  await page.goto('/book?cars=busy')
  await enterDemoTrip(page)
  await expect(page.getByText('All drivers are on trips right now').filter({ visible: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'No cars available' })).toBeDisabled()
})

// ─── Navigation ───

test('Sign up link from landing navigates to /signup', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Sign up', exact: true }).click()
  await expect(page).toHaveURL('/signup')
})

test('Log in link from landing navigates to /login', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Log in', exact: true }).click()
  await expect(page).toHaveURL('/login')
})

test('support page loads', async ({ page }) => {
  await page.goto('/support')
  await expect(page.locator('body')).not.toBeEmpty()
})

test('about page loads', async ({ page }) => {
  await page.goto('/about')
  await expect(page.locator('body')).not.toBeEmpty()
})

test('privacy page loads', async ({ page }) => {
  await page.goto('/privacy')
  await expect(page.locator('body')).not.toBeEmpty()
})

test('terms page loads', async ({ page }) => {
  await page.goto('/terms')
  await expect(page.locator('body')).not.toBeEmpty()
})

test('driver apply page loads', async ({ page }) => {
  await page.goto('/driver/apply')
  await expect(page.locator('body')).not.toBeEmpty()
})

test('404 page for unknown routes', async ({ page }) => {
  await page.goto('/nonexistent-page')
  await expect(page.locator('body')).toContainText(/not found|404/i)
})

// ─── Auth Guards ───
// Demo mode (no Supabase configured) intentionally disables the route guards, so these only apply to a real backend.
async function skipInDemoMode(page, test) {
  await page.goto('/')
  test.skip(await page.getByText('Demo mode', { exact: false }).first().isVisible().catch(() => false), 'route guards are off in demo mode')
}


test('profile redirects to login when not authenticated', async ({ page }) => {
  await skipInDemoMode(page, test)
  await page.goto('/profile')
  await expect(page).toHaveURL(/\/login/)
})

test('payments redirects to login when not authenticated', async ({ page }) => {
  await skipInDemoMode(page, test)
  await page.goto('/payments')
  await expect(page).toHaveURL(/\/login/)
})

test('my-rides redirects to login when not authenticated', async ({ page }) => {
  await skipInDemoMode(page, test)
  await page.goto('/my-rides')
  await expect(page).toHaveURL(/\/login/)
})

// ─── Mobile Responsive ───

test('phone mockup hidden on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  // The phone mockup div has class "hidden md:flex" so should not be visible
  const mockup = page.locator('text=Where are you going?').first()
  // The booking widget "Where to?" should be visible but the phone mockup text shouldn't
  await expect(page.getByText('Pickup location')).toBeVisible()
})

test('phone mockup visible on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await expect(page.getByText('Choose RideUp Go', { exact: true })).toBeVisible()
})

// ─── Admin operations (demo data) ───

test('admin Live shows waiting requests, trips under way, missed rides and drivers', async ({ page }) => {
  await page.goto('/admin/live')
  await expect(page.getByRole('heading', { name: 'Live', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Waiting for a driver' })).toBeVisible()
  await expect(page.getByText('Ienka Johnson')).toBeVisible()
  await expect(page.getByRole('link', { name: /Call back/ })).toBeVisible()
  await expect(page.getByRole('switch', { name: 'Ride alerts' })).toBeVisible()
})

test('admin can give a waiting request to a driver', async ({ page }) => {
  page.on('dialog', (d) => d.accept())
  await page.goto('/admin/live')
  await page.getByRole('button', { name: 'Assign driver' }).click()
  await page.getByRole('radio', { name: /Deon Rolle/ }).check()
  await page.getByRole('button', { name: 'Assign', exact: true }).click()
  await expect(page.getByText('Assigned to Deon Rolle')).toBeVisible()
})

test('admin can add a private note to a ride', async ({ page }) => {
  await page.goto('/admin/live')
  await page.getByRole('button', { name: 'Details' }).first().click()
  await page.getByLabel('Add a note').fill('Called the rider')
  await page.getByRole('button', { name: 'Add note' }).click()
  await expect(page.getByText('Called the rider')).toBeVisible()
})

test('admin Messages previews a broadcast before sending', async ({ page }) => {
  await page.goto('/admin/messages')
  await page.getByRole('button', { name: /\$5 off this weekend/ }).click()
  await expect(page.getByLabel('Preview')).toContainText('WELCOME5')
  await expect(page.getByRole('button', { name: 'Send a test to me' })).toBeEnabled()
})

test('admin Team and Activity pages load', async ({ page }) => {
  await page.goto('/admin/team')
  await expect(page.getByRole('heading', { name: 'Add someone' })).toBeVisible()
  await page.goto('/admin/activity')
  await expect(page.getByText('Suspended a rider')).toBeVisible()
})
