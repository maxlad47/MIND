// E2E « balayer pour supprimer » dans l'agenda (comme Messages sur iPhone) : révéler, supprimer, annuler, balayage long,
// séance avec données (confirmation), le carnet libre ne recrée pas la séance, le défilement et l'appui long restent intacts.
// Lancer : node scripts/e2e8.mjs   (serveur de dev sur :5180)
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
const base = process.env.BASE ?? 'http://localhost:5180'
const SHOTS = process.env.SHOTS ?? '/tmp/shots'
mkdirSync(SHOTS, { recursive: true })
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark', isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const cdp = await ctx.newCDPSession(page)
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error' && !/503/.test(m.text())) errors.push(m.text()) })
let failed = 0
const ok = (c, m) => { if (!c) failed++; console.log((c ? 'OK   ' : 'FAIL ') + m) }
const shot = async (name) => { await page.waitForTimeout(350); await page.screenshot({ path: `${SHOTS}/${name}.png` }) }
const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('mind.db.v2')))
const all = (d) => d.programs.flatMap((p) => p.weeks.flatMap((w) => w.sessions))
const sess = async (id) => all(await db()).find((s) => s.id === id)
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] })
const iso = (() => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}` })()

/** Balayage horizontal au doigt sur la ligne `id`, de `dist` px (négatif = vers la gauche). */
async function swipe(id, dist, { steps = 10, hold = 0 } = {}) {
  const row = page.locator(`[data-swipe="${id}"]`)
  await row.scrollIntoViewIfNeeded()
  const b = await row.boundingBox()
  const x0 = b.x + b.width * 0.75, y = b.y + b.height / 2
  await touch('touchStart', x0, y)
  if (hold) await page.waitForTimeout(hold)
  for (let i = 1; i <= steps; i++) { await touch('touchMove', x0 + (dist * i) / steps, y); await page.waitForTimeout(16) }
  await touch('touchEnd')
  await page.waitForTimeout(450)
}
const firstFuture = async () => {
  const rows = page.locator('[data-swipe]')
  const n = await rows.count()
  const d = await db()
  for (let i = 0; i < n; i++) {
    const id = await rows.nth(i).getAttribute('data-swipe')
    const s = all(d).find((x) => x.id === id)
    if (s && s.status === 'prevue' && s.date >= iso && !(s.exercises ?? []).some((e) => e.logs.length)) return s
  }
}

// ---------------------------------------------------------------- Nina (carnet libre), onglet Agenda
await page.goto(base); await page.waitForTimeout(800)
await page.getByText('Nina').first().click(); await page.waitForTimeout(900)
await page.goto(base + '/#/app/program'); await page.waitForTimeout(700)
let s = await firstFuture()
ok(!!s, `séance future trouvée : ${s?.title} du ${s?.date}`)

// 1) petit balayage : le bouton « Supprimer » apparaît, rien n'est supprimé
await swipe(s.id, -120)
const del = page.locator(`[data-swipe="${s.id}"] [data-swipe-action]`)
ok(await del.isVisible(), 'balayage court : « Supprimer » révélé')
ok(!!(await sess(s.id)), '… la séance est toujours là')
await shot('80-swipe-revele')

// 2) toucher la ligne ouverte la referme (et n'ouvre pas la séance)
await page.locator(`[data-swipe="${s.id}"] [data-session] button`).first().click(); await page.waitForTimeout(450)
ok(page.url().includes('/app/program'), 'toucher la ligne ouverte : on reste dans l\'agenda')
ok(!(await del.isVisible().catch(() => false)), '… et la ligne se referme')

// 3) révéler puis toucher « Supprimer » : supprimée, pas recréée par le planning, « Annuler » la remet
await swipe(s.id, -120)
await del.click(); await page.waitForTimeout(700)
let d = await db()
ok(!all(d).some((x) => x.id === s.id), 'toucher « Supprimer » : séance supprimée')
const nina = d.profiles.find((p) => p.firstName === 'Nina')
let prog = d.programs.find((p) => p.clientId === nina.id && p.status === 'actif')
ok(!all({ programs: [prog] }).some((x) => x.date === s.date && x.templateId && !x.extra && x.status === 'prevue'), 'le carnet libre ne recrée pas de séance ce jour-là')
ok((prog.libre.removed ?? []).includes(s.date), 'le jour est retenu dans libre.removed')
ok(d.edits.some((e) => e.text.includes('supprimée')), 'historique des modifications : suppression notée')
await shot('81-swipe-supprimee')
await page.getByRole('button', { name: 'Annuler', exact: true }).click(); await page.waitForTimeout(500)
ok(!!(await sess(s.id)), '« Annuler » : la séance revient')

// 4) balayage long : suppression directe
await page.waitForTimeout(5200) // laisse partir le message précédent
s = await firstFuture()
await swipe(s.id, -330, { steps: 14 })
await page.waitForTimeout(400)
ok(!(await sess(s.id)), `balayage long : « ${s.title} » supprimée d'un coup`)
ok((await page.locator(`[data-swipe="${s.id}"]`).count()) === 0, '… et la ligne a disparu')

// 5) défilement vertical : rien ne bouge
s = await firstFuture()
const before = await page.evaluate(() => window.scrollY)
{
  const b = await page.locator(`[data-swipe="${s.id}"]`).boundingBox()
  await touch('touchStart', b.x + 200, b.y + 20)
  for (let i = 1; i <= 8; i++) { await touch('touchMove', b.x + 200 + i, b.y + 20 - i * 25); await page.waitForTimeout(16) }
  await touch('touchEnd'); await page.waitForTimeout(400)
}
ok(!(await page.locator(`[data-swipe="${s.id}"] [data-swipe-action]`).isVisible().catch(() => false)), 'défilement vertical : la ligne ne s\'ouvre pas')
ok(!!(await sess(s.id)), '… et rien n\'est supprimé')
void before

// 6) appui long : reste un déplacement (pas de bouton Supprimer)
await swipe(s.id, -60, { hold: 450, steps: 6 })
ok(!(await page.locator(`[data-swipe="${s.id}"] [data-swipe-action]`).isVisible().catch(() => false)), 'appui long puis glisser : pas de suppression révélée')
ok(!!(await sess(s.id)), '… et la séance est toujours là')

// 7) séance faite : confirmation demandée
const weekBtn = page.getByLabel('Semaine précédente')
await weekBtn.click(); await page.waitForTimeout(500)
d = await db()
const doneRow = await (async () => {
  const rows = page.locator('[data-swipe]'); const n = await rows.count()
  for (let i = 0; i < n; i++) { const id = await rows.nth(i).getAttribute('data-swipe'); if (all(d).find((x) => x.id === id)?.status === 'faite') return id }
})()
ok(!!doneRow, 'semaine précédente : une séance faite')
if (doneRow) {
  await swipe(doneRow, -330, { steps: 14 })
  ok(await page.getByText('Supprimer cette séance ?').isVisible(), 'séance faite : confirmation demandée')
  ok(!!(await sess(doneRow)), '… rien n\'est supprimé avant de confirmer')
  await shot('82-swipe-confirmation')
  await page.getByRole('dialog', { name: 'Supprimer cette séance ?' }).getByRole('button', { name: 'Annuler' }).click(); await page.waitForTimeout(400)
  ok(!!(await sess(doneRow)), 'confirmation annulée : la séance reste')
}

// ---------------------------------------------------------------- coach : Mon entraînement → Agenda
// la démo ne donne pas de programme perso à Max : on lui confie le carnet de Nina, comme s'il était le sien
await page.evaluate(() => {
  const x = JSON.parse(localStorage.getItem('mind.db.v2'))
  const max = x.profiles.find((p) => p.firstName === 'Max'), nina = x.profiles.find((p) => p.firstName === 'Nina')
  for (const p of x.programs) if (p.clientId === nina.id) p.clientId = max.id
  x.sessionUserId = null
  localStorage.setItem('mind.db.v2', JSON.stringify(x))
})
await page.goto(base); await page.waitForTimeout(700)
await page.getByText('Max').first().click(); await page.waitForTimeout(900)
await page.goto(base + '/#/coach/me'); await page.waitForTimeout(700)
await page.getByRole('tab', { name: 'Agenda', exact: true }).click(); await page.waitForTimeout(600)
ok((await page.locator('[data-swipe]').count()) > 0, `coach, Mon entraînement → Agenda : ${await page.locator('[data-swipe]').count()} séances balayables`)
if (!(await firstFuture())) { await page.getByLabel('Semaine suivante').click(); await page.waitForTimeout(500) } // la semaine consultée plus haut est retenue
s = await firstFuture()
await swipe(s.id, -120); await shot('83-coach-agenda-revele')
await page.locator(`[data-swipe="${s.id}"] [data-swipe-action]`).click(); await page.waitForTimeout(700)
ok(!(await sess(s.id)), `coach : « ${s.title} » du ${s.date} supprimée par balayage`)
await shot('84-coach-agenda-supprimee')

ok(errors.length === 0, 'aucune erreur console' + (errors.length ? ' : ' + errors.join(' | ') : ''))
await browser.close()
console.log(failed ? `\n${failed} échec(s)` : '\nTout est vert')
process.exit(failed ? 1 : 0)
