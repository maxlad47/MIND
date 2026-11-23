// Mode libre (« J'ai déjà mon programme ») : MIND ne génère rien, il sert de carnet d'entraînement.
// Séances modèles, planning (jours fixes ou rotation), fenêtre glissante, séances en plus, différences séance / modèle.
// Fonctions pures : elles renvoient un nouveau programme, sans toucher à l'original.

import { nextLoad, weekStats } from './adapt'
import { generateProgram } from './program'
import { exerciseOf, isTimed } from './exercises'
import { describePlan, FORMAT_LABEL, GROUP_LABEL, normalizeGroups } from './formats'
import { epley, estimateSessionMinutes } from './strength'
import type {
  ExerciseGroup, GroupSpec, LibrePlan, LibrePlanning, PlannedSet, Program, Questionnaire, Session, SessionExercise, SessionTemplate, TemplateExercise,
} from './types'
import { addDays, DAY_NAMES, mondayOf, uid, weekday } from './utils'

/** Nombre de semaines générées d'avance (fenêtre glissante : un programme libre n'a pas de fin de cycle). */
export const WEEKS_AHEAD = 4

export const isLibre = (p?: Pick<Program, 'mode'> | null): boolean => p?.mode === 'libre'

export const hasLogs = (s: Session): boolean => (s.exercises ?? []).some((e) => e.logs.length > 0)

// ------------------------------------------------------------------ séances modèles

export function emptyPlanning(): LibrePlanning {
  return { mode: 'fixe', days: [null, null, null, null, null, null, null] }
}

export function newTemplate(name = ''): SessionTemplate {
  return { id: uid('tpl'), name, exercises: [] }
}

/** Un exercice de modèle avec des valeurs de départ raisonnables (modifiables par le client). */
export function newTemplateExercise(exerciseId: string): TemplateExercise {
  const ex = exerciseOf(exerciseId)
  // exercice en durée (gainage…) : la cible est en secondes
  if (isTimed(exerciseId)) return { id: uid('te'), exerciseId, sets: 3, repMin: 30, repMax: 45, restSec: 60 }
  return { id: uid('te'), exerciseId, sets: 3, repMin: ex.compound ? 6 : 10, repMax: ex.compound ? 10 : 15, restSec: ex.compound ? 120 : 75 }
}

export function duplicateTemplate(t: SessionTemplate): SessionTemplate {
  const ids = new Map(t.exercises.map((e) => [e.id, uid('te')]))
  return {
    id: uid('tpl'), name: `${t.name} (copie)`, exercises: t.exercises.map((e) => ({ ...structuredClone(e), id: ids.get(e.id)! })),
    ...(t.groups?.length ? { groups: t.groups.map((g) => ({ ...g, id: uid('g'), exerciseIds: g.exerciseIds.map((x) => ids.get(x) ?? x) })) } : {}),
  }
}

/** Séries détaillées d'un modèle, sans charge absolue : les charges ne sont jamais copiées d'une séance à l'autre. */
const withoutKg = (plan: PlannedSet[]): PlannedSet[] => plan.map((set) => ({ parts: set.parts.map(({ kg: _kg, ...p }) => p) }))

function exercisesFromTemplate(t: SessionTemplate, sessionId: string): { exercises: SessionExercise[]; groups: ExerciseGroup[] } {
  const exercises: SessionExercise[] = t.exercises.map((te, i) => ({
    id: `${sessionId}.${te.id}`, exerciseId: te.exerciseId, order: i, sets: te.sets, repMin: te.repMin, repMax: te.repMax,
    rir: te.rir ?? 2, restSec: te.restSec, logs: [],
    ...(te.rir === undefined ? { noRir: true } : {}), ...(te.note ? { note: te.note } : {}),
    ...(te.kg ? { targetKg: te.kg, fixedKg: true } : {}),
    ...(te.plan?.length ? { plan: structuredClone(te.plan), format: te.format } : {}),
  }))
  const groups: ExerciseGroup[] = (t.groups ?? []).map((g) => ({ ...g, id: `${sessionId}.${g.id}`, exerciseIds: g.exerciseIds.map((x) => `${sessionId}.${x}`) }))
  return { exercises, groups }
}

/** Séance (exercices + groupes) à partir d'un modèle ; les groupes sont remis en cohérence (nombre de tours, exercices manquants). */
function buildFromTemplate(t: SessionTemplate, sessionId: string): { exercises: SessionExercise[]; groups?: ExerciseGroup[] } {
  const { exercises, groups } = exercisesFromTemplate(t, sessionId)
  const tmp: Session = { id: sessionId, weekN: 0, date: '', sport: 'muscu', kind: 'fullbody', title: '', status: 'prevue', estMinutes: 0, exercises, ...(groups.length ? { groups } : {}) }
  normalizeGroups(tmp)
  return { exercises, ...(tmp.groups ? { groups: tmp.groups } : {}) }
}

export function templateMinutes(t: SessionTemplate): number {
  const b = buildFromTemplate(t, 'x')
  return estimateSessionMinutes(b.exercises, b.groups)
}

export function sessionFromTemplate(t: SessionTemplate, date: string, weekN: number, extra = false): Session {
  const id = uid('s')
  const { exercises, groups } = buildFromTemplate(t, id)
  return {
    id, weekN, date, sport: 'muscu', kind: 'fullbody', title: t.name || 'Séance', status: 'prevue',
    estMinutes: estimateSessionMinutes(exercises, groups), exercises, ...(groups ? { groups } : {}), templateId: t.id, ...(extra ? { extra: true } : {}),
  }
}

function refresh(s: Session, t: SessionTemplate): void {
  s.templateId = t.id
  s.title = t.name || 'Séance'
  const b = buildFromTemplate(t, s.id)
  s.exercises = b.exercises
  if (b.groups) s.groups = b.groups
  else delete s.groups
  s.estMinutes = estimateSessionMinutes(s.exercises, s.groups)
}

// ------------------------------------------------------------------ programme libre

export function newLibreProgram(q: Questionnaire, o: {
  clientId: string; now: string; templates?: SessionTemplate[]; planning?: LibrePlanning; customExercises?: LibrePlan['customExercises']; suggestLoads?: boolean
}): Program {
  const libre: LibrePlan = {
    templates: o.templates ?? [], planning: o.planning ?? emptyPlanning(), suggestLoads: o.suggestLoads ?? false,
    customExercises: o.customExercises ?? [],
  }
  const p: Program = {
    id: uid('p'), clientId: o.clientId, mode: 'libre', libre, type: 'muscu', goal: q.strength.goal, priority: 'equilibre',
    startDate: o.now, status: 'actif', weeks: [], warnings: [], cycle: 1, createdAt: new Date().toISOString(),
    q: { ...q, mode: 'libre', programType: q.programType === 'muscu' ? 'muscu' : 'mixte' },
  }
  // muscu libre + course MIND : le plan de course est généré par le moteur et inséré dans les mêmes semaines
  return syncFree(hasRunPlan(q) ? applyRunPlan(p, p.q, o.now) : p, o.now)
}

function allOf(p: Program): Session[] {
  return p.weeks.flatMap((w) => w.sessions)
}

/** Crée les semaines manquantes jusqu'à `ahead` semaines après la semaine en cours (les semaines passées restent vides). */
function ensureWeeks(p: Program, today: string, ahead: number, minLast = ''): void {
  const last = [mondayOf(addDays(today, 7 * ahead)), minLast].sort().pop()!
  let monday = p.weeks.length ? addDays(p.weeks[p.weeks.length - 1].startDate, 7) : mondayOf(p.startDate < today ? p.startDate : today)
  while (monday <= last) {
    p.weeks.push({ n: p.weeks.length + 1, startDate: monday, phase: 'Musculation', light: false, sessions: [] })
    monday = addDays(monday, 7)
  }
}

/** Une séance prévue passée devient « manquée » (sans décalage ni rattrapage). Une séance en plus jamais commencée disparaît. */
function settlePast(p: Program, today: string): void {
  for (const w of p.weeks) {
    w.sessions = w.sessions.filter((s) => !(s.extra && s.status === 'prevue' && s.date < today && !hasLogs(s)))
    // les séances de course d'un plan MIND restent à `handleMissed` (déplacement des séances clés) ; seule la muscu libre est simplement « manquée »
    for (const s of w.sessions) if (s.status === 'prevue' && s.date < today && (s.sport === 'muscu' || s.extra)) s.status = 'manquee'
  }
}

// ------------------------------------------------------------------ course MIND dans un carnet libre

export const hasRunPlan = (q: Pick<Questionnaire, 'programType'>): boolean => q.programType !== 'muscu'

/**
 * Muscu libre + course MIND : (re)génère le plan de course d'après le formulaire et l'insère dans les semaines du carnet.
 * Les séances de course déjà faites, manquées ou en plus restent ; les séances de course futures prévues sont remplacées.
 * Sans course dans le formulaire, le plan de course futur est simplement retiré.
 */
export function applyRunPlan(program: Program, q: Questionnaire, today: string): Program {
  const p = structuredClone(program)
  for (const w of p.weeks) w.sessions = w.sessions.filter((s) => !(s.sport === 'course' && !s.extra && s.status === 'prevue' && s.date >= today))
  if (!hasRunPlan(q)) {
    p.type = 'muscu'
    p.paces = undefined; p.raceDate = undefined; p.raceDistance = undefined; p.targetSeconds = undefined; p.objective = undefined
    p.warnings = []
    p.q = { ...q, mode: 'libre', programType: 'muscu' }
    return p
  }
  const run = generateProgram({ ...q, mode: 'genere', programType: 'course', availableDays: q.dayPrefs?.run ?? q.availableDays, startDate: today }, { clientId: p.clientId, now: today })
  p.type = 'mixte'
  p.paces = run.paces; p.raceDate = run.raceDate; p.raceDistance = run.raceDistance; p.targetSeconds = run.targetSeconds; p.objective = run.objective
  p.warnings = run.warnings
  p.q = { ...q, mode: 'libre', programType: 'mixte' }
  ensureWeeks(p, today, WEEKS_AHEAD, run.weeks[run.weeks.length - 1].startDate)
  for (const rw of run.weeks) {
    const w = p.weeks.find((x) => x.startDate === rw.startDate)
    if (!w) continue
    w.sessions.push(...rw.sessions.map((s) => ({ ...s, weekN: w.n })))
    w.sessions.sort((a, b) => a.date.localeCompare(b.date))
    w.phase = rw.phase; w.light = rw.light; w.note = rw.note
  }
  return p
}

// ------------------------------------------------------------------ planning

export interface Slot { date: string; templateId: string }

/**
 * Séances à placer entre `today` et `horizon` selon le planning.
 *
 * - Jours fixes : chaque jour de la semaine est associé à un modèle.
 * - Rotation : les modèles s'enchaînent A → B → C → A… sur les jours cochés. Le curseur part du dernier modèle FAIT :
 *   une séance manquée ou sautée ne consomme donc jamais son tour.
 * Les séances déjà faites, commencées, sautées ou déplacées à la main ne sont jamais remplacées : elles bloquent leur créneau.
 * Les séances « en plus » sont ignorées (elles ne décalent pas le planning).
 */
export function slotsFor(plan: LibrePlan, sessions: Session[], today: string, horizon: string): Slot[] {
  const tpls = new Set(plan.templates.map((t) => t.id))
  const own = sessions.filter((s) => s.templateId && !s.extra)
  const isFree = (s: Session) => s.status === 'prevue' && !hasLogs(s) && !s.movedFrom && s.date >= today
  const pinned = own.filter((s) => s.status === 'prevue' && s.movedFrom && s.date >= today && !hasLogs(s))
  const blocked = new Set<string>([
    ...own.filter((s) => !isFree(s) && !pinned.includes(s)).map((s) => s.date),
    ...pinned.map((s) => s.movedFrom!),
  ])
  const consumers = own.filter((s) => s.status === 'faite' || hasLogs(s) || pinned.includes(s))

  const rot = plan.planning.mode === 'rotation' ? plan.planning : null
  const order = rot ? rot.order.filter((id) => tpls.has(id)) : []
  let cursor = -1
  if (rot) {
    const lastDone = consumers.filter((s) => s.date < today).sort((a, b) => a.date.localeCompare(b.date) || (a.doneAt ?? '').localeCompare(b.doneAt ?? '')).pop()
    if (lastDone) cursor = order.indexOf(lastDone.templateId!)
  }

  const out: Slot[] = []
  for (let d = today; d <= horizon; d = addDays(d, 1)) {
    if (rot) for (const s of consumers.filter((x) => x.date === d)) { const i = order.indexOf(s.templateId!); if (i >= 0) cursor = i }
    if (blocked.has(d)) continue
    if (plan.planning.mode === 'fixe') {
      const id = plan.planning.days[weekday(d)]
      if (id && tpls.has(id)) out.push({ date: d, templateId: id })
    } else if (rot && order.length && rot.days.includes(weekday(d))) {
      cursor = (cursor + 1) % order.length
      out.push({ date: d, templateId: order[cursor] })
    }
  }
  return out
}

/** Prévisualisation du planning en cours d'édition, à partir de l'état réel du carnet (prochaines séances). */
export function previewPlanning(p: Program, planning: LibrePlanning, today: string, days = 14): Slot[] {
  if (!p.libre) return []
  return slotsFor({ ...p.libre, planning }, allOf(p), today, addDays(today, days - 1))
}

export function trainingDays(planning: LibrePlanning): number[] {
  return planning.mode === 'fixe'
    ? planning.days.map((id, i) => (id ? i : -1)).filter((i) => i >= 0)
    : [...planning.days].sort()
}

export function describePlanning(plan: LibrePlan): string {
  const name = (id: string | null) => plan.templates.find((t) => t.id === id)?.name
  const pl = plan.planning
  if (pl.mode === 'fixe') {
    const parts = pl.days.map((id, i) => (name(id) ? `${DAY_NAMES[i].slice(0, 3)}. ${name(id)}` : '')).filter(Boolean)
    return parts.length ? parts.join(' · ') : 'Aucun jour réglé'
  }
  const names = pl.order.map((id) => name(id)).filter(Boolean)
  if (!pl.days.length || !names.length) return 'Aucun jour réglé'
  return `${pl.days.length}×/semaine : ${names.join(' → ')}${names.length > 1 ? ' → …' : ''}`
}

// ------------------------------------------------------------------ synchronisation du carnet

/**
 * Remet le carnet d'un programme libre à jour :
 *  1. les séances prévues passées deviennent « manquées » (aucun décalage, aucune semaine allégée) ;
 *  2. la fenêtre glissante couvre la semaine en cours + `WEEKS_AHEAD` semaines ;
 *  3. les séances futures prévues SANS aucune série saisie sont recalculées d'après les modèles et le planning
 *     (les séances passées, faites, commencées ou « en plus » ne bougent jamais ; une séance déplacée à la main garde sa date) ;
 *  4. les charges suggérées sont recalculées (ou retirées si l'interrupteur est désactivé).
 * `history` : séances d'autres programmes du même client (historique conservé après un changement de mode).
 */
export function syncFree(program: Program, today: string, o: { weeksAhead?: number; history?: Session[] } = {}): Program {
  if (!isLibre(program) || !program.libre) return program
  const p = structuredClone(program)
  const plan = p.libre!
  settlePast(p, today)
  const ahead = o.weeksAhead ?? WEEKS_AHEAD
  ensureWeeks(p, today, ahead)
  // la fenêtre glissante ne concerne que la muscu libre (un plan de course MIND peut aller jusqu'à la date de course)
  const horizon = addDays(mondayOf(addDays(today, 7 * ahead)), 6)
  const slots = slotsFor(plan, allOf(p), today, horizon)
  const wanted = new Map(slots.map((s) => [s.date, s.templateId]))
  const tpl = new Map(plan.templates.map((t) => [t.id, t]))

  const kept = new Set<string>()
  for (const w of p.weeks) {
    w.sessions = w.sessions.filter((s) => {
      if (!s.templateId || s.extra || s.status !== 'prevue' || s.date < today || s.date > horizon || hasLogs(s)) return true
      if (s.movedFrom) { const t = tpl.get(s.templateId); if (t) refresh(s, t); return !!t }
      const id = wanted.get(s.date)
      if (!id || kept.has(s.date)) return false
      refresh(s, tpl.get(id)!)
      kept.add(s.date)
      return true
    })
  }
  for (const sl of slots) {
    if (kept.has(sl.date)) continue
    const w = p.weeks.find((x) => x.startDate === mondayOf(sl.date))
    if (w) w.sessions.push(sessionFromTemplate(tpl.get(sl.templateId)!, sl.date, w.n))
  }
  for (const w of p.weeks) w.sessions.sort((a, b) => a.date.localeCompare(b.date))

  const runDays = p.type === 'mixte' ? (p.q.dayPrefs?.run ?? []) : []
  p.q = { ...p.q, availableDays: [...new Set([...trainingDays(plan.planning), ...runDays])].sort(), muscuSessions: Math.max(1, trainingDays(plan.planning).length) }
  applySuggestions(p, today, o.history)
  return p
}

/**
 * « Suggestions de charge ». Activées : `targetKg` des séances futures = double progression du moteur (`nextLoad`, adapt.ts),
 * d'après la dernière performance du même exercice. Désactivées : aucune charge cible.
 */
function applySuggestions(p: Program, today: string, history: Session[] = []): void {
  const on = !!p.libre?.suggestLoads
  const last = new Map<string, SessionExercise[]>()
  if (on) {
    const done = [...history, ...allOf(p)].filter((s) => s.status === 'faite').sort((a, b) => a.date.localeCompare(b.date))
    for (const s of done) for (const e of s.exercises ?? []) if (e.logs.length) last.set(e.exerciseId, [...(last.get(e.exerciseId) ?? []).slice(-1), e])
  }
  for (const s of allOf(p)) {
    if (s.status !== 'prevue' || s.date < today) continue
    for (const e of s.exercises ?? []) {
      if (e.logs.length || e.fixedKg) continue
      const inst = on ? last.get(e.exerciseId) : undefined
      const res = inst ? nextLoad(inst[inst.length - 1], inst.length > 1 ? inst[0] : undefined) : null
      e.targetKg = res && res.kg > 0 ? res.next : undefined
    }
  }
}

// ------------------------------------------------------------------ séance en plus

export type ExtraSource = { templateId: string } | 'vide' | 'course'

/** « Séance en plus » : datée d'aujourd'hui, hors planning (elle ne décale rien et ne fait pas avancer la rotation). */
export function withExtraSession(program: Program, today: string, src: ExtraSource, history?: Session[]): { program: Program; sessionId: string } {
  const p = structuredClone(program)
  if (isLibre(p)) ensureWeeks(p, today, WEEKS_AHEAD)
  const w = p.weeks.find((x) => x.startDate === mondayOf(today))
  if (!w) return { program, sessionId: '' } // programme MIND terminé : pas de semaine du jour
  let s: Session
  if (src === 'course') {
    s = {
      id: uid('s'), weekN: w.n, date: today, sport: 'course', kind: 'ef', title: 'Sortie libre', status: 'prevue', estMinutes: 0, extra: true,
      run: { warmup: '', blocks: [], cooldown: '', totalKm: 0, estMinutes: 0 },
    }
  } else if (src === 'vide') {
    s = { id: uid('s'), weekN: w.n, date: today, sport: 'muscu', kind: 'fullbody', title: 'Séance libre', status: 'prevue', estMinutes: 8, exercises: [], extra: true }
  } else {
    const t = p.libre?.templates.find((x) => x.id === src.templateId)
    s = t ? sessionFromTemplate(t, today, w.n, true) : { id: uid('s'), weekN: w.n, date: today, sport: 'muscu', kind: 'fullbody', title: 'Séance libre', status: 'prevue', estMinutes: 8, exercises: [], extra: true }
  }
  w.sessions.push(s)
  w.sessions.sort((a, b) => a.date.localeCompare(b.date))
  if (isLibre(p)) applySuggestions(p, today, history)
  return { program: p, sessionId: s.id }
}

/** Séance de course libre : on saisit seulement km, temps et ressenti. */
export const isFreeRun = (s: Session): boolean => s.sport === 'course' && !!s.extra && !!s.run && s.run.blocks.length === 0

// ------------------------------------------------------------------ différences séance / modèle

export interface TemplateChange { kind: 'ajoute' | 'retire' | 'remplace' | 'ordre' | 'series' | 'reps' | 'repos' | 'format' | 'groupe'; text: string }

const fmtRest = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
const repsLabel = (min: number, max: number) => (min === max ? `${min}` : `${min}–${max}`)

interface Pairing { pairs: { se: SessionExercise; te: TemplateExercise }[]; added: SessionExercise[]; removed: TemplateExercise[] }

function pairUp(s: Session, t: SessionTemplate): Pairing {
  const free = [...t.exercises]
  const pairs: Pairing['pairs'] = []
  const added: SessionExercise[] = []
  for (const se of s.exercises ?? []) {
    const i = free.findIndex((te) => te.exerciseId === se.exerciseId)
    if (i >= 0) pairs.push({ se, te: free.splice(i, 1)[0] })
    else added.push(se)
  }
  return { pairs, added, removed: free }
}

/** Structure des séries (parties, reps, durées, % de charge, repos entre parties) : sans les charges saisies ni le RIR. */
const planSig = (plan?: PlannedSet[]): string =>
  plan?.length ? JSON.stringify(plan.map((set) => set.parts.map((p) => [p.reps, p.repMax, p.seconds, p.pct, p.restAfterSec]))) : ''

interface GroupView { kind: GroupSpec['kind']; ids: string[]; sig: string; spec: GroupSpec }
const groupViews = (groups: GroupSpec[] | undefined, exercises: { id: string; exerciseId: string }[]): GroupView[] =>
  (groups ?? []).map((g) => {
    const ids = g.exerciseIds.map((id) => exercises.find((e) => e.id === id)?.exerciseId).filter((x): x is string => !!x)
    return { kind: g.kind, ids, spec: g, sig: [g.kind, ids.join(','), g.rounds, g.restBetweenSec, g.restAfterRoundSec, g.durationMin ?? ''].join('|') }
  }).filter((g) => g.ids.length > 0)
const groupText = (g: GroupView) => `${GROUP_LABEL[g.kind]} ${g.ids.map((id) => exerciseOf(id).name).join(' + ')}`
const groupParams = (g: GroupSpec) => (g.kind === 'emom' || g.kind === 'amrap' ? `${g.durationMin ?? '?'} min` : `${g.rounds} tour${g.rounds > 1 ? 's' : ''}`)

/**
 * Ce qui diffère entre la séance saisie et son modèle : exercice ajouté, retiré, remplacé ou réordonné, séries, reps ou repos changés,
 * format ou structure des séries (combo, dégressive…), groupes (superset, circuit, EMOM…).
 * Les charges saisies (et le RIR) ne comptent jamais comme des changements.
 */
export function diffSessionTemplate(s: Session, t: SessionTemplate): TemplateChange[] {
  const { pairs, added, removed } = pairUp(s, t)
  const out: TemplateChange[] = []
  const name = (id: string) => exerciseOf(id).name
  const n = Math.min(added.length, removed.length)
  for (let i = 0; i < n; i++) out.push({ kind: 'remplace', text: `${name(removed[i].exerciseId)} remplacé par ${name(added[i].exerciseId)}` })
  for (const se of added.slice(n)) out.push({ kind: 'ajoute', text: `${name(se.exerciseId)} ajouté` })
  for (const te of removed.slice(n)) out.push({ kind: 'retire', text: `${name(te.exerciseId)} retiré` })
  for (const { se, te } of pairs) {
    const nm = name(se.exerciseId)
    const fa = te.format ?? 'classique'
    const fb = se.format ?? 'classique'
    const structured = !!(se.plan?.length || te.plan?.length)
    if (se.sets !== te.sets) out.push({ kind: 'series', text: `${nm} : ${te.sets} → ${se.sets} séries` })
    if (fa !== fb) out.push({ kind: 'format', text: `${nm} : format ${FORMAT_LABEL[fa]} → ${FORMAT_LABEL[fb]}` })
    else if (structured && se.sets === te.sets && planSig(se.plan) !== planSig(te.plan)) out.push({ kind: 'format', text: `${nm} : séries modifiées (${describePlan(te)} → ${describePlan(se)})` })
    if (!structured && (se.repMin !== te.repMin || se.repMax !== te.repMax)) out.push({ kind: 'reps', text: `${nm} : ${repsLabel(te.repMin, te.repMax)} → ${repsLabel(se.repMin, se.repMax)} ${isTimed(se.exerciseId) ? 's' : 'reps'}` })
    if (se.restSec !== te.restSec) out.push({ kind: 'repos', text: `${nm} : repos ${fmtRest(te.restSec)} → ${fmtRest(se.restSec)}` })
  }
  const idx = pairs.map((x) => t.exercises.indexOf(x.te))
  if (idx.some((v, i) => i > 0 && v < idx[i - 1])) out.push({ kind: 'ordre', text: 'Ordre des exercices modifié' })
  // groupes : retirés, ajoutés ou modifiés (tours, repos, durée, ordre)
  const sg = groupViews(s.groups, s.exercises ?? [])
  const tg = groupViews(t.groups, t.exercises)
  const key = (g: GroupView) => [...g.ids].sort().join(',')
  const left = [...tg]
  for (const g of sg) {
    const i = left.findIndex((x) => key(x) === key(g))
    if (i < 0) { out.push({ kind: 'groupe', text: `${groupText(g)} : groupe ajouté` }); continue }
    const old = left.splice(i, 1)[0]
    if (old.sig !== g.sig) out.push({ kind: 'groupe', text: `${groupText(g)} : ${old.kind !== g.kind ? `${GROUP_LABEL[old.kind]} → ${GROUP_LABEL[g.kind]}` : `${groupParams(old.spec)} → ${groupParams(g.spec)}`}` })
  }
  for (const g of left) out.push({ kind: 'groupe', text: `${groupText(g)} : groupe retiré` })
  return out
}

/** Le modèle reprend la séance saisie (exercices, ordre, séries, reps, repos). Les charges ne sont jamais copiées. */
export function templateFromSession(s: Session, t: SessionTemplate): SessionTemplate {
  const { pairs } = pairUp(s, t)
  const teId = new Map<string, string>()
  const exercises: TemplateExercise[] = (s.exercises ?? []).map((se) => {
    const pair = pairs.find((x) => x.se.id === se.id)
    const id = pair?.te.id ?? uid('te')
    teId.set(se.id, id)
    return {
      id, exerciseId: se.exerciseId, sets: se.sets, repMin: se.repMin, repMax: se.repMax, restSec: se.restSec,
      ...(pair ? (pair.te.rir !== undefined ? { rir: pair.te.rir } : {}) : (se.noRir ? {} : { rir: se.rir })),
      ...(pair?.te.note ? { note: pair.te.note } : se.note ? { note: se.note } : {}),
      ...(pair?.te.kg ? { kg: pair.te.kg } : {}),
      ...(se.plan?.length ? { plan: withoutKg(se.plan), format: se.format } : {}),
    }
  })
  // groupes : les ids d'exercices de la séance redeviennent ceux du modèle ; l'id du groupe reprend celui du modèle s'il en vient
  const prefix = `${s.id}.`
  const groups: GroupSpec[] = (s.groups ?? []).map((g) => ({
    id: g.id.startsWith(prefix) ? g.id.slice(prefix.length) : g.id, kind: g.kind, exerciseIds: g.exerciseIds.map((x) => teId.get(x)).filter((x): x is string => !!x),
    rounds: g.rounds, restBetweenSec: g.restBetweenSec, restAfterRoundSec: g.restAfterRoundSec, ...(g.durationMin !== undefined ? { durationMin: g.durationMin } : {}),
  })).filter((g) => g.exerciseIds.length > 0)
  const { groups: _old, ...rest } = t
  return { ...rest, exercises, ...(groups.length ? { groups } : {}) }
}

// ------------------------------------------------------------------ passage d'un mode à l'autre

/**
 * MIND → Libre, « Partir de mon programme actuel » : un modèle par séance de muscu distincte de la semaine en cours,
 * et le planning en jours fixes correspondant.
 */
export function libreFromProgram(p: Program, today: string): { templates: SessionTemplate[]; planning: LibrePlanning } {
  const monday = mondayOf(today)
  const hasMuscu = (w: Program['weeks'][number]) => w.sessions.some((s) => s.sport === 'muscu' && s.status !== 'sautee' && (s.exercises?.length ?? 0) > 0)
  const week = p.weeks.find((w) => w.startDate === monday && hasMuscu(w))
    ?? [...p.weeks].filter(hasMuscu).sort((a, b) => Math.abs(Date.parse(a.startDate) - Date.parse(monday)) - Math.abs(Date.parse(b.startDate) - Date.parse(monday)))[0]
  const planning = emptyPlanning() as Extract<LibrePlanning, { mode: 'fixe' }>
  const templates: SessionTemplate[] = []
  if (!week) return { templates, planning }
  for (const s of [...week.sessions].sort((a, b) => a.date.localeCompare(b.date))) {
    if (s.sport !== 'muscu' || s.status === 'sautee' || !s.exercises?.length) continue
    let t = templates.find((x) => x.name === s.title)
    if (!t) {
      const ids = new Map(s.exercises.map((e) => [e.id, uid('te')]))
      t = {
        id: uid('tpl'), name: s.title,
        exercises: s.exercises.map((e) => ({
          id: ids.get(e.id)!, exerciseId: e.exerciseId, sets: e.sets, repMin: e.repMin, repMax: e.repMax, restSec: e.restSec, rir: e.rir,
          ...(e.note ? { note: e.note } : {}),
          ...(e.plan?.length ? { plan: withoutKg(e.plan), format: e.format } : {}),
        })),
        ...(s.groups?.length ? { groups: s.groups.map((g) => ({ id: uid('g'), kind: g.kind, exerciseIds: g.exerciseIds.map((x) => ids.get(x)!).filter(Boolean), rounds: g.rounds, restBetweenSec: g.restBetweenSec, restAfterRoundSec: g.restAfterRoundSec, ...(g.durationMin !== undefined ? { durationMin: g.durationMin } : {}) })) } : {}),
      }
      templates.push(t)
    }
    planning.days[weekday(s.date)] = t.id
  }
  return { templates, planning }
}

const MAIN_LIFTS: Record<'squat' | 'bench' | 'deadlift' | 'press', string> = {
  squat: 'squat_barre', bench: 'dev_couche_barre', deadlift: 'souleve_terre', press: 'dev_militaire_barre',
}

/** Libre → MIND : charges de référence estimées d'après l'historique (meilleure série des 16 dernières semaines, quand les exercices correspondent). */
export function estimateLiftsFromHistory(sessions: Session[], today: string): Questionnaire['strength']['lifts'] {
  const from = addDays(today, -112)
  const out: Questionnaire['strength']['lifts'] = {}
  for (const [lift, exId] of Object.entries(MAIN_LIFTS) as [keyof typeof MAIN_LIFTS, string][]) {
    let best: { kg: number; reps: number } | undefined
    for (const s of sessions) {
      if (s.status !== 'faite' || s.date < from) continue
      for (const e of s.exercises ?? []) {
        if (e.exerciseId !== exId) continue
        for (const l of e.logs) {
          if (l.kg > 0 && l.reps >= 1 && l.reps <= 12 && (!best || epley(l.kg, l.reps) > epley(best.kg, best.reps))) best = { kg: l.kg, reps: l.reps }
        }
      }
    }
    if (best) out[lift] = best
  }
  return out
}

// ------------------------------------------------------------------ bilan de la semaine

/** Bilan du dimanche en mode libre : un simple compte rendu, sans suggestion qui touche à la structure du programme. */
export function weekRecap(p: Program, weekN: number): string {
  const st = weekStats(p, weekN)
  const parts = [`${st.done} séance${st.done > 1 ? 's' : ''} sur ${st.planned} prévue${st.planned > 1 ? 's' : ''}.`]
  if (st.tonnage) parts.push(`Tonnage : ${Math.round(st.tonnage).toLocaleString('fr-FR')} kg.`)
  if (st.km) parts.push(`${(Math.round(st.km * 10) / 10).toString().replace('.', ',')} km courus.`)
  if (st.avgFeeling !== null) parts.push(`Ressenti moyen : ${st.avgFeeling.toFixed(1).replace('.', ',')}/10.`)
  if (st.planned > 0 && st.done >= st.planned) parts.push('Semaine complète : bravo.')
  return parts.join(' ')
}
