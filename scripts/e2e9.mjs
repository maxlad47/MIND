// E2E suppression d'un profil par le coach : bouton dans l'onglet Profil, confirmation, retour à la liste, données effacées.
// Lancer : BASE=http://localhost:5180 node scripts/e2e9.mjs
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
const base = process.env.BASE ?? 'http://localhost:5180'
const SHOTS = process.env.SHOTS ?? '/tmp/shots'
mkdirSync(SHOTS, { recursive: true })
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark', isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
const shot = async (name) => { await page.waitForTimeout(500); await page.screenshot({ path: `${SHOTS}/${name}.png` }) }
const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('mind.db.v2')))
let failed = 0
const ok = (c, m) => { if (!c) failed++; console.log((c ? 'OK   ' : 'FAIL ') + m) }
await page.goto(base); await page.waitForTimeout(600)
await page.getByPlaceholder('Email').fill('coach@mind.app'); await page.getByPlaceholder('Mot de passe').fill('mind1234')
await page.getByRole('button', { name: 'Se connecter' }).click(); await page.waitForTimeout(900)
await page.goto(base + '/#/coach'); await page.waitForTimeout(600)
let d = await db()
const cam = d.profiles.find((p) => p.firstName === 'Camille')
const before = d.profiles.length
await page.getByText('Camille').first().click(); await page.waitForTimeout(700)
await page.getByText('Profil', { exact: true }).first().click(); await page.waitForTimeout(500)
const btn = page.getByRole('button', { name: /Supprimer le profil/ })
await btn.scrollIntoViewIfNeeded(); await shot('90-bouton-supprimer')
ok(await btn.isVisible(), 'bouton « Supprimer le profil » dans l’onglet Profil')
await btn.click(); await page.waitForTimeout(500); await shot('91-confirmation')
ok(await page.getByText('Supprimer Camille ?').isVisible(), 'feuille de confirmation')
await page.getByRole('button', { name: 'Annuler' }).click(); await page.waitForTimeout(400)
ok((await db()).profiles.length === before, 'Annuler ne supprime rien')
await btn.click(); await page.waitForTimeout(500)
await page.getByRole('button', { name: 'Supprimer définitivement' }).click(); await page.waitForTimeout(900); await shot('92-liste-apres')
d = await db()
ok(page.url().endsWith('#/coach'), 'retour à la liste des clients')
ok(!d.profiles.some((p) => p.id === cam.id) && !d.programs.some((p) => p.clientId === cam.id), 'profil et programme de Camille effacés')
ok(d.profiles.length === before - 1, 'les autres profils sont intacts')
ok(!(await page.getByText('Camille', { exact: true }).count()), 'Camille n’apparaît plus dans la liste')
console.log(failed ? `\n${failed} ÉCHEC(S)` : '\nTout est OK')
console.log('ERRORS:', JSON.stringify(errors, null, 1))
await browser.close()
process.exit(failed ? 1 : 0)
