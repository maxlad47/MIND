import { chromium } from 'playwright-core'
const base = process.env.BASE ?? 'http://localhost:5180'
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark', isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
const shot = async (name) => { await page.waitForTimeout(700); await page.screenshot({ path: `/tmp/shots/${name}.png` }) }
await page.goto(base); await shot('01-login')
await page.getByText('Camille').first().click(); await page.waitForTimeout(800); await shot('02-today')
await page.evaluate(() => window.scrollTo(0, 700)); await shot('03-today-scroll')
await page.goto(base + '/app/program'); await shot('04-program')
await page.goto(base + '/app/progress'); await shot('05-progress')
await page.evaluate(() => window.scrollTo(0, 900)); await shot('06-progress2')
await page.goto(base + '/app/profile'); await shot('07-profile')
console.log('ERRORS:', JSON.stringify(errors, null, 1))
await browser.close()
