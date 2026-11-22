import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { alternativesFor, EXERCISES, EXERCISE_BY_ID, isAllowed } from '@/engine/exercises'
import { describeBlock } from '@/engine/running'
import { ZONES, MUSCLE_LABEL, PATTERN_LABEL, type Muscle, type Program, type Session, type Zone } from '@/engine/types'
import { addDays, DAY_NAMES, DAY_SHORT, fmtKm, parseDate, prettyDate, shortDate, todayISO } from '@/engine/utils'
import { addCheckin, markNotificationsRead, useDB, type AppNotification } from '@/lib/store'
import { motion } from 'framer-motion'
import { Button, Card, Chip, Cover, Icon, Sheet, SportIcon, spring, toast } from './kit'

export const sportOf = (s: Session) => s.sport
export const statusLabel: Record<string, string> = { prevue: 'Prévue', faite: 'Faite', manquee: 'Manquée', sautee: 'Sautée' }

export function sessionMeta(s: Session): string {
  if (s.run) return `${fmtKm(s.run.totalKm)} km · ${s.estMinutes} min`
  return `${s.exercises?.length ?? 0} exercices · ${s.estMinutes} min`
}

export function sessionSubtitle(s: Session): string {
  if (s.run) {
    const b = s.run.blocks[0]
    return b ? describeBlock(b) : ''
  }
  return (s.exercises ?? []).slice(0, 3).map((e) => EXERCISE_BY_ID[e.exerciseId]?.name).filter(Boolean).join(' · ')
}

/** Carte « pochette » pour carrousel : grande pochette carrée, titre dessus, date et durée dessous. */
export function SessionTile({ s, onClick, width = 168 }: { s: Session; onClick: () => void; width?: number }) {
  return (
    <motion.button onClick={onClick} whileTap={{ scale: 0.96 }} transition={spring} className="snap-start shrink-0 self-start text-left align-top" style={{ width, display: 'block' }}>
      <Cover seed={s.id + s.title} sports={[s.sport]} kind={s.kind} className="rounded-[20px]" style={{ width, height: width, boxShadow: 'var(--shadow-cover)' }}>
        <div className="absolute top-2.5 left-2.5 w-8 h-8 rounded-full glass-dark flex items-center justify-center"><SportIcon sport={s.sport} size={17} color="#fff" /></div>
        {s.status === 'faite' && <div className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-ok text-white flex items-center justify-center shadow"><Icon name="check" size={16} strokeWidth={3} /></div>}
        {s.status === 'manquee' && <div className="absolute top-2.5 right-2.5 rounded-full bg-bad text-white text-[11px] font-bold px-2.5 h-6 flex items-center shadow">Manquée</div>}
        <div className="absolute bottom-0 inset-x-0 p-3 text-white">
          <div className="text-[18px] font-extrabold leading-[1.1] tracking-tight" style={{ textShadow: '0 1px 8px rgba(0,0,0,.35)' }}>{s.title}</div>
        </div>
      </Cover>
      <div className="mt-2 text-[14px] font-semibold cap-first leading-tight">{prettyDate(s.date)}</div>
      <div className="text-[12.5px] text-muted mt-0.5">{sessionMeta(s)}</div>
    </motion.button>
  )
}

export function WarningBanner({ program, onFinish, onChangeGoal }: { program: Program; onFinish?: () => void; onChangeGoal?: () => void }) {
  const list = program.warnings.filter((w) => ['prepa_trop_courte', 'chrono_irrealiste', 'muscu_prioritaire_course', 'conflit_placement'].includes(w.code))
  if (!list.length) return null
  return (
    <div className="flex flex-col gap-3 mb-4">
      {list.map((w) => (
        <Card key={w.code} className="p-4" style={{ background: 'color-mix(in srgb, #FF9F0A 13%, var(--surface))', boxShadow: 'inset 0 0 0 1px color-mix(in srgb, #FF9F0A 28%, transparent)' }}>
          <div className="flex gap-3">
            <div style={{ color: '#FF9F0A' }}><Icon name="alert" /></div>
            <div className="flex-1">
              <div className="text-[15px] font-semibold">{w.message}</div>
              {w.suggestion && <div className="text-[14px] text-muted mt-1">{w.suggestion}</div>}
              {(w.code === 'prepa_trop_courte' || w.code === 'chrono_irrealiste') && (onFinish || onChangeGoal) && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  {onFinish && program.objective === 'chrono' && <Button small variant="secondary" onClick={onFinish}>Passer en « Finir »</Button>}
                  {onChangeGoal && <Button small variant="secondary" onClick={onChangeGoal}>Modifier l'objectif</Button>}
                </div>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

// ------------------------------------------------------------------ notifications
export function NotificationsSheet({ open, onClose, userId }: { open: boolean; onClose: () => void; userId: string }) {
  const db = useDB()
  const nav = useNavigate()
  const list = db.notifications.filter((n) => n.userId === userId).sort((a, b) => b.at.localeCompare(a.at))
  const go = (n: AppNotification) => { markNotificationsRead(userId); onClose(); if (n.link) nav(n.link) }
  return (
    <Sheet open={open} onClose={() => { markNotificationsRead(userId); onClose() }} title="Notifications">
      {list.length === 0 ? <div className="py-10 text-center"><div className="mx-auto w-14 h-14 rounded-[20px] bg-surface2 flex items-center justify-center text-muted mb-3"><Icon name="bell" size={26} /></div><div className="font-bold">Rien pour l'instant</div><p className="text-muted text-[14px] mt-1">Tes rappels et les messages de ton coach arriveront ici.</p></div> : (
        <div className="flex flex-col gap-2">
          {list.map((n) => (
            <button key={n.id} onClick={() => go(n)} className="tap text-left bg-surface2 rounded-[16px] p-3.5 flex gap-3">
              {!n.read && <span className="w-2.5 h-2.5 mt-1.5 rounded-full shrink-0" style={{ background: 'var(--accent)' }} />}
              <div className="flex-1">
                <div className="font-semibold text-[15px]">{n.title}</div>
                <div className="text-[14px] text-muted line-clamp-2">{n.body}</div>
                <div className="text-[12px] text-muted mt-1">{new Date(n.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </Sheet>
  )
}

export function BellButton({ userId, onClick }: { userId: string; onClick: () => void }) {
  const db = useDB()
  const unread = db.notifications.filter((n) => n.userId === userId && !n.read).length
  return (
    <button onClick={onClick} className="tap hit relative w-10 h-10 flex items-center justify-center" aria-label="Notifications" style={{ color: 'var(--text)' }}>
      <Icon name="bell" />
      {unread > 0 && <span className="absolute top-0.5 right-0 min-w-[18px] h-[18px] rounded-full bg-bad text-white text-[11px] font-bold flex items-center justify-center px-1">{unread}</span>}
    </button>
  )
}

// ------------------------------------------------------------------ check-in avant séance
function Scale({ label, value, onChange, low, high }: { label: string; value: number; onChange: (v: number) => void; low: string; high: string }) {
  return (
    <div>
      <div className="flex justify-between text-[15px] mb-1.5"><span className="font-semibold">{label}</span><span className="text-muted text-[13px]">{low} → {high}</span></div>
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => onChange(n)} className="tap h-12 rounded-[14px] font-bold text-[17px]" style={{ background: value === n ? 'var(--accent)' : 'var(--surface2)', color: value === n ? '#fff' : 'var(--text)' }}>{n}</button>
        ))}
      </div>
    </div>
  )
}

export function CheckinSheet({ open, onClose, clientId, sessionId, onDone }: { open: boolean; onClose: () => void; clientId: string; sessionId: string; onDone: () => void }) {
  const [energy, setEnergy] = useState(4)
  const [sleep, setSleep] = useState(4)
  const [sore, setSore] = useState(2)
  const [pain, setPain] = useState(false)
  const [zone, setZone] = useState<Zone | undefined>()
  const submit = () => {
    addCheckin({ clientId, sessionId, date: todayISO(), energy, sleep, soreness: sore, pain, painZone: pain ? zone : undefined })
    const low = (energy + sleep + (6 - sore)) / 3 <= 2.5
    if (pain && zone) toast('Séance adaptée à ta douleur. Ton coach est prévenu.')
    else if (low) toast('Forme basse : séance allégée de 30 %.')
    onDone()
  }
  return (
    <Sheet open={open} onClose={onClose} title="Comment te sens-tu ?" tall>
      <div className="flex flex-col gap-5 pt-1">
        <Scale label="Énergie" value={energy} onChange={setEnergy} low="vide" high="en forme" />
        <Scale label="Sommeil" value={sleep} onChange={setSleep} low="mauvais" high="excellent" />
        <Scale label="Courbatures" value={sore} onChange={setSore} low="aucune" high="fortes" />
        <div>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[15px]">Une douleur ?</span>
            <div className="flex gap-2"><Chip active={!pain} onClick={() => setPain(false)} color="#30D158">Non</Chip><Chip active={pain} onClick={() => setPain(true)} color="#FF453A">Oui</Chip></div>
          </div>
          {pain && (
            <div className="flex flex-wrap gap-2 mt-3">
              {ZONES.map((z) => <Chip key={z.id} active={zone === z.id} onClick={() => setZone(z.id)} color="#FF453A">{z.label}</Chip>)}
            </div>
          )}
        </div>
        <Button full onClick={submit} disabled={pain && !zone}>C'est parti</Button>
        <button className="tap text-muted text-[15px] text-center" onClick={onDone}>Passer le check-in</button>
      </div>
    </Sheet>
  )
}

// ------------------------------------------------------------------ choix d'exercice
export function ExercisePicker({ open, onClose, onPick, title = 'Choisir un exercice', injuries, level, replacing, excluded = [] }: {
  open: boolean; onClose: () => void; onPick: (id: string) => void; title?: string; injuries: Zone[]; level?: 'debutant' | 'intermediaire' | 'avance'; replacing?: string; excluded?: Muscle[]
}) {
  const [q, setQ] = useState('')
  const alts = replacing ? alternativesFor(replacing, injuries) : []
  const pool = (replacing ? alts : EXERCISES.filter((e) => isAllowed(e, injuries) && !excluded.includes(e.muscle)))
    .filter((e) => e.name.toLowerCase().includes(q.toLowerCase()) || MUSCLE_LABEL[e.muscle].toLowerCase().includes(q.toLowerCase()))
  void level
  return (
    <Sheet open={open} onClose={onClose} title={title} tall>
      {replacing && (
        <p className="text-[14px] text-muted mb-3">Même muscle ({MUSCLE_LABEL[EXERCISE_BY_ID[replacing].muscle]}) et même schéma ({PATTERN_LABEL[EXERCISE_BY_ID[replacing].pattern]}), hors exercices contre-indiqués pour toi.</p>
      )}
      {!replacing && <input className="w-full h-11 rounded-[14px] bg-surface2 px-4 mb-3 outline-none focus:ring-2 focus:ring-inset focus:ring-accent/60" placeholder="Rechercher" value={q} onChange={(e) => setQ(e.target.value)} />}
      {pool.length === 0 && <p className="text-muted text-center py-6">Aucune alternative sans contre-indication.</p>}
      <div className="flex flex-col gap-2">
        {pool.map((e) => (
          <button key={e.id} className="tap text-left bg-surface2 rounded-xl p-3" style={{ borderRadius: 16, padding: 14 }} onClick={() => { onPick(e.id); onClose() }}>
            <div className="font-semibold">{e.name}</div>
            <div className="text-[13px] text-muted">{MUSCLE_LABEL[e.muscle]} · {PATTERN_LABEL[e.pattern]}</div>
            <div className="text-[13px] text-muted mt-0.5">{e.cue}</div>
          </button>
        ))}
      </div>
    </Sheet>
  )
}

export { shortDate }

// ------------------------------------------------------------------ bandeau de la semaine
/** Sept pastilles (L → D) : anneau couleur du sport = séance prévue, plein + coche = faite, point rouge = manquée. */
export function WeekStrip({ start, sessions, today, onOpen }: { start: string; sessions: Session[]; today: string; onOpen: (id: string) => void }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  return (
    <div className="grid grid-cols-7">
      {days.map((d, i) => {
        const list = sessions.filter((s) => s.date === d && s.status !== 'sautee')
        const done = list.length > 0 && list.every((s) => s.status === 'faite')
        const missed = list.some((s) => s.status === 'manquee')
        const sports = [...new Set(list.map((s) => s.sport))] as ('muscu' | 'course')[]
        const cols = sports.map((x) => (x === 'muscu' ? 'var(--muscu)' : '#FF9F0A'))
        const ring = cols.length > 1 ? `conic-gradient(${cols[0]} 0 50%, ${cols[1]} 50% 100%)` : cols[0]
        const isToday = d === today
        const first = list[0]
        return (
          <button key={d} disabled={!first} onClick={() => first && onOpen(first.id)} aria-label={`${DAY_NAMES[i]}${list.length ? ` : ${list.map((s) => s.title).join(', ')}` : ' : repos'}`}
            className={`${first ? 'tap' : ''} flex flex-col items-center gap-1.5 py-1 min-h-[44px] min-w-[44px]`}>
            <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: isToday ? 'var(--accent)' : 'var(--muted)' }}>{DAY_SHORT[i]}</span>
            <span className="relative w-9 h-9 rounded-full flex items-center justify-center text-[14px] font-bold num"
              style={done
                ? { background: ring, color: '#fff' }
                : list.length
                  ? { background: ring, padding: 2.5, color: 'var(--text)' }
                  : { background: 'var(--surface2)', color: 'var(--muted)' }}>
              {done ? <Icon name="check" size={18} strokeWidth={3} /> : list.length ? (
                <span className="w-full h-full rounded-full flex items-center justify-center" style={{ background: 'var(--surface)' }}>{parseDate(d).getUTCDate()}</span>
              ) : parseDate(d).getUTCDate()}
              {missed && !done && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-bad border-2 border-surface" />}
            </span>
            {isToday ? <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} /> : <span className="w-1.5 h-1.5" />}
          </button>
        )
      })}
    </div>
  )
}
