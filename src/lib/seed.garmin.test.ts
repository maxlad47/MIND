// Démo : les sorties importées de Léa (EF trop intense, fractionné à compléter, sortie longue au départ rapide, sortie en plus, pas et sommeil).
import { describe, expect, it, vi } from 'vitest'

async function seeded() {
  vi.resetModules()
  const mem = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) })
  vi.doMock('./supabase', () => ({ supabase: null, REMOTE: false }))
  const seed = await import('./seed')
  const runs = await import('@/engine/runs')
  const adapt = await import('@/engine/adapt')
  return { db: seed.buildSeed(), runs, adapt }
}

describe('démo Garmin de Léa', () => {
  it('quatre sorties importées, une seule « à compléter », pas et sommeil', async () => {
    const { db, runs, adapt } = await seeded()
    const lea = db.profiles.find((p) => p.email === 'lea@demo.mind')!
    const prog = db.programs.find((p) => p.clientId === lea.id)!
    const mine = db.importedRuns.filter((r) => r.clientId === lea.id)
    expect(mine.map((r) => r.externalId).sort()).toEqual(['garmin:seed-ef', 'garmin:seed-en-plus', 'garmin:seed-fractionne', 'garmin:seed-longue'])
    expect(mine.every((r) => r.status === 'rattachee' && r.splits !== undefined || r.laps !== undefined)).toBe(true)
    const sessions = adapt.allSessions(prog)
    expect(sessions.filter(runs.needsReview)).toHaveLength(1)
    expect(sessions.filter(runs.needsReview)[0].runLog!.importedRunId).toBe('ir-garmin-seed-fractionne')
    expect(sessions.some((s) => s.id === runs.extraIdOf('ir-garmin-seed-en-plus') && s.extra && s.status === 'faite')).toBe(true)
    expect(db.health.filter((h) => h.clientId === lea.id).length).toBeGreaterThan(80)
    expect(db.health.filter((h) => h.clientId === lea.id).every((h) => !h.sleepPhases || h.sleepPhases.lightMin! > 0)).toBe(true)
  })
  it('l\'EF déclenche « endurance trop intense » ; la longue « départ trop rapide » ; le fractionné a des tours de travail', async () => {
    const { db, runs, adapt } = await seeded()
    const lea = db.profiles.find((p) => p.email === 'lea@demo.mind')!
    const prog = db.programs.find((p) => p.clientId === lea.id)!
    const byId = (id: string) => db.importedRuns.find((r) => r.id === id)!
    const sess = (id: string) => adapt.allSessions(prog).find((s) => s.runLog?.importedRunId === id)!
    const maxHr = runs.resolveMaxHr({ runs: db.importedRuns.filter((r) => r.clientId === lea.id), birthDate: '1992-06-18', today: new Date().toISOString().slice(0, 10) })
    expect(runs.enduranceTooIntense(byId('ir-garmin-seed-ef'), sess('ir-garmin-seed-ef'), maxHr.value)).toBeDefined()
    const longue = sess('ir-garmin-seed-longue')
    expect(runs.splitsSummary(byId('ir-garmin-seed-longue').splits, runs.targetPaceOf(longue))).toMatch(/^Départ trop rapide/)
    const frac = sess('ir-garmin-seed-fractionne')
    const wl = runs.workLaps(byId('ir-garmin-seed-fractionne').laps, frac)
    expect(wl.length).toBeGreaterThanOrEqual(4)
    expect(wl.some((w) => w.slow)).toBe(true)
    expect(runs.preAnswer(byId('ir-garmin-seed-fractionne'), frac)!.respected).toBe('partiel')
  })
})
