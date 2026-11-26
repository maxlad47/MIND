// Minuteur de repos : calculé depuis un horodatage de fin (juste après un verrouillage d'écran), ajustable, persistant.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isStale, makeTimer, remainingSec, shiftTimer, STALE_MS } from './rest'

describe('minuteur : calcul depuis l\'horodatage', () => {
  it('le temps restant se déduit de l\'heure de fin, pas d\'un compteur', () => {
    const t = makeTimer(90, 'Repos', 1_000_000)
    expect(t.endAt).toBe(1_090_000)
    expect(remainingSec(t, 1_000_000)).toBe(90)
    expect(remainingSec(t, 1_030_500)).toBe(60) // arrondi au-dessus
    // l'iPhone a verrouillé l'écran 80 s : au retour, le temps restant est juste
    expect(remainingSec(t, 1_080_000)).toBe(10)
    expect(remainingSec(t, 1_090_000)).toBe(0)
    expect(remainingSec(t, 5_000_000)).toBe(0) // jamais négatif
  })
  it('−15 s et +15 s', () => {
    const t = makeTimer(60, 'Repos', 0)
    expect(remainingSec(shiftTimer(t, 15, 20_000), 20_000)).toBe(55) // 40 restantes + 15
    expect(remainingSec(shiftTimer(t, -15, 20_000), 20_000)).toBe(25)
    expect(remainingSec(shiftTimer(t, -15, 55_000), 55_000)).toBe(0) // ne descend pas sous 0
    expect(shiftTimer(t, 15, 20_000).totalSec).toBe(75)
  })
  it('un repos terminé depuis longtemps n\'est pas réaffiché', () => {
    const t = makeTimer(30, 'Repos', 0)
    expect(isStale(t, 30_000 + 60_000)).toBe(false)
    expect(isStale(t, 30_000 + STALE_MS + 1)).toBe(true)
  })
})

describe('minuteur : état persistant', () => {
  let r: typeof import('./rest')
  const mem = new Map<string, string>()
  beforeEach(async () => {
    vi.resetModules()
    mem.clear()
    vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) })
    r = await import('./rest')
  })

  it('démarre avec le bon repos et survit à un rechargement de la page', async () => {
    const now = Date.now()
    r.startRest(120, 'Repos entre les tours', now)
    expect(r.getRestTimer()).toMatchObject({ totalSec: 120, label: 'Repos entre les tours' })
    expect(r.remainingSec(r.getRestTimer()!, now + 20_000)).toBe(100)
    // rechargement : le module est réimporté, l'état revient du stockage
    vi.resetModules()
    const again = await import('./rest')
    expect(again.getRestTimer()?.endAt).toBe(now + 120_000)
  })
  it('un repos de 0 s ne lance rien ; « Passer » l\'arrête', () => {
    r.startRest(0, 'x')
    expect(r.getRestTimer()).toBeNull()
    r.startRest(30, 'Repos')
    r.skipRest()
    expect(r.getRestTimer()).toBeNull()
    expect(mem.has('mind.rest.v1')).toBe(false)
  })
  it('la fin du repos n\'est signalée qu\'une fois', () => {
    r.startRest(1, 'Repos', Date.now() - 5000)
    expect(r.markRestFired()).toBe(true)
    expect(r.markRestFired()).toBe(false)
  })
  it('un signal « Enchaîne » ne lance pas de minuteur', () => {
    r.signalChain('Enchaîne B2')
    expect(r.getChain()?.label).toBe('Enchaîne B2')
    expect(r.getRestTimer()).toBeNull()
    r.clearChain()
    expect(r.getChain()).toBeNull()
  })
  it('minuteur automatique coupé par défaut ; le couper arrête le repos en cours', () => {
    expect(r.restAutoOn()).toBe(false)
    r.setRestAuto(true)
    expect(r.restAutoOn()).toBe(true)
    r.startRest(60, 'Repos')
    r.setRestAuto(false)
    expect(r.restAutoOn()).toBe(false)
    expect(r.getRestTimer()).toBeNull()
  })
  it('le son se coupe dans le Profil et le réglage reste', () => {
    expect(r.restSoundOn()).toBe(true)
    r.setRestSound(false)
    expect(r.restSoundOn()).toBe(false)
    r.setRestSound(true)
    expect(r.restSoundOn()).toBe(true)
  })
})
