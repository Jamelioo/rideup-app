# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stress.spec.js >> bot 9 — random chaos
- Location: e2e/stress.spec.js:151:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.goto: Test timeout of 30000ms exceeded.
Call log:
  - navigating to "http://localhost:5176/", waiting until "load"

```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test'
  2   | 
  3   | test.describe.configure({ mode: 'parallel' })
  4   | 
  5   | const pages = ['/', '/book', '/login', '/signup', '/support', '/about', '/privacy', '/terms', '/driver/apply', '/profile', '/payments', '/my-rides']
  6   | 
  7   | // Random actions a user might take
  8   | const actions = [
  9   |   // Rapid navigation — slam through pages
  10  |   async (page) => {
  11  |     for (const url of pages.sort(() => Math.random() - 0.5).slice(0, 5)) {
  12  |       await page.goto(url)
  13  |       await page.waitForLoadState('domcontentloaded')
  14  |     }
  15  |   },
  16  | 
  17  |   // Spam click every button on the landing page
  18  |   async (page) => {
  19  |     await page.goto('/')
  20  |     const buttons = page.getByRole('button')
  21  |     const count = await buttons.count()
  22  |     for (let i = 0; i < count; i++) {
  23  |       await buttons.nth(i).click().catch(() => {})
  24  |       await page.waitForTimeout(50)
  25  |     }
  26  |   },
  27  | 
  28  |   // Spam click every link on the landing page
  29  |   async (page) => {
  30  |     await page.goto('/')
  31  |     const links = page.getByRole('link')
  32  |     const count = await links.count()
  33  |     for (let i = 0; i < count; i++) {
  34  |       await links.nth(i).click().catch(() => {})
  35  |       await page.waitForTimeout(50)
> 36  |       await page.goto('/')
      |                  ^ Error: page.goto: Test timeout of 30000ms exceeded.
  37  |     }
  38  |   },
  39  | 
  40  |   // Fill login with garbage and spam submit
  41  |   async (page) => {
  42  |     await page.goto('/login')
  43  |     for (let i = 0; i < 10; i++) {
  44  |       await page.getByPlaceholder('Email address').fill(`garbage${Math.random()}@fake.xxx`)
  45  |       await page.getByPlaceholder('Password').fill(`pwd${Math.random()}`)
  46  |       await page.getByRole('button', { name: 'Log in' }).click()
  47  |       await page.waitForTimeout(100)
  48  |     }
  49  |   },
  50  | 
  51  |   // Fill signup with garbage and spam submit
  52  |   async (page) => {
  53  |     await page.goto('/signup')
  54  |     for (let i = 0; i < 5; i++) {
  55  |       await page.getByPlaceholder('Full name').fill(`Bot ${Math.random().toString(36).slice(2)}`)
  56  |       await page.getByPlaceholder('Email address').fill(`bot${Math.random()}@fake.xxx`)
  57  |       await page.getByPlaceholder('Password (min 6 characters)').fill('ab')
  58  |       await page.getByPlaceholder('Confirm password').fill('cd')
  59  |       await page.getByRole('button', { name: 'Sign up' }).click()
  60  |       await page.waitForTimeout(100)
  61  |     }
  62  |   },
  63  | 
  64  |   // Rapid back/forward navigation
  65  |   async (page) => {
  66  |     await page.goto('/')
  67  |     await page.goto('/login')
  68  |     await page.goto('/signup')
  69  |     await page.goto('/book')
  70  |     await page.goBack()
  71  |     await page.goBack()
  72  |     await page.goForward()
  73  |     await page.goBack()
  74  |     await page.goto('/')
  75  |   },
  76  | 
  77  |   // Resize viewport rapidly (orientation changes)
  78  |   async (page) => {
  79  |     await page.goto('/')
  80  |     const sizes = [
  81  |       { width: 375, height: 812 },
  82  |       { width: 812, height: 375 },
  83  |       { width: 320, height: 568 },
  84  |       { width: 1920, height: 1080 },
  85  |       { width: 768, height: 1024 },
  86  |       { width: 1024, height: 768 },
  87  |       { width: 375, height: 812 },
  88  |     ]
  89  |     for (const size of sizes) {
  90  |       await page.setViewportSize(size)
  91  |       await page.waitForTimeout(50)
  92  |     }
  93  |     await expect(page.locator('body')).toBeVisible()
  94  |   },
  95  | 
  96  |   // Hit protected routes without auth
  97  |   async (page) => {
  98  |     const protectedRoutes = ['/profile', '/payments', '/my-rides', '/edit-profile', '/driver/dashboard', '/driver/earnings', '/driver/profile']
  99  |     for (const route of protectedRoutes) {
  100 |       await page.goto(route)
  101 |       await page.waitForLoadState('domcontentloaded')
  102 |     }
  103 |   },
  104 | 
  105 |   // Hit nonexistent routes
  106 |   async (page) => {
  107 |     const junk = ['/asdf', '/admin', '/api/users', '/../../../etc/passwd', '/login?redirect=javascript:alert(1)', '/%00', '/book?pickup=<script>alert(1)</script>']
  108 |     for (const route of junk) {
  109 |       await page.goto(route)
  110 |       await page.waitForLoadState('domcontentloaded')
  111 |     }
  112 |   },
  113 | 
  114 |   // Scroll the entire landing page rapidly
  115 |   async (page) => {
  116 |     await page.goto('/')
  117 |     await page.waitForLoadState('domcontentloaded')
  118 |     for (let i = 0; i < 10; i++) {
  119 |       await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  120 |       await page.waitForTimeout(30)
  121 |       await page.evaluate(() => window.scrollTo(0, 0))
  122 |       await page.waitForTimeout(30)
  123 |     }
  124 |     await expect(page.locator('body')).toBeVisible()
  125 |   },
  126 | 
  127 |   // Double/triple click elements
  128 |   async (page) => {
  129 |     await page.goto('/')
  130 |     await page.locator('h1').dblclick().catch(() => {})
  131 |     await page.getByRole('button', { name: 'See prices' }).dblclick().catch(() => {})
  132 |     await page.waitForLoadState('domcontentloaded')
  133 |   },
  134 | 
  135 |   // Open booking page and interact
  136 |   async (page) => {
```