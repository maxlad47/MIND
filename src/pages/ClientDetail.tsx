import { lazy, Suspense, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { allSessions } from '@/engine/adapt'
import { isLibre } from '@/engine/libre'
import { DIST_LABEL, referencesOf } from '@/engine/running'
import { SPLIT_LABEL } from '@/engine/strength'
import { MUSCLE_LABEL, ZONES } from '@/engine/types'
import { addDays, ageFrom, fmtTime, prettyDate, shortDate, todayISO } from '@/engine/utils'
import { acceptAdaptation, deleteClientLocal, linkOf, programOf, questionnaireOf, refuseAdaptation, setLinkLocal, setMaxHr, summarizeClient, switchToLibre, useDB } from '@/lib/store'
import { fmtAgo, GARMIN_PERSONAL, setGarminAllowed } from '@/lib/garmin'
import { REMOTE } from '@/lib/supabase'
import { deleteClientRemote } from '@/lib/remote'
import { maxHrOf, ReviewLine } from '@/ui/runs'
import { Toggle } from '@/ui/kit'
import { Button, Card, Chip, Cover, Group, Icon, Page, Row, Segmented, SectionTitle, Sheet, toast } from '@/ui/kit'
import { FreeSessionsView } from '@/ui/free'
import { statusLabel } from '@/ui/parts'
import { ProgramView } from './ProgramPage'
const ProgressView = lazy(() => import('./Progress').then((m) => ({ default: m.ProgressView })))
const RpeChart = lazy(() => import('@/ui/runcharts').then((m) => ({ default: m.RpeChart })))
const HealthBars = lazy(() => import('@/ui/runcharts').then((m) => ({ default: m.HealthBars })))
import { STATUS } from './Coach'

const GOAL = { hypertrophie: 'Hypertrophie', force: 'Force', mixte: 'Mixte (powerbuilding)' }
const LEVEL = { debutant: 'Débutant', intermediaire: 'Intermédiaire', avance: 'Avancé' }

export default function ClientDetail() {
  const { id = '' } = useParams()
  const db = useDB()
  const nav = useNavigate()
  const [tab, setTab] = useState<'programme' | 'seances' | 'progres' | 'profil'>('programme')
  const [switching, setSwitching] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [hr, setHr] = useState('')
  const profile = db.profiles.find((p) => p.id === id)
  if (!profile) return <Page title="Client" back="/coach" tabbed={false}><p className="text-muted">Client introuvable. Retourne à la liste pour en choisir un autre.</p></Page>
  const sum = summarizeClient(db, profile)
  const program = programOf(db, id)
  const q = questionnaireOf(db, id)
  const pending = db.adaptations.filter((a) => a.clientId === id && a.status === 'propose')
  const history = allSessions(program ?? ({ weeks: [] } as never)).filter((s) => s.status !== 'prevue' && s.date <= new Date().toISOString().slice(0, 10)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30)
  const edits = db.edits.filter((e) => e.clientId === id).slice(0, 15)
  const checkins = db.checkins.filter((c) => c.clientId === id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
  const st = STATUS[sum.status]
  const libre = isLibre(program)
  const link = linkOf(db, id)
  const mh = maxHrOf(db, id)
  // effort perçu des dernières semaines + 7 derniers jours de santé
  const rpePoints = program ? allSessions(program).filter((s) => s.runLog?.rpe && s.date >= addDays(todayISO(), -56)).sort((a, b) => a.date.localeCompare(b.date)).map((s) => ({ date: s.date, rpe: s.runLog!.rpe! })) : []
  const week = db.health.filter((h) => h.clientId === id && h.date > addDays(todayISO(), -7) && h.date <= todayISO()).sort((a, b) => a.date.localeCompare(b.date))
  const toggleAllowed = async (on: boolean) => {
    if (REMOTE) { const r = await setGarminAllowed(id, on); toast(r.ok ? (on ? 'Liaison Garmin autorisée' : 'Liaison Garmin retirée') : r.message ?? 'Impossible de modifier') }
    else { setLinkLocal(id, { allowed: on }); toast(on ? 'Liaison Garmin autorisée' : 'Liaison Garmin retirée') }
  }

  return (
    <Page title={profile.firstName} back="/coach" tabbed={false} heroHeight={230}
      hero={
        <Cover seed={profile.id} sports={program ? (program.type === 'mixte' ? ['muscu', 'course'] : [program.type === 'course' ? 'course' : 'muscu']) : ['muscu']} className="h-full">
          <div className="absolute inset-0 flex flex-col justify-end p-5 text-white" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 56px)' }}>
            <div className="flex items-end gap-4">
              <div className="w-[72px] h-[72px] rounded-full glass-light border border-white/30 flex items-center justify-center text-[34px] font-extrabold shrink-0">{profile.firstName[0]}</div>
              <div className="min-w-0 pb-0.5">
                <div className="t-display text-[34px] leading-[1.05] font-extrabold tracking-[-0.025em]" style={{ textShadow: '0 2px 14px rgba(0,0,0,.3)' }}>{profile.firstName}</div>
                <div className="text-[15px] font-medium opacity-90 mt-0.5">{libre ? (program?.type === 'mixte' ? 'Muscu libre + course MIND' : 'Mode libre') : program ? `${program.type === 'mixte' ? 'Muscu + course' : program.type === 'course' ? 'Course' : 'Musculation'}` : 'Sans programme'} · {sum.weekDone}/{sum.weekPlanned} cette semaine</div>
              </div>
            </div>
            <div className="absolute top-[calc(env(safe-area-inset-top)+54px)] right-4"><span className="inline-flex items-center gap-1.5">{libre && <span className="inline-flex items-center rounded-full px-3 h-8 text-[13px] font-bold text-white glass-dark border border-white/20">Libre</span>}<span className="inline-flex items-center rounded-full px-3 h-8 text-[13px] font-bold text-white" style={{ background: st.color }}>{st.label}</span></span></div>
          </div>
        </Cover>
      }>
      {pending.map((a) => (
        <Card key={a.id} className="p-4 mb-3" style={{ background: 'color-mix(in srgb, var(--accent) 12%, var(--surface))' }}>
          <div className="text-[12px] uppercase tracking-wide text-muted font-semibold">Suggestion en attente</div>
          <div className="text-[15px] font-semibold mt-0.5">{a.text}</div>
          <div className="flex gap-2 mt-3"><Button small onClick={() => { acceptAdaptation(a.id); toast('Ajustement appliqué') }}>Accepter</Button><Button small variant="secondary" onClick={() => refuseAdaptation(a.id)}>Refuser</Button></div>
        </Card>
      ))}
      {checkins.filter((c) => c.pain).slice(0, 1).map((c) => (
        <Card key={c.id} className="p-4 mb-3" style={{ background: 'color-mix(in srgb, #FF453A 12%, var(--surface))' }}>
          <div className="flex gap-3"><span style={{ color: '#FF453A' }}><Icon name="alert" /></span><div><div className="font-semibold">Douleur signalée ({ZONES.find((z) => z.id === c.painZone)?.label ?? 'zone non précisée'})</div><div className="text-[13px] text-muted">{prettyDate(c.date)} · les exercices de cette zone ont été remplacés</div></div></div>
        </Card>
      ))}

      <div className="mb-4"><Segmented value={tab} onChange={setTab} options={[{ value: 'programme', label: libre ? 'Modèles' : 'Programme' }, { value: 'seances', label: 'Séances' }, { value: 'progres', label: 'Progrès' }, { value: 'profil', label: 'Profil' }]} /></div>

      {tab === 'programme' && (libre ? (<>
        <FreeSessionsView clientId={id} />
        <SectionTitle>Agenda</SectionTitle>
        <ProgramView clientId={id} canEdit />
      </>) : <ProgramView clientId={id} canEdit />)}
      {tab === 'progres' && <Suspense fallback={<div className="skeleton h-48 rounded-2xl" />}><ProgressView clientId={id} /></Suspense>}

      {tab === 'seances' && rpePoints.length >= 2 && (
        <Card className="p-4 mb-3"><div className="font-bold text-[17px] mb-1">Effort perçu</div><div className="text-[13px] text-muted mb-2">Sorties de course des 8 dernières semaines</div>
          <Suspense fallback={<div className="skeleton h-36 rounded-2xl" />}><RpeChart points={rpePoints} /></Suspense></Card>
      )}
      {tab === 'seances' && week.length > 0 && (
        <Card className="p-4 mb-3" onClick={() => nav(`/recovery/${id}`)}><div className="flex items-center justify-between mb-2"><div className="font-bold text-[17px]">Pas et sommeil · 7 jours</div><span className="flex items-center gap-0.5 text-[14px] font-semibold" style={{ color: 'var(--accent)' }}>Tout voir<Icon name="chevron" size={16} /></span></div>
          <Suspense fallback={<div className="skeleton h-40 rounded-2xl" />}><HealthBars days={week} /></Suspense></Card>
      )}
      {tab === 'seances' && (
        history.length === 0 ? <p className="text-muted">Aucune séance réalisée pour le moment.</p> : (
          <div className="flex flex-col gap-2">
            {history.map((s) => (
              <Card key={s.id} onClick={() => nav(`/session/${s.id}`)} className="p-3.5 flex items-center gap-3">
                <div className="flex-1 min-w-0"><div className="font-bold">{s.title}</div><div className="text-[13px] text-muted capitalize">{prettyDate(s.date)}{s.feeling && !s.runLog?.rpe ? ` · ressenti ${s.feeling}/10` : ''}</div>{s.runLog?.respected && <div className="mt-1.5"><ReviewLine session={s} /></div>}</div>
                <Chip color={s.status === 'faite' ? '#30D158' : '#FF453A'}>{statusLabel[s.status]}</Chip>
                <Icon name="chat" size={18} color="var(--muted)" />
              </Card>
            ))}
          </div>
        )
      )}

      {tab === 'profil' && q && (<>
        <Group header="Profil">
          <Row><span className="flex-1 text-muted">Âge</span><span className="font-semibold">{q.birthDate ? `${ageFrom(q.birthDate)} ans` : '—'} · {q.sex}</span></Row>
          <Row><span className="flex-1 text-muted">Poids / taille</span><span className="font-semibold">{q.weightKg} kg · {q.heightCm} cm</span></Row>
          <Row><span className="flex-1 text-muted">Blessures</span><span className="font-semibold text-right">{q.injuries.length ? q.injuries.map((z) => ZONES.find((x) => x.id === z)?.label).join(', ') : 'Aucune'}</span></Row>
          {q.injuryNote && <Row><span className="text-[14px]">{q.injuryNote}</span></Row>}
          <Row><span className="flex-1 text-muted">Disponibilité</span><span className="font-semibold">{q.availableDays.length} jours · {q.maxMinutes} min max</span></Row>
        </Group>
        {!libre && q.programType !== 'course' && (
          <Group header="Musculation">
            <Row><span className="flex-1 text-muted">Objectif</span><span className="font-semibold">{GOAL[q.strength.goal]}</span></Row>
            <Row><span className="flex-1 text-muted">Niveau</span><span className="font-semibold">{LEVEL[q.strength.level]}</span></Row>
            {q.excludedMuscles?.length ? <Row><span className="flex-1 text-muted">Muscles exclus</span><span className="font-semibold text-right">{q.excludedMuscles.map((m) => MUSCLE_LABEL[m]).join(', ')}</span></Row> : null}
            <Row><span className="flex-1 text-muted">Séances / semaine</span><span className="font-semibold">{q.muscuSessions}{program?.split ? ` · ${SPLIT_LABEL[program.split]}` : ''}</span></Row>
            {(['squat', 'bench', 'deadlift', 'press'] as const).map((k) => q.strength.lifts[k] && (
              <Row key={k}><span className="flex-1 text-muted">{{ squat: 'Squat', bench: 'Développé couché', deadlift: 'Soulevé de terre', press: 'Développé militaire' }[k]}</span><span className="font-semibold">{q.strength.lifts[k]!.kg} kg × {q.strength.lifts[k]!.reps}</span></Row>
            ))}
          </Group>
        )}
        {(!libre || program?.type === 'mixte') && q.programType !== 'muscu' && (
          <Group header="Course">
            <Row><span className="flex-1 text-muted">Course</span><span className="font-semibold">{DIST_LABEL[q.run.distance]} · {prettyDate(q.run.raceDate)}</span></Row>
            <Row><span className="flex-1 text-muted">Objectif</span><span className="font-semibold">{q.run.objective === 'chrono' && q.run.targetSeconds ? fmtTime(q.run.targetSeconds) : 'Finir'}</span></Row>
            <Row><span className="flex-1 text-muted">Volume actuel</span><span className="font-semibold">{q.run.weeklyKm} km/sem · sortie longue {q.run.longestKm} km</span></Row>
            {q.run.peakKm ? <Row><span className="flex-1 text-muted">Pic visé</span><span className="font-semibold">{q.run.peakKm} km/sem · {q.runSessions} séances max</span></Row> : null}
            {referencesOf(q.run).map((r) => <Row key={r.distance}><span className="flex-1 text-muted">Chrono {{ '5k': '5 km', '10k': '10 km', semi: 'semi', marathon: 'marathon' }[r.distance]}</span><span className="font-semibold">{fmtTime(r.seconds)}</span></Row>)}
            {program?.paces && <Row><span className="flex-1 text-muted">VMA</span><span className="font-semibold">{program.paces.vma.toFixed(1).replace('.', ',')} km/h</span></Row>}
          </Group>
        )}
        {(GARMIN_PERSONAL || mh) && (
          <Group header="Montre Garmin" footer={`FC max utilisée pour les zones : ${mh.value} bpm${mh.estimated ? ' (estimation)' : ''}.`}>
            {GARMIN_PERSONAL && <Row><div className="flex-1"><div className="font-semibold">Autoriser la liaison Garmin par clé personnelle</div><div className="text-[13px] text-muted">{link?.state === 'liee' ? `Liée · expire le ${link.expiresAt ? link.expiresAt.split('-').reverse().join('/') : '—'} · synchro ${fmtAgo(link.lastSyncAt)}` : link?.state === 'a_renouveler' ? 'Clé à renouveler : la synchro est arrêtée' : link?.allowed ? 'Autorisée, pas encore liée' : 'Désactivée'}</div></div>
              <Toggle checked={!!link?.allowed} label="Autoriser la liaison Garmin par clé personnelle" onChange={() => void toggleAllowed(!link?.allowed)} /></Row>}
            <Row><span className="flex-1 font-semibold">FC max</span>
              <input inputMode="numeric" aria-label="FC max en battements par minute" placeholder={String(mh.value)} value={hr} onChange={(e) => setHr(e.target.value.replace(/\D/g, '').slice(0, 3))}
                onBlur={() => { if (!hr) return; const n = Number(hr); if (n >= 120 && n <= 230) { setMaxHr(id, n); toast('FC max enregistrée') } setHr('') }} className="bg-surface2 rounded-[10px] h-11 w-[72px] text-center outline-none font-semibold num" /></Row>
          </Group>
        )}
        {libre && <Group header="Mode libre"><Row><span className="flex-1 text-muted">Suggestions de charge</span><span className="font-semibold">{program?.libre?.suggestLoads ? 'Activées' : 'Désactivées'}</span></Row></Group>}
        <div className="mb-3"><Button full variant="secondary" onClick={() => nav(`/onboarding?edit=1&client=${id}`)}>{libre ? 'Modifier le formulaire' : 'Modifier le formulaire et régénérer'}</Button></div>
        {program && (
          <div className="mb-5">
            {libre
              ? <Button full variant="tinted" onClick={() => nav(`/onboarding?edit=1&switch=genere&client=${id}`)}>Passer en programme MIND</Button>
              : program.type !== 'course' && <Button full variant="tinted" color="var(--muscu)" onClick={() => setSwitching(true)}>Passer en mode libre</Button>}
          </div>
        )}
        {edits.length > 0 && (<>
          <SectionTitle>Historique des modifications</SectionTitle>
          <Group>{edits.map((e) => (
            <Row key={e.id}><div className="flex-1"><div className="text-[14.5px]">{e.text}</div><div className="text-[12px] text-muted">{e.byName} ({e.by === 'coach' ? 'coach' : 'client'}) · {shortDate(e.at.slice(0, 10))}</div></div></Row>
          ))}</Group>
        </>)}
        <div className="text-[12px] text-muted mb-6">{Object.keys(MUSCLE_LABEL).length} groupes musculaires suivis.</div>
      </>)}
      {tab === 'profil' && !q && <p className="text-muted mb-6">{profile.firstName} n'a pas encore rempli son formulaire.</p>}
      {tab === 'profil' && profile.role === 'client' && (
        <div className="mb-8"><Button full variant="danger" onClick={() => setDeleting(true)}><Icon name="trash" size={19} /> Supprimer le profil</Button></div>
      )}
      <Sheet open={deleting} onClose={() => { if (!busy) setDeleting(false) }} title={`Supprimer ${profile.firstName} ?`}>
        <div className="flex flex-col gap-3">
          <p className="text-[14.5px] text-muted leading-snug">Son compte ({profile.email}) et toutes ses données sont effacés définitivement : formulaire, programme, séances, charges, commentaires, sorties et données Garmin. Impossible de revenir en arrière.</p>
          <Button full variant="danger" disabled={busy} onClick={async () => {
            setBusy(true)
            const r = REMOTE ? await deleteClientRemote(id) : { ok: deleteClientLocal(id), error: 'Suppression impossible.' }
            setBusy(false)
            if (!r.ok) { toast(r.error ?? 'Suppression impossible.'); return }
            setDeleting(false)
            toast(`Profil de ${profile.firstName} supprimé`)
            nav('/coach', { replace: true })
          }}>{busy ? 'Suppression…' : 'Supprimer définitivement'}</Button>
          <Button full variant="secondary" disabled={busy} onClick={() => setDeleting(false)}>Annuler</Button>
        </div>
      </Sheet>
      <Sheet open={switching} onClose={() => setSwitching(false)} title="Passer en mode libre">
        <div className="flex flex-col gap-3">
          <p className="text-[14.5px] text-muted leading-snug">{profile.firstName} suivra son propre programme de musculation (MIND n'y touche plus). Un plan de course MIND éventuel est conservé, et l'historique des séances et des charges aussi.</p>
          <Button full color="var(--muscu)" onClick={() => { switchToLibre(id, true); setSwitching(false); toast('Mode libre activé') }}>Partir de son programme actuel</Button>
          <Button full variant="secondary" onClick={() => { switchToLibre(id, false); setSwitching(false); toast('Mode libre activé') }}>Partir de zéro</Button>
        </div>
      </Sheet>
    </Page>
  )
}
