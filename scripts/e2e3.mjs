import { chromium } from 'playwright-core'
const base = 'http://localhost:5180'
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'dark', isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
const ok = (c, m) => console.log((c ? 'OK   ' : 'FAIL ') + m)
const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('mind.db.v2')))
await page.goto(base); await page.getByText('Créer un compte').click()
await page.getByPlaceholder('Prénom').fill('Paul'); await page.getByPlaceholder('Email').fill('paul@test.fr'); await page.getByPlaceholder('Mot de passe').fill('secret12')
await page.getByRole('button', { name: 'Créer mon compte' }).click(); await page.waitForTimeout(600)
let guard = 0
while (guard++ < 40) {
  if (await page.getByRole('button', { name: 'Générer mon programme' }).count()) break
  const title = await page.locator('h1').first().innerText()
  if (/naissance/.test(title)) await page.locator('input[type=date]').fill('1990-05-10')
  if (/partie du corps/.test(title)) { await page.getByRole('button', { name: 'Jambes' }).click(); await page.screenshot({ path: '/tmp/shots/60-excl.png' }) }
  if (/Quel programme/.test(title)) await page.getByText('Musculation + course', { exact: true }).click()
  if (/date de ta course/.test(title)) await page.locator('input[type=date]').fill(new Date(Date.now() + 84 * 86400000).toISOString().slice(0, 10))
  if (/Quelle distance/.test(title)) await page.getByText('10 km', { exact: true }).first().click()
  if (/chronos de référence/.test(title)) {
    // 10 km en 52:30 puis 5 km en 24:10, avec le clavier numérique (pas de « : »)
    const rows = page.locator('.bg-surface.rounded-2xl.p-3\\.5')
    await rows.nth(1).getByLabel('Minutes').fill('52'); await rows.nth(1).getByLabel('Secondes').fill('30')
    await rows.nth(0).getByLabel('Minutes').fill('24'); await rows.nth(0).getByLabel('Secondes').fill('10')
    await page.waitForTimeout(300); await page.screenshot({ path: '/tmp/shots/61-refs.png' })
  }
  if (/objectif de course/.test(title)) {
    await page.getByText('Chrono cible').click()
    await page.getByLabel('Minutes').fill('45'); await page.getByLabel('Secondes').fill('0')
    await page.waitForTimeout(300); await page.screenshot({ path: '/tmp/shots/62-obj.png', fullPage: true })
  }
  await page.getByRole('button', { name: 'Continuer' }).click(); await page.waitForTimeout(300)
}
await page.getByRole('button', { name: 'Générer mon programme' }).click(); await page.waitForTimeout(1200)
const d = await db(); const me = d.profiles.find((p) => p.firstName === 'Paul')
const q = d.questionnaires.find((x) => x.clientId === me.id).data
ok(q.run.recents?.length === 2, 'deux chronos de référence enregistrés : ' + JSON.stringify(q.run.recents?.map((r) => [r.distance, r.seconds])))
ok(q.excludedMuscles?.includes('quadriceps'), 'jambes exclues')
const prog = d.programs.find((p) => p.clientId === me.id)
const legs = prog.weeks.flatMap((w) => w.sessions).flatMap((s) => s.exercises ?? []).filter((e) => /squat|presse|fente|rdl|souleve|leg_|hip_|mollets/.test(e.exerciseId))
ok(legs.length === 0, 'aucun exercice de jambes dans le programme')
console.log('avertissements:', prog.warnings.map((w) => w.code).join(', '))
console.log('ERRORS:', JSON.stringify(errors))
await browser.close()
