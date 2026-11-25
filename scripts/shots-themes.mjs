// Captures des thèmes 1 et 2 : node scripts/shots-themes.mjs [dark|light]
import { chromium } from 'playwright-core'
const base = process.env.BASE ?? 'http://localhost:5180'
const OUT = process.env.SHOTS ?? '/tmp/shots/themes'
const scheme = process.argv[2] ?? 'dark'
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const errors = []
for (const look of ['t1', 't2']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript((l) => { try { localStorage.setItem('mind.look', l); sessionStorage.setItem('mind.splash', '1') } catch {} }, look)
  const out = (n) => `${OUT}/${scheme}-${look}-${n}.png`
  await page.goto(base); await page.waitForTimeout(500); await page.screenshot({ path: out('0-login') })
  await page.getByText('Camille').first().click(); await page.waitForTimeout(900); await page.screenshot({ path: out('1-today') })
  await page.goto(base + '/#/app/program'); await page.waitForTimeout(700); await page.screenshot({ path: out('2-program') })
  await page.goto(base + '/#/app/progress'); await page.waitForTimeout(900); await page.screenshot({ path: out('3-progress') })
  const course = page.getByRole('tab', { name: /Course/ }).or(page.getByRole('button', { name: 'Course', exact: true })).first()
  if (await course.count()) { await course.click(); await page.waitForTimeout(800); await page.screenshot({ path: out('4-progress-course') }) }
  await page.goto(base + '/#/app/profile'); await page.waitForTimeout(700)
  await page.getByRole('radiogroup', { name: "Thème de l'interface" }).scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, 200)); await page.waitForTimeout(300)
  await page.screenshot({ path: out('5-profile') })
  await ctx.close()
}
console.log('erreurs:', errors.length ? errors : 'aucune')
await browser.close()
