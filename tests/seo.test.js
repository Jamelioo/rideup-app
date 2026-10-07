import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SEO_PAGES } from '../src/lib/seoPages.js'

const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url)))
const sitemap = readFileSync(new URL('../public/sitemap.xml', import.meta.url), 'utf8')

test('every public page has a short description, a Vercel route to its own HTML and a sitemap entry', () => {
  for (const page of SEO_PAGES) {
    assert.ok(page.description.length <= 160, `${page.path} description is ${page.description.length} chars`)
    assert.ok(page.title && page.h1, `${page.path} needs a title and heading`)
    assert.ok(sitemap.includes(`<loc>https://www.rideupnassau.com${page.path}</loc>`), `${page.path} missing from sitemap.xml`)
    if (page.path !== '/') {
      assert.ok(vercel.rewrites.some((r) => r.source === page.path && r.destination === `${page.path}/index.html`), `${page.path} missing from vercel.json rewrites`)
    }
  }
})

test('the catch-all rewrite comes last and serves the app shell', () => {
  const last = vercel.rewrites.at(-1)
  assert.equal(last.destination, '/app.html')
})
