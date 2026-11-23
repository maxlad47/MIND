// Contrôle automatique : pas de scroll horizontal, zones tactiles >= 44 px (hors éléments décoratifs)
import { chromium } from 'playwright-core'
const base = process.env.BASE ?? 'http://localhost:5180'
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark', isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('mind.db.v2')))
const check = async (name) => {
  await page.waitForTimeout(900)
  const r = await page.evaluate(() => {
    const hs = document.documentElement.scrollWidth > window.innerWidth + 1
    const small = []
    for (const el of document.querySelectorAll('button, a, [role=button], [role=switch], input, select, textarea')) {
      const b = el.getBoundingClientRect()
      if (!b.width || !b.height) continue
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none') continue
      // la zone tactile inclut le pseudo-élément .hit (+4px de chaque côté)
      const after = getComputedStyle(el, '::after')
      const aw = el.classList.contains('hit') ? parseFloat(after.width) || 0 : 0
      const ah = el.classList.contains('hit') ? parseFloat(after.height) || 0 : 0
      if (Math.max(b.width, aw) < 43.5 || Math.max(b.height, ah) < 43.5) small.push(`${el.tagName.toLowerCase()}[${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24)}] ${Math.round(Math.max(b.width, aw))}x${Math.round(Math.max(b.height, ah))}`)
    }
    return { hs, small }
  })
  console.log(`${r.hs ? 'FAIL scroll-x' : 'OK  '} ${name}${r.small.length ? '  petits: ' + r.small.join(' | ') : ''}`)
}
await page.goto(base); await page.waitForTimeout(1500)
await page.getByText('Camille').first().click()
for (const r of ['today', 'program', 'progress', 'profile']) { await page.goto(base + '/#/app/' + r); await check('/app/' + r) }
const d = await db()
const cam = d.profiles.find((p) => p.firstName === 'Camille')
const prog = d.programs.find((p) => p.clientId === cam.id)
const s = prog.weeks.flatMap((w) => w.sessions)
await page.goto(base + '/#/session/' + s.find((x) => x.sport === 'muscu' && x.status === 'prevue').id); await check('session muscu')
await page.goto(base + '/#/session/' + s.find((x) => x.sport === 'course' && x.status === 'prevue').id); await check('session course')
// formats de séance : Push de Nina (combo + superset), minuteur de repos, éditeur, ajout avec format, renfo de Léa
await page.evaluate(() => { const x = JSON.parse(localStorage.getItem('mind.db.v2')); x.sessionUserId = null; localStorage.setItem('mind.db.v2', JSON.stringify(x)) })
await page.goto(base); await page.waitForTimeout(500)
await page.getByText('Nina').first().click(); await page.waitForTimeout(900)
const dn = await db()
const nina = dn.profiles.find((p) => p.firstName === 'Nina')
const np = dn.programs.find((p) => p.clientId === nina.id && p.status === 'actif')
const push = np.weeks.flatMap((w) => w.sessions).filter((x) => x.title === 'Push' && x.status === 'prevue').sort((a, b) => a.date.localeCompare(b.date))[0]
await page.goto(base + '/#/session/' + push.id); await check('séance : combo + superset')
await page.getByLabel('Valider la partie 1').first().click(); await page.getByLabel('Valider la partie 2').first().click(); await check('séance + minuteur de repos')
await page.getByRole('button', { name: /Ajouter un exercice/ }).click(); await check('ajout : format et groupes')
await page.keyboard.press('Escape'); await page.waitForTimeout(500)
await page.getByLabel('Modifier le groupe').first().click(); await check('réglages du groupe')
await page.keyboard.press('Escape'); await page.waitForTimeout(500)
await page.getByLabel('Modifier', { exact: true }).first().click(); await check('modifier un exercice en combo')
await page.keyboard.press('Escape'); await page.waitForTimeout(500)
await page.goto(base + '/#/app/sessions'); await page.waitForTimeout(500)
await page.getByText('Push', { exact: true }).first().click(); await page.waitForTimeout(600)
await page.locator('[data-exercise="dev_couche_barre"]').getByRole('button').nth(1).click(); await check('éditeur : séries détaillées')
await page.keyboard.press('Escape'); await page.waitForTimeout(400)
await page.evaluate(() => { const x = JSON.parse(localStorage.getItem('mind.db.v2')); x.sessionUserId = null; localStorage.setItem('mind.db.v2', JSON.stringify(x)); localStorage.removeItem('mind.rest.v1') })
await page.goto(base); await page.waitForTimeout(500)
await page.getByPlaceholder('Email').fill('lea@demo.mind'); await page.getByPlaceholder('Mot de passe').fill('mind1234')
await page.getByRole('button', { name: 'Se connecter' }).click(); await page.waitForTimeout(900)
const dl = await db()
const lea = dl.profiles.find((p) => p.firstName === 'Léa')
const lp = dl.programs.find((p) => p.clientId === lea.id && p.status === 'actif')
const renfo = lp.weeks.flatMap((w) => w.sessions).find((x) => x.kind === 'renfo' && x.status === 'prevue')
await page.goto(base + '/#/session/' + renfo.id); await check('séance de renfo coureur')
await page.getByRole('button', { name: 'Tour 1 fait' }).click(); await check('renfo + minuteur')
await page.goto(base + '/#/app/profile'); await check('profil : son du minuteur')
await page.evaluate(() => { const x = JSON.parse(localStorage.getItem('mind.db.v2')); x.sessionUserId = null; localStorage.setItem('mind.db.v2', JSON.stringify(x)) })
await page.goto(base); await check('auth')
await page.getByText('Max').first().click()
for (const r of ['/coach', '/coach/alerts', '/coach/me', '/coach/profile']) { await page.goto(base + '/#' + r); await check(r) }
const hugo = (await db()).profiles.find((p) => p.firstName === 'Hugo')
await page.goto(base + '/#/coach/client/' + hugo.id); await check('fiche client')

// ---- mode libre : Nina (démo), écrans et feuilles
const goto = async (path) => { await page.goto(base + '/#' + path); await page.waitForTimeout(250) }
const login = async (name) => {
  await page.evaluate(() => { const x = JSON.parse(localStorage.getItem('mind.db.v2')); x.sessionUserId = null; localStorage.setItem('mind.db.v2', JSON.stringify(x)) })
  await page.goto(base); await page.waitForTimeout(700); await page.getByText(name).first().click(); await page.waitForTimeout(700)
}
await login('Nina')
for (const r of ['today', 'sessions', 'program', 'progress', 'profile']) { await goto('/app/' + r); await check('libre /app/' + r) }
await goto('/app/sessions')
await page.getByText('Push', { exact: true }).first().click(); await check('libre : éditeur de séance')
await page.locator('[data-exercise]').first().getByRole('button').nth(1).click(); await check('libre : éditeur, exercice ouvert')
await page.getByRole('button', { name: /Ajouter un exercice/ }).click(); await check('libre : sélecteur d\'exercice')
await page.getByText('Créer un exercice').first().click(); await check('libre : créer un exercice')
await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.waitForTimeout(500)
await goto('/app/today'); await goto('/app/sessions')
await page.getByText('Modifier le planning').click(); await check('libre : planning (à la suite)')
await page.getByRole('tab', { name: 'Jours fixes' }).click(); await check('libre : planning (jours fixes)')
await page.keyboard.press('Escape'); await page.waitForTimeout(400)
await goto('/app/today')
await page.getByRole('button', { name: 'Séance en plus' }).click(); await check('libre : séance en plus')
await page.keyboard.press('Escape'); await page.waitForTimeout(400)
const nd = await db()
const ninaProg = nd.programs.find((p) => p.clientId === nd.profiles.find((x) => x.firstName === 'Nina').id && p.status === 'actif')
const nextN = ninaProg.weeks.flatMap((w) => w.sessions).filter((x) => x.status === 'prevue').sort((a, b) => a.date.localeCompare(b.date))[0]
await goto('/session/' + nextN.id); await check('libre : séance')
await login('Max')
await goto('/coach'); await check('coach : liste (badge Libre)')
await goto('/coach/client/' + nd.profiles.find((x) => x.firstName === 'Nina').id); await check('coach : fiche client libre')
// onboarding : étape de choix du mode
await page.evaluate(() => { const x = JSON.parse(localStorage.getItem('mind.db.v2')); x.sessionUserId = null; localStorage.setItem('mind.db.v2', JSON.stringify(x)) })
await page.goto(base); await page.waitForTimeout(600); await page.getByText('Créer un compte').click()
await page.getByPlaceholder('Prénom').fill('Audit'); await page.getByPlaceholder('Email').fill('audit@test.fr'); await page.getByPlaceholder('Mot de passe').fill('secret12')
await page.getByRole('button', { name: 'Créer mon compte' }).click(); await check('onboarding : choix du mode')
await page.getByText('J\'ai déjà mon programme').click(); await check('onboarding : mode libre sélectionné')
for (let i = 0; i < 12; i++) {
  if (await page.getByRole('button', { name: 'Accéder à mes séances' }).count()) break
  if (/naissance/.test(await page.locator('h1').first().innerText())) await page.locator('input[type=date]').fill('1994-03-02')
  await page.getByRole('button', { name: 'Continuer' }).click(); await page.waitForTimeout(250)
}
await page.getByRole('button', { name: 'Accéder à mes séances' }).click(); await page.waitForTimeout(800); await check('libre : Mes séances (état vide)')
await page.getByRole('button', { name: /Créer ma première séance/ }).click(); await check('libre : nouvelle séance (vide)')

// ---- Garmin / courses importées : Léa (démo)
await page.evaluate(() => { const x = JSON.parse(localStorage.getItem('mind.db.v2')); x.sessionUserId = null; localStorage.setItem('mind.db.v2', JSON.stringify(x)) })
await page.goto(base); await page.waitForTimeout(700)
await page.getByPlaceholder('Email').fill('lea@demo.mind'); await page.getByPlaceholder('Mot de passe').fill('mind1234')
await page.getByRole('button', { name: 'Se connecter' }).click(); await page.waitForTimeout(900)
const gl = await db()
const gLea = gl.profiles.find((x) => x.firstName === 'Léa')
const gProg = gl.programs.find((p) => p.clientId === gLea.id && p.status === 'actif')
const gs = gProg.weeks.flatMap((w) => w.sessions)
const byRun = (id) => gs.find((x) => x.runLog?.importedRunId === id)
await goto('/app/today'); await check('Garmin : Aujourd\'hui (À compléter, pas et sommeil)')
await goto('/session/' + byRun('ir-garmin-seed-fractionne').id + '?bilan=1'); await check('Garmin : bilan après séance (pré-réponse)')
await page.getByRole('radio', { name: 'En partie' }).click(); await page.getByRole('button', { name: 'Douleur ou gêne' }).click(); await check('Garmin : bilan avec raisons et zone de douleur')
await page.keyboard.press('Escape'); await page.waitForTimeout(400)
await goto('/session/' + byRun('ir-garmin-seed-fractionne').id); await check('Garmin : fractionné (tours de travail)')
await goto('/session/' + byRun('ir-garmin-seed-ef').id); await check('Garmin : EF (allure par km, FC, zones, alerte)')
await goto('/session/' + byRun('ir-garmin-seed-longue').id); await check('Garmin : sortie longue (départ trop rapide)')
await page.getByText('Ce n\'est pas cette séance ?').click(); await check('Garmin : correction du rattachement')
await page.keyboard.press('Escape'); await page.waitForTimeout(400)
const gCourse = gs.find((x) => x.sport === 'course' && x.kind !== 'renfo' && x.status === 'prevue')
await goto('/session/' + gCourse.id); await check('Garmin : trois entrées sur une séance de course')
await page.getByRole('button', { name: 'Saisie rapide' }).click(); await check('Garmin : saisie rapide')
await page.keyboard.press('Escape'); await page.waitForTimeout(400)
await page.getByRole('button', { name: /Importer depuis ma montre/ }).click(); await check('Garmin : import .FIT (aide iPhone)')
await page.keyboard.press('Escape'); await page.waitForTimeout(400)
await goto('/app/profile'); await check('Garmin : profil → Montre')
await login('Max')
await goto('/coach/client/' + gLea.id); await page.getByText('Séances', { exact: true }).first().click(); await check('Garmin : coach → séances (effort, pas, sommeil, bilans)')
await page.getByText('Profil', { exact: true }).first().click(); await check('Garmin : coach → profil (FC max)')
await browser.close()
