// Moteur de course : allures, durée de préparation, phases, volumes, séances détaillées.

import type {
  Level, Paces, Phase, PlanWarning, Questionnaire, RaceDistance, RecentDistance, RunBlock, RunKind, RunPlan, Session,
} from './types'
import { MAX_LONG_RUN_KM, MAX_RUN_VOLUME_JUMP } from './guardrails'
import { clamp, fmtPace, fmtTime, round, uid } from './utils'

export const DIST_KM: Record<RaceDistance | RecentDistance, number> = { '5k': 5, '10k': 10, semi: 21.0975, marathon: 42.195 }
export const DIST_LABEL: Record<RaceDistance, string> = { '10k': '10 km', semi: 'Semi-marathon', marathon: 'Marathon' }

// ------------------------------------------------------------------ allures

/** Prédiction de Riegel : temps sur une autre distance. */
export function riegel(seconds: number, fromKm: number, toKm: number): number {
  return seconds * Math.pow(toKm / fromKm, 1.06)
}

/** VMA estimée depuis un chrono récent (allure 10 km ≈ 90 % de la VMA). */
export function vmaFromRecent(distance: RecentDistance, seconds: number): number {
  const t10 = riegel(seconds, DIST_KM[distance], 10)
  const speed10 = 10 / (t10 / 3600)
  return Math.round((speed10 / 0.9) * 10) / 10
}

const DEFAULT_VMA: Record<Level, number> = { debutant: 11.5, intermediaire: 13.5, avance: 16 }

/** Secondes par km pour un % de VMA. */
export function paceAt(vma: number, pct: number): number {
  return 3600 / (vma * pct)
}

export function computePaces(vma: number, source: Paces['source']): Paces {
  return {
    vma, source,
    recup: paceAt(vma, 0.625),
    ef: paceAt(vma, 0.7),
    marathon: paceAt(vma, 0.8),
    semi: paceAt(vma, 0.85),
    seuil: paceAt(vma, 0.865),
    dix: paceAt(vma, 0.9),
    vmaPace: paceAt(vma, 1),
  }
}

export interface Reference { distance: RecentDistance; seconds: number; date: string }

/** Tous les chronos de référence fournis (nouveau format + ancien champ `recent`). */
export function referencesOf(q: Questionnaire['run']): Reference[] {
  const list: Reference[] = [...(q.recents ?? [])]
  if (q.recent && !list.some((r) => r.distance === q.recent!.distance)) list.push(q.recent)
  return list.filter((r) => r.seconds > 0)
}

/** VMA moyenne des chronos fournis, pondérée : un chrono proche de la distance visée compte davantage. */
export function vmaFromReferences(refs: Reference[], target: RaceDistance): number {
  let sum = 0
  let wsum = 0
  for (const r of refs) {
    const w = 1 / (1 + 2 * Math.abs(Math.log(DIST_KM[r.distance] / DIST_KM[target])))
    sum += vmaFromRecent(r.distance, r.seconds) * w
    wsum += w
  }
  return Math.round((sum / wsum) * 10) / 10
}

export function pacesFromQuestionnaire(q: Questionnaire['run']): Paces {
  if (q.vma && q.vma > 6) return computePaces(q.vma, 'vma')
  const refs = referencesOf(q)
  if (refs.length) return computePaces(vmaFromReferences(refs, q.distance), 'chrono')
  return computePaces(DEFAULT_VMA[q.level], 'niveau')
}

/** VMA estimée via un test de 6 minutes (distance en mètres). */
export function vmaFromTest6(meters: number): number {
  return Math.round((meters / 6 / 1000) * 60 * 10) / 10 // km/h sur 6 min ≈ VMA
}

/** Chrono prédit pour la distance de course à partir de la VMA actuelle. */
export function predictRaceSeconds(vma: number, distance: RaceDistance): number {
  const t10 = 10 / (vma * 0.9) * 3600
  return riegel(t10, 10, DIST_KM[distance])
}

// ------------------------------------------------------------------ préparation

export const PREP: Record<RaceDistance, { min: number; idealMin: number; idealMax: number }> = {
  '10k': { min: 6, idealMin: 8, idealMax: 10 },
  semi: { min: 8, idealMin: 10, idealMax: 12 },
  marathon: { min: 12, idealMin: 16, idealMax: 18 },
}

const TAPER: Record<RaceDistance, (n: number) => number> = {
  '10k': () => 1,
  semi: (n) => (n >= 10 ? 2 : 1),
  marathon: (n) => (n >= 14 ? 3 : 2),
}

export interface PhasePlan { phase: Phase; n: number }

/** Découpe N semaines en phases Base → Développement → Spécifique → Affûtage. */
export function phasePlan(distance: RaceDistance, weeks: number): Phase[] {
  const p = PREP[distance]
  const taper = Math.min(TAPER[distance](weeks), Math.max(1, weeks - 1))
  const base = weeks > p.idealMax ? weeks - p.idealMax : 0
  const core = weeks - base - taper
  const dev = Math.round(core * 0.5)
  const spec = core - dev
  return [
    ...Array<Phase>(base).fill('Base'),
    ...Array<Phase>(dev).fill('Développement'),
    ...Array<Phase>(Math.max(0, spec)).fill('Spécifique'),
    ...Array<Phase>(taper).fill('Affûtage'),
  ].slice(0, weeks)
}

export type Verdict = 'realiste' | 'ambitieux' | 'irrealiste'

export interface Assessment {
  predicted: number // chrono prédit aujourd'hui (s)
  gain: number // gain demandé, en fraction du chrono prédit (négatif = objectif plus lent que la prédiction)
  allowed: number // gain jugé réaliste sur la durée de préparation
  verdict: Verdict
  realistic: number // chrono réaliste proposé
  basis: Paces['source']
  basisText: string
}

/** Marge de progression jugée réaliste : 1,5 % + 0,4 % par semaine de préparation, entre 2 et 8 %. */
export function allowedGain(weeks: number): number {
  return clamp(0.015 + weeks * 0.004, 0.02, 0.08)
}

export function basisText(q: Questionnaire['run'], paces: Paces): string {
  if (paces.source === 'vma') return `ta VMA de ${String(paces.vma).replace('.', ',')} km/h`
  if (paces.source === 'chrono') {
    const refs = referencesOf(q)
    const names: Record<RecentDistance, string> = { '5k': '5 km', '10k': '10 km', semi: 'semi', marathon: 'marathon' }
    return `${refs.length > 1 ? 'tes chronos' : 'ton chrono'} (${refs.map((r) => `${names[r.distance]} en ${fmtTime(r.seconds)}`).join(', ')})`
  }
  return 'ton niveau déclaré (aucun chrono ni VMA renseigné : estimation peu fiable)'
}

/** Compare le chrono visé au chrono prédit. Méthode : VMA → allure 10 km ≈ 90 % de la VMA → Riegel pour les autres distances. */
export function assessTarget(q: Questionnaire['run'], weeks: number, paces: Paces): Assessment | null {
  if (!q.targetSeconds) return null
  const predicted = predictRaceSeconds(paces.vma, q.distance)
  const gain = (predicted - q.targetSeconds) / predicted
  const allowed = allowedGain(weeks)
  const verdict: Verdict = gain <= allowed ? 'realiste' : gain <= allowed * 1.4 ? 'ambitieux' : 'irrealiste'
  return {
    predicted, gain, allowed, verdict, realistic: Math.round(predicted * (1 - allowed * 0.85)),
    basis: paces.source, basisText: basisText(q, paces),
  }
}

export function prepWarnings(q: Questionnaire['run'], weeks: number, paces: Paces): PlanWarning[] {
  const p = PREP[q.distance]
  const out: PlanWarning[] = []
  if (weeks < p.min) {
    out.push({
      code: 'prepa_trop_courte',
      message: `Seulement ${weeks} semaine${weeks > 1 ? 's' : ''} de préparation : il en faut au moins ${p.min} pour ${DIST_LABEL[q.distance].toLowerCase()}.`,
      suggestion: 'Passer en objectif « Finir » ou repousser la date de la course.',
    })
  } else if (weeks > p.idealMax) {
    out.push({
      code: 'prepa_longue',
      message: `${weeks} semaines avant la course : une phase de base est ajoutée avant le plan spécifique.`,
    })
  }
  if (q.objective === 'chrono' && q.targetSeconds) {
    const a = assessTarget(q, weeks, paces)!
    const pct = (a.gain * 100).toFixed(1).replace('.', ',')
    if (a.basis === 'niveau') {
      out.push({
        code: 'chrono_a_confirmer',
        message: `Objectif ${fmtTime(q.targetSeconds)} : sans chrono ni VMA, impossible de juger s'il est réaliste.`,
        suggestion: 'La séance test de la semaine 1 calculera tes vraies allures. Pour une estimation dès maintenant, renseigne un chrono récent (5 km, 10 km…).',
      })
    } else if (a.verdict !== 'realiste') {
      out.push({
        code: 'chrono_irrealiste',
        message: `Objectif ${fmtTime(q.targetSeconds)} ${a.verdict === 'ambitieux' ? 'ambitieux mais jouable' : 'très ambitieux'} : d'après ${a.basisText}, ton niveau actuel prédit ${fmtTime(a.predicted)}. Il faudrait gagner ${pct} % en ${weeks} semaines (marge réaliste : ${(a.allowed * 100).toFixed(1).replace('.', ',')} %).`,
        suggestion: `Un chrono réaliste serait autour de ${fmtTime(a.realistic)}. Tu gardes le dernier mot.`,
      })
    }
  }
  return out
}

// ------------------------------------------------------------------ volumes

const PEAK_KM: Record<RaceDistance, Record<Level, number>> = {
  '10k': { debutant: 30, intermediaire: 40, avance: 55 },
  semi: { debutant: 38, intermediaire: 50, avance: 65 },
  marathon: { debutant: 50, intermediaire: 62, avance: 80 },
}
const FREQ_FACTOR: Record<number, number> = { 2: 0.6, 3: 0.8, 4: 1, 5: 1.1, 6: 1.2 }
const TAPER_FACTORS: Record<RaceDistance, number[]> = {
  '10k': [0.7], semi: [0.75, 0.55], marathon: [0.75, 0.6, 0.4],
}

export interface WeekVolume { week: number; phase: Phase; light: boolean; km: number; longKm: number }

export function peakKm(distance: RaceDistance, level: Level, sessions: number, priorityFactor = 1): number {
  return PEAK_KM[distance][level] * (FREQ_FACTOR[clamp(sessions, 2, 6)] ?? 1) * priorityFactor
}

export function longRunCap(distance: RaceDistance, level: Level, efPace: number): number {
  const byDist = level === 'debutant' && distance !== 'marathon'
    ? Math.min(MAX_LONG_RUN_KM[distance], distance === '10k' ? 14 : 18)
    : level === 'debutant' ? 30 : MAX_LONG_RUN_KM[distance]
  const byTime = (180 * 60) / efPace // jamais plus de ~3 h
  return Math.min(byDist, byTime)
}

export function weeklyVolumes(
  q: Questionnaire['run'], phases: Phase[], runSessions: number, paces: Paces, priorityFactor = 1,
): WeekVolume[] {
  const n = phases.length
  const peak = peakKm(q.distance, q.level, runSessions, priorityFactor)
  const start = Math.max(q.weeklyKm || 0, runSessions * 4, 8)
  const cap = longRunCap(q.distance, q.level, paces.ef)
  const taperF = TAPER_FACTORS[q.distance]
  const out: WeekVolume[] = []
  let lastLoaded = Math.min(start, peak)
  let lastLong = Math.min(Math.max(q.longestKm || 0, start * 0.3), cap)
  let loadedCount = 0
  let peakReached = lastLoaded
  const taperStart = phases.findIndex((p) => p === 'Affûtage')
  const share = runSessions === 2 ? 0.55 : runSessions === 3 ? 0.42 : 0.34

  for (let i = 0; i < n; i++) {
    const phase = phases[i]
    if (phase === 'Affûtage') {
      const idx = i - taperStart
      const f = taperF[Math.min(idx, taperF.length - 1)]
      const km = peakReached * f
      out.push({ week: i + 1, phase, light: true, km, longKm: Math.min(km * share, lastLong * (idx === 0 ? 0.8 : 0.5)) })
      continue
    }
    // une semaine allégée toutes les 4 semaines (3 semaines de charge + 1 allégée)
    const light = (loadedCount + 1) % 4 === 0 && i > 0
    if (light) {
      const km = lastLoaded * 0.75
      out.push({ week: i + 1, phase, light: true, km, longKm: Math.min(lastLong * 0.75, km * (share + 0.08)) })
      loadedCount += 1
      continue
    }
    const km = i === 0 ? lastLoaded : Math.min(lastLoaded * MAX_RUN_VOLUME_JUMP, peak)
    const maxRatio = Math.max(share + 0.08, q.distance === 'marathon' ? 0.5 : q.distance === 'semi' ? 0.46 : 0.42)
    const idealLong = Math.min(cap, lastLong + 2)
    const longKm = Math.min(idealLong, km * maxRatio, cap)
    lastLoaded = km
    lastLong = Math.max(lastLong, longKm)
    peakReached = Math.max(peakReached, km)
    loadedCount += 1
    out.push({ week: i + 1, phase, light: false, km, longKm })
  }
  return out
}

// ------------------------------------------------------------------ séances

const KIND_LABEL: Record<RunKind, string> = {
  ef: 'Endurance fondamentale', longue: 'Sortie longue', vma: 'Fractionné VMA', seuil: 'Séance au seuil',
  specifique: 'Allure spécifique', cotes: 'Côtes', fartlek: 'Fartlek', recup: 'Footing de récupération',
  test: 'Séance test', course: 'Jour de course',
}
export function runKindLabel(k: string): string {
  return KIND_LABEL[k as RunKind] ?? k
}

export function isQuality(kind: string): boolean {
  return ['vma', 'seuil', 'specifique', 'cotes', 'fartlek', 'test'].includes(kind)
}

function recFor(meters: number): number {
  return meters <= 400 ? 60 : meters <= 600 ? 75 : meters <= 800 ? 90 : 120
}

export function blockMinutes(b: RunBlock): number {
  const reps = b.reps ?? 1
  const work = b.seconds ?? ((b.meters ?? 0) / 1000) * (b.paceSec ?? 360)
  return (work * reps + (b.recSec ?? 0) * Math.max(0, reps - 1)) / 60
}
export function planMinutes(warmMin: number, blocks: RunBlock[], coolMin: number): number {
  return Math.round(warmMin + coolMin + blocks.reduce((a, b) => a + blockMinutes(b), 0))
}

const km1 = (x: number) => Math.round(x * 10) / 10

function easyPlan(km: number, pace: number, label = 'Footing'): RunPlan {
  const blocks: RunBlock[] = [{ label, meters: Math.round(km * 1000), paceSec: pace }]
  return {
    warmup: 'Démarre en douceur, les 5 premières minutes très tranquilles.',
    blocks, cooldown: 'Marche 3 minutes et étire-toi.', totalKm: km1(km),
    estMinutes: planMinutes(0, blocks, 0),
  }
}

export interface QualityCtx {
  distance: RaceDistance
  level: Level
  paces: Paces
  phase: Phase
  /** semaine dans la phase (0 = première) */
  idx: number
  km: number
  light: boolean
  maxMinutes: number
}

const QUALITY_WARM = 15
const QUALITY_COOL = 10

function qualityPlan(kind: RunKind, c: QualityCtx, totalKm: number): RunPlan {
  const p = c.paces
  let blocks: RunBlock[] = []
  let kmBody = 0
  const ctrl = (c.light ? 0.75 : 1)
  if (kind === 'vma') {
    const bodyKm = clamp(totalKm * 0.3, 2.4, 7) * ctrl
    const repM = [400, 600, 800, 1000][Math.min(3, Math.floor(c.idx / 1.5))]
    const reps = clamp(Math.round((bodyKm * 1000) / repM), 4, 14)
    const pace = repM >= 800 ? paceAt(p.vma, 0.97) : p.vmaPace
    blocks = [{ label: `${reps} × ${repM} m`, meters: repM, reps, paceSec: pace, recSec: recFor(repM), recLabel: 'trot' }]
    kmBody = (reps * repM) / 1000
  } else if (kind === 'seuil') {
    const total = clamp(14 + c.idx * 2.5, 14, c.distance === '10k' ? 28 : 36) * ctrl // minutes au seuil
    const nb = total <= 20 ? 2 : total <= 30 ? 3 : 4
    const each = Math.round(total / nb)
    blocks = [{ label: `${nb} × ${each} min`, seconds: each * 60, reps: nb, paceSec: p.seuil, recSec: 120, recLabel: 'trot' }]
    kmBody = ((each * 60 * nb) / p.seuil)
  } else if (kind === 'specifique') {
    const target = c.distance === '10k' ? p.dix : c.distance === 'semi' ? p.semi : p.marathon
    const shareKm = c.distance === '10k' ? 0.2 : c.distance === 'semi' ? 0.28 : 0.32
    const capKm = c.distance === '10k' ? 7 : c.distance === 'semi' ? 12 : 16
    const body = clamp(totalKm * shareKm * (1 + c.idx * 0.08), 3, capKm) * ctrl
    const rep = c.distance === '10k' ? 1000 : c.distance === 'semi' ? 2000 : 3000
    const reps = Math.max(2, Math.round((body * 1000) / rep))
    blocks = [{ label: `${reps} × ${rep / 1000} km`, meters: rep, reps, paceSec: target, recSec: 90, recLabel: 'trot' }]
    kmBody = (reps * rep) / 1000
  } else if (kind === 'cotes') {
    const reps = clamp(6 + c.idx, 6, 12)
    blocks = [{ label: `${reps} × 30 s en côte`, seconds: 30, reps, recSec: 90, recLabel: 'descente en trottinant' }]
    kmBody = reps * 0.12
  } else if (kind === 'fartlek') {
    const reps = clamp(8 + c.idx, 8, 14)
    blocks = [{ label: `${reps} × 1 min rapide / 1 min lent`, seconds: 60, reps, paceSec: paceAt(p.vma, 0.95), recSec: 60, recLabel: 'lent' }]
    kmBody = (reps * 2) / 60 * (3600 / p.ef) / 1000 * 1
  }
  // échauffement / retour au calme raccourcis sur les séances de 45 min
  const warm = c.maxMinutes <= 45 ? 10 : QUALITY_WARM
  const cool = c.maxMinutes <= 45 ? 5 : QUALITY_COOL
  const b0 = blocks[0]
  const label = () =>
    kind === 'vma' ? `${b0.reps} × ${b0.meters} m`
      : kind === 'seuil' ? `${b0.reps} × ${Math.round(b0.seconds! / 60)} min`
        : kind === 'specifique' ? `${b0.reps} × ${String(b0.meters! / 1000).replace('.', ',')} km`
          : kind === 'cotes' ? `${b0.reps} × 30 s en côte` : `${b0.reps} × 1 min rapide / 1 min lent`
  // la séance doit tenir dans la durée max : d'abord moins de répétitions, puis des blocs plus courts
  let g = 0
  while (planMinutes(warm, blocks, cool) > c.maxMinutes && g++ < 60) {
    if ((b0.reps ?? 1) > 3) b0.reps = b0.reps! - 1
    else if (kind === 'seuil' && b0.seconds! > 300) b0.seconds = b0.seconds! - 60
    else if ((kind === 'vma' || kind === 'specifique') && b0.meters! > 400) b0.meters = b0.meters! - (kind === 'vma' ? 200 : 500)
    else if ((b0.reps ?? 1) > 2) b0.reps = b0.reps! - 1
    else break
  }
  b0.label = label()
  void kmBody
  const reps = b0.reps ?? 1
  const work = b0.meters ? (reps * b0.meters) / 1000 : kind === 'cotes' ? reps * 0.12 : (reps * (b0.seconds ?? 0)) / (b0.paceSec ?? p.ef)
  const recovery = ((b0.recSec ?? 0) * Math.max(0, reps - 1)) / (p.ef * 1.15)
  const total = km1(((warm + cool) * 60) / p.ef + work + recovery)
  return {
    warmup: `${warm} min d'allure facile (${fmtPace(p.ef)}/km), puis 3 accélérations de 20 secondes.`,
    blocks, cooldown: `${cool} min de retour au calme très facile.`,
    totalKm: total, estMinutes: planMinutes(warm, blocks, cool),
  }
}

function qualityKindsFor(phase: Phase, slot: 1 | 2, level: Level, weekInPhase: number): RunKind {
  if (phase === 'Base') return slot === 1 ? (weekInPhase % 2 === 0 ? 'fartlek' : 'cotes') : 'cotes'
  if (phase === 'Développement') return slot === 1 ? 'vma' : 'seuil'
  if (phase === 'Spécifique') return slot === 1 ? 'specifique' : level === 'avance' && weekInPhase % 2 === 1 ? 'vma' : 'seuil'
  return 'specifique'
}

export interface RunWeekCtx {
  distance: RaceDistance
  level: Level
  paces: Paces
  phase: Phase
  weekInPhase: number
  volume: WeekVolume
  sessions: number
  maxMinutes: number
  withTest: boolean
  isFirstWeek: boolean
}

export function buildRunWeek(c: RunWeekCtx): Session[] {
  const { sessions: n, paces, phase, volume } = c
  const km = volume.km
  const slots: string[] = []
  const wantQ2 = n >= 4 && !(c.level === 'debutant' && n < 5) && phase !== 'Affûtage' && !volume.light
  if (n <= 2) slots.push('qual1', 'longue')
  else if (n === 3) slots.push('ef', 'qual1', 'longue')
  else if (n === 4) slots.push('ef', 'qual1', wantQ2 ? 'qual2' : 'ef', 'longue')
  else if (n === 5) slots.push('recup', 'qual1', 'ef', wantQ2 ? 'qual2' : 'ef', 'longue')
  else slots.push('recup', 'qual1', 'ef', wantQ2 ? 'qual2' : 'ef', 'ef', 'longue')

  const cap = (min: number) => (min * 60) / paces.ef
  const longCapKm = phase === 'Affûtage' ? Infinity : cap(c.distance === '10k' ? Math.max(c.maxMinutes, 90) : 180)
  const weights: number[] = slots.map((x) => (x === 'longue' ? 0 : x === 'recup' ? 0.6 : x.startsWith('qual') ? 1.15 : 1))
  const restKm = Math.max(0, km - volume.longKm)
  const wsum = weights.reduce((a, b) => a + b, 0) || 1

  const longPlan = (lkIn: number): RunPlan => {
    const lk = Math.min(lkIn, longCapKm)
    const specPhase = phase === 'Spécifique' && (c.distance === 'marathon' || c.distance === 'semi') && !volume.light && c.weekInPhase >= 1
    if (specPhase) {
      const fast = clamp(lk * 0.35, 4, c.distance === 'marathon' ? 14 : 8)
      const target = c.distance === 'marathon' ? paces.marathon : paces.semi
      const blocks: RunBlock[] = [
        { label: 'Facile', meters: Math.round((lk - fast) * 1000), paceSec: paces.ef },
        { label: `Allure ${c.distance === 'marathon' ? 'marathon' : 'semi'}`, meters: Math.round(fast * 1000), paceSec: target },
      ]
      return { warmup: 'Les premiers kilomètres très faciles.', blocks, cooldown: 'Fin en marchant 5 minutes, hydrate-toi bien.', totalKm: km1(lk), estMinutes: planMinutes(0, blocks, 0) }
    }
    return easyPlan(lk, paces.ef + 5, 'Sortie longue à allure facile')
  }
  const easyFor = (kind: 'ef' | 'recup', kmWanted: number): RunPlan => {
    const pace = kind === 'recup' ? paces.recup : paces.ef
    let k = Math.max(3, kmWanted)
    const probe = easyPlan(k, pace)
    if (probe.estMinutes > c.maxMinutes) k = Math.max(3, Math.floor(k * (c.maxMinutes / probe.estMinutes) * 2) / 2)
    return easyPlan(k, pace, kind === 'recup' ? 'Footing très souple' : 'Endurance fondamentale')
  }

  // 1) sorties dont la distance dépend de leur structure : sortie longue et séances de qualité
  const plans: { kind: RunKind; plan: RunPlan | null }[] = []
  let q = 0
  slots.forEach((slot, i) => {
    const share = (restKm * weights[i]) / wsum
    if (slot === 'longue') plans.push({ kind: 'longue', plan: longPlan(volume.longKm) })
    else if (slot.startsWith('qual')) {
      q += 1
      let qk = qualityKindsFor(phase, q === 1 ? 1 : 2, c.level, c.weekInPhase)
      if (c.withTest && c.isFirstWeek && q === 1) qk = 'test'
      if (qk === 'test') {
        const blocks: RunBlock[] = [{ label: 'Test 6 minutes : cours le plus loin possible, allure régulière', seconds: 360, paceSec: paces.vmaPace }]
        plans.push({ kind: 'test', plan: { warmup: '15 min d\'allure facile, 3 accélérations. Relève ensuite la distance parcourue pendant 6 minutes.', blocks, cooldown: '10 min de trot très lent.', totalKm: 5, estMinutes: 35 } })
      } else {
        plans.push({ kind: qk, plan: qualityPlan(qk, { distance: c.distance, level: c.level, paces, phase, idx: c.weekInPhase, km, light: volume.light, maxMinutes: c.maxMinutes }, share) })
      }
    } else plans.push({ kind: slot as 'ef' | 'recup', plan: null })
  })

  // 2) les sorties faciles complètent le volume visé (échauffements et retours au calme inclus)
  const fixedKm = plans.reduce((a, p) => a + (p.plan?.totalKm ?? 0), 0)
  const easy = plans.filter((p) => !p.plan)
  const easyW = easy.map((p) => (p.kind === 'recup' ? 0.6 : 1))
  const easyWsum = easyW.reduce((a, b) => a + b, 0) || 1
  const pool = Math.max(0, km - fixedKm)
  easy.forEach((p, i) => { p.plan = easyFor(p.kind as 'ef' | 'recup', (pool * easyW[i]) / easyWsum) })

  // 2 bis) semaine à 2 sorties (ou séance test) : la sortie longue absorbe le déficit de volume (+30 % max)
  if (phase !== 'Affûtage' && !easy.length) {
    const longP = plans.find((p) => p.kind === 'longue')!
    const total = plans.reduce((a, p) => a + p.plan!.totalKm, 0)
    if (total < km - 0.5) longP.plan = longPlan(Math.min(longP.plan!.totalKm + (km - total), longP.plan!.totalKm * 1.3))
  }

  // 3) la sortie longue est toujours la plus longue de la semaine (sauf affûtage)
  if (phase !== 'Affûtage') {
    const longP = plans.find((p) => p.kind === 'longue')!
    const maxOther = Math.max(0, ...plans.filter((p) => p.kind !== 'longue').map((p) => p.plan!.totalKm))
    if (longP.plan!.totalKm < maxOther + 0.3) longP.plan = longPlan(maxOther + 0.5)
  }

  return plans.map(({ kind, plan }) => ({
    id: uid('s'), weekN: volume.week, date: '', sport: 'course' as const, kind,
    title: runKindLabel(kind), status: 'prevue' as const, estMinutes: plan!.estMinutes, run: plan!,
  }))
}

/** Allure moyenne (s/km) d'un plan. */
export function describeBlock(b: RunBlock): string {
  const dist = b.meters ? (b.meters >= 1000 ? `${String(km1(b.meters / 1000)).replace('.', ',')} km` : `${b.meters} m`) : b.seconds ? (b.seconds >= 60 ? `${Math.round(b.seconds / 60)} min` : `${b.seconds} s`) : ''
  const reps = b.reps && b.reps > 1 ? `${b.reps} × ` : ''
  const pace = b.paceSec ? ` à ${fmtPace(b.paceSec)}/km` : ''
  const rec = b.recSec && b.reps && b.reps > 1 ? `, récup ${b.recSec >= 120 ? `${Math.round(b.recSec / 60)} min` : `${b.recSec} s`} ${b.recLabel ?? 'trot'}` : ''
  return `${reps}${dist}${pace}${rec}`
}
