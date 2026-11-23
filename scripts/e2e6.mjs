// E2E des formats de séance : combo 1 + 6 (saisie, charge relative), superset guidé, minuteur de repos, EMOM / AMRAP, ajout avec format,
// éditeur de séances modèles, renfo coureur (Léa, Camille), formulaire.  Lancer : node scripts/e2e6.mjs   (serveur de dev sur :5180)
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
const shot = async (name) => { await page.waitForTimeout(450); await page.screenshot({ path: `${SHOTS}/${name}.png` }) }
const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('mind.db.v2')))
let failed = 0
const ok = (c, m) => { if (!c) failed++; console.log((c ? 'OK   ' : 'FAIL ') + m) }
const sessionsOf = (p) => p.weeks.flatMap((w) => w.sessions)
const iso = (() => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}` })()
const go = async (path) => { await page.goto(base + '/#' + path); await page.waitForTimeout(350) }
const logout = async () => { await page.evaluate(() => { const x = JSON.parse(localStorage.getItem('mind.db.v2')); x.sessionUserId = null; localStorage.setItem('mind.db.v2', JSON.stringify(x)); localStorage.removeItem('mind.rest.v1') }); await page.goto(base); await page.waitForTimeout(500) }
const profileOf = (d, name) => d.profiles.find((p) => p.firstName === name)
const activeOf = (d, id) => d.programs.find((p) => p.clientId === id && p.status === 'actif')
const timerText = async () => (await page.getByRole('timer', { name: 'Minuteur de repos' }).count()) ? await page.getByRole('timer', { name: 'Minuteur de repos' }).innerText() : ''

// ---------------------------------------------------------------- Nina : Push = combo 1 + 6 au développé couché + superset
await page.goto(base); await page.waitForTimeout(800)
await page.getByText('Nina').first().click(); await page.waitForTimeout(900)
let d = await db()
const nina = profileOf(d, 'Nina')
let prog = activeOf(d, nina.id)
const push = sessionsOf(prog).filter((s) => s.title === 'Push' && s.status === 'prevue' && !s.extra).sort((a, b) => a.date.localeCompare(b.date))[0]
ok(push.exercises[0].format === 'combo' && push.exercises[0].plan.length === 3 && push.exercises[0].plan[0].parts.length === 2, 'démo Nina : développé couché en combo (1 + 6 × 3)')
ok(push.groups?.length === 1 && push.groups[0].kind === 'superset', 'démo Nina : un superset dans le Push')
const doneHist = sessionsOf(prog).filter((s) => s.status === 'faite' && s.title === 'Push')
ok(doneHist.length > 0 && doneHist[0].exercises[0].logs.some((l) => l.part === 1), 'démo Nina : historique saisi partie par partie')

await go('/session/' + push.id); await page.waitForTimeout(900); await shot('60-push-combo')
ok((await page.locator('[data-format="combo"]').first().innerText()) === 'Combo · 1 + 6', 'le format s\'affiche sous le nom : « Combo · 1 + 6 »')
ok((await page.getByText(/Dernière : 1 × [\d,]+ kg \+ 6 × [\d,]+ kg/).count()) >= 3, '« La dernière fois » s\'affiche partie par partie (1 × … kg + 6 × … kg)')
ok((await page.getByTestId('group-title').first().innerText()) === 'Superset · Tour 1/3', 'superset : « Superset · Tour 1/3 »')
ok((await page.getByTestId('group-hint').first().innerText()) === 'A1 puis B1, puis repos', 'superset : « A1 puis B1, puis repos »')

// charge relative : on tape la partie lourde, la partie légère suit (−20 %, arrondi à 0,5 kg)
const heavy = page.getByLabel('Poids, partie 1').first()
const light = page.getByLabel('Poids, partie 2').first()
await heavy.fill('101'); await page.waitForTimeout(200)
ok((await light.inputValue()) === '81', `charge relative : 101 kg → ${await light.inputValue()} kg (−20 %, arrondi à 0,5 kg)`)
await heavy.fill('100'); await page.waitForTimeout(150)
ok((await light.inputValue()) === '80', 'charge relative : 100 kg → 80 kg')
await light.fill('77.5'); await heavy.fill('105'); await page.waitForTimeout(150)
ok((await light.inputValue()) === '77.5', 'une partie modifiée à la main n\'est plus recalculée')
await heavy.fill('100'); await light.fill('80')

// valider la rep lourde : enchaîne (pas de minuteur), puis les 6 reps : repos de l'exercice
await page.getByLabel('Valider la partie 1').first().click(); await page.waitForTimeout(400)
ok((await page.getByRole('status').filter({ hasText: 'Enchaîne' }).count()) > 0, 'partie enchaînée : signal « Enchaîne », pas de minuteur')
ok((await timerText()) === '', 'partie enchaînée : aucun minuteur')
await shot('61-enchaine')
await page.getByLabel('Valider la partie 2').first().click(); await page.waitForTimeout(500)
const t1 = await timerText()
ok(/2:(2\d|30)/.test(t1) && /repos/i.test(t1), `après la dernière partie : repos de l'exercice (2:30) → « ${t1.replace(/\n/g, ' ')} »`)
await shot('62-repos-bandeau')
d = await db(); prog = activeOf(d, nina.id)
const s1 = sessionsOf(prog).find((s) => s.id === push.id)
ok(s1.exercises[0].logs.length === 2 && s1.exercises[0].logs[0].part === 0 && s1.exercises[0].logs[1].part === 1 && s1.exercises[0].logs[1].kg === 80, 'saisie : 1 × 100 kg + 6 × 80 kg enregistrée partie par partie')
// +15 s, puis « Passer »
await page.getByLabel('Ajouter 15 secondes').click(); await page.waitForTimeout(300)
ok(/2:(4\d|3\d)/.test(await timerText()), '+15 s ajoute du temps au repos')
await page.getByLabel('Retirer 15 secondes').click(); await page.waitForTimeout(200)
// le minuteur survit à un rechargement de la page
await page.reload(); await page.waitForTimeout(1200)
ok(/\d:\d\d/.test(await timerText()), 'le minuteur survit à un rechargement de la page')
await page.getByRole('button', { name: 'Passer' }).click(); await page.waitForTimeout(900)
ok((await timerText()) === '', '« Passer » arrête le repos')

// superset : A1 → repos entre exercices (10 s), B1 → repos entre tours (75 s)
await page.getByLabel('Valider le A1').click(); await page.waitForTimeout(500)
const ta = await timerText()
ok(/0:(0\d|10)/.test(ta) && /entre exercices/i.test(ta), `superset : après A1, repos entre exercices → « ${ta.replace(/\n/g, ' ')} »`)
ok((await page.getByTestId('group-hint').first().innerText()) === 'B1, puis repos', 'superset : il reste B1')
await page.getByLabel('Valider le B1').click(); await page.waitForTimeout(500)
const tb = await timerText()
ok(/1:(1\d|0\d|15)/.test(tb) && /entre les tours/i.test(tb), `superset : après B1, repos entre les tours → « ${tb.replace(/\n/g, ' ')} »`)
ok((await page.getByTestId('group-title').first().innerText()) === 'Superset · Tour 2/3', 'superset : « Superset · Tour 2/3 »')
ok((await page.getByTestId('group-hint').first().innerText()) === 'A2 puis B2, puis repos', 'superset : « A2 puis B2, puis repos »')
await shot('63-superset-tour2')
// « Tour 2 fait » valide d'un coup A2 et B2
await page.getByRole('button', { name: 'Tour 2 fait' }).click(); await page.waitForTimeout(500)
d = await db(); prog = activeOf(d, nina.id)
const s2 = sessionsOf(prog).find((s) => s.id === push.id)
const gm = s2.groups[0].exerciseIds.map((id) => s2.exercises.find((e) => e.id === id))
ok(gm.every((e) => e.logs.some((l) => l.n === 2)), '« Tour 2 fait » : A2 et B2 saisis d\'un coup (charges et reps facultatives)')
await page.getByRole('button', { name: 'Passer' }).click().catch(() => {})
await shot('64-push-apres')

// ---------------------------------------------------------------- ajouter un exercice avec un FORMAT (combo, 30 secondes) puis un groupe EMOM
await page.getByRole('button', { name: /Ajouter un exercice/ }).click(); await page.waitForTimeout(500); await shot('65-ajout-format')
await page.getByRole('button', { name: 'Combo' }).click(); await page.waitForTimeout(200)
await page.getByPlaceholder('Rechercher').fill('Développé couché machine'); await page.waitForTimeout(200)
await page.locator('.bg-surface2.rounded-xl.p-3').first().click(); await page.waitForTimeout(500)
d = await db(); prog = activeOf(d, nina.id)
const s3 = sessionsOf(prog).find((s) => s.id === push.id)
const added = s3.exercises.at(-1)
ok(added.exerciseId === 'dev_couche_machine' && added.format === 'combo' && added.plan.length === 3 && added.plan[0].parts[0].reps === 1 && added.plan[0].parts[1].reps === 6, 'ajout avec le format « Combo » : 3 séries, 1 rep puis 6 reps à −20 % préremplies')
// EMOM : pogo jumps + squat jump
await page.getByRole('button', { name: /Ajouter un exercice/ }).click(); await page.waitForTimeout(500)
await page.getByRole('button', { name: 'EMOM' }).click(); await page.waitForTimeout(200)
await page.getByPlaceholder('Rechercher').fill('Pogo'); await page.waitForTimeout(200)
await page.locator('.bg-surface2.rounded-xl.p-3').first().click(); await page.waitForTimeout(300)
await page.getByPlaceholder('Rechercher').fill('Squat jump'); await page.waitForTimeout(200)
await page.locator('.bg-surface2.rounded-xl.p-3').first().click(); await page.waitForTimeout(300); await shot('66-emom-compose')
await page.getByRole('button', { name: /Créer l'EMOM/ }).click(); await page.waitForTimeout(700)
d = await db(); prog = activeOf(d, nina.id)
const s4 = sessionsOf(prog).find((s) => s.id === push.id)
const emom = s4.groups.find((g) => g.kind === 'emom')
ok(!!emom && emom.exerciseIds.length === 2 && emom.durationMin === 12, 'EMOM créé : 2 exercices, 12 minutes par défaut')
await page.getByRole('button', { name: /Démarrer/ }).click(); await page.waitForTimeout(1300); await shot('67-emom-en-cours')
ok((await page.getByText(/Minute 1\/12/).count()) > 0, 'EMOM : « Minute 1/12 » avec décompte')
ok((await page.getByRole('timer', { name: 'Temps restant dans la minute' }).count()) === 1, 'EMOM : décompte de la minute')
await page.reload(); await page.waitForTimeout(1200)
ok((await page.getByText(/Minute 1\/12/).count()) > 0, 'EMOM : le décompte survit à un rechargement (horodatage de départ)')
await page.getByRole('button', { name: 'Arrêter maintenant' }).click(); await page.waitForTimeout(500)
d = await db(); prog = activeOf(d, nina.id)
ok(sessionsOf(prog).find((s) => s.id === push.id).groups.find((g) => g.kind === 'emom').result?.minutesDone >= 0, 'EMOM : résultat enregistré')
await shot('68-emom-resultat')

// terminer la séance : « Tu as changé N choses » couvre format et groupes
await page.getByText(/Terminer la séance/).click(); await page.waitForTimeout(400)
await page.getByRole('button', { name: 'Terminer', exact: true }).click(); await page.waitForTimeout(600)
await page.getByRole('button', { name: 'Super' }).click(); await page.waitForTimeout(700); await shot('69-diff-formats')
ok((await page.getByText(/Tu as changé \d+ chose/).count()) > 0, 'fin de séance libre : « Tu as changé N choses »')
ok((await page.getByText(/groupe ajouté/).count()) > 0 && (await page.getByText(/Développé couché machine : (format|séries)|ajouté/).count()) > 0, 'la détection couvre le nouveau groupe (EMOM) et l\'exercice ajouté')
await page.getByRole('button', { name: 'Non, juste cette fois' }).click(); await page.waitForTimeout(500)

// ---------------------------------------------------------------- éditeur de séances modèles : format, plan, groupe
await go('/app/sessions'); await page.waitForTimeout(600)
await page.getByText('Push', { exact: true }).first().click(); await page.waitForTimeout(700); await shot('70-editeur-push')
ok((await page.getByText('Combo · 1 + 6').count()) > 0 && (await page.getByText('Superset · A').count()) > 0 && (await page.getByText('Superset · B').count()) > 0, 'éditeur : étiquettes « Combo · 1 + 6 » et « Superset · A / B »')
await page.locator('[data-exercise="dev_couche_barre"]').getByRole('button').nth(1).click(); await page.waitForTimeout(400); await shot('71-editeur-combo')
ok((await page.locator('[data-plan-set]').count()) === 3, 'éditeur : 3 séries détaillées (combo)')
ok((await page.getByLabel('Retirer la partie 2').count()) === 3, 'éditeur : chaque série a 2 parties')
await page.getByRole('button', { name: 'Dégressive', exact: true }).first().click(); await page.waitForTimeout(400); await shot('72-editeur-degressive')
ok((await page.getByText('Dégressive · 3 parties').count()) > 0, 'éditeur : format « Dégressive » prérempli (3 parties)')
await page.getByRole('button', { name: 'Combo', exact: true }).first().click(); await page.waitForTimeout(300)
await page.locator('[data-exercise="dev_couche_barre"]').getByRole('button').nth(1).click(); await page.waitForTimeout(300)
await page.locator('[data-exercise="elev_lat_halteres"]').getByRole('button').nth(1).click(); await page.waitForTimeout(400); await shot('73-editeur-groupe')
ok((await page.getByText('Tours').count()) > 0 && (await page.getByText('Repos entre exercices (s)').count()) > 0, 'éditeur : réglages du groupe (tours, repos entre exercices, repos entre tours)')
await page.getByRole('button', { name: 'Annuler' }).click().catch(() => {})
await page.keyboard.press('Escape'); await page.waitForTimeout(500)

// course en mode libre : 2 modèles « Renfo coureur » tout faits dans « Mes séances »
await go('/app/sessions'); await page.waitForTimeout(700)
ok((await page.getByText(/Deux séances de renfo toutes prêtes/).count()) > 0, 'Mes séances (course libre) : deux modèles « Renfo coureur » proposés')
await page.getByRole('button', { name: 'Ajouter à mes séances' }).click(); await page.waitForTimeout(700); await shot('74-modeles-renfo')
d = await db(); prog = activeOf(d, nina.id)
const rt = prog.libre.templates.filter((t) => /^Renfo coureur/.test(t.name))
ok(rt.length === 2 && rt.every((t) => t.groups?.[0]?.kind === 'circuit') && !prog.libre.planning.order.some((id) => rt.some((t) => t.id === id)), 'les 2 modèles sont ajoutés (circuits), sans entrer dans la rotation')
ok((await page.getByText(/Deux séances de renfo toutes prêtes/).count()) === 0, 'la carte disparaît une fois les modèles ajoutés')

// ---------------------------------------------------------------- Léa : renfo coureur (course seule, 1 × / semaine, sans matériel)
await logout()
await page.getByPlaceholder('Email').fill('lea@demo.mind'); await page.getByPlaceholder('Mot de passe').fill('mind1234')
await page.getByRole('button', { name: 'Se connecter' }).click(); await page.waitForTimeout(900)
d = await db(); const lea = profileOf(d, 'Léa'); const lp = activeOf(d, lea.id)
const renfos = sessionsOf(lp).filter((s) => s.kind === 'renfo')
ok(renfos.length >= 8, `Léa : ${renfos.length} séances de renfo coureur dans le plan (1 par semaine, sans matériel)`)
const rf = renfos.find((s) => s.status === 'prevue' && s.date >= iso)
ok(rf.estMinutes >= 18 && rf.estMinutes <= 30 && rf.groups[0].kind === 'circuit', `renfo : circuit de ${rf.estMinutes} min`)
await go('/session/' + rf.id); await page.waitForTimeout(900); await shot('80-renfo')
ok((await page.getByText(/5 min de mobilité/).count()) > 0, 'renfo : échauffement de 5 min de mobilité')
ok((await page.getByText('Circuit', { exact: true }).count()) > 0, 'renfo : cartouche « Circuit »')
await page.getByRole('button', { name: 'Tour 1 fait' }).click(); await page.waitForTimeout(500); await shot('81-renfo-tour1')
ok(/\d:\d\d/.test(await timerText()), 'renfo : « Tour 1 fait » lance le repos entre les tours')
await page.getByRole('button', { name: 'Passer' }).click().catch(() => {})
await go('/app/program'); await page.waitForTimeout(800); await shot('82-renfo-agenda')

// ---------------------------------------------------------------- Hugo (force) / coach : séance avec série lourde, et formulaire avec l'étape renfo
await logout()
await page.getByText('Max').first().click(); await page.waitForTimeout(800)
d = await db(); const hugo = profileOf(d, 'Hugo'); const hp = activeOf(d, hugo.id)
const hs = sessionsOf(hp).find((s) => s.sport === 'muscu' && s.status === 'prevue' && s.exercises[0].format === 'lourde')
ok(!!hs, 'Hugo (force) : la séance commence par une série lourde + séries allégées')
await go('/session/' + hs.id); await page.waitForTimeout(900); await shot('83-hugo-lourde')
ok((await page.locator('[data-format="lourde"]').count()) > 0, 'Hugo : format « Série lourde » affiché sous le nom')

// Camille (mixte) : compléments de coureur dans ses séances de muscu
await logout()
await page.getByText('Camille').first().click(); await page.waitForTimeout(900)
d = await db(); const cam = profileOf(d, 'Camille'); const cp = activeOf(d, cam.id)
const withExtras = sessionsOf(cp).filter((s) => s.exercises?.some((e) => e.renfo) && s.status === 'prevue')
ok(withExtras.length > 0 && !sessionsOf(cp).some((s) => s.kind === 'renfo'), 'Camille (mixte) : compléments de coureur dans les séances de muscu, pas de séance à part')
await go('/session/' + withExtras[0].id); await page.waitForTimeout(900); await shot('84-camille-complements')

// profil : son du minuteur
await go('/app/profile'); await page.waitForTimeout(700); await shot('85-profil')
ok((await page.getByText('Son de fin de repos').count()) > 0, 'Profil : réglage « Son de fin de repos »')
await page.getByLabel('Son de fin de repos').click(); await page.waitForTimeout(300)
ok(await page.evaluate(() => localStorage.getItem('mind.rest.sound')) === '0', 'Profil : le son se coupe')
await page.getByLabel('Son de fin de repos').click(); await page.waitForTimeout(300)

// formulaire : nouvelle inscription course → étape renfo, 1 fois par semaine proposé par défaut
await logout()
await page.getByText(/Créer un compte|Pas encore de compte|S'inscrire/).first().click().catch(() => {})
await page.waitForTimeout(300)
const emailInput = page.getByPlaceholder('Email')
if (await page.getByPlaceholder('Prénom').count()) await page.getByPlaceholder('Prénom').fill('Zoé')
await emailInput.fill(`zoe${Date.now()}@demo.mind`); await page.getByPlaceholder('Mot de passe').fill('mind1234')
await page.getByRole('button', { name: /Créer mon compte|Créer un compte|S'inscrire/ }).first().click(); await page.waitForTimeout(900)
const steps = []
for (let i = 0; i < 30; i++) {
  const title = await page.locator('h1').first().innerText()
  steps.push(title)
  if (/naissance/.test(title)) await page.locator('input[type=date]').fill('1990-05-10')
  if (/Quel programme/.test(title)) await page.getByText('Course à pied').click()
  if (/date de ta course/.test(title)) await page.locator('input[type=date]').fill(new Date(Date.now() + 98 * 86400000).toISOString().slice(0, 10))
  if (/renfo coureur/i.test(title)) break
  await page.getByRole('button', { name: 'Continuer' }).click(); await page.waitForTimeout(250)
}
ok(steps.some((t) => /renfo coureur/i.test(t)), `formulaire : étape « Ajouter du renfo coureur ? » (${steps.length} étapes)`)
await shot('90-form-renfo')
ok((await page.getByRole('button', { name: /1 fois par semaine/ }).getAttribute('aria-pressed')) === 'true', 'formulaire : « 1 fois par semaine » proposé par défaut pour un nouveau programme')
ok((await page.getByText('À la maison, sans matériel').count()) > 0 && (await page.getByText('À la maison, avec élastique et haltères').count()) > 0 && (await page.getByText('En salle').count()) > 0, 'formulaire : les trois choix de matériel')
await page.getByRole('button', { name: /2 fois par semaine/ }).click(); await page.waitForTimeout(200)
await page.getByRole('button', { name: /avec élastique et haltères/ }).click(); await page.waitForTimeout(200)
await shot('91-form-renfo-choix')
for (let i = 0; i < 6; i++) { if (await page.getByRole('button', { name: 'Générer mon programme' }).count()) break; await page.getByRole('button', { name: 'Continuer' }).click(); await page.waitForTimeout(250) }
await page.getByRole('button', { name: 'Générer mon programme' }).click(); await page.waitForTimeout(1500)
d = await db(); const zoe = d.profiles.filter((p) => p.firstName === 'Zoé').at(-1); const zp = activeOf(d, zoe.id)
ok(zp.q.run.renfo?.perWeek === 2 && zp.q.run.renfo.kit === 'elastique', 'formulaire : renfo 2 fois par semaine avec élastique enregistré')
ok(sessionsOf(zp).filter((s) => s.kind === 'renfo').length >= 10, `programme de Zoé : ${sessionsOf(zp).filter((s) => s.kind === 'renfo').length} séances de renfo`)
await go('/app/today'); await page.waitForTimeout(900); await shot('92-zoe-today')

console.log(`\n${failed} ÉCHEC(S)\nERRORS:`, errors)
await browser.close()
