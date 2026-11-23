// Interface commune des sources d'activités de course. Deux implémentations :
//   - `garmin_personal` : clé personnelle (active) — voir personal.ts et handlers.ts ;
//   - `garmin` : accès officiel Starter (OAuth) — préparé, DÉSACTIVÉ tant que Garmin n'a pas répondu : starter.ts.
import type { ImportedRun, RunData } from './types.ts'

export interface RunProvider {
  id: 'garmin_personal' | 'garmin'
  /** Démarre la liaison (URL d'autorisation OAuth, ou test de la clé collée). */
  connect(userId: string, input?: unknown): Promise<{ redirectUrl?: string; ok?: boolean }>
  /** Retour d'autorisation (OAuth) : échange le code contre les jetons. Sans objet pour la clé personnelle. */
  callback?(params: Record<string, string>): Promise<{ userId: string }>
  disconnect(userId: string): Promise<void>
  /** Mode pull (clé personnelle) : va chercher ce qui est nouveau. */
  sync?(userId: string): Promise<ImportedRun[]>
  /** Mode push (Starter) : reçoit les activités envoyées par Garmin. */
  receive?(payload: unknown): Promise<ImportedRun[]>
  /** Transforme une activité brute du fournisseur en activité MIND. */
  parseActivity(payload: unknown): Promise<RunData & { externalId: string }>
}

import { handleLink, handleSync, type Deps } from './handlers.ts'
import { parseActivityList } from './personal.ts'

/** Clé personnelle (active) : s'appuie sur les handlers de liaison et de synchro. */
export function personalProvider(deps: Deps): RunProvider {
  return {
    id: 'garmin_personal',
    connect: async (userId, input) => {
      const r = await handleLink({ ...deps, userFromJwt: async () => ({ id: userId, role: 'client' }) }, 'internal', { action: 'link', ...(input as { apiKey: string; durationDays?: number }) })
      return { ok: r.status === 200 }
    },
    disconnect: async (userId) => { await deps.deleteIntegration(userId) },
    sync: async (userId) => { await handleSync({ ...deps, userFromJwt: async () => ({ id: userId, role: 'client' }) }, 'internal', 'manual'); return [] },
    parseActivity: async (payload) => {
      const ref = parseActivityList([payload])[0]
      if (!ref) throw new Error('Activité Garmin illisible.')
      throw new Error(`L'activité ${ref.id} se lit depuis son fichier .fit (fetchActivity).`)
    },
  }
}
