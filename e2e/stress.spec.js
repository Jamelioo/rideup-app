import { test, expect } from '@playwright/test'

test.describe.configure({ mode: 'parallel' })

const pages = ['/', '/book', '/login', '/signup', '/support', '/about', '/privacy', '/terms', '/driver/apply', '/profile', '/payments', '/my-rides']

// Random actions a user might take
const actions = [
  // Rapid navigation — slam through pages
  async (page) => {
    for (const url of pages.sort(() => Math.random() - 0.5).slice(0, 5)) {
      await page.goto(url)
      await page.waitForLoadState('domcontentloaded')
    }
  },

  // Spam click every button on the landing page
  async (page) => {
    await page.goto('/')
    const buttons = page.getByRole('button')
    const count = await buttons.count()
    for (let i = 0; i < count; i++) {
      await buttons.nth(i).click().catch(() => {})
      await page.waitForTimeout(50)
    }
  },

  // Spam click every link on the landing page
  async (page) => {
    await page.goto('/')
    const links = page.getByRole('link')
    const count = await links.count()
    for (let i = 0; i < count; i++) {
      await links.nth(i).click().catch(() => {})
      await page.waitForTimeout(50)
      await page.goto('/')
    }
  },

  // Fill login with garbage and spam submit
  async (page) => {
    await page.goto('/login')
    for (let i = 0; i < 10; i++) {
      await page.getByPlaceholder('Email address').fill(`garbage${Math.random()}@fake.xxx`)
      await page.getByPlaceholder('Password').fill(`pwd${Math.random()}`)
      await page.getByRole('button', { name: 'Log in' }).click()
      await page.waitForTimeout(100)
    }
  },

  // Fill signup with garbage and spam submit
  async (page) => {
    await page.goto('/signup')
    for (let i = 0; i < 5; i++) {
      await page.getByPlaceholder('Full name').fill(`Bot ${Math.random().toString(36).slice(2)}`)
      await page.getByPlaceholder('Email address').fill(`bot${Math.random()}@fake.xxx`)
      await page.getByPlaceholder('Password (min 6 characters)').fill('ab')
      await page.getByPlaceholder('Confirm password').fill('cd')
      await page.getByRole('button', { name: 'Sign up' }).click()
      await page.waitForTimeout(100)
    }
  },

  // Rapid back/forward navigation
  async (page) => {
    await page.goto('/')
    await page.goto('/login')
    await page.goto('/signup')
    await page.goto('/book')
    await page.goBack()
    await page.goBack()
    await page.goForward()
    await page.goBack()
    await page.goto('/')
  },

  // Resize viewport rapidly (orientation changes)
  async (page) => {
    await page.goto('/')
    const sizes = [
      { width: 375, height: 812 },
      { width: 812, height: 375 },
      { width: 320, height: 568 },
      { width: 1920, height: 1080 },
      { width: 768, height: 1024 },
      { width: 1024, height: 768 },
      { width: 375, height: 812 },
    ]
    for (const size of sizes) {
      await page.setViewportSize(size)
      await page.waitForTimeout(50)
    }
    await expect(page.locator('body')).toBeVisible()
  },

  // Hit protected routes without auth
  async (page) => {
    const protectedRoutes = ['/profile', '/payments', '/my-rides', '/edit-profile', '/driver/dashboard', '/driver/earnings', '/driver/profile']
    for (const route of protectedRoutes) {
      await page.goto(route)
      await page.waitForLoadState('domcontentloaded')
    }
  },

  // Hit nonexistent routes
  async (page) => {
    const junk = ['/asdf', '/admin', '/api/users', '/../../../etc/passwd', '/login?redirect=javascript:alert(1)', '/%00', '/book?pickup=<script>alert(1)</script>']
    for (const route of junk) {
      await page.goto(route)
      await page.waitForLoadState('domcontentloaded')
    }
  },

  // Scroll the entire landing page rapidly
  async (page) => {
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await page.waitForTimeout(30)
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.waitForTimeout(30)
    }
    await expect(page.locator('body')).toBeVisible()
  },

  // Double/triple click elements
  async (page) => {
    await page.goto('/')
    await page.locator('h1').dblclick().catch(() => {})
    await page.getByRole('button', { name: 'See prices' }).dblclick().catch(() => {})
    await page.waitForLoadState('domcontentloaded')
  },

  // Open booking page and interact
  async (page) => {
    await page.goto('/book')
    await page.waitForLoadState('domcontentloaded')
    // Click around whatever is on the booking page
    const buttons = page.getByRole('button')
    const count = await buttons.count()
    for (let i = 0; i < Math.min(count, 8); i++) {
      await buttons.nth(i).click().catch(() => {})
      await page.waitForTimeout(50)
    }
  },
]

// Generate 100 bots, each picks a random action
for (let bot = 1; bot <= 100; bot++) {
  test(`bot ${bot} — random chaos`, async ({ page }) => {
    const action = actions[Math.floor(Math.random() * actions.length)]
    await action(page)
    // If we got here without crashing, the app survived
    await expect(page.locator('body')).toBeVisible()
  })
}
