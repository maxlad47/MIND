// Edge Function — couche IA (personalize). La clé Anthropic reste ici (secret Supabase), jamais dans le front.
// Déploiement : supabase functions deploy ai-personalize && supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
import { handleAI } from '../../../shared/ai-core.ts'
import { cors } from '../_cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const body = await req.json().catch(() => ({}))
  const out = await handleAI('personalize', body, Deno.env.get('ANTHROPIC_API_KEY'))
  return new Response(JSON.stringify(out.json), { status: out.status, headers: { ...cors, 'Content-Type': 'application/json' } })
})
