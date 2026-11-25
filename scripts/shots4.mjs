// Thème 1 / thème 2 + tenue sur l'écran : node scripts/shots4.mjs [dark|light]
import { chromium } from 'playwright-core'
const base = process.env.BASE ?? 'http://localhost:5180'
const scheme = process.argv[2] ?? 'dark'
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const fit = async (page, name) => {
  await page.waitForTimeout(600)
  const [sh, ih] = await page.evaluate(() => [document.documentElement.scrollHeight, window.innerHeight])
  console.log(`${sh <= ih + 1 ? 'OK   ' : 'LONG '} ${name} (${sh}/${ih})`)
}
for (const [w, h] of [[390, 844], [375, 667]]) {
  for (const look of ['t1', 't2']) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, colorScheme: scheme, isMobile: true, hasTouch: true })
    const page = await ctx.newPage()
    await page.addInitScript((l) => { try { localStorage.setItem('mind.look', l); sessionStorage.setItem('mind.splash', '1') } catch {} }, look)
    const tag = `${look}-${w}`
    await page.goto(base); await page.waitForTimeout(700)
    await fit(page, `login ${tag}`); await page.screenshot({ path: `/tmp/shots/d/${scheme}-${tag}-login.png` })
    if (w === 390) {
      await page.getByText('Camille').first().click(); await page.waitForTimeout(900)
      await page.screenshot({ path: `/tmp/shots/d/${scheme}-${tag}-today.png` })
      await page.goto(base + '/#/app/program'); await page.waitForTimeout(800); await page.screenshot({ path: `/tmp/shots/d/${scheme}-${tag}-program.png` })
      await page.goto(base + '/#/app/profile'); await page.waitForTimeout(800); await page.evaluate(() => window.scrollTo(0, 560)); await page.waitForTimeout(300); await page.screenshot({ path: `/tmp/shots/d/${scheme}-${tag}-profile.png` })
      const d = await page.evaluate(() => JSON.parse(localStorage.getItem('mind.db.v2')))
      const cam = d.profiles.find((p) => p.firstName === 'Camille'); const prog = d.programs.find((p) => p.clientId === cam.id)
      const s = prog.weeks.flatMap((x) => x.sessions).find((x) => x.sport === 'muscu' && x.status === 'prevue')
      await page.goto(base + '/#/session/' + s.id); await page.waitForTimeout(800); await page.screenshot({ path: `/tmp/shots/d/${scheme}-${tag}-session.png` })
    }
    // onboarding : un nouveau compte, on mesure chaque étape
    await page.evaluate(() => { const x = JSON.parse(localStorage.getItem('mind.db.v2')); if (x) { x.sessionUserId = null; localStorage.setItem('mind.db.v2', JSON.stringify(x)) } })
    await page.goto(base); await page.waitForTimeout(500); await page.getByText('Créer un compte').click()
    await page.getByPlaceholder('Prénom').fill('Max'); await page.getByPlaceholder('Email').fill(`m${Date.now()}@t.fr`); await page.getByPlaceholder('Mot de passe').fill('secret12')
    await page.getByRole('button', { name: 'Créer mon compte' }).click(); await page.waitForTimeout(800)
    let i = 0
    while (i++ < 24) {
      if (await page.getByRole('button', { name: 'Générer mon programme' }).count()) break
      const title = await page.locator('h1').first().innerText()
      if (/naissance/.test(title)) await page.locator('input[type=date]').fill('1990-05-10')
      if (/Quel programme/.test(title)) await page.getByText('Musculation + course', { exact: true }).click()
      if (/date de ta course/.test(title)) await page.locator('input[type=date]').fill(new Date(Date.now() + 98 * 86400000).toISOString().slice(0, 10))
      if (/Quelle distance/.test(title)) await page.getByText('Semi-marathon').click()
      if (/objectif de course/.test(title)) { await page.getByText('Chrono cible').click(); await page.getByLabel('Minutes').fill('50'); await page.getByLabel('Secondes').fill('0') }
      await fit(page, `onb ${tag} #${i} ${title.slice(0, 32)}`)
      if (i === 1 || i === 6) await page.screenshot({ path: `/tmp/shots/d/${scheme}-${tag}-onb${i}.png` })
      if (/chronos de référence/.test(title)) { await page.getByLabel('Minutes').nth(1).fill('52'); await page.getByLabel('Secondes').nth(1).fill('30') }
      await page.getByRole('button', { name: 'Continuer' }).click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(300)
    }
    await ctx.close()
  }
}
await browser.close()
