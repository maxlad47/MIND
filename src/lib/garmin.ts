// Liaison Garmin côté app : appels aux Edge Functions et tâches de fond. La clé personnelle n'est JAMAIS gardée ici :
// elle part une seule fois en HTTPS vers `garmin-personal-link`, puis le champ est vidé. Rien dans localStorage.
import { useEffect } from 'react'
import { addDays, todayISO } from '@/engine/utils'
import { useHydrations } from './remote'
import { attachPendingRuns, linkOf, useDB } from './store'
import { REMOTE, supabase } from './supabase'

/** Liaison par clé personnelle : active dans l'app en ligne quand VITE_GARMIN_PERSONAL=true. */
export const GARMIN_PERSONAL = import.meta.env.VITE_GARMIN_PERSONAL === 'true'
/** Accès officiel Starter (OAuth) : préparé, masqué tant que VITE_GARMIN_ENABLED n'est pas « true ». */
export const GARMIN_STARTER = import.meta.env.VITE_GARMIN_ENABLED === 'true'

const base = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const DURATIONS: { days: number; label: string }[] = [{ days: 30, label: '30 jours' }, { days: 90, label: '90 jours' }, { days: 180, label: '180 jours' }, { days: 365, label: '1 an' }]
/** Date d'expiration de la clé d'après la durée choisie chez Garmin. */
export const expiryFrom = (days: number, today = todayISO()): string => addDays(today, days)

export interface CallResult { ok: boolean; status: number; message?: string; data: Record<string, unknown> }

async function call(fn: string, body: object): Promise<CallResult> {
  if (!supabase || !base) return { ok: false, status: 0, message: 'Cette fonction demande l\'app en ligne.', data: {} }
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return { ok: false, status: 401, message: 'Connecte-toi pour continuer.', data: {} }
    const res = await fetch(`${base}/functions/v1/${fn}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...(anon ? { apikey: anon } : {}) }, body: JSON.stringify(body) })
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
    return { ok: res.ok, status: res.status, message: typeof json.message === 'string' ? json.message : res.ok ? undefined : 'Une erreur est survenue. Réessaie.', data: json }
  } catch {
    return { ok: false, status: 0, message: 'Pas de connexion : réessaie dans un instant.', data: {} }
  }
}

/** Envoie la clé UNE fois ; l'appelant vide son champ ensuite. */
export const linkGarmin = (apiKey: string, durationDays: number) => call('garmin-personal-link', { action: 'link', apiKey, durationDays })
export const unlinkGarmin = () => call('garmin-personal-link', { action: 'unlink' })
/** Coach : autorise (ou non) la liaison par clé personnelle pour un client. */
export const setGarminAllowed = (clientId: string, allowed: boolean) => call('garmin-personal-link', { action: 'allow', clientId, allowed })
export const syncGarmin = (reason: 'open' | 'manual' = 'manual') => call('garmin-personal-sync', { reason })

const OPEN_KEY = 'mind.garmin.openSync'
const OPEN_GAP_MS = 5 * 60 * 1000
/** À l'ouverture de l'app : au plus une synchro toutes les 5 minutes (le serveur applique la même limite). */
export async function syncOnOpen(now = Date.now()): Promise<void> {
  try {
    const last = Number(localStorage.getItem(OPEN_KEY) ?? 0)
    if (now - last < OPEN_GAP_MS) return
    localStorage.setItem(OPEN_KEY, String(now))
  } catch { /* stockage indisponible : le serveur limite quand même */ }
  await syncGarmin('open')
}

/** « il y a 12 min » */
export function fmtAgo(iso: string | undefined, now = Date.now()): string {
  if (!iso) return 'jamais'
  const min = Math.max(0, Math.round((now - Date.parse(iso)) / 60000))
  if (min < 1) return 'à l\'instant'
  if (min < 60) return `il y a ${min} min`
  const h = Math.round(min / 60)
  return h < 48 ? `il y a ${h} h` : `il y a ${Math.round(h / 24)} j`
}

/**
 * Tâches de fond d'un compte : rattache les activités arrivées (montre, fichier) à la séance prévue, et lance une synchro à l'ouverture
 * si la montre est liée. Le rattachement est le même sur tous les appareils : aucun doublon possible.
 */
export function useGarminAuto(userId: string): void {
  const db = useDB()
  const pending = db.importedRuns.filter((r) => r.status === 'a_rattacher' && (!REMOTE || r.clientId === userId)).length
  const hasProgram = db.programs.some((p) => p.clientId === userId && p.status === 'actif')
  const hydrations = useHydrations()
  // après chaque chargement serveur : rattache les nouvelles sorties et répare celles dont la séance a perdu les données
  useEffect(() => { if (hydrations > 0 && hasProgram) attachPendingRuns() }, [pending, hasProgram, hydrations])
  const linked = linkOf(db, userId)?.state === 'liee'
  useEffect(() => { if (REMOTE && GARMIN_PERSONAL && linked) void syncOnOpen() }, [userId, linked])
}

/** Accès officiel Starter (préparé, masqué) : démarre la liaison OAuth et ouvre la page d'autorisation Garmin. */
export async function startGarminOAuth(): Promise<CallResult> {
  const r = await call('garmin-connect', {})
  if (r.ok && typeof r.data.redirectUrl === 'string') window.location.href = r.data.redirectUrl
  return r
}
