// Assemblage d'un programme complet : phases, semaines, séances, placement, avertissements.

import type { Phase, PlanWarning, Program, ProgramType, Questionnaire, Session, Week } from './types'
import { LOWER_MUSCLES, MUSCLE_LABEL } from './types'
import { MAX_RUN_VOLUME_JUMP } from './guardrails'
import {
  assessTarget, buildRunWeek, DIST_KM, DIST_LABEL, leadIn as leadInOf, pacesFromQuestionnaire, phasePlan, prepWarnings, startModeOf, sessionsForVolume, volumeOutlook, weeklyVolumes,
} from './running'
import { buildStrengthWeek, cyclePosition, isUpperOnly, makeStrengthCtx, SPLIT_LABEL } from './strength'
import { isRenfo, placeWeek, runClass } from './combine'
import { addRunnerExtras, buildRenfoSession, daysBeforeRace, renfoAllowed, stripRunnerExtras } from './renfo'
import { addDays, diffDays, fmtPace, mondayOf, uid, weekday, fmtTime, todayISO } from './utils'

export const WEEKS_PER_CYCLE = 8

export function programTypeOf(q: Questionnaire): ProgramType {
  return q.programType
}

function legFactorFor(q: Questionnaire): { legFactor: number; minLegRir: number } {
  if (q.programType !== 'mixte') return { legFactor: 1, minLegRir: 0 }
  if (q.priority === 'course') return { legFactor: 0.6, minLegRir: 2 }
  if (q.priority === 'equilibre') return { legFactor: 0.8, minLegRir: 1 }
  return { legFactor: 1, minLegRir: 0 }
}

/** Texte court du coach pour une semaine (remplacé par l'IA quand elle est disponible). */
export function defaultWeekNote(phase: Phase, light: boolean, n: number, q: Questionnaire, isRaceWeek: boolean, lead?: 'endurance' | 'intro'): string {
  if (isRaceWeek) return 'Semaine de course : fais confiance à ta préparation, dors bien et mange simplement.'
  if (phase === 'Affûtage') return 'On réduit le volume pour arriver frais. Garde un peu d\'intensité, mais court.'
  if (phase === 'Musculation') {
    const pos = cyclePosition(n)
    if (pos === 8) return 'Semaine de décharge : moins de séries et plus de marge. Ton corps assimile le travail des semaines précédentes.'
    if (pos <= 2) return 'On démarre le cycle avec de la marge (reps en réserve) pour soigner la technique et poser les charges.'
    if (pos >= 6) return 'Fin de cycle : on pousse plus près de l\'échec, avec des charges qui doivent monter.'
    return 'Progression par paliers : quand toutes les séries atteignent le haut de la fourchette, on monte la charge.'
  }
  if (lead === 'endurance' && !light) return 'On reprend en douceur : que de l\'endurance facile, à allure confortable. Le fractionné viendra plus tard, une fois ton corps réhabitué.'
  if (lead === 'intro' && !light) return 'On introduit un peu de rythme avec une seule séance légère (côtes ou fartlek). La VMA et le seuil arriveront ensuite.'
  if (light) return 'Semaine allégée : −25 % de volume pour absorber la charge. Profite-en pour bien récupérer.'
  if (phase === 'Base') return 'On construit la base : beaucoup de facile, des éducatifs et des côtes pour le foncier.'
  if (phase === 'Développement') return 'On développe VMA et seuil. La séance de qualité doit être exigeante mais tenue.'
  return `On se rapproche de l'allure de course (${q.run.distance === 'marathon' ? 'marathon' : q.run.distance === 'semi' ? 'semi' : '10 km'}). Reste régulier sur les blocs spécifiques.`
}

function dropOrder(s: Session): number {
  // plus la valeur est grande, plus la séance saute facilement
  if (isRenfo(s)) return 6
  if (s.kind === 'course') return 0
  if (s.kind === 'longue') return 1
  if (runClass(s) === 'quality') return 2
  if (s.sport === 'muscu' && s.legLoad === 'heavy') return 3
  if (s.sport === 'muscu') return 4
  return 5
}

/**
 * Dernière passe du renfo coureur, une fois toutes les séances datées :
 *  - jamais la veille de la sortie longue, d'une séance de qualité ou de la course (y compris d'une semaine à l'autre) : la séance saute, avec un `PlanWarning` ;
 *  - aucun renfo dans les 3 derniers jours avant la course, aucune pliométrie dans les 10 jours avant : la séance est reconstruite d'après sa date ;
 *  - programme mixte : les compléments de coureur disparaissent des séances de muscu à moins de 3 jours de la course.
 */
function finalizeRenfo(weeks: Week[], q: Questionnaire, renfo: NonNullable<Questionnaire['run']['renfo']>, type: Program['type'], warnings: PlanWarning[]): void {
  const raceDate = q.run.raceDate
  const all = weeks.flatMap((w) => w.sessions)
  const dropped: number[] = []
  for (const w of weeks) {
    w.sessions = w.sessions.flatMap((s) => {
      if (type === 'mixte' && s.sport === 'muscu' && s.exercises?.some((e) => e.renfo) && !renfoAllowed(daysBeforeRace(s.date, raceDate))) {
        stripRunnerExtras(s)
        return [s]
      }
      if (!isRenfo(s)) return [s]
      const d = daysBeforeRace(s.date, raceDate)
      if (!renfoAllowed(d)) return []
      const next = addDays(s.date, 1)
      if (all.some((x) => x.date === next && x.status !== 'sautee' && (runClass(x) === 'long' || runClass(x) === 'quality'))) { dropped.push(w.n); return [] }
      // contenu définitif : la pliométrie dépend de la distance à la course
      const fresh = buildRenfoSession({ kit: renfo.kit, level: q.run.level, injuries: q.injuries, phase: w.phase, weekN: w.n, light: w.light, daysToRace: d })
      if (!fresh) return []
      return [{ ...s, exercises: fresh.exercises, groups: fresh.groups, estMinutes: fresh.estMinutes, warmup: fresh.warmup, note: fresh.note }]
    })
  }
  if (dropped.length) {
    const list = [...new Set(dropped)]
    warnings.push({
      code: 'renfo_placement',
      message: `Semaine${list.length > 1 ? 's' : ''} ${list.slice(0, 4).join(', ')}${list.length > 4 ? '…' : ''} : pas de jour libre pour le renfo coureur. Il n'est jamais placé la veille de la sortie longue ni d'une séance de qualité : la séance est retirée.`,
      suggestion: 'Ajoute un jour disponible, ou choisis 1 séance de renfo par semaine.',
    })
  }
}

export interface GenerateOptions { now?: string; clientId?: string }

export function generateProgram(q: Questionnaire, opts: GenerateOptions = {}): Program {
  const now = opts.now ?? todayISO()
  const type = programTypeOf(q)
  const hasRun = type !== 'muscu'
  const hasStrength = type !== 'course'
  const startDate = q.startDate || now
  const startMonday = mondayOf(startDate)
  const warnings: PlanWarning[] = []

  // --- nombre de semaines
  let N = WEEKS_PER_CYCLE
  const raceDate = hasRun ? q.run.raceDate : undefined
  if (hasRun && raceDate) {
    N = Math.max(1, diffDays(startMonday, mondayOf(raceDate)) / 7 + 1)
  }
  const paces = hasRun ? pacesFromQuestionnaire(q.run) : undefined

  const lead = hasRun ? leadInOf(q.run, N) : { weeks: 0, noQuality: 0 }
  const progressive = hasRun && startModeOf(q.run) === 'progressif'
  let phases: Phase[]
  if (hasRun) {
    phases = phasePlan(q.run.distance, N, lead.weeks)
    if (paces) {
      warnings.push(...prepWarnings(q.run, N, paces))
      // chrono réaliste : les allures spécifiques suivent l'objectif
      const a = assessTarget(q.run, N, paces)
      if (q.run.objective === 'chrono' && q.run.targetSeconds && a && a.verdict === 'realiste' && a.basis !== 'niveau') {
        const tp = q.run.targetSeconds / DIST_KM[q.run.distance]
        if (q.run.distance === 'marathon') paces.marathon = tp
        else if (q.run.distance === 'semi') paces.semi = tp
        else paces.dix = tp
      }
    }
  } else {
    phases = Array(N).fill('Musculation')
  }

  const runSessions = hasRun ? Math.max(2, q.runSessions) : 0
  const priorityFactor = type === 'mixte' && q.priority === 'muscu' ? 0.75 : 1
  const volumes = hasRun && paces ? weeklyVolumes(q.run, phases, runSessions, paces, priorityFactor) : []
  const sCtx = hasStrength ? makeStrengthCtx(q) : undefined
  const { legFactor, minLegRir } = legFactorFor(q)
  // renfo coureur : séances à part pour une course seule, compléments dans les séances de muscu pour un programme mixte
  const renfo = hasRun && q.run.renfo && q.run.renfo.perWeek > 0 ? q.run.renfo : undefined

  if (type === 'mixte' && q.priority === 'muscu' && q.run.objective === 'chrono') {
    warnings.push({
      code: 'muscu_prioritaire_course',
      message: 'Avec la musculation prioritaire, le volume de course est réduit : l\'objectif chrono devient plus difficile à tenir.',
      suggestion: 'Passe la priorité sur « Équilibré » ou « Course » si le chrono est important.',
    })
  }
  if (hasStrength && q.excludedMuscles?.length) {
    warnings.push({
      code: 'muscles_exclus',
      message: `Parties du corps exclues : ${q.excludedMuscles.map((m) => MUSCLE_LABEL[m].toLowerCase()).join(', ')}. Aucun exercice ne les cible.${isUpperOnly(q.excludedMuscles) ? ' Sans jambes, pas de séance « bas du corps » : ton programme alterne Push, Pull et Full body.' : ''}`,
    })
  }
  if (q.injuries.length && hasStrength) {
    warnings.push({
      code: 'blessure',
      message: `Exercices adaptés à tes limitations (${q.injuries.join(', ')}) : les mouvements contre-indiqués sont exclus.`,
    })
  }
  const totalSessions = (hasStrength ? q.muscuSessions : 0) + runSessions
  const nDays = q.availableDays.length || 7
  if (totalSessions > nDays) {
    warnings.push({
      code: 'jours_insuffisants',
      message: `${totalSessions} séances sur ${nDays} jours disponibles : certains jours auront deux séances (course le matin, muscu le soir).`,
    })
  }

  // --- semaines
  const weeks: Week[] = []
  let carryLong = false
  let weekInPhase = 0
  let lastPhase: Phase | null = null
  for (let w = 1; w <= N; w++) {
    const phase = phases[w - 1]
    weekInPhase = phase === lastPhase ? weekInPhase + 1 : 0
    lastPhase = phase
    const weekStart = addDays(startMonday, 7 * (w - 1))
    const isRaceWeek = hasRun && !!raceDate && mondayOf(raceDate) === weekStart
    const pos = cyclePosition(w)
    const light = hasRun ? (volumes[w - 1]?.light ?? false) : pos === 8

    let list: Session[] = []
    if (hasRun && paces) {
      const vol = volumes[w - 1]
      const runs = buildRunWeek({
        distance: q.run.distance, level: q.run.level, paces, phase, weekInPhase, volume: vol,
        sessions: sessionsForVolume(runSessions, vol.km), maxMinutes: q.maxMinutes, withTest: paces.source === 'niveau', isFirstWeek: w === lead.noQuality + 1,
        // démarrage progressif : d'abord que de l'endurance, puis une seule séance de qualité, la seconde seulement ensuite
        maxQuality: !progressive ? 2 : w <= lead.noQuality ? 0 : w <= lead.weeks + 3 ? 1 : 2,
      })
      list.push(...(isRaceWeek ? runs.filter((s) => s.kind !== 'longue') : runs))
    }
    if (hasStrength && sCtx) {
      const strength = buildStrengthWeek(sCtx, w, {
        legFactor, minLegRir, maintenance: phase === 'Affûtage', injuries: q.injuries, light,
      })
      if (renfo && type === 'mixte') {
        addRunnerExtras(strength, {
          kit: renfo.kit, perWeek: renfo.perWeek as 1 | 2, level: q.strength.level, injuries: q.injuries, maxMinutes: q.maxMinutes, weekN: w, light, excluded: q.excludedMuscles,
        })
      }
      list.push(...strength)
    }
    if (renfo && type === 'course') {
      for (let k = 0; k < renfo.perWeek; k++) {
        const r = buildRenfoSession({ kit: renfo.kit, level: q.run.level, injuries: q.injuries, phase, weekN: w, light })
        if (r) list.push(r)
      }
    }

    // jours autorisés cette semaine (semaine de départ partielle, semaine de course)
    let allowed = (q.availableDays.length ? q.availableDays : [0, 1, 2, 3, 4, 5, 6]).filter((d) => addDays(weekStart, d) >= startDate)
    const fixed: Record<string, number> = {}
    if (isRaceWeek && raceDate) {
      const rd = weekday(raceDate)
      allowed = allowed.filter((d) => d < rd - 1 || (d === rd - 1 && rd - 1 < 0))
      if (allowed.length === 0) allowed = [0, 1, 2, 3, 4, 5, 6].filter((d) => d < rd - 1 && addDays(weekStart, d) >= startDate)
      const dist = DIST_KM[q.run.distance]
      const target = q.run.objective === 'chrono' && q.run.targetSeconds ? q.run.targetSeconds : undefined
      const pace = target ? target / dist : paces ? (q.run.distance === '10k' ? paces.dix : q.run.distance === 'semi' ? paces.semi : paces.marathon) : 360
      const race: Session = {
        id: uid('s'), weekN: w, date: raceDate, sport: 'course', kind: 'course', status: 'prevue',
        title: `Course : ${DIST_LABEL[q.run.distance]}`, estMinutes: Math.round((pace * dist) / 60),
        run: {
          warmup: 'Échauffement 10–15 min facile, quelques accélérations, 10 minutes avant le départ.',
          blocks: [{ label: DIST_LABEL[q.run.distance], meters: Math.round(dist * 1000), paceSec: pace }],
          cooldown: 'Marche, étirements, bois et mange.', totalKm: dist, estMinutes: Math.round((pace * dist) / 60),
        },
        note: target ? `Objectif ${fmtTime(target)} (${fmtPace(pace)}/km)` : 'Objectif : finir en prenant du plaisir.',
      }
      list.push(race)
      fixed[race.id] = rd
    }
    const partial = w === 1 || isRaceWeek
    const slotsLeft = (allowed.length || 0) + (isRaceWeek ? 1 : 0)
    if (partial && allowed.length < 7) {
      // on garde au plus ~1 séance/jour sur une semaine tronquée, en sautant les moins prioritaires
      const cap = Math.max(1, allowed.length + (isRaceWeek ? 1 : 0) + (list.length > allowed.length * 2 ? 0 : 1))
      void slotsLeft
      list = [...list].sort((a, b) => dropOrder(a) - dropOrder(b)).slice(0, Math.max(cap, 1))
    }
    const used = allowed.length ? allowed : [0, 1, 2, 3, 4, 5, 6].filter((d) => addDays(weekStart, d) >= startDate)
    const prefs = q.dayPrefs ?? {}
    const longDay = hasRun ? prefs.longRun : undefined
    const placed = placeWeek(list, weekStart, used, fixed,
      { prevSundayLong: carryLong, nextMondayLong: longDay === 0 && !isRaceWeek, longDayChosen: longDay !== undefined },
      { muscu: prefs.muscu, run: prefs.run, longRun: longDay })
    if (placed.conflicts.length && w > 1) {
      // trace unique par type de conflit pour ne pas inonder
      const msg = placed.conflicts[0]
      if (!warnings.some((x) => x.code === 'conflit_placement')) {
        warnings.push({ code: 'conflit_placement', message: `Semaine ${w} : ${msg} Ajoute un jour disponible pour l'éviter.` })
      }
    }
    carryLong = placed.sessions.some((s) => s.kind === 'longue' && weekday(s.date) === 6)

    weeks.push({
      n: w, startDate: weekStart, phase, light, sessions: placed.sessions,
      note: defaultWeekNote(phase, light, w, q, isRaceWeek, progressive ? (w <= lead.noQuality ? 'endurance' : w <= lead.weeks ? 'intro' : undefined) : undefined),
    })
  }

  if (renfo) finalizeRenfo(weeks, q, renfo, type, warnings)

  if (hasRun && paces && q.run.peakKm && q.run.peakKm > 0) {
    const o = volumeOutlook(q.run, phases, runSessions, priorityFactor)
    const fmt = (x: number) => String(Math.round(x)).replace('.', ',')
    const real = Math.max(0, ...weeks.filter((w) => w.phase !== 'Affûtage').map((w) => w.sessions.reduce((a, s) => a + (s.run?.totalKm ?? 0), 0)))
    if (!o.ok) {
      const need = Math.ceil(Math.log(o.target / o.from) / Math.log(MAX_RUN_VOLUME_JUMP)) + 1
      warnings.push({
        code: 'pic_non_atteint',
        message: `Pic visé : ${fmt(o.target)} km/semaine, mais tu en fais ${fmt(o.from)} aujourd'hui. Monter de plus de 10 % par semaine expose à la blessure : en ${N} semaines, ton pic sera d'environ ${fmt(o.reachable)} km.`,
        suggestion: `Il faudrait environ ${need + Math.floor(need / 3) + 3} semaines de préparation pour atteindre ${fmt(o.target)} km, ou viser ${fmt(o.reachable)} km.`,
      })
    } else if (real < o.target * 0.9) {
      warnings.push({
        code: 'pic_non_atteint',
        message: `Pic visé : ${fmt(o.target)} km/semaine, mais avec ${runSessions} sorties de ${q.maxMinutes} minutes maximum, le plan plafonne autour de ${fmt(real)} km.`,
        suggestion: 'Ajouter une sortie par semaine ou allonger la durée maximale par séance permettrait de l\'atteindre.',
      })
    }
  }

  const goal = q.strength.goal
  return {
    id: uid('p'), clientId: opts.clientId ?? '', type, goal, priority: q.priority, startDate,
    raceDate, raceDistance: hasRun ? q.run.distance : undefined, targetSeconds: hasRun ? q.run.targetSeconds : undefined,
    objective: hasRun ? q.run.objective : undefined, status: 'actif', weeks, paces, warnings,
    split: sCtx?.split, cycle: 1, createdAt: new Date().toISOString(), q,
  }
}

/** Cycle suivant de musculation : 8 nouvelles semaines après la fin du programme. */
export function nextStrengthCycle(prev: Program, today = todayISO()): Program {
  const q: Questionnaire = { ...prev.q, startDate: addDays(mondayOf(today), 7), programType: 'muscu' }
  const next = generateProgram(q, { clientId: prev.clientId, now: today })
  next.cycle = prev.cycle + 1
  return next
}

export function splitLabel(p: Program): string {
  return p.split ? SPLIT_LABEL[p.split] : ''
}

export function muscleLabel(m: keyof typeof MUSCLE_LABEL): string {
  return MUSCLE_LABEL[m]
}
export const LOWER = LOWER_MUSCLES

/** Régénère la suite du programme (objectif, date de course, réponses modifiés) en conservant l'historique. */
export function regenerateProgram(old: Program, q: Questionnaire, today: string): Program {
  const fresh = generateProgram({ ...q, startDate: today }, { clientId: old.clientId, now: today })
  const monday = mondayOf(today)
  const keep = old.weeks.filter((w) => addDays(w.startDate, 6) < monday)
  const curOld = old.weeks.find((w) => w.startDate === monday)
  const offset = keep.length
  fresh.weeks.forEach((w) => {
    w.n += offset
    w.sessions.forEach((s) => (s.weekN = w.n))
  })
  if (curOld && fresh.weeks[0] && fresh.weeks[0].startDate === curOld.startDate) {
    const past = curOld.sessions.filter((s) => s.date < today).map((s) => ({ ...s, weekN: fresh.weeks[0].n }))
    fresh.weeks[0].sessions = [...past, ...fresh.weeks[0].sessions]
  }
  fresh.weeks = [...keep, ...fresh.weeks]
  fresh.id = old.id
  fresh.startDate = old.startDate
  fresh.cycle = old.cycle
  return fresh
}
