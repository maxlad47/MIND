import { chromium } from 'playwright-core'
const base = process.env.BASE ?? 'http://localhost:5180'
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark', isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
const shot = async (name) => { await page.waitForTimeout(600); await page.screenshot({ path: `/tmp/shots/${name}.png` }) }
const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('mind.db.v2')))
const ok = (c, m) => console.log((c ? 'OK   ' : 'FAIL ') + m)

await page.goto(base)
await page.getByText('Camille').first().click(); await page.waitForTimeout(600)

// --- séance de muscu : trouver une séance prévue dans le futur proche (Camille)
let d = await db()
const cam = d.profiles.find((p) => p.firstName === 'Camille')
const prog = d.programs.find((p) => p.clientId === cam.id)
const sessions = prog.weeks.flatMap((w) => w.sessions)
const today = new Date(); const iso = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
const muscu = sessions.find((s) => s.sport === 'muscu' && s.status === 'prevue' && s.date >= iso)
await page.goto(base + '/#/session/' + muscu.id); await shot('10-session-muscu')
// valider 3 séries du premier exercice
const checks = page.getByLabel('Valider la série')
const n = await checks.count(); ok(n > 5, `boutons de série présents (${n})`)
await checks.first().click(); await page.waitForTimeout(200)
await page.getByLabel('Valider la série').first().click(); await page.waitForTimeout(200)
d = await db()
const s2 = d.programs.find((p) => p.id === prog.id).weeks.flatMap((w) => w.sessions).find((s) => s.id === muscu.id)
ok(s2.exercises[0].logs.length === 2, 'deux séries enregistrées dans le store')
await shot('11-session-sets')
// remplacer un exercice
await page.getByLabel('Remplacer').last().click(); await shot('12-replace')
const alts = page.locator('button:has-text("Même muscle"), .bg-surface2.rounded-xl.p-3')
const altCount = await alts.count(); ok(altCount > 0, `alternatives proposées (${altCount})`)
if (altCount) { await alts.first().click(); await page.waitForTimeout(400) }
d = await db()
const s3 = d.programs.find((p) => p.id === prog.id).weeks.flatMap((w) => w.sessions).find((s) => s.id === muscu.id)
ok(s3.exercises.at(-1).exerciseId !== s2.exercises.at(-1).exerciseId, 'exercice remplacé')
ok(d.edits.length > 0, 'historique des modifications alimenté')
// terminer
await page.getByText(/Terminer la séance/).click(); await shot('13-finish')
await page.getByRole('button', { name: 'Terminer', exact: true }).click(); await page.waitForTimeout(500); await shot('14-recap')
d = await db()
const s4 = d.programs.find((p) => p.id === prog.id).weeks.flatMap((w) => w.sessions).find((s) => s.id === muscu.id)
ok(s4.status === 'faite', 'séance marquée faite')

// --- course : saisie
await page.goto(base + '/#/app/today'); await page.waitForTimeout(500)
const run = sessions.find((s) => s.sport === 'course' && s.status === 'prevue' && s.date >= iso)
await page.goto(base + '/#/session/' + run.id); await shot('15-run')
await page.getByRole('button', { name: 'Saisie rapide' }).click(); await page.waitForTimeout(400)
await page.getByLabel('Minutes').fill('35'); await shot('16-run-log')
await page.getByRole('button', { name: 'Continuer' }).click(); await page.waitForTimeout(500)
d = await db()
const r2 = d.programs.find((p) => p.id === prog.id).weeks.flatMap((w) => w.sessions).find((s) => s.id === run.id)
ok(r2.status === 'faite' && r2.runLog?.seconds === 2100, 'sortie de course enregistrée')

// --- glisser-déposer
await page.goto(base + '/#/app/program'); await page.waitForTimeout(500)
const grips = page.getByLabel('Déplacer')
const gc = await grips.count(); ok(gc > 0, `poignées de déplacement (${gc})`)
if (gc) {
  const box = await grips.first().boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 120, { steps: 10 }); await shot('17-dnd')
  await page.mouse.up(); await page.waitForTimeout(500); await shot('18-dnd-after')
}

// --- coach
await page.evaluate(() => { const x = JSON.parse(localStorage.getItem('mind.db.v2')); x.sessionUserId = null; localStorage.setItem('mind.db.v2', JSON.stringify(x)) })
await page.goto(base); await page.getByText('Max').first().click(); await page.waitForTimeout(700); await shot('20-coach-clients')
await page.goto(base + '/#/coach/alerts'); await shot('21-coach-alerts')
const hugo = (await db()).profiles.find((p) => p.firstName === 'Hugo')
await page.goto(base + '/#/coach/client/' + hugo.id); await shot('22-client-detail')
await page.getByText('Profil', { exact: true }).last().click(); await shot('23-client-profil')
await page.goto(base + '/#/coach/me'); await shot('24-coach-me')

// --- onboarding d'un nouveau compte
await page.evaluate(() => { const x = JSON.parse(localStorage.getItem('mind.db.v2')); x.sessionUserId = null; localStorage.setItem('mind.db.v2', JSON.stringify(x)) })
await page.goto(base); await page.getByText('Créer un compte').click()
await page.getByPlaceholder('Prénom').fill('Nina'); await page.getByPlaceholder('Email').fill('nina@test.fr'); await page.getByPlaceholder('Mot de passe').fill('secret12')
await page.getByRole('button', { name: 'Créer mon compte' }).click(); await page.waitForTimeout(700); await shot('30-onb-name')
let guard = 0
while (guard++ < 30) {
  const gen = page.getByRole('button', { name: 'Générer mon programme' })
  if (await gen.count()) break
  const title = await page.locator('h1').first().innerText()
  if (/naissance/.test(title)) await page.locator('input[type=date]').fill('1990-05-10')
  if (/type|programme veux/.test(title)) { await page.getByText('Musculation + course').click() }
  if (/date de ta course/.test(title)) { const dd = new Date(Date.now() + 98 * 86400000).toISOString().slice(0, 10); await page.locator('input[type=date]').fill(dd) }
  if (guard < 25 && /Quelle distance/.test(title)) await page.getByText('Semi-marathon').click()
  await shot('3' + String(guard).padStart(2, '0') + '-onb')
  await page.getByRole('button', { name: 'Continuer' }).click(); await page.waitForTimeout(350)
}
await page.getByRole('button', { name: 'Générer mon programme' }).click(); await page.waitForTimeout(1200); await shot('40-after-onboarding')
d = await db(); const nina = d.profiles.find((p) => p.firstName === 'Nina')
ok(!!d.programs.find((p) => p.clientId === nina.id), 'programme généré pour le nouveau compte')
console.log('ERRORS:', JSON.stringify(errors, null, 1))
await browser.close()
