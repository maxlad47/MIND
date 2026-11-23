// Écrans du mode libre : « Mes séances » (séances modèles + planning), éditeurs en feuille, « Séance en plus ».
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { allSessions } from '@/engine/adapt'
import { exerciseOf } from '@/engine/exercises'
import {
  describePlanning, duplicateTemplate, newTemplate, newTemplateExercise, previewPlanning, templateMinutes, trainingDays,
} from '@/engine/libre'
import type { LibrePlanning, Program, SessionTemplate, TemplateExercise } from '@/engine/types'
import { DAY_NAMES, DAY_SHORT, prettyDate, todayISO, weekday } from '@/engine/utils'
import { addCustomExercise, addExtraSession, customExercisesOf, deleteTemplate, programOf, saveTemplate, setPlanning, useDB } from '@/lib/store'
import { Button, Card, Cover, EmptyState, Icon, NumberInput, Segmented, SectionTitle, Sheet, SportIcon, toast } from './kit'
import { ExercisePicker } from './parts'
import { GripHandle, SortableList } from './sortable'

const MUSCU = 'var(--muscu)'

function TemplateCover({ t, size = 56 }: { t: SessionTemplate; size?: number }) {
  return (
    <Cover seed={t.id} sports={['muscu']} scrim={false} className="rounded-[14px] shrink-0" style={{ width: size, height: size }}>
      <div className="absolute inset-0 flex items-center justify-center"><SportIcon sport="muscu" size={Math.round(size * 0.42)} color="#fff" /></div>
    </Cover>
  )
}

const restLabel = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
const summary = (e: TemplateExercise) => `${e.sets} × ${e.repMin === e.repMax ? e.repMin : `${e.repMin}–${e.repMax}`} · repos ${restLabel(e.restSec)}${e.rir !== undefined ? ` · RIR ${e.rir}` : ''}`

// ------------------------------------------------------------------ éditeur de séance modèle

function ExerciseRow({ e, handle, open, onToggle, onChange, onRemove }: {
  e: TemplateExercise; handle: Parameters<typeof GripHandle>[0]['handle']; open: boolean; onToggle: () => void; onChange: (p: Partial<TemplateExercise>) => void; onRemove: () => void
}) {
  const ex = exerciseOf(e.exerciseId)
  const field = (label: string, node: ReactNode) => <div className="flex items-center justify-between gap-3"><span className="font-semibold text-[15px]">{label}</span>{node}</div>
  return (
    <div className="bg-surface2 rounded-[18px]" data-exercise={e.exerciseId}>
      <div className="flex items-center pl-1 pr-1">
        <GripHandle handle={handle} label={`Réordonner ${ex.name}`} />
        <button onClick={onToggle} aria-expanded={open} className="tap flex-1 min-w-0 min-h-[56px] text-left flex items-center gap-2 pr-2">
          <div className="min-w-0 flex-1">
            <div className="font-bold text-[16px] leading-tight truncate">{ex.name}</div>
            <div className="text-[13px] text-muted num mt-0.5 truncate">{summary(e)}</div>
          </div>
          <span className="text-faint" style={{ transform: open ? 'rotate(90deg)' : undefined, transition: 'transform .2s' }}><Icon name="chevron" size={18} /></span>
        </button>
      </div>
      {open && (
        <div className="px-4 pb-4 pt-1 flex flex-col gap-3">
          {field('Séries', <NumberInput value={e.sets} min={1} max={10} width={48} onChange={(v) => v !== undefined && onChange({ sets: v })} />)}
          {field('Reps min', <NumberInput value={e.repMin} min={1} max={50} width={48} onChange={(v) => v !== undefined && onChange({ repMin: v, repMax: Math.max(e.repMax, v) })} />)}
          {field('Reps max', <NumberInput value={e.repMax} min={1} max={60} width={48} onChange={(v) => v !== undefined && onChange({ repMax: v, repMin: Math.min(e.repMin, v) })} />)}
          {field('Repos (s)', <NumberInput value={e.restSec} min={15} max={600} step={15} width={48} onChange={(v) => v !== undefined && onChange({ restSec: v })} />)}
          {field('RIR visé', (
            <span className="inline-flex items-center gap-2">
              {e.rir === undefined
                ? <button className="tap h-12 px-4 rounded-[14px] bg-surface text-[15px] font-semibold text-muted" onClick={() => onChange({ rir: 2 })}>Aucun · ajouter</button>
                : (<>
                  <NumberInput value={e.rir} min={0} max={5} width={48} onChange={(v) => onChange({ rir: v })} />
                  <button className="tap w-11 h-11 rounded-full bg-surface flex items-center justify-center text-muted" aria-label="Retirer le RIR visé" onClick={() => onChange({ rir: undefined })}><Icon name="x" size={16} strokeWidth={2.6} /></button>
                </>)}
            </span>
          ))}
          <input className="w-full h-11 rounded-[12px] bg-surface px-3 outline-none focus:ring-2 focus:ring-inset focus:ring-accent/60 text-[15px]" placeholder="Note (facultatif)" value={e.note ?? ''} aria-label="Note" onChange={(ev) => onChange({ note: ev.target.value || undefined })} />
          <Button full variant="danger" small onClick={onRemove}><Icon name="trash" size={16} /> Retirer de la séance</Button>
        </div>
      )}
    </div>
  )
}

export function TemplateEditor({ open, onClose, program, template }: { open: boolean; onClose: () => void; program: Program; template?: SessionTemplate }) {
  const db = useDB()
  const [draft, setDraft] = useState<SessionTemplate>(() => newTemplate())
  const [openId, setOpenId] = useState<string | null>(null)
  const [pick, setPick] = useState(false)
  useEffect(() => { if (open) { setDraft(structuredClone(template ?? newTemplate())); setOpenId(null) } }, [open])
  const customs = customExercisesOf(db, program.clientId)
  const set = (id: string, p: Partial<TemplateExercise>) => setDraft((d) => ({ ...d, exercises: d.exercises.map((e) => (e.id === id ? { ...e, ...p } : e)) }))
  const valid = draft.name.trim().length > 0 && draft.exercises.length > 0
  const save = () => {
    saveTemplate(program.id, { ...draft, name: draft.name.trim() })
    toast(template ? 'Séance enregistrée' : 'Séance créée')
    onClose()
  }
  return (
    <>
      <Sheet open={open} onClose={onClose} title={template ? 'Modifier la séance' : 'Nouvelle séance'} tall>
        <div className="flex flex-col gap-4">
          <input className="w-full h-14 rounded-[16px] bg-surface2 px-4 outline-none focus:ring-2 focus:ring-inset focus:ring-accent/60 text-[19px] font-bold" placeholder="Nom (ex. Push, Pull, Legs)" aria-label="Nom de la séance" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          {draft.exercises.length === 0
            ? <p className="text-muted text-[14.5px] leading-snug px-1">Ajoute les exercices de cette séance dans l'ordre où tu les fais. Tu pourras régler les séries, les reps et le repos de chacun.</p>
            : (
              <SortableList items={draft.exercises} onChange={(exercises) => setDraft({ ...draft, exercises })}>
                {(e, { handle }) => (
                  <ExerciseRow e={e} handle={handle} open={openId === e.id} onToggle={() => setOpenId(openId === e.id ? null : e.id)} onChange={(p) => set(e.id, p)}
                    onRemove={() => setDraft({ ...draft, exercises: draft.exercises.filter((x) => x.id !== e.id) })} />
                )}
              </SortableList>
            )}
          <Button variant="tinted" color={MUSCU} full onClick={() => setPick(true)}><Icon name="plus" size={18} strokeWidth={2.4} /> Ajouter un exercice</Button>
          <Button full disabled={!valid} onClick={save} color={MUSCU}>Enregistrer</Button>
          {!valid && <p className="text-[13px] text-muted text-center -mt-2">{draft.name.trim() ? 'Ajoute au moins un exercice.' : 'Donne un nom à ta séance.'}</p>}
          {template && (
            <div className="flex gap-2">
              <Button full variant="secondary" onClick={() => { saveTemplate(program.id, duplicateTemplate(draft)); toast('Séance dupliquée'); onClose() }}>Dupliquer</Button>
              <Button full variant="danger" onClick={() => { if (confirm(`Supprimer la séance « ${template.name} » ? Les séances futures prévues seront retirées, ton historique reste intact.`)) { deleteTemplate(program.id, template.id); toast('Séance supprimée'); onClose() } }}>Supprimer</Button>
            </div>
          )}
        </div>
      </Sheet>
      <ExercisePicker open={pick} onClose={() => setPick(false)} title="Ajouter un exercice" injuries={[]} warn={program.q.injuries} customs={customs}
        onCreateCustom={(name, muscle) => addCustomExercise(program.id, name, muscle)}
        onPick={(id) => { const e = newTemplateExercise(id); setDraft((d) => ({ ...d, exercises: [...d.exercises, e] })); setOpenId(e.id) }} />
    </>
  )
}

// ------------------------------------------------------------------ éditeur de planning

export function DayToggles({ days, onChange, color = MUSCU }: { days: number[]; onChange: (d: number[]) => void; color?: string }) {
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {DAY_SHORT.map((d, i) => {
        const on = days.includes(i)
        return (
          <button key={i} aria-label={DAY_NAMES[i]} aria-pressed={on} onClick={() => onChange(on ? days.filter((x) => x !== i) : [...days, i].sort())}
            className="tap aspect-[3/4] rounded-[16px] text-[19px] font-bold" style={{ background: on ? color : 'var(--surface2)', color: on ? '#fff' : 'var(--text)' }}>{d}</button>
        )
      })}
    </div>
  )
}

function fixedFrom(p: LibrePlanning, ids: string[]): Extract<LibrePlanning, { mode: 'fixe' }> {
  if (p.mode === 'fixe') return p
  const days: (string | null)[] = [null, null, null, null, null, null, null]
  const order = p.order.length ? p.order : ids
  trainingDays(p).forEach((d, i) => { days[d] = order.length ? order[i % order.length] : null })
  return { mode: 'fixe', days }
}
function rotationFrom(p: LibrePlanning, ids: string[]): Extract<LibrePlanning, { mode: 'rotation' }> {
  if (p.mode === 'rotation') return p
  const seen: string[] = []
  p.days.forEach((id) => { if (id && !seen.includes(id)) seen.push(id) })
  return { mode: 'rotation', days: trainingDays(p), order: [...seen, ...ids.filter((id) => !seen.includes(id))] }
}

export function PlanningEditor({ open, onClose, program }: { open: boolean; onClose: () => void; program: Program }) {
  const plan = program.libre!
  const ids = plan.templates.map((t) => t.id)
  const [draft, setDraft] = useState<LibrePlanning>(plan.planning)
  useEffect(() => { if (open) setDraft(structuredClone(plan.planning)) }, [open])
  const name = (id: string) => plan.templates.find((t) => t.id === id)?.name ?? '—'
  const preview = useMemo(() => (open ? previewPlanning(program, draft, todayISO(), 14) : []), [open, draft, program])
  const valid = draft.mode === 'fixe' || (draft.days.length > 0 && draft.order.length > 0)
  return (
    <Sheet open={open} onClose={onClose} title="Mon planning" tall>
      <div className="flex flex-col gap-4">
        <Segmented value={draft.mode} onChange={(m) => setDraft(m === 'fixe' ? fixedFrom(draft, ids) : rotationFrom(draft, ids))}
          options={[{ value: 'fixe', label: 'Jours fixes' }, { value: 'rotation', label: 'À la suite' }]} />
        <p className="text-[14px] text-muted leading-snug px-1">
          {draft.mode === 'fixe'
            ? 'Chaque jour de la semaine a sa séance, ou reste en repos. Une séance manquée reste simplement manquée.'
            : 'Coche tes jours d\'entraînement : MIND enchaîne tes séances A → B → C → A… Une séance manquée ne prend pas ton tour.'}
        </p>

        {draft.mode === 'fixe' ? (
          <div className="flex flex-col gap-2.5">
            {DAY_NAMES.map((dn, i) => {
              const cur = draft.days[i]
              const options: [string | null, string][] = [[null, 'Repos'], ...plan.templates.map((t) => [t.id, t.name] as [string, string])]
              return (
                <div key={i} className="bg-surface2 rounded-[18px] p-3">
                  <div className="font-bold capitalize mb-2 px-1">{dn}</div>
                  <div className="flex flex-wrap gap-2">
                    {options.map(([id, label]) => {
                      const on = cur === id
                      return <button key={id ?? 'repos'} aria-pressed={on} onClick={() => setDraft({ ...draft, days: draft.days.map((x, j) => (j === i ? id : x)) })}
                        className="tap min-h-[44px] px-4 rounded-full text-[15px] font-semibold" style={{ background: on ? (id ? MUSCU : 'var(--surface3)') : 'var(--surface)', color: on && id ? '#fff' : 'var(--text)' }}>{label}</button>
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <>
            <DayToggles days={draft.days} onChange={(days) => setDraft({ ...draft, days })} />
            <div className="text-[13px] uppercase tracking-wide text-muted font-medium px-1 -mb-1">Ordre des séances</div>
            <SortableList items={draft.order.map((id) => ({ id }))} onChange={(l) => setDraft({ ...draft, order: l.map((x) => x.id) })}>
              {(it, { handle, index }) => (
                <div className="bg-surface2 rounded-[16px] flex items-center pl-1 pr-1">
                  <GripHandle handle={handle} label={`Réordonner ${name(it.id)}`} />
                  <span className="w-7 h-7 rounded-full text-[13px] font-extrabold flex items-center justify-center text-white shrink-0" style={{ background: MUSCU }}>{index + 1}</span>
                  <span className="flex-1 min-w-0 truncate font-bold px-3">{name(it.id)}</span>
                  <button aria-label={`Retirer ${name(it.id)} de la rotation`} className="tap w-11 h-11 flex items-center justify-center text-muted" onClick={() => setDraft({ ...draft, order: draft.order.filter((x) => x !== it.id) })}><Icon name="x" size={17} strokeWidth={2.4} /></button>
                </div>
              )}
            </SortableList>
            {plan.templates.some((t) => !draft.order.includes(t.id)) && (
              <div className="flex flex-wrap gap-2">
                {plan.templates.filter((t) => !draft.order.includes(t.id)).map((t) => (
                  <button key={t.id} className="tap min-h-[44px] px-4 rounded-full text-[15px] font-semibold bg-surface2 flex items-center gap-1.5" onClick={() => setDraft({ ...draft, order: [...draft.order, t.id] })}><Icon name="plus" size={15} strokeWidth={2.6} /> {t.name}</button>
                ))}
              </div>
            )}
            <p className="text-[13.5px] text-muted px-1">{draft.days.length} séance{draft.days.length > 1 ? 's' : ''} par semaine.</p>
          </>
        )}

        {preview.length > 0 && (
          <div className="bg-surface2 rounded-[18px] p-3.5">
            <div className="text-[12px] uppercase tracking-wide text-muted font-semibold mb-2">Tes 2 prochaines semaines</div>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {preview.map((s) => <span key={s.date} className="text-[14px]"><span className="text-muted capitalize">{DAY_NAMES[weekday(s.date)].slice(0, 3)}. {Number(s.date.slice(8))}</span> <b>{name(s.templateId)}</b></span>)}
            </div>
          </div>
        )}
        <Button full disabled={!valid} color={MUSCU} onClick={() => { setPlanning(program.id, draft); toast('Planning enregistré'); onClose() }}>Enregistrer le planning</Button>
        {!valid && <p className="text-[13px] text-muted text-center -mt-2">Coche au moins un jour et garde au moins une séance dans la rotation.</p>}
      </div>
    </Sheet>
  )
}

// ------------------------------------------------------------------ « Mes séances »

export function FreeSessionsView({ clientId }: { clientId: string }) {
  const db = useDB()
  const program = programOf(db, clientId)
  const [editing, setEditing] = useState<SessionTemplate | 'new' | null>(null)
  const [planning, setPlanning_] = useState(false)
  const today = todayISO()
  const plan = program?.libre
  if (!program || !plan) return <EmptyState icon="program" title="Pas de séances" text="Ce compte n'est pas en mode libre." />

  const noPlanning = trainingDays(plan.planning).length === 0
  const next = (t: SessionTemplate) => allSessions(program).filter((s) => s.templateId === t.id && !s.extra && s.status === 'prevue' && s.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0]

  return (
    <div>
      {plan.templates.length === 0 ? (
        <div className="flex flex-col items-center text-center pt-1">
          <div className="w-[56px] h-[56px] rounded-[19px] flex items-center justify-center mb-3" style={{ background: 'linear-gradient(145deg, color-mix(in srgb, var(--muscu) 30%, transparent), color-mix(in srgb, var(--muscu) 10%, transparent))', color: MUSCU }}><Icon name="program" size={26} /></div>
          <div className="t-title3">Crée ta première séance</div>
          <p className="text-muted text-[14.5px] max-w-[290px] leading-snug mt-1.5">Ajoute les exercices de ta séance (ex. Push), puis règle ton planning. MIND te montre ce que tu as fait la dernière fois.</p>
          <div className="mt-4"><Button color={MUSCU} onClick={() => setEditing('new')}><Icon name="plus" size={18} strokeWidth={2.4} /> Créer ma première séance</Button></div>
          <div className="w-full bg-surface rounded-[18px] mt-5 text-left" style={{ boxShadow: 'var(--shadow-card)' }}>
            {[['1', 'Crée tes séances', 'Un nom, des exercices, des séries'], ['2', 'Règle ton planning', 'Jours fixes, ou à la suite (Push → Pull → Legs…)'], ['3', 'Entraîne-toi', 'Avec ta dernière performance sous les yeux']].map(([n, t, sub], i) => (
              <div key={n} className="flex items-center gap-3 px-3.5 py-2.5 relative">
                <div className="w-[26px] h-[26px] rounded-full flex items-center justify-center text-[13px] font-bold text-white shrink-0" style={{ background: MUSCU }}>{n}</div>
                <div className="min-w-0"><div className="font-semibold text-[15px] leading-tight">{t}</div><div className="text-[12.5px] text-muted leading-snug truncate">{sub}</div></div>
                {i < 2 && <span className="absolute bottom-0 right-0 h-px bg-sep" style={{ left: 54 }} />}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {noPlanning && (
            <Card className="p-4 mb-4" style={{ background: 'color-mix(in srgb, var(--muscu) 13%, var(--surface))', boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--muscu) 30%, transparent)' }}>
              <div className="flex gap-3"><span style={{ color: MUSCU }}><Icon name="calendar" /></span>
                <div className="flex-1"><div className="font-bold">Dernière étape : ton planning</div><p className="text-[14px] text-muted mt-0.5 leading-snug">Choisis les jours où tu t'entraînes pour que MIND place tes séances dans ta semaine.</p>
                  <div className="mt-3"><Button small color={MUSCU} onClick={() => setPlanning_(true)}>Régler mon planning</Button></div></div></div>
            </Card>
          )}
          <div className="flex flex-col gap-2.5">
            {plan.templates.map((t) => {
              const n = next(t)
              return (
                <Card key={t.id} onClick={() => setEditing(t)} className="p-3 flex items-center gap-3.5">
                  <TemplateCover t={t} size={64} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[18px] font-extrabold tracking-tight truncate">{t.name}</div>
                    <div className="text-[13px] text-muted mt-0.5">{t.exercises.length} exercice{t.exercises.length > 1 ? 's' : ''} · {templateMinutes(t)} min</div>
                    <div className="text-[12.5px] text-muted mt-0.5 truncate cap-first">{n ? `Prochaine : ${prettyDate(n.date)}` : 'Pas dans le planning'}</div>
                  </div>
                  <Icon name="chevron" size={18} color="var(--faint)" />
                </Card>
              )
            })}
          </div>
          <div className="mt-3"><Button full variant="tinted" color={MUSCU} onClick={() => setEditing('new')}><Icon name="plus" size={18} strokeWidth={2.4} /> Nouvelle séance</Button></div>

          <SectionTitle>Planning</SectionTitle>
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <span style={{ color: MUSCU }}><Icon name="calendar" /></span>
              <div className="flex-1 min-w-0"><div className="font-bold">{plan.planning.mode === 'fixe' ? 'Jours fixes' : 'À la suite'}</div><p className="text-[14px] text-muted mt-0.5 leading-snug">{describePlanning(plan)}</p></div>
            </div>
            <div className="mt-3"><Button small variant="secondary" onClick={() => setPlanning_(true)}>Modifier le planning</Button></div>
          </Card>
        </>
      )}
      <TemplateEditor open={editing !== null} onClose={() => setEditing(null)} program={program} template={editing && editing !== 'new' ? editing : undefined} />
      <PlanningEditor open={planning} onClose={() => setPlanning_(false)} program={program} />
    </div>
  )
}

// ------------------------------------------------------------------ « Séance en plus »

export function ExtraSessionSheet({ open, onClose, program }: { open: boolean; onClose: () => void; program: Program }) {
  const nav = useNavigate()
  const plan = program.libre
  if (!plan) return null
  const go = (src: Parameters<typeof addExtraSession>[1]) => {
    const id = addExtraSession(program.id, src)
    onClose()
    if (id) nav(`/session/${id}`)
  }
  return (
    <Sheet open={open} onClose={onClose} title="Séance en plus">
      <p className="text-[14px] text-muted mb-3 leading-snug">Une séance de plus aujourd'hui. Elle compte dans tes stats, mais ne décale pas ton planning.</p>
      <div className="flex flex-col gap-2">
        {plan.templates.map((t) => (
          <button key={t.id} className="tap flex items-center gap-3 bg-surface2 rounded-[18px] p-2.5 text-left min-h-[64px]" onClick={() => go({ templateId: t.id })}>
            <TemplateCover t={t} size={48} />
            <div className="min-w-0 flex-1"><div className="font-bold truncate">{t.name}</div><div className="text-[13px] text-muted">{t.exercises.length} exercice{t.exercises.length > 1 ? 's' : ''}</div></div>
          </button>
        ))}
        <button className="tap flex items-center gap-3 bg-surface2 rounded-[18px] px-4 text-left min-h-[56px]" onClick={() => go('vide')}><span style={{ color: MUSCU }}><Icon name="plus" size={20} strokeWidth={2.4} /></span><span className="font-bold">Séance vide</span><span className="text-[13px] text-muted">J'ajoute mes exercices</span></button>
        <button className="tap flex items-center gap-3 bg-surface2 rounded-[18px] px-4 text-left min-h-[56px]" onClick={() => go('course')}><SportIcon sport="course" size={20} /><span className="font-bold">Sortie de course</span><span className="text-[13px] text-muted">km, temps, ressenti</span></button>
      </div>
    </Sheet>
  )
}
