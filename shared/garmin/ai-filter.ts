// « Pas d'IA » : les activités Garmin / FIT et la santé du jour ne partent JAMAIS vers Claude.
// Ce filtre est le seul endroit : `handleAI` (shared/ai-core.ts) l'applique à toute entrée avant de construire un prompt.

/** Clés qui portent des données de montre. */
const BLOCKED_KEYS = new Set([
  'importedRuns', 'importedRun', 'health', 'healthDays', 'hrSeries', 'splits', 'laps', 'steps', 'sleepMinutes', 'sleepScore', 'sleepPhases',
  'avgHr', 'maxHr', 'garmin', 'garminLink', 'garminSettings',
])

/** Un objet venu de la montre (activité importée, course rattachée via Garmin ou fichier FIT). */
const isWatchObject = (o: Record<string, unknown>): boolean => o.source === 'garmin' || o.source === 'fit'

/** Copie profonde sans aucune donnée de montre. */
export function stripWatchData<T>(value: T): T {
  if (Array.isArray(value)) return value.filter((x) => !(x && typeof x === 'object' && isWatchObject(x as Record<string, unknown>))).map(stripWatchData) as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (BLOCKED_KEYS.has(k)) continue
      if (v && typeof v === 'object' && !Array.isArray(v) && isWatchObject(v as Record<string, unknown>)) continue
      out[k] = stripWatchData(v)
    }
    return out as T
  }
  return value
}
