// Le coach supprime un client : compte et données effacés, les autres clients et le coach ne bougent pas.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { P_MARATHON } from '@/engine/fixtures'

const MON = '2026-01-05'

async function fresh() {
  vi.resetModules()
  const mem = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) })
  vi.doMock('./supabase', () => ({ supabase: null, REMOTE: false }))
  return import('./store')
}

describe('supprimer un client', () => {
  let s: Awaited<ReturnType<typeof fresh>>
  beforeEach(async () => { s = await fresh() })

  function setup() {
    s.signUp('lea@test.fr', 'secret1', 'Léa')
    const lea = s.currentUser()!
    s.submitQuestionnaire(lea.id, { ...P_MARATHON, firstName: 'Léa', startDate: MON }, MON)
    s.signUp('tom@test.fr', 'secret1', 'Tom')
    const tom = s.currentUser()!
    s.submitQuestionnaire(tom.id, { ...P_MARATHON, firstName: 'Tom', startDate: MON }, MON)
    s.mutate((d) => {
      d.profiles.push({ id: 'coach-1', role: 'coach', firstName: 'Max', email: 'coach@mind.app', reminderTime: '18:00', theme: 'auto', notifications: false, createdAt: '', onboarded: true })
      s.notify(d, 'coach-1', 'Douleur signalée', 'Léa a mal', `/coach/client/${lea.id}`)
      s.notify(d, 'coach-1', 'Douleur signalée', 'Tom a mal', `/coach/client/${tom.id}`)
      s.notify(d, lea.id, 'Analyse', 'ta semaine', '/app/today')
      d.sessionUserId = 'coach-1'
    })
    return { lea, tom }
  }

  it('efface le compte, le programme, le formulaire et les notifications liées', () => {
    const { lea, tom } = setup()
    expect(s.deleteClientLocal(lea.id)).toBe(true)
    const d = s.getDB()
    expect(d.profiles.map((p) => p.id)).toEqual([tom.id, 'coach-1'])
    expect(d.users.some((u) => u.id === lea.id)).toBe(false)
    expect(d.programs.every((p) => p.clientId === tom.id)).toBe(true)
    expect(d.questionnaires.every((q) => q.clientId === tom.id)).toBe(true)
    expect(d.notifications.map((n) => n.body)).toEqual(['Tom a mal'])
    expect(s.signIn('lea@test.fr', 'secret1').ok).toBe(false)
  })

  it('refuse un compte coach, et refuse si ce n’est pas le coach qui le demande', () => {
    const { lea, tom } = setup()
    expect(s.deleteClientLocal('coach-1')).toBe(false)
    s.mutate((d) => { d.sessionUserId = tom.id })
    expect(s.deleteClientLocal(lea.id)).toBe(false)
    expect(s.getDB().profiles).toHaveLength(3)
  })
})
