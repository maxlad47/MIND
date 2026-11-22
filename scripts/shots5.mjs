// Palettes féminin / masculin : Aujourd'hui, Programme, pochettes par type de séance
import { chromium } from 'playwright-core'
const base = process.env.BASE ?? 'http://localhost:5180'
const scheme = process.argv[2] ?? 'dark'
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
for (const look of ['feminin', 'masculin']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  await page.addInitScript((l) => { try { localStorage.setItem('mind.look', l); sessionStorage.setItem('mind.splash', '1') } catch {} }, look)
  const out = (n) => `/tmp/shots/d/${scheme}-p-${look}-${n}.png`
  await page.goto(base); await page.waitForTimeout(500); await page.screenshot({ path: out('login') })
  await page.getByText('Camille').first().click(); await page.waitForTimeout(900); await page.screenshot({ path: out('today') })
  await page.evaluate(() => window.scrollTo(0, 640)); await page.waitForTimeout(400); await page.screenshot({ path: out('today2') })
  await page.goto(base + '/app/program'); await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'Semaine 6', exact: true }).click(); await page.waitForTimeout(600)
  await page.evaluate(() => window.scrollTo(0, 330)); await page.waitForTimeout(400); await page.screenshot({ path: out('program') })
  await page.evaluate(() => window.scrollTo(0, 900)); await page.waitForTimeout(400); await page.screenshot({ path: out('program2') })
  await ctx.close()
}
await browser.close()
