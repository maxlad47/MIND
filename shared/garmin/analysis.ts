// Calculs purs sur une activité : km par km, réduction de la série de fréquence cardiaque. Partagé app / Edge Functions.
import type { HrPoint, ImportedSplit } from './types.ts'

export const paceOf = (seconds: number, km: number): number => (km > 0 ? seconds / km : 0)

/** Un point d'enregistrement : `t` secondes depuis le départ, `d` mètres cumulés, `hr` facultatif. */
export interface RecordPoint { t: number; d: number; hr?: number }

/** Un tronçon par km entier, plus le dernier km partiel (s'il dépasse 50 m). Le temps est interpolé au passage de chaque km. */
export function buildSplits(points: RecordPoint[]): ImportedSplit[] {
  const pts = points.filter((p) => Number.isFinite(p.t) && Number.isFinite(p.d)).sort((a, b) => a.t - b.t)
  if (pts.length < 2) return []
  const total = pts[pts.length - 1].d
  const out: ImportedSplit[] = []
  const timeAt = (dist: number): number => {
    let lo = 0
    while (lo < pts.length - 1 && pts[lo + 1].d < dist) lo++
    const a = pts[lo], b = pts[Math.min(lo + 1, pts.length - 1)]
    if (b.d <= a.d) return a.t
    return a.t + ((dist - a.d) / (b.d - a.d)) * (b.t - a.t)
  }
  const hrBetween = (t0: number, t1: number): number | undefined => {
    const hrs = pts.filter((p) => p.hr && p.t >= t0 && p.t <= t1).map((p) => p.hr!)
    return hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : undefined
  }
  let startD = 0, startT = pts[0].t
  while (startD < total) {
    const endD = Math.min(startD + 1000, total)
    const len = endD - startD
    if (len < 50 && out.length) break
    const endT = timeAt(endD)
    const seconds = Math.round(endT - startT)
    const km = Math.round((len / 1000) * 1000) / 1000
    out.push({ km, seconds, avgPaceSec: Math.round(seconds / km), avgHr: hrBetween(startT, endT) })
    startD = endD
    startT = endT
  }
  return out
}

/** Ramène la série de FC à un point toutes les `stepSec` secondes (moyenne par tranche) : léger dans un record JSON. */
export function reduceHrSeries(points: HrPoint[], stepSec = 10): HrPoint[] {
  const valid = points.filter((p) => p.hr > 0 && Number.isFinite(p.t)).sort((a, b) => a.t - b.t)
  const buckets = new Map<number, number[]>()
  for (const p of valid) {
    const k = Math.floor(p.t / stepSec)
    buckets.set(k, [...(buckets.get(k) ?? []), p.hr])
  }
  return [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => ({ t: k * stepSec, hr: Math.round(v.reduce((a, b) => a + b, 0) / v.length) }))
}

/** Identifiant d'enregistrement déterministe à partir de l'identifiant externe. */
export const runIdOf = (externalId: string): string => 'ir-' + externalId.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')
