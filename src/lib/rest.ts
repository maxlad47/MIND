// Minuteur de repos. Il se base sur un HORODATAGE DE FIN, pas sur un compteur : quand l'iPhone verrouille l'écran ou met l'app
// en arrière-plan, le temps restant est juste au retour, et le minuteur survit à un rechargement de la page.
// État local à l'appareil (pas synchronisé) : il vit dans localStorage, hors de la base de données de l'app.

import { useEffect, useState, useSyncExternalStore } from 'react'

export interface RestTimer {
  /** Horodatage (ms) de la fin du repos. */
  endAt: number
  /** Durée totale (ms de départ, ajustements compris), pour la barre de progression. */
  totalSec: number
  label: string
  /** La fin a été signalée (son, animation). */
  fired?: boolean
}

// ------------------------------------------------------------------ calculs purs

/** Secondes restantes, calculées depuis l'horodatage de fin. */
export function remainingSec(t: Pick<RestTimer, 'endAt'>, now = Date.now()): number {
  return Math.max(0, Math.ceil((t.endAt - now) / 1000))
}
/** Nouveau minuteur d'`sec` secondes à partir de `now`. */
export function makeTimer(sec: number, label: string, now = Date.now()): RestTimer {
  return { endAt: now + Math.max(0, sec) * 1000, totalSec: Math.max(0, sec), label }
}
/** Ajoute ou retire des secondes (−15 s / +15 s) ; le reste ne descend jamais sous 0. */
export function shiftTimer(t: RestTimer, deltaSec: number, now = Date.now()): RestTimer {
  const left = remainingSec(t, now)
  const next = Math.max(0, left + deltaSec)
  return { ...t, endAt: now + next * 1000, totalSec: Math.max(t.totalSec + deltaSec, next, 1), fired: next === 0 ? t.fired : false }
}
/** Un repos terminé il y a longtemps (page rechargée bien après) n'est pas réaffiché. */
export const STALE_MS = 10 * 60 * 1000
export const isStale = (t: Pick<RestTimer, 'endAt'>, now = Date.now()): boolean => now - t.endAt > STALE_MS

// ------------------------------------------------------------------ état

const KEY = 'mind.rest.v1'
const SOUND_KEY = 'mind.rest.sound'
const AUTO_KEY = 'mind.rest.auto'

function load(): RestTimer | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const t = JSON.parse(raw) as RestTimer
    return t && typeof t.endAt === 'number' && !isStale(t) ? t : null
  } catch { return null }
}
function save(t: RestTimer | null): void {
  try { if (t) localStorage.setItem(KEY, JSON.stringify(t)); else localStorage.removeItem(KEY) } catch { /* stockage indisponible */ }
}

let timer: RestTimer | null = load()
/** Signal « Enchaîne » (pas de minuteur) : un bandeau très court. */
let chain: { label: string; at: number } | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export const getRestTimer = (): RestTimer | null => timer
export const getChain = (): { label: string; at: number } | null => chain

export function setRestSound(on: boolean): void {
  try { localStorage.setItem(SOUND_KEY, on ? '1' : '0') } catch { /* ok */ }
  emit()
}
/** Minuteur qui démarre tout seul quand on valide une série (réglage du profil, par défaut coupé). */
export function setRestAuto(on: boolean): void {
  try { localStorage.setItem(AUTO_KEY, on ? '1' : '0') } catch { /* ok */ }
  if (!on) { timer = null; chain = null; save(null) }
  emit()
}
export function restAutoOn(): boolean {
  try { return localStorage.getItem(AUTO_KEY) === '1' } catch { return false }
}
/** Son activé (par défaut oui). */
export function restSoundOn(): boolean {
  try { return localStorage.getItem(SOUND_KEY) !== '0' } catch { return true }
}

/**
 * Lance un repos. Appelé depuis un geste de l'utilisateur (validation d'une série) : c'est ce qui permet à iOS de
 * débloquer le son de fin de repos.
 */
export function startRest(sec: number, label: string, now = Date.now()): void {
  if (sec <= 0) return
  unlockAudio()
  timer = makeTimer(sec, label, now)
  chain = null
  save(timer)
  emit()
}
export function adjustRest(deltaSec: number, now = Date.now()): void {
  if (!timer) return
  timer = shiftTimer(timer, deltaSec, now)
  save(timer)
  emit()
}
export function skipRest(): void {
  timer = null
  save(null)
  emit()
}
/** Enchaînement sans repos : un signal bref (« Enchaîne B2 »). */
export function signalChain(label: string, now = Date.now()): void {
  chain = { label, at: now }
  emit()
}
export function clearChain(): void {
  if (!chain) return
  chain = null
  emit()
}
/** Marque la fin du repos comme signalée (son, animation) ; renvoie vrai la première fois. */
export function markRestFired(): boolean {
  if (!timer || timer.fired) return false
  timer = { ...timer, fired: true }
  save(timer)
  emit()
  return true
}

// ------------------------------------------------------------------ son et vibration

let ctx: AudioContext | null = null
function unlockAudio(): void {
  try {
    const AC = (globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    ctx ??= new AC()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch { /* son indisponible */ }
}

/** Fin du repos : un son court (si le son est autorisé et l'app au premier plan) ; vibration seulement si elle existe (iOS Safari n'en a pas). */
export function playRestEnd(): void {
  try {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible' && restSoundOn() && ctx && ctx.state === 'running') {
      const t0 = ctx.currentTime
      for (const [i, f] of [880, 1175].entries()) {
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.type = 'sine'
        o.frequency.value = f
        g.gain.setValueAtTime(0.0001, t0 + i * 0.16)
        g.gain.exponentialRampToValueAtTime(0.28, t0 + i * 0.16 + 0.02)
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.16 + 0.14)
        o.connect(g).connect(ctx.destination)
        o.start(t0 + i * 0.16)
        o.stop(t0 + i * 0.16 + 0.16)
      }
    }
  } catch { /* ok */ }
  try { if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate([120, 60, 120]) } catch { /* ok */ }
}

// ------------------------------------------------------------------ hooks React

export function useRest(): { timer: RestTimer | null; chain: { label: string; at: number } | null; sound: boolean; auto: boolean } {
  const t = useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb) } }, getRestTimer)
  const c = useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb) } }, getChain)
  const sound = useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb) } }, restSoundOn)
  const auto = useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb) } }, restAutoOn)
  return { timer: t, chain: c, sound, auto }
}

/** Heure courante, rafraîchie toutes les `ms` tant que `active` : sert aux décomptes (repos, EMOM, AMRAP, chrono). */
export function useNow(active = true, ms = 250): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), ms)
    const vis = () => setNow(Date.now())
    document.addEventListener('visibilitychange', vis)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', vis) }
  }, [active, ms])
  return now
}
