// Adaptations automatiques : séances manquées, charges, allures, fatigue/douleur, analyse hebdo.
// Fonctions pures : elles renvoient un nouveau programme + les adaptations à journaliser.

import { EXERCISE_BY_ID, alternativesFor } from './exercises'
import { bestDayFor, daysFor, runClass } from './combine'
import { capLoad } from './guardrails'
import { computePaces, isQuality } from './running'
import type { Adaptation, AdaptationKind, Checkin, Paces, Program, RunPlan, Session, Zone } from './types'
import { LOWER_MUSCLES } from './types'
import { addDays, dayName, fmtKm, mondayOf, round, uid, weekday } from './utils'

export interface AdaptResult { program: Program; adaptations: Adaptation[] }

const clone = <T,>(x: T): T => structuredClone(x)

function adapt(p: Program, kind: AdaptationKind, text: string, today: string, before: Session[] = [], extra: Partial<Adaptation> = {}): Adaptation {
  return {
    id: uid('ad'), clientId: p.clientId, programId: p.id, date: today, kind, text, status: 'applique',
    undo: before.length ? { sessions: clone(before) } : undefined, ...extra,
  }
}

export function allSessions(p: Program): Session[] {
  return p.weeks.flatMap((w) => w.sessions)
}
export function findSession(p: Program, id: string): Session | undefined {
  return allSessions(p).find((s) => s.id === id)
}
function weekOf(p: Program, s: Session) {
  return p.weeks.find((w) => w.n === s.weekN)!
}

// ------------------------------------------------------------------ 1. séances manquées

const priorityOf = (s: Session) => (s.kind === 'longue' ? 0 : isQuality(s.kind) ? 1 : s.sport === 'muscu' ? 2 : 3)

/** Marque les séances passées non validées et reprogramme celles qui comptent, sans jamais cumuler. */
export function handleMissed(program: Program, today: string, availableDays: number[]): AdaptResult {
  const p = clone(program)
  const adaptations: Adaptation[] = []
  for (const w of p.weeks) {
    const missed = w.sessions.filter((s) => s.status === 'prevue' && s.date < today)
    for (const s of missed.sort((a, b) => priorityOf(a) - priorityOf(b))) {
      const important = s.kind === 'longue' || isQuality(s.kind)
      const snapshot = [clone(s)]
      s.status = 'manquee'
      if (!important || s.kind === 'course') {
        adaptations.push(adapt(p, 'sautee',
          `« ${s.title} » du ${dayName(s.date)} non réalisée : elle saute, on ne la rattrape pas pour ne pas cumuler.`, today, snapshot))
        continue
      }
      const free = daysFor(s, availableDays.length ? availableDays : [0, 1, 2, 3, 4, 5, 6], p.q.dayPrefs ? { ...p.q.dayPrefs, longRun: undefined } : {}).filter((d) => {
        const date = addDays(w.startDate, d)
        return date >= today && !w.sessions.some((o) => o.id !== s.id && o.date === date && o.status !== 'sautee' && o.status !== 'manquee')
      })
      const others = w.sessions.filter((o) => o.id !== s.id && o.status !== 'manquee')
      const day = bestDayFor([...others, { ...s, status: 'prevue' }], s.id, w.startDate, free, {}, today)
      if (day === null) {
        s.status = 'sautee'
        adaptations.push(adapt(p, 'sautee',
          `« ${s.title} » du ${dayName(s.date)} non réalisée et aucun jour libre sans conflit cette semaine : elle saute.`, today, snapshot))
      } else {
        const oldDate = s.date
        s.status = 'prevue'
        s.movedFrom = oldDate
        s.date = addDays(w.startDate, day)
        adaptations.push(adapt(p, 'deplacee',
          `Séance déplacée à ${dayName(s.date)} car ${dayName(oldDate)} n'a pas été réalisé.`, today, snapshot))
      }
    }
  }
  return { program: p, adaptations }
}

// ------------------------------------------------------------------ 2. charges selon RPE / RIR

const isLowerEx = (exId: string) => LOWER_MUSCLES.includes(EXERCISE_BY_ID[exId].muscle)

export function loadIncrement(exId: string, current: number): number {
  const ex = EXERCISE_BY_ID[exId]
  if (ex.equipment === 'halteres') return 2
  const base = isLowerEx(exId) ? 5 : 2.5
  return Math.max(base, round(current * 0.02, 0.5))
}

type Verdict = 'monter' | 'monter_plus' | 'maintenir' | 'baisser'

/** Évalue les séries saisies d'un exercice par rapport à la cible. */
export function judgeExercise(sets: { reps: number; rir: number }[], repMin: number, repMax: number, targetRir: number, previouslyFailed: boolean): Verdict {
  if (!sets.length) return 'maintenir'
  const allTop = sets.every((s) => s.reps >= repMax && s.rir <= targetRir + 1)
  const veryEasy = sets.every((s) => s.rir >= targetRir + 2 && s.reps >= repMin)
  const failed = sets.some((s) => s.reps < repMin || s.rir < targetRir - 1)
  if (veryEasy && sets.every((s) => s.reps >= repMax - 1)) return 'monter_plus'
  if (allTop) return 'monter'
  if (failed) return previouslyFailed ? 'baisser' : 'maintenir'
  return 'maintenir'
}

/** À appeler quand une séance de muscu est terminée : ajuste les charges des séances futures. */
export function adjustLoadsAfterSession(program: Program, sessionId: string, today: string): AdaptResult {
  const p = clone(program)
  const done = findSession(p, sessionId)
  const adaptations: Adaptation[] = []
  if (!done?.exercises) return { program: p, adaptations }
  const all = allSessions(p).sort((a, b) => a.date.localeCompare(b.date))
  const future = all.filter((s) => s.date > done.date && s.id !== done.id && s.status === 'prevue')

  for (const e of done.exercises) {
    if (!e.logs.length) continue
    const kg = Math.max(...e.logs.map((l) => l.kg))
    const prev = all.filter((s) => s.date < done.date && s.status === 'faite').reverse()
      .flatMap((s) => s.exercises ?? []).find((x) => x.exerciseId === e.exerciseId && x.logs.length)
    const prevFailed = !!prev && prev.logs.some((l) => l.reps < prev.repMin) && prev.logs.every((l) => l.kg === kg || l.kg <= kg)
    const verdict = judgeExercise(e.logs, e.repMin, e.repMax, e.rir, prevFailed)
    let next = kg
    let why = ''
    const inc = loadIncrement(e.exerciseId, kg)
    if (verdict === 'monter') { next = kg + inc; why = 'toutes les séries au haut de la fourchette' }
    else if (verdict === 'monter_plus') { next = kg + inc * 2; why = 'séries nettement plus faciles que prévu' }
    else if (verdict === 'baisser') { next = round(kg * 0.95, 0.5); why = 'deux séances de suite sous la cible' }
    else next = kg
    next = round(capLoad(kg, next), EXERCISE_BY_ID[e.exerciseId].equipment === 'halteres' ? 1 : 0.5)

    const touched: Session[] = []
    for (const s of future) {
      for (const fe of s.exercises ?? []) {
        if (fe.exerciseId === e.exerciseId && fe.targetKg !== next) {
          if (!touched.find((t) => t.id === s.id)) touched.push(clone(s))
          fe.targetKg = next
        }
      }
    }
    if (verdict !== 'maintenir' && touched.length) {
      const name = EXERCISE_BY_ID[e.exerciseId].name
      adaptations.push(adapt(p, 'charge',
        `${name} : ${verdict === 'baisser' ? 'charge réduite' : 'charge augmentée'} à ${fmtKm(next)} kg (${why}).`, today, touched))
    } else if (touched.length) {
      // la charge de référence est simplement alignée sur ce qui vient d'être soulevé
      /* pas de journal pour un simple alignement */
    }
  }
  return { program: p, adaptations }
}

// ------------------------------------------------------------------ 3. allures

export function scalePaces(program: Program, newVma: number, today: string, fromDate = today): AdaptResult {
  const p = clone(program)
  const oldVma = p.paces?.vma ?? newVma
  if (!p.paces || Math.abs(newVma - oldVma) < 0.05) return { program: p, adaptations: [] }
  const ratio = oldVma / newVma
  const before: Session[] = []
  for (const s of allSessions(p)) {
    if (!s.run || s.status !== 'prevue' || s.date < fromDate || s.kind === 'course') continue
    before.push(clone(s))
    for (const b of s.run.blocks) if (b.paceSec) b.paceSec = b.paceSec * ratio
    s.run.estMinutes = Math.round(s.run.estMinutes * (0.4 + 0.6 * ratio))
    s.estMinutes = s.run.estMinutes
  }
  const oldPaces: Paces = p.paces
  const np = computePaces(newVma, 'vma')
  // on conserve l'allure d'objectif si elle avait été alignée sur le chrono visé
  p.paces = { ...np, marathon: oldPaces.marathon * ratio, semi: oldPaces.semi * ratio, dix: oldPaces.dix * ratio }
  const a = adapt(p, 'allures',
    `VMA mise à jour : ${oldVma.toFixed(1).replace('.', ',')} → ${newVma.toFixed(1).replace('.', ',')} km/h. Toutes les allures futures ont été recalculées.`,
    today, before, { payload: { paces: oldPaces } })
  return { program: p, adaptations: [a] }
}

/** Détecte des sorties faciles régulièrement plus rapides que prévu et propose une VMA plus haute. */
export function suggestVmaUpdate(program: Program): { vma: number; text: string } | null {
  if (!program.paces) return null
  const done = allSessions(program)
    .filter((s) => s.status === 'faite' && s.runLog && (s.kind === 'ef' || s.kind === 'longue') && s.run)
    .sort((a, b) => a.date.localeCompare(b.date)).slice(-3)
  if (done.length < 3) return null
  const faster = done.every((s) => {
    const pace = s.runLog!.seconds / s.runLog!.km
    return pace < program.paces!.ef * 0.96 && s.runLog!.feeling <= 5
  })
  if (!faster) return null
  const avg = done.reduce((a, s) => a + s.runLog!.seconds / s.runLog!.km, 0) / done.length
  const vma = Math.min(program.paces.vma * 1.05, Math.round(program.paces.vma * (program.paces.ef / avg) * 10) / 10)
  if (vma <= program.paces.vma + 0.1) return null
  return { vma, text: `Tes 3 dernières sorties faciles étaient plus rapides que prévu avec un bon ressenti. Passer la VMA à ${vma.toFixed(1).replace('.', ',')} km/h ?` }
}

// ------------------------------------------------------------------ 4. fatigue / douleur

export function checkinScore(c: Pick<Checkin, 'energy' | 'sleep' | 'soreness'>): number {
  return (c.energy + c.sleep + (6 - c.soreness)) / 3
}

function lightenRun(s: Session): void {
  if (!s.run) return
  if (isQuality(s.kind) && s.kind !== 'course') {
    const km = Math.max(3, Math.round(s.run.totalKm * 0.8))
    const pace = (s.run.blocks.find((b) => b.paceSec)?.paceSec ?? 360) * 1.25
    const plan: RunPlan = {
      warmup: 'Pas d\'échauffement spécial : démarre très doucement.', totalKm: km,
      blocks: [{ label: 'Endurance fondamentale', meters: km * 1000, paceSec: pace }],
      cooldown: 'Marche 3 minutes.', estMinutes: Math.round((km * pace) / 60),
    }
    s.run = plan
    s.kind = 'ef'
    s.title = 'Endurance fondamentale (allégée)'
    s.estMinutes = plan.estMinutes
  } else {
    const f = 0.75
    s.run.blocks.forEach((b) => { if (b.meters) b.meters = Math.round(b.meters * f); if (b.seconds && !b.reps) b.seconds = Math.round(b.seconds * f) })
    s.run.totalKm = Math.round(s.run.totalKm * f * 10) / 10
    s.run.estMinutes = Math.round(s.run.estMinutes * f)
    s.estMinutes = s.run.estMinutes
  }
}

export interface CheckinResult extends AdaptResult { notifyCoach: boolean }

export function applyCheckin(program: Program, sessionId: string, c: Checkin, today: string): CheckinResult {
  const p = clone(program)
  const s = findSession(p, sessionId)
  const adaptations: Adaptation[] = []
  let notify = false
  if (!s) return { program: p, adaptations, notifyCoach: false }
  const before = [clone(s)]
  const score = checkinScore(c)

  if (c.pain && c.painZone) {
    notify = true
    if (s.exercises) {
      const replaced: string[] = []
      s.exercises = s.exercises.flatMap((e) => {
        const ex = EXERCISE_BY_ID[e.exerciseId]
        if (!ex.contra.includes(c.painZone as Zone)) return [e]
        const alt = alternativesFor(e.exerciseId, [c.painZone as Zone, ...p.q.injuries], p.q.strength.level)[0]
        if (!alt) { replaced.push(`${ex.name} (retiré)`); return [] }
        replaced.push(`${ex.name} → ${alt.name}`)
        return [{ ...e, exerciseId: alt.id, targetKg: undefined, logs: [] }]
      })
      if (replaced.length) {
        adaptations.push(adapt(p, 'remplacement',
          `Douleur signalée (${c.painZone}) : ${replaced.join(', ')}.`, today, before, { payload: { notifyCoach: true } }))
      }
    }
    if (s.run) {
      lightenRun(s)
      s.lighten = true
      adaptations.push(adapt(p, 'allegee', `Douleur signalée (${c.painZone}) : séance de course allégée.`, today, before, { payload: { notifyCoach: true } }))
    }
  } else if (score <= 2.5 && !s.lighten) {
    s.lighten = true
    if (s.exercises) {
      s.exercises = s.exercises.map((e) => ({ ...e, sets: Math.max(1, Math.round(e.sets * 0.7)) }))
      s.estMinutes = Math.round(s.estMinutes * 0.75)
    }
    if (s.run) lightenRun(s)
    adaptations.push(adapt(p, 'allegee',
      `Forme basse aujourd'hui : séance allégée (−30 %${s.run ? ', séance de qualité transformée en endurance' : ''}).`, today, before))
  }
  if (c.pain && c.painZone) s.lighten = true
  return { program: p, adaptations, notifyCoach: notify }
}

// ------------------------------------------------------------------ 5. analyse hebdomadaire (règles) + suggestions

export interface WeekStats { weekN: number; planned: number; done: number; avgFeeling: number | null; easyRate: number | null; km: number; tonnage: number }

export function weekStats(p: Program, weekN: number): WeekStats {
  const w = p.weeks.find((x) => x.n === weekN)
  const list = (w?.sessions ?? []).filter((s) => s.status !== 'sautee')
  const done = list.filter((s) => s.status === 'faite')
  const feel = done.map((s) => s.feeling ?? s.runLog?.feeling).filter((x): x is number => typeof x === 'number')
  const sets = done.flatMap((s) => s.exercises ?? []).flatMap((e) => e.logs.map((l) => ({ l, target: e.rir })))
  return {
    weekN, planned: list.length, done: done.length,
    avgFeeling: feel.length ? feel.reduce((a, b) => a + b, 0) / feel.length : null,
    easyRate: sets.length ? sets.filter((x) => x.l.rir >= x.target + 2).length / sets.length : null,
    km: done.reduce((a, s) => a + (s.runLog?.km ?? 0), 0),
    tonnage: done.flatMap((s) => s.exercises ?? []).reduce((a, e) => a + e.logs.reduce((b, l) => b + l.kg * l.reps, 0), 0),
  }
}

export interface Suggestion { type: 'scale_week'; weekN: number; factor: number }

export function applyScale(program: Program, weekN: number, factor: number): Program {
  const p = clone(program)
  const w = p.weeks.find((x) => x.n === weekN)
  if (!w) return p
  for (const s of w.sessions) {
    if (s.status !== 'prevue') continue
    for (const e of s.exercises ?? []) e.sets = Math.max(1, Math.round(e.sets * factor))
    if (s.run && s.kind !== 'course') {
      s.run.blocks.forEach((b) => { if (b.meters) b.meters = Math.round(b.meters * factor) })
      s.run.totalKm = Math.round(s.run.totalKm * factor * 10) / 10
      s.run.estMinutes = Math.round(s.run.estMinutes * factor)
    }
    s.estMinutes = Math.max(15, Math.round(s.estMinutes * (0.4 + 0.6 * factor)))
  }
  return p
}

/** Fallback sans IA : propose des ajustements prudents pour la semaine suivante. */
export function ruleBasedWeeklyAnalysis(p: Program, weekN: number, today: string): { summary: string; suggestions: Adaptation[] } {
  const st = weekStats(p, weekN)
  const next = weekN + 1
  const sug: Adaptation[] = []
  const parts: string[] = []
  const rate = st.planned ? st.done / st.planned : 1
  parts.push(`${st.done} séance${st.done > 1 ? 's' : ''} sur ${st.planned} prévue${st.planned > 1 ? 's' : ''}.`)
  if (st.km) parts.push(`${fmtKm(st.km)} km courus.`)
  if (st.tonnage) parts.push(`Tonnage : ${Math.round(st.tonnage).toLocaleString('fr-FR')} kg.`)
  const nextWeek = p.weeks.find((w) => w.n === next)
  if (nextWeek) {
    if (rate < 0.6) {
      sug.push({
        id: uid('ad'), clientId: p.clientId, programId: p.id, date: today, kind: 'suggestion_ia', status: 'propose',
        text: `Semaine chargée à reprendre doucement : réduire de 20 % le volume de la semaine ${next} pour retrouver du rythme.`,
        payload: { type: 'scale_week', weekN: next, factor: 0.8 } satisfies Suggestion,
      })
    } else if (st.avgFeeling !== null && st.avgFeeling >= 8) {
      sug.push({
        id: uid('ad'), clientId: p.clientId, programId: p.id, date: today, kind: 'suggestion_ia', status: 'propose',
        text: `Ressenti très dur cette semaine (${st.avgFeeling.toFixed(1).replace('.', ',')}/10) : alléger la semaine ${next} de 15 %.`,
        payload: { type: 'scale_week', weekN: next, factor: 0.85 } satisfies Suggestion,
      })
    } else if (st.easyRate !== null && st.easyRate > 0.6 && rate >= 0.8) {
      parts.push('Les séries étaient faciles : les charges vont monter plus vite.')
    } else if (rate === 1) {
      parts.push('Semaine complète : bravo, continue comme ça.')
    }
  }
  return { summary: parts.join(' '), suggestions: sug }
}

export function applySuggestion(program: Program, a: Adaptation, today: string): AdaptResult {
  const payload = a.payload as Suggestion | undefined
  if (!payload || payload.type !== 'scale_week') return { program, adaptations: [] }
  const w = program.weeks.find((x) => x.n === payload.weekN)
  const before = w ? w.sessions.filter((s) => s.status === 'prevue') : []
  const np = applyScale(program, payload.weekN, payload.factor)
  const res = adapt(np, 'suggestion_ia', a.text, today, before)
  res.status = 'accepte'
  return { program: np, adaptations: [res] }
}

// ------------------------------------------------------------------ annulation

export function undoAdaptation(program: Program, a: Adaptation): Program {
  const p = clone(program)
  if (a.undo) {
    for (const old of a.undo.sessions) {
      const w = p.weeks.find((x) => x.n === old.weekN)
      if (!w) continue
      const i = w.sessions.findIndex((s) => s.id === old.id)
      if (i >= 0) w.sessions[i] = clone(old)
    }
  }
  const payload = a.payload as { paces?: Paces } | undefined
  if (payload?.paces) p.paces = payload.paces
  return p
}

/** Séance du jour (date exacte) ou null. */
export function sessionsOn(p: Program, date: string): Session[] {
  return allSessions(p).filter((s) => s.date === date && s.status !== 'sautee')
}

export function currentWeek(p: Program, today: string) {
  const monday = mondayOf(today)
  return p.weeks.find((w) => w.startDate === monday) ?? (today < p.weeks[0].startDate ? p.weeks[0] : p.weeks[p.weeks.length - 1])
}

export { runClass, weekday }
