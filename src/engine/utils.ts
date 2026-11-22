// Utilitaires de dates (UTC pour éviter les décalages de fuseau) et formats.

let counter = 0
export function uid(prefix = 'id'): string {
  counter += 1
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}
export function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}
export function addDays(iso: string, n: number): string {
  const d = parseDate(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return fmtDate(d)
}
/** 0 = lundi … 6 = dimanche */
export function weekday(iso: string): number {
  return (parseDate(iso).getUTCDay() + 6) % 7
}
export function mondayOf(iso: string): string {
  return addDays(iso, -weekday(iso))
}
export function diffDays(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000)
}
export function todayISO(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export const DAY_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
export const DAY_NAMES = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']
export const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
export const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

export function dayName(iso: string): string {
  return DAY_NAMES[weekday(iso)]
}
export function prettyDate(iso: string): string {
  const d = parseDate(iso)
  return `${DAY_NAMES[weekday(iso)]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}
export function shortDate(iso: string): string {
  const d = parseDate(iso)
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`
}
export function ageFrom(birth: string, now = todayISO()): number {
  const b = parseDate(birth)
  const n = parseDate(now)
  let a = n.getUTCFullYear() - b.getUTCFullYear()
  if (n.getUTCMonth() < b.getUTCMonth() || (n.getUTCMonth() === b.getUTCMonth() && n.getUTCDate() < b.getUTCDate())) a -= 1
  return a
}

export function round(n: number, step: number): number {
  return Math.round(n / step) * step
}
export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

/** 255 → "4:15" */
export function fmtPace(secPerKm: number): string {
  const s = Math.round(secPerKm)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
/** 3600 → "1:00:00" ; 1500 → "25:00" */
export function fmtTime(seconds: number): string {
  const s = Math.round(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`
}
/** "3:45:00" ou "45:30" → secondes */
export function parseTime(str: string): number | undefined {
  const parts = str.trim().split(':').map((p) => Number(p))
  if (parts.some((p) => Number.isNaN(p)) || parts.length < 2 || parts.length > 3) return undefined
  return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1]
}
export function fmtKm(km: number): string {
  return (Math.round(km * 10) / 10).toString().replace('.', ',')
}

/** Hash déterministe 32 bits (pochettes, graines). */
export function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
