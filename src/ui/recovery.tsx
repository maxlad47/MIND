// Récupération, partie légère (sans Recharts) : carte de l'accueil, barre des phases, objectif de pas.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fmtSleep, fmtSteps, healthOn } from '@/engine/runs'
import { lastNight, scoreLabel, type Phases } from '@/engine/recovery'
import { addDays, DAY_NAMES, todayISO, weekday } from '@/engine/utils'
import { setStepGoal, stepGoalOf, useDB } from '@/lib/store'
import { Button, Card, Chip, Icon, Sheet, toast } from './kit'

export const SLEEP = 'var(--sleep)'
export const STEPS = 'var(--steps)'
export const PHASES: { key: keyof Phases; label: string; color: string }[] = [
  { key: 'deepMin', label: 'Profond', color: 'var(--ph-deep)' },
  { key: 'lightMin', label: 'Léger', color: 'var(--ph-light)' },
  { key: 'remMin', label: 'Paradoxal', color: 'var(--ph-rem)' },
  { key: 'awakeMin', label: 'Éveillé', color: 'var(--ph-awake)' },
]

/** « nuit du lundi au mardi » : la nuit porte la date du réveil. */
export function nightLabel(date: string): string {
  return `nuit du ${DAY_NAMES[weekday(addDays(date, -1))]} au ${DAY_NAMES[weekday(date)]}`
}

/** Barre horizontale des phases d'une nuit. */
export function PhaseBar({ phases, height = 8 }: { phases: Phases; height?: number }) {
  const tot = PHASES.reduce((a, p) => a + (phases[p.key] ?? 0), 0)
  if (!tot) return null
  return (
    <div className="flex w-full overflow-hidden rounded-full gap-[2px]" style={{ height }} role="img" aria-label={PHASES.map((p) => `${p.label} ${phases[p.key] ?? 0} min`).join(', ')}>
      {PHASES.map((p) => (phases[p.key] ? <div key={p.key} style={{ width: `${((phases[p.key] ?? 0) / tot) * 100}%`, background: p.color }} /> : null))}
    </div>
  )
}

/** Accueil : la dernière nuit et les pas du jour, rien d'autre. Toucher ouvre la page Récupération. */
export function RecoveryCard({ clientId }: { clientId: string }) {
  const db = useDB()
  const nav = useNavigate()
  const today = todayISO()
  const night = lastNight(db.health, clientId, today)
  const h = healthOn(db.health, clientId, today)
  const goal = stepGoalOf(db, clientId)
  const recentNight = night && night.date >= addDays(today, -1) ? night : undefined
  if (!recentNight && h?.steps === undefined) return null
  const steps = h?.steps
  return (
    <Card className="p-4 mb-4" onClick={() => nav('/recovery')}>
      <div className="flex items-center justify-between mb-2.5">
        <div className="t-over text-muted">Récupération</div>
        <Icon name="chevron" size={16} color="var(--faint)" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: SLEEP }}><Icon name="moon" size={15} />Nuit</div>
          {recentNight ? (<>
            <div className="text-[24px] font-extrabold tracking-tight num leading-tight mt-0.5">{fmtSleep(recentNight.sleepMinutes!)}</div>
            <div className="text-[12.5px] text-muted truncate">{recentNight.sleepScore ? `score ${recentNight.sleepScore} · ${scoreLabel(recentNight.sleepScore)}` : recentNight.date === today ? 'cette nuit' : 'nuit dernière'}</div>
            {recentNight.sleepPhases && <div className="mt-2"><PhaseBar phases={recentNight.sleepPhases} height={5} /></div>}
          </>) : <div className="text-[15px] text-muted mt-1">pas encore reçue</div>}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: STEPS }}><Icon name="steps" size={15} />Pas</div>
          {steps !== undefined ? (<>
            <div className="text-[24px] font-extrabold tracking-tight num leading-tight mt-0.5">{fmtSteps(steps)}</div>
            <div className="text-[12.5px] text-muted truncate">{goal ? (steps >= goal ? 'objectif atteint' : `objectif ${fmtSteps(goal)}`) : 'aujourd\'hui'}</div>
            {goal ? <div className="mt-2 h-[5px] rounded-full bg-surface2 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(100, (steps / goal) * 100)}%`, background: STEPS }} /></div> : null}
          </>) : <div className="text-[15px] text-muted mt-1">pas encore reçus</div>}
        </div>
      </div>
    </Card>
  )
}

const PRESETS = [6000, 8000, 10000, 12000, 15000]

/** Choisir un objectif de pas par jour, ou aucun. */
export function StepGoalSheet({ open, onClose, clientId }: { open: boolean; onClose: () => void; clientId: string }) {
  const db = useDB()
  const goal = stepGoalOf(db, clientId)
  const [custom, setCustom] = useState('')
  useEffect(() => { if (open) setCustom(goal && !PRESETS.includes(goal) ? String(goal) : '') }, [open, goal])
  const save = (n: number | undefined) => {
    setStepGoal(clientId, n)
    toast(n ? `Objectif : ${fmtSteps(n)} pas par jour` : 'Objectif de pas retiré')
    onClose()
  }
  const n = Number(custom)
  return (
    <Sheet open={open} onClose={onClose} title="Objectif de pas">
      <div className="flex flex-col gap-4">
        <p className="text-[14.5px] text-muted leading-snug">Un objectif par jour, si tu en veux un. Ta progression s'affiche sur l'accueil et dans Récupération. Sans objectif, tu vois simplement tes pas et ta moyenne.</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => <Chip key={p} color={STEPS} active={goal === p} onClick={() => save(p)}>{fmtSteps(p)}</Chip>)}
        </div>
        <div className="flex items-center gap-2">
          <input inputMode="numeric" aria-label="Autre objectif de pas" placeholder="Autre (ex. 9 000)" value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, '').slice(0, 5))}
            className="flex-1 bg-surface2 rounded-[12px] h-12 px-3.5 outline-none font-semibold num" />
          <Button small color={STEPS} disabled={!(n >= 1000 && n <= 50000)} onClick={() => save(Math.round(n / 100) * 100)}>Valider</Button>
        </div>
        {goal !== undefined && <Button full variant="secondary" onClick={() => save(undefined)}>Pas d'objectif</Button>}
      </div>
    </Sheet>
  )
}
