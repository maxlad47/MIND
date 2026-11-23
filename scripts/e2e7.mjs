// E2E Garmin / courses importées : « Fait comme prévu → bilan », bilan avec douleur, sorties de la démo de Léa (À compléter, allure par km, FC),
// import d'un .zip « Exporter l'original » (sans doublon), vue coach.  Lancer : BASE=http://localhost:5180 node scripts/e2e7.mjs
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const base = process.env.BASE ?? 'http://localhost:5180'
const SHOTS = process.env.SHOTS ?? '/tmp/shots'
mkdirSync(SHOTS, { recursive: true })
const ZIP = fileURLToPath(new URL('./fixtures/sortie-5km.zip', import.meta.url))
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
const sessionsOf = (p) => p.weeks.flatMap((w) => w.sessions)
const iso = (() => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}` })()
const go = async (path) => { await page.goto(base + '/#' + path); await page.waitForTimeout(350) }
const login = async (email) => {
  await page.evaluate(() => { const x = JSON.parse(localStorage.getItem('mind.db.v2') ?? 'null'); if (x) { x.sessionUserId = null; localStorage.setItem('mind.db.v2', JSON.stringify(x)) } })
  await page.goto(base); await page.waitForTimeout(600)
  await page.getByPlaceholder('Email').fill(email); await page.getByPlaceholder('Mot de passe').fill('mind1234')
  await page.getByRole('button', { name: 'Se connecter' }).click(); await page.waitForTimeout(900)
}

// ------------------------------------------------------------ Camille : « Fait comme prévu » → bilan avec douleur
await page.goto(base); await page.waitForTimeout(500)
await page.getByText('Camille').first().click(); await page.waitForTimeout(700)
let d = await db()
const cam = d.profiles.find((p) => p.firstName === 'Camille')
const prog = d.programs.find((p) => p.clientId === cam.id && p.status === 'actif')
const run = sessionsOf(prog).find((s) => s.sport === 'course' && s.kind === 'ef' && s.status === 'prevue' && s.date >= iso)
await go('/session/' + run.id); await shot('70-course-prevue')
ok(await page.getByRole('button', { name: 'Fait comme prévu' }).isVisible(), 'trois entrées : « Fait comme prévu » (bouton principal)')
ok(await page.getByRole('button', { name: 'Saisie rapide' }).isVisible() && (await page.getByRole('button', { name: /Importer depuis ma montre/ }).isVisible()), '« Saisie rapide » et « Importer depuis ma montre (.FIT) » présents')
await page.getByRole('button', { name: 'Fait comme prévu' }).click(); await page.waitForTimeout(600); await shot('71-bilan')
ok(await page.getByText('Séance respectée ?').isVisible(), 'le bilan s\'ouvre directement')
await page.getByRole('radio', { name: 'En partie' }).click()
await page.getByRole('button', { name: 'Fatigue / mauvais sommeil' }).click()
await page.getByRole('button', { name: 'Douleur ou gêne' }).click()
await page.getByRole('button', { name: 'Genou' }).click()
await page.getByRole('radio', { name: /^7/ }).click(); await shot('72-bilan-rempli')
const sizes = await page.getByRole('radio', { name: /^\d+/ }).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))
ok(sizes.length === 10 && sizes.every((h) => h >= 44), `touches RPE ≥ 44 px (${Math.min(...sizes)} px)`)
await page.getByRole('button', { name: 'Enregistrer le bilan' }).click(); await page.waitForTimeout(600)
d = await db()
const s = sessionsOf(d.programs.find((p) => p.id === prog.id)).find((x) => x.id === run.id)
ok(s.status === 'faite' && s.runLog.respected === 'partiel' && s.runLog.rpe === 7 && s.runLog.reasons.includes('douleur') && s.runLog.painZone === 'genou', 'bilan enregistré (respect, raisons, zone, RPE)')
const mine = d.importedRuns.filter((r) => r.clientId === cam.id)
ok(mine.length === 1 && mine[0].source === 'manuel' && mine[0].status === 'rattachee', 'une activité « manuel » rattachée')
ok(d.checkins.some((c) => c.pain && c.painZone === 'genou'), 'douleur : alerte côté coach')
ok(await page.getByText('Bilan de la séance').isVisible(), 'carte « Bilan de la séance » après enregistrement')
await shot('73-bilan-fait')

// ------------------------------------------------------------ Léa : À compléter, allure par km, FC par zones
await login('lea@demo.mind')
await go('/app/today'); await page.waitForTimeout(500); await shot('74-today-lea')
ok(await page.getByText(/À compléter : ta sortie de/).first().isVisible(), 'Aujourd\'hui : carte « À compléter : ta sortie de … km »')
ok(await page.getByText(/pas · nuit/).isVisible(), 'Aujourd\'hui : « … pas · nuit … »')
await page.getByText(/À compléter : ta sortie de/).first().click(); await page.waitForTimeout(900); await shot('75-bilan-lea')
ok(await page.getByText(/D'après ta montre/).isVisible(), 'pré-réponse « D\'après ta montre »')
ok(await page.getByText(/tours? sur \d+ trop lents?/).count() > 0, 'pré-réponse : tours trop lents')
await page.getByRole('button', { name: 'Utiliser cette réponse' }).click()
await page.getByRole('button', { name: 'Trop difficile' }).click()
await page.getByRole('radio', { name: /^8/ }).click()
await page.getByRole('button', { name: 'Enregistrer le bilan' }).click(); await page.waitForTimeout(600)
await page.evaluate(() => window.scrollTo(0, 400)); await shot('76-rapport-fractionne')
ok(await page.getByText('Tours de travail').isVisible(), 'séance fractionnée : tours de travail')
d = await db()
ok(!sessionsOf(d.programs.find((p) => p.clientId === d.profiles.find((x) => x.firstName === 'Léa').id && p.status === 'actif')).some((x) => x.runLog?.importedRunId && x.runLog.respected === undefined), 'plus aucune sortie à compléter')
// EF : allure par km, FC, zones, alerte
const lea = d.profiles.find((p) => p.firstName === 'Léa')
const lp = d.programs.find((p) => p.clientId === lea.id && p.status === 'actif')
const ef = sessionsOf(lp).find((x) => x.runLog?.importedRunId === 'ir-garmin-seed-ef')
await go('/session/' + ef.id); await page.waitForTimeout(900)
ok(await page.getByText('Allure par km').isVisible(), 'EF : graphique d\'allure par km')
ok(await page.getByText('Fréquence cardiaque').isVisible(), 'EF : courbe de FC')
ok(await page.getByText(/Endurance trop intense/).first().isVisible(), 'EF : alerte « Endurance trop intense »')
await page.getByText('Fréquence cardiaque').scrollIntoViewIfNeeded(); await shot('77-ef-fc')
const lg = sessionsOf(lp).find((x) => x.runLog?.importedRunId === 'ir-garmin-seed-longue')
await go('/session/' + lg.id); await page.waitForTimeout(900)
ok(await page.getByText(/Départ trop rapide/).isVisible(), 'sortie longue : « Départ trop rapide »')
await page.getByText('Allure par km').scrollIntoViewIfNeeded(); await shot('78-longue-allure')
// sortie en plus
const extra = sessionsOf(lp).find((x) => x.extra && x.runLog?.importedRunId === 'ir-garmin-seed-en-plus')
ok(!!extra, 'sortie en plus rattachée')

// ------------------------------------------------------------ import d'un .zip (sans doublon)
await go('/app/today'); await page.waitForTimeout(500)
await page.getByRole('button', { name: /Importer une sortie/ }).click(); await page.waitForTimeout(500); await shot('79-import-aide')
ok(await page.getByText('Exporter l\'original').count() > 0, 'import .FIT : aide pas à pas pour iPhone')
await page.getByLabel('Fichier d\'activité').setInputFiles(ZIP); await page.waitForTimeout(1500)
d = await db()
const imp = d.importedRuns.find((r) => r.externalId === 'garmin:12345678901')
ok(!!imp && imp.source === 'fit' && imp.km === 5 && imp.splits.length === 5 && imp.status === 'rattachee', 'zip lu : 5 km, 5 tours, rattaché')
ok(page.url().includes('/session/'), 'on arrive sur la séance rattachée')
await shot('80-apres-import')
await go('/app/today'); await page.waitForTimeout(400)
await page.getByRole('button', { name: /Importer une sortie/ }).click(); await page.waitForTimeout(400)
await page.getByLabel('Fichier d\'activité').setInputFiles(ZIP); await page.waitForTimeout(1200)
d = await db()
ok(d.importedRuns.filter((r) => r.externalId === 'garmin:12345678901').length === 1, 'même fichier importé deux fois : un seul enregistrement')
await page.getByLabel('Fichier d\'activité').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('pas un fit, vraiment pas un fit du tout') }).catch(() => {})

// ------------------------------------------------------------ coach : bilans, effort perçu, FC max
await login('coach@mind.app')
await go('/coach'); await page.waitForTimeout(500)
await page.getByText('Léa').first().click(); await page.waitForTimeout(700)
await page.getByText('Séances', { exact: true }).first().click(); await page.waitForTimeout(900); await shot('81-coach-seances')
ok(await page.getByText('Effort perçu').first().isVisible(), 'coach : courbe d\'effort perçu')
ok(await page.getByText(/Pas et sommeil/).isVisible(), 'coach : pas et sommeil sur 7 jours')
ok(await page.getByText(/En partie|Respectée/).first().isVisible(), 'coach : respect, raisons et RPE sur les séances')
await page.getByText('Profil', { exact: true }).first().click(); await page.waitForTimeout(500); await shot('82-coach-profil')
ok(await page.getByText('Montre Garmin').isVisible(), 'coach : FC max dans la fiche client')

console.log(failed ? `\n${failed} ÉCHEC(S)` : '\nTout est OK')
console.log('ERRORS:', JSON.stringify(errors, null, 1))
await browser.close()
process.exit(failed ? 1 : 0)
