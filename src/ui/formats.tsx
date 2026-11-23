// Interface des formats de séance : sélecteur « Format », éditeur de séries (parties enchaînées), paramètres d'un groupe,
// feuille « Ajouter un exercice » (format ou groupe choisi avant les exercices). Partagée par la séance et l'éditeur de séances modèles.
import { useEffect, useState, type ReactNode } from 'react'
import { exerciseOf, isTimed } from '@/engine/exercises'
import {
  applyFormat, defaultGroup, FORMAT_DEFAULT_SETS, FORMAT_HINT, FORMAT_LABEL, FORMATS, GROUP_COLOR, GROUP_HINT, GROUP_KINDS, GROUP_LABEL, GROUP_SIZE,
  hasPlan, isRoundsKind, letterOf, nominalReps, plannedSetsOf, relativeKg, repRangeOf,
} from '@/engine/formats'
import type { GroupKind, GroupSpec, PlannedSet, SetFormat, SetPart, Zone, Muscle, Exercise } from '@/engine/types'
import { Button, Chip, Icon, NumberInput } from './kit'
import { ExercisePicker } from './parts'

// ------------------------------------------------------------------ séries : champs communs à SessionExercise et TemplateExercise

export interface PlanFields { exerciseId: string; sets: number; repMin: number; repMax: number; rir?: number; plan?: PlannedSet[]; format?: SetFormat }
export type PlanPatch = Partial<Pick<PlanFields, 'sets' | 'repMin' | 'repMax' | 'plan' | 'format'>>

/** Préremplit la structure d'un format. Le retour à « classique » retire le détail des séries. */
export function formatPatch(f: PlanFields, format: SetFormat): PlanPatch {
  const timed = isTimed(f.exerciseId)
  const base = f.plan?.length ? nominalReps(f.exerciseId) : { repMin: f.repMin, repMax: f.repMax }
  const r = applyFormat(format, { sets: format === 'classique' ? f.sets : FORMAT_DEFAULT_SETS[format], ...base, rir: f.rir }, timed)
  if (!r.plan) return { plan: undefined, format: undefined, sets: r.sets, repMin: r.repMin, repMax: r.repMax }
  return { plan: r.plan, format: r.format, sets: r.sets, repMin: r.repMin, repMax: r.repMax }
}

const FORMAT_COLOR = 'var(--muscu)'

/** Sélecteur « Format » (série lourde, dégressive, combo…). Masqué pour un exercice en durée. */
export function FormatChips({ value, onChange, exerciseId }: { value?: SetFormat; onChange: (f: SetFormat) => void; exerciseId: string }) {
  if (isTimed(exerciseId)) return null
  const cur = value ?? 'classique'
  return (
    <div data-testid="format-chips">
      <div className="flex items-center justify-between mb-1.5"><span className="font-semibold text-[15px]">Format</span></div>
      <div className="flex flex-wrap gap-2">
        {FORMATS.map((f) => <Chip key={f} color={FORMAT_COLOR} active={cur === f} onClick={() => onChange(f)}>{FORMAT_LABEL[f]}</Chip>)}
      </div>
      <p className="text-[13px] text-muted mt-1.5 leading-snug">{FORMAT_HINT[cur]}</p>
    </div>
  )
}

/** Petit champ numérique compact (une ligne de partie doit tenir sur un iPhone). */
function Mini({ value, onChange, label, suffix, placeholder, max = 999, step = 1 }: { value: number | undefined; onChange: (v: number | undefined) => void; label: string; suffix?: string; placeholder?: string; max?: number; step?: number }) {
  const [raw, setRaw] = useState(value === undefined ? '' : String(value).replace('.', ','))
  useEffect(() => { setRaw((r) => (Number(r.replace(',', '.')) === value || (r === '' && value === undefined) ? r : value === undefined ? '' : String(value).replace('.', ','))) }, [value])
  void step
  return (
    <label className="block min-w-0">
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-faint mb-0.5 text-center">{label}</span>
      <span className="flex items-center justify-center rounded-[12px] bg-surface px-1 focus-within:ring-2 focus-within:ring-inset focus-within:ring-accent/60">
        <input inputMode="decimal" aria-label={label} value={raw} placeholder={placeholder} className="w-full min-w-0 h-11 bg-transparent text-center outline-none num font-bold text-[16px]"
          onChange={(e) => {
            setRaw(e.target.value)
            const t = e.target.value.replace(',', '.')
            if (t === '') return onChange(undefined)
            const n = Number(t)
            if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(0, n)))
          }} />
        {suffix && <span className="text-[12px] text-muted pr-1">{suffix}</span>}
      </span>
    </label>
  )
}

export function PlanEditor({ value, onChange, refKg }: { value: PlanFields; onChange: (p: PlanPatch) => void; refKg?: number }) {
  const plan = plannedSetsOf(value)
  const timed = isTimed(value.exerciseId)
  const commit = (next: PlannedSet[]) => onChange({ plan: next, format: value.format ?? 'classique', sets: next.length, ...repRangeOf(next) })
  const setPart = (i: number, j: number, patch: Partial<SetPart>) => commit(plan.map((s, a) => (a !== i ? s : { parts: s.parts.map((p, b) => (b === j ? { ...p, ...patch } : p)) })))
  return (
    <div className="flex flex-col gap-2.5">
      {plan.map((set, i) => (
        <div key={i} className="rounded-[16px] bg-surface2 p-2.5" data-plan-set={i + 1}>
          <div className="flex items-center justify-between mb-1.5 pl-1">
            <span className="text-[13px] font-bold">Série {i + 1}{set.parts.length > 1 ? ` · ${set.parts.length} parties` : ''}</span>
            {plan.length > 1 && <button className="tap hit w-11 h-9 flex items-center justify-center text-muted" aria-label={`Retirer la série ${i + 1}`} onClick={() => commit(plan.filter((_, a) => a !== i))}><Icon name="trash" size={16} /></button>}
          </div>
          <div className="flex flex-col gap-2">
            {set.parts.map((p, j) => {
              const last = j === set.parts.length - 1
              return (
                <div key={j} className="grid items-end gap-1.5" style={{ gridTemplateColumns: 'repeat(4, minmax(0,1fr)) 40px' }}>
                  <Mini label={timed || p.seconds !== undefined ? 'Secondes' : 'Reps'} value={p.seconds ?? p.reps}
                    onChange={(v) => setPart(i, j, p.seconds !== undefined ? { seconds: v ?? 1 } : { reps: v ?? 1, ...(p.repMax !== undefined && (v ?? 1) > p.repMax ? { repMax: undefined } : {}) })} />
                  <Mini label="Poids kg" value={p.kg} placeholder={p.pct !== undefined && refKg ? String(relativeKg(refKg, p.pct)).replace('.', ',') : 'kg'} onChange={(v) => setPart(i, j, { kg: v })} />
                  <div className={p.kg !== undefined ? 'opacity-45' : ''}><Mini label="% lourde" value={p.pct} placeholder="—" onChange={(v) => setPart(i, j, { pct: v })} /></div>
                  {last ? <div className="h-11 flex items-end justify-center pb-3 text-[12px] text-faint text-center leading-none">fin</div>
                    : <Mini label="Repos s" value={p.restAfterSec ?? 0} onChange={(v) => setPart(i, j, { restAfterSec: v ?? 0 })} />}
                  {set.parts.length > 1
                    ? <button className="tap h-11 w-10 flex items-center justify-center text-muted" aria-label={`Retirer la partie ${j + 1}`} onClick={() => commit(plan.map((s, a) => (a !== i ? s : { parts: s.parts.filter((_, b) => b !== j) })))}><Icon name="x" size={15} strokeWidth={2.6} /></button>
                    : <span />}
                </div>
              )
            })}
          </div>
          <button className="tap w-full min-h-[44px] mt-1.5 rounded-[12px] text-[14px] font-semibold flex items-center justify-center gap-1.5" style={{ color: FORMAT_COLOR }}
            onClick={() => commit(plan.map((s, a) => (a !== i ? s : { parts: [...s.parts.slice(0, -1), { ...s.parts[s.parts.length - 1], restAfterSec: 0 }, { ...(timed ? { seconds: 20 } : { reps: 6 }), pct: 80 }] })))}>
            <Icon name="plus" size={15} strokeWidth={2.6} /> Partie enchaînée
          </button>
        </div>
      ))}
      <Button small variant="tinted" color={FORMAT_COLOR} onClick={() => commit([...plan, structuredClone(plan[plan.length - 1])])}><Icon name="plus" size={16} strokeWidth={2.6} /> Série</Button>
      <p className="text-[12.5px] text-muted leading-snug px-1"><b>Poids</b> : tape la charge de chaque partie (elle prime). Sans poids, <b>%</b> la calcule à partir de la partie lourde (100 % = la première partie de la série ; pour la première partie d'une série, celle de la première série). Repos <b>0</b> = enchaîné, sans pause.</p>
    </div>
  )
}

// ------------------------------------------------------------------ groupes

/** Cartouche d'un exercice de groupe : « Superset · A ». */
export function GroupTag({ kind, letter }: { kind: GroupKind; letter?: string }) {
  const c = GROUP_COLOR[kind]
  return <span className="inline-flex items-center h-5 rounded-full px-2 text-[11px] font-extrabold tracking-wide uppercase" style={{ background: `color-mix(in srgb, ${c} 20%, transparent)`, color: c }}>{GROUP_LABEL[kind]}{letter ? ` · ${letter}` : ''}</span>
}

/** Réglages d'un groupe : tours, repos entre exercices, repos entre tours, durée (EMOM, AMRAP). */
export function GroupParams({ spec, names, onChange, onUngroup }: { spec: GroupSpec; names: string[]; onChange: (p: Partial<GroupSpec>) => void; onUngroup: () => void }) {
  const c = GROUP_COLOR[spec.kind]
  const field = (label: string, node: ReactNode) => <div className="flex items-center justify-between gap-3"><span className="font-semibold text-[15px]">{label}</span>{node}</div>
  return (
    <div className="rounded-[16px] p-3 flex flex-col gap-3" style={{ background: `color-mix(in srgb, ${c} 10%, var(--surface))`, boxShadow: `inset 3px 0 0 ${c}` }}>
      <div className="flex items-center gap-2 flex-wrap"><GroupTag kind={spec.kind} /><span className="text-[13px] text-muted">{names.map((n, i) => `${letterOf(i)} ${n}`).join(' · ')}</span></div>
      {spec.kind !== 'emom' && spec.kind !== 'amrap' && field('Tours', <NumberInput value={spec.rounds} min={1} max={10} width={48} onChange={(v) => v !== undefined && onChange({ rounds: v })} />)}
      {isRoundsKind(spec.kind) && field('Repos entre exercices (s)', <NumberInput value={spec.restBetweenSec} min={0} max={180} step={5} width={48} onChange={(v) => v !== undefined && onChange({ restBetweenSec: v })} />)}
      {isRoundsKind(spec.kind) && field('Repos entre les tours (s)', <NumberInput value={spec.restAfterRoundSec} min={0} max={300} step={15} width={48} onChange={(v) => v !== undefined && onChange({ restAfterRoundSec: v })} />)}
      {(spec.kind === 'emom' || spec.kind === 'amrap') && field('Durée (min)', <NumberInput value={spec.durationMin} min={1} max={60} width={48} onChange={(v) => v !== undefined && onChange({ durationMin: v })} />)}
      <Button small variant="danger" onClick={onUngroup}>Dégrouper les exercices</Button>
    </div>
  )
}

// ------------------------------------------------------------------ « Ajouter un exercice » avec choix du format ou du groupe

const CREATE_LABEL: Record<GroupKind, string> = {
  superset: 'Créer le superset', triset: 'Créer le triset', circuit: 'Créer le circuit', emom: 'Créer l\'EMOM', amrap: 'Créer l\'AMRAP', chrono: 'Créer le chrono',
}

export type GroupItem = { existing: string } | { exerciseId: string }

/**
 * Feuille « Ajouter un exercice » : on choisit d'abord le format (série classique, pyramide, série lourde, dégressive, rest-pause, combo)
 * ou le groupe (superset, triset, circuit, EMOM, AMRAP, chrono), puis les exercices. Un exercice seul est ajouté d'un geste ;
 * un groupe se compose en touchant ses exercices (les exercices déjà dans la séance, ou de nouveaux).
 */
export function AddExerciseSheet({ open, onClose, title = 'Ajouter un exercice', onAdd, onGroup, existing = [], injuries, warn, customs, onCreateCustom, excluded }: {
  open: boolean; onClose: () => void; title?: string
  onAdd: (exerciseId: string, format: SetFormat) => void
  onGroup: (kind: GroupKind, items: GroupItem[]) => void
  /** Exercices de la séance qui ne sont pas encore dans un groupe. */
  existing?: { id: string; label: string }[]
  injuries: Zone[]; warn?: Zone[]; customs?: Exercise[]; onCreateCustom?: (name: string, muscle: Muscle) => string; excluded?: Muscle[]
}) {
  const [mode, setMode] = useState<SetFormat | GroupKind>('classique')
  const [sel, setSel] = useState<GroupItem[]>([])
  useEffect(() => { if (!open) { setMode('classique'); setSel([]) } }, [open])
  const isGroup = (GROUP_KINDS as string[]).includes(mode)
  const kind = mode as GroupKind
  const size = isGroup ? GROUP_SIZE[kind] : { min: 0, max: 0 }
  const labelOf = (it: GroupItem) => ('existing' in it ? existing.find((e) => e.id === it.existing)?.label ?? '?' : exerciseOf(it.exerciseId).name)
  const full = sel.length >= size.max
  const toggleExisting = (id: string) => setSel((l) => (l.some((x) => 'existing' in x && x.existing === id) ? l.filter((x) => !('existing' in x && x.existing === id)) : l.length >= size.max ? l : [...l, { existing: id }]))
  const header = (
    <div className="flex flex-col gap-2.5 mb-3">
      <div>
        <div className="text-[12px] font-semibold uppercase tracking-wide text-faint mb-1.5">Séries</div>
        <div className="flex flex-wrap gap-2">{FORMATS.map((f) => <Chip key={f} color={FORMAT_COLOR} active={mode === f} onClick={() => { setMode(f); setSel([]) }}>{FORMAT_LABEL[f]}</Chip>)}</div>
      </div>
      <div>
        <div className="text-[12px] font-semibold uppercase tracking-wide text-faint mb-1.5">Groupes d'exercices</div>
        <div className="flex flex-wrap gap-2">{GROUP_KINDS.map((k) => <Chip key={k} color={GROUP_COLOR[k]} active={mode === k} onClick={() => { setMode(k); setSel([]) }}>{GROUP_LABEL[k]}</Chip>)}</div>
      </div>
      <p className="text-[13px] text-muted leading-snug">{isGroup ? `${GROUP_HINT[kind]} ${size.min === size.max ? `Choisis ${size.min} exercices.` : `Choisis de ${size.min} à ${size.max} exercices.`}` : FORMAT_HINT[mode as SetFormat]}</p>
      {isGroup && existing.length > 0 && (
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-wide text-faint mb-1.5">Déjà dans la séance</div>
          <div className="flex flex-wrap gap-2">{existing.map((e) => <Chip key={e.id} color={GROUP_COLOR[kind]} active={sel.some((x) => 'existing' in x && x.existing === e.id)} onClick={() => toggleExisting(e.id)}>{e.label}</Chip>)}</div>
        </div>
      )}
    </div>
  )
  const footer = isGroup ? (
    <div className="sticky bottom-0 -mx-5 px-5 pt-3 pb-1 mt-3" style={{ background: 'linear-gradient(to top, var(--glass-strong) 70%, transparent)' }}>
      {sel.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {sel.map((it, i) => (
            <button key={i} className="tap h-9 rounded-full pl-3 pr-2 text-[13.5px] font-semibold inline-flex items-center gap-1" style={{ background: `color-mix(in srgb, ${GROUP_COLOR[kind]} 18%, transparent)`, color: GROUP_COLOR[kind] }}
              aria-label={`Retirer ${labelOf(it)}`} onClick={() => setSel((l) => l.filter((_, k) => k !== i))}>{letterOf(i)} · {labelOf(it)} <Icon name="x" size={13} strokeWidth={2.8} /></button>
          ))}
        </div>
      )}
      <Button full color={GROUP_COLOR[kind]} disabled={sel.length < size.min || sel.length > size.max} onClick={() => { onGroup(kind, sel); onClose() }}>
        {CREATE_LABEL[kind]} · {sel.length}{size.max === size.min ? `/${size.min}` : ''} exercice{sel.length > 1 ? 's' : ''}
      </Button>
    </div>
  ) : null
  return (
    <ExercisePicker open={open} onClose={onClose} title={title} injuries={injuries} warn={warn} customs={customs} onCreateCustom={onCreateCustom} excluded={excluded}
      header={header} footer={footer} keepOpen={isGroup}
      onPick={(id) => { if (isGroup) { if (!full) setSel((l) => [...l, { exerciseId: id }]) } else onAdd(id, mode as SetFormat) }} />
  )
}

export { defaultGroup, hasPlan }
