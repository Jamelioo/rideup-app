// Runs after `vite build`. The app is a single page, so every URL used to send crawlers the same HTML: the home
// page's title, description and canonical link, and no heading. Crawlers that don't run JavaScript then saw
// /airport, /drive… as copies of the home page. This writes one HTML file per public page (dist/airport/index.html,
// served for /airport) with that page's own head tags and a plain heading, intro and links inside #app; Vue
// replaces that content as soon as it starts. Every other route gets dist/app.html, the untouched shell.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { SITE, SEO_PAGES } from '../src/lib/seoPages.js'

const DIST = new URL('../dist/', import.meta.url).pathname
const shell = readFileSync(join(DIST, 'index.html'), 'utf8')
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const nav = [['/', 'Home'], ['/book', 'Book a ride'], ['/airport', 'Airport rides'], ['/drive', 'Drive with RideUp'], ['/support', 'Help'], ['/about', 'About']]

function replaceOnce(html, pattern, value, label) {
  if (!pattern.test(html)) throw new Error(`seo-pages: ${label} not found in index.html`)
  return html.replace(pattern, value)
}

function pageHtml(page) {
  const url = SITE + page.path
  let html = shell
  html = replaceOnce(html, /<title>[^<]*<\/title>/, `<title>${esc(page.title)}</title>`, '<title>')
  html = replaceOnce(html, /<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${esc(page.description)}" />`, 'meta description')
  html = replaceOnce(html, /<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${url}" />`, 'canonical link')
  html = html.replace(/<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${url}" />`)
  const links = nav.filter(([href]) => href !== page.path).map(([href, text]) => `<a href="${href}">${esc(text)}</a>`).join(' · ')
  const fallback = `<div id="app"><main style="max-width:40rem;margin:0 auto;padding:3rem 1.5rem;font-family:system-ui,sans-serif">` +
    `<h1>${esc(page.h1)}</h1><p>${esc(page.intro)}</p><p><a href="/book">Book a ride</a></p><nav>${links}</nav></main></div>`
  return replaceOnce(html, /<div id="app"><\/div>/, fallback, '#app')
}

for (const page of SEO_PAGES) {
  const file = page.path === '/' ? join(DIST, 'index.html') : join(DIST, page.path.slice(1), 'index.html')
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, pageHtml(page))
}
writeFileSync(join(DIST, 'app.html'), shell)
console.log(`seo-pages: wrote ${SEO_PAGES.length} page files + app.html`)
