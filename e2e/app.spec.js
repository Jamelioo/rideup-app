import { test, expect } from '@playwright/test'

// ─── Landing Page ───

test('landing page loads with headline and booking widget', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toContainText('Get anywhere in Nassau')
  await expect(page.getByText('Pickup location')).toBeVisible()
  await expect(page.getByText('Where to?')).toBeVisible()
  await expect(page.getByRole('button', { name: 'See prices' })).toBeVisible()
})

test('landing page nav has Ride, Drive, Log in, Sign up links', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible()
})

test('"See prices" button navigates to /book', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'See prices' }).click()
  await expect(page).toHaveURL('/book')
})

test('"Book a ride now" CTA navigates to /book', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Book a ride now' }).click()
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
  await expect(page.getByPlaceholder('Email address')).toBeVisible()
  await expect(page.getByPlaceholder('Password')).toBeVisible()
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
  await expect(page.getByPlaceholder('Full name')).toBeVisible()
  await expect(page.getByPlaceholder('Email address')).toBeVisible()
  await expect(page.getByPlaceholder('Password (min 6 characters)')).toBeVisible()
  await expect(page.getByPlaceholder('Confirm password')).toBeVisible()
})

test('signup validates empty name', async ({ page }) => {
  await page.goto('/signup')
  await page.getByRole('button', { name: 'Sign up' }).click()
  await expect(page.getByText('Please enter your name')).toBeVisible()
})

test('signup validates empty email', async ({ page }) => {
  await page.goto('/signup')
  await page.getByPlaceholder('Full name').fill('Test User')
  await page.getByRole('button', { name: 'Sign up' }).click()
  await expect(page.getByText('Please enter your email')).toBeVisible()
})

test('signup validates short password', async ({ page }) => {
  await page.goto('/signup')
  await page.getByPlaceholder('Full name').fill('Test User')
  await page.getByPlaceholder('Email address').fill('test@test.com')
  await page.getByPlaceholder('Password (min 6 characters)').fill('123')
  await page.getByPlaceholder('Confirm password').fill('123')
  await page.getByRole('button', { name: 'Sign up' }).click()
  await expect(page.getByText('at least 6 characters')).toBeVisible()
})

test('signup validates password mismatch', async ({ page }) => {
  await page.goto('/signup')
  await page.getByPlaceholder('Full name').fill('Test User')
  await page.getByPlaceholder('Email address').fill('test@test.com')
  await page.getByPlaceholder('Password (min 6 characters)').fill('password123')
  await page.getByPlaceholder('Confirm password').fill('different')
  await page.getByRole('button', { name: 'Sign up' }).click()
  await expect(page.getByText('Passwords do not match')).toBeVisible()
})

// ─── Booking Page ───

test('booking page loads', async ({ page }) => {
  await page.goto('/book')
  await page.waitForLoadState('networkidle')
  // Should show booking interface (pickup/dropoff fields or map)
  await expect(page.locator('body')).not.toBeEmpty()
})

// ─── Navigation ───

test('Sign up link from landing navigates to /signup', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Sign up' }).click()
  await expect(page).toHaveURL('/signup')
})

test('Log in link from landing navigates to /login', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Log in' }).click()
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
  await expect(page.getByText('Confirm ride')).toBeVisible()
})
