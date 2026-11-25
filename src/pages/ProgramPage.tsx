import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { allSessions, currentWeek } from '@/engine/adapt'
import { isLibre } from '@/engine/libre'
import { bestDayFor, conflictsOfWeek, daysFor } from '@/engine/combine'
import type { Session } from '@/engine/types'
import { addDays, DAY_NAMES, shortDate, todayISO, weekday } from '@/engine/utils'
import { deleteSession, moveSession, programOf, restoreSession, sessionHasData, undoAdaptationById, useDB } from '@/lib/store'
import { tick } from '@/lib/haptics'
import { motion } from 'framer-motion'
import { Button, Card, Chip, Cover, EmptyState, Icon, Sheet, SectionTitle, SportIcon, spring, toast } from '@/ui/kit'
import { coverSeed, sessionMeta, statusLabel, tintOf } from '@/ui/parts'
import { PHASE_COLOR } from '@/ui/cover'


function SessionRow({ s, canEdit, onOpen, onMenu, dragging }: { s: Session; canEdit: boolean; onOpen: () => void; onMenu?: () => void; dragging?: boolean }) {
  const movable = canEdit && s.status === 'prevue'
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: s.id, disabled: !movable })
  const stColor = s.status === 'faite' ? '#30D158' : s.status === 'manquee' ? '#FF453A' : '#8E8E93'
  return (
    <div ref={setNodeRef} {...(movable ? listeners : {})} {...(movable ? attributes : {})} data-session={s.id}
      className="flex items-center gap-3 bg-surface rounded-[18px] p-2.5 pr-1 select-none"
      style={{ opacity: isDragging && !dragging ? 0.3 : 1, WebkitTouchCallout: 'none', WebkitUserSelect: 'none', boxShadow: dragging ? '0 18px 40px rgba(0,0,0,.45)' : 'var(--shadow-card)', transform: dragging ? 'scale(1.03) rotate(-0.6deg)' : undefined }}>
      <button onClick={onOpen} className="tap flex items-center gap-3 flex-1 min-w-0 text-left">
        <Cover seed={coverSeed(s)} sports={[tintOf(s)]} kind={s.kind} scrim={false} className="rounded-[13px] shrink-0" style={{ width: 54, height: 54 }}>
          <div className="absolute inset-0 flex items-center justify-center"><SportIcon sport={s.sport} size={23} color="#fff" /></div>
        </Cover>
        <div className="min-w-0">
          <div className="font-bold text-[16px] leading-tight truncate">{s.title}</div>
          <div className="text-[13px] text-muted mt-0.5">{sessionMeta(s)}{s.slot ? ` · ${s.slot === 'am' ? 'matin' : 'soir'}` : ''}</div>
          {s.movedFrom && <div className="text-[12px] font-semibold" style={{ color: '#FF9F0A' }}>Déplacée</div>}
        </div>
      </button>
      {s.status !== 'prevue' && (
        <span className="mr-2 inline-flex items-center gap-1 rounded-full px-2.5 h-7 text-[13px] font-bold" style={{ background: `color-mix(in srgb, ${stColor} 17%, transparent)`, color: stColor }}>
          {s.status === 'faite' && <Icon name="check" size={14} strokeWidth={3} />}{statusLabel[s.status]}
        </span>
      )}
      {movable && (
        <button onClick={onMenu} aria-label="Déplacer" className="tap w-11 h-12 flex items-center justify-center text-faint">
          <Icon name="grip" size={22} strokeWidth={3} />
        </button>
      )}
    </div>
  )
}

const ACTION_W = 92 // largeur du bouton « Supprimer » révélé

/**
 * Balayage vers la gauche, comme dans Messages sur iPhone : révèle « Supprimer » ; un balayage long supprime d'un coup.
 * Doigt seulement (la souris sert au glisser-déposer). Un appui long reste réservé au déplacement de la séance.
 */
function SwipeToDelete({ id, openId, setOpenId, onDelete, children }: { id: string; openId: string | null; setOpenId: (v: string | null) => void; onDelete: () => 'remove' | 'keep'; children: React.ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null)
  const g = useRef<{ x0: number; y0: number; t0: number; base: number; mode: 'wait' | 'swipe' | 'off'; armed: boolean } | null>(null)
  const swiped = useRef(false)
  const [x, setX] = useState(0)
  const [drag, setDrag] = useState(false)
  const [gone, setGone] = useState<number | null>(null) // hauteur de départ pendant la disparition
  const open = openId === id
  const width = () => wrap.current?.offsetWidth ?? 360

  // une autre ligne s'ouvre, ou on touche ailleurs : celle-ci se referme
  useEffect(() => { if (!open && !drag && gone === null) setX(0) }, [open, drag, gone])
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpenId(null) }
    document.addEventListener('pointerdown', away, true)
    return () => document.removeEventListener('pointerdown', away, true)
  }, [open, setOpenId])

  const remove = () => {
    if (onDelete() === 'keep') { setOpenId(null); setX(0); return }
    const h = wrap.current?.offsetHeight ?? 0
    setX(-width())
    setGone(h)
    requestAnimationFrame(() => requestAnimationFrame(() => setGone(0)))
  }

  const down = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' || gone !== null) return
    g.current = { x0: e.clientX, y0: e.clientY, t0: Date.now(), base: open ? -ACTION_W : 0, mode: 'wait', armed: false }
  }
  const move = (e: React.PointerEvent) => {
    const s = g.current
    if (!s || s.mode === 'off') return
    const dx = e.clientX - s.x0
    const dy = e.clientY - s.y0
    if (s.mode === 'wait') {
      if (Date.now() - s.t0 > 230) { s.mode = 'off'; return } // appui long : c'est un déplacement de séance
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { s.mode = 'off'; return } // défilement de la page
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.2) return
      s.mode = 'swipe'
      swiped.current = true
      setDrag(true)
      if (!open) setOpenId(id)
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* ignore */ }
    }
    const w = width()
    let nx = s.base + dx
    if (nx > 0) nx = nx / 4 // un peu d'élastique vers la droite
    nx = Math.max(-w, nx)
    const armed = nx < -w * 0.55
    if (armed !== s.armed) { s.armed = armed; tick() }
    setX(nx)
  }
  const up = () => {
    const s = g.current
    g.current = null
    if (!s || s.mode !== 'swipe') return
    setDrag(false)
    if (s.armed) { remove(); return }
    if (x < -ACTION_W / 2) { setX(-ACTION_W); setOpenId(id) } else { setX(0); setOpenId(null) }
  }
  // après un balayage, ou ligne ouverte : le toucher ne doit pas ouvrir la séance
  const clickCapture = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-swipe-action]')) return
    if (swiped.current) { e.preventDefault(); e.stopPropagation(); swiped.current = false; return }
    if (open) { e.preventDefault(); e.stopPropagation(); setOpenId(null) }
  }

  const w = wrap.current?.offsetWidth ?? 360
  const full = x < -w * 0.55
  return (
    <div ref={wrap} className="relative rounded-[18px] overflow-hidden" data-swipe={id} onClickCapture={clickCapture} onPointerDownCapture={() => { swiped.current = false }}
      onTransitionEnd={(e) => { if (gone === 0 && e.target === wrap.current && e.propertyName === 'height') { setGone(null); setOpenId(null) } }}
      style={gone !== null ? { height: gone, opacity: gone ? 1 : 0, transition: 'height .24s ease, opacity .24s ease' } : undefined}>
      {x < 0 && (
        <div className="absolute inset-0 flex justify-end" style={{ background: '#FF3B30' }}>
          <button data-swipe-action aria-label="Supprimer la séance" onClick={remove}
            className="h-full flex flex-col items-center justify-center gap-0.5 text-white text-[13px] font-semibold"
            style={{ width: full ? '100%' : Math.max(ACTION_W, -x), alignItems: full ? 'flex-end' : 'center', paddingRight: full ? 22 : 0, transition: drag ? 'none' : 'width .25s ease' }}>
            <span className="flex flex-col items-center gap-0.5"><Icon name="trash" size={21} strokeWidth={2.2} />Supprimer</span>
          </button>
        </div>
      )}
      <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        style={{ transform: x ? `translateX(${x}px)` : undefined, transition: drag ? 'none' : 'transform .28s cubic-bezier(.2,.8,.2,1)', touchAction: 'pan-y' }}>
        {children}
      </div>
    </div>
  )
}

function DayColumn({ date, children, today, past }: { date: string; children: React.ReactNode; today: boolean; past: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: date })
  const d = weekday(date)
  const num = Number(date.slice(8, 10))
  return (
    <div ref={setNodeRef} className="rounded-[22px] p-2 transition-colors" style={{ background: isOver ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'transparent', outline: isOver ? '2px dashed var(--accent)' : 'none' }}>
      <div className="flex items-center gap-2.5 px-0.5 mb-2" style={{ opacity: past ? 0.55 : 1 }}>
        <span className="w-8 h-8 rounded-full flex items-center justify-center text-[15px] font-extrabold num" style={today ? { background: 'var(--accent)', color: 'var(--on-accent)' } : { background: 'var(--surface2)' }}>{num}</span>
        <span className="text-[16px] font-bold capitalize" style={{ color: today ? 'var(--accent)' : undefined }}>{DAY_NAMES[d]}</span>
        <span className="text-[13px] text-muted">{shortDate(date)}</span>
        {today && <span className="text-[10.5px] font-extrabold tracking-wide rounded-full px-2 py-0.5" style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>AUJOURD'HUI</span>}
      </div>
      <div className="flex flex-col gap-2 min-h-[28px]">{children}</div>
    </div>
  )
}

export function ProgramView({ clientId, canEdit = true }: { clientId: string; canEdit?: boolean }) {
  const db = useDB()
  const nav = useNavigate()
  const program = programOf(db, clientId)
  const today = todayISO()
  // la semaine consultée est retenue (le temps de la visite de l'app) : en revenant d'une séance, on reste sur la même semaine
  const weekKey = `mind.program.week.${program?.id ?? ''}`
  const [idx, setIdxState] = useState<number | null>(() => {
    try { const v = Number(sessionStorage.getItem(weekKey)); return v >= 1 ? v : null } catch { return null }
  })
  const setIdx = (v: number | null) => {
    setIdxState(v)
    try { if (v === null) sessionStorage.removeItem(weekKey); else sessionStorage.setItem(weekKey, String(v)) } catch { /* stockage indisponible */ }
  }
  const [activeId, setActiveId] = useState<string | null>(null)
  const [pending, setPending] = useState<{ s: Session; date: string; conflicts: string[]; suggestion: number | null } | null>(null)
  // souris : on glisse directement ; doigt : appui long (~0,25 s) puis glisser, pour ne pas gêner le défilement de la page
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }))
  const [menu, setMenu] = useState<Session | null>(null)
  const [openSwipe, setOpenSwipe] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState<Session | null>(null)

  if (!program) return <EmptyState icon="program" title="Pas encore de programme" text="Le programme apparaîtra ici dès que le formulaire d'entrée sera rempli." />

  const libre = isLibre(program)
  const curN = currentWeek(program, today).n
  const n = idx ?? curN
  const week = program.weeks.find((w) => w.n === n) ?? program.weeks[0]
  const days = Array.from({ length: 7 }, (_, i) => addDays(week.startDate, i))
  const available = program.q.availableDays
  const adaptations = db.adaptations.filter((a) => a.programId === program.id && a.status === 'applique' && a.undo).slice(0, 6)
  const activeSession = activeId ? allSessions(program).find((s) => s.id === activeId) : undefined

  const onStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id))
    try { navigator.vibrate?.(15) } catch { /* pas de vibration sur iPhone */ }
  }
  const slotFor = (s: Session, date: string) => (week.sessions.some((x) => x.date === date && x.id !== s.id && x.status !== 'sautee') ? (s.sport === 'course' ? 'am' : 'pm') : undefined)
  /** Déplace une séance sur un jour de la semaine affichée ; avertit en cas de conflit, autorise les doubles séances. */
  const attemptMove = (s: Session, date: string) => {
    if (date === s.date) return
    const after = week.sessions.map((x) => (x.id === s.id ? { ...x, date } : x))
    const conflicts = conflictsOfWeek(after, week.startDate)
    if (conflicts.length) {
      const day = bestDayFor(week.sessions, s.id, week.startDate, daysFor(s, available.length ? available : [0, 1, 2, 3, 4, 5, 6], program.q.dayPrefs ? { ...program.q.dayPrefs, longRun: undefined } : {}), {}, today)
      setPending({ s, date, conflicts, suggestion: day })
      return
    }
    const double = week.sessions.some((x) => x.date === date && x.id !== s.id && x.status !== 'sautee')
    moveSession(program.id, s.id, date, slotFor(s, date))
    toast(double ? 'Double séance : course le matin, muscu le soir' : `Séance déplacée au ${DAY_NAMES[weekday(date)]}`)
  }
  const onEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const s = week.sessions.find((x) => x.id === e.active.id)
    if (s && e.over) attemptMove(s, String(e.over.id))
  }
  const doDelete = (s: Session) => {
    const undo = deleteSession(program.id, s.id)
    toast(`« ${s.title} » supprimée`, { label: 'Annuler', run: () => { undo(); toast('Séance remise dans l\'agenda') } })
  }
  /** Balayage « Supprimer » : tout de suite si la séance est vierge, après confirmation si des données seraient perdues. */
  const askDelete = (s: Session): 'remove' | 'keep' => {
    if (sessionHasData(s)) { setConfirmDel(s); return 'keep' }
    setTimeout(() => doDelete(s), 240) // le temps que la ligne s'efface
    return 'remove'
  }

  return (
    <div>
      {/* frise des phases : sélecteur de semaine défilant (cellules de 44 px), la semaine choisie reste centrée */}
      <div ref={(el) => { if (el && !el.dataset.init) { el.dataset.init = '1'; const b = el.querySelector<HTMLElement>(`[data-week="${n}"]`); if (b) el.scrollLeft = b.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft - el.clientWidth / 2 + b.clientWidth / 2 } }} className="-mx-4 px-4 flex gap-1 overflow-x-auto hide-scroll overscroll-x-contain mb-2.5 snap-x snap-proximity">
        {program.weeks.map((w) => (
          <button key={w.n} data-week={w.n} onClick={(e) => { setIdx(w.n); e.currentTarget.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }) }} aria-label={`Semaine ${w.n}`} className="tap snap-center h-11 w-11 shrink-0 rounded-[12px] text-[13px] font-extrabold num"
            style={{ background: w.n === n ? PHASE_COLOR[w.phase] : `color-mix(in srgb, ${PHASE_COLOR[w.phase]} 24%, var(--surface))`, color: w.n === n ? '#fff' : 'var(--text)', boxShadow: w.n === curN ? `inset 0 0 0 2px ${w.n === n ? 'rgba(255,255,255,.85)' : 'var(--text)'}` : 'none' }}>
            {w.n}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3.5 gap-y-1 mb-4 px-0.5">
        {[...new Set(program.weeks.map((w) => w.phase))].map((ph) => (
          <span key={ph} className="inline-flex items-center gap-1.5 text-[12px] text-muted font-medium"><span className="w-2 h-2 rounded-full" style={{ background: PHASE_COLOR[ph] }} />{ph}</span>
        ))}
      </div>

      <div className="card p-2 flex items-center justify-between mb-1">
        <button className="tap w-11 h-11 rounded-full flex items-center justify-center disabled:opacity-25" aria-label="Semaine précédente" disabled={n <= 1} onClick={() => setIdx(n - 1)}><Icon name="back" strokeWidth={2.4} /></button>
        <motion.div key={week.n} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="text-center">
          <div className="text-[19px] font-extrabold tracking-tight">{libre ? `Semaine du ${shortDate(week.startDate)}` : `Semaine ${week.n}/${program.weeks.length}`}</div>
          <div className="text-[13.5px] font-semibold" style={{ color: PHASE_COLOR[week.phase] }}>{libre ? 'Mon carnet' : <>{week.phase}{week.light ? ' · allégée' : ''}</>}<span className="text-muted font-medium"> · {Number(week.startDate.slice(8))}–{shortDate(addDays(week.startDate, 6))}</span></div>
        </motion.div>
        <button className="tap w-11 h-11 rounded-full flex items-center justify-center disabled:opacity-25" aria-label="Semaine suivante" disabled={n >= program.weeks.length} onClick={() => setIdx(n + 1)}><Icon name="chevron" strokeWidth={2.4} /></button>
      </div>

      {canEdit && <p className="text-[12.5px] text-muted text-center mt-3 px-4 leading-snug">Maintiens une séance puis glisse-la sur un autre jour, ou touche <span className="inline-block align-middle text-faint"><Icon name="grip" size={14} strokeWidth={3} /></span> pour choisir le jour. Balaie vers la gauche pour la supprimer.</p>}
      {week.note && (
        <Card className="p-3.5 mt-3 mb-1"><div className="flex gap-2.5 text-[14.5px] leading-snug"><span style={{ color: 'var(--accent)' }}><Icon name="sparkle" size={18} /></span><span>{week.note}</span></div></Card>
      )}

      <DndContext sensors={sensors} onDragStart={onStart} onDragEnd={onEnd} onDragCancel={() => setActiveId(null)} autoScroll={{ threshold: { x: 0, y: 0.18 }, acceleration: 18 }}>
        <div className="flex flex-col gap-1 mt-3">
          {days.map((date) => {
            const list = week.sessions.filter((s) => s.date === date && s.status !== 'sautee').sort((a, b) => (a.slot === 'am' ? -1 : 1) - (b.slot === 'am' ? -1 : 1))
            return (
              <DayColumn key={date} date={date} today={date === today} past={date < today}>
                {list.length === 0 ? (
                  <div className="text-[13px] text-faint font-medium rounded-[14px] border border-dashed border-sep px-3 h-10 flex items-center">{available.length && !available.includes(weekday(date)) ? 'Repos' : 'Libre'}</div>
                ) : list.map((s) => {
                  const row = <SessionRow key={s.id} s={s} canEdit={canEdit} onOpen={() => nav(`/session/${s.id}`)} onMenu={() => setMenu(s)} />
                  return canEdit ? <SwipeToDelete key={s.id} id={s.id} openId={openSwipe} setOpenId={setOpenSwipe} onDelete={() => askDelete(s)}>{row}</SwipeToDelete> : row
                })}
              </DayColumn>
            )
          })}
        </div>
        <DragOverlay>{activeSession ? <SessionRow s={activeSession} canEdit={false} dragging onOpen={() => {}} /> : null}</DragOverlay>
      </DndContext>

      {week.sessions.some((s) => s.status === 'sautee') && (
        <>
          <SectionTitle>Séances sautées</SectionTitle>
          <div className="flex flex-col gap-2">
            {week.sessions.filter((s) => s.status === 'sautee').map((s) => (
              <Card key={s.id} className="p-3 flex items-center gap-3"><div className="flex-1"><div className="font-semibold">{s.title}</div><div className="text-[13px] text-muted">{shortDate(s.date)}</div></div>
                {canEdit && <Button small variant="secondary" onClick={() => restoreSession(program.id, s.id)}>Remettre</Button>}</Card>
            ))}
          </div>
        </>
      )}

      {adaptations.length > 0 && (
        <>
          <SectionTitle>Adaptations automatiques</SectionTitle>
          <div className="flex flex-col gap-2">
            {adaptations.map((a) => (
              <Card key={a.id} className="p-3.5 flex items-start gap-3">
                <span style={{ color: '#FF9F0A' }}><Icon name="sparkle" size={18} /></span>
                <div className="flex-1 text-[14.5px]">{a.text}<div className="text-[12px] text-muted mt-0.5">{shortDate(a.date)}</div></div>
                {canEdit && <button className="tap text-[14px] font-semibold flex items-center gap-1" style={{ color: 'var(--accent)' }} onClick={() => { undoAdaptationById(a.id); toast('Adaptation annulée') }}><Icon name="undo" size={15} /> Annuler</button>}
              </Card>
            ))}
          </div>
        </>
      )}

      <Sheet open={!!menu} onClose={() => setMenu(null)} title={menu ? `Déplacer « ${menu.title} »` : ''}>
        {menu && (
          <div className="flex flex-col gap-2">
            {days.map((date) => {
              const here = week.sessions.filter((x) => x.date === date && x.id !== menu.id && x.status !== 'sautee')
              const current = date === menu.date
              return (
                <button key={date} disabled={current} onClick={() => { const m = menu; setMenu(null); attemptMove(m, date) }}
                  className="tap flex items-center justify-between rounded-[16px] px-4 h-14 bg-surface2 text-left disabled:opacity-40">
                  <span className="font-semibold capitalize whitespace-nowrap shrink-0">{DAY_NAMES[weekday(date)]} <span className="text-muted font-normal">{shortDate(date)}</span></span>
                  <span className="text-[13px] text-muted min-w-0 truncate pl-3">{current ? 'Jour actuel' : here.length ? `+ ${here.map((x) => x.title).join(', ')} (double)` : 'Libre'}</span>
                </button>
              )
            })}
            <button onClick={() => { const m = menu; setMenu(null); askDelete(m) }} className="tap flex items-center justify-center gap-2 rounded-[16px] h-14 mt-1 font-semibold" style={{ color: '#FF453A', background: 'color-mix(in srgb, #FF453A 12%, transparent)' }}>
              <Icon name="trash" size={19} /> Supprimer la séance
            </button>
          </div>
        )}
      </Sheet>

      <Sheet open={!!confirmDel} onClose={() => setConfirmDel(null)} title="Supprimer cette séance ?">
        {confirmDel && (
          <div className="flex flex-col gap-3">
            <p className="text-[15px] text-muted leading-snug">« {confirmDel.title} » du {shortDate(confirmDel.date)} contient déjà des données ({confirmDel.status === 'faite' ? 'séance faite' : 'séries ou sortie enregistrées'}). Elles seront effacées.</p>
            <Button full onClick={() => { const s = confirmDel; setConfirmDel(null); doDelete(s) }} variant="danger">Supprimer</Button>
            <Button full variant="ghost" onClick={() => setConfirmDel(null)}>Annuler</Button>
          </div>
        )}
      </Sheet>

      <Sheet open={!!pending} onClose={() => setPending(null)} title="Ce déplacement crée un conflit">
        {pending && (
          <div className="flex flex-col gap-3">
            {pending.conflicts.map((c) => <div key={c} className="flex gap-2 text-[15px]"><span style={{ color: '#FF9F0A' }}><Icon name="alert" size={20} /></span>{c}</div>)}
            {pending.suggestion !== null && (
              <Button full onClick={() => { moveSession(program.id, pending.s.id, addDays(week.startDate, pending.suggestion!)); setPending(null); toast('Séance déplacée sur le meilleur jour') }}>
                Proposer {DAY_NAMES[pending.suggestion]} à la place
              </Button>
            )}
            <Button full variant="secondary" onClick={() => { moveSession(program.id, pending.s.id, pending.date, slotFor(pending.s, pending.date)); setPending(null) }}>Forcer quand même</Button>
            <Button full variant="ghost" onClick={() => setPending(null)}>Annuler</Button>
          </div>
        )}
      </Sheet>
    </div>
  )
}
