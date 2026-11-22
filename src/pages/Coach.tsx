import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clientsOf, currentUser, summarizeClient, useDB, type ClientStatus, type ClientSummary } from '@/lib/store'
import { prettyDate, shortDate } from '@/engine/utils'
import { motion } from 'framer-motion'
import { Card, Chip, Cover, EmptyState, Icon, Page, spring } from '@/ui/kit'
import { BellButton, NotificationsSheet } from '@/ui/parts'

export const STATUS: Record<ClientStatus, { label: string; color: string }> = {
  actif: { label: 'Actif', color: '#30D158' },
  en_retard: { label: 'En retard', color: '#FF9F0A' },
  decroche: { label: 'Décroche', color: '#FF453A' },
  nouveau: { label: 'Sans programme', color: '#8E8E93' },
}

function ClientCard({ c, onClick, i = 0 }: { c: ClientSummary; onClick: () => void; i?: number }) {
  const sports: ('muscu' | 'course')[] = c.program ? (c.program.type === 'mixte' ? ['muscu', 'course'] : [c.program.type === 'course' ? 'course' : 'muscu']) : ['muscu']
  const st = STATUS[c.status]
  const pct = c.weekPlanned ? Math.round((100 * c.weekDone) / c.weekPlanned) : 0
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: Math.min(i, 6) * 0.05 }}>
      <Card onClick={onClick} className="p-3 flex items-center gap-3.5">
        <Cover seed={c.profile.id} sports={sports} className="rounded-[20px] shrink-0" style={{ width: 66, height: 66, boxShadow: 'var(--shadow-cover)' }}>
          <div className="absolute inset-0 flex items-center justify-center text-white text-[28px] font-extrabold" style={{ textShadow: '0 2px 10px rgba(0,0,0,.3)' }}>{c.profile.firstName[0]}</div>
        </Cover>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2"><span className="text-[18px] font-extrabold tracking-tight truncate">{c.profile.firstName}</span><Chip color={st.color}>{st.label}</Chip></div>
          <div className="text-[13px] text-muted mt-0.5 truncate">{c.lastDone ? `Dernière séance : ${shortDate(c.lastDone)}` : 'Aucune séance réalisée pour le moment'}</div>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-1.5 rounded-full bg-surface2 overflow-hidden"><motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ ...spring, delay: 0.15 }} style={{ background: st.color }} /></div>
            <span className="text-[12px] text-muted num whitespace-nowrap">{c.weekDone}/{c.weekPlanned} cette semaine</span>
          </div>
        </div>
        {c.alerts.length > 0 && <div className="min-w-[24px] h-6 rounded-full bg-bad text-white text-[13px] font-bold flex items-center justify-center px-1.5">{c.alerts.length}</div>}
        <Icon name="chevron" size={18} color="var(--faint)" />
      </Card>
    </motion.div>
  )
}

export function ClientsPage() {
  const db = useDB()
  const nav = useNavigate()
  const me = currentUser(db)!
  const [bell, setBell] = useState(false)
  const list = clientsOf(db).filter((c) => c.id !== me.id).map((c) => summarizeClient(db, c))
    .sort((a, b) => b.alerts.length - a.alerts.length || a.profile.firstName.localeCompare(b.profile.firstName))
  const count = (s: ClientStatus) => list.filter((c) => c.status === s).length
  return (
    <Page title="Clients" subtitle={`${list.length} client${list.length > 1 ? 's' : ''} suivi${list.length > 1 ? 's' : ''}`} right={<BellButton userId={me.id} onClick={() => setBell(true)} />}>
      <div className="grid grid-cols-3 gap-2.5 mb-5">
        {(['actif', 'en_retard', 'decroche'] as ClientStatus[]).map((s) => (
          <Card key={s} className="p-3.5 relative overflow-hidden">
            <div className="text-[32px] leading-none font-extrabold num tracking-tight" style={{ color: STATUS[s].color }}>{count(s)}</div>
            <div className="text-[12.5px] text-muted font-semibold mt-2 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: STATUS[s].color }} />{STATUS[s].label}</div>
          </Card>
        ))}
      </div>
      {list.length === 0 ? <EmptyState icon="users" color="var(--muscu)" title="Aucun client pour l'instant" text="Dès qu'une personne crée un compte MIND, elle apparaît ici automatiquement, avec son programme et son suivi." /> : (
        <div className="flex flex-col gap-3">{list.map((c, i) => <ClientCard key={c.profile.id} i={i} c={c} onClick={() => nav(`/coach/client/${c.profile.id}`)} />)}</div>
      )}
      <NotificationsSheet open={bell} onClose={() => setBell(false)} userId={me.id} />
    </Page>
  )
}

const ALERT_ICON = { douleur: ['alert', '#FF453A'], suggestion: ['sparkle', 'var(--accent)'], decroche: ['clock', '#FF9F0A'], commentaire: ['chat', '#64D2FF'] } as const

export function AlertsPage() {
  const db = useDB()
  const nav = useNavigate()
  const me = currentUser(db)!
  const items = clientsOf(db).filter((c) => c.id !== me.id).flatMap((c) => summarizeClient(db, c).alerts.map((a) => ({ ...a, client: c })))
    .sort((a, b) => b.at.localeCompare(a.at))
  return (
    <Page title="Alertes" subtitle="Douleurs, suggestions à valider, clients qui décrochent">
      {items.length === 0 ? <EmptyState icon="check" color="#30D158" title="Tout est calme" text="Aucune douleur signalée, aucune suggestion en attente, personne ne décroche. Profites-en !" /> : (
        <div className="flex flex-col gap-2.5">
          {items.map((a, i) => {
            const [icon, color] = ALERT_ICON[a.kind]
            return (
              <Card key={i} onClick={() => nav(`/coach/client/${a.client.id}`)} className="p-3.5 flex gap-3 items-start">
                <div className="w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}><Icon name={icon} size={21} /></div>
                <div className="flex-1 min-w-0"><div className="font-bold text-[16px]">{a.client.firstName}</div><div className="text-[14.5px] leading-snug mt-0.5">{a.text}</div><div className="text-[12px] text-muted mt-1 cap-first">{prettyDate(a.at)}</div></div>
                <span className="self-center"><Icon name="chevron" size={18} color="var(--faint)" /></span>
              </Card>
            )
          })}
        </div>
      )}
    </Page>
  )
}
