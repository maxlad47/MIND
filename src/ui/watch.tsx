// Profil → « Montre » : FC max, liaison Garmin par clé personnelle (aide pas à pas, expiration, synchro, délier), import .FIT.
import { useState } from 'react'
import { fmtKm } from '@/engine/utils'
import { DURATIONS, expiryFrom, fmtAgo, GARMIN_PERSONAL, GARMIN_STARTER, linkGarmin, startGarminOAuth, syncGarmin, unlinkGarmin } from '@/lib/garmin'
import { linkOf, setMaxHr, useDB } from '@/lib/store'
import { REMOTE } from '@/lib/supabase'
import { Button, Chip, Group, Icon, Row, RowIcon, Sheet, toast } from './kit'
import { FitImportSheet, maxHrOf } from './runs'

const frDate = (iso: string) => iso.split('-').reverse().join('/')
const STEPS: [string, string][] = [
  ['Ouvre Safari', 'Va sur connect.garmin.com et connecte-toi.'],
  ['Réglages → Personal API', 'Dans les réglages de ton compte Garmin Connect.'],
  ['Crée une clé et choisis « 1 an »', 'Tu n\'auras pas à recommencer avant un an. Une nouvelle clé remplace l\'ancienne.'],
  ['Copie la clé', 'Garmin ne l\'affiche qu\'une seule fois : copie-la tout de suite.'],
  ['Colle-la ici', 'MIND la garde chiffrée sur son serveur, jamais sur ton téléphone.'],
]

/** La clé n'existe que dans ce composant, le temps de la saisie : elle part une fois puis le champ est vidé. */
function LinkSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [key, setKey] = useState('')
  const [days, setDays] = useState(365)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async () => {
    setBusy(true); setError('')
    const r = await linkGarmin(key.trim(), days)
    setBusy(false)
    if (r.ok) { setKey(''); onClose(); toast('Montre liée. Tes sorties arrivent toutes seules.'); return }
    setError(r.message ?? 'La liaison a échoué.')
  }
  return (
    <Sheet open={open} onClose={() => { setKey(''); setError(''); onClose() }} title="Lier avec ma clé Garmin" tall>
      <div className="flex flex-col gap-3">
        {STEPS.map(([t, s], i) => (
          <div key={i} className="flex gap-3.5 bg-surface2 rounded-[18px] p-3.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0" style={{ background: 'var(--course)', color: 'var(--on-course)' }}>{i + 1}</div>
            <div><div className="font-semibold">{t}</div><div className="text-[14px] text-muted">{s}</div></div>
          </div>
        ))}
        <div>
          <div className="text-[13.5px] text-muted mb-1.5 font-medium">Durée choisie chez Garmin</div>
          <div className="flex flex-wrap gap-2">{DURATIONS.map((d) => <Chip key={d.days} active={days === d.days} color="var(--course)" onClick={() => setDays(d.days)}>{d.label}</Chip>)}</div>
          <div className="text-[13px] text-muted mt-1.5">Ta clé expirera le {frDate(expiryFrom(days))} : MIND te préviendra 10 jours avant.</div>
        </div>
        <input className="w-full h-12 rounded-[14px] bg-surface2 px-4 outline-none focus:ring-2 focus:ring-inset focus:ring-accent/60 font-mono text-[14px]" placeholder="Colle ta clé ici" aria-label="Clé Garmin personnelle"
          autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} data-1p-ignore value={key} onChange={(e) => setKey(e.target.value)} />
        {error && <p className="text-[14px]" style={{ color: '#FF453A' }} role="alert">{error}</p>}
        <Button full color="var(--course)" disabled={busy || key.trim().length < 8} onClick={() => void submit()}>{busy ? 'Vérification de la clé…' : 'Lier ma montre'}</Button>
      </div>
    </Sheet>
  )
}

export function WatchGroup({ userId, canEditMaxHr = true }: { userId: string; canEditMaxHr?: boolean }) {
  const db = useDB()
  const me = db.profiles.find((p) => p.id === userId)!
  const link = linkOf(db, userId)
  const mh = maxHrOf(db, userId)
  const [linking, setLinking] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const [fit, setFit] = useState(false)
  const [busy, setBusy] = useState(false)
  const [hr, setHr] = useState('')
  const allowed = me.role === 'coach' || !!link?.allowed
  const personal = REMOTE && GARMIN_PERSONAL
  const state = link?.state ?? 'non_liee'

  const sync = async () => {
    setBusy(true)
    const r = await syncGarmin('manual')
    setBusy(false)
    toast(r.ok ? (r.data.state === 'reessai' ? 'Garmin est lent : nouvel essai automatique dans 30 minutes.' : 'Synchronisation faite') : r.message ?? 'Synchronisation impossible')
  }

  return (
    <>
      <Group header="Montre" footer={`FC max utilisée pour les zones cardio : ${mh.value} bpm${mh.estimated ? ' (estimation : 220 − âge)' : mh.source === 'activites' ? ' (la plus haute vue sur 6 mois)' : ''}.`}>
        {canEditMaxHr && (
          <Row><RowIcon name="heart" color="#FF453A" /><div className="flex-1"><div className="font-semibold">FC max</div><div className="text-[13px] text-muted">Laisse vide pour la déduire de tes sorties</div></div>
            <input inputMode="numeric" aria-label="FC max en battements par minute" placeholder={String(mh.value)} value={hr} onChange={(e) => setHr(e.target.value.replace(/\D/g, '').slice(0, 3))}
              onBlur={() => { if (hr === '') return; const n = Number(hr); if (n >= 120 && n <= 230) { setMaxHr(userId, n); toast('FC max enregistrée') } else toast('FC max : entre 120 et 230'); setHr('') }}
              className="bg-surface2 rounded-[10px] h-11 w-[72px] text-center outline-none font-semibold num" /></Row>
        )}
        {personal && state === 'liee' && (<>
          <Row><RowIcon name="check" color="#30D158" /><div className="flex-1 min-w-0"><div className="font-semibold"><span style={{ color: '#30D158' }}>●</span> Garmin liée</div>
            <div className="text-[13px] text-muted">expire le {link?.expiresAt ? frDate(link.expiresAt) : '—'} · dernière synchro {fmtAgo(link?.lastSyncAt)}</div>{link?.message && <div className="text-[12.5px] mt-0.5" style={{ color: '#FF9F0A' }}>{link.message}</div>}</div></Row>
          <Row><Button small variant="tinted" color="var(--course)" disabled={busy} onClick={() => void sync()}><Icon name="refresh" size={16} /> {busy ? 'Synchro…' : 'Synchroniser'}</Button><Button small variant="danger" onClick={() => setUnlinking(true)}>Délier</Button></Row>
        </>)}
        {personal && state === 'a_renouveler' && (
          <Row onClick={() => setLinking(true)}><RowIcon name="alert" color="#FF9F0A" /><div className="flex-1"><div className="font-semibold" style={{ color: '#FF9F0A' }}>Clé Garmin à renouveler</div><div className="text-[13px] text-muted">{link?.message ?? 'La synchro est arrêtée.'} Crée une nouvelle clé et colle-la ici.</div></div><Icon name="chevron" size={18} color="var(--faint)" /></Row>
        )}
        {personal && state !== 'liee' && state !== 'a_renouveler' && (allowed
          ? <Row onClick={() => setLinking(true)}><RowIcon name="refresh" color="var(--course)" /><div className="flex-1"><div className="font-semibold">Lier avec ma clé Garmin personnelle</div><div className="text-[13px] text-muted">Tes sorties arrivent toutes seules</div></div><Icon name="chevron" size={18} color="var(--faint)" /></Row>
          : <Row><RowIcon name="info" color="#8E8E93" /><div className="flex-1 text-[14px] text-muted">La liaison Garmin automatique n'est pas activée pour ton compte : demande à ton coach.</div></Row>)}
        {GARMIN_STARTER && <Row onClick={async () => { const r = await startGarminOAuth(); if (!r.ok) toast(r.message ?? 'Liaison impossible') }}><RowIcon name="refresh" color="#0A84FF" /><div className="flex-1 font-semibold">Lier ma montre Garmin</div><Icon name="chevron" size={18} color="var(--faint)" /></Row>}
        <Row onClick={() => setFit(true)}><RowIcon name="share" color="var(--course)" /><div className="flex-1"><div className="font-semibold">Importer une sortie (.FIT)</div><div className="text-[13px] text-muted">Depuis Garmin Connect, sans liaison</div></div><Icon name="chevron" size={18} color="var(--faint)" /></Row>
      </Group>
      <LinkSheet open={linking} onClose={() => setLinking(false)} />
      <FitImportSheet open={fit} onClose={() => setFit(false)} clientId={userId} onDone={() => toast('Sortie importée')} />
      <Sheet open={unlinking} onClose={() => setUnlinking(false)} title="Délier ma montre">
        <div className="flex flex-col gap-3">
          <p className="text-[14.5px] text-muted leading-snug">MIND supprime ta clé de son serveur et ne synchronise plus. Tes sorties déjà importées restent. Pense à supprimer aussi la clé dans Garmin Connect (Réglages → Personal API).</p>
          <Button full variant="danger" onClick={async () => { const r = await unlinkGarmin(); setUnlinking(false); toast(r.ok ? 'Montre déliée' : r.message ?? 'Impossible de délier') }}>Délier</Button>
          <Button full variant="secondary" onClick={() => setUnlinking(false)}>Annuler</Button>
        </div>
      </Sheet>
    </>
  )
}
void fmtKm
