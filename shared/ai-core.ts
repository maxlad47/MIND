// Couche IA — partagée entre le serveur de dev (vite.config.ts) et les Edge Functions Supabase.
// La clé Anthropic n'est JAMAIS dans le front : elle ne vit que côté serveur.

import { z } from 'zod'

export const MODEL = 'claude-sonnet-5-5'

export const personalizeSchema = z.object({
  weekNotes: z.record(z.string(), z.string().max(260)).default({}),
  swaps: z.array(z.object({
    sessionId: z.string(),
    exerciseId: z.string(),
    replacementId: z.string(),
  })).max(40).default([]),
})
export type PersonalizeResult = z.infer<typeof personalizeSchema>

export const weeklySchema = z.object({
  summary: z.string().max(700),
  suggestions: z.array(z.object({
    text: z.string().max(300),
    weekN: z.number().int(),
    // garde-fou : jamais d'augmentation de volume de plus de 10 %, ni de baisse de plus de 30 %
    factor: z.number().min(0.7).max(1.1),
  })).max(3).default([]),
})
export type WeeklyResult = z.infer<typeof weeklySchema>

const SYSTEM = `Tu es l'assistant d'un coach sportif français. Tu réponds UNIQUEMENT par un objet JSON valide, sans texte autour.
Ton ton est chaleureux, concret et bienveillant, en français, au tutoiement. Tu ne donnes aucun conseil médical.
Tu ne peux jamais dépasser les garde-fous : respecter les zones de blessure, ne proposer que des exercices de la liste « alternatives » fournie, ne pas augmenter le volume de plus de 10 %.`

export function personalizePrompt(summary: unknown): { system: string; user: string } {
  return {
    system: SYSTEM,
    user: `Voici un programme généré par le moteur de règles (JSON). Personnalise-le :
1) "weekNotes" : pour chaque semaine (clé = numéro), une note courte du coach (≤ 200 caractères) adaptée à la phase et au profil.
2) "swaps" : au plus quelques remplacements d'exercices pertinents (blessures, niveau). "replacementId" DOIT être dans la liste "alternatives" de l'exercice concerné.
Réponds avec : {"weekNotes": {"1": "..."}, "swaps": [{"sessionId": "...", "exerciseId": "...", "replacementId": "..."}]}

${JSON.stringify(summary)}`,
  }
}

export function weeklyPrompt(stats: unknown): { system: string; user: string } {
  return {
    system: SYSTEM,
    user: `Voici les statistiques de la semaine écoulée d'un client. Écris un résumé (≤ 450 caractères) et au plus 2 suggestions d'ajustement pour la semaine suivante.
Chaque suggestion : {"text": "...", "weekN": <semaine suivante>, "factor": <0.7 à 1.0>} (factor = multiplicateur du volume de la semaine suivante).
Réponds avec : {"summary": "...", "suggestions": [...]}

${JSON.stringify(stats)}`,
  }
}

function extractJSON(text: string): unknown {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end < 0) throw new Error('Réponse sans JSON')
  return JSON.parse(text.slice(start, end + 1))
}

export async function callClaude(apiKey: string, p: { system: string; user: string }): Promise<unknown> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 4000, system: p.system, messages: [{ role: 'user', content: p.user }] }),
  })
  if (!res.ok) throw new Error(`Anthropic ${res.status}`)
  const data = (await res.json()) as { content: { type: string; text?: string }[] }
  const text = data.content.filter((c) => c.type === 'text').map((c) => c.text).join('')
  return extractJSON(text)
}

export type AIRoute = 'personalize' | 'weekly'

/** Point d'entrée commun : valide l'entrée, appelle Claude, valide la sortie (Zod). */
export async function handleAI(route: AIRoute, body: unknown, apiKey: string | undefined): Promise<{ status: number; json: unknown }> {
  if (!apiKey) return { status: 503, json: { error: 'no_key' } }
  try {
    if (route === 'personalize') {
      const out = personalizeSchema.safeParse(await callClaude(apiKey, personalizePrompt(body)))
      return out.success ? { status: 200, json: out.data } : { status: 422, json: { error: 'invalid' } }
    }
    const out = weeklySchema.safeParse(await callClaude(apiKey, weeklyPrompt(body)))
    return out.success ? { status: 200, json: out.data } : { status: 422, json: { error: 'invalid' } }
  } catch {
    return { status: 502, json: { error: 'upstream' } }
  }
}
