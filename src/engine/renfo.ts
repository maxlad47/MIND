// Renfo coureur : un circuit de 20 à 30 minutes (gainage, force, pliométrie, élastique), filtré par matériel et par zones
// contre-indiquées, qui suit les phases du plan de course ; ou 2 à 3 exercices de coureur ajoutés aux séances de muscu d'un programme mixte.
// TypeScript pur.

import { exerciseOf, isAllowed, LEVEL_RANK } from './exercises'
import { defaultGroup, normalizeGroups } from './formats'
import { estimateSessionMinutes } from './strength'
import type { ExerciseGroup, Level, Muscle, Phase, RenfoKit, Session, SessionExercise, SessionTemplate, TemplateExercise, Zone } from './types'
import { LOWER_MUSCLES } from './types'
import { diffDays, uid } from './utils'

export const KIT_LABEL: Record<RenfoKit, string> = {
  nu: 'À la maison, sans matériel', elastique: 'À la maison, avec élastique et haltères', salle: 'En salle',
}
const KIT_RANK: Record<RenfoKit, number> = { nu: 0, elastique: 1, salle: 2 }

/** Matériel minimal de chaque exercice utilisé par le renfo coureur. */
const KIT: Record<string, RenfoKit> = {
  copenhague: 'nu', planche_laterale: 'nu', planche: 'nu', dead_bug: 'nu', bird_dog: 'nu',
  fentes_arriere: 'nu', bulgare: 'nu', step_up: 'nu', fente_laterale: 'nu', chaise: 'nu', fentes_marchees: 'elastique',
  mollets_excentrique: 'nu', pont_unilateral: 'nu', nordic: 'nu',
  squat_jump: 'nu', bonds: 'nu', skipping: 'nu', pogo: 'nu', sauts_lateraux: 'nu',
  hip_thrust_halteres: 'elastique', mollets_fleche: 'elastique', pont_elastique: 'elastique',
  monster_walk: 'elastique', abduction_elastique: 'elastique', clamshell: 'elastique',
  hip_thrust_barre: 'salle',
}

/** Matériel minimal d'un exercice de renfo (les fentes, le bulgare et les montées de marche se font au poids du corps). */
export const renfoKitOf = (exerciseId: string): RenfoKit => KIT[exerciseId] ?? 'salle'
/** Exercice de la bibliothèque marqué « haltères » mais réalisé au poids du corps dans le renfo sans matériel. */
const bodyweightNote = (exerciseId: string, kit: RenfoKit): string | undefined =>
  kit === 'nu' && exerciseOf(exerciseId).equipment === 'halteres' ? 'Au poids du corps (des haltères en option).' : undefined

/** Cible de départ : répétitions (par côté pour un exercice unilatéral) ou secondes. */
const PRESC: Record<string, { reps?: number; seconds?: number }> = {
  copenhague: { seconds: 20 }, planche_laterale: { seconds: 25 }, planche: { seconds: 30 }, dead_bug: { reps: 8 }, bird_dog: { reps: 8 },
  fentes_arriere: { reps: 8 }, bulgare: { reps: 8 }, step_up: { reps: 10 }, fentes_marchees: { reps: 10 }, fente_laterale: { reps: 8 }, chaise: { seconds: 30 },
  mollets_excentrique: { reps: 10 }, pont_unilateral: { reps: 10 }, nordic: { reps: 4 },
  squat_jump: { reps: 8 }, bonds: { reps: 8 }, skipping: { seconds: 20 }, pogo: { reps: 20 }, sauts_lateraux: { reps: 10 },
  hip_thrust_halteres: { reps: 12 }, mollets_fleche: { reps: 12 }, pont_elastique: { reps: 12 },
  monster_walk: { reps: 10 }, abduction_elastique: { reps: 12 }, clamshell: { reps: 12 }, hip_thrust_barre: { reps: 10 },
}

type Slot = 'gainageA' | 'gainageB' | 'lunge' | 'calf' | 'glute' | 'elastique' | 'plyo'
const POOLS: Record<Slot, string[]> = {
  gainageA: ['copenhague', 'planche_laterale'],
  gainageB: ['planche', 'dead_bug', 'bird_dog'],
  lunge: ['fentes_arriere', 'bulgare', 'step_up', 'fentes_marchees', 'fente_laterale', 'chaise'],
  calf: ['mollets_excentrique', 'mollets_fleche'],
  glute: ['pont_unilateral', 'hip_thrust_halteres', 'pont_elastique', 'nordic'],
  elastique: ['monster_walk', 'abduction_elastique', 'clamshell'],
  plyo: ['skipping', 'squat_jump', 'pogo', 'bonds', 'sauts_lateraux'],
}
export const isPlyo = (exerciseId: string): boolean => exerciseOf(exerciseId).pattern === 'plyo'

// ------------------------------------------------------------------ règles de calendrier

/** Pas de pliométrie dans les 10 jours avant la course. */
export const PLYO_BLACKOUT_DAYS = 10
/** Pas de renfo dans les 3 derniers jours avant la course. */
export const RENFO_BLACKOUT_DAYS = 3

export const plyoAllowed = (daysToRace?: number): boolean => daysToRace === undefined || daysToRace > PLYO_BLACKOUT_DAYS
export const renfoAllowed = (daysToRace?: number): boolean => daysToRace === undefined || daysToRace > RENFO_BLACKOUT_DAYS
export const daysBeforeRace = (date: string, raceDate?: string): number | undefined => (raceDate ? diffDays(date, raceDate) : undefined)

// ------------------------------------------------------------------ circuit

export interface RenfoCtx {
  kit: RenfoKit
  level: Level
  injuries: Zone[]
  phase: Phase
  /** Rang de la semaine dans le plan (1 = première). Pilote la progression, une marche toutes les 2 semaines. */
  weekN: number
  light: boolean
  /** Jours entre la séance et la course ; inconnu = pas de contrainte. */
  daysToRace?: number
  excluded?: Muscle[]
}

const usable = (id: string, c: Pick<RenfoCtx, 'kit' | 'level' | 'injuries' | 'excluded'>): boolean => {
  const ex = exerciseOf(id)
  return KIT_RANK[KIT[id] ?? 'salle'] <= KIT_RANK[c.kit] && isAllowed(ex, c.injuries) && LEVEL_RANK[ex.level] <= LEVEL_RANK[c.level] && !(c.excluded ?? []).includes(ex.muscle)
}

/** Choisit un exercice du pool en tournant d'une semaine à l'autre. */
function pickFrom(slot: Slot, c: RenfoCtx, taken: Set<string>, rot: number): string | undefined {
  let pool = POOLS[slot]
  if (slot === 'glute' && c.kit === 'salle') pool = ['hip_thrust_barre', ...pool]
  const ok = pool.filter((id) => !taken.has(id) && usable(id, c))
  if (!ok.length) return undefined
  return ok[rot % ok.length]
}

/** Marche de progression : une toutes les 2 semaines. Impaire = +1 tour ; paire = reps et durée en hausse. */
export const progressStep = (weekN: number): number => Math.floor((Math.max(1, weekN) - 1) / 2)

/** Les créneaux du circuit selon la phase. */
function slotsFor(c: RenfoCtx, plyo: boolean): Slot[] {
  const filler: Slot = c.kit === 'nu' ? 'gainageB' : 'elastique'
  const step = progressStep(c.weekN)
  switch (c.phase) {
    case 'Développement': return plyo ? ['gainageA', 'lunge', 'calf', 'glute', 'plyo', step >= 2 ? 'plyo' : filler] : ['gainageA', 'lunge', 'calf', 'glute', filler, 'gainageB']
    case 'Spécifique': return plyo ? ['gainageA', 'lunge', 'calf', 'plyo', 'glute', 'gainageB'] : ['gainageA', 'lunge', 'calf', 'glute', 'gainageB', filler]
    case 'Affûtage': return plyo ? ['gainageA', 'lunge', 'calf', 'plyo', 'glute'] : ['gainageA', 'lunge', 'calf', 'glute', 'gainageB']
    default: return ['gainageA', 'lunge', 'calf', 'glute', filler] // Base (et tout autre phase) : gainage et force
  }
}

/** Nombre de tours : base 2, +1 tour toutes les 4 semaines (marches impaires), plafond 4 ; entretien en moins ; affûtage divisé par deux ; semaine allégée −1. */
function roundsFor(c: RenfoCtx): number {
  const step = progressStep(c.weekN)
  const prog = Math.min(4, 2 + Math.floor((step + 1) / 2))
  let r = prog
  if (c.phase === 'Spécifique') r = 2 // entretien : moins de tours
  if (c.phase === 'Affûtage') r = Math.max(1, Math.floor(prog / 2)) // volume divisé par deux
  else if (c.light) r = Math.max(1, r - 1)
  return r
}

const WORK_SETUP_SEC = 8
const REST_BETWEEN = 15
const REST_AFTER_ROUND = 30
export const RENFO_WARMUP = 'Échauffement · 5 min de mobilité : cercles de chevilles et de hanches, balancés de jambes, squats sans charge, montées de genoux lentes.'

/** Durée d'un circuit de renfo (échauffement de 5 min compris), en minutes. */
export function renfoMinutes(exs: { exerciseId: string; repMin: number }[], rounds: number): number {
  const work = exs.reduce((a, e) => {
    const ex = exerciseOf(e.exerciseId)
    const side = ex.perSide ? 2 : 1
    const one = ex.unit === 'sec' ? e.repMin : e.repMin * 2.5
    return a + one * side + WORK_SETUP_SEC
  }, 0)
  const round = work + (exs.length - 1) * REST_BETWEEN + REST_AFTER_ROUND
  return 5 + Math.round((rounds * round) / 60)
}

/**
 * Séance de renfo coureur. `null` si la date tombe dans les 3 derniers jours avant la course.
 * Aucune pliométrie dans les 10 jours avant la course. Durée visée : 20 à 30 minutes (l'affûtage et les semaines allégées peuvent être plus courtes).
 */
export function buildRenfoSession(c: RenfoCtx): Session | null {
  if (!renfoAllowed(c.daysToRace)) return null
  const plyo = plyoAllowed(c.daysToRace)
  const step = progressStep(c.weekN)
  const bump = Math.floor(step / 2)
  const taken = new Set<string>()
  const ids: string[] = []
  slotsFor(c, plyo).forEach((slot, i) => {
    const rot = slot === 'gainageA' || slot === 'lunge' ? c.weekN : slot === 'plyo' ? c.weekN + i : Math.floor(c.weekN / 2) + i
    const id = pickFrom(slot, c, taken, rot) ?? (slot === 'plyo' ? undefined : pickFrom('gainageB', c, taken, rot))
    if (id) { taken.add(id); ids.push(id) }
  })
  let rounds = roundsFor(c)
  const target = (id: string): number => {
    const p = PRESC[id] ?? { reps: 10 }
    const ex = exerciseOf(id)
    if (ex.unit === 'sec') return Math.min((p.seconds ?? 30) + 20, (p.seconds ?? 30) + 10 * bump)
    return Math.min((p.reps ?? 10) + 4, (p.reps ?? 10) + 2 * bump)
  }
  const build = () => ids.map((id) => ({ exerciseId: id, repMin: target(id) }))
  // 20 à 30 minutes : trop long, on retire des tours puis un exercice ; trop court, on ajoute un tour (hors affûtage et semaine allégée)
  let guard = 0
  while (renfoMinutes(build(), rounds) > 30 && guard++ < 20) {
    if (rounds > 2) rounds -= 1
    else if (ids.length > 4) ids.pop()
    else break
  }
  while (!c.light && c.phase !== 'Affûtage' && c.phase !== 'Spécifique' && renfoMinutes(build(), rounds) < 20 && rounds < 4 && guard++ < 40) rounds += 1

  const sid = uid('s')
  const exercises: SessionExercise[] = ids.map((id, i) => {
    const t = target(id)
    const note = bodyweightNote(id, c.kit)
    return { id: `${sid}.e${i}`, exerciseId: id, order: i, sets: rounds, repMin: t, repMax: t, rir: 3, noRir: true, restSec: REST_AFTER_ROUND, logs: [], renfo: true, ...(note ? { note } : {}) }
  })
  const group: ExerciseGroup = { ...defaultGroup('circuit', exercises.map((e) => e.id), `${sid}.g`), rounds, restBetweenSec: REST_BETWEEN, restAfterRoundSec: REST_AFTER_ROUND }
  return {
    id: sid, weekN: c.weekN, date: '', sport: 'muscu', kind: 'renfo', title: 'Renfo coureur', status: 'prevue',
    estMinutes: renfoMinutes(build(), rounds), exercises, groups: [group], warmup: RENFO_WARMUP,
    note: c.phase === 'Affûtage' ? 'Affûtage : volume divisé par deux, aucune pliométrie à l\'approche de la course.' : undefined,
  }
}

// ------------------------------------------------------------------ séances modèles toutes faites (mode libre)

/** Deux modèles « Renfo coureur » pour le carnet libre : sans matériel, et avec élastique. */
export function renfoTemplates(): SessionTemplate[] {
  const mk = (name: string, kit: RenfoKit): SessionTemplate => {
    const s = buildRenfoSession({ kit, level: 'intermediaire', injuries: [], phase: 'Développement', weekN: 3, light: false })!
    const ids = new Map(s.exercises!.map((e) => [e.id, uid('te')]))
    const exercises: TemplateExercise[] = s.exercises!.map((e) => ({ id: ids.get(e.id)!, exerciseId: e.exerciseId, sets: e.sets, repMin: e.repMin, repMax: e.repMax, restSec: e.restSec, ...(e.note ? { note: e.note } : {}) }))
    const g = s.groups![0]
    return { id: uid('tpl'), name, exercises, groups: [{ id: uid('g'), kind: g.kind, exerciseIds: g.exerciseIds.map((x) => ids.get(x)!), rounds: g.rounds, restBetweenSec: g.restBetweenSec, restAfterRoundSec: g.restAfterRoundSec }] }
  }
  return [mk('Renfo coureur · sans matériel', 'nu'), mk('Renfo coureur · avec élastique', 'elastique')]
}

// ------------------------------------------------------------------ compléments dans les séances de muscu (programme mixte)

export interface ExtrasCtx {
  kit: RenfoKit
  perWeek: 1 | 2
  level: Level
  injuries: Zone[]
  maxMinutes: number
  weekN: number
  light: boolean
  excluded?: Muscle[]
}

const legSetsOf = (exs: SessionExercise[]): number =>
  exs.filter((e) => LOWER_MUSCLES.includes(exerciseOf(e.exerciseId).muscle) && exerciseOf(e.exerciseId).muscle !== 'mollets').reduce((a, e) => a + e.sets, 0)

const isUnilateral = (e: SessionExercise): boolean => { const ex = exerciseOf(e.exerciseId); return !!ex.perSide && ex.pattern !== 'core' && ex.pattern !== 'curl' && ex.pattern !== 'pull_h' && ex.pattern !== 'pull_v' }

/** Retire les compléments de coureur d'une séance de muscu (ex. séance à moins de 3 jours de la course). */
export function stripRunnerExtras(s: Session): void {
  if (!s.exercises?.some((e) => e.renfo)) return
  s.exercises = s.exercises.filter((e) => !e.renfo)
  normalizeGroups(s)
  s.estMinutes = estimateSessionMinutes(s.exercises, s.groups)
  s.legLoad = legSetsOf(s.exercises) >= 6 ? 'heavy' : legSetsOf(s.exercises) >= 3 ? 'light' : 'none'
}

/**
 * Programme mixte : pas de séance de renfo à part. MIND ajoute 2 ou 3 exercices de coureur à la fin de `perWeek` séances de muscu
 * (de préférence bas du corps, puis full body) : mollets en excentrique, gainage latéral ou Copenhague, et un exercice unilatéral
 * si la séance n'en a pas. Jamais au-delà de `maxMinutes`.
 */
export function addRunnerExtras(sessions: Session[], c: ExtrasCtx): void {
  const rank = (s: Session) => (s.kind === 'bas' || s.kind === 'jambes' ? 0 : s.kind === 'fullbody' ? 1 : 2)
  const targets = sessions.filter((s) => s.sport === 'muscu' && s.kind !== 'renfo' && s.exercises?.length).sort((a, b) => rank(a) - rank(b)).slice(0, c.perWeek)
  const rctx: RenfoCtx = { kit: c.kit, level: c.level, injuries: c.injuries, phase: 'Base', weekN: c.weekN, light: c.light, excluded: c.excluded }
  targets.forEach((s, ti) => {
    const have = new Set(s.exercises!.map((e) => e.exerciseId))
    const wanted: string[] = []
    const calf = pickFrom('calf', rctx, have, c.weekN + ti)
    if (calf) wanted.push(calf)
    const side = pickFrom('gainageA', rctx, have, c.weekN + ti)
    if (side) wanted.push(side)
    if (!s.exercises!.some(isUnilateral)) {
      const uni = pickFrom('lunge', { ...rctx, level: c.level }, new Set([...have, 'chaise']), c.weekN + ti)
      if (uni) wanted.push(uni)
    }
    const sets = c.light ? 1 : c.weekN > 4 ? 3 : 2
    for (const id of wanted.slice(0, 3)) {
      const ex = exerciseOf(id)
      const p = PRESC[id] ?? { reps: 10 }
      const t = ex.unit === 'sec' ? (p.seconds ?? 30) : (p.reps ?? 10)
      const note = bodyweightNote(id, c.kit)
      const e: SessionExercise = { id: uid('se'), exerciseId: id, order: s.exercises!.length, sets, repMin: t, repMax: t, rir: 3, noRir: true, restSec: 45, logs: [], renfo: true, ...(note ? { note } : {}) }
      const next = [...s.exercises!, e]
      if (estimateSessionMinutes(next, s.groups) > c.maxMinutes) break
      s.exercises = next
    }
    s.estMinutes = estimateSessionMinutes(s.exercises!, s.groups)
    const legs = legSetsOf(s.exercises!)
    s.legLoad = legs >= 6 ? 'heavy' : legs >= 3 ? 'light' : 'none'
  })
}
