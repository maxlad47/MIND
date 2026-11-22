// Contrôle automatique : pas de scroll horizontal, zones tactiles >= 44 px (hors éléments décoratifs)
import { chromium } from 'playwright-core'
const base = process.env.BASE ?? 'http://localhost:5180'
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark', isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('mind.db.v2')))
const check = async (name) => {
  await page.waitForTimeout(900)
  const r = await page.evaluate(() => {
    const hs = document.documentElement.scrollWidth > window.innerWidth + 1
    const small = []
    for (const el of document.querySelectorAll('button, a, [role=button], [role=switch], input, select, textarea')) {
      const b = el.getBoundingClientRect()
      if (!b.width || !b.height) continue
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none') continue
      // la zone tactile inclut le pseudo-élément .hit (+4px de chaque côté)
      const after = getComputedStyle(el, '::after')
      const aw = el.classList.contains('hit') ? parseFloat(after.width) || 0 : 0
      const ah = el.classList.contains('hit') ? parseFloat(after.height) || 0 : 0
      if (Math.max(b.width, aw) < 43.5 || Math.max(b.height, ah) < 43.5) small.push(`${el.tagName.toLowerCase()}[${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24)}] ${Math.round(Math.max(b.width, aw))}x${Math.round(Math.max(b.height, ah))}`)
    }
    return { hs, small }
  })
  console.log(`${r.hs ? 'FAIL scroll-x' : 'OK  '} ${name}${r.small.length ? '  petits: ' + r.small.join(' | ') : ''}`)
}
await page.goto(base); await page.waitForTimeout(1500)
await page.getByText('Camille').first().click()
for (const r of ['today', 'program', 'progress', 'profile']) { await page.goto(base + '/app/' + r); await check('/app/' + r) }
const d = await db()
const cam = d.profiles.find((p) => p.firstName === 'Camille')
const prog = d.programs.find((p) => p.clientId === cam.id)
const s = prog.weeks.flatMap((w) => w.sessions)
await page.goto(base + '/session/' + s.find((x) => x.sport === 'muscu' && x.status === 'prevue').id); await check('session muscu')
await page.goto(base + '/session/' + s.find((x) => x.sport === 'course' && x.status === 'prevue').id); await check('session course')
await page.evaluate(() => { const x = JSON.parse(localStorage.getItem('mind.db.v2')); x.sessionUserId = null; localStorage.setItem('mind.db.v2', JSON.stringify(x)) })
await page.goto(base); await check('auth')
await page.getByText('Max').first().click()
for (const r of ['/coach', '/coach/alerts', '/coach/me', '/coach/profile']) { await page.goto(base + r); await check(r) }
const hugo = (await db()).profiles.find((p) => p.firstName === 'Hugo')
await page.goto(base + '/coach/client/' + hugo.id); await check('fiche client')
await browser.close()
