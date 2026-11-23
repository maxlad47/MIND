// Appels à la couche IA (serveur uniquement). Toute réponse est revalidée ici avec les garde-fous du moteur.
// Si l'IA est indisponible ou renvoie quelque chose d'invalide, on garde le résultat du moteur de règles.

import { z } from 'zod'
import { alternativesFor, EXERCISE_BY_ID } from '@/engine/exercises'
import { allSessions, ruleBasedWeeklyAnalysis, weekStats } from '@/engine/adapt'
import { personalizeSchema, weeklySchema } from '../../shared/ai-core'
import { addSuggestions, applyAIPersonalization, getDB, mutate, setAnalysis } from './store'
import { isLibre, weekRecap } from '@/engine/libre'
import { uid, todayISO } from '@/engine/utils'

const base = (import.meta.env.VITE_SUPABASE_URL as string | undefined)
const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)

async function post<T>(route: 'personalize' | 'weekly', body: unknown, schema: z.ZodType<T>): Promise<T | null> {
  try {
    const url = base ? `${base}/functions/v1/ai-${route === 'weekly' ? 'weekly-analysis' : 'personalize'}` : `/api/ai/${route}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(base && anon ? { authorization: `Bearer ${anon}` } : {}) },
      body: JSON.stringify(body),
    })
    if (!res.ok) return null
    const parsed = schema.safeParse(await res.json())
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/** Personnalise le programme (notes de semaine + remplacements d'exercices) sans bloquer l'interface. */
export async function personalizeInBackground(programId: string): Promise<boolean> {
  const p = getDB().programs.find((x) => x.id === programId)
  if (!p || isLibre(p)) return false // mode libre : MIND ne personalise ni ne remplace rien
  const summary = {
    goal: p.goal, type: p.type, level: p.q.strength.level, injuries: p.q.injuries, priority: p.priority,
    raceDistance: p.raceDistance, objective: p.objective,
    weeks: p.weeks.map((w) => ({
      n: w.n, phase: w.phase, light: w.light,
      sessions: w.sessions.map((s) => ({
        id: s.id, title: s.title, kind: s.kind,
        exercises: (s.exercises ?? []).map((e) => ({ exerciseId: e.exerciseId, alternatives: alternativesFor(e.exerciseId, p.q.injuries, p.q.strength.level).slice(0, 4).map((a) => a.id) })),
      })),
    })).slice(0, 2),
  }
  const out = await post('personalize', summary, personalizeSchema)
  if (!out) return false
  const notes: Record<number, string> = {}
  for (const [k, v] of Object.entries(out.weekNotes)) if (Number(k) >= 1 && Number(k) <= p.weeks.length) notes[Number(k)] = v
  applyAIPersonalization(programId, notes)
  // remplacements : uniquement parmi les alternatives autorisées (même muscle, même schéma, hors contre-indications)
  mutate((d) => {
    const pr = d.programs.find((x) => x.id === programId)
    if (!pr) return
    for (const sw of out.swaps) {
      const s = allSessions(pr).find((x) => x.id === sw.sessionId)
      const e = s?.exercises?.find((x) => x.exerciseId === sw.exerciseId)
      if (!e || !EXERCISE_BY_ID[sw.replacementId]) continue
      const ok = alternativesFor(sw.exerciseId, pr.q.injuries, pr.q.strength.level).some((a) => a.id === sw.replacementId)
      if (ok) { e.exerciseId = sw.replacementId; e.targetKg = undefined }
    }
  })
  return true
}

/** Analyse de la semaine écoulée : IA si disponible, règles sinon. Les suggestions restent « proposées ». */
export async function analyzeWeek(programId: string, weekN: number): Promise<'ia' | 'regles'> {
  const p = getDB().programs.find((x) => x.id === programId)
  if (!p) return 'regles'
  if (isLibre(p)) {
    // mode libre : simple bilan, aucune suggestion qui touche à la structure du programme
    setAnalysis(programId, weekN, weekRecap(p, weekN), 'regles')
    return 'regles'
  }
  const today = todayISO()
  const rules = ruleBasedWeeklyAnalysis(p, weekN, today)
  const out = await post('weekly', { weekN, next: weekN + 1, stats: weekStats(p, weekN), phase: p.weeks.find((w) => w.n === weekN + 1)?.phase }, weeklySchema)
  if (!out) {
    setAnalysis(programId, weekN, rules.summary, 'regles')
    addSuggestions(rules.suggestions)
    return 'regles'
  }
  setAnalysis(programId, weekN, out.summary, 'ia')
  addSuggestions(out.suggestions.map((s) => ({
    id: uid('ad'), clientId: p.clientId, programId, date: today, kind: 'suggestion_ia' as const, status: 'propose' as const,
    text: s.text, payload: { type: 'scale_week', weekN: s.weekN, factor: s.factor },
  })))
  return 'ia'
}
