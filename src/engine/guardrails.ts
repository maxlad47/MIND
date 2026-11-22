// Garde-fous absolus : ni l'IA ni une modification automatique ne doivent les dépasser.
// Ce module est importé à la fois par le front et par les Edge Functions.

import { EXERCISE_BY_ID, isAllowed } from './exercises'
import type { Level, Program, Zone } from './types'

/** Séries directes max par muscle et par semaine, selon le niveau. */
export const MAX_WEEKLY_SETS: Record<Level, number> = { debutant: 12, intermediaire: 18, avance: 22 }
/** Augmentation de charge maximale d'une séance à l'autre. */
export const MAX_LOAD_JUMP_PCT = 0.1
export const MAX_RUN_VOLUME_JUMP = 1.1
export const MAX_LONG_RUN_KM = { '10k': 16, semi: 21, marathon: 32 } as const
export const MAX_LONG_RUN_MINUTES = 180

export interface GuardrailViolation { sessionId: string; message: string }

/** Vérifie un programme : contre-indications, volumes, sorties longues. */
export function checkProgram(p: Program, injuries: Zone[]): GuardrailViolation[] {
  const out: GuardrailViolation[] = []
  const limit = MAX_WEEKLY_SETS[p.q.strength.level]
  for (const w of p.weeks) {
    const sets: Record<string, number> = {}
    for (const s of w.sessions) {
      for (const e of s.exercises ?? []) {
        const ex = EXERCISE_BY_ID[e.exerciseId]
        if (!ex) {
          out.push({ sessionId: s.id, message: `Exercice inconnu ${e.exerciseId}` })
          continue
        }
        if (!isAllowed(ex, injuries)) out.push({ sessionId: s.id, message: `${ex.name} est contre-indiqué` })
        sets[ex.muscle] = (sets[ex.muscle] ?? 0) + e.sets
      }
      if (s.kind === 'longue' && p.raceDistance && s.run && s.run.totalKm > MAX_LONG_RUN_KM[p.raceDistance] + 0.5) {
        out.push({ sessionId: s.id, message: 'Sortie longue au-dessus du maximum' })
      }
    }
    for (const [m, n] of Object.entries(sets)) {
      if (n > limit) out.push({ sessionId: w.sessions[0]?.id ?? '', message: `Volume ${m} trop élevé en semaine ${w.n} (${n} séries)` })
    }
  }
  return out
}

/** Borne une proposition de charge : jamais plus de +10 % (ou +5 kg) d'un coup. */
export function capLoad(previous: number | undefined, proposed: number): number {
  if (!previous) return proposed
  const max = Math.max(previous * (1 + MAX_LOAD_JUMP_PCT), previous + 2.5)
  return Math.min(proposed, max)
}
