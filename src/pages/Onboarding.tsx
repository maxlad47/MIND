import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { DIST_KM, DIST_LABEL, PREP, assessTarget, pacesFromQuestionnaire, leadIn, phasePlan, predictRaceSeconds, prepWarnings, recommendedStartMode, referencesOf, startModeOf, volumeOutlook } from '@/engine/running'
import { estimateLiftsFromHistory } from '@/engine/libre'
import { KIT_LABEL } from '@/engine/renfo'
import { SPLIT_DESC, SPLIT_LABEL, isUpperOnly, recommendedSplit, splitOptions } from '@/engine/strength'
import { ZONES, type Goal, type Level, type Muscle, type Priority, type ProgramType, type Questionnaire, type RaceDistance, type RecentDistance, type RenfoKit, type RenfoSettings, type SplitKey, type Zone } from '@/engine/types'
import { DAY_NAMES, DAY_SHORT, diffDays, fmtPace, fmtTime, mondayOf, todayISO, addDays } from '@/engine/utils'
import { clientSessions, currentUser, programOf, questionnaireOf, saveDraft, submitQuestionnaire, useDB } from '@/lib/store'
import { personalizeInBackground } from '@/lib/ai'
import { Button, Cover, DurationInput, Field, Icon, inputCls, NumberInput, Segmented, SportIcon, springT, toast } from '@/ui/kit'

type Q = Partial<Questionnaire>

const DEFAULTS: Questionnaire = {
  firstName: '', birthDate: '', sex: 'homme', weightKg: 70, heightCm: 175, injuries: [], injuryNote: '', excludedMuscles: [],
  programType: 'muscu', muscuSessions: 3, runSessions: 3, availableDays: [0, 2, 4, 5], maxMinutes: 60, priority: 'equilibre',
  strength: { goal: 'hypertrophie', level: 'debutant', lifts: {} },
  run: { distance: '10k', raceDate: '', objective: 'finir', level: 'debutant', weeklyKm: 15, longestKm: 8 },
  startDate: '',
}

function Option({ active, title, sub, onClick, accent, icon }: { active: boolean; title: string; sub?: string; onClick: () => void; accent?: string; icon?: ReactNode }) {
  const c = accent ?? 'var(--accent)'
  return (
    <motion.button onClick={onClick} whileTap={{ scale: 0.98 }} transition={springT} aria-pressed={active} className="w-full text-left rounded-[20px] px-4 py-3.5 flex items-center gap-3.5 min-h-[64px]"
      style={{ background: active ? `color-mix(in srgb, ${c} 15%, var(--surface))` : 'var(--surface)', boxShadow: active ? `inset 0 0 0 2px ${c}` : 'inset 0 0 0 2px transparent', transition: 'background .2s, box-shadow .2s' }}>
      {icon && <span className="w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${c} 20%, transparent)` }}>{icon}</span>}
      <div className="flex-1 min-w-0">
        <div className="text-[18px] font-bold leading-tight tracking-tight">{title}</div>
        {sub && <div className="text-muted text-[14px] mt-0.5 leading-snug">{sub}</div>}
      </div>
      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors" style={{ background: active ? c : 'transparent', color: '#fff', boxShadow: active ? 'none' : 'inset 0 0 0 2px var(--faint)' }}>
        {active && <Icon name="check" size={15} strokeWidth={3.2} />}
      </div>
    </motion.button>
  )
}

function DayPicker({ days, color, onChange }: { days: number[]; color: string; onChange: (d: number[]) => void }) {
  return (
    <div className="grid grid-cols-7 gap-2">
      {DAY_SHORT.map((d, i) => {
        const on = days.includes(i)
        return <button key={i} aria-label={DAY_NAMES[i]} aria-pressed={on} onClick={() => onChange(on ? days.filter((x) => x !== i) : [...days, i].sort())}
          className="tap aspect-[3/4] rounded-[18px] text-[20px] font-bold" style={{ background: on ? color : 'var(--surface)', color: on ? '#fff' : 'var(--text)', boxShadow: on ? `0 8px 18px -8px ${color}` : undefined }}>{d}</button>
      })}
    </div>
  )
}

function Big({ children }: { children: ReactNode }) { return <div className="flex flex-col gap-3">{children}</div> }

interface Step {
  id: string
  title: string
  sub?: string
  when?: (q: Q) => boolean
  valid?: (q: Q) => boolean
  render: (q: Q, set: (p: Q) => void) => ReactNode
}

const BODY_GROUPS: { id: string; label: string; muscles: Muscle[] }[] = [
  { id: 'jambes', label: 'Jambes', muscles: ['quadriceps', 'ischios', 'fessiers', 'mollets'] },
  { id: 'pectoraux', label: 'Pectoraux', muscles: ['pectoraux'] },
  { id: 'dos', label: 'Dos', muscles: ['dos'] },
  { id: 'epaules', label: 'Épaules', muscles: ['epaules'] },
  { id: 'bras', label: 'Bras', muscles: ['biceps', 'triceps'] },
  { id: 'abdos', label: 'Abdominaux', muscles: ['abdos'] },
]

const EXPLAIN = `1) On part de ta VMA (donnée directement, ou déduite de tes chronos de référence).
2) Ton allure sur 10 km vaut environ 90 % de ta VMA ; pour les autres distances on utilise la formule de Riegel (T2 = T1 × (D2 / D1)^1,06).
3) Marge de progression jugée réaliste : 1,5 % + 0,4 % par semaine de préparation (entre 2 % et 8 %). Au-delà : « ambitieux » jusqu'à 1,4 fois cette marge, « très ambitieux » ensuite.
Tu gardes toujours le dernier mot : c'est une aide, pas un blocage.`

export default function Onboarding() {
  const db = useDB()
  const auth = currentUser(db)!
  const nav = useNavigate()
  const [params] = useSearchParams()
  const edit = params.get('edit') === '1'
  // Libre → MIND : le formulaire s'ouvre en mode génération, pré-rempli (charges de référence estimées d'après l'historique)
  const switching = params.get('switch') === 'genere'
  const targetId = params.get('client') ?? auth.id
  const me = db.profiles.find((p) => p.id === targetId) ?? auth
  const existing = questionnaireOf(db, me.id)

  const init = useMemo<Q>(() => {
    if (edit && existing && switching) {
      const lifts = { ...existing.strength.lifts, ...estimateLiftsFromHistory(clientSessions(db, me.id), todayISO()) }
      return { ...existing, mode: 'genere', strength: { ...existing.strength, lifts } }
    }
    if (edit && existing) return existing
    const d = db.drafts[me.id]
    return d ? d.data : { firstName: me.firstName }
  }, [])
  const [q, setQ] = useState<Q>(init)
  const [idx, setIdx] = useState(() => (edit ? 0 : db.drafts[me.id]?.step ?? 0))
  const [dir, setDir] = useState(1)
  const [busy, setBusy] = useState(false)
  const [refMode, setRefMode] = useState<'chrono' | 'allure'>('chrono')

  const merged = (x: Q): Questionnaire => ({
    ...DEFAULTS, ...x,
    strength: { ...DEFAULTS.strength, ...x.strength, lifts: { ...(x.strength?.lifts ?? {}) } },
    run: { ...DEFAULTS.run, ...x.run },
  })
  const m = merged(q)
  const set = (p: Q) => {
    const next = { ...q, ...p }
    setQ(next)
    if (!edit) saveDraft(me.id, { step: idx, data: next })
  }
  const setS = (p: Partial<Questionnaire['strength']>) => set({ strength: { ...m.strength, ...p } })
  const setR = (p: Partial<Questionnaire['run']>) => set({ run: { ...m.run, ...p } })

  const libre = m.mode === 'libre'
  /** Renfo coureur : désactivé pour un programme existant, proposé à 1 fois par semaine pour un nouveau programme. */
  const renfoOf = (x: Questionnaire): RenfoSettings => x.run.renfo ?? (edit ? { perWeek: 0, kit: 'nu' } : { perWeek: 1, kit: 'nu' })
  const hasM = m.programType !== 'course'
  const hasR = m.programType !== 'muscu'
  const today = todayISO()
  const raceWeeks = m.run.raceDate ? diffDays(mondayOf(today), mondayOf(m.run.raceDate)) / 7 + 1 : 0
  const raceWarn = hasR && m.run.raceDate ? prepWarnings({ ...m.run, objective: 'finir' }, raceWeeks, pacesFromQuestionnaire(m.run)) : []

  // jours par sport (anciens programmes : tous les jours disponibles) ; availableDays = union des deux
  const muscuDays = m.dayPrefs?.muscu ?? m.availableDays
  const runDays = m.dayPrefs?.run ?? m.availableDays
  const allDays = [...new Set([...(hasM ? muscuDays : []), ...(hasR ? runDays : [])])].sort()
  const setDays = (kind: 'muscu' | 'run', days: number[]) => {
    const prefs = { ...m.dayPrefs, muscu: muscuDays, run: runDays, [kind]: days }
    const union = [...new Set([...(hasM ? prefs.muscu : []), ...(hasR ? prefs.run : [])])].sort()
    if (prefs.longRun !== undefined && !prefs.run.includes(prefs.longRun)) prefs.longRun = undefined
    set({ dayPrefs: prefs, availableDays: union })
  }

  const steps: Step[] = [
    { id: 'mode', title: 'Comment veux-tu utiliser MIND ?', sub: 'Tu pourras changer d\'avis plus tard, sans perdre ton historique.', when: () => !edit,
      render: () => (
        <Big>
          <Option active={!libre} title="MIND me crée mon programme" sub="Quelques questions, puis MIND génère un programme de musculation et/ou de course adapté à toi." onClick={() => set({ mode: 'genere' })} icon={<Icon name="sparkle" size={24} />} />
          <Option active={libre} title="J'ai déjà mon programme" sub="Tu le suis déjà : MIND devient ton carnet. Tu crées tes séances, tu les places dans ta semaine et tu notes tes charges." onClick={() => set({ mode: 'libre' })} icon={<Icon name="edit" size={22} />} accent="var(--muscu)" />
        </Big>) },
    { id: 'name', title: 'Comment t\'appelles-tu ?', sub: 'Juste ton prénom.', valid: (x) => !!x.firstName?.trim(),
      render: (x) => <input autoFocus className={`${inputCls} text-[22px] h-16`} placeholder="Prénom" value={x.firstName ?? ''} onChange={(e) => set({ firstName: e.target.value })} /> },
    { id: 'birth', title: 'Ta date de naissance et ton sexe', sub: 'Pour adapter les repères de ton programme.', valid: (x) => !!x.birthDate,
      render: (x) => (
        <div className="flex flex-col gap-4">
          <Field label="Date de naissance"><input type="date" className={inputCls} value={x.birthDate ?? ''} max={today} onChange={(e) => set({ birthDate: e.target.value })} /></Field>
          <Big>{(['homme', 'femme', 'autre'] as const).map((s) => <Option key={s} active={(x.sex ?? 'homme') === s} title={s[0].toUpperCase() + s.slice(1)} onClick={() => set({ sex: s })} />)}</Big>
        </div>) },
    { id: 'body', title: 'Poids et taille',
      render: () => (
        <div className="flex flex-col gap-6 items-center pt-4">
          <Field label="Poids"><NumberInput value={m.weightKg} onChange={(v) => set({ weightKg: v ?? 70 })} min={30} max={250} step={0.5} suffix="kg" /></Field>
          <Field label="Taille"><NumberInput value={m.heightCm} onChange={(v) => set({ heightCm: v ?? 175 })} min={120} max={230} suffix="cm" /></Field>
        </div>) },
    { id: 'injuries', title: 'Des blessures ou limitations ?', sub: 'Choisis les zones concernées : les exercices contre-indiqués seront exclus ou remplacés automatiquement.',
      render: (x) => (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {ZONES.map((z) => {
              const on = (x.injuries ?? []).includes(z.id)
              return <button key={z.id} onClick={() => set({ injuries: on ? (x.injuries ?? []).filter((i) => i !== z.id) : [...(x.injuries ?? []), z.id as Zone] })}
                className="tap rounded-full h-11 px-4 text-[16px] font-semibold" aria-pressed={on} style={{ background: on ? 'var(--accent)' : 'var(--surface)', color: on ? '#fff' : 'var(--text)' }}>{z.label}</button>
            })}
          </div>
          <textarea className={`${inputCls} h-24 py-3`} placeholder="Autre précision (facultatif)" value={x.injuryNote ?? ''} onChange={(e) => set({ injuryNote: e.target.value })} />
          <p className="text-[13px] text-muted bg-surface rounded-xl p-3">En cas de doute sur ta santé, consulte un médecin avant de commencer. MIND ne remplace pas un avis médical.</p>
        </div>) },
    { id: 'librerun', title: 'Un plan de course avec MIND ?', sub: 'Tes séances de muscu restent libres. MIND peut en plus te générer un plan de course (10 km, semi ou marathon) qui s\'adapte à toi.', when: () => libre,
      render: () => (
        <Big>
          <Option active={m.programType === 'muscu'} title="Non, juste mes séances libres" sub="Tu peux quand même noter une sortie de course quand tu veux (km, temps, ressenti)." onClick={() => set({ programType: 'muscu' })} icon={<SportIcon sport="muscu" size={24} />} accent="var(--muscu)" />
          <Option active={m.programType !== 'muscu'} title="Oui, un plan de course MIND" sub="MIND génère et adapte ton plan de course. Ta muscu reste 100 % libre : MIND n'y touche jamais." onClick={() => set({ programType: 'mixte' })} icon={<SportIcon sport="course" size={24} />} accent="#FF9F0A" />
        </Big>) },
    { id: 'excl', title: 'Une partie du corps à ne pas travailler ?', sub: 'Facultatif. Aucun exercice ne la ciblera.', when: () => hasM,
      render: () => {
        const ex = m.excludedMuscles ?? []
        return (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {BODY_GROUPS.map((g) => {
                const on = g.muscles.every((x) => ex.includes(x))
                return <button key={g.id} onClick={() => set({ excludedMuscles: on ? ex.filter((x) => !g.muscles.includes(x)) : [...new Set([...ex, ...g.muscles])] })}
                  className="tap rounded-full h-11 px-4 text-[16px] font-semibold" aria-pressed={on} style={{ background: on ? 'var(--muscu)' : 'var(--surface)', color: on ? '#fff' : 'var(--text)' }}>{on ? '✕ ' : ''}{g.label}</button>
              })}
            </div>
            <p className="text-[13px] text-muted bg-surface rounded-xl p-3">{ex.length ? 'Les séances seront construites sans ces muscles. Sans jambes, tu auras des séances Push, Pull et Full body, et jamais de « bas du corps ».' : 'Par exemple : ne pas travailler les jambes. Tu peux passer cette étape.'}</p>
          </div>)
      } },
    { id: 'type', title: 'Quel programme veux-tu ?',
      render: (x) => (
        <Big>
          {([['muscu', 'Musculation', 'Hypertrophie, force ou mixte', 'var(--muscu)'], ['course', 'Course à pied', '10 km, semi ou marathon', '#FF9F0A'], ['mixte', 'Musculation + course', 'Les deux, sans conflit entre eux', 'var(--accent)']] as [ProgramType, string, string, string][]).map(([v, t, s, c]) =>
            <Option key={v} accent={c} active={(x.programType ?? 'muscu') === v} title={t} sub={s} onClick={() => set({ programType: v })}
              icon={v === 'mixte' ? <span className="flex gap-0.5"><SportIcon sport="muscu" size={19} /><SportIcon sport="course" size={19} /></span> : <SportIcon sport={v} size={24} />} />)}
        </Big>) },
    { id: 'msess', title: 'Combien de séances de musculation par semaine ?', when: () => hasM,
      render: () => (
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((n) => <button key={n} onClick={() => set({ muscuSessions: n })} className="tap h-24 rounded-[22px] text-[36px] font-extrabold num"
            style={{ background: m.muscuSessions === n ? 'color-mix(in srgb, var(--muscu) 18%, var(--surface))' : 'var(--surface)', boxShadow: `inset 0 0 0 2px ${m.muscuSessions === n ? 'var(--muscu)' : 'transparent'}`, color: m.muscuSessions === n ? 'var(--muscu)' : undefined }}>{n}</button>)}
        </div>) },
    { id: 'rsess', title: 'Combien de séances maximum par semaine sur ta préparation ?', sub: 'C\'est un plafond : MIND monte progressivement, tu n\'atteins ce nombre que quand ton volume le permet.', when: () => hasR,
      render: () => (
        <div className="grid grid-cols-3 gap-3">
          {[2, 3, 4, 5, 6].map((n) => <button key={n} onClick={() => set({ runSessions: n })} className="tap h-24 rounded-[22px] text-[36px] font-extrabold num"
            style={{ background: m.runSessions === n ? 'color-mix(in srgb, #FF9F0A 18%, var(--surface))' : 'var(--surface)', boxShadow: `inset 0 0 0 2px ${m.runSessions === n ? '#FF9F0A' : 'transparent'}`, color: m.runSessions === n ? '#FF9F0A' : undefined }}>{n}</button>)}
        </div>) },
    { id: 'mdays', title: 'Quels jours pour la musculation ?', sub: 'MIND place tes séances de muscu uniquement sur ces jours.', when: () => hasM,
      valid: () => muscuDays.length > 0,
      render: () => (
        <div className="flex flex-col gap-4">
          <DayPicker days={muscuDays} color="var(--muscu)" onChange={(d) => setDays('muscu', d)} />
          <p className="text-[14px] text-muted px-1">{m.muscuSessions} séance{m.muscuSessions > 1 ? 's' : ''} de muscu par semaine sur {muscuDays.length} jour{muscuDays.length > 1 ? 's' : ''}.
            {m.muscuSessions > muscuDays.length ? ' Choisis-en davantage pour éviter deux séances de muscu le même jour.' : ''}</p>
        </div>) },
    { id: 'rdays', title: 'Quels jours pour la course ?', sub: libre ? 'MIND place tes sorties de course sur ces jours. Évite tes jours de muscu si tu veux séparer les deux.' : 'MIND place tes sorties de course uniquement sur ces jours.', when: () => hasR,
      valid: () => runDays.length > 0,
      render: () => (
        <div className="flex flex-col gap-4">
          <DayPicker days={runDays} color="#FF9F0A" onChange={(d) => setDays('run', d)} />
          <p className="text-[14px] text-muted px-1">{m.runSessions} sortie{m.runSessions > 1 ? 's' : ''} par semaine sur {runDays.length} jour{runDays.length > 1 ? 's' : ''}.
            {m.runSessions > runDays.length ? ' Choisis-en davantage pour éviter deux sorties le même jour.' : ''}
            {m.runSessions >= 3 && runDays.length < m.runSessions + 2 ? ' Garde un jour d\'écart entre une endurance et ta sortie longue : avec peu de jours, elles risquent de se suivre.' : ''}
            {hasM && hasR && (m.muscuSessions + m.runSessions) > allDays.length ? ' Certains jours auront deux séances (course le matin, muscu le soir).' : ''}</p>
        </div>) },
    { id: 'longday', title: 'Quel jour pour ta sortie longue ?', sub: 'La plus longue sortie de la semaine, toujours placée ce jour-là. Les autres séances s\'organisent autour.', when: () => hasR && m.runSessions >= 2,
      render: () => (
        <Big>
          {runDays.map((d) => <Option key={d} accent="#FF9F0A" active={m.dayPrefs?.longRun === d} title={DAY_NAMES[d][0].toUpperCase() + DAY_NAMES[d].slice(1)} onClick={() => set({ dayPrefs: { ...m.dayPrefs, longRun: d } })} />)}
          <Option accent="#FF9F0A" active={m.dayPrefs?.longRun === undefined} title="Peu importe" sub="MIND choisit le meilleur jour" onClick={() => set({ dayPrefs: { ...m.dayPrefs, longRun: undefined } })} />
        </Big>) },
    { id: 'dur', title: 'Durée maximale par séance',
      render: () => <Big>{([45, 60, 75, 90] as const).map((n) => <Option key={n} active={m.maxMinutes === n} title={`${n} minutes`} onClick={() => set({ maxMinutes: n })} />)}</Big> },
    { id: 'prio', title: 'Quelle est ta priorité ?', sub: 'Elle règle les volumes de chaque sport.', when: () => m.programType === 'mixte',
      render: () => (
        <Big>
          {([['course', 'Course', 'Jambes en muscu réduites, course d\'abord'], ['muscu', 'Musculation', 'Course au minimum utile'], ['equilibre', 'Équilibré', 'Un compromis entre les deux']] as [Priority, string, string][]).map(([v, t, s]) =>
            <Option key={v} active={m.priority === v} title={t} sub={s} onClick={() => set({ priority: v })} />)}
        </Big>) },
    { id: 'goal', title: 'Ton objectif en musculation', when: () => hasM,
      render: () => (
        <Big>
          {([['hypertrophie', 'Hypertrophie', 'Prendre du muscle'], ['force', 'Force', 'Soulever plus lourd'], ['mixte', 'Mixte (powerbuilding)', 'Force + volume']] as [Goal, string, string][]).map(([v, t, s]) =>
            <Option key={v} accent="var(--muscu)" active={m.strength.goal === v} title={t} sub={s} onClick={() => setS({ goal: v })} />)}
        </Big>) },
    { id: 'mlevel', title: 'Ton niveau en musculation', when: () => hasM,
      render: () => (
        <Big>
          {([['debutant', 'Débutant', 'Moins d\'un an'], ['intermediaire', 'Intermédiaire', '1 à 3 ans'], ['avance', 'Avancé', 'Plus de 3 ans']] as [Level, string, string][]).map(([v, t, s]) =>
            <Option key={v} accent="var(--muscu)" active={m.strength.level === v} title={t} sub={s} onClick={() => setS({ level: v })} />)}
        </Big>) },
    { id: 'lifts', title: 'Tes charges récentes', sub: 'Facultatif : poids × répétitions. MIND en déduit ton 1RM estimé pour proposer les premières charges.', when: () => hasM,
      render: () => (
        <div className="flex flex-col gap-3">
          {([['squat', 'Squat'], ['bench', 'Développé couché'], ['deadlift', 'Soulevé de terre'], ['press', 'Développé militaire']] as const).map(([k, label]) => {
            const l = m.strength.lifts[k]
            return (
              <div key={k} className="bg-surface rounded-2xl p-3 flex items-center gap-2">
                <div className="flex-1 font-semibold">{label}</div>
                <input className="w-20 h-11 rounded-xl bg-surface2 text-center num" inputMode="decimal" placeholder="kg" value={l?.kg ?? ''} onChange={(e) => { const kg = Number(e.target.value.replace(',', '.')); setS({ lifts: { ...m.strength.lifts, [k]: e.target.value === '' ? undefined : { kg, reps: l?.reps ?? 5 } } }) }} />
                <span className="text-muted">×</span>
                <input className="w-16 h-11 rounded-xl bg-surface2 text-center num" inputMode="numeric" placeholder="reps" value={l?.reps ?? ''} onChange={(e) => { const reps = Number(e.target.value); if (l) setS({ lifts: { ...m.strength.lifts, [k]: { kg: l.kg, reps } } }) }} />
              </div>)
          })}
        </div>) },
    { id: 'split', title: 'Ta formule d\'entraînement', sub: 'Choisis comment répartir tes séances. On te propose le plus adapté à ta fréquence.', when: () => hasM,
      render: () => {
        const upper = isUpperOnly(m.excludedMuscles)
        const opts = splitOptions(m.muscuSessions, upper)
        const rec = recommendedSplit(m.muscuSessions, m.strength.level, upper)
        const cur = m.strength.split && opts.includes(m.strength.split) ? m.strength.split : rec
        return <Big>{opts.map((s: SplitKey) => <Option key={s} accent="var(--muscu)" active={cur === s} title={SPLIT_LABEL[s]} sub={`${SPLIT_DESC[s]}${s === rec ? ' · recommandé' : ''}`} onClick={() => setS({ split: s })} />)}
          <p className="text-[13px] text-muted px-1 pt-2">{upper ? 'Sans jambes, aucune séance « bas du corps » : seules les formules haut du corps sont proposées.' : 'Matériel supposé : salle de sport complète.'}</p></Big>
      } },
    { id: 'dist', title: 'Quelle distance prépares-tu ?', when: () => hasR,
      render: () => (
        <Big>
          {(['10k', 'semi', 'marathon'] as RaceDistance[]).map((v) => <Option key={v} accent="#FF9F0A" active={m.run.distance === v} title={DIST_LABEL[v]} sub={`Préparation idéale : ${PREP[v].idealMin}–${PREP[v].idealMax} semaines`} onClick={() => setR({ distance: v })} />)}
        </Big>) },
    { id: 'date', title: 'Quelle est la date de ta course ?', when: () => hasR, valid: (x) => !!x.run?.raceDate && x.run.raceDate > today,
      render: () => (
        <div className="flex flex-col gap-4">
          <input type="date" className={`${inputCls} h-14`} min={addDays(today, 7)} value={m.run.raceDate} onChange={(e) => setR({ raceDate: e.target.value })} />
          {m.run.raceDate && m.run.raceDate > today && (
            <div className="rounded-2xl p-4 bg-surface">
              <div className="text-[28px] font-extrabold">{raceWeeks} semaine{raceWeeks > 1 ? 's' : ''}</div>
              <div className="text-muted text-[14px]">de préparation · minimum conseillé {PREP[m.run.distance].min}, idéal {PREP[m.run.distance].idealMin}–{PREP[m.run.distance].idealMax}</div>
              {raceWarn.map((w) => <p key={w.code} className="mt-2 text-[14px]" style={{ color: w.code === 'prepa_trop_courte' ? '#FF9F0A' : 'var(--muted)' }}>{w.message} {w.suggestion}</p>)}
            </div>)}
        </div>) },
    { id: 'rlevel', title: 'Ton niveau en course', sub: 'Et ta VMA si tu la connais (facultatif).', when: () => hasR,
      render: () => (
        <div className="flex flex-col gap-3">
          {([['debutant', 'Débutant'], ['intermediaire', 'Intermédiaire'], ['avance', 'Avancé']] as [Level, string][]).map(([v, t]) =>
            <Option key={v} accent="#FF9F0A" active={m.run.level === v} title={t} onClick={() => setR({ level: v })} />)}
          <Field label="VMA connue (km/h)"><NumberInput value={m.run.vma} onChange={(v) => setR({ vma: v })} min={8} max={25} step={0.5} suffix="km/h" /></Field>
        </div>) },
    { id: 'refs', title: 'Tes chronos de référence', sub: 'Renseigne ceux que tu connais (5 km, 10 km…). Ils servent à calculer tes allures et à juger ton objectif.', when: () => hasR,
      render: () => {
        const refs = referencesOf(m.run)
        const paces = pacesFromQuestionnaire(m.run)
        const dists: { id: RecentDistance; label: string }[] = [{ id: '5k', label: '5 km' }, { id: '10k', label: '10 km' }, { id: 'semi', label: 'Semi-marathon' }, { id: 'marathon', label: 'Marathon' }]
        const setRef = (d: RecentDistance, seconds: number | undefined) => {
          const rest = refs.filter((r) => r.distance !== d)
          setR({ recents: seconds ? [...rest, { distance: d, seconds, date: today }] : rest, recent: undefined })
        }
        return (
          <div className="flex flex-col gap-3">
            <Segmented value={refMode} onChange={setRefMode} options={[{ value: 'chrono', label: 'Je connais mes chronos' }, { value: 'allure', label: 'Je connais mon allure' }]} />
            {dists.map((d) => {
              const v = refs.find((r) => r.distance === d.id)?.seconds
              const km = DIST_KM[d.id]
              return (
                <div key={d.id} className="bg-surface rounded-2xl p-3.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-[16px] leading-tight">{d.label}</div>
                    <div className="text-[12.5px] text-muted num mt-0.5">{v ? (refMode === 'chrono' ? `${fmtPace(v / km)} /km` : fmtTime(v)) : (refMode === 'chrono' ? 'chrono' : 'allure /km')}</div>
                  </div>
                  {refMode === 'chrono'
                    ? <DurationInput value={v} onChange={(x) => setRef(d.id, x)} compact />
                    : <DurationInput hours={false} value={v ? Math.round(v / km) : undefined} onChange={(x) => setRef(d.id, x ? x * km : undefined)} compact />}
                </div>)
            })}
            {paces.source !== 'niveau' && (
              <div className="rounded-2xl p-4" style={{ background: 'color-mix(in srgb, #FF9F0A 14%, var(--surface))' }}>
                <div className="text-[13px] text-muted">Estimation à partir de {paces.source === 'vma' ? 'ta VMA' : 'tes chronos'}</div>
                <div className="text-[19px] font-extrabold">VMA {String(paces.vma).replace('.', ',')} km/h · 10 km à {fmtPace(paces.dix)}/km</div>
              </div>)}
          </div>)
      } },
    { id: 'obj', title: 'Ton objectif de course', when: () => hasR,
      valid: (x) => (x.run?.objective ?? 'finir') === 'finir' || !!x.run?.targetSeconds,
      render: () => {
        const paces = pacesFromQuestionnaire(m.run)
        const est = predictRaceSeconds(paces.vma, m.run.distance)
        const a = m.run.objective === 'chrono' ? assessTarget(m.run, Math.max(1, raceWeeks), paces) : null
        const col = a?.verdict === 'realiste' ? '#30D158' : a?.verdict === 'ambitieux' ? '#FF9F0A' : '#FF453A'
        const lab = a?.verdict === 'realiste' ? 'Réaliste' : a?.verdict === 'ambitieux' ? 'Ambitieux mais jouable' : 'Très ambitieux'
        const pct = (n: number) => `${(n * 100).toFixed(1).replace('.', ',')} %`
        return (
          <div className="flex flex-col gap-3">
            <Option accent="#FF9F0A" active={m.run.objective === 'finir'} title="Finir" sub="Aller au bout dans de bonnes conditions" onClick={() => setR({ objective: 'finir' })} />
            <Option accent="#FF9F0A" active={m.run.objective === 'chrono'} title="Chrono cible" sub="Viser un temps précis" onClick={() => setR({ objective: 'chrono' })} />
            {m.run.objective === 'chrono' && (<>
              <Field label="Temps visé"><DurationInput value={m.run.targetSeconds} onChange={(v) => setR({ targetSeconds: v })} /></Field>
              <div className="bg-surface rounded-2xl p-4 flex flex-col gap-2">
                <div className="text-[13px] text-muted">Ton chrono estimé aujourd'hui sur {DIST_LABEL[m.run.distance].toLowerCase()}</div>
                <div className="text-[26px] font-extrabold num">{fmtTime(est)} <span className="text-[15px] text-muted font-semibold">· {fmtPace(est / DIST_KM[m.run.distance])}/km</span></div>
                <div className="text-[13px] text-muted">Calculé à partir de {a?.basisText ?? (paces.source === 'niveau' ? 'ton niveau déclaré (aucun chrono ni VMA renseigné : estimation peu fiable)' : 'tes données')}.</div>
                {paces.source === 'niveau' && <p className="text-[14px]" style={{ color: '#FF9F0A' }}>Sans chrono de référence, on ne peut pas dire si ton objectif est réaliste. Reviens à l'étape précédente pour renseigner un 5 km ou un 10 km, ou la séance test de la semaine 1 calculera tes vraies allures.</p>}
                {a && paces.source !== 'niveau' && (
                  <div className="flex flex-col gap-2 pt-1">
                    <span className="self-start rounded-full px-3 h-7 inline-flex items-center text-[13px] font-bold text-white" style={{ background: col }}>{lab}</span>
                    <div className="text-[14px]">{a.gain > 0 ? `Il faut gagner ${pct(a.gain)}` : `Objectif plus lent que ton niveau actuel (${pct(-a.gain)})`} en {Math.max(1, raceWeeks)} semaines. Marge réaliste : {pct(a.allowed)}.</div>
                    {a.verdict !== 'realiste' && <Button small variant="secondary" onClick={() => setR({ targetSeconds: a.realistic })}>Utiliser {fmtTime(a.realistic)} (réaliste)</Button>}
                  </div>)}
                <details className="text-[13px] text-muted mt-1"><summary className="cursor-pointer font-semibold">Comment c'est calculé ?</summary><p className="mt-2 whitespace-pre-line">{EXPLAIN}</p></details>
              </div>
            </>)}
          </div>)
      } },
    { id: 'vol', title: 'Ton volume actuel en course', sub: 'Sur les 4 dernières semaines.', when: () => hasR,
      render: () => (
        <div className="flex flex-col gap-6 items-center pt-4">
          <Field label="Kilomètres par semaine"><NumberInput value={m.run.weeklyKm} onChange={(v) => setR({ weeklyKm: v ?? 0 })} max={200} suffix="km" /></Field>
          <Field label="Sortie la plus longue"><NumberInput value={m.run.longestKm} onChange={(v) => setR({ longestKm: v ?? 0 })} max={60} step={0.5} suffix="km" /></Field>
        </div>) },
    { id: 'startmode', title: 'Comment veux-tu démarrer ?', sub: 'Si tu reprends la course ou que tu débutes, mieux vaut y aller par étapes.', when: () => hasR,
      render: () => {
        const rec = recommendedStartMode(m.run)
        const cur = startModeOf(m.run)
        const lead = leadIn({ ...m.run, startMode: 'progressif' }, Math.max(1, raceWeeks))
        return (
          <Big>
            <Option accent="#FF9F0A" active={cur === 'progressif'} title="Progressivement" sub={`Beaucoup d'endurance au début, puis on intègre peu à peu les côtes, le fractionné, la VMA et le seuil${lead.weeks ? ` (${lead.weeks} semaines d'introduction)` : ''}.${rec === 'progressif' ? ' · conseillé pour toi' : ''}`} onClick={() => setR({ startMode: 'progressif' })} />
            <Option accent="#FF9F0A" active={cur === 'direct'} title="Tout de suite" sub={`Je cours régulièrement : on intègre le travail de qualité dès les premières semaines.${rec === 'direct' ? ' · conseillé pour toi' : ''}`} onClick={() => setR({ startMode: 'direct' })} />
          </Big>)
      } },
    { id: 'peak', title: 'Ton volume de course au pic', sub: 'La semaine la plus chargée, juste avant l\'affûtage. MIND calcule ce qui est raisonnable pour toi : tu peux le modifier si besoin.', when: () => hasR,
      render: () => {
        const weeks = Math.max(1, raceWeeks)
        const phases = phasePlan(m.run.distance, weeks, leadIn(m.run, weeks).weeks)
        const pf = m.programType === 'mixte' && m.priority === 'muscu' ? 0.75 : 1
        const rec = volumeOutlook({ ...m.run, peakKm: undefined }, phases, m.runSessions, pf)
        const custom = m.run.peakKm !== undefined
        const o = custom ? volumeOutlook(m.run, phases, m.runSessions, pf) : rec
        const f = (x: number) => String(Math.round(x))
        const pct = ((rec.rate - 1) * 100).toFixed(0)
        return (
          <div className="flex flex-col gap-4 pt-2">
            <div className="rounded-2xl p-5" style={{ background: 'color-mix(in srgb, #FF9F0A 14%, var(--surface))' }}>
              <div className="text-[13px] text-muted font-semibold uppercase tracking-wide">L'avis de MIND</div>
              <div className="text-[34px] font-extrabold num leading-tight mt-1">{f(rec.target)} km <span className="text-[17px] text-muted font-semibold">par semaine au pic</span></div>
              <p className="text-[14.5px] mt-2 leading-snug">
                {rec.target > rec.from + 0.5
                  ? `Tu cours ${f(rec.from)} km par semaine aujourd'hui. En ${weeks} semaines, tu peux monter jusqu'à ${f(rec.target)} km (environ +${pct} % par semaine de charge, avec une semaine allégée toutes les 4 semaines) sans t'exposer à la blessure.`
                  : `Tu cours déjà ${f(rec.from)} km par semaine : on garde ce volume et on travaille la qualité, avec une semaine allégée toutes les 4 semaines.`}
              </p>
              {!custom && <div className="mt-3"><Button small variant="secondary" onClick={() => setR({ peakKm: Math.round(rec.target) })}>Personnaliser</Button></div>}
            </div>
            {custom && (
              <div className="bg-surface rounded-2xl p-4 flex flex-col gap-3 items-center">
                <Field label="Ton pic (km par semaine)"><NumberInput value={m.run.peakKm} onChange={(v) => setR({ peakKm: v })} max={200} suffix="km" /></Field>
                {o.ok
                  ? <div className="text-[14px] text-muted text-center">{o.target > o.from + 0.5 ? `De ${f(o.from)} à ${f(o.target)} km : environ +${((o.rate - 1) * 100).toFixed(0)} % par semaine de charge.` : 'Tu gardes ton volume actuel.'}</div>
                  : <div className="text-[14px] text-center" style={{ color: '#FF9F0A' }}>Trop rapide pour {weeks} semaines : monter de plus de 10 % par semaine expose à la blessure. Ton pic serait d'environ {f(o.reachable)} km.</div>}
                <Button small variant="secondary" onClick={() => setR({ peakKm: undefined })}>Revenir à l'avis de MIND</Button>
              </div>)}
          </div>)
      } },
    { id: 'renfo', title: 'Ajouter du renfo coureur ?', sub: 'Un circuit de gainage, de force et de pliométrie pour être plus solide sur tes sorties : 20 à 30 minutes, placé autour de tes séances de course.', when: () => hasR,
      render: () => {
        const cur = renfoOf(m)
        const kits: RenfoKit[] = ['nu', 'elastique', 'salle']
        return (
          <div className="flex flex-col gap-3">
            <Big>
              {([[0, 'Non', 'Juste mes séances de course.'], [1, '1 fois par semaine', 'Le minimum utile pour un coureur.'], [2, '2 fois par semaine', 'Plus de travail de fond, si tes jours le permettent.']] as [0 | 1 | 2, string, string][]).map(([v, t, sub]) =>
                <Option key={v} accent="#FF9F0A" active={cur.perWeek === v} title={t} sub={sub} onClick={() => setR({ renfo: { perWeek: v, kit: cur.kit } })} />)}
            </Big>
            {cur.perWeek > 0 && (
              <div className="flex flex-col gap-3 mt-1">
                <div className="text-[13px] uppercase tracking-wide text-muted font-medium px-1">Quel matériel ?</div>
                <Big>{kits.map((k) => <Option key={k} accent="#FF9F0A" active={cur.kit === k} title={KIT_LABEL[k]} onClick={() => setR({ renfo: { perWeek: cur.perWeek, kit: k } })} />)}</Big>
                <p className="text-[13px] text-muted bg-surface rounded-xl p-3 leading-snug">
                  {m.programType === 'mixte' && !libre
                    ? 'Ton programme mélange muscu et course : pas de séance à part. MIND ajoute 2 ou 3 exercices de coureur (mollets en excentrique, gainage latéral, un exercice unilatéral) à la fin de tes séances de muscu.'
                    : 'Le renfo se place après une séance de qualité, ou un jour sans course : jamais la veille de ta sortie longue ni d\'une séance difficile. Il s\'allège avec l\'affûtage, sans pliométrie dans les 10 jours avant la course.'}
                </p>
              </div>)}
          </div>)
      } },
  ]

  // Mode libre : seulement l'identité et les blessures ; toutes les étapes de génération sont sautées
  const LIBRE_STEPS = ['mode', 'name', 'birth', 'body', 'injuries', 'librerun', ...(hasR ? ['rsess', 'rdays', 'longday', 'dur', 'dist', 'date', 'rlevel', 'refs', 'obj', 'vol', 'startmode', 'peak', 'renfo'] : [])]
  const active = steps.filter((s) => (!libre || LIBRE_STEPS.includes(s.id)) && (!s.when || s.when(q)))
  const cur = active[Math.min(idx, active.length - 1)]
  const isLast = idx >= active.length - 1
  const canNext = cur.valid ? cur.valid(q) : true
  const go = (d: number) => { setDir(d); const n = Math.max(0, Math.min(active.length - 1, idx + d)); setIdx(n); if (!edit) saveDraft(me.id, { step: n, data: q }) }

  const finish = async () => {
    setBusy(true)
    const full = merged(q)
    full.run.raceDate = full.run.raceDate || addDays(today, 84)
    if (hasR) full.run.renfo = renfoOf(m)
    if (full.run.objective === 'finir') full.run.targetSeconds = undefined
    full.strength.split = full.strength.split
    full.startDate = today
    if (full.mode === 'libre') {
      full.programType = full.programType === 'muscu' ? 'muscu' : 'mixte' // muscu libre, avec ou sans plan de course MIND
      submitQuestionnaire(me.id, full, today)
      toast(edit ? 'Formulaire mis à jour' : 'Bienvenue ! Crée ta première séance')
      nav(targetId !== auth.id ? `/coach/client/${targetId}` : edit ? (auth.role === 'coach' ? '/coach/me' : '/app/profile') : auth.role === 'coach' ? '/coach/me' : '/app/sessions', { replace: true })
      return
    }
    full.mode = 'genere'
    const p = submitQuestionnaire(me.id, full, today)
    personalizeInBackground(p.id)
    toast(edit ? 'Programme mis à jour' : 'Ton programme est prêt')
    nav(targetId !== auth.id ? `/coach/client/${targetId}` : auth.role === 'coach' ? '/coach/me' : '/app/today', { replace: true })
  }

  const progress = (idx + 1) / (active.length + 1)
  const hasProgram = !!programOf(db, me.id)
  const MUSCU_STEPS = ['mdays', 'excl', 'msess', 'goal', 'mlevel', 'lifts', 'split']
  const RUN_STEPS = ['rdays', 'longday', 'rsess', 'dist', 'date', 'rlevel', 'refs', 'obj', 'vol', 'startmode', 'peak', 'renfo']
  const glowSports: ('muscu' | 'course')[] = MUSCU_STEPS.includes(cur.id) ? ['muscu'] : RUN_STEPS.includes(cur.id) ? ['course'] : ['muscu', 'course']

  return (
    <div className="flex flex-col max-w-xl mx-auto px-5 relative" style={{ minHeight: '100dvh', paddingTop: 'calc(env(safe-area-inset-top) + 8px)', paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
      {/* lueur d'ambiance : une pochette floue qui change à chaque étape */}
      <AnimatePresence>
        <motion.div key={cur.id} className="fixed top-0 inset-x-0 h-[300px] pointer-events-none -z-0" initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}
          style={{ WebkitMaskImage: 'linear-gradient(#000 0%, transparent 100%)', maskImage: 'linear-gradient(#000 0%, transparent 100%)' }}>
          <Cover seed={`onb-${cur.id}`} sports={glowSports} scrim={false} className="h-full" />
        </motion.div>
      </AnimatePresence>

      <div className="relative flex items-center gap-3 h-11">
        <button className="tap w-11 h-11 -ml-2 flex items-center justify-center rounded-full" aria-label="Étape précédente" style={{ opacity: idx === 0 && !edit ? 0.2 : 1 }} disabled={idx === 0 && !edit}
          onClick={() => (idx === 0 ? nav(-1) : go(-1))}><Icon name="back" size={24} strokeWidth={2.4} /></button>
        <div className="flex-1 h-1.5 rounded-full bg-surface3/70 overflow-hidden">
          <motion.div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg,var(--muscu),#FF9F0A)' }} animate={{ width: `${progress * 100}%` }} transition={springT} />
        </div>
        {(edit || hasProgram) ? <button className="tap text-[16px] font-medium h-11 px-1 -mr-1" style={{ color: 'var(--accent)' }} onClick={() => nav(-1)}>Annuler</button> : <span className="text-[13px] text-muted font-semibold num w-11 text-right">{Math.min(idx + 1, active.length)}/{active.length}</span>}
      </div>

      <div className="relative flex-1 pt-7 -mx-1 px-1" style={{ overflowX: 'clip' }}>
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div key={cur.id} custom={dir} initial={{ opacity: 0, x: 44 * dir }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -44 * dir }} transition={{ duration: 0.22 }}>
            <h1 className="t-onb">{cur.title.replace(' ?', '\u00A0?')}</h1>
            {cur.sub && <p className="text-muted text-[16px] mt-2.5 leading-snug">{cur.sub}</p>}
            <div className="mt-6 pb-4">{cur.render(q, set)}</div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="sticky bottom-0 -mx-5 px-5 pt-5 z-10" style={{ background: 'linear-gradient(to top, var(--bg) 70%, transparent)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {isLast ? (
          <Button full disabled={!canNext || busy} onClick={finish}>{busy ? (libre ? 'Un instant…' : 'Génération en cours…') : libre ? (edit ? 'Enregistrer' : 'Accéder à mes séances') : edit && !switching ? 'Régénérer mon programme' : 'Générer mon programme'}</Button>
        ) : (
          <Button full disabled={!canNext} onClick={() => go(1)}>Continuer</Button>
        )}
        {!isLast && cur.valid === undefined && <button className="tap w-full text-center text-muted text-[15px] h-11 mt-1 font-medium" onClick={() => go(1)}>Passer</button>}
      </div>
    </div>
  )
}
