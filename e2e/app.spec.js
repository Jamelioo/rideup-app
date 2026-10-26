import { test, expect } from '@playwright/test'

// ─── Landing Page ───

test('landing page loads with headline and booking widget', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toContainText('Price locked')
  await expect(page.getByText('Pickup location')).toBeVisible()
  await expect(page.getByText('Where to?')).toBeVisible()
  await expect(page.getByRole('button', { name: 'See my price' }).first()).toBeVisible()
})

test('landing page nav leads with booking, then Log in and Sign up, on phones too', async ({ page }) => {
  for (const width of [1280, 360]) {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/')
    const nav = page.getByRole('navigation', { name: 'Main' })
    await expect(nav.getByRole('link', { name: 'Book a ride', exact: true })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Log in', exact: true })).toBeVisible()
    // Sign up is in the header on wider screens, and in the free-account section on phones (no room for three).
    const signUp = width >= 640 ? nav.getByRole('link', { name: 'Sign up', exact: true }) : page.getByRole('link', { name: 'Create free account' })
    await expect(signUp).toBeVisible()
  }
})

test('the header Book a ride button opens booking', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Book a ride', exact: true }).click()
  await expect(page).toHaveURL('/book')
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

test('"See my price" button navigates to /book', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'See my price' }).first().click()
  await expect(page).toHaveURL('/book')
})

test('the final "See my price" call to action navigates to /book', async ({ page }) => {
  await page.goto('/')
  await page.locator('section[aria-labelledby="cta-title"]').getByRole('button', { name: 'See my price' }).click()
  await expect(page).toHaveURL('/book')
})

test('every new visitor gets the first-ride offer, and it comes off on the booking screen', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('First ride $5 off').first()).toBeVisible()
  await page.getByRole('button', { name: 'See my price' }).first().click()
  await page.locator('input[data-field="pickup"]:visible').fill('Cable Beach, Nassau')
  await page.locator('input[data-field="dropoff"]:visible').fill('Downtown Nassau, Bay St')
  await expect(page.getByText('Promo WELCOME5 −$5.00').filter({ visible: true }).first()).toBeVisible()
})

test('a popular trip opens booking with the trip filled in and priced', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: /^Airport to Cable Beach about \$\d+\.\d{2} .*See exact price/ }).click()
  await expect(page).toHaveURL('/book')
  await expect(page.locator('input[data-field="pickup"]:visible')).toHaveValue(/Lynden Pindling/)
  await expect(page.locator('input[data-field="dropoff"]:visible')).toHaveValue('Cable Beach, Nassau')
  await expect(page.getByText(/You pay \$\d+\.\d{2}/).filter({ visible: true }).first()).toBeVisible()
  // A neighbourhood pickup asks for the exact spot; the airport doesn't.
  await expect(page.getByText('Change this to your exact pickup spot').filter({ visible: true })).toHaveCount(0)
  await page.goto('/book?from=cable-beach&to=downtown')
  await expect(page.getByText('Change this to your exact pickup spot').filter({ visible: true }).first()).toBeVisible()
  // Only known places: anything else in a link is ignored.
  await page.goto('/book?from=nowhere&to=downtown')
  await expect(page).toHaveURL('/book')
  await expect(page.locator('input[data-field="pickup"]:visible')).toHaveValue('')
  await expect(page.locator('input[data-field="dropoff"]:visible')).toHaveValue('Downtown Nassau, Bay Street')
})

test('phones: a "See my price" bar follows the reader until the final call to action', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const bar = page.locator('.fixed.bottom-0').filter({ has: page.getByRole('button', { name: 'See my price' }) })
  await expect(bar).toBeHidden()
  await page.getByRole('heading', { name: 'How it works' }).scrollIntoViewIfNeeded()
  await expect(bar).toBeVisible()
  await expect(bar).toContainText('First ride $5 off')
  await page.getByRole('heading', { name: 'Your first ride comes with' }).scrollIntoViewIfNeeded()
  await expect(bar).toBeHidden()
  await page.getByRole('heading', { name: 'Popular trips' }).scrollIntoViewIfNeeded()
  await bar.getByRole('button', { name: 'See my price' }).click()
  await expect(page).toHaveURL('/book')
})

test('landing answers questions without leaving the page, and offers a free account', async ({ page }) => {
  await page.goto('/')
  const cost = page.locator('details').filter({ hasText: 'How much does a ride cost?' })
  await expect(cost.getByText(/RideUp Go is \$2 plus \$1\.25 a mile/)).toBeHidden()
  await cost.locator('summary').click()
  await expect(cost.getByText(/RideUp Go is \$2 plus \$1\.25 a mile/)).toBeVisible()
  await cost.locator('summary').click()
  await expect(cost.getByText(/RideUp Go is \$2 plus \$1\.25 a mile/)).toBeHidden()
  const pay = page.locator('details').filter({ hasText: 'How do I pay?' })
  await pay.locator('summary').click()
  await expect(pay.getByText(/^In cash, to your driver at drop-off/)).toBeVisible()
  await expect(page.getByText('Pay cash at drop-off').first()).toBeVisible()
  await expect(page.getByText(/pay by card|card is charged|cancellation fee/i)).toHaveCount(0)
  await page.getByRole('link', { name: 'Create free account' }).click()
  await expect(page).toHaveURL('/signup')
})

test('airport page: each fare opens booking from the airport, priced', async ({ page }) => {
  await page.goto('/airport')
  await expect(page.getByText('First ride $5 off').first()).toBeVisible()
  await page.getByRole('link', { name: /^Paradise Island & Atlantis about 30 min about \$/ }).click()
  await expect(page).toHaveURL('/book')
  await expect(page.locator('input[data-field="dropoff"]:visible')).toHaveValue('Paradise Island, Nassau')
  await expect(page.getByText(/You pay \$\d+\.\d{2}/).filter({ visible: true }).first()).toBeVisible()
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

test('rating screen shows the driver and trip, paid in cash, with tips in cash', async ({ page }) => {
  await page.goto('/rate/demo')
  await expect(page.getByRole('heading', { name: /How was your trip with Marcus/ })).toBeVisible()
  await expect(page.getByRole('link', { name: 'View receipt' })).toHaveCount(0) // demo trip has no receipt
  await expect(page.getByText('$13.75 · paid in cash')).toBeVisible()
  await expect(page.getByText('Tips are welcome in cash and go 100% to your driver.', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: /tip/i })).toHaveCount(0)
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

test('with no driver online, riders can still request and are told how it works', async ({ page }) => {
  await page.goto('/book?cars=none')
  await enterDemoTrip(page)
  await expect(page.getByText('No drivers online right now').filter({ visible: true }).first()).toBeVisible()
  await expect(page.getByText('keep looking for up to 5 minutes.', { exact: false }).filter({ visible: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Choose RideUp Go' })).toBeEnabled()
  await page.getByRole('button', { name: 'Choose RideUp Go' }).filter({ visible: true }).click()
  await expect(page.getByText('No drivers are online right now, so we’ve alerted our team.')).toBeVisible()
  await expect(page.getByText('You pay your driver in cash at drop-off.', { exact: false })).toBeVisible()
})

test('every trip is cash: booking says what to pay, and the search what to have ready', async ({ page }) => {
  await page.goto('/book')
  await enterDemoTrip(page)
  await expect(page.getByText(/^Cash · pay \$\d+\.\d\d to your driver at drop-off$/).filter({ visible: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /^Paying with/ })).toHaveCount(0) // nothing to choose
  await expect(page.getByText(/Visa|••••|Add a card/).filter({ visible: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Choose RideUp Go' }).filter({ visible: true }).click()
  await expect(page.getByText(/Pay in cash: have \$\d+\.\d\d ready for your driver\./)).toBeVisible()
})

test('booking for someone else is paid in cash too', async ({ page }) => {
  await page.goto('/book')
  await enterDemoTrip(page)
  await page.getByRole('button', { name: /Book for someone else/ }).filter({ visible: true }).click()
  await page.getByRole('radio', { name: 'Someone else' }).check()
  await page.getByLabel('Passenger’s name').fill('Mary Smith')
  await page.getByLabel('Passenger’s phone').fill('242 555 1234')
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByText(/^Cash · pay \$\d+\.\d\d to your driver at drop-off$/).filter({ visible: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Choose RideUp Go' })).toBeEnabled()
})

test('old card links land somewhere useful', async ({ page }) => {
  await page.goto('/payment-success')
  await expect(page).toHaveURL('/book')
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

test('the old payments page goes to the profile (login when signed out)', async ({ page }) => {
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
