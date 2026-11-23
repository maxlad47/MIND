// Lecture d'un fichier .fit (ou du .zip « Exporter l'original » de Garmin Connect).
// Partagé : navigateur (import manuel) et Edge Function (synchro de la clé personnelle). Sans accès réseau.
import FitParser from 'fit-file-parser'
import { unzipSync } from 'fflate'
import { buildSplits, paceOf, reduceHrSeries, type RecordPoint } from './analysis.ts'
import type { ActivityType, ImportedLap, RunData } from './types.ts'

const isZip = (b: Uint8Array) => b.length > 4 && b[0] === 0x50 && b[1] === 0x4b // « PK »

/** Renvoie les octets du premier .fit : le fichier lui-même, ou le premier .fit d'un .zip. */
export function extractFit(bytes: Uint8Array): { fit: Uint8Array; name?: string } {
  if (!isZip(bytes)) return { fit: bytes }
  const files = unzipSync(bytes)
  const name = Object.keys(files).sort().find((n) => n.toLowerCase().endsWith('.fit'))
  if (!name) throw new Error('Aucun fichier .fit dans ce zip.')
  return { fit: files[name], name }
}

/** Identifiant d'activité Garmin lu dans un nom de fichier (« 12345678901_ACTIVITY.fit », « 12345678901.zip »). */
export function garminIdFromName(name?: string): string | undefined {
  return name?.match(/(?:^|[\\/_-])(\d{7,})(?=[_.\-]|$)/)?.[1]
}

export function activityTypeOf(sport?: string, sub?: string): ActivityType {
  const s = (sport ?? '').toLowerCase(), u = (sub ?? '').toLowerCase()
  if (s === 'running') return u === 'treadmill' ? 'tapis' : u === 'trail' ? 'trail' : u === 'track' ? 'piste' : 'route'
  if (s === 'cycling' || s === 'e_biking') return 'velo'
  if (s === 'walking' || s === 'hiking') return 'marche'
  if (s === 'training') return 'muscu'
  return 'autre'
}

const pad = (n: number) => String(n).padStart(2, '0')
/** Date locale sans fuseau : les composantes UTC d'un instant décalé du fuseau de l'activité. */
const localIso = (d: Date, offsetSec: number): string => {
  const x = new Date(d.getTime() + offsetSec * 1000)
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}T${pad(x.getUTCHours())}:${pad(x.getUTCMinutes())}:${pad(x.getUTCSeconds())}`
}

/** Lit un .fit déjà décompressé. `localStartAt` (fuseau connu par ailleurs) prime sur le décalage trouvé dans le fichier. */
export async function parseFit(bytes: Uint8Array, opts: { localStartAt?: string } = {}): Promise<RunData> {
  const parser = new FitParser({ force: true, speedUnit: 'm/s', lengthUnit: 'm', elapsedRecordField: true, mode: 'list' })
  const copy = bytes.slice().buffer as ArrayBuffer
  const fit = await parser.parseAsync(copy)
  const session = fit.sessions?.[0]
  if (!session) throw new Error('Ce fichier ne contient pas de séance.')
  const records = fit.records ?? []
  const startDate = new Date(session.start_time ?? records[0]?.timestamp ?? Date.now())
  const startMs = startDate.getTime()
  const act = fit.activity
  const offset = act?.local_timestamp && act?.timestamp ? Math.round((new Date(act.local_timestamp).getTime() - new Date(act.timestamp).getTime()) / 1000) : 0

  const meters = Number(session.total_distance ?? records[records.length - 1]?.distance ?? 0)
  const km = Math.round((meters / 1000) * 1000) / 1000
  const seconds = Math.round(Number(session.total_timer_time ?? session.total_elapsed_time ?? 0))
  const pts: RecordPoint[] = records
    .filter((r) => r.timestamp && typeof r.distance === 'number')
    .map((r) => ({ t: Math.round((new Date(r.timestamp!).getTime() - startMs) / 1000), d: r.distance!, hr: r.heart_rate || undefined }))
  const hr = records.filter((r) => r.timestamp && r.heart_rate).map((r) => ({ t: Math.round((new Date(r.timestamp!).getTime() - startMs) / 1000), hr: r.heart_rate! }))

  const laps: ImportedLap[] = (fit.laps ?? [])
    .filter((l) => (l.total_distance ?? 0) > 0 && (l.total_timer_time ?? l.total_elapsed_time ?? 0) > 0)
    .map((l) => {
      const sec = Math.round(Number(l.total_timer_time ?? l.total_elapsed_time))
      return { meters: Math.round(Number(l.total_distance)), seconds: sec, avgPaceSec: Math.round(paceOf(sec, Number(l.total_distance) / 1000)), avgHr: l.avg_heart_rate || undefined }
    })

  return {
    externalId: undefined,
    startAt: opts.localStartAt ?? localIso(startDate, offset),
    km, seconds,
    avgPaceSec: Math.round(paceOf(seconds, km)),
    avgHr: session.avg_heart_rate || undefined,
    maxHr: session.max_heart_rate || undefined,
    elevationGain: session.total_ascent ? Math.round(Number(session.total_ascent)) : undefined,
    laps: laps.length ? laps : undefined,
    splits: pts.length > 1 ? buildSplits(pts) : undefined,
    hrSeries: hr.length ? reduceHrSeries(hr, 10) : undefined,
    activityType: activityTypeOf(String(session.sport ?? ''), String(session.sub_sport ?? '')),
  }
}

/** Point d'entrée commun : .fit ou .zip, avec le nom du fichier pour retrouver l'id Garmin. */
export async function parseFitFile(bytes: Uint8Array, fileName?: string, opts: { localStartAt?: string } = {}): Promise<RunData> {
  const { fit, name } = extractFit(bytes)
  const data = await parseFit(fit, opts)
  const gid = garminIdFromName(fileName) ?? garminIdFromName(name)
  return { ...data, externalId: gid ? `garmin:${gid}` : undefined }
}
