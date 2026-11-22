import { chromium } from 'playwright-core'
const base = 'http://localhost:5180'
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'light', isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const cdp = await ctx.newCDPSession(page)
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error' && !/503/.test(m.text())) errors.push(m.text()) })
const ok = (c, m) => console.log((c ? 'OK   ' : 'FAIL ') + m)
const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('mind.db.v2')))
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] })
const sess = async (id) => { const d = await db(); return d.programs.flatMap((p) => p.weeks.flatMap((w) => w.sessions)).find((s) => s.id === id) }

await page.goto(base); await page.getByText('Camille').first().click(); await page.waitForTimeout(600)
await page.goto(base + '/app/program'); await page.waitForTimeout(500)
await page.getByRole('button', { name: 'Semaine 6', exact: true }).click(); await page.waitForTimeout(500)

// 1) appui long + glisser au doigt : on prend la dernière carte déplaçable de la semaine et on la lâche sur le 2e jour affiché
const cards = page.locator('[data-session]')
const n = await cards.count(); ok(n > 3, `${n} séances dans la semaine`)
const target = cards.nth(n - 3)
const id = await target.getAttribute('data-session')
const before = await sess(id)
await target.scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollTo(0, 250)); await page.waitForTimeout(300)
const box = await target.boundingBox()
const dest = page.locator('text=/^mardi$/i').first()
const dbox = await dest.boundingBox()
await touch('touchStart', box.x + 120, box.y + box.height / 2)
await page.waitForTimeout(450)                       // appui long
const steps = 14
for (let i = 1; i <= steps; i++) { await touch('touchMove', box.x + 120, box.y + box.height / 2 + ((dbox.y + 40 - box.y - box.height / 2) * i) / steps); await page.waitForTimeout(25) }
await page.screenshot({ path: '/tmp/shots/70-touch-drag.png' })
await touch('touchEnd')
await page.waitForTimeout(700)
const after = await sess(id)
const toast = await page.getByText(/Séance déplacée|Double séance/).count()
const conflict = await page.getByText('Ce déplacement crée un conflit').count()
ok(after.date !== before.date || conflict > 0, `glisser au doigt : ${before.date} → ${after.date}${conflict ? ' (feuille de conflit affichée)' : ''}`)
await page.screenshot({ path: '/tmp/shots/71-touch-dropped.png' })

// 2) menu « Déplacer vers » en un tap
if (conflict) await page.getByRole('button', { name: 'Annuler' }).click().catch(() => {})
await page.waitForTimeout(300)
const grip = page.getByLabel('Déplacer').first()
await grip.scrollIntoViewIfNeeded(); await grip.click(); await page.waitForTimeout(500)
await page.screenshot({ path: '/tmp/shots/72-menu.png' })
const rows = page.locator('button:has-text("Libre"), button:has-text("(double)")')
ok((await rows.count()) > 0, `menu « Déplacer vers » : ${await rows.count()} jours proposés`)
const dbl = page.locator('button:has-text("(double)")').first()
if (await dbl.count()) {
  await dbl.click(); await page.waitForTimeout(600)
  const d = await db()
  const week = d.programs.flatMap((p) => p.weeks).find((w) => w.sessions.some((s) => s.id === id))
  const byDay = {}
  week.sessions.filter((s) => s.status !== 'sautee').forEach((s) => (byDay[s.date] ||= []).push(s))
  const doubles = Object.values(byDay).filter((l) => l.length >= 2)
  ok(doubles.length > 0 && doubles.every((l) => l.every((s) => s.slot)), `double séance avec créneaux matin/soir : ${doubles.map((l) => l.map((s) => `${s.title}:${s.slot}`).join(' + ')).join(' | ')}`)
}
console.log('ERRORS:', JSON.stringify(errors))
await browser.close()
