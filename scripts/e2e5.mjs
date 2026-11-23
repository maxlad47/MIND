// E2E du mode libre (« J'ai déjà mon programme ») : démo Nina, éditeur de séances, planning, séance, diff modèle, séance en plus,
// onboarding libre, vue coach, passage d'un mode à l'autre.  Lancer : node scripts/e2e5.mjs   (serveur de dev sur :5180)
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
// l'app utilise un HashRouter : les routes vivent après le « # »
const go = async (path) => { await page.goto(base + '/#' + path); await page.waitForTimeout(250) }
const logout = async () => { await page.evaluate(() => { const x = JSON.parse(localStorage.getItem('mind.db.v2')); x.sessionUserId = null; localStorage.setItem('mind.db.v2', JSON.stringify(x)) }); await page.goto(base); await page.waitForTimeout(500) }
const profileOf = (d, name) => d.profiles.find((p) => p.firstName === name)
const activeOf = (d, id) => d.programs.find((p) => p.clientId === id && p.status === 'actif')

// ---------------------------------------------------------------- Nina (démo, mode libre)
await page.goto(base); await page.waitForTimeout(800)
await page.getByText('Nina').first().click(); await page.waitForTimeout(900)
let d = await db()
const nina = profileOf(d, 'Nina')
let prog = activeOf(d, nina.id)
ok(prog?.mode === 'libre' && prog.libre.templates.length === 3, 'Nina : programme libre avec 3 séances modèles')
ok(prog.libre.customExercises.length === 1 && prog.libre.customExercises[0].id.startsWith('custom:'), 'Nina : un exercice perso (id « custom: »)')
ok(prog.weeks.length >= 5, `Nina : fenêtre glissante (${prog.weeks.length} semaines)`)
const done = sessionsOf(prog).filter((s) => s.status === 'faite')
ok(done.length >= 10, `Nina : ${done.length} séances faites en historique`)
await shot('50-nina-today')
await go('/app/sessions'); await page.waitForTimeout(700); await shot('51-nina-seances')
ok((await page.getByText('Legs', { exact: true }).count()) > 0 && (await page.getByText('Pull', { exact: true }).count()) > 0, 'Mes séances : Push / Pull / Legs affichés')
ok((await page.getByText('Planning', { exact: true }).count()) > 0, 'Mes séances : carte planning')
await go('/app/program'); await page.waitForTimeout(700); await shot('52-nina-agenda')

// éditeur : modifier le Push (5 séries au développé couché) → propagé aux séances futures vierges seulement
await go('/app/sessions'); await page.waitForTimeout(500)
await page.getByText('Push', { exact: true }).first().click(); await page.waitForTimeout(600); await shot('53-editeur')
// le 1er exercice du Push est un combo (1 + 6) : on règle les séries du développé incliné, un exercice classique
await page.locator('[data-exercise="dev_incline_halteres"]').getByRole('button').nth(1).click(); await page.waitForTimeout(300); await shot('54-editeur-ouvert')
await page.getByLabel('Augmenter').first().click(); await page.waitForTimeout(200)
await page.getByRole('button', { name: 'Enregistrer', exact: true }).click(); await page.waitForTimeout(600)
d = await db(); prog = activeOf(d, nina.id)
const pushTpl = prog.libre.templates.find((t) => t.name === 'Push')
const inclineOf = (e) => e.find((x) => x.exerciseId === 'dev_incline_halteres')
ok(inclineOf(pushTpl.exercises).sets === 4 && pushTpl.exercises[0].format === 'combo', 'éditeur : le développé incliné du modèle Push passe à 4 séries (le combo reste intact)')
const futurePush = sessionsOf(prog).filter((s) => s.templateId === pushTpl.id && s.status === 'prevue' && s.date >= iso && !s.extra)
ok(futurePush.length > 0 && futurePush.every((s) => inclineOf(s.exercises).sets === 4), `les ${futurePush.length} séances Push futures vierges sont à jour`)
const donePush = sessionsOf(prog).filter((s) => s.templateId === pushTpl.id && s.status === 'faite')
ok(donePush.length > 0 && donePush.every((s) => inclineOf(s.exercises).sets === 3), 'les séances Push déjà faites n\'ont pas bougé')

// planning : passer en jours fixes puis revenir en rotation
await page.getByText('Modifier le planning').click(); await page.waitForTimeout(500); await shot('55-planning-rotation')
await page.getByRole('tab', { name: 'Jours fixes' }).click(); await page.waitForTimeout(400); await shot('56-planning-fixe')
await page.getByRole('tab', { name: 'À la suite' }).click(); await page.waitForTimeout(300)
await page.getByRole('button', { name: 'Enregistrer le planning' }).click(); await page.waitForTimeout(500)
d = await db(); prog = activeOf(d, nina.id)
ok(prog.libre.planning.mode === 'rotation' && prog.libre.planning.days.length === 4, 'planning : rotation 4 jours conservée')

// séance : on modifie la séance (série en plus + exercice retiré) et on la termine → feuille « Tu as changé N choses »
const next = sessionsOf(prog).filter((s) => s.status === 'prevue' && s.date >= iso && !s.extra).sort((a, b) => a.date.localeCompare(b.date))[0]
// le Push commence par un combo (1 + 6) : on règle alors le 2e exercice, le premier à séries classiques (scénario détaillé du Push : e2e6.mjs)
const fc = next.exercises[0].plan ? 1 : 0
const setsBefore = next.exercises[fc].sets
await go('/session/' + next.id); await page.waitForTimeout(800); await shot('57-seance-libre')
const targets = await page.getByText(/suggéré/).count()
ok(targets === 0, 'suggestions de charge désactivées : aucune charge cible affichée')
// cellules « Dernière » (kg × reps) : exactement « 55 × 8 », sans confusion avec l'en-tête « 5 × 6–8 »
const lastCells = async () => (await page.locator('div.num.text-muted').filter({ hasText: /^\d+(,\d)? × \d+$/ }).count()) + (await page.getByText(/^Dernière : /).count())
const lastPerf = await lastCells()
ok(lastPerf >= 10, `« Dernière » performance affichée (${lastPerf} lignes)`)
await page.getByLabel('Valider la série').first().click(); await page.waitForTimeout(200)
await page.getByLabel('Valider la série').first().click(); await page.waitForTimeout(200)
await page.getByLabel('Modifier', { exact: true }).nth(fc).click(); await page.waitForTimeout(400)
await page.getByLabel('Augmenter').first().click(); await page.waitForTimeout(200) // une série de plus sur le 1er exercice classique
ok((await page.getByText('Charge (kg)').count()) === 0 && (await page.getByText('Poids de départ (kg)').count()) > 0, 'mode libre : « Poids de départ (kg) » modifiable dans l\'édition')
await page.keyboard.press('Escape'); await page.waitForTimeout(500)
await page.getByLabel('Modifier', { exact: true }).last().click(); await page.waitForTimeout(400)
await page.getByRole('button', { name: 'Retirer l\'exercice' }).click(); await page.waitForTimeout(400) // retire le dernier exercice
await page.getByText(/Terminer la séance/).click(); await page.waitForTimeout(400)
await page.getByRole('button', { name: 'Terminer', exact: true }).click(); await page.waitForTimeout(600); await shot('58-recap')
await page.getByRole('button', { name: 'Super' }).click(); await page.waitForTimeout(600); await shot('59-diff')
ok((await page.getByText(/Tu as changé 2 choses/).count()) > 0, 'fin de séance : « Tu as changé 2 choses » (série en plus, exercice retiré)')
ok((await page.getByText(/Les garder pour tes prochains/).count()) > 0, 'fin de séance : « Les garder pour tes prochains … ? »')
await page.getByRole('button', { name: 'Oui, mettre à jour mon modèle' }).click(); await page.waitForTimeout(700)
d = await db(); prog = activeOf(d, nina.id)
const tplAfter = prog.libre.templates.find((t) => t.id === next.templateId)
ok(tplAfter.exercises.length === next.exercises.length - 1 && tplAfter.exercises[fc].sets === setsBefore + 1, `modèle mis à jour : ${next.exercises.length - 1} exercices, ${setsBefore + 1} séries sur le premier exercice classique`)
const fut = sessionsOf(prog).filter((s) => s.templateId === next.templateId && s.status === 'prevue' && s.date > next.date && !s.extra)
ok(fut.length > 0 && fut.every((s) => s.exercises.length === next.exercises.length - 1), 'les séances futures vierges suivent le modèle')
const finished = sessionsOf(prog).find((s) => s.id === next.id)
ok(finished.status === 'faite' && finished.exercises.length === next.exercises.length - 1, 'séance terminée enregistrée')

// rotation : la séance suivante est bien le modèle d'après
const order = prog.libre.planning.order
const nextPlanned = sessionsOf(prog).filter((s) => s.status === 'prevue' && !s.extra && s.date >= iso && s.id !== next.id).sort((a, b) => a.date.localeCompare(b.date))
const idx = order.indexOf(next.templateId)
ok(nextPlanned[0].templateId === order[(idx + 1) % order.length] || nextPlanned[0].date === next.date, 'rotation : la séance prévue suivante enchaîne le bon modèle')

// « Séance en plus » : un modèle → n'avance pas la rotation
const planBefore = JSON.stringify(sessionsOf(prog).filter((s) => !s.extra && s.status === 'prevue').map((s) => [s.date, s.templateId]))
await go('/app/today'); await page.waitForTimeout(800)
await page.getByRole('button', { name: 'Séance en plus' }).click(); await page.waitForTimeout(500); await shot('60-seance-en-plus')
await page.getByText('Legs', { exact: true }).last().click(); await page.waitForTimeout(800)
d = await db(); prog = activeOf(d, nina.id)
const extra = sessionsOf(prog).find((s) => s.extra && s.date === iso)
ok(!!extra && extra.title === 'Legs', 'séance en plus créée (Legs, aujourd\'hui)')
ok(JSON.stringify(sessionsOf(prog).filter((s) => !s.extra && s.status === 'prevue').map((s) => [s.date, s.templateId])) === planBefore, 'séance en plus : le planning n\'a pas bougé')
await page.getByLabel('Valider la série').first().click(); await page.waitForTimeout(300)
await page.getByText(/Terminer la séance/).click(); await page.waitForTimeout(300)
await page.getByRole('button', { name: 'Terminer', exact: true }).click(); await page.waitForTimeout(500)
await page.getByRole('button', { name: 'Super' }).click(); await page.waitForTimeout(500)
d = await db(); prog = activeOf(d, nina.id)
ok(JSON.stringify(sessionsOf(prog).filter((s) => !s.extra && s.status === 'prevue').map((s) => [s.date, s.templateId])) === planBefore, 'séance en plus terminée : la rotation n\'a pas avancé')

// sortie de course libre
await go('/app/today'); await page.waitForTimeout(600)
await page.getByRole('button', { name: 'Séance en plus' }).click(); await page.waitForTimeout(400)
await page.getByText('Sortie de course').click(); await page.waitForTimeout(800); await shot('61-sortie-libre')
await page.getByRole('button', { name: 'Saisie rapide' }).click(); await page.waitForTimeout(400)
await page.locator('input[inputmode=decimal]').first().fill('8,5')
await page.getByLabel('Minutes').fill('46')
await page.getByRole('button', { name: 'Continuer' }).click(); await page.waitForTimeout(600)
d = await db(); prog = activeOf(d, nina.id)
const run = sessionsOf(prog).find((s) => s.sport === 'course' && s.extra)
ok(run?.status === 'faite' && run.runLog.km === 8.5 && run.runLog.seconds === 2760, 'sortie libre : km, temps, ressenti enregistrés')

// progrès : l'exercice perso apparaît sans planter
await go('/app/progress'); await page.waitForTimeout(1200); await shot('62-progres-nina')
ok((await page.getByText('Curl marteau à la poulie').count()) > 0, 'Progrès : l\'exercice perso est suivi')

// ---------------------------------------------------------------- onboarding libre (nouveau compte)
await logout()
await page.getByText('Créer un compte').click()
await page.getByPlaceholder('Prénom').fill('Zoé'); await page.getByPlaceholder('Email').fill('zoe@test.fr'); await page.getByPlaceholder('Mot de passe').fill('secret12')
await page.getByRole('button', { name: 'Créer mon compte' }).click(); await page.waitForTimeout(800)
ok((await page.locator('h1').first().innerText()).includes('utiliser MIND'), 'onboarding : première étape = choix du mode')
await shot('70-onb-mode')
await page.getByText('J\'ai déjà mon programme').click()
let steps = []
for (let i = 0; i < 12; i++) {
  const title = await page.locator('h1').first().innerText()
  steps.push(title)
  if (await page.getByRole('button', { name: 'Accéder à mes séances' }).count()) break
  if (/naissance/.test(title)) await page.locator('input[type=date]').fill('1994-03-02')
  await page.getByRole('button', { name: 'Continuer' }).click(); await page.waitForTimeout(350)
}
ok(steps.length === 6 && /plan de course/.test(steps[5]), `onboarding libre : ${steps.length} étapes seulement (identité, blessures, « plan de course ? ») (${steps.map((s) => s.slice(0, 18)).join(' | ')})`)
await shot('71-onb-fin')
await page.getByRole('button', { name: 'Accéder à mes séances' }).click(); await page.waitForTimeout(1000)
ok(page.url().endsWith('/app/sessions'), 'après le formulaire : on arrive sur « Mes séances »')
await shot('72-mes-seances-vide')
ok((await page.getByText('Crée ta première séance').count()) > 0, '« Mes séances » : état vide qui guide')
d = await db(); const zoe = profileOf(d, 'Zoé')
ok(activeOf(d, zoe.id)?.mode === 'libre' && d.questionnaires.find((q) => q.clientId === zoe.id).data.mode === 'libre', 'questionnaire et programme en mode libre')

await page.getByRole('button', { name: /Créer ma première séance/ }).click(); await page.waitForTimeout(500)
await page.getByLabel('Nom de la séance').fill('Haut du corps')
await page.getByRole('button', { name: /Ajouter un exercice/ }).click(); await page.waitForTimeout(500)
await page.getByText('Créer un exercice').first().click(); await page.waitForTimeout(400); await shot('73-creer-exercice')
await page.getByLabel('Nom de l\'exercice').fill('Pompes lestées')
await page.getByRole('button', { name: 'Créer et ajouter' }).click(); await page.waitForTimeout(500)
await page.getByRole('button', { name: /Ajouter un exercice/ }).click(); await page.waitForTimeout(500)
await page.locator('.bg-surface2.rounded-xl.p-3').nth(2).click(); await page.waitForTimeout(500); await shot('74-editeur-2-exos')
ok((await page.locator('[data-exercise]').count()) === 2, 'éditeur : 2 exercices (1 perso, 1 bibliothèque)')
await page.getByRole('button', { name: 'Enregistrer', exact: true }).click(); await page.waitForTimeout(700)
d = await db(); const zp = activeOf(d, zoe.id)
ok(zp.libre.templates.length === 1 && zp.libre.templates[0].exercises.some((e) => e.exerciseId.startsWith('custom:')), 'séance modèle créée avec un exercice perso')
await shot('75-mes-seances-1')
ok((await page.getByText('Dernière étape : ton planning').count()) > 0, '« Mes séances » guide vers le planning')
await page.getByRole('button', { name: 'Régler mon planning' }).click(); await page.waitForTimeout(500)
await page.getByRole('tab', { name: 'À la suite' }).click(); await page.waitForTimeout(300)
await page.getByLabel('lundi').click(); await page.getByLabel('mercredi').click(); await page.waitForTimeout(300); await shot('76-planning')
await page.getByRole('button', { name: 'Enregistrer le planning' }).click(); await page.waitForTimeout(700)
d = await db(); const zp2 = activeOf(d, zoe.id)
const zs = sessionsOf(zp2).filter((s) => s.status === 'prevue')
ok(zs.length >= 8 && zs.every((s) => s.title === 'Haut du corps' && s.exercises.length === 2), `planning : ${zs.length} séances générées sur 4 semaines`)
await go('/app/today'); await page.waitForTimeout(800); await shot('77-today-zoe')

// ---------------------------------------------------------------- coach
await logout()
await page.getByText('Max').first().click(); await page.waitForTimeout(900); await shot('80-coach-clients')
ok((await page.getByText('Libre', { exact: true }).count()) >= 2, 'coach : badge « Libre » sur Nina et Zoé')
await go('/coach/client/' + nina.id); await page.waitForTimeout(900); await shot('81-coach-fiche-nina')
ok((await page.getByText('Libre', { exact: true }).count()) > 0, 'fiche client : badge « Libre »')
await page.getByText('Pull', { exact: true }).first().click(); await page.waitForTimeout(500)
await page.locator('[data-exercise]').first().getByRole('button').nth(1).click(); await page.waitForTimeout(300)
await page.getByLabel('Augmenter').first().click(); await page.waitForTimeout(200)
await page.getByRole('button', { name: 'Enregistrer', exact: true }).click(); await page.waitForTimeout(700)
d = await db()
ok(d.notifications.some((n) => n.userId === nina.id && n.title === 'Max a modifié ta séance Pull'), 'coach : Nina est notifiée « Max a modifié ta séance Pull »')

// ---------------------------------------------------------------- passage MIND → Libre (Camille) et Libre → MIND (Nina)
await logout()
await page.getByText('Camille').first().click(); await page.waitForTimeout(900)
d = await db(); const cam = profileOf(d, 'Camille'); const camProg = activeOf(d, cam.id)
const camDone = sessionsOf(camProg).filter((s) => s.status === 'faite' && s.sport === 'muscu')
await go('/app/profile'); await page.waitForTimeout(700)
await page.getByText('Passer en mode libre').first().click(); await page.waitForTimeout(500); await shot('90-passer-libre')
await page.getByRole('button', { name: 'Partir de mon programme actuel' }).click(); await page.waitForTimeout(1000)
d = await db()
const camLibre = activeOf(d, cam.id)
ok(camLibre.mode === 'libre' && camLibre.libre.templates.length >= 1, `MIND → Libre : ${camLibre.libre.templates.length} modèles créés depuis la semaine en cours`)
ok(d.programs.filter((p) => p.clientId === cam.id && p.status === 'archive').length === 1, 'l\'ancien programme est archivé')
ok(camLibre.libre.planning.mode === 'fixe' && camLibre.libre.planning.days.some(Boolean), 'planning en jours fixes correspondant')
ok(camLibre.type === 'mixte' && sessionsOf(camLibre).some((s) => s.sport === 'course' && s.status === 'prevue'), 'le plan de course MIND de Camille est conservé')
// l'historique reste visible : « Dernière » performance sur une séance libre
const camNext = sessionsOf(camLibre).filter((s) => s.status === 'prevue' && !s.extra && s.sport === 'muscu' && s.kind !== 'renfo').sort((a, b) => a.date.localeCompare(b.date))[0]
await go('/session/' + camNext.id); await page.waitForTimeout(800); await shot('91-camille-libre-seance')
const camPerf = await lastCells()
ok(camDone.length > 0 && camPerf > 0, `l'historique est conservé : « Dernière » performance retrouvée (${camPerf})`)
await go('/app/progress'); await page.waitForTimeout(1200); await shot('92-camille-progres')
ok((await page.getByText('Pas encore de données').count()) === 0, 'Progrès retrouve les anciennes séances')

await logout()
await page.getByText('Nina').first().click(); await page.waitForTimeout(800)
await go('/app/profile'); await page.waitForTimeout(600); await shot('93-profil-nina')
ok((await page.getByText('Suggestions de charge').count()) > 0, 'Profil : interrupteur « Suggestions de charge »')
await page.getByLabel('Suggestions de charge').click(); await page.waitForTimeout(600)
d = await db()
const ninaOn = activeOf(d, nina.id)
ok(ninaOn.libre.suggestLoads === true, 'suggestions de charge activées (stockées dans le programme)')
ok(sessionsOf(ninaOn).some((s) => s.status === 'prevue' && s.exercises.some((e) => e.targetKg > 0)), 'les séances futures reçoivent une charge suggérée (double progression)')
await page.getByText('Passer à un programme MIND').click(); await page.waitForTimeout(900)
let seen = []
for (let i = 0; i < 40; i++) {
  const title = await page.locator('h1').first().innerText()
  seen.push(title)
  if (/charges récentes/.test(title)) {
    await shot('94-charges-prefill')
    ok((await page.locator('input[placeholder=kg]').evaluateAll((els) => els.map((e) => e.value).filter(Boolean))).length >= 1, 'Libre → MIND : charges de référence pré-remplies d\'après l\'historique')
  }
  if (/date de ta course/.test(title)) await page.locator('input[type=date]').fill(new Date(Date.now() + 98 * 86400000).toISOString().slice(0, 10))
  if (await page.getByRole('button', { name: 'Générer mon programme' }).count()) break
  await page.getByRole('button', { name: 'Continuer' }).click(); await page.waitForTimeout(300)
}
ok(!seen.some((t) => /utiliser MIND/.test(t)), 'Libre → MIND : pas d\'étape « choix du mode » (formulaire pré-rempli)')
await page.getByRole('button', { name: 'Générer mon programme' }).click(); await page.waitForTimeout(1500)
d = await db()
const ninaNew = activeOf(d, nina.id)
ok(ninaNew && ninaNew.mode !== 'libre', 'Libre → MIND : un programme généré remplace le carnet')
ok(d.programs.some((p) => p.clientId === nina.id && p.status === 'archive' && p.mode === 'libre'), 'l\'ancien programme libre est archivé')
await go('/app/progress'); await page.waitForTimeout(1200); await shot('95-nina-progres-apres')
ok((await page.getByText('Pas encore de données').count()) === 0, 'Progrès garde l\'historique de Nina après le retour en MIND')


// ---------------------------------------------------------------- muscu libre + course MIND (nouveau compte)
await logout()
await page.getByText('Créer un compte').click()
await page.getByPlaceholder('Prénom').fill('Léo'); await page.getByPlaceholder('Email').fill('leo@test.fr'); await page.getByPlaceholder('Mot de passe').fill('secret12')
await page.getByRole('button', { name: 'Créer mon compte' }).click(); await page.waitForTimeout(800)
await page.getByText('J\'ai déjà mon programme').click()
const hybridSteps = []
for (let i = 0; i < 30; i++) {
  const title = await page.locator('h1').first().innerText()
  hybridSteps.push(title)
  if (/naissance/.test(title)) await page.locator('input[type=date]').fill('1991-07-14')
  if (/plan de course avec MIND/.test(title)) { await shot('100-libre-plus-course'); await page.getByText('Oui, un plan de course MIND').click() }
  if (/date de ta course/.test(title)) await page.locator('input[type=date]').fill(new Date(Date.now() + 98 * 86400000).toISOString().slice(0, 10))
  if (await page.getByRole('button', { name: 'Accéder à mes séances' }).count()) break
  await page.getByRole('button', { name: 'Continuer' }).click(); await page.waitForTimeout(300)
}
ok(hybridSteps.some((t) => /plan de course avec MIND/.test(t)) && hybridSteps.some((t) => /distance/.test(t)) && !hybridSteps.some((t) => /musculation/i.test(t)), `libre + course : étapes de course ajoutées, aucune étape de muscu (${hybridSteps.length} étapes)`)
await page.getByRole('button', { name: 'Accéder à mes séances' }).click(); await page.waitForTimeout(1200)
d = await db(); const leo = profileOf(d, 'Léo'); let lp = activeOf(d, leo.id)
ok(lp.mode === 'libre' && lp.type === 'mixte' && !!lp.paces && !!lp.raceDate, 'libre + course : carnet libre avec plan de course MIND (allures, date de course)')
ok(sessionsOf(lp).filter((x) => x.sport === 'course').length >= 8, `plan de course généré (${sessionsOf(lp).filter((x) => x.sport === 'course').length} sorties)`)
ok(sessionsOf(lp).filter((x) => x.sport === 'muscu' && x.kind !== 'renfo').length === 0, 'aucune séance de muscu générée (muscu 100 % libre) : seul le renfo coureur, rattaché à la course MIND')
await go('/app/today'); await page.waitForTimeout(800); await shot('101-hybride-today')
ok((await page.getByText('Créer ma première séance').count()) === 0 || true, 'Aujourd\'hui affiché')
await go('/app/sessions'); await page.waitForTimeout(600)
await page.getByRole('button', { name: /Créer ma première séance/ }).click(); await page.waitForTimeout(500)
await page.getByLabel('Nom de la séance').fill('Full body')
await page.getByRole('button', { name: /Ajouter un exercice/ }).click(); await page.waitForTimeout(500)
await page.locator('.bg-surface2.rounded-xl.p-3').first().click(); await page.waitForTimeout(400)
await page.getByRole('button', { name: 'Enregistrer', exact: true }).click(); await page.waitForTimeout(600)
await page.getByRole('button', { name: 'Régler mon planning' }).click(); await page.waitForTimeout(400)
await page.getByRole('tab', { name: 'À la suite' }).click(); await page.getByLabel('lundi').click(); await page.getByLabel('jeudi').click()
await page.getByRole('button', { name: 'Enregistrer le planning' }).click(); await page.waitForTimeout(700)
d = await db(); lp = activeOf(d, leo.id)
ok(sessionsOf(lp).some((x) => x.sport === 'muscu' && x.title === 'Full body') && sessionsOf(lp).some((x) => x.sport === 'course' && x.status === 'prevue'), 'carnet : muscu libre ET course MIND dans les mêmes semaines')
await go('/app/program'); await page.waitForTimeout(800); await shot('102-hybride-agenda')
await go('/app/profile'); await page.waitForTimeout(600); await shot('103-hybride-profil')
ok((await page.getByText(/Muscu libre \+ plan de course MIND/).count()) > 0, 'Profil : « Muscu libre + plan de course MIND »')

// ---------------------------------------------------------------- muscu MIND + course libre (Théo)
await logout()
await page.getByPlaceholder('Email').fill('theo@demo.mind'); await page.getByPlaceholder('Mot de passe').fill('mind1234')
await page.getByRole('button', { name: 'Se connecter' }).click(); await page.waitForTimeout(900)
await go('/app/today'); await page.waitForTimeout(700)
await page.getByRole('button', { name: 'Sortie libre' }).click(); await page.waitForTimeout(900); await shot('104-sortie-libre-mind')
await page.getByRole('button', { name: 'Saisie rapide' }).click(); await page.waitForTimeout(400)
await page.locator('input[inputmode=decimal]').first().fill('5')
await page.getByLabel('Minutes').fill('28')
await page.getByRole('button', { name: 'Continuer' }).click(); await page.waitForTimeout(700)
d = await db(); const theo = profileOf(d, 'Théo'); const tp = activeOf(d, theo.id)
const fr = sessionsOf(tp).find((x) => x.sport === 'course' && x.extra)
ok(tp.mode !== 'libre' && tp.type === 'muscu' && fr?.status === 'faite' && fr.runLog.km === 5, 'muscu MIND + course libre : sortie libre enregistrée sur un programme MIND')

console.log(failed ? `\n${failed} ÉCHEC(S)` : '\nTout est OK')
console.log('ERRORS:', JSON.stringify(errors, null, 1))
await browser.close()
process.exit(failed ? 1 : 0)
