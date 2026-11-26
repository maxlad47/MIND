// Couche de données MIND. Mode local : tout est stocké dans le navigateur (localStorage),
// avec la même structure que le schéma Supabase (supabase/migrations). Voir README pour le passage en ligne.

import { useSyncExternalStore } from 'react'
import {
  applyCheckin, applySuggestion, adjustLoadsAfterSession, allSessions, findSession, handleMissed,
  ruleBasedWeeklyAnalysis, runReviewRules, scalePaces, suggestVmaUpdate, undoAdaptation,
} from '@/engine/adapt'
import { CUSTOM_PREFIX, exerciseOf, isTimed, makeCustomExercise, registerCustomExercises } from '@/engine/exercises'
import {
  applyFormat, applyGroupDefaults, doneSetsOf, nominalReps, syncRoundsFromMembers, FORMAT_DEFAULT_SETS, groupLogsBySet, groupMembers, isRoundsKind, isTimedKind, normalizeGroups, partOf, resizeSets, clearPlan, repRangeOf,
  type LastSet,
} from '@/engine/formats'
import { renfoTemplates } from '@/engine/renfo'
import {
  applyRunPlan, hasLogs, isFreeRun, isLibre, libreFromProgram, newLibreProgram, syncFree, templateFromSession, withExtraSession, weekRecap, type ExtraSource,
} from '@/engine/libre'
import { generateProgram, nextStrengthCycle, regenerateProgram } from '@/engine/program'
import { epley } from '@/engine/strength'
import type {
  Adaptation, Checkin, Exercise, ExerciseGroup, GarminLink, GarminSettings, GroupResult, GroupSpec, HealthDay, ImportedRun, ImportSource, LibrePlanning, Muscle, PlannedSet, Program,
  Questionnaire, RunBlock, RunData, RunLog, RunReason, RunRespect, Session, SessionExercise, SessionTemplate, SetFormat, SetLog, Zone,
} from '@/engine/types'
import { attachRun, detachRun, manualRun, pendingRuns, plannedMeasures, runIdOf } from '@/engine/runs'
import { roundRunPlan, vmaFromRecent } from '@/engine/running'
import { addDays, fmtKm, mondayOf, todayISO, uid, weekday } from '@/engine/utils'
import { skipRest } from './rest'
import { REMOTE } from './supabase'

export const COACH_EMAIL = (import.meta.env.VITE_COACH_EMAIL as string | undefined)?.toLowerCase() || 'coach@mind.app'

export type Role = 'coach' | 'client'
export interface User { id: string; email: string; pass: string; role: Role }
export interface Profile {
  id: string; role: Role; firstName: string; email: string; reminderTime: string
  theme: 'auto' | 'clair' | 'sombre'; notifications: boolean; createdAt: string; onboarded: boolean
}
export interface EditEntry { id: string; programId: string; clientId: string; by: Role; byName: string; text: string; at: string }
export interface Comment { id: string; sessionId: string; clientId: string; authorId: string; authorRole: Role; authorName: string; text: string; parentId?: string; at: string }
export interface AppNotification { id: string; userId: string; title: string; body: string; link?: string; at: string; read: boolean }
export interface PersonalRecord { id: string; clientId: string; exerciseId: string; kg: number; reps: number; e1rm: number; date: string; sessionId: string }
export interface Analysis { id: string; programId: string; clientId: string; weekN: number; summary: string; at: string; source: 'ia' | 'regles' }
export interface Draft { step: number; data: Partial<Questionnaire> }
export interface QuestionnaireRow { id: string; clientId: string; version: number; data: Questionnaire; at: string }

export interface DB {
  v: 1
  users: User[]
  profiles: Profile[]
  questionnaires: QuestionnaireRow[]
  drafts: Record<string, Draft>
  programs: Program[]
  checkins: Checkin[]
  adaptations: Adaptation[]
  edits: EditEntry[]
  comments: Comment[]
  records: PersonalRecord[]
  notifications: AppNotification[]
  analyses: Analysis[]
  /** Courses importées (montre Garmin, fichier .fit, saisie rapide). */
  importedRuns: ImportedRun[]
  /** Santé du jour (pas, sommeil) écrite par la synchro Garmin. */
  health: HealthDay[]
  /** Réglage du client : FC max. */
  garminSettings: GarminSettings[]
  /** Statut de la liaison Garmin (écrit par le serveur, sans secret). */
  garminLinks: GarminLink[]
  sessionUserId: string | null
  seeded: boolean
  lastJobs: Record<string, string>
}

// En ligne, le cache local a sa propre clé : il garde l'app utilisable sans réseau (salle de sport en sous-sol).
const KEY = REMOTE ? 'mind.db.remote.v1' : 'mind.db.v2'
const empty = (): DB => ({
  v: 1, users: [], profiles: [], questionnaires: [], drafts: {}, programs: [], checkins: [], adaptations: [],
  edits: [], comments: [], records: [], notifications: [], analyses: [], importedRuns: [], health: [], garminSettings: [], garminLinks: [], sessionUserId: null, seeded: false, lastJobs: {},
})

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...empty(), ...(JSON.parse(raw) as DB) }
  } catch { /* stockage indisponible */ }
  return empty()
}

let db: DB = load()
const listeners = new Set<() => void>()

/** Les exercices perso (mode libre) sont branchés sur la bibliothèque : tous les `exerciseId` se résolvent, y compris ceux des programmes archivés. */
function registerCustoms(d: DB): void {
  registerCustomExercises(d.programs.flatMap((p) => p.libre?.customExercises ?? []))
}
registerCustoms(db)

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* quota / mode privé */ }
}
let changeHook: (() => void) | null = null
/** Branché par la synchronisation en ligne : appelé après chaque modification locale. */
export function setChangeHook(fn: (() => void) | null): void { changeHook = fn }
export function mutate(fn: (d: DB) => void): void {
  const next = structuredClone(db)
  fn(next)
  db = next
  registerCustoms(db)
  persist()
  listeners.forEach((l) => l())
  changeHook?.()
}
/** Remplace les données sans déclencher d'envoi (données reçues du serveur). */
export function replaceDB(next: DB): void {
  db = next
  registerCustoms(db)
  persist()
  listeners.forEach((l) => l())
}
export const emptyDB = empty
export function getDB(): DB { return db }
export function useDB(): DB {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb) } }, () => db)
}
export function resetDB(): void {
  db = empty()
  registerCustoms(db)
  persist()
  listeners.forEach((l) => l())
}

// ------------------------------------------------------------------ auth

export function hashPw(str: string): string { return cyrb(str) }
function cyrb(str: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

export function currentUser(d = db): Profile | undefined {
  return d.profiles.find((p) => p.id === d.sessionUserId)
}

export function signUp(email: string, password: string, firstName: string): { ok: boolean; error?: string } {
  const e = email.trim().toLowerCase()
  if (!/^\S+@\S+\.\S+$/.test(e)) return { ok: false, error: 'Cette adresse email ne semble pas valide.' }
  if (password.length < 6) return { ok: false, error: 'Le mot de passe doit contenir au moins 6 caractères.' }
  if (db.users.some((u) => u.email === e)) return { ok: false, error: 'Un compte existe déjà avec cet email. Connecte-toi plutôt.' }
  const role: Role = e === COACH_EMAIL ? 'coach' : 'client'
  const id = uid('u')
  mutate((d) => {
    d.users.push({ id, email: e, pass: cyrb(password), role })
    d.profiles.push({
      id, role, firstName: firstName.trim() || e.split('@')[0], email: e, reminderTime: '18:00', theme: 'auto',
      notifications: false, createdAt: new Date().toISOString(), onboarded: false,
    })
    d.sessionUserId = id
  })
  return { ok: true }
}

export function signIn(email: string, password: string): { ok: boolean; error?: string } {
  const u = db.users.find((x) => x.email === email.trim().toLowerCase())
  if (!u || u.pass !== cyrb(password)) return { ok: false, error: 'Email ou mot de passe incorrect.' }
  mutate((d) => { d.sessionUserId = u.id })
  return { ok: true }
}
export function signOut(): void { skipRest(); mutate((d) => { d.sessionUserId = null }) } // le repos en cours s'arrête avec la session

export function updateProfile(id: string, patch: Partial<Profile>): void {
  mutate((d) => {
    const p = d.profiles.find((x) => x.id === id)
    if (p) Object.assign(p, patch)
  })
}

/**
 * Retire de `d` un client et tout ce qui lui appartient (compte, formulaires, programmes, séances, commentaires,
 * records, courses, santé, réglages Garmin), ainsi que les notifications du coach qui pointent vers sa fiche.
 */
export function purgeClient(d: DB, clientId: string): void {
  const link = `/coach/client/${clientId}`
  const mine = <T extends { clientId: string }>(xs: T[]) => xs.filter((x) => x.clientId !== clientId)
  d.users = d.users.filter((u) => u.id !== clientId)
  d.profiles = d.profiles.filter((p) => p.id !== clientId)
  d.questionnaires = mine(d.questionnaires)
  delete d.drafts[clientId]
  d.programs = mine(d.programs)
  d.checkins = mine(d.checkins)
  d.adaptations = mine(d.adaptations)
  d.edits = mine(d.edits)
  d.comments = mine(d.comments)
  d.records = mine(d.records)
  d.analyses = mine(d.analyses)
  d.importedRuns = mine(d.importedRuns)
  d.health = mine(d.health)
  d.garminSettings = mine(d.garminSettings)
  d.garminLinks = mine(d.garminLinks)
  d.notifications = d.notifications.filter((n) => n.userId !== clientId && n.link !== link)
}

/** Mode démo : le coach supprime un client. En ligne, passer par `deleteClientRemote` (le serveur efface le compte). */
export function deleteClientLocal(clientId: string): boolean {
  const target = db.profiles.find((p) => p.id === clientId)
  if (!target || target.role === 'coach' || currentUser()?.role !== 'coach') return false
  mutate((d) => purgeClient(d, clientId))
  return true
}

// ------------------------------------------------------------------ sélecteurs

export const programOf = (d: DB, clientId: string): Program | undefined =>
  d.programs.find((p) => p.clientId === clientId && p.status === 'actif')

export const questionnaireOf = (d: DB, clientId: string): Questionnaire | undefined =>
  [...d.questionnaires].filter((q) => q.clientId === clientId).sort((a, b) => b.version - a.version)[0]?.data

export function clientsOf(d: DB): Profile[] {
  return d.profiles.filter((p) => p.role === 'client')
}

export function nameOf(d: DB, id: string): string {
  return d.profiles.find((p) => p.id === id)?.firstName ?? 'Quelqu’un'
}

export type ClientStatus = 'actif' | 'en_retard' | 'decroche' | 'nouveau'
export interface ClientSummary {
  profile: Profile; program?: Program; status: ClientStatus; lastDone?: string; weekDone: number; weekPlanned: number
  alerts: { kind: 'douleur' | 'suggestion' | 'decroche' | 'commentaire'; text: string; at: string }[]
}

export function lastDoneDate(p?: Program): string | undefined {
  if (!p) return undefined
  return allSessions(p).filter((s) => s.status === 'faite').map((s) => s.date).sort().pop()
}

export function summarizeClient(d: DB, profile: Profile, today = todayISO()): ClientSummary {
  const program = programOf(d, profile.id)
  // dernière séance toutes périodes confondues : elle survit à un changement de mode (programme archivé)
  const last = clientSessions(d, profile.id).filter((s) => s.status === 'faite').map((s) => s.date).sort().pop() ?? lastDoneDate(program)
  const monday = mondayOf(today)
  const w = program?.weeks.find((x) => x.startDate === monday)
  const planned = (w?.sessions ?? []).filter((s) => s.status !== 'sautee').length
  const done = (w?.sessions ?? []).filter((s) => s.status === 'faite').length
  const alerts: ClientSummary['alerts'] = []
  d.checkins.filter((c) => c.clientId === profile.id && c.pain && c.date >= addDays(today, -7)).forEach((c) =>
    alerts.push({ kind: 'douleur', text: `Douleur signalée (${c.painZone ?? 'zone non précisée'})`, at: c.date }))
  d.adaptations.filter((a) => a.clientId === profile.id && a.status === 'propose').forEach((a) =>
    alerts.push({ kind: 'suggestion', text: a.text, at: a.date }))
  let status: ClientStatus = 'actif'
  if (!program) status = 'nouveau'
  else {
    const since = last ?? program.startDate
    const gap = Math.round((Date.parse(today) - Date.parse(since)) / 86400000)
    const missed = allSessions(program).filter((s) => s.status === 'manquee' && s.date >= addDays(today, -7)).length
    if (gap >= 7 && today > addDays(program.startDate, 6)) status = 'decroche'
    else if (missed >= 1) status = 'en_retard'
  }
  if (status === 'decroche') alerts.push({ kind: 'decroche', text: 'Aucune séance depuis 7 jours', at: today })
  return { profile, program, status, lastDone: last, weekDone: done, weekPlanned: planned, alerts }
}

/** Toutes les séances d'un client, tous programmes confondus (actif et archivés) : l'historique survit aux changements de mode. */
export function clientSessions(d: DB, clientId: string): Session[] {
  return d.programs.filter((p) => p.clientId === clientId).flatMap(allSessions)
}

/** Dernière performance d'un exercice : les logs, et les séries regroupées partie par partie (« 1 × 100 kg + 6 × 80 kg »). */
export function lastPerformance(d: DB, clientId: string, exerciseId: string, beforeSessionId: string): { date: string; logs: SetLog[]; sets: LastSet[] } | undefined {
  const all = clientSessions(d, clientId)
  const cur = all.find((s) => s.id === beforeSessionId)
  const found = all
    .filter((s) => s.status === 'faite' && s.id !== beforeSessionId && (!cur || s.date <= cur.date))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((s) => ({ s, e: s.exercises?.find((x) => x.exerciseId === exerciseId && x.logs.length) }))
    .find((x) => x.e)
  return found ? { date: found.s.date, logs: found.e!.logs, sets: groupLogsBySet(found.e!.logs) } : undefined
}

/** Exercices perso d'un client (tous programmes confondus, sans doublon). */
export function customExercisesOf(d: DB, clientId: string): Exercise[] {
  const seen = new Map<string, Exercise>()
  for (const p of d.programs.filter((x) => x.clientId === clientId)) for (const e of p.libre?.customExercises ?? []) if (!seen.has(e.id)) seen.set(e.id, e)
  return [...seen.values()]
}

// ------------------------------------------------------------------ helpers internes

function me(d: DB): Profile {
  return currentUser(d) ?? d.profiles[0]
}
function logEdit(d: DB, program: Program, text: string): void {
  const m = me(d)
  d.edits.unshift({ id: uid('ed'), programId: program.id, clientId: program.clientId, by: m.role, byName: m.firstName, text, at: new Date().toISOString() })
}
export function notify(d: DB, userId: string, title: string, body: string, link?: string): void {
  d.notifications.unshift({ id: uid('n'), userId, title, body, link, at: new Date().toISOString(), read: false })
}
function coachIds(d: DB): string[] { return d.profiles.filter((p) => p.role === 'coach').map((p) => p.id) }

/** Séances des autres programmes du même client (l'historique alimente les suggestions de charge du mode libre). */
function historyOf(d: DB, p: Program): Session[] {
  return d.programs.filter((x) => x.clientId === p.clientId && x.id !== p.id).flatMap(allSessions)
}
/** Remet le carnet libre à jour : manquées, fenêtre glissante, séances futures vierges, charges suggérées. */
function syncLibre(d: DB, p: Program, today = todayISO()): void {
  Object.assign(p, syncFree(p, today, { history: historyOf(d, p) }))
}

function withSession(programId: string, sessionId: string, fn: (s: Session, p: Program, d: DB) => string | void): void {
  mutate((d) => {
    const p = d.programs.find((x) => x.id === programId)
    const s = p && findSession(p, sessionId)
    if (!p || !s) return
    const text = fn(s, p, d)
    if (text) logEdit(d, p, text)
  })
}

// ------------------------------------------------------------------ questionnaire / programme

export function saveDraft(clientId: string, draft: Draft): void {
  mutate((d) => { d.drafts[clientId] = draft })
}

export function submitQuestionnaire(clientId: string, q: Questionnaire, today = todayISO()): Program {
  let program!: Program
  mutate((d) => {
    const version = d.questionnaires.filter((x) => x.clientId === clientId).length + 1
    d.questionnaires.push({ id: uid('q'), clientId, version, data: q, at: new Date().toISOString() })
    const existing = programOf(d, clientId)
    let changed = !!existing // « programme régénéré » seulement quand un programme est remplacé
    if (q.mode === 'libre' && existing && isLibre(existing)) {
      // mode libre déjà en place : le formulaire (identité, blessures, course) se met à jour ; les séances libres et le planning ne bougent pas,
      // seul le plan de course MIND (s'il y en a un) est régénéré
      existing.q = { ...existing.q, ...q, mode: 'libre' }
      Object.assign(existing, applyRunPlan(existing, existing.q, today))
      syncLibre(d, existing, today)
      program = existing
      changed = false
    } else if (q.mode === 'libre') {
      if (existing) existing.status = 'archive'
      program = newLibreProgram(q, { clientId, now: today, customExercises: customExercisesOf(d, clientId) })
      d.programs.push(program)
      syncLibre(d, program, today)
    } else if (existing && isLibre(existing)) {
      // Libre → MIND : l'ancien programme est archivé, son historique reste lisible (lastPerformance, Progress)
      existing.status = 'archive'
      program = generateProgram({ ...q, mode: 'genere', startDate: q.startDate || today }, { clientId, now: today })
      program.clientId = clientId
      d.programs.push(program)
    } else {
      program = existing ? regenerateProgram(existing, q, today) : generateProgram({ ...q, startDate: q.startDate || today }, { clientId, now: today })
      program.clientId = clientId
      if (existing) d.programs = d.programs.filter((p) => p.id !== existing.id)
      d.programs.push(program)
    }
    delete d.drafts[clientId]
    const pr = d.profiles.find((p) => p.id === clientId)
    if (pr) { pr.onboarded = true; pr.firstName = q.firstName || pr.firstName }
    if (changed) logEdit(d, program, isLibre(existing) ? 'Passage de « J\'ai déjà mon programme » à un programme MIND.' : q.mode === 'libre' ? 'Passage en mode libre.' : 'Programme régénéré après modification du formulaire.')
    else if (!existing) for (const c of coachIds(d)) if (c !== clientId) notify(d, c, 'Nouveau programme', q.mode === 'libre' ? `${q.firstName || 'Un client'} utilise MIND comme carnet (mode libre).` : `${q.firstName || 'Un client'} vient de remplir son formulaire.`, `/coach/client/${clientId}`)
  })
  return program
}

export function replaceProgram(program: Program): void {
  mutate((d) => {
    const i = d.programs.findIndex((p) => p.id === program.id)
    if (i >= 0) d.programs[i] = program
  })
}

export function applyAIPersonalization(programId: string, weekNotes: Record<number, string>): void {
  mutate((d) => {
    const p = d.programs.find((x) => x.id === programId)
    if (!p) return
    for (const w of p.weeks) if (weekNotes[w.n]) w.note = weekNotes[w.n]
  })
}

export function startNextCycle(clientId: string): void {
  mutate((d) => {
    const cur = programOf(d, clientId)
    if (!cur || isLibre(cur)) return // pas de fin de cycle en mode libre
    const next = nextStrengthCycle(cur)
    cur.status = 'termine'
    d.programs.push(next)
    logEdit(d, next, `Cycle ${next.cycle} généré.`)
  })
}

// ------------------------------------------------------------------ modification manuelle

/** Matin / soir : course le matin, muscu le soir ; une séance seule n'a pas de créneau. */
function refreshSlots(p: Program, dates: string[]): void {
  for (const date of dates) {
    const list = allSessions(p).filter((x) => x.date === date && x.status !== 'sautee').sort((a, b) => (a.sport === b.sport ? a.title.localeCompare(b.title) : a.sport === 'course' ? -1 : 1))
    list.forEach((x, i) => { x.slot = list.length >= 2 ? (i === 0 ? 'am' : 'pm') : undefined })
  }
}

export function moveSession(programId: string, sessionId: string, newDate: string, _slot?: 'am' | 'pm'): void {
  withSession(programId, sessionId, (s, p) => {
    const old = s.date
    s.movedFrom = old
    s.date = newDate
    const wk = p.weeks.find((w) => w.startDate === mondayOf(newDate))
    if (wk && wk.n !== s.weekN) {
      const from = p.weeks.find((w) => w.n === s.weekN)!
      from.sessions = from.sessions.filter((x) => x.id !== s.id)
      s.weekN = wk.n
      wk.sessions.push(s)
    }
    refreshSlots(p, [old, newDate])
    return `« ${s.title} » déplacée du ${old} au ${newDate}.`
  })
}
export function skipSession(programId: string, sessionId: string): void {
  withSession(programId, sessionId, (s) => { s.status = 'sautee'; return `« ${s.title} » sautée.` })
}
export function restoreSession(programId: string, sessionId: string): void {
  withSession(programId, sessionId, (s) => { s.status = 'prevue'; return `« ${s.title} » remise au programme.` })
}
/** Une séance contient-elle quelque chose qui serait perdu en la supprimant (séries, sortie, bilan) ? */
export function sessionHasData(s: Session): boolean {
  return s.status === 'faite' || hasLogs(s) || !!s.runLog || (s.groups ?? []).some((g) => !!g.result)
}
/**
 * Supprime une séance de l'agenda (balayage vers la gauche). En mode libre, le jour est retenu pour que le planning
 * ne la recrée pas ; une sortie importée qui y était rattachée est mise de côté (elle ne se rattache pas ailleurs toute seule).
 */
export function deleteSession(programId: string, sessionId: string, today = todayISO()): () => void {
  // de quoi revenir en arrière (bouton « Annuler » du message) : le programme et les sorties rattachées, tels qu'avant
  const before = db.programs.find((x) => x.id === programId)
  const snap = before && structuredClone(before)
  const runs = structuredClone(db.importedRuns.filter((r) => r.matchedSessionId === sessionId))
  mutate((d) => {
    const p = d.programs.find((x) => x.id === programId)
    const s = p && findSession(p, sessionId)
    if (!p || !s) return
    for (const w of p.weeks) w.sessions = w.sessions.filter((x) => x.id !== s.id)
    if (isLibre(p) && p.libre && s.templateId && !s.extra) {
      const days = [s.date, s.movedFrom].filter((x): x is string => !!x && x >= today)
      p.libre.removed = [...new Set([...(p.libre.removed ?? []), ...days])].sort()
    }
    for (const r of d.importedRuns) {
      if (r.matchedSessionId === s.id) { r.status = 'ignoree'; r.matchedSessionId = undefined; r.note = 'Séance supprimée de l\'agenda.' }
    }
    refreshSlots(p, [s.date])
    if (isLibre(p) && p.libre) syncLibre(d, p, today)
    logEdit(d, p, `« ${s.title} » du ${s.date} supprimée.`)
  })
  return () => {
    if (!snap) return
    mutate((d) => {
      const i = d.programs.findIndex((x) => x.id === programId)
      if (i < 0) return
      d.programs[i] = structuredClone(snap)
      for (const r of runs) { const j = d.importedRuns.findIndex((x) => x.id === r.id); if (j >= 0) d.importedRuns[j] = structuredClone(r) }
      const s = findSession(snap, sessionId)
      logEdit(d, d.programs[i], `« ${s?.title ?? 'Séance'} » remise dans l'agenda.`)
    })
  }
}
export function replaceExercise(programId: string, sessionId: string, seId: string, exerciseId: string): void {
  withSession(programId, sessionId, (s) => {
    const e = s.exercises?.find((x) => x.id === seId)
    if (!e) return
    const from = exerciseOf(e.exerciseId).name
    e.exerciseId = exerciseId
    e.targetKg = undefined
    e.fixedKg = undefined
    e.logs = []
    return `${from} remplacé par ${exerciseOf(exerciseId).name} dans « ${s.title} ».`
  })
}
/** Ajoute un exercice à la séance et renvoie son id. `format` préremplit les séries (série lourde, combo, dégressive…). */
export function addExercise(programId: string, sessionId: string, exerciseId: string, format?: SetFormat): string {
  const id = uid('se')
  withSession(programId, sessionId, (s) => {
    const ex = exerciseOf(exerciseId)
    const timed = isTimed(exerciseId)
    const e: SessionExercise = {
      id, exerciseId, order: (s.exercises?.length ?? 0), sets: 3, repMin: timed ? 30 : ex.compound ? 6 : 10, repMax: timed ? 45 : ex.compound ? 10 : 15,
      rir: 2, restSec: timed ? 60 : ex.compound ? 120 : 75, logs: [],
    }
    if (format && format !== 'classique') {
      const r = applyFormat(format, { sets: FORMAT_DEFAULT_SETS[format], repMin: e.repMin, repMax: e.repMax, rir: e.rir }, timed)
      if (r.plan) Object.assign(e, { plan: r.plan, format: r.format, sets: r.sets, repMin: r.repMin, repMax: r.repMax })
    }
    s.exercises = [...(s.exercises ?? []), e]
    return `${ex.name} ajouté à « ${s.title} ».`
  })
  return id
}
export function removeExercise(programId: string, sessionId: string, seId: string): void {
  withSession(programId, sessionId, (s) => {
    const e = s.exercises?.find((x) => x.id === seId)
    s.exercises = (s.exercises ?? []).filter((x) => x.id !== seId)
    normalizeGroups(s)
    return e ? `${exerciseOf(e.exerciseId).name} retiré de « ${s.title} ».` : undefined
  })
}
type ExercisePatch = Partial<Pick<SessionExercise, 'sets' | 'repMin' | 'repMax' | 'rir' | 'restSec' | 'targetKg' | 'plan' | 'format'>>
export function updateExercise(programId: string, sessionId: string, seId: string, patch: ExercisePatch): void {
  withSession(programId, sessionId, (s) => {
    const e = s.exercises?.find((x) => x.id === seId)
    if (!e) return
    const { sets, plan, format, ...rest } = patch
    Object.assign(e, rest)
    if ('targetKg' in patch) e.fixedKg = patch.targetKg !== undefined ? true : undefined
    if ('plan' in patch) {
      // nouvelle structure de séries : le format et le nombre de séries suivent
      if (plan?.length) Object.assign(e, { plan, format: format ?? e.format, sets: plan.length, ...repRangeOf(plan) })
      else clearPlan(e)
      if (plan === undefined && sets !== undefined) e.sets = sets
    } else if (sets !== undefined) resizeSets(e, sets)
    if ('format' in patch && !('plan' in patch)) e.format = format
    if (s.groups?.length) syncRoundsFromMembers(s)
    return `${exerciseOf(e.exerciseId).name} modifié dans « ${s.title} » (${e.plan?.length ? `${e.sets} séries, ${e.format ?? 'séries détaillées'}` : `${e.sets}×${e.repMin}-${e.repMax}`}${e.targetKg ? `, ${fmtKm(e.targetKg)} kg` : ''}).`
  })
}
/** Applique un format prêt à l'emploi (série lourde, combo, dégressive…) à un exercice de la séance. */
export function setExerciseFormat(programId: string, sessionId: string, seId: string, format: SetFormat): void {
  withSession(programId, sessionId, (s) => {
    const e = s.exercises?.find((x) => x.id === seId)
    if (!e) return
    // la fourchette de départ ne dépend pas du format précédent (un combo 1–6 ne doit pas devenir la base d'une dégressive)
    const base = e.plan?.length ? nominalReps(e.exerciseId) : { repMin: e.repMin, repMax: e.repMax }
    const r = applyFormat(format, { sets: format === 'classique' ? e.sets : FORMAT_DEFAULT_SETS[format], ...base, rir: e.noRir ? undefined : e.rir }, isTimed(e.exerciseId))
    if (r.plan) Object.assign(e, { plan: r.plan, format: r.format, sets: r.sets, repMin: r.repMin, repMax: r.repMax })
    else { clearPlan(e); e.sets = r.sets; e.repMin = r.repMin; e.repMax = r.repMax }
    e.logs = []
    return `${exerciseOf(e.exerciseId).name} : format « ${r.format} » dans « ${s.title} ».`
  })
}

// ------------------------------------------------------------------ groupes d'exercices

/** Crée un groupe (superset, triset, circuit, EMOM, AMRAP, chrono) avec des exercices déjà dans la séance. */
export function createGroup(programId: string, sessionId: string, spec: GroupSpec): void {
  withSession(programId, sessionId, (s) => {
    const used = new Set((s.groups ?? []).flatMap((g) => g.exerciseIds))
    const ids = spec.exerciseIds.filter((id) => !used.has(id) && s.exercises?.some((e) => e.id === id))
    s.groups = [...(s.groups ?? []), { ...spec, exerciseIds: ids }]
    applyGroupDefaults(spec.kind, (s.exercises ?? []).filter((e) => ids.includes(e.id)))
    normalizeGroups(s)
    const g = s.groups?.find((x) => x.id === spec.id)
    return g ? `Groupe « ${g.kind} » créé dans « ${s.title} » (${groupMembers(s, g).map((e) => exerciseOf(e.exerciseId).name).join(', ')}).` : undefined
  })
}
export function updateGroup(programId: string, sessionId: string, groupId: string, patch: Partial<Omit<GroupSpec, 'id'>>): void {
  withSession(programId, sessionId, (s) => {
    const g = s.groups?.find((x) => x.id === groupId)
    if (!g) return
    Object.assign(g, patch)
    normalizeGroups(s)
    return `Groupe « ${g.kind} » modifié dans « ${s.title} ».`
  })
}
/** Sépare un groupe : ses exercices restent dans la séance, comme des exercices seuls. */
export function deleteGroup(programId: string, sessionId: string, groupId: string): void {
  withSession(programId, sessionId, (s) => {
    const g = s.groups?.find((x) => x.id === groupId)
    if (!g) return
    s.groups = s.groups!.filter((x) => x.id !== groupId)
    if (!s.groups.length) delete s.groups
    return `Groupe « ${g.kind} » défait dans « ${s.title} ».`
  })
}
/** EMOM / AMRAP / chrono : démarre (ou relance) le décompte. L'horodatage de départ survit à un rechargement. */
export function startGroup(programId: string, sessionId: string, groupId: string, now = Date.now()): void {
  withSession(programId, sessionId, (s) => {
    const g = s.groups?.find((x) => x.id === groupId)
    if (g && isTimedKind(g.kind)) { g.startedAt = now; g.tally = 0; delete g.result }
  })
}
/** AMRAP : +1 / −1 tour compté pendant l'effort. */
export function tallyGroup(programId: string, sessionId: string, groupId: string, delta: number): void {
  withSession(programId, sessionId, (s) => {
    const g = s.groups?.find((x) => x.id === groupId)
    if (g) g.tally = Math.max(0, (g.tally ?? 0) + delta)
  })
}
export function finishGroup(programId: string, sessionId: string, groupId: string, result: Omit<GroupResult, 'at'>): void {
  withSession(programId, sessionId, (s) => {
    const g = s.groups?.find((x) => x.id === groupId)
    if (g) g.result = { ...result, at: new Date().toISOString() }
  })
}
export function resetGroup(programId: string, sessionId: string, groupId: string): void {
  withSession(programId, sessionId, (s) => {
    const g = s.groups?.find((x) => x.id === groupId)
    if (g) { delete g.startedAt; delete g.result; delete g.tally }
  })
}
/** « Tour N fait » : valide d'un coup tous les exercices du tour qui n'ont pas encore de série saisie (charges et reps facultatives). */
export function logRound(programId: string, sessionId: string, groupId: string, round: number, entries: Record<string, { kg?: number; reps?: number }> = {}): void {
  withSession(programId, sessionId, (s) => {
    const g = s.groups?.find((x) => x.id === groupId)
    if (!g || !isRoundsKind(g.kind)) return
    for (const e of groupMembers(s, g)) {
      if (e.logs.some((l) => l.n === round)) continue
      const v = entries[e.id] ?? {}
      const timed = isTimed(e.exerciseId)
      e.logs = [...e.logs, { n: round, kg: v.kg ?? 0, reps: timed ? 0 : v.reps ?? e.repMin, rir: e.rir, at: new Date().toISOString(), ...(timed ? { seconds: v.reps ?? e.repMin } : {}) }].sort((a, b) => a.n - b.n)
    }
  })
}
export function unlogRound(programId: string, sessionId: string, groupId: string, round: number): void {
  withSession(programId, sessionId, (s) => {
    const g = s.groups?.find((x) => x.id === groupId)
    if (!g) return
    for (const e of groupMembers(s, g)) e.logs = e.logs.filter((l) => l.n !== round)
  })
}
export function updateRun(programId: string, sessionId: string, patch: { km?: number; blocks?: RunBlock[]; warmup?: string; cooldown?: string }): void {
  withSession(programId, sessionId, (s) => {
    if (!s.run) return
    if (patch.blocks) s.run.blocks = patch.blocks
    if (patch.warmup !== undefined) s.run.warmup = patch.warmup
    if (patch.cooldown !== undefined) s.run.cooldown = patch.cooldown
    if (patch.km !== undefined) {
      const ratio = s.run.totalKm ? patch.km / s.run.totalKm : 1
      s.run.blocks.forEach((b) => { if (b.meters) b.meters = Math.round(b.meters * ratio) })
      s.run.estMinutes = Math.round(s.run.estMinutes * ratio)
      s.run.totalKm = patch.km
      s.estMinutes = s.run.estMinutes
    }
    return `Séance de course « ${s.title} » modifiée (${fmtKm(s.run.totalKm)} km).`
  })
}

// ------------------------------------------------------------------ séance en cours

/** Enregistre une série, ou une partie d'une série (`set.part`). */
export function logSet(programId: string, sessionId: string, seId: string, set: SetLog): void {
  withSession(programId, sessionId, (s) => {
    const e = s.exercises?.find((x) => x.id === seId)
    if (!e) return
    e.logs = e.logs.filter((l) => !(l.n === set.n && partOf(l) === partOf(set))).concat(set).sort((a, b) => a.n - b.n || partOf(a) - partOf(b))
  })
}
/** Annule une partie (`part`), ou toute la série `n` si `part` est absent. */
export function unlogSet(programId: string, sessionId: string, seId: string, n: number, part?: number): void {
  withSession(programId, sessionId, (s) => {
    const e = s.exercises?.find((x) => x.id === seId)
    if (e) e.logs = e.logs.filter((l) => !(l.n === n && (part === undefined || partOf(l) === part)))
  })
}

export interface Recap { tonnage: number; prs: { exerciseId: string; kg: number; reps: number }[]; minutes: number; sets: number }

export function finishStrength(programId: string, sessionId: string, feeling: number, minutes: number, today = todayISO()): Recap {
  const recap: Recap = { tonnage: 0, prs: [], minutes, sets: 0 }
  mutate((d) => {
    const p = d.programs.find((x) => x.id === programId)
    const s = p && findSession(p, sessionId)
    if (!p || !s) return
    s.status = 'faite'
    s.feeling = feeling
    s.durationMin = minutes
    s.doneAt = new Date().toISOString()
    for (const g of s.groups ?? []) if (isTimedKind(g.kind) && g.result) recap.sets += 1 // un EMOM, un AMRAP ou un chrono compte pour un bloc
    const timedMembers = new Set((s.groups ?? []).filter((g) => isTimedKind(g.kind)).flatMap((g) => g.exerciseIds))
    for (const e of s.exercises ?? []) {
      for (const l of e.logs) recap.tonnage += l.kg * l.reps
      if (!timedMembers.has(e.id)) recap.sets += doneSetsOf(e)
      if (!e.logs.length) continue
      const best = e.logs.reduce((a, b) => (epley(b.kg, b.reps) > epley(a.kg, a.reps) ? b : a))
      const e1 = epley(best.kg, best.reps)
      const prev = Math.max(0, ...clientSessions(d, p.clientId).filter((x) => x.status === 'faite' && x.id !== s.id && x.date <= s.date)
        .flatMap((x) => x.exercises ?? []).filter((x) => x.exerciseId === e.exerciseId).flatMap((x) => x.logs).map((l) => epley(l.kg, l.reps)))
      if (prev > 0 && e1 > prev * 1.005 && best.kg > 0) {
        recap.prs.push({ exerciseId: e.exerciseId, kg: best.kg, reps: best.reps })
        d.records.push({ id: uid('pr'), clientId: p.clientId, exerciseId: e.exerciseId, kg: best.kg, reps: best.reps, e1rm: e1, date: s.date, sessionId: s.id })
      }
    }
    if (isLibre(p)) {
      // mode libre : la rotation repart du dernier modèle fait, les charges ne sont suggérées que si l'interrupteur est activé
      syncLibre(d, p, today)
    } else {
      const res = adjustLoadsAfterSession(p, sessionId, today)
      Object.assign(p, res.program)
      d.adaptations.unshift(...res.adaptations)
    }
  })
  return recap
}

export function logRun(programId: string, sessionId: string, run: Omit<RunLog, 'at' | 'source'>, today = todayISO()): { suggestion?: string } {
  let suggestion: string | undefined
  mutate((d) => {
    const p = d.programs.find((x) => x.id === programId)
    const s = p && findSession(p, sessionId)
    if (!p || !s) return
    s.runLog = { ...run, source: 'manuel', at: new Date().toISOString() }
    s.status = 'faite'
    s.doneAt = new Date().toISOString()
    s.feeling = run.feeling
    suggestion = proposeVma(d, p, today)
  })
  return { suggestion }
}

/** Propose (sans rien appliquer) un recalcul des allures : 3 sorties faciles plus rapides que prévu. Une seule proposition à la fois. */
function proposeVma(d: DB, p: Program, today: string): string | undefined {
  const sug = suggestVmaUpdate(p)
  if (!sug || hasPendingPaces(d, p)) return undefined
  d.adaptations.unshift({ id: uid('ad'), clientId: p.clientId, programId: p.id, date: today, kind: 'allures', status: 'propose', text: sug.text, payload: { vma: sug.vma } })
  return sug.text
}
const hasPendingPaces = (d: DB, p: Program) => d.adaptations.some((a) => a.programId === p.id && a.status === 'propose' && a.kind === 'allures')

export function updateVmaFromRecent(programId: string, recent: NonNullable<Questionnaire['run']['recent']>, today = todayISO()): void {
  mutate((d) => {
    const p = d.programs.find((x) => x.id === programId)
    if (!p) return
    const vma = vmaFromRecent(recent.distance, recent.seconds)
    d.adaptations.unshift({ id: uid('ad'), clientId: p.clientId, programId: p.id, date: today, kind: 'allures', status: 'propose', text: `Nouveau chrono saisi : la VMA passerait à ${fmtKm(vma)} km/h. Recalculer toutes les allures futures ?`, payload: { vma } })
  })
}

export function addCheckin(c: Omit<Checkin, 'id'>, today = todayISO()): void {
  mutate((d) => {
    const full: Checkin = { ...c, id: uid('ck') }
    d.checkins.push(full)
    const p = programOf(d, c.clientId)
    if (!p || !c.sessionId) return
    if (isLibre(p) && findSession(p, c.sessionId)?.sport !== 'course') {
      // mode libre : l'alerte au coach reste active, mais MIND ne remplace ni n'allège rien tout seul (la course MIND, elle, s'adapte)
      if (c.pain) {
        const name = nameOf(d, c.clientId)
        for (const id of coachIds(d)) if (id !== c.clientId) notify(d, id, 'Douleur signalée', `${name} signale une douleur (${c.painZone ?? '—'}).`, `/coach/client/${c.clientId}`)
      }
      return
    }
    const res = applyCheckin(p, c.sessionId, full, today)
    Object.assign(p, res.program)
    d.adaptations.unshift(...res.adaptations)
    if (res.notifyCoach) {
      const name = nameOf(d, c.clientId)
      for (const id of coachIds(d)) if (id !== c.clientId) notify(d, id, 'Douleur signalée', `${name} signale une douleur (${c.painZone ?? '—'}).`, `/coach/client/${c.clientId}`)
    }
  })
}

// ------------------------------------------------------------------ adaptations

export function acceptAdaptation(adId: string, today = todayISO()): void {
  mutate((d) => {
    const a = d.adaptations.find((x) => x.id === adId)
    const p = a && d.programs.find((x) => x.id === a.programId)
    if (!a || !p) return
    if (isLibre(p) && a.kind !== 'allures') { a.status = 'refuse'; return } // aucune réorganisation automatique de la muscu libre
    if (a.kind === 'allures') {
      const vma = (a.payload as { vma: number }).vma
      const res = scalePaces(p, vma, today)
      Object.assign(p, res.program)
      d.adaptations.unshift(...res.adaptations)
      a.status = 'accepte'
    } else {
      const res = applySuggestion(p, a, today)
      Object.assign(p, res.program)
      a.status = 'accepte'
    }
    logEdit(d, p, `Suggestion acceptée : ${a.text}`)
  })
}
export function refuseAdaptation(adId: string): void {
  mutate((d) => { const a = d.adaptations.find((x) => x.id === adId); if (a) a.status = 'refuse' })
}
export function undoAdaptationById(adId: string): void {
  mutate((d) => {
    const a = d.adaptations.find((x) => x.id === adId)
    const p = a && d.programs.find((x) => x.id === a.programId)
    if (!a || !p) return
    Object.assign(p, undoAdaptation(p, a))
    a.status = 'annule'
    logEdit(d, p, `Adaptation annulée : ${a.text}`)
  })
}

/** Tâches « cron » exécutées à l'ouverture de l'app (en ligne : pg_cron + Edge Functions). */
/** Sortie encore à faire dont les distances ne sont pas au km entier (programmes générés avant cette règle). */
const needsRound = (s: Session) =>
  s.sport === 'course' && s.status === 'prevue' && !!s.run && !s.runLog && s.kind !== 'course' && !isFreeRun(s) && roundRunPlan(structuredClone(s.run))

/** Passe au km entier les sorties à venir (4,7 km → 5 km). Idempotent ; en ligne, chacun ne touche que son programme. */
export function roundPlannedRuns(): void {
  const own = (d: DB) => d.programs.filter((p) => p.status === 'actif' && (!REMOTE || p.clientId === d.sessionUserId))
  if (!own(db).some((p) => allSessions(p).some(needsRound))) return
  mutate((d) => {
    for (const p of own(d)) for (const s of allSessions(p)) if (needsRound(s)) { roundRunPlan(s.run!); s.estMinutes = s.run!.estMinutes }
  })
}

export function runDailyJobs(today = todayISO()): void {
  roundPlannedRuns()
  const d0 = db
  const stamp = d0.lastJobs['daily']
  if (stamp === today) return
  mutate((d) => {
    d.lastJobs['daily'] = today
    // en ligne, chacun ne gère que son propre programme (le coach ne rejoue pas les tâches de ses clients)
    for (const p of d.programs.filter((x) => x.status === 'actif' && (!REMOTE || x.clientId === d.sessionUserId))) {
      if (isLibre(p)) {
        // mode libre : séances manquées simplement « manquées », fenêtre glissante prolongée, bilan du dimanche sans suggestion
        syncLibre(d, p, today)
        // muscu libre + course MIND : le plan de course garde ses adaptations (séances de qualité manquées déplacées) ; la muscu libre n'y touche pas
        if (p.type === 'mixte') {
          const res = handleMissed(p, today, p.q.dayPrefs?.run ?? [0, 1, 2, 3, 4, 5, 6])
          if (res.adaptations.length) { Object.assign(p, res.program); d.adaptations.unshift(...res.adaptations) }
        }
        const last = p.weeks.find((w) => w.startDate === addDays(mondayOf(today), -7))
        if (last && last.sessions.length && !d.analyses.some((a) => a.programId === p.id && a.weekN === last.n)) {
          d.analyses.unshift({ id: uid('an'), programId: p.id, clientId: p.clientId, weekN: last.n, summary: weekRecap(p, last.n), at: new Date().toISOString(), source: 'regles' })
        }
        continue
      }
      const res = handleMissed(p, today, p.q.availableDays)
      if (res.adaptations.length) {
        Object.assign(p, res.program)
        d.adaptations.unshift(...res.adaptations)
      }
      // analyse hebdo : la semaine précédente, une seule fois
      const prev = p.weeks.find((w) => w.startDate === addDays(mondayOf(today), -7))
      if (prev && !d.analyses.some((a) => a.programId === p.id && a.weekN === prev.n)) {
        const r = ruleBasedWeeklyAnalysis(p, prev.n, today)
        d.analyses.unshift({ id: uid('an'), programId: p.id, clientId: p.clientId, weekN: prev.n, summary: r.summary, at: new Date().toISOString(), source: 'regles' })
        d.adaptations.unshift(...r.suggestions)
        if (r.suggestions.length) notify(d, p.clientId, 'Analyse de ta semaine', r.suggestions[0].text, '/app/today')
      }
    }
  })
}

export function setAnalysis(programId: string, weekN: number, summary: string, source: 'ia' | 'regles'): void {
  mutate((d) => {
    const p = d.programs.find((x) => x.id === programId)
    if (!p) return
    const cur = d.analyses.find((a) => a.programId === programId && a.weekN === weekN)
    if (cur) { cur.summary = summary; cur.source = source }
    else d.analyses.unshift({ id: uid('an'), programId, clientId: p.clientId, weekN, summary, at: new Date().toISOString(), source })
  })
}
export function addSuggestions(list: Adaptation[]): void {
  mutate((d) => { d.adaptations.unshift(...list) })
}

// ------------------------------------------------------------------ mode libre

/** Prévient le client quand c'est son coach qui modifie ses séances ou son planning. */
function libreEdited(d: DB, p: Program, what: string, log: string): void {
  logEdit(d, p, log)
  const m = me(d)
  if (m.role === 'coach' && m.id !== p.clientId) notify(d, p.clientId, `${m.firstName} ${what}`, 'Ouvre « Mes séances » pour voir le changement.', '/app/sessions')
}
const libreOf = (d: DB, programId: string): Program | undefined => {
  const p = d.programs.find((x) => x.id === programId)
  return p && isLibre(p) && p.libre ? p : undefined
}

/** Crée ou met à jour une séance modèle ; les séances futures vierges sont recalculées. */
export function saveTemplate(programId: string, tpl: SessionTemplate): void {
  mutate((d) => {
    const p = libreOf(d, programId)
    if (!p?.libre) return
    const i = p.libre.templates.findIndex((t) => t.id === tpl.id)
    if (i >= 0) p.libre.templates[i] = tpl
    else {
      p.libre.templates.push(tpl)
      if (p.libre.planning.mode === 'rotation') p.libre.planning.order.push(tpl.id)
    }
    syncLibre(d, p)
    libreEdited(d, p, i >= 0 ? `a modifié ta séance ${tpl.name}` : `a ajouté la séance ${tpl.name}`, `Séance modèle « ${tpl.name} » ${i >= 0 ? 'modifiée' : 'créée'}.`)
  })
}

export function deleteTemplate(programId: string, templateId: string): void {
  mutate((d) => {
    const p = libreOf(d, programId)
    const t = p?.libre?.templates.find((x) => x.id === templateId)
    if (!p?.libre || !t) return
    p.libre.templates = p.libre.templates.filter((x) => x.id !== templateId)
    const pl = p.libre.planning
    if (pl.mode === 'fixe') pl.days = pl.days.map((id) => (id === templateId ? null : id))
    else pl.order = pl.order.filter((id) => id !== templateId)
    syncLibre(d, p)
    libreEdited(d, p, `a supprimé ta séance ${t.name}`, `Séance modèle « ${t.name} » supprimée.`)
  })
}

export function setPlanning(programId: string, planning: LibrePlanning): void {
  mutate((d) => {
    const p = libreOf(d, programId)
    if (!p?.libre) return
    p.libre.planning = planning
    syncLibre(d, p)
    libreEdited(d, p, 'a modifié ton planning', 'Planning modifié.')
  })
}

/** Interrupteur « Suggestions de charge » (désactivé par défaut) : stocké dans le programme, sans migration SQL. */
export function setSuggestLoads(programId: string, on: boolean): void {
  mutate((d) => {
    const p = libreOf(d, programId)
    if (!p?.libre) return
    p.libre.suggestLoads = on
    syncLibre(d, p)
  })
}

/** Ajoute à « Mes séances » les 2 modèles tout faits « Renfo coureur » (sans matériel, avec élastique) qui n'y sont pas déjà. */
export function addRenfoTemplates(programId: string): void {
  mutate((d) => {
    const p = libreOf(d, programId)
    if (!p?.libre) return
    const have = new Set(p.libre.templates.map((t) => t.name))
    const add = renfoTemplates().filter((t) => !have.has(t.name))
    if (!add.length) return
    p.libre.templates.push(...add) // pas dans la rotation : le client place ces séances où il veut
    syncLibre(d, p)
    libreEdited(d, p, 'a ajouté des séances de renfo coureur', `Séances modèles « ${add.map((t) => t.name).join(' », « ')} » ajoutées.`)
  })
}

/** Crée un exercice perso (id « custom:… ») et le renvoie. */
export function addCustomExercise(programId: string, name: string, muscle: Muscle): string {
  const id = `${CUSTOM_PREFIX}${uid('x')}`
  mutate((d) => {
    const p = libreOf(d, programId)
    p?.libre?.customExercises.push(makeCustomExercise(id, name, muscle))
  })
  return id
}

/** « Séance en plus » : un de ses modèles, une séance vide ou une sortie de course libre, datée d'aujourd'hui. */
export function addExtraSession(programId: string, src: ExtraSource, today = todayISO()): string {
  let sessionId = ''
  mutate((d) => {
    // programme MIND : seule la « sortie libre » (course) est possible
    const p = src === 'course' ? d.programs.find((x) => x.id === programId) : libreOf(d, programId)
    if (!p) return
    const res = withExtraSession(p, today, src, historyOf(d, p))
    Object.assign(p, res.program)
    sessionId = res.sessionId
  })
  return sessionId
}

/** « Garder les changements pour tes prochains … » : le modèle reprend la séance, les séances futures vierges suivent. */
export function applySessionToTemplate(programId: string, sessionId: string): void {
  mutate((d) => {
    const p = libreOf(d, programId)
    const s = p && findSession(p, sessionId)
    const i = p?.libre?.templates.findIndex((t) => t.id === s?.templateId) ?? -1
    if (!p?.libre || !s || i < 0) return
    p.libre.templates[i] = templateFromSession(s, p.libre.templates[i])
    syncLibre(d, p)
    logEdit(d, p, `Séance modèle « ${p.libre.templates[i].name} » mise à jour d'après la séance du ${s.date}.`)
  })
}

/**
 * MIND → Libre. L'ancien programme passe en « archive » (son historique reste visible dans lastPerformance et Progress).
 * `fromCurrent` : un modèle par séance de muscu distincte de la semaine en cours + le planning en jours fixes correspondant.
 */
export function switchToLibre(clientId: string, fromCurrent: boolean, today = todayISO()): Program | undefined {
  let created: Program | undefined
  mutate((d) => {
    const cur = programOf(d, clientId)
    if (!cur || isLibre(cur) || cur.type === 'course') return // pas de muscu à libérer dans un programme de course seule
    const conv = fromCurrent ? libreFromProgram(cur, today) : undefined
    // muscu libre + course MIND : le plan de course est conservé (régénéré à partir d'aujourd'hui) tant que la course n'est pas passée
    const keepRun = cur.type === 'mixte' && cur.q.run.raceDate > today
    const q: Questionnaire = { ...cur.q, mode: 'libre', programType: keepRun ? 'mixte' : 'muscu' }
    cur.status = 'archive'
    d.questionnaires.push({ id: uid('q'), clientId, version: d.questionnaires.filter((x) => x.clientId === clientId).length + 1, data: q, at: new Date().toISOString() })
    created = newLibreProgram(q, { clientId, now: today, templates: conv?.templates, planning: conv?.planning, customExercises: customExercisesOf(d, clientId) })
    d.programs.push(created)
    syncLibre(d, created, today)
    logEdit(d, created, fromCurrent ? 'Passage en mode libre à partir du programme MIND.' : 'Passage en mode libre.')
    const m = me(d)
    if (m.role === 'coach' && m.id !== clientId) notify(d, clientId, `${m.firstName} a passé ton programme en mode libre`, 'Retrouve tes séances dans « Mes séances ».', '/app/sessions')
  })
  return created
}

// ------------------------------------------------------------------ commentaires & notifications

export function addComment(sessionId: string, clientId: string, text: string, parentId?: string): void {
  mutate((d) => {
    const m = me(d)
    d.comments.push({ id: uid('c'), sessionId, clientId, authorId: m.id, authorRole: m.role, authorName: m.firstName, text, parentId, at: new Date().toISOString() })
    if (m.role === 'coach' && m.id !== clientId) notify(d, clientId, `${m.firstName} a commenté ta séance`, text, `/session/${sessionId}`)
    else for (const id of coachIds(d)) if (id !== m.id) notify(d, id, `${m.firstName} a répondu`, text, `/coach/client/${clientId}`)
  })
}
export function markNotificationsRead(userId: string): void {
  mutate((d) => { d.notifications.forEach((n) => { if (n.userId === userId) n.read = true }) })
}


// ------------------------------------------------------------------ courses importées : rattachement, bilan

/** Une notification avec un identifiant imposé : rejouée sur un autre appareil, elle ne se duplique pas. */
function notifyOnce(d: DB, id: string, userId: string, title: string, body: string, link?: string): void {
  if (d.notifications.some((n) => n.id === id)) return
  d.notifications.unshift({ id, userId, title, body, link, at: new Date().toISOString(), read: false })
}

/** Rattache une activité au programme actif du client (même résultat sur tous les appareils). Sans programme, elle attend. */
function attachInDb(d: DB, run: ImportedRun, today: string, o: { forceSessionId?: string; asExtra?: boolean; toRunDate?: boolean } = {}): void {
  if (!isRunTypeStr(run.activityType)) { run.status = 'ignoree'; run.note = 'Ce n\'est pas une course à pied.'; return } // vélo, marche, muscu… : jamais rattaché
  const p = programOf(d, run.clientId)
  if (!p) return
  const res = attachRun(p, run, { ...o, today, history: historyOf(d, p) })
  if (res.outcome === 'ignoree') { run.status = 'ignoree'; run.note = res.note; run.matchedSessionId = undefined; return }
  Object.assign(p, res.program)
  run.status = 'rattachee'
  run.matchedSessionId = res.sessionId
  run.movedFromDate = res.movedFrom
  run.note = undefined
  const s = res.sessionId ? findSession(p, res.sessionId) : undefined
  if (res.outcome === 'deplacee' && s && !d.adaptations.some((a) => a.id === `ad-${run.id}`)) {
    d.adaptations.unshift({ id: `ad-${run.id}`, clientId: p.clientId, programId: p.id, date: today, kind: 'deplacee', status: 'applique', text: `« ${s.title} » rattachée à ta sortie du ${run.startAt.slice(0, 10)} (prévue le ${res.movedFrom}).` })
  }
  // sorties arrivées toutes seules de la montre : le client a un bilan à remplir
  if (run.source === 'garmin' && s) notifyOnce(d, `n-${run.id}`, run.clientId, 'À compléter', `Ta sortie de ${fmtKm(run.km)} km : respectée ? effort ?`, `/session/${s.id}`)
}

/**
 * Sortie « rattachée » dont la séance a perdu les données : le programme a été remplacé par une copie plus ancienne
 * (autre appareil resté sur une vieille version). Renvoie la séance à re-remplir, `null` si elle a disparu, `undefined` si tout va bien.
 * Une séance d'un programme archivé, prise par une autre sortie ou sautée n'est jamais touchée.
 */
function orphanOf(d: DB, run: ImportedRun): Session | null | undefined {
  if (run.status !== 'rattachee') return undefined
  const p = programOf(d, run.clientId)
  if (!p) return undefined
  const s = run.matchedSessionId ? findSession(p, run.matchedSessionId) : undefined
  if (!s) return run.matchedSessionId && clientSessions(d, run.clientId).some((x) => x.id === run.matchedSessionId) ? undefined : null
  if (s.runLog || s.status === 'faite' || s.status === 'sautee') return undefined
  return s
}
/** Re-rattache une sortie orpheline : à sa séance (remise au jour de la sortie), ou comme au premier passage si la séance a disparu. */
function relinkInDb(d: DB, run: ImportedRun, today: string, sessionId?: string): void {
  const s = orphanOf(d, run)
  if (s === undefined) return
  const target = sessionId ?? s?.id
  attachInDb(d, run, today, target ? { forceSessionId: target, toRunDate: !sessionId } : {})
}

/** Rattache toutes les activités en attente, et répare celles dont la séance a perdu les données. En ligne, chaque compte ne traite que les siennes. */
export function attachPendingRuns(today = todayISO()): number {
  const me = db.sessionUserId
  const mine = db.importedRuns.filter((r) => !REMOTE || r.clientId === me)
  const ready = mine.filter((r) => r.status === 'a_rattacher' && (!isRunTypeStr(r.activityType) || !!programOf(db, r.clientId)))
  const orphans = mine.filter((r) => orphanOf(db, r) !== undefined)
  if (!ready.length && !orphans.length) return 0
  mutate((d) => {
    for (const r0 of ready) {
      const r = d.importedRuns.find((x) => x.id === r0.id)
      if (r && r.status === 'a_rattacher') attachInDb(d, r, today)
    }
    for (const r0 of orphans) {
      const r = d.importedRuns.find((x) => x.id === r0.id)
      if (r) relinkInDb(d, r, today)
    }
  })
  return ready.length + orphans.length
}
const isRunTypeStr = (t: string) => ['route', 'tapis', 'trail', 'piste'].includes(t)

export interface ImportOutcome { run: ImportedRun; duplicate: boolean; sessionId?: string }

/**
 * Reçoit une activité (fichier .fit, saisie rapide, « fait comme prévu ») et la rattache tout de suite.
 * `sessionId` : le client est sur cette séance, on y rattache sans deviner. La même activité (même `externalId`) n'est jamais créée deux fois.
 */
export function importRun(clientId: string, data: RunData, source: ImportSource, opts: { externalId?: string; sessionId?: string; today?: string } = {}): ImportOutcome {
  const today = opts.today ?? todayISO()
  const externalId = opts.externalId ?? data.externalId ?? `${source}:${data.startAt}:${data.km}:${data.seconds}`
  const id = runIdOf(externalId)
  const existing = db.importedRuns.find((r) => r.clientId === clientId && (r.id === id || r.externalId === externalId))
  if (existing && opts.sessionId && orphanOf(db, existing) !== undefined) {
    // déjà reçue, mais sa séance a perdu les données (copie plus ancienne du programme) : on la remet sur la séance affichée
    mutate((d) => { const r = d.importedRuns.find((x) => x.id === existing.id); if (r) relinkInDb(d, r, today, opts.sessionId) })
    const fixed = db.importedRuns.find((r) => r.id === existing.id)!
    return { run: fixed, duplicate: false, sessionId: fixed.matchedSessionId }
  }
  if (existing) return { run: existing, duplicate: true, sessionId: existing.matchedSessionId }
  const run: ImportedRun = { ...data, id, clientId, source, externalId, status: 'a_rattacher' }
  mutate((d) => {
    d.importedRuns.push(run)
    attachInDb(d, d.importedRuns[d.importedRuns.length - 1], today, { forceSessionId: opts.sessionId })
  })
  const saved = db.importedRuns.find((r) => r.id === id)!
  return { run: saved, duplicate: false, sessionId: saved.matchedSessionId }
}

/** « Fait comme prévu » : distance et temps du plan, puis le bilan s'ouvre. */
export function logPlannedRun(programId: string, sessionId: string, today = todayISO()): ImportOutcome | undefined {
  const p = db.programs.find((x) => x.id === programId)
  const s = p && findSession(p, sessionId)
  if (!p || !s) return undefined
  const { km, seconds } = plannedMeasures(s)
  if (!km || !seconds) return undefined
  return importRun(p.clientId, manualRun({ clientId: p.clientId, externalId: `manuel:${s.id}`, startAt: startOf(s, today), km, seconds }), 'manuel', { externalId: `manuel:${s.id}`, sessionId, today })
}

/** Saisie rapide : distance + temps, l'allure est calculée. */
export function logQuickRun(programId: string, sessionId: string, km: number, seconds: number, today = todayISO()): ImportOutcome | undefined {
  const p = db.programs.find((x) => x.id === programId)
  const s = p && findSession(p, sessionId)
  if (!p || !s || !(km > 0) || !(seconds > 0)) return undefined
  return importRun(p.clientId, manualRun({ clientId: p.clientId, externalId: `manuel:${s.id}`, startAt: startOf(s, today), km, seconds }), 'manuel', { externalId: `manuel:${s.id}`, sessionId, today })
}
/** Début d'une sortie saisie à la main : le jour de la séance (jamais dans le futur), à l'heure de son créneau. */
const startOf = (s: Session, today: string) => `${s.date > today ? today : s.date}T${s.slot === 'pm' ? '18' : '08'}:00:00`

export type CorrectTarget = { sessionId: string } | 'extra' | 'ignore'

/** « Ce n'est pas cette séance » : la rattacher à une autre séance, en faire une sortie en plus, ou l'ignorer. Le bilan déjà rempli suit. */
export function correctRun(runId: string, target: CorrectTarget, today = todayISO()): void {
  mutate((d) => {
    const run = d.importedRuns.find((r) => r.id === runId)
    const p = run && programOf(d, run.clientId)
    if (!run || !p) return
    const old = run.matchedSessionId ? findSession(p, run.matchedSessionId) : undefined
    const review = old?.runLog ? { respected: old.runLog.respected, reasons: old.runLog.reasons, reasonNote: old.runLog.reasonNote, rpe: old.runLog.rpe, painZone: old.runLog.painZone, feeling: old.runLog.feeling } : undefined
    Object.assign(p, detachRun(p, run))
    run.matchedSessionId = undefined
    if (target === 'ignore') { run.status = 'ignoree'; run.note = 'Ignorée à ta demande.'; return }
    attachInDb(d, run, today, target === 'extra' ? { asExtra: true } : { forceSessionId: target.sessionId })
    const s = run.matchedSessionId ? findSession(p, run.matchedSessionId) : undefined
    if (s?.runLog && review) { Object.assign(s.runLog, review); s.feeling = review.feeling || undefined }
  })
}

export interface RunReviewInput { respected: RunRespect; reasons: RunReason[]; reasonNote?: string; rpe: number; painZone?: Zone }

/** Bilan après séance : respect, raisons, RPE. Déclenche les règles (toujours proposées) et les alertes coach. */
export function completeRunReview(programId: string, sessionId: string, rv: RunReviewInput, today = todayISO()): void {
  mutate((d) => {
    const p = d.programs.find((x) => x.id === programId)
    const s = p && findSession(p, sessionId)
    if (!p || !s?.runLog) return
    const reasons = rv.respected === 'oui' ? [] : rv.reasons
    Object.assign(s.runLog, { respected: rv.respected, reasons, reasonNote: reasons.includes('autre') ? rv.reasonNote?.trim() || undefined : undefined, rpe: rv.rpe, feeling: rv.rpe, painZone: reasons.includes('douleur') ? rv.painZone : undefined })
    s.feeling = rv.rpe
    const name = nameOf(d, p.clientId)
    const coaches = coachIds(d).filter((id) => id !== p.clientId)
    if (reasons.includes('douleur')) {
      // alerte coach immédiate, comme la douleur au check-in
      const ck = d.checkins.find((x) => x.id === `ck-${s.id}`)
      if (ck) ck.painZone = rv.painZone
      else d.checkins.push({ id: `ck-${s.id}`, clientId: p.clientId, date: s.date, energy: 3, sleep: 3, soreness: 3, pain: true, painZone: rv.painZone })
      for (const id of coaches) notifyOnce(d, `n-pain-${s.id}-${id}`, id, 'Douleur signalée', `${name} signale une douleur (${rv.painZone ?? '—'}) après sa sortie.`, `/coach/client/${p.clientId}`)
    }
    const rules = runReviewRules(p, today)
    for (const a of rules.coachAlerts) for (const id of coaches) notifyOnce(d, `n-${a.kind}-${p.clientId}-${id}-${mondayOf(today)}`, id, 'Motivation en baisse', `${name} : ${a.text}`, `/coach/client/${p.clientId}`)
    const prop = rules.slower ?? rules.faster
    if (prop && !hasPendingPaces(d, p)) {
      d.adaptations.unshift({ id: uid('ad'), clientId: p.clientId, programId: p.id, date: today, kind: 'allures', status: 'propose', text: prop.text, payload: { vma: prop.vma } })
    } else proposeVma(d, p, today)
  })
}

/** FC max saisie par le client ou le coach (zones cardio). `undefined` = retour à la valeur déduite. */
export function setMaxHr(clientId: string, maxHr: number | undefined): void {
  mutate((d) => {
    const cur = d.garminSettings.find((g) => g.clientId === clientId)
    if (cur) cur.maxHr = maxHr
    else d.garminSettings.push({ id: clientId, clientId, maxHr })
  })
}

/** Objectif de pas par jour (`undefined` = pas d'objectif). */
export function setStepGoal(clientId: string, stepGoal: number | undefined): void {
  mutate((d) => {
    const cur = d.garminSettings.find((g) => g.clientId === clientId)
    if (cur) cur.stepGoal = stepGoal
    else d.garminSettings.push({ id: clientId, clientId, stepGoal })
  })
}

/** Mode démo (sans serveur) : statut de liaison écrit localement. En ligne, c'est le serveur qui l'écrit. */
export function setLinkLocal(clientId: string, patch: Partial<GarminLink>): void {
  mutate((d) => {
    const cur = d.garminLinks.find((g) => g.clientId === clientId)
    if (cur) Object.assign(cur, patch)
    else d.garminLinks.push({ id: clientId, clientId, allowed: false, state: 'non_liee', ...patch })
  })
}

// sélecteurs
export const runsOf = (d: DB, clientId: string): ImportedRun[] => d.importedRuns.filter((r) => r.clientId === clientId)
export const linkOf = (d: DB, clientId: string): GarminLink | undefined => d.garminLinks.find((g) => g.clientId === clientId)
export const stepGoalOf = (d: DB, clientId: string): number | undefined => d.garminSettings.find((g) => g.clientId === clientId)?.stepGoal
export const maxHrSettingOf = (d: DB, clientId: string): number | undefined => d.garminSettings.find((g) => g.clientId === clientId)?.maxHr

/** Date locale pour les tests et le seed. */
export { todayISO, weekday }
void pendingRuns
