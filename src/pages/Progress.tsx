import { useMemo, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { allSessions } from '@/engine/adapt'
import { EXERCISE_BY_ID } from '@/engine/exercises'
import { epley } from '@/engine/strength'
import { MUSCLE_LABEL, type Muscle, type Session } from '@/engine/types'
import { addDays, fmtKm, fmtPace, fmtTime, mondayOf, shortDate, todayISO } from '@/engine/utils'
import { programOf, useDB } from '@/lib/store'
import { Card, Cover, EmptyState, Icon, Ring, Segmented, SectionTitle, SportIcon, StatTile } from '@/ui/kit'

type Filter = '4w' | 'cycle' | 'all'
const axis = { fill: 'var(--muted)', fontSize: 11, fontWeight: 500 }
const MUSCU = 'var(--muscu)'
const COURSE = '#FF9F0A'

/** Infobulle des graphiques : verre dépoli, valeurs tabulaires. */
function ChartTip({ active, payload, label, unit = '', fmt }: { active?: boolean; payload?: { name?: string; value?: number | string; color?: string; fill?: string; stroke?: string }[]; label?: string; unit?: string; fmt?: (v: number) => string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-strong rounded-[14px] px-3 py-2 border border-sep text-[13px]" style={{ boxShadow: 'var(--shadow-float)' }}>
      <div className="text-muted font-semibold mb-0.5">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5 num font-semibold">
          <span className="w-2 h-2 rounded-full" style={{ background: p.stroke ?? p.fill ?? p.color }} />
          {p.name ? <span className="text-muted font-medium">{p.name}</span> : null}
          <span className="ml-auto pl-3">{fmt ? fmt(Number(p.value)) : p.value}{unit}</span>
        </div>
      ))}
    </div>
  )
}

function Grad({ id, color, from = 0.95, to = 0.45 }: { id: string; color: string; from?: number; to?: number }) {
  return <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" style={{ stopColor: color }} stopOpacity={from} /><stop offset="100%" style={{ stopColor: color }} stopOpacity={to} /></linearGradient></defs>
}

function ChartCard({ title, value, sub, children, color }: { title: string; value?: string; sub?: string; children: React.ReactNode; color?: string }) {
  return (
    <Card className="p-4 pb-3 mt-3">
      <div className="flex items-end justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-muted">{title}</div>
          {value && <div className="text-[28px] leading-[1.1] font-extrabold tracking-tight num mt-0.5" style={{ color }}>{value}</div>}
        </div>
        {sub && <div className="text-[12.5px] text-muted text-right leading-snug pb-1">{sub}</div>}
      </div>
      {children}
    </Card>
  )
}

function SportHeader({ sport, children }: { sport: 'muscu' | 'course'; children: React.ReactNode }) {
  const c = sport === 'muscu' ? MUSCU : COURSE
  return (
    <div className="flex items-center gap-2.5 mt-9 mb-1">
      <span className="w-9 h-9 rounded-[11px] flex items-center justify-center" style={{ background: `color-mix(in srgb, ${c} 18%, transparent)` }}><SportIcon sport={sport} size={20} /></span>
      <h2 className="t-title2">{children}</h2>
    </div>
  )
}

export function ProgressView({ clientId }: { clientId: string }) {
  const db = useDB()
  const [filter, setFilter] = useState<Filter>('4w')
  const [exId, setExId] = useState<string | null>(null)
  const today = todayISO()
  const program = programOf(db, clientId)
  const programs = db.programs.filter((p) => p.clientId === clientId)

  const { sessions, planned } = useMemo(() => {
    const all = programs.flatMap((p) => allSessions(p))
    let from = '0000-00-00'
    if (filter === '4w') from = addDays(today, -28)
    if (filter === 'cycle' && program) {
      const cur = program.weeks.find((w) => w.startDate === mondayOf(today)) ?? program.weeks[0]
      const start = Math.floor((cur.n - 1) / 8) * 8 + 1
      from = program.weeks.find((w) => w.n === start)?.startDate ?? from
    }
    const inRange = all.filter((s) => s.date >= from && s.date <= today && s.status !== 'sautee')
    return { sessions: inRange.filter((s) => s.status === 'faite'), planned: inRange }
  }, [db.programs, filter])

  if (!program) return <EmptyState icon="progress" color="var(--muscu)" title="Pas encore de statistiques" text="Dès que ton programme est créé et ta première séance validée, tes courbes apparaîtront ici." />
  if (planned.length === 0) return <EmptyState icon="progress" color="var(--muscu)" title="Pas encore de données" text="Termine ta première séance : tes charges, tes volumes et tes allures s'afficheront ici. Un pas après l'autre !" />

  // ---- assiduité par semaine
  const weekMap = new Map<string, { planned: number; done: number }>()
  for (const s of planned) {
    const k = mondayOf(s.date)
    const v = weekMap.get(k) ?? { planned: 0, done: 0 }
    v.planned += 1
    if (s.status === 'faite') v.done += 1
    weekMap.set(k, v)
  }
  const weeks = [...weekMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  const adherence = weeks.map(([k, v]) => ({ name: shortDate(k), faites: v.done, manquees: v.planned - v.done }))
  let streak = 0
  const thisMonday = mondayOf(today)
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (weeks[i][0] === thisMonday) continue
    if (weeks[i][1].done >= weeks[i][1].planned && weeks[i][1].planned > 0) streak++
    else break
  }
  const rate = Math.round((100 * sessions.length) / Math.max(1, planned.length))

  // ---- musculation
  const muscu = sessions.filter((s) => s.sport === 'muscu')
  const exStats = new Map<string, { date: string; kg: number; e1: number }[]>()
  const setsByMuscle: Partial<Record<Muscle, number>> = {}
  const tonnageByWeek = new Map<string, number>()
  for (const s of muscu.sort((a, b) => a.date.localeCompare(b.date))) {
    for (const e of s.exercises ?? []) {
      if (!e.logs.length) continue
      const best = e.logs.reduce((a, b) => (epley(b.kg, b.reps) > epley(a.kg, a.reps) ? b : a))
      const arr = exStats.get(e.exerciseId) ?? []
      arr.push({ date: s.date, kg: Math.max(...e.logs.map((l) => l.kg)), e1: Math.round(epley(best.kg, best.reps) * 10) / 10 })
      exStats.set(e.exerciseId, arr)
      const m = EXERCISE_BY_ID[e.exerciseId].muscle
      setsByMuscle[m] = (setsByMuscle[m] ?? 0) + e.logs.length
      const k = mondayOf(s.date)
      tonnageByWeek.set(k, (tonnageByWeek.get(k) ?? 0) + e.logs.reduce((a, l) => a + l.kg * l.reps, 0))
    }
  }
  const exOptions = [...exStats.entries()].filter(([, v]) => v.some((x) => x.kg > 0)).sort((a, b) => b[1].length - a[1].length)
  const selected = exId && exStats.has(exId) ? exId : exOptions[0]?.[0]
  const selData = selected ? exStats.get(selected)!.map((x) => ({ name: shortDate(x.date), kg: x.kg, e1rm: x.e1 })) : []
  const muscleWeeks = Math.max(1, weeks.length)
  const muscleData = (Object.entries(setsByMuscle) as [Muscle, number][]).map(([m, n]) => ({ name: MUSCLE_LABEL[m], series: Math.round((n / muscleWeeks) * 10) / 10 })).sort((a, b) => b.series - a.series)
  const tonnage = [...tonnageByWeek.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({ name: shortDate(k), kg: Math.round(v) }))
  const records = db.records.filter((r) => r.clientId === clientId && (filter === 'all' || r.date >= addDays(today, filter === '4w' ? -28 : -56))).sort((a, b) => b.date.localeCompare(a.date))

  // ---- course
  const runs = sessions.filter((s): s is Session & { runLog: NonNullable<Session['runLog']> } => s.sport === 'course' && !!s.runLog)
  const kmWeek = new Map<string, number>()
  runs.forEach((s) => kmWeek.set(mondayOf(s.date), (kmWeek.get(mondayOf(s.date)) ?? 0) + s.runLog.km))
  const kmData = [...kmWeek.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({ name: shortDate(k), km: Math.round(v * 10) / 10 }))
  const paceData = runs.filter((s) => s.kind === 'ef' || s.kind === 'longue' || s.kind === 'recup').sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => ({ name: shortDate(s.date), pace: Math.round(s.runLog.seconds / s.runLog.km) }))
  const avgPace = runs.length ? runs.reduce((a, s) => a + s.runLog.seconds, 0) / runs.reduce((a, s) => a + s.runLog.km, 0) : 0
  const longest = runs.reduce((a, s) => Math.max(a, s.runLog.km), 0)
  const vmaAdapt = db.adaptations.filter((a) => a.programId === program.id && a.kind === 'allures' && a.status === 'applique' && a.payload).sort((a, b) => a.date.localeCompare(b.date))
  const vmaData = program.paces ? [
    ...(vmaAdapt.length ? [{ name: shortDate(program.startDate), vma: (vmaAdapt[0].payload as { paces: { vma: number } }).paces.vma }] : []),
    ...vmaAdapt.map((a, i) => ({ name: shortDate(a.date), vma: i + 1 < vmaAdapt.length ? (vmaAdapt[i + 1].payload as { paces: { vma: number } }).paces.vma : program.paces!.vma })),
  ] : []
  const totalKm = runs.reduce((a, s) => a + s.runLog.km, 0)

  const gain = selData.length > 1 ? Math.round((selData[selData.length - 1].e1rm - selData[0].e1rm) * 10) / 10 : 0
  const lastKg = selData.length ? selData[selData.length - 1].kg : 0

  return (
    <div>
      <Segmented value={filter} onChange={setFilter} options={[{ value: '4w', label: '4 semaines' }, { value: 'cycle', label: 'Cycle en cours' }, { value: 'all', label: 'Tout' }]} />

      {/* synthèse */}
      <Card className="p-4 mt-4 flex items-center gap-4">
        <Ring value={rate / 100} size={92} stroke={11} color={rate >= 80 ? '#30D158' : rate >= 50 ? '#FF9F0A' : '#FF453A'}>
          <div className="text-center leading-none"><div className="text-[22px] font-extrabold num">{rate}<span className="text-[13px]"> %</span></div></div>
        </Ring>
        <div className="flex-1 min-w-0">
          <div className="t-over text-muted">Assiduité</div>
          <div className="text-[28px] font-extrabold tracking-tight num leading-tight mt-0.5">{sessions.length}<span className="text-muted text-[20px]">/{planned.length}</span> <span className="text-[15px] text-muted font-semibold tracking-normal">séances</span></div>
          <div className="flex items-center gap-1.5 text-[13.5px] mt-1 font-semibold" style={{ color: streak > 0 ? '#FF9F0A' : 'var(--muted)' }}>
            <Icon name="flame" size={16} /> {streak > 0 ? `${streak} semaine${streak > 1 ? 's' : ''} complète${streak > 1 ? 's' : ''} d'affilée` : 'Complète ta semaine pour lancer une série'}
          </div>
        </div>
      </Card>

      <ChartCard title="Séances par semaine" sub="faites / manquées">
        <div style={{ height: 160 }}>
          <ResponsiveContainer>
            <BarChart data={adherence} margin={{ top: 4, right: 4, left: -26, bottom: 0 }} barCategoryGap="28%">
              <Grad id="gDone" color="#30D158" from={1} to={0.6} />
              <CartesianGrid stroke="var(--sep)" strokeDasharray="3 5" vertical={false} />
              <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} />
              <YAxis tick={axis} axisLine={false} tickLine={false} allowDecimals={false} domain={[0, (max: number) => Math.max(4, Math.ceil(max / 2) * 2)]} tickCount={4} />
              <Tooltip content={<ChartTip />} cursor={{ fill: 'var(--surface2)', radius: 8 }} />
              <Bar dataKey="faites" name="Faites" stackId="a" fill="url(#gDone)" />
              <Bar dataKey="manquees" name="Manquées" stackId="a" fill="#FF453A" fillOpacity={0.55} radius={[7, 7, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {muscu.length > 0 && (<>
        <SportHeader sport="muscu">Musculation</SportHeader>
        {exOptions.length > 0 && (
          <Card className="p-4 pb-3 mt-3">
            <div className="flex gap-2 overflow-x-auto hide-scroll pb-3 -mx-1 px-1 overscroll-x-contain">
              {exOptions.slice(0, 12).map(([id]) => (
                <button key={id} onClick={() => setExId(id)} className="tap hit shrink-0 rounded-full px-3.5 h-9 text-[13px] font-semibold"
                  style={{ background: selected === id ? MUSCU : 'var(--surface2)', color: selected === id ? '#fff' : 'var(--text)' }}>{EXERCISE_BY_ID[id].name}</button>
              ))}
            </div>
            <div className="flex items-end justify-between mb-2">
              <div><div className="text-[13px] text-muted font-semibold">Charge max</div><div className="text-[28px] font-extrabold tracking-tight num leading-tight" style={{ color: MUSCU }}>{fmtKm(lastKg)} kg</div></div>
              {selData.length > 1 && <div className="text-right text-[12.5px] text-muted leading-snug pb-1">1RM estimé<br /><span className="font-bold num" style={{ color: gain >= 0 ? '#30D158' : '#FF453A' }}>{gain >= 0 ? '+' : ''}{fmtKm(gain)} kg</span> sur la période</div>}
            </div>
            <div style={{ height: 190 }}>
              <ResponsiveContainer>
                <AreaChart data={selData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <Grad id="gKg" color={MUSCU} from={0.5} to={0} />
                  <CartesianGrid stroke="var(--sep)" strokeDasharray="3 5" vertical={false} />
                  <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} />
                  <YAxis tick={axis} axisLine={false} tickLine={false} domain={['dataMin - 5', 'dataMax + 5']} tickFormatter={(v) => String(Math.round(Number(v)))} />
                  <Tooltip content={<ChartTip unit=" kg" />} />
                  <Area type="monotone" dataKey="kg" name="Charge" stroke={MUSCU} strokeWidth={3} fill="url(#gKg)" dot={{ r: 3.5, strokeWidth: 2, stroke: 'var(--surface)', fill: MUSCU }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="e1rm" name="1RM estimé" stroke={COURSE} strokeWidth={2} strokeDasharray="4 5" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-4 text-[12px] text-muted mt-1.5 px-1"><span className="inline-flex items-center gap-1.5"><span className="w-3 h-[3px] rounded-full" style={{ background: MUSCU }} />Charge</span><span className="inline-flex items-center gap-1.5"><span className="w-3 h-[3px] rounded-full" style={{ background: COURSE }} />1RM estimé</span></div>
          </Card>
        )}

        <ChartCard title="Séries par muscle et par semaine">
          <div style={{ height: Math.max(160, muscleData.length * 32) }}>
            <ResponsiveContainer>
              <BarChart data={muscleData} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }} barCategoryGap="24%">
                <Grad id="gMuscle" color={MUSCU} from={0.55} to={1} />
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" tick={{ ...axis, fill: 'var(--text)', fontSize: 12.5 }} axisLine={false} tickLine={false} width={106} />
                <Tooltip content={<ChartTip />} cursor={{ fill: 'var(--surface2)', radius: 8 }} />
                <Bar dataKey="series" name="Séries / sem." fill="url(#gMuscle)" radius={[0, 8, 8, 0]} label={{ position: 'right', fill: 'var(--muted)', fontSize: 12, fontWeight: 600 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Tonnage hebdomadaire" sub="kg soulevés">
          <div style={{ height: 160 }}>
            <ResponsiveContainer>
              <BarChart data={tonnage} margin={{ top: 0, right: 4, left: -8, bottom: 0 }} barCategoryGap="28%">
                <Grad id="gTon" color={MUSCU} from={1} to={0.5} />
                <CartesianGrid stroke="var(--sep)" strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} />
                <YAxis tick={axis} axisLine={false} tickLine={false} tickFormatter={(v) => (Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)} k` : String(v))} />
                <Tooltip content={<ChartTip unit=" kg" fmt={(v) => v.toLocaleString('fr-FR')} />} cursor={{ fill: 'var(--surface2)', radius: 8 }} />
                <Bar dataKey="kg" name="Tonnage" fill="url(#gTon)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {records.length > 0 && (<>
          <SectionTitle className="!mt-7">Records personnels</SectionTitle>
          <div className="flex flex-col gap-2">
            {records.slice(0, 8).map((r) => (
              <Card key={r.id} className="p-2.5 pr-4 flex items-center gap-3">
                <Cover seed={r.id} sports={['muscu']} scrim={false} className="w-12 h-12 rounded-[14px] shrink-0">
                  <div className="absolute inset-0 flex items-center justify-center text-white"><Icon name="trophy" size={22} /></div>
                </Cover>
                <div className="flex-1 min-w-0"><div className="font-bold truncate">{EXERCISE_BY_ID[r.exerciseId]?.name}</div><div className="text-[13px] text-muted">{shortDate(r.date)} · 1RM estimé {fmtKm(Math.round(r.e1rm * 10) / 10)} kg</div></div>
                <div className="font-extrabold num text-[17px]">{fmtKm(r.kg)} × {r.reps}</div>
              </Card>
            ))}
          </div>
        </>)}
      </>)}

      {runs.length > 0 && (<>
        <SportHeader sport="course">Course</SportHeader>
        <div className="grid grid-cols-3 gap-2.5 mt-3">
          <StatTile label="Distance" value={`${fmtKm(Math.round(totalKm))}`} sub="km courus" color={COURSE} />
          <StatTile label="Allure moy." value={avgPace ? fmtPace(avgPace) : '—'} sub="min/km" color={COURSE} />
          <StatTile label="Plus longue" value={fmtKm(longest)} sub="km" color={COURSE} />
        </div>
        <ChartCard title="Kilomètres par semaine">
          <div style={{ height: 160 }}>
            <ResponsiveContainer>
              <BarChart data={kmData} margin={{ top: 0, right: 4, left: -22, bottom: 0 }} barCategoryGap="28%">
                <Grad id="gKm" color={COURSE} from={1} to={0.5} />
                <CartesianGrid stroke="var(--sep)" strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} />
                <YAxis tick={axis} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip unit=" km" />} cursor={{ fill: 'var(--surface2)', radius: 8 }} />
                <Bar dataKey="km" name="Distance" fill="url(#gKm)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        {paceData.length > 1 && (
          <ChartCard title="Allure des sorties faciles" sub="plus bas = plus rapide">
            <div style={{ height: 160 }}>
              <ResponsiveContainer>
                <LineChart data={paceData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid stroke="var(--sep)" strokeDasharray="3 5" vertical={false} />
                  <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} />
                  <YAxis tick={axis} axisLine={false} tickLine={false} reversed domain={['dataMin - 10', 'dataMax + 10']} tickFormatter={(v) => fmtPace(Number(v))} />
                  <Tooltip content={<ChartTip unit=" /km" fmt={(v) => fmtPace(v)} />} />
                  <Line type="monotone" dataKey="pace" name="Allure" stroke={COURSE} strokeWidth={3} dot={{ r: 3.5, strokeWidth: 2, stroke: 'var(--surface)', fill: COURSE }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        )}
        {program.paces && (
          <Card className="p-4 mt-3">
            <div className="flex items-center justify-between gap-3">
              <div><div className="text-[13px] text-muted font-semibold">VMA actuelle</div><div className="text-[30px] leading-tight font-extrabold tracking-tight num" style={{ color: COURSE }}>{fmtKm(program.paces.vma)} <span className="text-[16px]">km/h</span></div></div>
              <div className="text-right text-[13px] text-muted leading-relaxed num">EF <b className="text-ink">{fmtPace(program.paces.ef)}</b><br />Seuil <b className="text-ink">{fmtPace(program.paces.seuil)}</b><br />VMA <b className="text-ink">{fmtPace(program.paces.vmaPace)}</b></div>
            </div>
            {vmaData.length > 1 && (
              <div style={{ height: 120 }} className="mt-3"><ResponsiveContainer>
                <LineChart data={vmaData} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                  <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} />
                  <YAxis tick={axis} axisLine={false} tickLine={false} domain={['dataMin - 0.5', 'dataMax + 0.5']} />
                  <Tooltip content={<ChartTip unit=" km/h" />} />
                  <Line type="monotone" dataKey="vma" name="VMA" stroke={COURSE} strokeWidth={3} dot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)', fill: COURSE }} />
                </LineChart></ResponsiveContainer></div>
            )}
            {program.raceDate && program.targetSeconds && <div className="text-[13px] text-muted mt-3 flex items-center gap-1.5"><Icon name="target" size={15} /> Objectif course : <b className="text-ink num">{fmtTime(program.targetSeconds)}</b></div>}
          </Card>
        )}
      </>)}
    </div>
  )
}
