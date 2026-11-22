// Edge Function planifiée (pg_cron) : rappels Web Push et analyse hebdomadaire.
//   ?task=reminders  → pour chaque client dont l'heure de rappel est l'heure courante et qui a une séance aujourd'hui
//   ?task=weekly     → déclenche l'analyse hebdomadaire (IA) pour chaque programme actif
// Utilise la clé service_role (secret Supabase, jamais dans le front).
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { handleAI } from '../../../shared/ai-core.ts'

const url = Deno.env.get('SUPABASE_URL')!
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
webpush.setVapidDetails(`mailto:${Deno.env.get('COACH_EMAIL') ?? 'coach@example.com'}`, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!)

Deno.serve(async (req) => {
  const task = new URL(req.url).searchParams.get('task')
  const db = createClient(url, service)
  const today = new Date().toISOString().slice(0, 10)

  if (task === 'reminders') {
    const hour = new Date().getUTCHours().toString().padStart(2, '0')
    const { data: profiles } = await db.from('profiles').select('id, reminder_time').eq('notifications', true).like('reminder_time', `${hour}:%`)
    let sent = 0
    for (const p of profiles ?? []) {
      const { data: s } = await db.from('sessions').select('id,title').eq('client_id', p.id).eq('planned_date', today).eq('status', 'prevue').limit(1)
      if (!s?.length) continue
      const { data: subs } = await db.from('push_subscriptions').select('*').eq('user_id', p.id)
      for (const sub of subs ?? []) {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify({ title: 'C\'est l\'heure de ta séance', body: s[0].title, url: `/session/${s[0].id}` }))
          sent++
        } catch { await db.from('push_subscriptions').delete().eq('id', sub.id) }
      }
    }
    return Response.json({ sent })
  }

  if (task === 'weekly') {
    const { data: programs } = await db.from('programs').select('id, client_id').eq('status', 'actif')
    let done = 0
    for (const p of programs ?? []) {
      const { data: weeks } = await db.from('program_weeks').select('id, n, phase').eq('program_id', p.id).lte('start_date', today).order('n', { ascending: false }).limit(1)
      const w = weeks?.[0]
      if (!w) continue
      const { data: sessions } = await db.from('sessions').select('status').eq('week_id', w.id)
      const planned = sessions?.filter((s) => s.status !== 'sautee').length ?? 0
      const faites = sessions?.filter((s) => s.status === 'faite').length ?? 0
      const out = await handleAI('weekly', { weekN: w.n, next: w.n + 1, stats: { planned, done: faites }, phase: w.phase }, Deno.env.get('ANTHROPIC_API_KEY'))
      if (out.status !== 200) continue
      const r = out.json as { summary: string; suggestions: { text: string; weekN: number; factor: number }[] }
      await db.from('analyses').upsert({ client_id: p.client_id, program_id: p.id, week_n: w.n, summary: r.summary, source: 'ia' }, { onConflict: 'program_id,week_n' })
      // Les suggestions restent « proposées » : elles ne s'appliquent jamais sans validation du client ou du coach.
      for (const s of r.suggestions) {
        await db.from('adaptations').insert({ client_id: p.client_id, program_id: p.id, kind: 'suggestion_ia', status: 'propose', text: s.text, payload: { type: 'scale_week', weekN: s.weekN, factor: s.factor } })
      }
      done++
    }
    return Response.json({ analysed: done })
  }
  return new Response('unknown task', { status: 400 })
})
