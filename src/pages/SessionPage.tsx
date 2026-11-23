import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { findSession } from '@/engine/adapt'
import { conflictsOfWeek } from '@/engine/combine'
import { exerciseOf, isCustomId } from '@/engine/exercises'
import { diffSessionTemplate, isFreeRun, isLibre } from '@/engine/libre'
import { describeBlock, runKindLabel } from '@/engine/running'
import type { Program, RunBlock, Session, SessionExercise } from '@/engine/types'
import { fmtKm, fmtPace, fmtTime, mondayOf, parseTime, prettyDate, todayISO } from '@/engine/utils'
import {
  addComment, addCustomExercise, addExercise, applySessionToTemplate, currentUser, customExercisesOf, finishStrength, lastPerformance, logRun, logSet, moveSession, removeExercise, replaceExercise,
  skipSession, restoreSession, unlogSet, updateExercise, updateRun, useDB, type Recap,
} from '@/lib/store'
import { motion } from 'framer-motion'
import { Button, Card, Chip, Cover, DurationInput, Icon, NumberInput, Page, Ring, SectionTitle, Sheet, SportBadge, spring, toast } from '@/ui/kit'
import { coverSeed, ExercisePicker, sessionMeta, statusLabel } from '@/ui/parts'

const startKey = (id: string) => `mind.start.${id}`
function getStart(id: string): number | undefined {
  try { const v = sessionStorage.getItem(startKey(id)); return v ? Number(v) : undefined } catch { return undefined }
}
function markStart(id: string) {
  try { if (!sessionStorage.getItem(startKey(id))) sessionStorage.setItem(startKey(id), String(Date.now())) } catch { /* ok */ }
}

function SetRow({ n, ex, defaults, prev, done, locked, onValidate, onUndo }: {
  n: number; ex: SessionExercise; defaults: { kg: number; reps: number; rir: number }; prev?: { kg: number; reps: number }
  done?: { kg: number; reps: number; rir: number }; locked: boolean; onValidate: (v: { kg: number; reps: number; rir: number }) => void; onUndo: () => void
}) {
  const [kg, setKg] = useState(String(done?.kg ?? defaults.kg))
  const [reps, setReps] = useState(String(done?.reps ?? defaults.reps))
  const [rir, setRir] = useState(String(done?.rir ?? defaults.rir))
  useEffect(() => {
    if (!done) { setKg(String(defaults.kg)); setReps(String(defaults.reps)); setRir(String(defaults.rir)) }
  }, [defaults.kg, defaults.reps, defaults.rir, done])
  const num = (s: string) => Number(s.replace(',', '.')) || 0
  const cell = 'h-11 w-full rounded-[12px] text-center num font-bold text-[17px] outline-none focus:ring-2 focus:ring-inset focus:ring-accent/60 disabled:opacity-100'
  return (
    <div className="grid items-center gap-2 py-1.5" style={{ gridTemplateColumns: '24px 1fr 62px 52px 46px 44px' }}>
      <div className="text-[15px] font-bold text-center" style={{ color: done ? '#30D158' : 'var(--muted)' }}>{n}</div>
      <div className="text-[12.5px] text-muted leading-tight num">{prev ? `${fmtKm(prev.kg)} × ${prev.reps}` : '—'}</div>
      <input className={cell} style={{ background: done ? 'color-mix(in srgb, #30D158 16%, var(--surface2))' : 'var(--surface2)' }} inputMode="decimal" value={kg} disabled={locked} onChange={(e) => setKg(e.target.value)} aria-label="Poids" />
      <input className={cell} style={{ background: done ? 'color-mix(in srgb, #30D158 16%, var(--surface2))' : 'var(--surface2)' }} inputMode="numeric" value={reps} disabled={locked} onChange={(e) => setReps(e.target.value)} aria-label="Répétitions" />
      <input className={cell} style={{ background: done ? 'color-mix(in srgb, #30D158 16%, var(--surface2))' : 'var(--surface2)' }} inputMode="numeric" value={rir} disabled={locked} onChange={(e) => setRir(e.target.value)} aria-label="RIR" />
      <motion.button disabled={locked} aria-label={done ? 'Annuler la série' : 'Valider la série'} whileTap={{ scale: 0.88 }} transition={spring} className="w-11 h-11 rounded-full flex items-center justify-center"
        style={{ background: done ? '#30D158' : 'var(--surface2)', color: done ? '#fff' : 'var(--faint)', boxShadow: done ? '0 6px 16px -6px rgba(48,209,88,.7)' : undefined }}
        onClick={() => (done ? onUndo() : onValidate({ kg: num(kg), reps: Math.round(num(reps)), rir: Math.round(num(rir)) }))}>
        <Icon name="check" size={20} strokeWidth={3} />
      </motion.button>
    </div>
  )
}

function ExerciseCard({ program, session, e, locked }: { program: Program; session: Session; e: SessionExercise; locked: boolean }) {
  const db = useDB()
  const ex = exerciseOf(e.exerciseId)
  const libre = isLibre(program)
  const [pick, setPick] = useState(false)
  const [edit, setEdit] = useState(false)
  const last = lastPerformance(db, program.clientId, e.exerciseId, session.id)
  const prevSetOf = (n: number) => (last ? last.logs.find((l) => l.n === n) ?? last.logs[last.logs.length - 1] : undefined)

  return (
    <Card className="p-4">
      <div className="flex items-start gap-2">
        <Ring value={e.logs.length / Math.max(1, e.sets)} size={40} stroke={5} color={e.logs.length >= e.sets ? '#30D158' : 'var(--muscu)'}>
          {e.logs.length >= e.sets ? <span className="text-ok"><Icon name="check" size={16} strokeWidth={3.2} /></span> : <span className="text-[12px] font-extrabold num">{e.logs.length}/{e.sets}</span>}
        </Ring>
        <div className="flex-1 min-w-0 pl-1">
          <div className="text-[18px] font-extrabold leading-tight tracking-tight">{ex.name}</div>
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[13px] text-muted mt-0.5 num">
            <span className="font-semibold text-ink">{e.sets} × {e.repMin}–{e.repMax}</span>{!e.noRir && <span>RIR {e.rir}</span>}<span>repos {String(Math.round(e.restSec / 6) / 10).replace('.', ',')} min</span>{e.targetKg ? <span>{libre ? 'suggéré ' : ''}{fmtKm(e.targetKg)} kg</span> : null}
          </div>
        </div>
        {!locked && (<>
          <button className="tap hit w-10 h-10 rounded-full bg-surface2 flex items-center justify-center" aria-label="Remplacer" onClick={() => setPick(true)}><Icon name="swap" size={18} /></button>
          <button className="tap hit w-10 h-10 rounded-full bg-surface2 flex items-center justify-center" aria-label="Modifier" onClick={() => setEdit(true)}><Icon name="edit" size={17} /></button>
        </>)}
      </div>
      {!isCustomId(e.exerciseId) && <p className="text-[13px] text-muted mt-2 leading-snug">{ex.cue}</p>}
      <div className="grid text-[11px] font-semibold uppercase tracking-wide text-faint mt-3.5 px-0" style={{ gridTemplateColumns: '24px 1fr 62px 52px 46px 44px', gap: 8 }}>
        <span /> <span>Dernière</span><span className="text-center">kg</span><span className="text-center">reps</span><span className="text-center">RIR</span><span />
      </div>
      {Array.from({ length: e.sets }, (_, i) => i + 1).map((n) => {
        const done = e.logs.find((l) => l.n === n)
        const before = e.logs.filter((l) => l.n < n).slice(-1)[0]
        const p = prevSetOf(n)
        const defaults = {
          // mode libre : la charge suggérée (si activée) passe avant la dernière performance
          kg: before?.kg ?? (libre ? (e.targetKg ?? p?.kg) : (p?.kg ?? e.targetKg)) ?? 0,
          reps: before?.reps ?? p?.reps ?? e.repMin,
          rir: before?.rir ?? e.rir,
        }
        return <SetRow key={`${e.id}-${n}-${e.exerciseId}`} n={n} ex={e} defaults={defaults} prev={p} done={done} locked={locked}
          onValidate={(v) => { markStart(session.id); logSet(program.id, session.id, e.id, { n, ...v, at: new Date().toISOString() }) }}
          onUndo={() => unlogSet(program.id, session.id, e.id, n)} />
      })}

      {libre
        ? <ExercisePicker open={pick} onClose={() => setPick(false)} title="Remplacer l'exercice" injuries={[]} warn={program.q.injuries} customs={customExercisesOf(db, program.clientId)}
          onCreateCustom={(name, muscle) => addCustomExercise(program.id, name, muscle)} onPick={(id) => { replaceExercise(program.id, session.id, e.id, id); toast('Exercice remplacé') }} />
        : <ExercisePicker open={pick} onClose={() => setPick(false)} title="Remplacer l'exercice" replacing={e.exerciseId} injuries={program.q.injuries}
          onPick={(id) => { replaceExercise(program.id, session.id, e.id, id); toast('Exercice remplacé') }} />}
      <Sheet open={edit} onClose={() => setEdit(false)} title={ex.name}>
        <div className="flex flex-col gap-4">
          {([['Séries', 'sets', 1, 8, 1], ['Reps min', 'repMin', 1, 30, 1], ['Reps max', 'repMax', 1, 40, 1], ['RIR cible', 'rir', 0, 5, 1], ['Repos (s)', 'restSec', 30, 480, 15]] as const).filter(([, key]) => !(libre && key === 'rir')).map(([label, key, mn, mx, st]) => (
            <div key={key} className="flex items-center justify-between"><span className="font-semibold">{label}</span>
              <NumberInput value={e[key]} min={mn} max={mx} step={st} width={48} onChange={(v) => v !== undefined && updateExercise(program.id, session.id, e.id, { [key]: v })} /></div>
          ))}
          {!libre && <div className="flex items-center justify-between"><span className="font-semibold">Charge (kg)</span>
            <NumberInput value={e.targetKg} min={0} max={600} step={2.5} width={48} onChange={(v) => updateExercise(program.id, session.id, e.id, { targetKg: v })} /></div>}
          <Button full variant="danger" onClick={() => { removeExercise(program.id, session.id, e.id); setEdit(false) }}>Retirer l'exercice</Button>
        </div>
      </Sheet>
    </Card>
  )
}

function RunDetail({ s }: { s: Session }) {
  const r = s.run!
  const Step = ({ label, text, color }: { label: string; text: string; color: string }) => (
    <div className="flex gap-3">
      <div className="w-1 rounded-full shrink-0" style={{ background: color }} />
      <div><div className="t-over" style={{ color }}>{label}</div><p className="text-[15px] mt-1 leading-snug">{text}</p></div>
    </div>
  )
  return (
    <Card className="p-4">
      <div className="flex flex-col gap-5">
        <Step label="Échauffement" text={r.warmup} color="#FFD60A" />
        <div className="flex gap-3">
          <div className="w-1 rounded-full shrink-0" style={{ background: '#FF9F0A' }} />
          <div className="flex-1">
            <div className="t-over" style={{ color: '#FF9F0A' }}>Corps de séance</div>
            {r.blocks.map((b, i) => (
              <div key={i} className="mt-2"><div className="text-[20px] font-extrabold leading-snug tracking-tight">{b.label}</div><div className="text-[15px] text-muted num">{describeBlock(b)}</div></div>
            ))}
          </div>
        </div>
        <Step label="Retour au calme" text={r.cooldown} color="#64D2FF" />
      </div>
    </Card>
  )
}

function Comments({ program, session }: { program: Program; session: Session }) {
  const db = useDB()
  const [text, setText] = useState('')
  const list = db.comments.filter((c) => c.sessionId === session.id).sort((a, b) => a.at.localeCompare(b.at))
  const send = () => { if (!text.trim()) return; addComment(session.id, program.clientId, text.trim()); setText('') }
  return (
    <>
      <SectionTitle>Commentaires</SectionTitle>
      <div className="flex flex-col gap-2">
        {list.length === 0 && <p className="text-muted text-[14px] px-1">Pas encore de message. Écris à ton coach si tu as une question sur cette séance.</p>}
        {list.map((c) => (
          <div key={c.id} className={`flex ${c.authorRole === 'coach' ? '' : 'justify-end'}`}>
            <div className="max-w-[82%] rounded-[20px] px-4 py-2.5" style={{ background: c.authorRole === 'coach' ? 'var(--surface)' : 'var(--accent)', color: c.authorRole === 'coach' ? 'var(--text)' : '#fff', borderBottomLeftRadius: c.authorRole === 'coach' ? 6 : 20, borderBottomRightRadius: c.authorRole === 'coach' ? 20 : 6 }}>
              <div className="text-[12px] font-semibold opacity-70">{c.authorName}{c.authorRole === 'coach' ? ' · coach' : ''}</div>
              <div className="text-[15px]">{c.text}</div>
            </div>
          </div>
        ))}
        <div className="flex gap-2 mt-1">
          <input className="flex-1 h-11 rounded-full bg-surface px-4 outline-none focus:ring-2 focus:ring-inset focus:ring-accent/60" placeholder="Écrire un message…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
          <button className="tap w-11 h-11 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: 'var(--accent)' }} onClick={send} aria-label="Envoyer"><Icon name="chat" size={19} /></button>
        </div>
      </div>
    </>
  )
}

export default function SessionPage() {
  const { id } = useParams()
  const db = useDB()
  const nav = useNavigate()
  const me = currentUser(db)!
  const program = db.programs.find((p) => findSession(p, id ?? ''))
  const session = program ? findSession(program, id ?? '') : undefined
  const [pickAdd, setPickAdd] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [feeling, setFeeling] = useState(7)
  const [recap, setRecap] = useState<Recap | null>(null)
  const [runSheet, setRunSheet] = useState(false)
  const [editRun, setEditRun] = useState(false)
  const [moving, setMoving] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [km, setKm] = useState<number | undefined>(undefined)
  const [runSeconds, setRunSeconds] = useState<number | undefined>(undefined)
  const [runFeeling, setRunFeeling] = useState(5)
  const [runComment, setRunComment] = useState('')
  const [changesOpen, setChangesOpen] = useState(false)

  useEffect(() => { if (session?.run && km === undefined) setKm(session.run.totalKm || undefined) }, [session?.id])
  // mode libre : ce qui diffère entre la séance saisie et son modèle
  const template = program?.libre?.templates.find((t) => t.id === session?.templateId)
  const changes = useMemo(() => (session && template ? diffSessionTemplate(session, template) : []), [session, template])

  const allowed = !!program && (me.role === 'coach' || program.clientId === me.id)
  const conflicts = useMemo(() => {
    if (!program || !session || !newDate) return []
    const w = program.weeks.find((x) => x.startDate === mondayOf(newDate))
    if (!w) return []
    const after = w.sessions.map((x) => (x.id === session.id ? { ...x, date: newDate } : x))
    if (!after.some((x) => x.id === session.id)) after.push({ ...session, date: newDate })
    return conflictsOfWeek(after, w.startDate)
  }, [program, session, newDate])

  if (!program || !session || !allowed) {
    return <Page title="Séance" back tabbed={false}><p className="text-muted">Cette séance est introuvable.</p></Page>
  }

  const locked = session.status === 'faite'
  const isMuscu = session.sport === 'muscu'
  const total = (session.exercises ?? []).reduce((a, e) => a + e.sets, 0)
  const doneSets = (session.exercises ?? []).reduce((a, e) => a + e.logs.length, 0)
  const clientName = db.profiles.find((p) => p.id === program.clientId)?.firstName
  const libre = isLibre(program)
  const freeRun = isFreeRun(session)
  /** Fin de séance : si elle diffère de son modèle, on demande si on garde les changements. */
  const leave = () => { if (libre && changes.length > 0) setChangesOpen(true); else nav(-1) }

  const finish = () => {
    const startedAt = getStart(session.id)
    const minutes = Math.max(1, Math.round((Date.now() - (startedAt ?? Date.now() - session.estMinutes * 60000)) / 60000))
    const r = finishStrength(program.id, session.id, feeling, minutes)
    setFinishing(false)
    setRecap(r)
  }
  const runPace = km && runSeconds ? runSeconds / km : undefined
  const saveRun = () => {
    if (!km || !runSeconds) return
    const r = logRun(program.id, session.id, { km, seconds: runSeconds, feeling: runFeeling, comment: runComment })
    setRunSheet(false)
    toast('Sortie enregistrée')
    if (r.suggestion) setTimeout(() => toast('Une suggestion d\'allures t\'attend dans Aujourd\'hui'), 800)
  }

  return (
    <Page title={session.title} back tabbed={false} heroHeight={250}
      hero={
        <Cover seed={coverSeed(session)} sports={[session.sport]} kind={session.kind} className="h-full">
          <div className="absolute inset-0 flex flex-col justify-end p-5 text-white" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 56px)' }}>
            <div className="flex items-center justify-between gap-2 mb-auto">
              <SportBadge sports={[session.sport]} label={session.extra ? 'Séance en plus' : isMuscu ? 'Musculation' : runKindLabel(session.kind)} />
              <span className="rounded-full px-3 h-8 inline-flex items-center gap-1 text-[13px] font-bold" style={{ background: session.status === 'faite' ? '#30D158' : session.status === 'manquee' ? '#FF453A' : 'rgba(255,255,255,.92)', color: session.status === 'prevue' ? '#000' : '#fff' }}>
                {session.status === 'faite' && <Icon name="check" size={14} strokeWidth={3} />}{statusLabel[session.status]}
              </span>
            </div>
            <div className="t-over opacity-80 capitalize">{prettyDate(session.date)}{clientName && me.role === 'coach' ? ` · ${clientName}` : ''}</div>
            <div className="t-display text-[34px] leading-[1.04] font-extrabold tracking-[-0.025em] mt-1" style={{ textShadow: '0 2px 14px rgba(0,0,0,.3)' }}>{session.title}</div>
            <div className="text-[15px] font-medium opacity-95 mt-1.5">{sessionMeta(session)}{session.lighten ? ' · allégée' : ''}</div>
            {isMuscu && total > 0 && !locked && (
              <div className="mt-3 h-1.5 rounded-full bg-white/25 overflow-hidden"><motion.div className="h-full rounded-full bg-white" animate={{ width: `${(doneSets / total) * 100}%` }} transition={spring} /></div>
            )}
          </div>
        </Cover>
      }>
      {session.note && <Card className="p-3.5 mb-3 text-[14.5px] leading-snug flex gap-2.5"><span style={{ color: 'var(--accent)' }}><Icon name="sparkle" size={18} /></span><span>{session.note}</span></Card>}

      {isMuscu ? (
        <div className="flex flex-col gap-3">
          {(session.exercises ?? []).map((e) => <ExerciseCard key={e.id} program={program} session={session} e={e} locked={locked} />)}
          {!locked && <Button variant="tinted" color="var(--muscu)" full onClick={() => setPickAdd(true)}><Icon name="plus" size={18} strokeWidth={2.4} /> Ajouter un exercice</Button>}
          {!locked && session.status !== 'sautee' && (
            <div className="sticky z-20 -mx-4 px-4 pt-6 pb-1" style={{ bottom: 0, paddingBottom: 'calc(10px + env(safe-area-inset-bottom))', background: 'linear-gradient(to top, var(--bg) 62%, transparent)' }}>
              <Button full onClick={() => setFinishing(true)} disabled={doneSets === 0} color="var(--muscu)">Terminer la séance · {doneSets}/{total} séries</Button>
            </div>
          )}
          {locked && (
            <Card className="p-4"><div className="font-bold text-[17px] flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-ok text-white flex items-center justify-center"><Icon name="check" size={14} strokeWidth={3.2} /></span> Séance terminée</div>
              <div className="text-muted text-[14px] mt-1">{session.durationMin} min · ressenti {session.feeling}/10 · tonnage {Math.round((session.exercises ?? []).reduce((a, e) => a + e.logs.reduce((b, l) => b + l.kg * l.reps, 0), 0)).toLocaleString('fr-FR')} kg</div></Card>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {!freeRun && <RunDetail s={session} />}
          {session.runLog && (
            <Card className="p-4">
              <div className="font-bold text-[17px]">Ta sortie</div>
              <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                <div><div className="text-[22px] font-extrabold num">{fmtKm(session.runLog.km)}</div><div className="text-[12px] text-muted">km</div></div>
                <div><div className="text-[22px] font-extrabold num">{fmtTime(session.runLog.seconds)}</div><div className="text-[12px] text-muted">durée</div></div>
                <div><div className="text-[22px] font-extrabold num">{fmtPace(session.runLog.seconds / session.runLog.km)}</div><div className="text-[12px] text-muted">min/km</div></div>
              </div>
              <div className="text-[13px] text-muted mt-2">Ressenti {session.runLog.feeling}/10{session.runLog.comment ? ` · « ${session.runLog.comment} »` : ''}</div>
            </Card>
          )}
          {!locked && session.status !== 'sautee' && (
            <>
              <Button full onClick={() => setRunSheet(true)} color="#FF9F0A">Saisir ma sortie</Button>
              {!freeRun && <Button full variant="secondary" onClick={() => setEditRun(true)}><Icon name="edit" size={17} /> Modifier la séance</Button>}
            </>
          )}
        </div>
      )}

      {!locked && (
        <div className="flex gap-2 mt-4">
          {session.status === 'sautee'
            ? <Button full variant="secondary" onClick={() => restoreSession(program.id, session.id)}>Remettre au programme</Button>
            : (<>
              <Button full variant="secondary" onClick={() => { setNewDate(session.date); setMoving(true) }}>Déplacer</Button>
              <Button full variant="danger" onClick={() => { skipSession(program.id, session.id); toast('Séance sautée'); nav(-1) }}>Sauter</Button>
            </>)}
        </div>
      )}

      <Comments program={program} session={session} />

      {/* feuilles */}
      {libre
        ? <ExercisePicker open={pickAdd} onClose={() => setPickAdd(false)} title="Ajouter un exercice" injuries={[]} warn={program.q.injuries} customs={customExercisesOf(db, program.clientId)}
          onCreateCustom={(name, muscle) => addCustomExercise(program.id, name, muscle)} onPick={(eid) => { addExercise(program.id, session.id, eid); toast('Exercice ajouté') }} />
        : <ExercisePicker open={pickAdd} onClose={() => setPickAdd(false)} title="Ajouter un exercice" injuries={program.q.injuries} excluded={program.q.excludedMuscles} onPick={(eid) => { addExercise(program.id, session.id, eid); toast('Exercice ajouté') }} />}

      <Sheet open={finishing} onClose={() => setFinishing(false)} title="Ressenti de la séance">
        <p className="text-muted text-[14px] mb-3">1 = très facile, 10 = au bout de moi.</p>
        <div className="grid grid-cols-5 gap-2 mb-5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <button key={n} onClick={() => setFeeling(n)} className="tap h-12 rounded-[14px] font-bold text-[18px]" style={{ background: feeling === n ? 'var(--muscu)' : 'var(--surface2)', color: feeling === n ? '#fff' : 'var(--text)' }}>{n}</button>)}
        </div>
        <Button full onClick={finish}>Terminer</Button>
      </Sheet>

      <Sheet open={!!recap} onClose={() => { setRecap(null); leave() }} title="Bravo, séance terminée !">
        {recap && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-surface2 rounded-[16px] py-3.5"><div className="text-[24px] font-extrabold num">{Math.round(recap.tonnage).toLocaleString('fr-FR')}</div><div className="text-[12px] text-muted">kg soulevés</div></div>
              <div className="bg-surface2 rounded-[16px] py-3.5"><div className="text-[24px] font-extrabold num">{recap.minutes}</div><div className="text-[12px] text-muted">min</div></div>
              <div className="bg-surface2 rounded-[16px] py-3.5"><div className="text-[24px] font-extrabold num">{recap.sets}</div><div className="text-[12px] text-muted">séries</div></div>
            </div>
            {recap.prs.length > 0 && (
              <div className="rounded-xl p-3" style={{ background: 'color-mix(in srgb, #FF9F0A 16%, transparent)' }}>
                <div className="font-bold flex items-center gap-1.5" style={{ color: '#FF9F0A' }}><Icon name="trophy" size={18} /> {recap.prs.length > 1 ? 'Records battus' : 'Record battu'}</div>
                 {recap.prs.map((p) => <div key={p.exerciseId} className="text-[15px] mt-1">{exerciseOf(p.exerciseId).name} : {fmtKm(p.kg)} kg × {p.reps}</div>)}
              </div>
            )}
            <Button full onClick={() => { setRecap(null); leave() }}>Super</Button>
          </div>
        )}
      </Sheet>

      <Sheet open={changesOpen} onClose={() => { setChangesOpen(false); nav(-1) }} title={`Tu as changé ${changes.length} chose${changes.length > 1 ? 's' : ''}`}>
        <div className="flex flex-col gap-3">
          <p className="text-[15.5px] leading-snug">Les garder pour tes prochains <b>{template?.name ?? session.title}</b> ?</p>
          <div className="bg-surface2 rounded-[16px] p-3.5 flex flex-col gap-1.5">
            {changes.map((c, i) => <div key={i} className="flex gap-2 text-[14.5px] leading-snug"><span style={{ color: 'var(--muscu)' }}>•</span><span>{c.text}</span></div>)}
          </div>
          <Button full color="var(--muscu)" onClick={() => { applySessionToTemplate(program.id, session.id); setChangesOpen(false); toast('Modèle mis à jour'); nav(-1) }}>Oui, mettre à jour mon modèle</Button>
          <Button full variant="secondary" onClick={() => { setChangesOpen(false); nav(-1) }}>Non, juste cette fois</Button>
        </div>
      </Sheet>

      <Sheet open={runSheet} onClose={() => setRunSheet(false)} title="Ma sortie" tall>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between"><span className="font-semibold">Distance</span><NumberInput value={km} onChange={setKm} step={0.1} max={100} width={50} suffix="km" /></div>
          <div className="flex items-center justify-between gap-4"><span className="font-semibold">Durée</span>
            <DurationInput value={runSeconds} onChange={setRunSeconds} compact /></div>
          <div className="text-center bg-surface2 rounded-[16px] py-3.5"><div className="text-[12px] text-muted font-semibold">Allure moyenne</div><div className="text-[28px] font-extrabold num">{runPace ? `${fmtPace(runPace)} /km` : '—'}</div></div>
          <div><div className="font-semibold mb-2">Ressenti : {runFeeling}/10</div>
            <div className="grid grid-cols-5 gap-2">{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <button key={n} onClick={() => setRunFeeling(n)} className="tap h-11 rounded-[14px] font-bold" style={{ background: runFeeling === n ? '#FF9F0A' : 'var(--surface2)', color: runFeeling === n ? '#fff' : 'var(--text)' }}>{n}</button>)}</div></div>
          <textarea className="w-full h-20 rounded-[14px] bg-surface2 p-3 outline-none focus:ring-2 focus:ring-inset focus:ring-accent/60" placeholder="Commentaire (facultatif)" value={runComment} onChange={(e) => setRunComment(e.target.value)} />
          <Button full color="#FF9F0A" disabled={!km || !runSeconds} onClick={saveRun}>Enregistrer</Button>
        </div>
      </Sheet>

      {session.run && <RunEditor open={editRun} onClose={() => setEditRun(false)} program={program} session={session} />}

      <Sheet open={moving} onClose={() => setMoving(false)} title="Déplacer la séance">
        <div className="flex flex-col gap-3">
          <input type="date" className="h-12 rounded-xl bg-surface2 px-4 outline-none" value={newDate} min={todayISO()} onChange={(e) => setNewDate(e.target.value)} />
          {conflicts.map((c) => <div key={c} className="flex gap-2 text-[14.5px]"><span style={{ color: '#FF9F0A' }}><Icon name="alert" size={19} /></span>{c}</div>)}
          <Button full disabled={!newDate || newDate === session.date} onClick={() => { moveSession(program.id, session.id, newDate); setMoving(false); toast(conflicts.length ? 'Déplacée malgré le conflit' : 'Séance déplacée') }}>
            {conflicts.length ? 'Déplacer quand même' : 'Déplacer'}
          </Button>
        </div>
      </Sheet>
    </Page>
  )
}

function RunEditor({ open, onClose, program, session }: { open: boolean; onClose: () => void; program: Program; session: Session }) {
  const r = session.run!
  const [km, setKm] = useState<number | undefined>(r.totalKm)
  const [blocks, setBlocks] = useState<RunBlock[]>(r.blocks)
  const [warm, setWarm] = useState(r.warmup)
  const [cool, setCool] = useState(r.cooldown)
  useEffect(() => { if (open) { setKm(r.totalKm); setBlocks(r.blocks); setWarm(r.warmup); setCool(r.cooldown) } }, [open])
  const upd = (i: number, p: Partial<RunBlock>) => setBlocks(blocks.map((b, j) => (j === i ? { ...b, ...p } : b)))
  return (
    <Sheet open={open} onClose={onClose} title="Modifier la séance" tall>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between"><span className="font-semibold">Distance totale</span><NumberInput value={km} onChange={setKm} step={0.5} max={100} width={50} suffix="km" /></div>
        {blocks.map((b, i) => (
          <div key={i} className="bg-surface2 rounded-xl p-3 flex flex-col gap-2">
            <div className="font-semibold">{b.label}</div>
            <div className="grid grid-cols-2 gap-2 text-[12px] text-muted">
              <label>Répétitions<input className="mt-1 w-full h-10 rounded-lg bg-surface text-center text-ink outline-none" inputMode="numeric" value={b.reps ?? 1} onChange={(e) => upd(i, { reps: Math.max(1, Number(e.target.value) || 1) })} /></label>
              <label>{b.meters !== undefined ? 'Mètres' : 'Secondes'}<input className="mt-1 w-full h-10 rounded-lg bg-surface text-center text-ink outline-none" inputMode="numeric" value={b.meters ?? b.seconds ?? 0}
                onChange={(e) => upd(i, b.meters !== undefined ? { meters: Number(e.target.value) || 0 } : { seconds: Number(e.target.value) || 0 })} /></label>
              <div>Allure /km<div className="mt-1"><DurationInput hours={false} compact value={b.paceSec ? Math.round(b.paceSec) : undefined} onChange={(v) => v && upd(i, { paceSec: v })} /></div></div>
            </div>
          </div>
        ))}
        <textarea className="w-full h-20 rounded-xl bg-surface2 p-3 outline-none text-[15px]" value={warm} onChange={(e) => setWarm(e.target.value)} aria-label="Échauffement" />
        <textarea className="w-full h-16 rounded-xl bg-surface2 p-3 outline-none text-[15px]" value={cool} onChange={(e) => setCool(e.target.value)} aria-label="Retour au calme" />
        <Button full onClick={() => { updateRun(program.id, session.id, { blocks, warmup: warm, cooldown: cool, km }); onClose(); toast('Séance modifiée') }}>Enregistrer</Button>
      </div>
    </Sheet>
  )
}
