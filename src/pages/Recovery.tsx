// Page « Récupération » : sommeil et pas venus de Garmin. Ouverte depuis l'accueil (carte), le profil (ligne) ou la fiche client du coach.
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { allSessions } from '@/engine/adapt'
import { healthDays, lastNight, mean, rollingAvg, scoreLabel, sleepStats, stepStats, trainingLinks, weekdayProfile, weekly, type Pair } from '@/engine/recovery'
import { fmtSleep, fmtSteps, healthOn } from '@/engine/runs'
import { addDays, DAY_NAMES, shortDate, todayISO, weekday } from '@/engine/utils'
import { currentUser, stepGoalOf, useDB } from '@/lib/store'
import { Button, Card, Chip, EmptyState, Icon, Page, Ring, SectionTitle, Segmented, StatTile } from '@/ui/kit'
import { nightLabel, PhaseBar, PHASES, SLEEP, STEPS, StepGoalSheet } from '@/ui/recovery'

type Period = '7' | '30' | '90'
const axis = { fill: 'var(--muted)', fontSize: 11, fontWeight: 500 }
const dayShort = (iso: string) => DAY_NAMES[weekday(iso)].slice(0, 3)
const hm = (m: number) => fmtSleep(Math.round(m))
const signed = (m: number) => `${m >= 0 ? '+' : '−'}${Math.abs(Math.round(m)) >= 60 ? hm(Math.abs(m)) : `${Math.abs(Math.round(m))} min`}`
/** Score : la couleur du sommeil, plus pâle quand le score baisse. */
const scoreColor = (s: number) => (s >= 80 ? SLEEP : `color-mix(in srgb, ${SLEEP} ${s >= 60 ? 72 : 48}%, var(--muted))`)

function Tip({ active, payload, render }: { active?: boolean; payload?: { payload: Record<string, any> }[]; render: (p: Record<string, any>) => React.ReactNode }) {
  if (!active || !payload?.length) return null
  return <div className="glass-strong rounded-[14px] px-3 py-2 border border-sep text-[13px] font-semibold num" style={{ boxShadow: 'var(--shadow-float)' }}>{render(payload[0].payload)}</div>
}

function ChartCard({ title, value, sub, color, children }: { title: string; value?: string; sub?: string; color?: string; children: React.ReactNode }) {
  return (
    <Card className="p-4 pb-3 mt-3">
      <div className="flex items-end justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-muted">{title}</div>
          {value && <div className="text-[28px] leading-[1.1] font-extrabold tracking-tight num mt-0.5" style={{ color }}>{value}</div>}
        </div>
        {sub && <div className="text-[12.5px] text-muted text-right leading-snug pb-1 whitespace-pre-line">{sub}</div>}
      </div>
      {children}
    </Card>
  )
}

export default function RecoveryPage() {
  const { id } = useParams()
  const db = useDB()
  const me = currentUser(db)!
  const clientId = id ?? me.id
  const who = id && id !== me.id ? db.profiles.find((p) => p.id === id)?.firstName : undefined
  return (
    <Page title="Récupération" subtitle={who ? `Sommeil et pas de ${who}` : 'Sommeil et pas'} back tabbed={false}>
      <RecoveryView clientId={clientId} canEdit={clientId === me.id} />
    </Page>
  )
}

export function RecoveryView({ clientId, canEdit }: { clientId: string; canEdit: boolean }) {
  const db = useDB()
  const nav = useNavigate()
  const today = todayISO()
  const [period, setPeriod] = useState<Period>('30')
  const [goalSheet, setGoalSheet] = useState(false)
  const goal = stepGoalOf(db, clientId)
  const mine = db.health.filter((h) => h.clientId === clientId)
  const sessions = useMemo(() => db.programs.filter((p) => p.clientId === clientId).flatMap((p) => allSessions(p)), [db.programs, clientId])

  const days = useMemo(() => healthDays(db.health, clientId, addDays(today, -(Number(period) - 1)), today), [db.health, clientId, period, today])
  const quarter = useMemo(() => healthDays(db.health, clientId, addDays(today, -89), today), [db.health, clientId, today])
  const ss = sleepStats(days)
  const st = stepStats(days, today, goal)
  const links = useMemo(() => trainingLinks(quarter, sessions, today), [quarter, sessions, today])
  const week = useMemo(() => weekdayProfile(quarter, today), [quarter, today])

  if (!mine.length) {
    return <EmptyState icon="moon" color={SLEEP} title="Pas encore de données" text="Lie ta montre Garmin dans Profil, rubrique Montre : ton sommeil et tes pas arriveront ici tout seuls."
      action={canEdit ? <Button onClick={() => nav(-1)}>Retour</Button> : undefined} />
  }

  const night = lastNight(db.health, clientId, today)
  const before = night ? mean(healthDays(db.health, clientId, addDays(night.date, -30), addDays(night.date, -1)).map((d) => d.sleep)) : undefined
  const stepsToday = healthOn(db.health, clientId, today)?.steps
  const stepsAvg30 = stepStats(healthDays(db.health, clientId, addDays(today, -30), today), today).avg

  return (
    <div>
      {/* dernière nuit */}
      {night && (
        <Card className="p-4">
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: SLEEP }}><Icon name="moon" size={16} />Dernière nuit</div>
              <div className="text-[36px] font-extrabold tracking-tight num leading-[1.05] mt-1">{fmtSleep(night.sleepMinutes!)}</div>
              <div className="text-[13px] text-muted mt-0.5">{nightLabel(night.date)}</div>
              {before !== undefined && <div className="text-[13px] font-semibold mt-1 num">{signed(night.sleepMinutes! - before)} <span className="text-muted font-medium">par rapport à ta moyenne sur 30 jours</span></div>}
            </div>
            {night.sleepScore !== undefined && (
              <div className="flex flex-col items-center shrink-0">
                <Ring value={night.sleepScore / 100} size={78} stroke={9} color={scoreColor(night.sleepScore)}>
                  <div className="text-center leading-none"><div className="text-[22px] font-extrabold num">{night.sleepScore}</div><div className="text-[10px] text-muted font-semibold mt-0.5">score</div></div>
                </Ring>
                <div className="text-[12px] font-semibold mt-1 capitalize" style={{ color: scoreColor(night.sleepScore) }}>{scoreLabel(night.sleepScore)}</div>
              </div>
            )}
          </div>
          {night.sleepPhases && (
            <div className="mt-4">
              <PhaseBar phases={night.sleepPhases} height={12} />
              <div className="grid grid-cols-4 gap-2 mt-2.5">
                {PHASES.map((p) => {
                  const v = night.sleepPhases![p.key]
                  return (
                    <div key={p.key} className="min-w-0">
                      <div className="flex items-center gap-1 text-[11.5px] text-muted font-semibold truncate"><span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />{p.label}</div>
                      <div className="text-[14.5px] font-bold num">{v !== undefined ? (v >= 60 ? hm(v) : `${v} min`) : '—'}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* pas du jour */}
      <Card className="p-4 mt-3">
        <div className="flex items-center gap-4">
          {goal && stepsToday !== undefined ? (
            <Ring value={stepsToday / goal} size={78} stroke={9} color={STEPS}>
              <div className="text-[17px] font-extrabold num">{Math.min(999, Math.round((stepsToday / goal) * 100))}<span className="text-[11px]"> %</span></div>
            </Ring>
          ) : (
            <span className="w-[52px] h-[52px] rounded-[16px] flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${STEPS} 16%, transparent)`, color: STEPS }}><Icon name="steps" size={28} /></span>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold" style={{ color: STEPS }}>Pas aujourd'hui</div>
            <div className="text-[28px] font-extrabold tracking-tight num leading-tight">{stepsToday !== undefined ? fmtSteps(stepsToday) : '—'}</div>
            <div className="text-[13px] text-muted num">
              {goal ? (stepsToday !== undefined && stepsToday >= goal ? `Objectif de ${fmtSteps(goal)} atteint` : `Objectif ${fmtSteps(goal)}${stepsToday !== undefined ? ` · encore ${fmtSteps(goal - stepsToday)}` : ''}`)
                : stepsAvg30 !== undefined ? `Ta moyenne : ${fmtSteps(Math.round(stepsAvg30))} par jour` : 'Journée en cours'}
            </div>
          </div>
        </div>
        {canEdit && (
          <div className="mt-3 pt-3 border-t border-sep flex items-center justify-between">
            <span className="text-[13.5px] text-muted">{goal ? `Objectif : ${fmtSteps(goal)} pas par jour` : 'Aucun objectif de pas'}</span>
            <Chip color={STEPS} onClick={() => setGoalSheet(true)}>{goal ? 'Modifier' : 'Fixer un objectif'}</Chip>
          </div>
        )}
      </Card>

      <div className="mt-6"><Segmented value={period} onChange={setPeriod} options={[{ value: '7', label: '7 jours' }, { value: '30', label: '30 jours' }, { value: '90', label: '3 mois' }]} /></div>

      {/* sommeil */}
      <SectionTitle>Sommeil</SectionTitle>
      {ss.nights === 0 ? <p className="text-muted text-[14.5px]">Aucune nuit reçue sur cette période.</p> : (<>
        <ChartCard title="Durée par nuit" value={ss.avg ? hm(ss.avg) : '—'} color={SLEEP} sub={`moyenne\n${ss.nights} nuit${ss.nights > 1 ? 's' : ''}`}>
          <SleepChart days={days} period={period} avg={ss.avg} today={today} />
        </ChartCard>
        <div className="grid grid-cols-2 gap-2.5 mt-3">
          <StatTile label="Score moyen" value={ss.avgScore !== undefined ? String(Math.round(ss.avgScore)) : '—'} sub={ss.avgScore !== undefined ? scoreLabel(ss.avgScore) : 'pas de score'} color={ss.avgScore !== undefined ? scoreColor(ss.avgScore) : undefined} />
          <StatTile label="7 h ou plus" value={`${ss.over7}/${ss.nights}`} sub={`nuits (${Math.round((ss.over7 / ss.nights) * 100)} %)`} color={SLEEP} />
          <StatTile label="Régularité" value={ss.spread !== undefined ? `± ${Math.round(ss.spread)}` : '—'} sub="min d'une nuit à l'autre" />
          <StatTile label="Plus longue" value={ss.best?.sleep ? hm(ss.best.sleep) : '—'} sub={ss.worst?.sleep && ss.worst !== ss.best ? `plus courte ${hm(ss.worst.sleep)}` : undefined} />
        </div>
        {ss.phases && (
          <ChartCard title="Phases du sommeil" sub={`${Math.min(14, days.filter((d) => d.phases).length)} dernières nuits`}>
            <PhasesChart days={days.filter((d) => d.phases && d.sleep).slice(-14)} />
            <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-sep">
              {PHASES.map((p) => {
                const k = ({ deepMin: 'deep', lightMin: 'light', remMin: 'rem', awakeMin: 'awake' } as const)[p.key]
                return (
                  <div key={p.key} className="min-w-0">
                    <div className="flex items-center gap-1 text-[11.5px] text-muted font-semibold truncate"><span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />{p.label}</div>
                    <div className="text-[17px] font-extrabold num">{Math.round(ss.phases![k])} %</div>
                  </div>
                )
              })}
            </div>
            <p className="text-[12.5px] text-muted leading-snug mt-2.5">Profond : récupération physique. Paradoxal : mémoire et récupération nerveuse. Parts moyennes sur la période.</p>
          </ChartCard>
        )}
      </>)}

      {/* pas */}
      <SectionTitle>Pas</SectionTitle>
      {st.days === 0 && stepsToday === undefined ? <p className="text-muted text-[14.5px]">Aucun pas reçu sur cette période.</p> : (<>
        <ChartCard title={period === '90' ? 'Pas par jour, moyenne de la semaine' : 'Pas par jour'} value={st.avg !== undefined ? fmtSteps(Math.round(st.avg)) : '—'} color={STEPS} sub={'moyenne / jour\nhors aujourd\'hui'}>
          <StepsChart days={days} period={period} goal={goal} today={today} />
        </ChartCard>
        <div className="grid grid-cols-2 gap-2.5 mt-3">
          {goal ? (<>
            <StatTile label="Objectif atteint" value={`${st.goalDays}/${days.filter((d) => d.steps !== undefined).length}`} sub="jours" color={STEPS} />
            <StatTile label="Série en cours" value={String(st.streak)} sub={`jour${st.streak > 1 ? 's' : ''} d'affilée`} color={st.streak ? STEPS : undefined} icon={<Icon name="flame" size={13} />} />
          </>) : null}
          <StatTile label="Meilleur jour" value={st.best ? fmtSteps(st.best.steps!) : '—'} sub={st.best ? `${dayShort(st.best.date)} ${shortDate(st.best.date)}` : undefined} />
          <StatTile label="Total" value={fmtSteps(days.reduce((a, d) => a + (d.steps ?? 0), 0))} sub={`pas sur ${period === '90' ? '3 mois' : `${period} jours`}`} />
        </div>
      </>)}

      {/* ce que montrent les données */}
      {(week.sleep.filter(Boolean).length >= 4 || week.steps.filter(Boolean).length >= 4 || links.feeling || links.sleepAfter || links.steps) && (<>
        <SectionTitle action={<span className="text-[13px] text-muted font-medium pb-0.5">sur 3 mois</span>}>Tes tendances</SectionTitle>
        {(week.sleep.filter(Boolean).length >= 4 || week.steps.filter(Boolean).length >= 4) && <WeekCard week={week} />}
        {(links.feeling || links.sleepAfter || links.steps) && (
          <Card className="p-4 mt-3">
            <div className="text-[14px] font-semibold text-muted mb-3">Sommeil, pas et séances</div>
            <div className="flex flex-col gap-4">
              {links.feeling && <Compare title="Ressenti de tes séances" pair={links.feeling} color="var(--muted)" fmt={(v) => `${v.toFixed(1).replace('.', ',')}/10`}
                a={`après une nuit de moins de ${hm(links.feeling.threshold)}`} b={`après ${hm(links.feeling.threshold)} ou plus`} />}
              {links.sleepAfter && <Compare title="Ta nuit suivante" pair={links.sleepAfter} color={SLEEP} fmt={hm} a="après un jour de séance" b="après un jour sans séance" />}
              {links.steps && <Compare title="Tes pas" pair={links.steps} color={STEPS} fmt={(v) => fmtSteps(Math.round(v))} a="les jours de séance" b="les jours sans séance" />}
            </div>
          </Card>
        )}
      </>)}

      <p className="text-center text-[12px] text-faint mt-6 px-4 leading-snug">Données de la montre Garmin, synchronisées toutes les 30 minutes. Une nuit porte la date du réveil.</p>
      {canEdit && <StepGoalSheet open={goalSheet} onClose={() => setGoalSheet(false)} clientId={clientId} />}
    </div>
  )
}

function SleepChart({ days, period, avg, today }: { days: ReturnType<typeof healthDays>; period: Period; avg?: number; today: string }) {
  const roll = rollingAvg(days.map((d) => d.sleep))
  const data = period === '90'
    ? weekly(days, today).map((w) => ({ name: shortDate(w.monday), label: `semaine du ${shortDate(w.monday)}`, v: w.sleep }))
    : days.map((d, i) => ({ name: period === '7' ? dayShort(d.date) : shortDate(d.date), label: `${nightLabel(d.date)}${d.score ? ` · score ${d.score}` : ''}`, v: d.sleep, avg7: period === '30' ? roll[i] : undefined }))
  const max = Math.max(540, ...data.map((d) => d.v ?? 0))
  const ticks = Array.from({ length: Math.floor(max / 120) + 1 }, (_, i) => i * 120)
  return (
    <div style={{ height: 190 }} role="img" aria-label="Durée de sommeil par nuit">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 6, right: 4, left: -26, bottom: 0 }} barCategoryGap={period === '30' ? '18%' : '28%'}>
          <CartesianGrid stroke="var(--sep)" strokeDasharray="3 5" vertical={false} />
          <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} interval={period === '30' ? 6 : period === '90' ? 2 : 0} />
          <YAxis domain={[0, max]} ticks={ticks} tickFormatter={(v) => `${Number(v) / 60} h`} tick={axis} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: 'var(--surface2)', radius: 6 }} content={<Tip render={(p) => (<><div className="text-muted font-medium first-letter:uppercase">{p.label}</div><div>{p.v ? hm(p.v) : 'pas de données'}{p.avg7 ? <span className="text-muted font-medium"> · moy. 7 j {hm(p.avg7)}</span> : null}</div></>)} />} />
          {avg && <ReferenceLine y={avg} stroke="var(--text)" strokeDasharray="5 4" strokeOpacity={0.45} />}
          <Bar dataKey="v" fill={SLEEP} radius={[5, 5, 0, 0]} fillOpacity={period === '30' ? 0.55 : 0.9} />
          {period === '30' && <Line type="monotone" dataKey="avg7" stroke={SLEEP} strokeWidth={2.6} dot={false} connectNulls isAnimationActive={false} />}
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-3 text-[11.5px] text-muted px-1 -mt-0.5">
        <span className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed" style={{ borderColor: 'var(--muted)' }} />ta moyenne</span>
        {period === '30' && <span className="flex items-center gap-1.5"><span className="w-4 h-[3px] rounded-full" style={{ background: SLEEP }} />moyenne sur 7 jours</span>}
      </div>
    </div>
  )
}

function StepsChart({ days, period, goal, today }: { days: ReturnType<typeof healthDays>; period: Period; goal?: number; today: string }) {
  const data = period === '90'
    ? weekly(days, today).map((w) => ({ name: shortDate(w.monday), label: `semaine du ${shortDate(w.monday)}`, v: w.steps, partial: false }))
    : days.map((d) => ({ name: period === '7' ? dayShort(d.date) : shortDate(d.date), label: `${DAY_NAMES[weekday(d.date)]} ${shortDate(d.date)}${d.date === today ? ' (en cours)' : ''}`, v: d.steps, partial: d.date === today }))
  return (
    <div style={{ height: 180 }} role="img" aria-label="Pas par jour">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 6, right: 4, left: -18, bottom: 0 }} barCategoryGap={period === '30' ? '18%' : '28%'}>
          <CartesianGrid stroke="var(--sep)" strokeDasharray="3 5" vertical={false} />
          <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} interval={period === '30' ? 6 : period === '90' ? 2 : 0} />
          <YAxis tick={axis} axisLine={false} tickLine={false} tickFormatter={(v) => (Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : String(v))} domain={[0, (m: number) => Math.max(m, goal ?? 0) * 1.08]} />
          <Tooltip cursor={{ fill: 'var(--surface2)', radius: 6 }} content={<Tip render={(p) => (<><div className="text-muted font-medium first-letter:uppercase">{p.label}</div><div>{p.v !== undefined ? `${fmtSteps(Math.round(p.v))} pas` : 'pas de données'}</div></>)} />} />
          {goal && <ReferenceLine y={goal} stroke={STEPS} strokeDasharray="5 4" strokeOpacity={0.9} />}
          <Bar dataKey="v" radius={[5, 5, 0, 0]}>
            {data.map((d, i) => <Cell key={i} fill={STEPS} fillOpacity={d.partial ? 0.3 : goal ? ((d.v ?? 0) >= goal ? 1 : 0.42) : 0.85} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {goal && <div className="flex items-center gap-2 text-[11.5px] text-muted px-1 -mt-0.5"><span className="w-4 border-t-2 border-dashed" style={{ borderColor: STEPS }} />objectif {fmtSteps(goal)} · barre pleine = objectif atteint</div>}
    </div>
  )
}

function PhasesChart({ days }: { days: ReturnType<typeof healthDays> }) {
  const data = days.map((d) => ({ name: days.length <= 7 ? dayShort(d.date) : shortDate(d.date).split(' ')[0], label: nightLabel(d.date), ...d.phases }))
  return (
    <div style={{ height: 160 }} role="img" aria-label="Phases du sommeil par nuit">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }} barCategoryGap="22%">
          <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} interval={0} />
          <YAxis hide />
          <Tooltip cursor={{ fill: 'var(--surface2)', radius: 6 }} content={<Tip render={(p) => (<><div className="text-muted font-medium first-letter:uppercase">{p.label}</div>
            {PHASES.map((ph) => p[ph.key] !== undefined && <div key={ph.key} className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: ph.color }} />{ph.label}<span className="ml-auto pl-3">{hm(p[ph.key])}</span></div>)}</>)} />} />
          {[...PHASES].map((p, i) => <Bar key={p.key} dataKey={p.key} stackId="n" fill={p.color} radius={i === PHASES.length - 1 ? [4, 4, 0, 0] : 0} isAnimationActive={false} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Semaine type : une case par jour, plus foncée quand la valeur est haute. */
function WeekCard({ week }: { week: { sleep: (number | undefined)[]; steps: (number | undefined)[] } }) {
  const row = (vals: (number | undefined)[], color: string, fmt: (v: number) => string) => {
    const v = vals.filter((x): x is number => x !== undefined)
    const lo = Math.min(...v), hi = Math.max(...v)
    return (
      <div className="grid grid-cols-7 gap-1">
        {vals.map((x, i) => (
          <div key={i} className="rounded-[9px] h-[46px] flex items-center justify-center text-[11px] font-bold num leading-none text-center px-0.5"
            style={x === undefined ? { background: 'var(--surface2)', color: 'var(--faint)' } : { background: `color-mix(in srgb, ${color} ${Math.round(18 + (hi > lo ? (x - lo) / (hi - lo) : 0.5) * 72)}%, var(--surface))`, color: hi > lo && (x - lo) / (hi - lo) > 0.55 ? '#fff' : 'var(--text)' }}>
            {x === undefined ? '—' : fmt(x)}
          </div>
        ))}
      </div>
    )
  }
  const best = (vals: (number | undefined)[], dir: 1 | -1) => vals.reduce<number>((bi, x, i) => (x !== undefined && (vals[bi] === undefined || dir * (x - vals[bi]!) > 0) ? i : bi), 0)
  const sOk = week.sleep.filter(Boolean).length >= 4, pOk = week.steps.filter(Boolean).length >= 4
  return (
    <Card className="p-4 mt-1">
      <div className="text-[14px] font-semibold text-muted mb-3">Ta semaine type</div>
      <div className="grid grid-cols-7 gap-1 mb-1.5">{DAY_NAMES.map((d) => <div key={d} className="text-center text-[11px] text-muted font-semibold uppercase">{d.slice(0, 3)}</div>)}</div>
      {sOk && (<><div className="flex items-center gap-1.5 text-[12px] font-semibold mb-1" style={{ color: SLEEP }}><Icon name="moon" size={13} />Nuit du… (commence le soir)</div>
        {row(week.sleep, SLEEP, (v) => `${Math.floor(v / 60)}h${String(Math.round(v % 60)).padStart(2, '0')}`)}</>)}
      {pOk && (<><div className="flex items-center gap-1.5 text-[12px] font-semibold mb-1 mt-3" style={{ color: STEPS }}><Icon name="steps" size={13} />Pas</div>
        {row(week.steps, STEPS, (v) => `${(v / 1000).toFixed(1).replace('.', ',')}k`)}</>)}
      <div className="text-[13px] text-muted leading-snug mt-3">
        {sOk && <>Nuits les plus longues : le <b className="text-ink">{DAY_NAMES[best(week.sleep, 1)]}</b> ({hm(week.sleep[best(week.sleep, 1)]!)}), les plus courtes : le <b className="text-ink">{DAY_NAMES[best(week.sleep, -1)]}</b> ({hm(week.sleep[best(week.sleep, -1)]!)}). </>}
        {pOk && <>Tu marches le plus le <b className="text-ink">{DAY_NAMES[best(week.steps, 1)]}</b>, le moins le <b className="text-text">{DAY_NAMES[best(week.steps, -1)]}</b>.</>}
      </div>
    </Card>
  )
}

/** Deux groupes comparés, barres proportionnelles. */
function Compare({ title, pair, a, b, color, fmt }: { title: string; pair: Pair; a: string; b: string; color: string; fmt: (v: number) => string }) {
  const max = Math.max(pair.a.avg, pair.b.avg)
  const line = (label: string, g: Pair['a'], strong: boolean) => (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-[13px]"><span className="text-muted truncate">{label} <span className="text-faint">({g.n})</span></span><span className="font-bold num shrink-0">{fmt(g.avg)}</span></div>
      <div className="h-[7px] rounded-full bg-surface2 mt-1 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(g.avg / max) * 100}%`, background: color, opacity: strong ? 1 : 0.45 }} /></div>
    </div>
  )
  return (
    <div>
      <div className="text-[15px] font-bold mb-1.5">{title}</div>
      <div className="flex flex-col gap-2">{line(a, pair.a, pair.a.avg >= pair.b.avg)}{line(b, pair.b, pair.b.avg > pair.a.avg)}</div>
    </div>
  )
}
