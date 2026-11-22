import { lazy, Suspense, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { allSessions } from '@/engine/adapt'
import { DIST_LABEL, referencesOf } from '@/engine/running'
import { SPLIT_LABEL } from '@/engine/strength'
import { MUSCLE_LABEL, ZONES } from '@/engine/types'
import { ageFrom, fmtTime, prettyDate, shortDate } from '@/engine/utils'
import { acceptAdaptation, programOf, questionnaireOf, refuseAdaptation, summarizeClient, useDB } from '@/lib/store'
import { Button, Card, Chip, Cover, Group, Icon, Page, Row, Segmented, SectionTitle, toast } from '@/ui/kit'
import { statusLabel } from '@/ui/parts'
import { ProgramView } from './ProgramPage'
const ProgressView = lazy(() => import('./Progress').then((m) => ({ default: m.ProgressView })))
import { STATUS } from './Coach'

const GOAL = { hypertrophie: 'Hypertrophie', force: 'Force', mixte: 'Mixte (powerbuilding)' }
const LEVEL = { debutant: 'Débutant', intermediaire: 'Intermédiaire', avance: 'Avancé' }

export default function ClientDetail() {
  const { id = '' } = useParams()
  const db = useDB()
  const nav = useNavigate()
  const [tab, setTab] = useState<'programme' | 'seances' | 'progres' | 'profil'>('programme')
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

  return (
    <Page title={profile.firstName} back="/coach" tabbed={false} heroHeight={230}
      hero={
        <Cover seed={profile.id} sports={program ? (program.type === 'mixte' ? ['muscu', 'course'] : [program.type === 'course' ? 'course' : 'muscu']) : ['muscu']} className="h-full">
          <div className="absolute inset-0 flex flex-col justify-end p-5 text-white" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 56px)' }}>
            <div className="flex items-end gap-4">
              <div className="w-[72px] h-[72px] rounded-full glass-light border border-white/30 flex items-center justify-center text-[34px] font-extrabold shrink-0">{profile.firstName[0]}</div>
              <div className="min-w-0 pb-0.5">
                <div className="t-display text-[34px] leading-[1.05] font-extrabold tracking-[-0.025em]" style={{ textShadow: '0 2px 14px rgba(0,0,0,.3)' }}>{profile.firstName}</div>
                <div className="text-[15px] font-medium opacity-90 mt-0.5">{program ? `${program.type === 'mixte' ? 'Muscu + course' : program.type === 'course' ? 'Course' : 'Musculation'}` : 'Sans programme'} · {sum.weekDone}/{sum.weekPlanned} cette semaine</div>
              </div>
            </div>
            <div className="absolute top-[calc(env(safe-area-inset-top)+54px)] right-4"><span className="inline-flex items-center rounded-full px-3 h-8 text-[13px] font-bold text-white" style={{ background: st.color }}>{st.label}</span></div>
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

      <div className="mb-4"><Segmented value={tab} onChange={setTab} options={[{ value: 'programme', label: 'Programme' }, { value: 'seances', label: 'Séances' }, { value: 'progres', label: 'Progrès' }, { value: 'profil', label: 'Profil' }]} /></div>

      {tab === 'programme' && <ProgramView clientId={id} canEdit />}
      {tab === 'progres' && <Suspense fallback={<div className="skeleton h-48 rounded-2xl" />}><ProgressView clientId={id} /></Suspense>}

      {tab === 'seances' && (
        history.length === 0 ? <p className="text-muted">Aucune séance réalisée pour le moment.</p> : (
          <div className="flex flex-col gap-2">
            {history.map((s) => (
              <Card key={s.id} onClick={() => nav(`/session/${s.id}`)} className="p-3.5 flex items-center gap-3">
                <div className="flex-1"><div className="font-bold">{s.title}</div><div className="text-[13px] text-muted capitalize">{prettyDate(s.date)}{s.feeling ? ` · ressenti ${s.feeling}/10` : ''}</div></div>
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
        {q.programType !== 'course' && (
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
        {q.programType !== 'muscu' && (
          <Group header="Course">
            <Row><span className="flex-1 text-muted">Course</span><span className="font-semibold">{DIST_LABEL[q.run.distance]} · {prettyDate(q.run.raceDate)}</span></Row>
            <Row><span className="flex-1 text-muted">Objectif</span><span className="font-semibold">{q.run.objective === 'chrono' && q.run.targetSeconds ? fmtTime(q.run.targetSeconds) : 'Finir'}</span></Row>
            <Row><span className="flex-1 text-muted">Volume actuel</span><span className="font-semibold">{q.run.weeklyKm} km/sem · sortie longue {q.run.longestKm} km</span></Row>
            {referencesOf(q.run).map((r) => <Row key={r.distance}><span className="flex-1 text-muted">Chrono {{ '5k': '5 km', '10k': '10 km', semi: 'semi', marathon: 'marathon' }[r.distance]}</span><span className="font-semibold">{fmtTime(r.seconds)}</span></Row>)}
            {program?.paces && <Row><span className="flex-1 text-muted">VMA</span><span className="font-semibold">{program.paces.vma.toFixed(1).replace('.', ',')} km/h</span></Row>}
          </Group>
        )}
        <div className="mb-5"><Button full variant="secondary" onClick={() => nav(`/onboarding?edit=1&client=${id}`)}>Modifier le formulaire et régénérer</Button></div>
        {edits.length > 0 && (<>
          <SectionTitle>Historique des modifications</SectionTitle>
          <Group>{edits.map((e) => (
            <Row key={e.id}><div className="flex-1"><div className="text-[14.5px]">{e.text}</div><div className="text-[12px] text-muted">{e.byName} ({e.by === 'coach' ? 'coach' : 'client'}) · {shortDate(e.at.slice(0, 10))}</div></div></Row>
          ))}</Group>
        </>)}
        <div className="text-[12px] text-muted">{Object.keys(MUSCLE_LABEL).length} groupes musculaires suivis.</div>
      </>)}
    </Page>
  )
}
