// Captures : splash in-app, feuilles modales, glisser-déposer, états vides
import { chromium } from 'playwright-core'
const base = process.env.BASE ?? 'http://localhost:5180'
const scheme = process.argv[2] ?? 'dark'
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const out = `/tmp/shots/d/${scheme}-s3`
const shot = async (n, w = 600) => { await page.waitForTimeout(w); await page.screenshot({ path: `${out}-${n}.png` }) }
await page.goto(base); await page.waitForTimeout(350); await shot('splash', 100)
await page.waitForTimeout(1500)
await page.getByText('Camille').first().click(); await page.waitForTimeout(900)
// check-in sheet
await page.getByRole('button', { name: /Commencer/ }).first().click().catch(() => {})
await shot('after-start')
// feuille notifications
await page.goto(base + '/app/today'); await page.waitForTimeout(700)
await page.getByLabel('Notifications').click(); await shot('notif')
await page.keyboard.press('Escape'); await page.waitForTimeout(500)
// programme : appui sur le menu Déplacer
await page.goto(base + '/app/program'); await page.waitForTimeout(700)
await page.getByRole('button', { name: 'Semaine 6', exact: true }).click(); await page.waitForTimeout(500)
await page.getByLabel('Déplacer').first().scrollIntoViewIfNeeded()
await page.getByLabel('Déplacer').first().click(); await shot('move-menu')
await page.keyboard.press('Escape'); await page.waitForTimeout(500)
// drag souris
const g = page.getByLabel('Déplacer').nth(1); const b = await g.boundingBox()
await page.mouse.move(b.x + 20, b.y + 20); await page.mouse.down(); await page.mouse.move(b.x + 20, b.y + 160, { steps: 8 }); await shot('drag', 300)
await page.mouse.up(); await page.waitForTimeout(500)
// nouveau compte sans programme (état vide)
await page.evaluate(() => { const x = JSON.parse(localStorage.getItem('mind.db.v2')); x.sessionUserId = null; localStorage.setItem('mind.db.v2', JSON.stringify(x)) })
await page.goto(base); await page.waitForTimeout(500)
await page.getByText('Créer un compte').click()
await page.getByPlaceholder('Prénom').fill('Zoé'); await page.getByPlaceholder('Email').fill('zoe' + Date.now() + '@t.fr'); await page.getByPlaceholder('Mot de passe').fill('secret12')
await page.getByRole('button', { name: 'Créer mon compte' }).click(); await page.waitForTimeout(500)
await page.getByRole('button', { name: 'Passer' }).click().catch(() => {})
await page.goto(base + '/app/today'); await shot('empty-today')
await browser.close()
