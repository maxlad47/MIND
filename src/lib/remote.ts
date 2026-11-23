// Synchronisation avec Supabase.
//
// Principe : l'app travaille toujours sur ses données locales (rapide, utilisable sans réseau). Après chaque
// modification, les éléments qui ont changé sont envoyés au serveur (table `records`, une ligne JSON par élément) ;
// les modifications des autres (le coach qui commente, le client qui valide une séance) arrivent en temps réel.
// En cas de conflit sur un même élément, la dernière écriture gagne ; une modification locale non encore envoyée
// n'est jamais écrasée par une donnée reçue.

import { useSyncExternalStore } from 'react'
import type { Adaptation, Checkin, GarminLink, GarminSettings, HealthDay, ImportedRun, Program } from '@/engine/types'
import {
  emptyDB, getDB, replaceDB, setChangeHook,
  type AppNotification, type Comment, type DB, type Draft, type EditEntry, type Analysis, type PersonalRecord,
  type Profile, type QuestionnaireRow,
} from './store'
import { supabase } from './supabase'

type Kind = 'q' | 'p' | 'ck' | 'ad' | 'ed' | 'c' | 'pr' | 'an' | 'dr' | 'n' | 'profile' | 'ir' | 'hd' | 'gs' | 'gl'

interface Ent { key: string; kind: Kind; id: string; owner: string; data: unknown }

// ------------------------------------------------------------------ état observable

export type Boot = 'booting' | 'ready'
export type SyncState = 'idle' | 'pending' | 'error'
let boot: Boot = 'booting'
let syncState: SyncState = 'idle'
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
export const useBoot = (): Boot => useSyncExternalStore(subscribe, () => boot)
export const useSyncState = (): SyncState => useSyncExternalStore(subscribe, () => syncState)
const setBoot = (b: Boot) => { boot = b; emit() }
const setSync = (s: SyncState) => { if (syncState !== s) { syncState = s; emit() } }

// ------------------------------------------------------------------ empreintes (détection des changements)

function stable(x: unknown): string {
  if (x === null || typeof x !== 'object') return JSON.stringify(x) ?? 'null'
  if (Array.isArray(x)) return '[' + x.map(stable).join(',') + ']'
  const o = x as Record<string, unknown>
  return '{' + Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + stable(o[k])).join(',') + '}'
}
/** cyrb53 : empreinte 53 bits (assez pour détecter un changement, sans garder tout le JSON en mémoire). */
function fp(str: string): string {
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
const hashOf = (data: unknown) => fp(stable(data))

const SYNCED_KEY = 'mind.remote.synced.v1'
let synced = new Map<string, string>() // clé de l'élément → empreinte de la version connue du serveur
function loadSynced() {
  try { synced = new Map(JSON.parse(localStorage.getItem(SYNCED_KEY) ?? '[]')) } catch { synced = new Map() }
}
function saveSynced() {
  try { localStorage.setItem(SYNCED_KEY, JSON.stringify([...synced])) } catch { /* quota */ }
}

// ------------------------------------------------------------------ éléments des données

type Coll = { list: (d: DB) => any[]; owner: (x: any) => string; sort?: (a: any, b: any) => number }
const desc = (f: string) => (a: any, b: any) => String(b[f]).localeCompare(String(a[f]))
const asc = (f: string) => (a: any, b: any) => String(a[f]).localeCompare(String(b[f]))
const COLL: Record<Exclude<Kind, 'dr'>, Coll> = {
  q: { list: (d) => d.questionnaires, owner: (x: QuestionnaireRow) => x.clientId },
  p: { list: (d) => d.programs, owner: (x: Program) => x.clientId },
  ck: { list: (d) => d.checkins, owner: (x: Checkin) => x.clientId, sort: asc('date') },
  ad: { list: (d) => d.adaptations, owner: (x: Adaptation) => x.clientId, sort: desc('date') },
  ed: { list: (d) => d.edits, owner: (x: EditEntry) => x.clientId, sort: desc('at') },
  c: { list: (d) => d.comments, owner: (x: Comment) => x.clientId, sort: asc('at') },
  pr: { list: (d) => d.records, owner: (x: PersonalRecord) => x.clientId, sort: asc('date') },
  an: { list: (d) => d.analyses, owner: (x: Analysis) => x.clientId, sort: desc('at') },
  // courses importées et santé du jour (écrites par la synchro Garmin ou par l'app), réglage FC max, statut de liaison (écrit par le serveur)
  ir: { list: (d) => d.importedRuns, owner: (x: ImportedRun) => x.clientId, sort: asc('startAt') },
  hd: { list: (d) => d.health, owner: (x: HealthDay) => x.clientId, sort: asc('date') },
  gs: { list: (d) => d.garminSettings, owner: (x: GarminSettings) => x.clientId },
  gl: { list: (d) => d.garminLinks, owner: (x: GarminLink) => x.clientId },
  n: { list: (d) => d.notifications, owner: (x: AppNotification) => x.userId, sort: desc('at') },
  profile: { list: (d) => d.profiles, owner: (x: Profile) => x.id },
}
const KINDS = Object.keys(COLL) as Exclude<Kind, 'dr'>[]
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function entsOf(d: DB): Ent[] {
  const out: Ent[] = []
  for (const kind of KINDS) {
    const c = COLL[kind]
    for (const x of c.list(d)) out.push({ key: `${kind}:${x.id}`, kind, id: x.id, owner: c.owner(x), data: x })
  }
  for (const [cid, dr] of Object.entries(d.drafts)) out.push({ key: `dr:${cid}`, kind: 'dr', id: cid, owner: cid, data: dr })
  return out
}

function findLocal(d: DB, key: string): unknown | undefined {
  const i = key.indexOf(':')
  const kind = key.slice(0, i) as Kind, id = key.slice(i + 1)
  if (kind === 'dr') return d.drafts[id]
  return COLL[kind]?.list(d).find((x) => x.id === id)
}

/** Une modification locale pas encore envoyée : on ne l'écrase pas avec une donnée reçue. */
function hasUnpushed(d: DB, key: string): boolean {
  const local = findLocal(d, key)
  return local !== undefined && synced.get(key) !== hashOf(local)
}

function putLocal(d: DB, kind: Kind, id: string, data: unknown): void {
  if (kind === 'dr') { d.drafts[id] = data as Draft; return }
  const c = COLL[kind]
  const list = c.list(d)
  const i = list.findIndex((x) => x.id === id)
  if (i >= 0) list[i] = data
  else list.push(data)
  if (c.sort) list.sort(c.sort)
}
function removeLocal(d: DB, kind: Kind, id: string): void {
  if (kind === 'dr') { delete d.drafts[id]; return }
  const list = COLL[kind].list(d)
  const i = list.findIndex((x) => x.id === id)
  if (i >= 0) list.splice(i, 1)
}
const splitKey = (key: string) => { const i = key.indexOf(':'); return { kind: key.slice(0, i) as Kind, id: key.slice(i + 1) } }

// ------------------------------------------------------------------ profils (colonnes ↔ objet)

interface ProfileRow { id: string; role: 'coach' | 'client'; first_name: string; email: string; reminder_time: string; theme: Profile['theme']; notifications: boolean; onboarded: boolean; created_at: string }
const toProfile = (r: ProfileRow): Profile => ({
  id: r.id, role: r.role, firstName: r.first_name, email: r.email, reminderTime: (r.reminder_time ?? '18:00').slice(0, 5),
  theme: r.theme, notifications: r.notifications, createdAt: r.created_at, onboarded: r.onboarded,
})
const fromProfile = (p: Profile) => ({ first_name: p.firstName, reminder_time: p.reminderTime, theme: p.theme, notifications: p.notifications, onboarded: p.onboarded })

// ------------------------------------------------------------------ réception (chargement + temps réel)

interface RecRow { id: string; kind: Kind; client_id: string; data: unknown }
interface InboxRow { id: string; user_id: string; data: unknown }

function apply(d: DB, kind: Kind, id: string, data: unknown): void {
  putLocal(d, kind, id, data)
  synced.set(`${kind}:${id}`, hashOf(data))
}

function applyRemote(kind: Kind, id: string, data: unknown): void {
  const key = `${kind}:${id}`
  const d0 = getDB()
  if (hasUnpushed(d0, key)) return
  const cur = findLocal(d0, key)
  if (cur !== undefined && hashOf(cur) === hashOf(data)) { synced.set(key, hashOf(data)); return }
  const next = structuredClone(d0)
  apply(next, kind, id, data)
  replaceDB(next)
  saveSynced()
}
function deleteRemote(key: string): void {
  const d0 = getDB()
  synced.delete(key)
  if (findLocal(d0, key) === undefined || hasUnpushed(d0, key)) return
  const { kind, id } = splitKey(key)
  const next = structuredClone(d0)
  removeLocal(next, kind, id)
  replaceDB(next)
  saveSynced()
}

async function fetchAll<T>(table: string, filter?: (q: any) => any): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += 1000) {
    let q: any = supabase!.from(table).select('*')
    if (filter) q = filter(q)
    const { data, error } = await q.range(from, from + 999)
    if (error) throw error
    rows.push(...(data as T[]))
    if (!data || data.length < 1000) break
  }
  return rows
}

/** Charge tout ce que le compte a le droit de voir et le fusionne avec les données locales. */
async function hydrate(uid: string): Promise<void> {
  const [profiles, records, inbox] = await Promise.all([
    fetchAll<ProfileRow>('profiles'),
    fetchAll<RecRow>('records'),
    fetchAll<InboxRow>('inbox', (q) => q.eq('user_id', uid)),
  ])
  const d0 = getDB()
  const next = structuredClone(d0)
  const seen = new Set<string>()
  for (const r of profiles) {
    const key = `profile:${r.id}`
    seen.add(key)
    if (!hasUnpushed(d0, key)) apply(next, 'profile', r.id, toProfile(r))
  }
  for (const r of records) {
    seen.add(r.id)
    const { kind, id } = splitKey(r.id)
    if (!hasUnpushed(d0, r.id)) apply(next, kind, id, r.data)
  }
  for (const r of inbox) {
    seen.add(r.id)
    const { id } = splitKey(r.id)
    if (!hasUnpushed(d0, r.id)) apply(next, 'n', id, r.data)
  }
  // éléments supprimés côté serveur et sans modification locale en attente
  for (const key of [...synced.keys()]) {
    if (seen.has(key)) continue
    if (hasUnpushed(d0, key)) continue
    const { kind, id } = splitKey(key)
    removeLocal(next, kind, id)
    synced.delete(key)
  }
  replaceDB(next)
  saveSynced()
}

let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null
function listen(uid: string): void {
  stopListening()
  channel = supabase!.channel(`mind-${uid}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'records' }, (p: any) => {
      if (p.eventType === 'DELETE') { if (p.old?.id) deleteRemote(p.old.id) }
      else if (p.new) { const { kind, id } = splitKey(p.new.id); applyRemote(kind, id, p.new.data) }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'inbox' }, (p: any) => {
      if (p.eventType === 'DELETE') { if (p.old?.id) deleteRemote(p.old.id) }
      else if (p.new && p.new.user_id === uid) { const { id } = splitKey(p.new.id); applyRemote('n', id, p.new.data) }
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (p: any) => {
      if (p.new) applyRemote('profile', p.new.id, toProfile(p.new as ProfileRow))
    })
    .subscribe()
}
function stopListening(): void {
  if (channel) { void supabase!.removeChannel(channel); channel = null }
}

// ------------------------------------------------------------------ envoi

let timer: ReturnType<typeof setTimeout> | null = null
let pushing = false
let again = false

function schedulePush(delay = 1200): void {
  if (!getDB().sessionUserId) return
  setSync('pending')
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => { void pushNow() }, delay)
}

export async function pushNow(): Promise<void> {
  if (!supabase) return
  if (timer) { clearTimeout(timer); timer = null }
  if (pushing) { again = true; return }
  pushing = true
  let failed = false
  try {
    const d = getDB()
    const me = d.sessionUserId
    if (!me) return
    const ents = entsOf(d)
    const hashes = new Map(ents.map((e) => [e.key, hashOf(e.data)]))
    const changed = ents.filter((e) => synced.get(e.key) !== hashes.get(e.key) && (UUID.test(e.owner)))
    const gone = [...synced.keys()].filter((k) => !hashes.has(k) && !k.startsWith('profile:'))

    const records = changed.filter((e) => e.kind !== 'n' && e.kind !== 'profile')
    for (let i = 0; i < records.length; i += 30) {
      const chunk = records.slice(i, i + 30)
      const { error } = await supabase.from('records').upsert(
        chunk.map((e) => ({ id: e.key, client_id: e.owner, kind: e.kind, data: e.data as object, updated_at: new Date().toISOString() })),
      )
      if (error) { failed = true; console.warn('[sync] records', error.message) } else chunk.forEach((e) => synced.set(e.key, hashes.get(e.key)!))
    }

    for (const e of changed.filter((x) => x.kind === 'n')) {
      let error: { code?: string; message: string } | null = null
      if (synced.has(e.key)) ({ error } = await supabase.from('inbox').update({ data: e.data as object, updated_at: new Date().toISOString() }).eq('id', e.key))
      else {
        ({ error } = await supabase.from('inbox').insert({ id: e.key, user_id: e.owner, data: e.data as object }))
        if (error?.code === '23505') ({ error } = await supabase.from('inbox').update({ data: e.data as object }).eq('id', e.key))
      }
      if (error) { failed = true; console.warn('[sync] inbox', error.message) } else synced.set(e.key, hashes.get(e.key)!)
    }

    for (const e of changed.filter((x) => x.kind === 'profile')) {
      const { error } = await supabase.from('profiles').update(fromProfile(e.data as Profile)).eq('id', e.id)
      if (error) { failed = true; console.warn('[sync] profile', error.message) } else synced.set(e.key, hashes.get(e.key)!)
    }

    const delRec = gone.filter((k) => !k.startsWith('n:'))
    if (delRec.length) {
      const { error } = await supabase.from('records').delete().in('id', delRec)
      if (error) { failed = true; console.warn('[sync] delete', error.message) } else delRec.forEach((k) => synced.delete(k))
    }
    const delInbox = gone.filter((k) => k.startsWith('n:'))
    if (delInbox.length) {
      const { error } = await supabase.from('inbox').delete().in('id', delInbox)
      if (error) failed = true; else delInbox.forEach((k) => synced.delete(k))
    }

    // les notifications destinées à quelqu'un d'autre sont parties : on ne les garde pas dans les données locales
    const d2 = getDB()
    const foreign = d2.notifications.filter((n) => n.userId !== me && synced.has(`n:${n.id}`))
    if (foreign.length) {
      const next = structuredClone(d2)
      next.notifications = next.notifications.filter((n) => !foreign.some((f) => f.id === n.id))
      foreign.forEach((n) => synced.delete(`n:${n.id}`))
      replaceDB(next)
    }
    saveSynced()
  } catch (e) {
    failed = true
    console.warn('[sync]', e)
  } finally {
    pushing = false
  }
  if (failed) { setSync('error'); timer = setTimeout(() => { void pushNow() }, 8000) }
  else if (again) { again = false; void pushNow() }
  else {
    // une modification a pu arriver pendant l'envoi
    const d = getDB()
    const pending = entsOf(d).some((e) => UUID.test(e.owner) && synced.get(e.key) !== hashOf(e.data))
    if (pending) schedulePush(300); else setSync('idle')
  }
}

// ------------------------------------------------------------------ session

let started: string | null = null

async function startSession(uid: string): Promise<void> {
  if (started === uid) return
  started = uid
  const cached = getDB()
  if (cached.sessionUserId !== uid) {
    // autre compte sur cet appareil : on repart de zéro
    synced = new Map()
    replaceDB({ ...emptyDB(), sessionUserId: uid })
    saveSynced()
  }
  try {
    await hydrate(uid)
  } catch (e) {
    console.warn('[sync] chargement impossible (hors ligne ?)', e)
    setSync('error')
  }
  if (getDB().sessionUserId !== uid) replaceDB({ ...getDB(), sessionUserId: uid })
  listen(uid)
  void pushNow() // envoie d'éventuelles modifications faites hors ligne
}

async function endSession(): Promise<void> {
  started = null
  stopListening()
  if (timer) { clearTimeout(timer); timer = null }
  synced = new Map()
  try { localStorage.removeItem(SYNCED_KEY) } catch { /* ok */ }
  replaceDB(emptyDB())
  setSync('idle')
}

const FR_ERRORS: [RegExp, string][] = [
  [/invalid login credentials/i, 'Email ou mot de passe incorrect.'],
  [/already registered|already been registered/i, 'Un compte existe déjà avec cet email. Connecte-toi plutôt.'],
  [/password should be at least/i, 'Le mot de passe doit contenir au moins 6 caractères.'],
  [/valid email|invalid email/i, 'Cette adresse email ne semble pas valide.'],
  [/email not confirmed/i, 'Email pas encore confirmé : ouvre le lien reçu par mail.'],
  [/rate limit|too many/i, 'Trop de tentatives : réessaie dans quelques minutes.'],
  [/fetch|network/i, 'Pas de connexion : réessaie dans un instant.'],
]
const frError = (m: string) => FR_ERRORS.find(([re]) => re.test(m))?.[1] ?? 'Une erreur est survenue. Réessaie.'

export async function remoteSignIn(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase!.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
  if (error || !data.user) return { ok: false, error: frError(error?.message ?? '') }
  await startSession(data.user.id)
  return { ok: true }
}

export async function remoteSignUp(email: string, password: string, firstName: string): Promise<{ ok: boolean; error?: string }> {
  const e = email.trim().toLowerCase()
  if (!/^\S+@\S+\.\S+$/.test(e)) return { ok: false, error: 'Cette adresse email ne semble pas valide.' }
  if (password.length < 6) return { ok: false, error: 'Le mot de passe doit contenir au moins 6 caractères.' }
  const { data, error } = await supabase!.auth.signUp({ email: e, password, options: { data: { first_name: firstName.trim() } } })
  if (error) return { ok: false, error: frError(error.message) }
  if (!data.session || !data.user) return { ok: false, error: 'Compte créé : confirme ton email grâce au lien reçu, puis connecte-toi.' }
  await startSession(data.user.id)
  return { ok: true }
}

export async function remoteSignOut(): Promise<void> {
  try { await pushNow() } catch { /* on déconnecte quand même */ }
  await supabase!.auth.signOut()
  await endSession()
}

/** À appeler une fois au démarrage de l'app. */
export async function initRemote(): Promise<void> {
  if (!supabase) { setBoot('ready'); return }
  loadSynced()
  setChangeHook(() => schedulePush())
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void pushNow() })
  window.addEventListener('pagehide', () => { void pushNow() })
  window.addEventListener('online', () => { void pushNow() })
  supabase.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT' && started) void endSession() })
  try {
    const { data } = await supabase.auth.getSession()
    if (data.session) {
      // ouverture instantanée avec le cache, le chargement se termine en arrière-plan
      const cachedOk = getDB().sessionUserId === data.session.user.id && getDB().profiles.length > 0
      if (cachedOk) { setBoot('ready'); await startSession(data.session.user.id) }
      else { await startSession(data.session.user.id) }
    } else if (getDB().sessionUserId) await endSession()
  } catch (e) {
    console.warn('[sync] démarrage', e)
  }
  setBoot('ready')
}
