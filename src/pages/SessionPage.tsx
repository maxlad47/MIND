import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { findSession } from '@/engine/adapt'
import { conflictsOfWeek } from '@/engine/combine'
import { exerciseOf, isCustomId, isTimed } from '@/engine/exercises'
import {
  amrapLeft, chronoElapsed, defaultGroup, describeLastSet, describePlan, doneSetsOf, emomState, findLog, formatLabel, GROUP_COLOR, GROUP_LABEL, groupGuide,
  groupMembers, groupOf, hasPlan, isRoundsKind, isSetDone, letterOf, partOf, partText, plannedSetsOf, relativeKg, restAfter, roundsProgress, sessionProgress, setCountOf, suggestedKg,
  targetOf,
} from '@/engine/formats'
import { diffSessionTemplate, isFreeRun, isLibre } from '@/engine/libre'
import { describeBlock, runKindLabel } from '@/engine/running'
import type { ExerciseGroup, GroupKind, Program, RunBlock, Session, SessionExercise, SetLog } from '@/engine/types'
import { fmtKm, fmtPace, fmtTime, mondayOf, prettyDate, todayISO } from '@/engine/utils'
import {
  addComment, addCustomExercise, addExercise, applySessionToTemplate, createGroup, currentUser, customExercisesOf, deleteGroup, finishGroup, finishStrength, lastPerformance, logRound,
  logRun, logSet, moveSession, removeExercise, replaceExercise, resetGroup, restoreSession, setExerciseFormat, skipSession, startGroup, tallyGroup, unlogRound, unlogSet, updateExercise,
  updateGroup, updateRun, useDB, type Recap,
} from '@/lib/store'
import { signalChain, startRest, useNow } from '@/lib/rest'
import { motion } from 'framer-motion'
import { Button, Card, Cover, DurationInput, Icon, NumberInput, Page, Ring, SectionTitle, Sheet, SportBadge, spring, toast } from '@/ui/kit'
import { AddExerciseSheet, FormatChips, formatPatch, GroupParams, GroupTag, PlanEditor, type GroupItem } from '@/ui/formats'
import { coverSeed, ExercisePicker, sessionMeta, statusLabel, tintOf } from '@/ui/parts'

const startKey = (id: string) => `mind.start.${id}`
function getStart(id: string): number | undefined {
  try { const v = sessionStorage.getItem(startKey(id)); return v ? Number(v) : undefined } catch { return undefined }
}
function markStart(id: string) {
  try { if (!sessionStorage.getItem(startKey(id))) sessionStorage.setItem(startKey(id), String(Date.now())) } catch { /* ok */ }
}

const num = (s: string) => Number(s.replace(',', '.')) || 0
const cellCls = 'h-11 w-full rounded-[12px] text-center num font-bold text-[17px] outline-none focus:ring-2 focus:ring-inset focus:ring-accent/60 disabled:opacity-100'
const cellBg = (done: boolean) => ({ background: done ? 'color-mix(in srgb, #30D158 16%, var(--surface2))' : 'var(--surface2)' })

/** Bouton rond « valider / annuler » commun à toutes les lignes. */
function CheckBtn({ done, locked, label, onClick }: { done: boolean; locked: boolean; label: string; onClick: () => void }) {
  return (
    <motion.button disabled={locked} aria-label={done ? `Annuler ${label}` : `Valider ${label}`} whileTap={{ scale: 0.88 }} transition={spring} className="w-11 h-11 rounded-full flex items-center justify-center"
      style={{ background: done ? '#30D158' : 'var(--surface2)', color: done ? '#fff' : 'var(--faint)', boxShadow: done ? '0 6px 16px -6px rgba(48,209,88,.7)' : undefined }} onClick={onClick}>
      <Icon name="check" size={20} strokeWidth={3} />
    </motion.button>
  )
}

/** Lance le repos qui suit la validation d'une série, d'une partie ou d'un tour : bon repos selon la position, ou « Enchaîne ». */
function restFor(session: Session, e: SessionExercise, n: number, part: number) {
  const r = restAfter(session, e, n, part)
  if (!r) return
  if (r.chain) signalChain(r.label)
  else startRest(r.sec, r.label)
}

/** Série classique (une seule partie) ; en durée, on saisit les secondes tenues. */
function SetRow({ n, defaults, prev, done, locked, timed, onValidate, onUndo }: {
  n: number; defaults: { kg: number; reps: number; rir: number; seconds: number }; prev?: string
  done?: SetLog; locked: boolean; timed?: boolean; onValidate: (v: { kg: number; reps: number; rir: number; seconds?: number }) => void; onUndo: () => void
}) {
  const [kg, setKg] = useState(String(done?.kg ?? defaults.kg))
  const [reps, setReps] = useState(String(done?.reps ?? defaults.reps))
  const [sec, setSec] = useState(String(done?.seconds ?? defaults.seconds))
  useEffect(() => {
    if (!done) { setKg(String(defaults.kg)); setReps(String(defaults.reps)); setSec(String(defaults.seconds)) }
  }, [defaults.kg, defaults.reps, defaults.seconds, done])
  const bg = cellBg(!!done)
  return (
    <div className="grid items-center gap-2 py-1.5" style={{ gridTemplateColumns: timed ? '24px 1fr 76px 44px' : '24px 1fr 72px 62px 44px' }}>
      <div className="text-[15px] font-bold text-center" style={{ color: done ? '#30D158' : 'var(--muted)' }}>{n}</div>
      <div className="text-[12.5px] text-muted leading-tight num">{prev ?? '—'}</div>
      {timed ? (
        <input className={cellCls} style={bg} inputMode="numeric" value={sec} disabled={locked} onChange={(e) => setSec(e.target.value)} aria-label="Secondes" />
      ) : (<>
        <input className={cellCls} style={bg} inputMode="decimal" value={kg} disabled={locked} onChange={(e) => setKg(e.target.value)} aria-label="Poids" />
        <input className={cellCls} style={bg} inputMode="numeric" value={reps} disabled={locked} onChange={(e) => setReps(e.target.value)} aria-label="Répétitions" />
      </>)}
      <CheckBtn done={!!done} locked={locked} label="la série" onClick={() => (done ? onUndo() : onValidate(timed ? { kg: 0, reps: 0, rir: 0, seconds: Math.round(num(sec)) } : { kg: num(kg), reps: Math.round(num(reps)), rir: defaults.rir }))} />
    </div>
  )
}

/**
 * Une série à parties enchaînées (combo, dégressive, rest-pause) : une ligne par partie. Les parties relatives se
 * précalculent à partir de la partie lourde saisie (arrondi à 0,5 kg), et restent modifiables.
 */
function PlanSetBlock({ e, n, session, last, refKg, locked, onValidate, onUndo }: {
  e: SessionExercise; n: number; session: Session; last?: { parts: { kg: number; reps: number; seconds?: number }[] }
  /** Charge de la première partie de la première série (référence des parties relatives des séries suivantes). */
  refKg?: number; locked: boolean
  onValidate: (part: number, v: { kg: number; reps: number; rir: number; seconds?: number }) => void; onUndo: (part: number) => void
}) {
  const set = plannedSetsOf(e)[n - 1]
  const parts = set.parts
  const logged = (j: number) => findLog(e.logs, n, j)
  // charge de départ de chaque partie
  const initKgs = (): string[] => {
    const out: number[] = []
    parts.forEach((p, j) => {
      const l = logged(j)
      if (l) { out[j] = l.kg; return }
      const rel = suggestedKg(e, n, j, (nn, pp) => (nn === n ? out[pp] : pp === 0 && nn === 1 ? refKg : undefined))
      const prevPart = last?.parts[j]?.kg ?? last?.parts[last.parts.length - 1]?.kg
      out[j] = rel ?? (j === 0 ? (n === 1 ? (prevPart ?? e.targetKg ?? 0) : (refKg ?? prevPart ?? e.targetKg ?? 0)) : (prevPart ?? out[0] ?? 0))
    })
    return out.map((v) => String(v))
  }
  const [kgs, setKgs] = useState<string[]>(initKgs)
  const [touched, setTouched] = useState<boolean[]>(() => parts.map(() => false))
  const [reps, setReps] = useState<string[]>(() => parts.map((p, j) => String(logged(j)?.reps ?? p.reps ?? 0)))
  const [secs, setSecs] = useState<string[]>(() => parts.map((p, j) => String(logged(j)?.seconds ?? p.seconds ?? 0)))
  const structure = JSON.stringify(parts)
  useEffect(() => {
    // structure modifiée (autre format, partie ajoutée…) : on repart des valeurs prévues
    setTouched(parts.map(() => false)); setKgs(initKgs()); setReps(parts.map((p, j) => String(logged(j)?.reps ?? p.reps ?? 0)))
    setSecs(parts.map((p, j) => String(logged(j)?.seconds ?? p.seconds ?? 0)))
  }, [structure, e.exerciseId])
  // la référence d'une série suivante change (partie lourde de la 1re série saisie) : les parties non touchées suivent
  useEffect(() => {
    if (n === 1) return
    setKgs((cur) => cur.map((v, j) => (logged(j) || touched[j] ? v : parts[j].pct !== undefined && refKg ? String(relativeKg(refKg, parts[j].pct!)) : v)))
  }, [refKg])
  const changeKg = (j: number, v: string) => {
    setKgs((cur) => {
      const next = [...cur]; next[j] = v
      if (j === 0) parts.forEach((p, k) => { if (k > 0 && !touched[k] && !logged(k) && p.pct !== undefined && p.kg === undefined) next[k] = String(relativeKg(num(v), p.pct)) })
      return next
    })
    setTouched((t) => t.map((x, k) => (k === j ? true : x)))
  }
  const doneSet = isSetDone(e, n)
  return (
    <div className="py-1.5" data-set={n}>
      <div className="px-0.5 mb-1">
        <div className="text-[14px] font-bold" style={{ color: doneSet ? '#30D158' : 'var(--text)' }}>Série {n}{parts.length > 1 ? ' · parties enchaînées' : ''}</div>
        {last && <div className="text-[12.5px] text-muted num leading-snug">Dernière : {describeLastSet({ n, parts: last.parts.map((p, i) => ({ part: i, ...p })) })}</div>}
      </div>
      <div className={parts.length > 1 ? 'pl-2.5 ml-1 border-l-[3px] rounded-[2px]' : ''} style={parts.length > 1 ? { borderColor: 'color-mix(in srgb, var(--muscu) 55%, transparent)' } : undefined}>
        {parts.map((p, j) => {
          const l = logged(j)
          const timed = p.seconds !== undefined
          const lastRow = j === parts.length - 1
          return (
            <div key={j}>
              <div className="grid items-center gap-2 py-1" style={{ gridTemplateColumns: timed ? '1fr 76px 44px' : '1fr 72px 62px 44px' }}>
                <div className="min-w-0">
                  <div className="text-[12.5px] font-semibold leading-tight">{parts.length > 1 ? `Partie ${j + 1}` : 'Cible'}</div>
                  <div className="text-[12.5px] text-muted leading-tight num truncate">{p.kg === undefined && p.pct !== undefined && p.pct !== 100 && !(n === 1 && j === 0) ? `${partText(p)} de la lourde` : partText(p)}</div>
                </div>
                {timed ? (
                  <input className={cellCls} style={cellBg(!!l)} inputMode="numeric" value={secs[j]} disabled={locked} aria-label={`Secondes, partie ${j + 1}`} onChange={(ev) => setSecs((c) => c.map((x, k) => (k === j ? ev.target.value : x)))} />
                ) : (<>
                  <input className={cellCls} style={cellBg(!!l)} inputMode="decimal" value={kgs[j] ?? ''} disabled={locked} aria-label={`Poids, partie ${j + 1}`} onChange={(ev) => changeKg(j, ev.target.value)} />
                  <input className={cellCls} style={cellBg(!!l)} inputMode="numeric" value={reps[j] ?? ''} disabled={locked} aria-label={`Répétitions, partie ${j + 1}`} onChange={(ev) => setReps((c) => c.map((x, k) => (k === j ? ev.target.value : x)))} />
                </>)}
                <CheckBtn done={!!l} locked={locked} label={`la partie ${j + 1}`} onClick={() => (l ? onUndo(j) : onValidate(j, timed ? { kg: 0, reps: 0, rir: 0, seconds: Math.round(num(secs[j])) } : { kg: num(kgs[j]), reps: Math.round(num(reps[j])), rir: p.rir ?? e.rir }))} />
              </div>
              {!lastRow && <div className="text-[11.5px] font-semibold pl-1 pb-0.5" style={{ color: 'var(--muscu)' }}>{(p.restAfterSec ?? 0) > 0 ? `↳ pause ${p.restAfterSec} s` : '↳ enchaîne tout de suite'}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ExerciseCard({ program, session, e, locked }: { program: Program; session: Session; e: SessionExercise; locked: boolean }) {
  const db = useDB()
  const ex = exerciseOf(e.exerciseId)
  const libre = isLibre(program)
  const timed = isTimed(e.exerciseId)
  const [pick, setPick] = useState(false)
  const [edit, setEdit] = useState(false)
  const last = lastPerformance(db, program.clientId, e.exerciseId, session.id)
  const prevLog = (n: number) => (last ? last.logs.find((l) => l.n === n && partOf(l) === 0) ?? last.logs[last.logs.length - 1] : undefined)
  const detailed = hasPlan(e)
  const fmt = formatLabel(e)
  const total = setCountOf(e)
  const done = doneSetsOf(e)
  const side = ex.perSide ? ' / côté' : ''
  const repsText = timed ? `${e.repMin}${e.repMax !== e.repMin ? `–${e.repMax}` : ''} s${side}` : `${e.repMin}–${e.repMax}${side}`
  const val = (n: number, part: number, v: { kg: number; reps: number; rir: number; seconds?: number }) => {
    markStart(session.id)
    logSet(program.id, session.id, e.id, { n, part, ...v, at: new Date().toISOString() })
    restFor(session, e, n, part)
  }

  return (
    <Card className="p-4">
      <div className="flex items-start gap-2">
        <Ring value={done / Math.max(1, total)} size={40} stroke={5} color={done >= total ? '#30D158' : 'var(--muscu)'}>
          {done >= total ? <span className="text-ok"><Icon name="check" size={16} strokeWidth={3.2} /></span> : <span className="text-[12px] font-extrabold num">{done}/{total}</span>}
        </Ring>
        <div className="flex-1 min-w-0 pl-1">
          <div className="text-[18px] font-extrabold leading-tight tracking-tight">{ex.name}</div>
          {fmt && <div className="mt-1"><span className="inline-flex items-center h-5 rounded-full px-2 text-[11.5px] font-extrabold tracking-wide" style={{ background: 'color-mix(in srgb, var(--muscu) 18%, transparent)', color: 'var(--muscu)' }} data-format={e.format}>{fmt}</span></div>}
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[13px] text-muted mt-0.5 num">
            <span className="font-semibold text-ink">{detailed ? describePlan(e) : `${e.sets} × ${repsText}`}</span><span>repos {String(Math.round(e.restSec / 6) / 10).replace('.', ',')} min</span>{e.targetKg ? <span>{libre ? 'suggéré ' : ''}{fmtKm(e.targetKg)} kg</span> : null}
          </div>
        </div>
        {!locked && (<>
          <button className="tap hit w-10 h-10 rounded-full bg-surface2 flex items-center justify-center" aria-label="Remplacer" onClick={() => setPick(true)}><Icon name="swap" size={18} /></button>
          <button className="tap hit w-10 h-10 rounded-full bg-surface2 flex items-center justify-center" aria-label="Modifier" onClick={() => setEdit(true)}><Icon name="edit" size={17} /></button>
        </>)}
      </div>
      {!isCustomId(e.exerciseId) && <p className="text-[13px] text-muted mt-2 leading-snug">{ex.cue}</p>}
      {!detailed && (
        <div className="grid text-[11px] font-semibold uppercase tracking-wide text-faint mt-3.5 px-0" style={{ gridTemplateColumns: timed ? '24px 1fr 76px 44px' : '24px 1fr 72px 62px 44px', gap: 8 }}>
          {timed ? (<><span /> <span>Dernière</span><span className="text-center">sec</span><span /></>) : (<><span /> <span>Dernière</span><span className="text-center">kg</span><span className="text-center">reps</span><span /></>)}
        </div>
      )}
      {detailed && <div className="grid text-[11px] font-semibold uppercase tracking-wide text-faint mt-3.5" style={{ gridTemplateColumns: '1fr 72px 62px 44px', gap: 8 }}><span>Cible</span><span className="text-center">kg</span><span className="text-center">reps</span><span /></div>}
      {!detailed && Array.from({ length: e.sets }, (_, i) => i + 1).map((n) => {
        const doneLog = findLog(e.logs, n, 0)
        const before = e.logs.filter((l) => l.n < n).slice(-1)[0]
        const p = prevLog(n)
        const defaults = {
          // mode libre : la charge suggérée (si activée) passe avant la dernière performance
          kg: before?.kg ?? (libre ? (e.targetKg ?? p?.kg) : (p?.kg ?? e.targetKg)) ?? 0,
          reps: before?.reps ?? p?.reps ?? e.repMin,
          rir: e.rir,
          seconds: before?.seconds ?? p?.seconds ?? e.repMin,
        }
        const prevTxt = p ? (timed ? `${p.seconds ?? 0} s` : `${fmtKm(p.kg)} × ${p.reps}`) : undefined
        return <SetRow key={`${e.id}-${n}-${e.exerciseId}`} n={n} defaults={defaults} prev={prevTxt} done={doneLog} locked={locked} timed={timed}
          onValidate={(v) => val(n, 0, v)}
          onUndo={() => unlogSet(program.id, session.id, e.id, n)} />
      })}
      {detailed && plannedSetsOf(e).map((_, i) => {
        const n = i + 1
        const ref1 = findLog(e.logs, 1, 0)?.kg
        return <PlanSetBlock key={`${e.id}-${n}-${e.exerciseId}`} e={e} n={n} session={session} last={last?.sets.find((x) => x.n === n)} refKg={n === 1 ? undefined : ref1} locked={locked}
          onValidate={(part, v) => val(n, part, v)} onUndo={(part) => unlogSet(program.id, session.id, e.id, n, part)} />
      })}

      {libre
        ? <ExercisePicker open={pick} onClose={() => setPick(false)} title="Remplacer l'exercice" injuries={[]} warn={program.q.injuries} customs={customExercisesOf(db, program.clientId)}
          onCreateCustom={(name, muscle) => addCustomExercise(program.id, name, muscle)} onPick={(id) => { replaceExercise(program.id, session.id, e.id, id); toast('Exercice remplacé') }} />
        : <ExercisePicker open={pick} onClose={() => setPick(false)} title="Remplacer l'exercice" replacing={e.exerciseId} injuries={program.q.injuries}
          onPick={(id) => { replaceExercise(program.id, session.id, e.id, id); toast('Exercice remplacé') }} />}
      <Sheet open={edit} onClose={() => setEdit(false)} title={ex.name} tall={detailed}>
        <div className="flex flex-col gap-4">
          <FormatChips exerciseId={e.exerciseId} value={e.format} onChange={(f) => setExerciseFormat(program.id, session.id, e.id, f)} />
          {detailed
            ? <PlanEditor value={e} refKg={findLog(e.logs, 1, 0)?.kg ?? last?.sets[0]?.parts[0]?.kg ?? e.targetKg} onChange={(p) => updateExercise(program.id, session.id, e.id, p)} />
            : (['sets', 'repMin', 'repMax'] as const).map((key) => {
              const [label, mn, mx, st] = key === 'sets' ? ['Séries', 1, 8, 1] as const : key === 'repMin' ? [timed ? 'Durée min (s)' : 'Reps min', 1, timed ? 300 : 30, timed ? 5 : 1] as const : [timed ? 'Durée max (s)' : 'Reps max', 1, timed ? 300 : 40, timed ? 5 : 1] as const
              return <div key={key} className="flex items-center justify-between"><span className="font-semibold">{label}</span>
                <NumberInput value={e[key]} min={mn} max={mx} step={st} width={48} onChange={(v) => v !== undefined && updateExercise(program.id, session.id, e.id, { [key]: v })} /></div>
            })}
          {([['Repos (s)', 'restSec', 30, 480, 15]] as const).map(([label, key, mn, mx, st]) => (
            <div key={key} className="flex items-center justify-between"><span className="font-semibold">{label}</span>
              <NumberInput value={e[key]} min={mn} max={mx} step={st} width={48} onChange={(v) => v !== undefined && updateExercise(program.id, session.id, e.id, { [key]: v })} /></div>
          ))}
          {!detailed && <div className="flex items-center justify-between"><span className="font-semibold">{libre ? 'Poids de départ (kg)' : 'Charge (kg)'}</span>
            <NumberInput value={e.targetKg} min={0} max={600} step={2.5} width={48} onChange={(v) => updateExercise(program.id, session.id, e.id, { targetKg: v })} /></div>}
          <Button full variant="danger" onClick={() => { removeExercise(program.id, session.id, e.id); setEdit(false) }}>Retirer l'exercice</Button>
        </div>
      </Sheet>
    </Card>
  )
}

// ------------------------------------------------------------------ groupes d'exercices

/** Une ligne d'un tour : étiquette A2 / B2, exercice, cible, charge et reps facultatives. */
function RoundRow({ label, name, target, timed, color, kg, reps, done, locked, current, onKg, onReps, onToggle }: {
  label: string; name: string; target: string; timed: boolean; color: string; kg: string; reps: string
  done: boolean; locked: boolean; current: boolean; onKg: (v: string) => void; onReps: (v: string) => void; onToggle: () => void
}) {
  return (
    <div className="grid items-center gap-2 py-1.5 rounded-[14px]" style={{ gridTemplateColumns: timed ? '38px 1fr 64px 44px' : '38px 1fr 56px 52px 44px', background: current ? `color-mix(in srgb, ${color} 10%, transparent)` : undefined }}>
      <div className="h-8 rounded-[10px] flex items-center justify-center text-[13px] font-extrabold" data-label={label} style={{ background: done ? '#30D158' : `color-mix(in srgb, ${color} 22%, transparent)`, color: done ? '#fff' : color }}>{label}</div>
      <div className="min-w-0"><div className="text-[14.5px] font-semibold leading-tight line-clamp-2">{name}</div><div className="text-[12.5px] text-muted num leading-tight">{target}</div></div>
      {!timed && <input className={cellCls} style={cellBg(done)} inputMode="decimal" placeholder="kg" value={kg} disabled={locked} aria-label={`Poids ${label}`} onChange={(e) => onKg(e.target.value)} />}
      <input className={cellCls} style={cellBg(done)} inputMode="numeric" placeholder={timed ? 's' : 'reps'} value={reps} disabled={locked} aria-label={`${timed ? 'Secondes' : 'Répétitions'} ${label}`} onChange={(e) => onReps(e.target.value)} />
      <CheckBtn done={done} locked={locked} label={`le ${label}`} onClick={onToggle} />
    </div>
  )
}

/** Superset, triset, circuit : les exercices s'enchaînent tour après tour ; chaque série saisie est un tour. */
function RoundsGroupBody({ program, session, g, locked }: { program: Program; session: Session; g: ExerciseGroup; locked: boolean }) {
  const members = groupMembers(session, g)
  const color = GROUP_COLOR[g.kind]
  const prog = roundsProgress(session, g)
  const [draft, setDraft] = useState<Record<string, { kg?: string; reps?: string }>>({})
  const key = (id: string, r: number) => `${id}:${r}`
  const db = useDB()
  // dernière charge utilisée sur cet exercice (séance précédente), pour préremplir et rappeler
  const lastOf = (e: SessionExercise) => lastPerformance(db, program.clientId, e.exerciseId, session.id)?.logs.filter((l) => l.kg > 0).slice(-1)[0]
  const kgOf = (e: SessionExercise, r: number) => draft[key(e.id, r)]?.kg ?? String(findLog(e.logs, r, 0)?.kg || e.logs.filter((l) => l.n < r).slice(-1)[0]?.kg || lastOf(e)?.kg || e.targetKg || '')
  const repsOf = (e: SessionExercise, r: number) => draft[key(e.id, r)]?.reps ?? String(findLog(e.logs, r, 0)?.seconds ?? findLog(e.logs, r, 0)?.reps ?? e.repMin)
  const setD = (id: string, r: number, p: { kg?: string; reps?: string }) => setDraft((d) => ({ ...d, [key(id, r)]: { ...d[key(id, r)], ...p } }))
  const validate = (e: SessionExercise, r: number) => {
    markStart(session.id)
    const timed = isTimed(e.exerciseId)
    const reps = Math.round(num(repsOf(e, r)))
    logSet(program.id, session.id, e.id, { n: r, part: 0, kg: num(kgOf(e, r)), reps: timed ? 0 : reps, rir: e.rir, at: new Date().toISOString(), ...(timed ? { seconds: reps } : {}) })
    restFor(session, e, r, 0)
  }
  const roundDone = (r: number) => members.every((e) => !!findLog(e.logs, r, 0))
  const cur = prog.next?.round
  const entries = (r: number) => Object.fromEntries(members.map((e) => [e.id, { kg: num(kgOf(e, r)) || undefined, reps: Math.round(num(repsOf(e, r))) || undefined }]))
  return (
    <div>
      <div className="flex flex-col gap-1">
        {Array.from({ length: g.rounds }, (_, i) => i + 1).map((r) => {
          const isDone = roundDone(r)
          const isCur = r === cur
          if (isDone && !locked) {
            return (
              <div key={r} className="flex items-center justify-between rounded-[14px] px-3 min-h-[44px]" style={{ background: 'color-mix(in srgb, #30D158 12%, transparent)' }}>
                <span className="text-[14px] font-bold flex items-center gap-1.5" style={{ color: '#30D158' }}><Icon name="check" size={15} strokeWidth={3} /> Tour {r} fait</span>
                <button className="tap h-11 px-3 text-[13px] font-semibold text-muted" aria-label={`Annuler le tour ${r}`} onClick={() => unlogRound(program.id, session.id, g.id, r)}>Annuler</button>
              </div>
            )
          }
          if (!isCur && !locked) {
            return <div key={r} className="px-3 py-2 text-[13.5px] text-muted flex items-center gap-2"><span className="font-bold">Tour {r}</span><span className="num">{members.map((_, i) => `${letterOf(i)}${r}`).join(' · ')}</span></div>
          }
          return (
            <div key={r} className="rounded-[16px] p-1.5" style={isCur ? { boxShadow: `inset 0 0 0 1.5px ${color}` } : undefined}>
              <div className="px-1.5 pt-1 pb-0.5 text-[12px] font-bold uppercase tracking-wide" style={{ color }}>Tour {r}/{g.rounds}</div>
              {members.map((e, i) => (
                <RoundRow key={e.id} label={`${letterOf(i)}${r}`} name={exerciseOf(e.exerciseId).name} target={`${targetOf(e)}${lastOf(e) ? ` · dern. ${fmtKm(lastOf(e)!.kg)} kg` : ''}`} timed={isTimed(e.exerciseId)} color={color}
                  kg={kgOf(e, r)} reps={repsOf(e, r)} done={!!findLog(e.logs, r, 0)} locked={locked} current={isCur && prog.next?.seId === e.id}
                  onKg={(v) => setD(e.id, r, { kg: v })} onReps={(v) => setD(e.id, r, { reps: v })}
                  onToggle={() => (findLog(e.logs, r, 0) ? unlogSet(program.id, session.id, e.id, r) : validate(e, r))} />
              ))}
            </div>
          )
        })}
      </div>
      {!locked && cur !== undefined && (
        <div className="mt-2.5"><Button full variant="tinted" color={color} onClick={() => {
          markStart(session.id)
          logRound(program.id, session.id, g.id, cur, entries(cur))
          restFor(session, members[members.length - 1], cur, 0)
        }}>Tour {cur} fait</Button></div>
      )}
    </div>
  )
}

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

/** EMOM, AMRAP, chrono : un décompte global, un seul résultat. Tout se déduit de l'horodatage de départ. */
function TimedGroupBody({ program, session, g, locked }: { program: Program; session: Session; g: ExerciseGroup; locked: boolean }) {
  const members = groupMembers(session, g)
  const color = GROUP_COLOR[g.kind]
  const started = g.startedAt !== undefined
  const running = started && !g.result
  const now = useNow(running)
  const es = g.kind === 'emom' ? emomState(session, g, now) : undefined
  const left = g.kind === 'amrap' ? amrapLeft(g, now) : undefined
  const elapsed = g.kind === 'chrono' ? chronoElapsed(g, now) : undefined
  const over = (g.kind === 'emom' && es?.finished) || (g.kind === 'amrap' && left === 0)
  const [minutes, setMinutes] = useState<number | undefined>(undefined)
  const [extra, setExtra] = useState<number | undefined>(undefined)
  const [time, setTime] = useState<number | undefined>(undefined)
  const [editTime, setEditTime] = useState(false)
  const total = g.durationMin ?? 10
  const doneAt = (g.kind === 'emom' && es) ? (es.finished ? total : Math.max(0, es.minute - 1)) : total

  const goal = g.kind === 'emom' ? `${total} min · ${members.length > 1 ? `alternance ${members.map((_, i) => letterOf(i)).join('/')}` : 'chaque minute'}`
    : g.kind === 'amrap' ? `${total} min · le maximum de tours`
      : `${g.rounds} tour${g.rounds > 1 ? 's' : ''} pour le temps`
  const start = () => { markStart(session.id); startGroup(program.id, session.id, g.id) }

  return (
    <div>
      <div className="flex flex-col gap-1 mb-2.5">
        {members.map((e, i) => (
          <div key={e.id} className="flex items-center gap-2.5 min-h-[40px]" style={es && !es.finished && es.seId === e.id ? { background: `color-mix(in srgb, ${color} 14%, transparent)`, borderRadius: 12 } : undefined}>
            <span className="w-8 h-8 rounded-[10px] flex items-center justify-center text-[13px] font-extrabold shrink-0" style={{ background: `color-mix(in srgb, ${color} 22%, transparent)`, color }}>{letterOf(i)}</span>
            <span className="flex-1 min-w-0 text-[15px] font-semibold truncate">{exerciseOf(e.exerciseId).name}</span>
            <span className="text-[14px] font-bold num text-muted">{targetOf(e)}{e.targetKg ? ` · ${fmtKm(e.targetKg)} kg` : ''}{g.kind === 'chrono' && g.rounds > 1 ? ` × ${g.rounds}` : ''}</span>
          </div>
        ))}
      </div>

      {g.result ? (
        <div className="rounded-[16px] p-3.5 flex items-center justify-between gap-3" style={{ background: 'color-mix(in srgb, #30D158 12%, transparent)' }}>
          <div>
            <div className="text-[12px] font-bold uppercase tracking-wide" style={{ color: '#30D158' }}>Résultat</div>
            <div className="text-[22px] font-extrabold num leading-tight">
              {g.kind === 'emom' && `${g.result.minutesDone ?? total}/${total} minutes`}
              {g.kind === 'amrap' && `${g.result.rounds ?? 0} tour${(g.result.rounds ?? 0) > 1 ? 's' : ''}${g.result.extraReps ? ` + ${g.result.extraReps} reps` : ''}`}
              {g.kind === 'chrono' && fmtTime(g.result.seconds ?? 0)}
            </div>
          </div>
          {!locked && (g.kind === 'chrono' && editTime
            ? <div className="flex items-center gap-2"><DurationInput hours={false} compact value={time ?? g.result.seconds} onChange={setTime} /><Button small onClick={() => { finishGroup(program.id, session.id, g.id, { seconds: time ?? g.result?.seconds }); setEditTime(false) }}>OK</Button></div>
            : <div className="flex gap-2">
              {g.kind === 'chrono' && <Button small variant="secondary" onClick={() => { setTime(g.result?.seconds); setEditTime(true) }}>Corriger</Button>}
              <Button small variant="secondary" onClick={() => resetGroup(program.id, session.id, g.id)}>Refaire</Button>
            </div>)}
        </div>
      ) : !started ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-[14px] text-muted">{goal}</span>
          {!locked && <Button color={color} onClick={start}><Icon name="play" size={16} /> Démarrer</Button>}
        </div>
      ) : over ? (
        <div className="rounded-[16px] bg-surface2 p-3.5 flex flex-col gap-3">
          <div className="font-bold">{g.kind === 'emom' ? 'EMOM terminé' : 'Temps écoulé'} · note ton résultat</div>
          {g.kind === 'emom' && <div className="flex items-center justify-between"><span className="font-semibold">Minutes réussies</span><NumberInput value={minutes ?? total} min={0} max={total} width={48} onChange={(v) => setMinutes(v)} /></div>}
          {g.kind === 'amrap' && (<>
            <div className="flex items-center justify-between"><span className="font-semibold">Tours complets</span><NumberInput value={g.tally ?? 0} min={0} max={99} width={48} onChange={(v) => v !== undefined && tallyGroup(program.id, session.id, g.id, v - (g.tally ?? 0))} /></div>
            <div className="flex items-center justify-between"><span className="font-semibold">Reps du dernier tour</span><NumberInput value={extra ?? 0} min={0} max={200} width={48} onChange={(v) => setExtra(v)} /></div>
          </>)}
          <Button full color={color} onClick={() => finishGroup(program.id, session.id, g.id, g.kind === 'emom' ? { minutesDone: minutes ?? total } : { rounds: g.tally ?? 0, ...(extra ? { extraReps: extra } : {}) })}>Enregistrer le résultat</Button>
        </div>
      ) : (
        <div className="rounded-[16px] p-3.5 text-center" style={{ background: `color-mix(in srgb, ${color} 12%, transparent)` }}>
          {g.kind === 'emom' && es && (<>
            <div className="text-[13px] font-bold uppercase tracking-wide" style={{ color }}>Minute {es.minute}/{es.total}</div>
            <div className="text-[24px] font-extrabold leading-tight mt-0.5">{exerciseOf(groupMembers(session, g).find((m) => m.id === es.seId)!.exerciseId).name} <span className="num">{targetOf(groupMembers(session, g).find((m) => m.id === es.seId)!)}</span></div>
            <div className="num text-[40px] font-extrabold leading-none mt-1.5" role="timer" aria-label="Temps restant dans la minute">{mmss(es.secLeft)}</div>
            <div className="h-1.5 rounded-full bg-white/20 overflow-hidden mt-2"><div className="h-full rounded-full" style={{ width: `${((60 - es.secLeft) / 60) * 100}%`, background: color, transition: 'width .25s linear' }} /></div>
            <div className="text-[12.5px] text-muted mt-1.5">Minute suivante : {exerciseOf(members[es.minute % members.length].exerciseId).name}</div>
          </>)}
          {g.kind === 'amrap' && left !== undefined && (<>
            <div className="text-[13px] font-bold uppercase tracking-wide" style={{ color }}>AMRAP · temps restant</div>
            <div className="num text-[48px] font-extrabold leading-none mt-1" role="timer" aria-label="Temps restant">{mmss(left)}</div>
            <div className="flex items-center justify-center gap-3 mt-3">
              <button className="tap hit w-11 h-11 rounded-full bg-surface2 font-bold text-[20px]" aria-label="Retirer un tour" onClick={() => tallyGroup(program.id, session.id, g.id, -1)}>−</button>
              <div className="min-w-[96px]"><div className="num text-[36px] font-extrabold leading-none">{g.tally ?? 0}</div><div className="text-[12.5px] text-muted">tour{(g.tally ?? 0) > 1 ? 's' : ''}</div></div>
              <button className="tap hit h-14 px-5 rounded-full font-extrabold text-[17px] text-white" style={{ background: color }} aria-label="Ajouter un tour" onClick={() => tallyGroup(program.id, session.id, g.id, 1)}>+1 tour</button>
            </div>
          </>)}
          {g.kind === 'chrono' && elapsed !== undefined && (<>
            <div className="text-[13px] font-bold uppercase tracking-wide" style={{ color }}>Chrono</div>
            <div className="num text-[48px] font-extrabold leading-none mt-1" role="timer" aria-label="Chronomètre">{mmss(elapsed)}</div>
            <div className="mt-3"><Button full color={color} onClick={() => finishGroup(program.id, session.id, g.id, { seconds: elapsed })}>Terminé · {mmss(elapsed)}</Button></div>
          </>)}
          {g.kind !== 'chrono' && <button className="tap h-11 mt-2 text-[14px] font-semibold text-muted" onClick={() => finishGroup(program.id, session.id, g.id, g.kind === 'emom' ? { minutesDone: doneAt } : { rounds: g.tally ?? 0 })}>Arrêter maintenant</button>}
        </div>
      )}
    </div>
  )
}

function GroupCard({ program, session, g, locked }: { program: Program; session: Session; g: ExerciseGroup; locked: boolean }) {
  const [edit, setEdit] = useState(false)
  const members = groupMembers(session, g)
  const color = GROUP_COLOR[g.kind]
  const guide = groupGuide(session, g)
  const rounds = isRoundsKind(g.kind)
  const prog = rounds ? roundsProgress(session, g) : undefined
  return (
    <Card className="p-4 relative" style={{ boxShadow: `inset 4px 0 0 ${color}, var(--shadow-card)` }}>
      <div className="flex items-start gap-2 mb-2.5" data-group={g.kind}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap"><GroupTag kind={g.kind} />{prog && <span className="text-[12.5px] text-muted num font-semibold">{prog.doneRounds}/{g.rounds} tours</span>}</div>
          <div className="text-[18px] font-extrabold leading-tight tracking-tight mt-1" data-testid="group-title">{rounds ? guide.title : `${GROUP_LABEL[g.kind]} · ${members.map((e) => exerciseOf(e.exerciseId).name).join(' + ')}`}</div>
          {rounds && guide.hint && <div className="text-[14px] text-muted mt-0.5 leading-snug" data-testid="group-hint">{guide.hint}</div>}
        </div>
        {!locked && <button className="tap hit w-10 h-10 rounded-full bg-surface2 flex items-center justify-center shrink-0" aria-label="Modifier le groupe" onClick={() => setEdit(true)}><Icon name="edit" size={17} /></button>}
      </div>
      {rounds ? <RoundsGroupBody program={program} session={session} g={g} locked={locked} /> : <TimedGroupBody program={program} session={session} g={g} locked={locked} />}
      <Sheet open={edit} onClose={() => setEdit(false)} title={`${GROUP_LABEL[g.kind]} · réglages`}>
        <div className="flex flex-col gap-3">
          <GroupParams spec={g} names={members.map((e) => exerciseOf(e.exerciseId).name)} onChange={(p) => updateGroup(program.id, session.id, g.id, p)} onUngroup={() => { deleteGroup(program.id, session.id, g.id); setEdit(false) }} />
          {members.map((e, i) => (
            <div key={e.id} className="rounded-[16px] bg-surface2 p-3 flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-[10px] flex items-center justify-center text-[13px] font-extrabold shrink-0" style={{ background: `color-mix(in srgb, ${color} 22%, transparent)`, color }}>{letterOf(i)}</span>
                <span className="flex-1 min-w-0 text-[15px] font-semibold truncate">{exerciseOf(e.exerciseId).name}</span>
                <button className="tap hit w-11 h-11 rounded-full bg-surface flex items-center justify-center text-muted shrink-0" aria-label={`Retirer ${exerciseOf(e.exerciseId).name}`} onClick={() => removeExercise(program.id, session.id, e.id)}><Icon name="trash" size={16} /></button>
              </div>
              <div className="flex items-center justify-between gap-2"><span className="text-[14px] font-semibold">{isTimed(e.exerciseId) ? 'Secondes' : 'Reps'}</span>
                <NumberInput value={e.repMin} min={1} max={isTimed(e.exerciseId) ? 300 : 60} width={48} onChange={(v) => v !== undefined && updateExercise(program.id, session.id, e.id, { repMin: v, repMax: v })} /></div>
              <div className="flex items-center justify-between gap-2"><span className="text-[14px] font-semibold">Poids (kg)</span>
                <NumberInput value={e.targetKg} min={0} max={600} step={2.5} width={48} onChange={(v) => updateExercise(program.id, session.id, e.id, { targetKg: v })} /></div>
            </div>
          ))}
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
  const { done: doneSets, total } = sessionProgress(session)
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
        <Cover seed={coverSeed(session)} sports={[tintOf(session)]} kind={session.kind} className="h-full">
          <div className="absolute inset-0 flex flex-col justify-end p-5 text-white" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 56px)' }}>
            <div className="flex items-center justify-between gap-2 mb-auto">
              <SportBadge sports={[session.sport]} label={freeRun ? 'Course libre' : session.extra ? 'Séance en plus' : session.kind === 'renfo' ? 'Renfo coureur' : isMuscu ? 'Musculation' : runKindLabel(session.kind)} />
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
          {session.warmup && <Card className="p-3.5 text-[14.5px] leading-snug flex gap-2.5"><span style={{ color: '#FFD60A' }}><Icon name="flame" size={18} /></span><span>{session.warmup}</span></Card>}
          {(session.exercises ?? []).map((e) => {
            const g = groupOf(session, e.id)
            if (!g) return <ExerciseCard key={e.id} program={program} session={session} e={e} locked={locked} />
            // un groupe s'affiche une seule fois, à la place de son premier exercice
            const first = (session.exercises ?? []).find((x) => g.exerciseIds.includes(x.id))
            return first?.id === e.id ? <GroupCard key={g.id} program={program} session={session} g={g} locked={locked} /> : null
          })}
          {!locked && <Button variant="tinted" color="var(--muscu)" full onClick={() => setPickAdd(true)}><Icon name="plus" size={18} strokeWidth={2.4} /> Ajouter un exercice</Button>}
          {!locked && session.status !== 'sautee' && (
            <div className="sticky z-20 -mx-4 px-4 pt-6 pb-1" style={{ bottom: 'var(--rest-h, 0px)', paddingBottom: 'calc(10px + env(safe-area-inset-bottom))', background: 'linear-gradient(to top, var(--bg) 62%, transparent)' }}>
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
      <AddExerciseSheet open={pickAdd} onClose={() => setPickAdd(false)}
        {...(libre ? { injuries: [], warn: program.q.injuries, customs: customExercisesOf(db, program.clientId), onCreateCustom: (name: string, muscle: Parameters<typeof addCustomExercise>[2]) => addCustomExercise(program.id, name, muscle) }
          : { injuries: program.q.injuries, excluded: program.q.excludedMuscles })}
        existing={(session.exercises ?? []).filter((e) => !groupOf(session, e.id)).map((e) => ({ id: e.id, label: exerciseOf(e.exerciseId).name }))}
        onAdd={(eid, fmt) => { addExercise(program.id, session.id, eid, fmt); toast('Exercice ajouté') }}
        onGroup={(kind: GroupKind, items: GroupItem[]) => {
          const ids = items.map((it) => ('existing' in it ? it.existing : addExercise(program.id, session.id, it.exerciseId)))
          createGroup(program.id, session.id, defaultGroup(kind, ids))
          toast('Groupe créé')
        }} />

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
