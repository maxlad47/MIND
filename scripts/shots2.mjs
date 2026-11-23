// Captures de contrôle du design : node scripts/shots2.mjs [dark|light] [prefixe]
import { chromium } from 'playwright-core'
import fs from 'node:fs'
const base = process.env.BASE ?? 'http://localhost:5180'
const scheme = process.argv[2] ?? 'dark'
const pre = process.argv[3] ?? scheme
const out = '/tmp/shots/d'
fs.mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const errors = []
page.on('console', (m) => { if (m.type() === 'error' && !/503/.test(m.text())) errors.push('console: ' + m.text()) })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
const shot = async (name, wait = 900) => { await page.waitForTimeout(wait); await page.screenshot({ path: `${out}/${pre}-${name}.png` }) }
const scroll = async (y) => { await page.evaluate((y) => window.scrollTo(0, y), y); await page.waitForTimeout(350) }
const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('mind.db.v2')))
const only = process.argv[4]?.split(',')
const want = (k) => !only || only.includes(k)

await page.goto(base); await page.waitForTimeout(1600)
if (want('login')) await shot('01-login', 200)
await page.getByText('Camille').first().click(); await page.waitForTimeout(900)
if (want('today')) { await shot('02-today'); await scroll(520); await shot('03-today2', 200); await scroll(1100); await shot('04-today3', 200); await scroll(0) }
if (want('program')) { await page.goto(base + '/#/app/program'); await shot('05-program'); await scroll(450); await shot('06-program2', 200) }
if (want('progress')) { await page.goto(base + '/#/app/progress'); await shot('07-progress'); await scroll(600); await shot('08-progress2', 200); await scroll(1300); await shot('09-progress3', 200); await scroll(2100); await shot('10-progress4', 200); await scroll(2900); await shot('11-progress5', 200) }
if (want('profile')) { await page.goto(base + '/#/app/profile'); await shot('12-profile'); await scroll(500); await shot('13-profile2', 200) }
const d = await db()
const cam = d.profiles.find((p) => p.firstName === 'Camille')
const prog = d.programs.find((p) => p.clientId === cam.id)
const sessions = prog.weeks.flatMap((w) => w.sessions)
const iso = new Date().toISOString().slice(0, 10)
const muscu = sessions.find((s) => s.sport === 'muscu' && s.status === 'prevue' && s.date >= iso)
const run = sessions.find((s) => s.sport === 'course' && s.status === 'prevue' && s.date >= iso)
if (want('session')) {
  await page.goto(base + '/#/session/' + muscu.id); await shot('14-session')
  await scroll(500); await shot('15-session2', 200)
  await page.getByLabel('Valider la série').first().click(); await page.waitForTimeout(300); await scroll(0); await shot('16-session3', 200)
  await page.goto(base + '/#/session/' + run.id); await shot('17-run'); await scroll(400); await shot('18-run2', 200)
  await page.getByRole('button', { name: 'Saisie rapide' }).click(); await shot('19-run-sheet', 700)
}
if (want('coach')) {
  await page.evaluate(() => { const x = JSON.parse(localStorage.getItem('mind.db.v2')); x.sessionUserId = null; localStorage.setItem('mind.db.v2', JSON.stringify(x)) })
  await page.goto(base); await page.waitForTimeout(500); await page.getByText('Max').first().click(); await shot('20-coach')
  await page.goto(base + '/#/coach/alerts'); await shot('21-alerts')
  const hugo = (await db()).profiles.find((p) => p.firstName === 'Hugo')
  await page.goto(base + '/#/coach/client/' + hugo.id); await shot('22-client'); await scroll(500); await shot('23-client2', 200)
  await page.goto(base + '/#/coach/me'); await shot('25-coach-me')
  await page.goto(base + '/#/coach/profile'); await shot('24-coach-profile')
}
if (want('onb')) {
  await page.evaluate(() => { const x = JSON.parse(localStorage.getItem('mind.db.v2')); x.sessionUserId = null; localStorage.setItem('mind.db.v2', JSON.stringify(x)) })
  await page.goto(base); await page.waitForTimeout(500); await page.getByText('Créer un compte').click()
  await page.getByPlaceholder('Prénom').fill('Nina'); await page.getByPlaceholder('Email').fill('nina' + Date.now() + '@test.fr'); await page.getByPlaceholder('Mot de passe').fill('secret12')
  await page.getByRole('button', { name: 'Créer mon compte' }).click(); await shot('30-onb-name')
  let i = 0
  while (i++ < 30) {
    if (await page.getByRole('button', { name: 'Générer mon programme' }).count()) break
    const title = await page.locator('h1').first().innerText()
    if (/naissance/.test(title)) await page.locator('input[type=date]').fill('1990-05-10')
    if (/Quel programme/.test(title)) await page.getByText('Musculation + course', { exact: true }).click()
    if (/date de ta course/.test(title)) await page.locator('input[type=date]').fill(new Date(Date.now() + 98 * 86400000).toISOString().slice(0, 10))
    if (/Quelle distance/.test(title)) await page.getByText('Semi-marathon').click()
    if (i < 12 || /type|programme|jours|distance/.test(title)) await shot('3' + String(i).padStart(2, '0') + '-onb', 500)
    await page.getByRole('button', { name: 'Continuer' }).click(); await page.waitForTimeout(350)
  }
  await shot('39-onb-last', 400)
}
console.log('ERRORS:', JSON.stringify(errors, null, 1))
await browser.close()
