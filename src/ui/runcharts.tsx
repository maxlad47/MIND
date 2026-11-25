// Graphiques des courses importées (Recharts, chargés à la demande) : allure par km, fréquence cardiaque, effort perçu, pas et sommeil.
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { zoneBands } from '@/engine/runs'
import type { HealthDay, HrPoint, ImportedSplit } from '@/engine/types'
import { fmtPace, fmtKm, shortDate } from '@/engine/utils'
import { fmtSleep } from '@/engine/runs'

const axis = { fill: 'var(--muted)', fontSize: 11, fontWeight: 500 }
const COURSE = 'var(--course)'
export const ZONE_COLORS = ['#64D2FF', '#30D158', '#FFD60A', '#FF9F0A', '#FF453A']

function Tip({ active, payload, label, render }: { active?: boolean; payload?: { payload: Record<string, number> }[]; label?: string | number; render: (p: Record<string, number>, label?: string | number) => string }) {
  if (!active || !payload?.length) return null
  return <div className="glass-strong rounded-[14px] px-3 py-2 border border-sep text-[13px] font-semibold num" style={{ boxShadow: 'var(--shadow-float)' }}>{render(payload[0].payload, label)}</div>
}

/** Une barre par km, l'allure cible en ligne : plus vive quand le km est plus rapide que la cible, plus terne quand il est plus lent. */
export function SplitsChart({ splits, target }: { splits: ImportedSplit[]; target?: number }) {
  const paces = splits.map((s) => s.avgPaceSec)
  const slow = Math.max(...paces, target ?? 0) + 25
  const data = splits.map((s, i) => ({ name: s.km < 0.95 ? `${fmtKm(s.km)} km` : String(i + 1), pace: s.avgPaceSec, h: slow - s.avgPaceSec, hr: s.avgHr }))
  return (
    <div role="img" aria-label="Allure par kilomètre">
    <div style={{ height: 168 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 6, left: 6, bottom: 0 }} barCategoryGap="18%">
          <CartesianGrid stroke="var(--sep)" strokeDasharray="3 5" vertical={false} />
          <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} interval={data.length > 14 ? 1 : 0} />
          <YAxis hide domain={[0, slow - Math.min(...paces) + 12]} />
          <Tooltip cursor={{ fill: 'var(--surface2)', radius: 8 }} content={<Tip render={(p, l) => `km ${l} · ${fmtPace(p.pace)} /km${p.hr ? ` · ${p.hr} bpm` : ''}`} />} />
          {target && <ReferenceLine y={slow - target} stroke="var(--text)" strokeDasharray="5 4" strokeOpacity={0.6} ifOverflow="extendDomain" />}
          <Bar dataKey="h" radius={[7, 7, 0, 0]}>
            {data.map((d, i) => <Cell key={i} fill={COURSE} fillOpacity={target ? (d.pace <= target ? 1 : 0.38) : 0.85} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
    {target && <div className="flex items-center gap-2 text-[12px] text-muted px-1 mt-1"><span className="w-5 border-t-2 border-dashed" style={{ borderColor: 'var(--muted)' }} />cible {fmtPace(target)} /km · barre vive = km plus rapide que la cible</div>}
    </div>
  )
}

/** Courbe de FC sur la durée, zones en bandes de fond. */
export function HrChart({ series, maxHr }: { series: HrPoint[]; maxHr: number }) {
  const data = series.map((p) => ({ min: Math.round((p.t / 60) * 10) / 10, hr: p.hr }))
  const lo = Math.max(40, Math.min(...series.map((p) => p.hr)) - 8), hi = Math.max(...series.map((p) => p.hr)) + 8
  return (
    <div style={{ height: 190 }} role="img" aria-label="Fréquence cardiaque">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
          {zoneBands(maxHr).map((z) => <ReferenceArea key={z.zone} y1={Math.max(z.from, lo)} y2={Math.min(z.to, hi)} fill={ZONE_COLORS[z.zone - 1]} fillOpacity={0.14} ifOverflow="hidden" />)}
          <XAxis dataKey="min" type="number" domain={[0, 'dataMax']} tick={axis} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(Number(v))}`} unit=" min" />
          <YAxis domain={[lo, hi]} tick={axis} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<Tip render={(p) => `${Math.round(p.min)} min · ${p.hr} bpm`} />} />
          <Line type="monotone" dataKey="hr" stroke="#FF453A" strokeWidth={2.4} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Effort perçu (1-10) des dernières sorties. */
export function RpeChart({ points }: { points: { date: string; rpe: number }[] }) {
  const data = points.map((p) => ({ name: shortDate(p.date), rpe: p.rpe }))
  return (
    <div style={{ height: 150 }} role="img" aria-label="Effort perçu des dernières sorties">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 10, left: -26, bottom: 0 }}>
          <CartesianGrid stroke="var(--sep)" strokeDasharray="3 5" vertical={false} />
          <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis domain={[1, 10]} ticks={[1, 3, 5, 7, 9]} tick={axis} axisLine={false} tickLine={false} />
          <ReferenceLine y={9} stroke="#FF453A" strokeDasharray="4 4" strokeOpacity={0.5} />
          <Tooltip content={<Tip render={(p, l) => `${l} · effort ${p.rpe}/10`} />} />
          <Line type="monotone" dataKey="rpe" stroke={COURSE} strokeWidth={3} dot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)', fill: COURSE }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Pas et durée de sommeil des 7 derniers jours. */
export function HealthBars({ days }: { days: HealthDay[] }) {
  const data = days.map((d) => ({ name: shortDate(d.date), steps: d.steps ?? null, sleep: d.sleepMinutes || null }))
  const mini = (key: 'steps' | 'sleep', color: string, label: string, fmt: (v: number) => string) => (
    <div>
      <div className="text-[12.5px] text-muted font-semibold mb-1 px-1">{label}</div>
      <div style={{ height: 96 }} role="img" aria-label={label}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }} barCategoryGap="22%">
            <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} interval={0} />
            <YAxis hide domain={[0, 'dataMax']} />
            <Tooltip cursor={{ fill: 'var(--surface2)', radius: 6 }} content={<Tip render={(p, l) => `${l} · ${p[key] == null ? 'pas de données' : fmt(p[key])}`} />} />
            <Bar dataKey={key} fill={color} radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
  return (
    <div className="flex flex-col gap-3">
      {mini('steps', 'var(--steps)', 'Pas par jour', (v) => `${v.toLocaleString('fr-FR')} pas`)}
      {mini('sleep', 'var(--sleep)', 'Sommeil par nuit', (v) => fmtSleep(v))}
    </div>
  )
}
