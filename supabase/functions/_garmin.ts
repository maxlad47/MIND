// Branchement Supabase des handlers Garmin (shared/garmin/handlers.ts). Utilise la clé service_role : jamais dans le front.
// La clé Garmin de chaque utilisateur est chiffrée (AES-GCM, secret GARMIN_KEY_SECRET) dans la table `integrations`, inaccessible à l'API publique.
import { createClient } from '@supabase/supabase-js'
import type { Deps, Integration } from '../../shared/garmin/handlers.ts'
import type { GarminLink, HealthDay, ImportedRun } from '../../shared/garmin/types.ts'

export function env(name: string): string {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`Secret manquant : ${name}`)
  return v
}

export const bearer = (req: Request): string | undefined => req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || undefined

interface Row { user_id: string; provider: string; key_enc: string; token_enc: string | null; token_exp: number | null; expires_at: string; last_sync: string | null; status: 'liee' | 'a_renouveler'; notified: string[] | null }
const fromRow = (r: Row): Integration => ({
  userId: r.user_id, provider: 'garmin_personal', keyEnc: r.key_enc, tokenEnc: r.token_enc ?? undefined, tokenExp: r.token_exp ?? undefined,
  expiresAt: r.expires_at, lastSync: r.last_sync ?? undefined, status: r.status, notified: r.notified ?? [],
})

export function makeDeps(): Deps {
  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
  const now = () => new Date().toISOString()
  return {
    async userFromJwt(jwt) {
      const { data } = await db.auth.getUser(jwt)
      if (!data.user) return null
      const { data: p } = await db.from('profiles').select('role').eq('id', data.user.id).single()
      return { id: data.user.id, role: p?.role === 'coach' ? 'coach' : 'client' }
    },
    async getIntegration(userId) {
      const { data } = await db.from('integrations').select('*').eq('user_id', userId).maybeSingle()
      return data ? fromRow(data as Row) : null
    },
    async saveIntegration(i) {
      const { error } = await db.from('integrations').upsert({
        user_id: i.userId, provider: i.provider, key_enc: i.keyEnc, token_enc: i.tokenEnc ?? null, token_exp: i.tokenExp ?? null,
        expires_at: i.expiresAt, last_sync: i.lastSync ?? null, status: i.status, notified: i.notified, updated_at: now(),
      })
      if (error) throw new Error('integrations: ' + error.message)
    },
    async deleteIntegration(userId) { await db.from('integrations').delete().eq('user_id', userId) },
    async listIntegrations() {
      const { data } = await db.from('integrations').select('*').eq('provider', 'garmin_personal').eq('status', 'liee')
      return ((data ?? []) as Row[]).map(fromRow)
    },
    async isAllowed(userId) {
      const { data } = await db.from('garmin_access').select('allowed').eq('user_id', userId).maybeSingle()
      return !!data?.allowed
    },
    async setAllowed(userId, allowed) { await db.from('garmin_access').upsert({ user_id: userId, allowed }) },
    async insertRunsIfMissing(runs: ImportedRun[]) {
      // ignoreDuplicates : une activité déjà rattachée par l'app n'est jamais écrasée
      const { error } = await db.from('records').upsert(runs.map((r) => ({ id: `ir:${r.id}`, client_id: r.clientId, kind: 'ir', data: r, updated_at: now() })), { onConflict: 'id', ignoreDuplicates: true })
      if (error) throw new Error('records: ' + error.message)
    },
    async existingRunIds(_clientId, ids) {
      if (!ids.length) return new Set()
      const { data } = await db.from('records').select('id').in('id', ids.map((i) => `ir:${i}`))
      return new Set((data ?? []).map((r: { id: string }) => r.id.slice(3)))
    },
    async upsertHealth(days: HealthDay[]) {
      if (!days.length) return
      const { error } = await db.from('records').upsert(days.map((h) => ({ id: `hd:${h.id}`, client_id: h.clientId, kind: 'hd', data: h, updated_at: now() })))
      if (error) throw new Error('records: ' + error.message)
    },
    async writeLink(l: GarminLink) {
      const { error } = await db.from('records').upsert({ id: `gl:${l.clientId}`, client_id: l.clientId, kind: 'gl', data: l, updated_at: now() })
      if (error) throw new Error('records: ' + error.message)
    },
    async coachIds() {
      const { data } = await db.from('profiles').select('id').eq('role', 'coach')
      return (data ?? []).map((p: { id: string }) => p.id)
    },
    async firstName(userId) {
      const { data } = await db.from('profiles').select('first_name').eq('id', userId).maybeSingle()
      return data?.first_name || 'Un client'
    },
    async notify(userId, n) {
      await db.from('inbox').upsert({ id: `n:${n.id}`, user_id: userId, data: { ...n, userId, at: now(), read: false } }, { onConflict: 'id', ignoreDuplicates: true })
    },
    secret: env('GARMIN_KEY_SECRET'),
    fetch: (url, init) => fetch(url, init),
    now: () => Date.now(),
  }
}
