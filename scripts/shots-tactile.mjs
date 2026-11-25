// Captures de l'essai « tactile » : lignes de série, minuteur de repos, stepper (fiche d'exercice). node scripts/shots-tactile.mjs [dark|light]
import { chromium } from 'playwright-core'
const base = process.env.BASE ?? 'http://localhost:5180'
const OUT = process.env.SHOTS ?? '/tmp/shots'
const scheme = process.argv[2] ?? 'dark'
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
await page.addInitScript(() => { try { sessionStorage.setItem('mind.splash', '1') } catch {} })
await page.goto(base); await page.waitForTimeout(800)
await page.getByText('Camille').first().click(); await page.waitForTimeout(900)
const d = await page.evaluate(() => JSON.parse(localStorage.getItem('mind.db.v2')))
const me = d.profiles.find((p) => p.firstName === 'Camille')
const prog = d.programs.find((p) => p.clientId === me.id && p.status === 'actif')
const s = prog.weeks.flatMap((w) => w.sessions).filter((x) => x.sport === 'muscu' && x.status === 'prevue' && x.kind !== 'renfo' && x.exercises.some((e) => !e.plan?.length)).sort((a, b) => a.date.localeCompare(b.date))[0]
await page.goto(base + '/#/session/' + s.id); await page.waitForTimeout(1000)
const valider = page.getByLabel('Valider la série').first()
await valider.scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, -120)); await page.waitForTimeout(300)
await page.screenshot({ path: `${OUT}/${scheme}-1-series.png` })
await valider.click(); await page.waitForTimeout(1600)
await page.screenshot({ path: `${OUT}/${scheme}-2-validee-repos.png` })
await page.getByLabel('Ajouter 15 secondes').click(); await page.waitForTimeout(150)
await page.screenshot({ path: `${OUT}/${scheme}-3-roll.png` })
console.log('timer:', JSON.stringify(await page.getByRole('timer').innerText()))
await page.getByRole('button', { name: 'Passer' }).click(); await page.waitForTimeout(500)
// fiche de réglage de l'exercice (stepper)
const edit = page.getByRole('button', { name: /Modifier|Réglages|Options/ }).first()
if (await edit.count()) { await edit.click(); await page.waitForTimeout(700); await page.screenshot({ path: `${OUT}/${scheme}-4-stepper.png` }) }
else console.log('pas de bouton de réglage trouvé')
console.log('erreurs:', errors.length ? errors : 'aucune')
await browser.close()
