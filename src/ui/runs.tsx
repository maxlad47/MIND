// Courses importées : rapport (prévu / réalisé, tours, allure par km, FC par zones), bilan après séance, saisie rapide, import .FIT.
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { allSessions } from '@/engine/adapt'
import {
  enduranceTooIntense, needsReview, plannedKm, preAnswer, reasonLabel, resolveMaxHr, RESPECT_LABEL, RPE_ANCHORS, RUN_REASONS, splitsSummary,
  targetPaceOf, timeInZones, workLaps, ZONE_LABELS, type MaxHr, type ZoneTime,
} from '@/engine/runs'
import { ZONES, type ImportedRun, type Program, type RunReason, type RunRespect, type Session, type Zone } from '@/engine/types'
import { addDays, fmtKm, fmtPace, fmtTime, mondayOf, todayISO } from '@/engine/utils'
import {
  completeRunReview, correctRun, importRun, logPlannedRun, logQuickRun, maxHrSettingOf, questionnaireOf, runsOf, useDB, type DB,
} from '@/lib/store'
import { Button, Card, Chip, DurationInput, Icon, NumberInput, Sheet, toast } from './kit'

const SplitsChart = lazy(() => import('./runcharts').then((m) => ({ default: m.SplitsChart })))
const HrChart = lazy(() => import('./runcharts').then((m) => ({ default: m.HrChart })))
const ZONE_COLORS = ['#64D2FF', '#30D158', '#FFD60A', '#FF9F0A', '#FF453A']
const COURSE = 'var(--course)'
const fallback = <div className="skeleton h-40 rounded-2xl" />

/** FC max d'un client : profil, sinon la plus haute des 6 derniers mois, sinon 220 − âge (estimation). */
export const maxHrOf = (db: DB, clientId: string, today = todayISO()): MaxHr =>
  resolveMaxHr({ profile: maxHrSettingOf(db, clientId), runs: runsOf(db, clientId), birthDate: questionnaireOf(db, clientId)?.birthDate, today })

// ------------------------------------------------------------------ rapport

/** Temps par zone : barre empilée + légende (minutes et %). */
export function ZoneBar({ z }: { z: ZoneTime }) {
  return (
    <div>
      <div className="flex h-3.5 rounded-full overflow-hidden" role="img" aria-label="Temps par zone de fréquence cardiaque">
        {z.seconds.map((s, i) => s > 0 && <div key={i} style={{ width: `${(s / z.total) * 100}%`, background: ZONE_COLORS[i] }} />)}
      </div>
      <div className="grid grid-cols-5 gap-1 mt-2.5 text-center">
        {z.seconds.map((s, i) => (
          <div key={i}>
            <div className="text-[11px] font-bold" style={{ color: ZONE_COLORS[i] }}>{ZONE_LABELS[i]}</div>
            <div className="text-[13px] font-bold num leading-tight">{Math.round(s / 60)} min</div>
            <div className="text-[11.5px] text-muted num">{z.pct[i]} %</div>
          </div>
        ))}
      </div>
    </div>
  )
}

const Stat = ({ label, planned, done }: { label: string; planned?: string; done: string }) => (
  <div className="text-center min-w-0">
    <div className="text-[12px] text-muted font-medium">{label}</div>
    <div className="text-[21px] font-extrabold num leading-tight">{done}</div>
    {planned && <div className="text-[12px] text-muted num">prévu {planned}</div>}
  </div>
)

function Block({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return <Card className="p-4"><div className="flex items-center justify-between mb-2.5"><div className="font-bold text-[17px]">{title}</div>{right}</div>{children}</Card>
}

/** Prévu / réalisé, tours de travail, allure par km, fréquence cardiaque. Jamais de graphique vide : sans données détaillées, seulement les moyennes. */
export function RunReport({ run, session, maxHr }: { run: ImportedRun; session: Session; maxHr: MaxHr }) {
  const plan = plannedKm(session)
  const planSec = session.run?.estMinutes ? session.run.estMinutes * 60 : 0
  const planPace = plan && planSec ? planSec / plan : targetPaceOf(session)
  const target = targetPaceOf(session)
  const wl = workLaps(run.laps, session)
  const hasSplits = (run.splits?.length ?? 0) >= 2
  const summary = hasSplits ? splitsSummary(run.splits, target) : undefined
  const z = run.hrSeries && run.hrSeries.length >= 6 ? timeInZones(run.hrSeries, maxHr.value) : undefined
  const intense = enduranceTooIntense(run, session, maxHr.value)
  return (
    <>
      <Block title="Prévu et réalisé">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Distance" done={`${fmtKm(run.km)} km`} planned={plan ? `${fmtKm(plan)} km` : undefined} />
          <Stat label="Durée" done={fmtTime(run.seconds)} planned={planSec ? fmtTime(planSec) : undefined} />
          <Stat label="Allure" done={`${fmtPace(run.avgPaceSec)} /km`} planned={planPace ? fmtPace(planPace) : undefined} />
        </div>
        {(run.avgHr || run.elevationGain) && (
          <div className="flex justify-center gap-5 mt-3 text-[13.5px] text-muted">
            {run.avgHr && <span className="inline-flex items-center gap-1.5"><span style={{ color: '#FF453A' }}><Icon name="heart" size={15} /></span><b className="text-ink num">{run.avgHr}</b> bpm moy.{run.maxHr ? <> · max <b className="text-ink num">{run.maxHr}</b></> : null}</span>}
            {run.elevationGain ? <span>+<b className="text-ink num">{run.elevationGain}</b> m</span> : null}
          </div>
        )}
      </Block>

      {wl.length > 0 && (
        <Block title="Tours de travail" right={<span className="text-[13px] text-muted num">{wl.filter((w) => !w.slow).length}/{wl.length} dans l'allure</span>}>
          <div className="flex flex-col">
            {wl.map((w, i) => (
              <div key={w.index} className="flex items-center gap-3 py-2 border-t border-sep first:border-t-0">
                <span className="w-6 text-[13px] text-muted num font-semibold">{i + 1}</span>
                <span className="flex-1 text-[15px] num">{w.lap.meters} m</span>
                <span className="text-[15px] font-bold num" style={{ color: w.slow ? '#FF9F0A' : 'var(--text)' }}>{fmtPace(w.lap.avgPaceSec)}</span>
                <span className="text-[12px] text-muted num w-[64px] text-right">cible {fmtPace(w.targetPaceSec)}</span>
                <span style={{ color: w.slow ? '#FF9F0A' : '#30D158' }}><Icon name={w.slow ? 'alert' : 'check'} size={17} strokeWidth={2.6} /></span>
              </div>
            ))}
          </div>
        </Block>
      )}

      {hasSplits && (
        <Block title="Allure par km">
          <Suspense fallback={fallback}><SplitsChart splits={run.splits!} target={target} /></Suspense>
          {summary && <p className="text-[14.5px] font-semibold mt-1 leading-snug">{summary}</p>}
        </Block>
      )}

      {z && (
        <Block title="Fréquence cardiaque" right={<span className="text-[12px] text-muted">FC max {maxHr.value} bpm{maxHr.estimated ? ' · estimation' : ''}</span>}>
          <Suspense fallback={fallback}><HrChart series={run.hrSeries!} maxHr={maxHr.value} /></Suspense>
          <div className="mt-3"><ZoneBar z={z} /></div>
          {intense && (
            <div className="flex gap-2.5 mt-3.5 rounded-[14px] p-3" style={{ background: 'color-mix(in srgb, #FF9F0A 15%, transparent)' }}>
              <span style={{ color: '#FF9F0A' }}><Icon name="alert" size={20} /></span>
              <div className="text-[14.5px] leading-snug"><b>Endurance trop intense</b> : {intense.pct} % du temps au-dessus de Z2. Une sortie facile doit rester en conversation.</div>
            </div>
          )}
        </Block>
      )}
    </>
  )
}

/** Ligne de bilan (respect, raisons, effort), pour le client et le coach. */
export function ReviewLine({ session }: { session: Session }) {
  const l = session.runLog
  if (!l?.respected) return null
  const color = l.respected === 'oui' ? '#30D158' : l.respected === 'partiel' ? '#FF9F0A' : '#FF453A'
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Chip color={color}>{l.respected === 'oui' ? 'Respectée' : l.respected === 'partiel' ? 'En partie' : 'Pas respectée'}</Chip>
      {l.rpe ? <Chip color={COURSE}>Effort {l.rpe}/10</Chip> : null}
      {(l.reasons ?? []).map((r) => <span key={r} className="text-[13px] text-muted">{r === 'autre' && l.reasonNote ? l.reasonNote : r === 'douleur' && l.painZone ? `Douleur (${ZONES.find((z) => z.id === l.painZone)?.label.toLowerCase()})` : reasonLabel(r)}</span>)}
    </div>
  )
}

// ------------------------------------------------------------------ bilan après séance

/** Même parcours pour toutes les sources : respectée ? pourquoi ? effort ? */
export function ReviewSheet({ open, onClose, program, session, run, maxHr }: { open: boolean; onClose: () => void; program: Program; session: Session; run?: ImportedRun; maxHr?: MaxHr }) {
  const l = session.runLog
  const [respected, setRespected] = useState<RunRespect | undefined>(l?.respected)
  const [reasons, setReasons] = useState<RunReason[]>(l?.reasons ?? [])
  const [zone, setZone] = useState<Zone | undefined>(l?.painZone)
  const [note, setNote] = useState(l?.reasonNote ?? '')
  const [rpe, setRpe] = useState<number | undefined>(l?.rpe)
  useEffect(() => {
    if (!open) return
    setRespected(l?.respected); setReasons(l?.reasons ?? []); setZone(l?.painZone); setNote(l?.reasonNote ?? ''); setRpe(l?.rpe)
  }, [open, session.id])
  const pre = run ? preAnswer(run, session, maxHr?.value) : undefined
  const toggle = (r: RunReason) => setReasons((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]))
  const needWhy = respected === 'partiel' || respected === 'non'
  const ok = !!respected && !!rpe && (!needWhy || reasons.length > 0) && (!reasons.includes('douleur') || !needWhy || !!zone)
  const save = () => {
    if (!respected || !rpe) return
    completeRunReview(program.id, session.id, { respected, reasons: needWhy ? reasons : [], reasonNote: note, rpe, painZone: zone })
    onClose()
    toast(needWhy && reasons.includes('douleur') ? 'Bilan enregistré. Ton coach est prévenu.' : 'Bilan enregistré')
  }
  const rColor: Record<RunRespect, string> = { oui: '#30D158', partiel: '#FF9F0A', non: '#FF453A' }
  return (
    <Sheet open={open} onClose={onClose} title={`Ta sortie de ${fmtKm(session.runLog?.km ?? 0)} km`} tall>
      <div className="flex flex-col gap-5">
        {pre && (
          <div className="rounded-[16px] p-3.5 flex gap-3 items-start" style={{ background: 'color-mix(in srgb, var(--accent) 11%, var(--surface2))' }}>
            <span style={{ color: 'var(--accent)' }}><Icon name="sparkle" size={19} /></span>
            <div className="flex-1 min-w-0">
              <div className="text-[14.5px] leading-snug">{pre.text}</div>
              {respected !== pre.respected && <button className="tap text-[14px] font-bold min-h-[44px] -mb-2" style={{ color: 'var(--accent)' }} onClick={() => setRespected(pre.respected)}>Utiliser cette réponse</button>}
            </div>
          </div>
        )}
        <div>
          <div className="font-bold text-[16px] mb-2">Séance respectée ?</div>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Séance respectée ?">
            {(['oui', 'partiel', 'non'] as RunRespect[]).map((r) => (
              <button key={r} role="radio" aria-checked={respected === r} onClick={() => setRespected(r)} className="tap h-12 rounded-[14px] font-bold text-[16px]"
                style={{ background: respected === r ? rColor[r] : 'var(--surface2)', color: respected === r ? '#fff' : 'var(--text)' }}>{RESPECT_LABEL[r]}</button>
            ))}
          </div>
        </div>
        {needWhy && (
          <div>
            <div className="font-bold text-[16px] mb-2">Pourquoi ? <span className="text-muted font-medium text-[13px]">plusieurs choix possibles</span></div>
            <div className="flex flex-wrap gap-2">
              {RUN_REASONS.map((r) => <Chip key={r.id} active={reasons.includes(r.id)} color={r.id === 'douleur' ? '#FF453A' : COURSE} onClick={() => toggle(r.id)}>{r.label}</Chip>)}
            </div>
            {reasons.includes('douleur') && (
              <div className="mt-3"><div className="text-[13.5px] text-muted mb-1.5">Où ? Ton coach sera prévenu.</div>
                <div className="flex flex-wrap gap-2">{ZONES.map((z) => <Chip key={z.id} active={zone === z.id} color="#FF453A" onClick={() => setZone(z.id)}>{z.label}</Chip>)}</div></div>
            )}
            {reasons.includes('autre') && <input className="mt-3 w-full h-12 rounded-[14px] bg-surface2 px-4 outline-none focus:ring-2 focus:ring-inset focus:ring-accent/60" placeholder="Précise (facultatif)" aria-label="Autre raison" value={note} maxLength={140} onChange={(e) => setNote(e.target.value)} />}
          </div>
        )}
        <div>
          <div className="flex items-baseline justify-between mb-2"><div className="font-bold text-[16px]">Effort ressenti (RPE)</div>{rpe && <div className="text-[14px] font-semibold" style={{ color: COURSE }}>{rpe}/10{RPE_ANCHORS[rpe] ? ` · ${RPE_ANCHORS[rpe]}` : ''}</div>}</div>
          <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Effort ressenti de 1 à 10">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <button key={n} role="radio" aria-checked={rpe === n} aria-label={`${n}${RPE_ANCHORS[n] ? `, ${RPE_ANCHORS[n]}` : ''}`} onClick={() => setRpe(n)} className="tap min-h-[48px] rounded-[14px] font-bold text-[18px] num"
                style={{ background: rpe === n ? COURSE : 'var(--surface2)', color: rpe === n ? 'var(--on-course)' : 'var(--text)' }}>{n}</button>
            ))}
          </div>
          <div className="text-[12px] text-muted mt-2 leading-snug">1 très facile · 3 facile · 5 moyen · 7 difficile · 9 très difficile · 10 maximal</div>
        </div>
        <Button full color={COURSE} disabled={!ok} onClick={save}>Enregistrer le bilan</Button>
      </div>
    </Sheet>
  )
}

// ------------------------------------------------------------------ saisie sans montre

export function QuickRunSheet({ open, onClose, program, session, onDone }: { open: boolean; onClose: () => void; program: Program; session: Session; onDone: () => void }) {
  const [km, setKm] = useState<number | undefined>(plannedKm(session) || undefined)
  const [sec, setSec] = useState<number | undefined>(undefined)
  useEffect(() => { if (open) { setKm(plannedKm(session) || undefined); setSec(undefined) } }, [open, session.id])
  const pace = km && sec ? sec / km : undefined
  return (
    <Sheet open={open} onClose={onClose} title="Saisie rapide" tall>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between"><span className="font-semibold">Distance</span><NumberInput value={km} onChange={setKm} step={0.1} max={100} width={76} suffix="km" /></div>
        <div className="flex items-center justify-between gap-4"><span className="font-semibold">Temps</span><DurationInput value={sec} onChange={setSec} compact /></div>
        <div className="text-center bg-surface2 rounded-[16px] py-3.5"><div className="text-[12px] text-muted font-semibold">Allure moyenne</div><div className="text-[28px] font-extrabold num">{pace ? `${fmtPace(pace)} /km` : '—'}</div></div>
        <Button full color={COURSE} disabled={!km || !sec} onClick={() => { if (km && sec && logQuickRun(program.id, session.id, km, sec)) { onClose(); onDone() } }}>Continuer</Button>
      </div>
    </Sheet>
  )
}

const FIT_STEPS: [string, string][] = [
  ['Ouvre Safari', 'Va sur connect.garmin.com et connecte-toi.'],
  ['Choisis ton activité', 'Touche la sortie à importer dans ta liste d\'activités.'],
  ['Touche ⚙︎ (en haut à droite)', 'Puis « Exporter l\'original ».'],
  ['Reviens dans MIND', 'Touche « Choisir le fichier » et sélectionne le fichier reçu (.zip ou .fit).'],
]

/** Importe un .fit ou le .zip de « Exporter l'original ». Sur une séance : rattaché à celle-ci ; sinon, MIND cherche la bonne séance. */
export function FitImportSheet({ open, onClose, clientId, session, onDone }: { open: boolean; onClose: () => void; clientId: string; session?: Session; onDone: (sessionId?: string) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pick = async (file?: File) => {
    if (!file) return
    setBusy(true); setError('')
    try {
      const { parseFitFile } = await import('../../shared/garmin/fit.ts') // chargé seulement ici : le lecteur est volumineux
      const data = await parseFitFile(new Uint8Array(await file.arrayBuffer()), file.name)
      if (!data.km || !data.seconds) throw new Error('vide')
      const out = importRun(clientId, data, 'fit', { sessionId: session?.id })
      if (out.duplicate) { toast('Cette sortie est déjà dans MIND.'); onClose(); onDone(out.run.matchedSessionId); return }
      if (out.run.status === 'ignoree') { toast(out.run.note ?? 'Cette activité n\'a pas été rattachée.'); onClose(); return }
      onClose()
      onDone(out.sessionId)
    } catch {
      setError('Ce fichier n\'a pas pu être lu. Choisis le .zip ou le .fit exporté depuis Garmin Connect (« Exporter l\'original »).')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }
  return (
    <Sheet open={open} onClose={onClose} title="Importer depuis ma montre" tall>
      <div className="flex flex-col gap-3">
        {FIT_STEPS.map(([t, s], i) => (
          <div key={i} className="flex gap-3.5 bg-surface2 rounded-[18px] p-3.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0" style={{ background: COURSE, color: 'var(--on-course)' }}>{i + 1}</div>
            <div><div className="font-semibold">{t}</div><div className="text-[14px] text-muted">{s}</div></div>
          </div>
        ))}
        {error && <p className="text-[14px]" style={{ color: '#FF453A' }} role="alert">{error}</p>}
        <input ref={input} type="file" className="hidden" aria-label="Fichier d'activité" onChange={(e) => void pick(e.target.files?.[0])} />
        <Button full color={COURSE} disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Lecture du fichier…' : 'Choisir le fichier'}</Button>
      </div>
    </Sheet>
  )
}

/** Les trois façons d'enregistrer une sortie sur une séance de course prévue (dans cet ordre). */
export function RunEntry({ program, session, onImported }: { program: Program; session: Session; onImported: () => void }) {
  const [quick, setQuick] = useState(false)
  const [fit, setFit] = useState(false)
  const canPlanned = plannedKm(session) > 0 && (session.run?.estMinutes ?? 0) > 0
  return (
    <>
      {canPlanned && <Button full color={COURSE} onClick={() => {
        const out = logPlannedRun(program.id, session.id)
        if (!out) toast('Cette séance n\'a pas pu être enregistrée.')
        else if (out.sessionId === session.id) onImported()
        else toast('Cette sortie est déjà enregistrée sur une autre séance.') // jamais de bouton qui ne fait rien
      }}>Fait comme prévu</Button>}
      <Button full variant={canPlanned ? 'secondary' : 'primary'} color={COURSE} onClick={() => setQuick(true)}>Saisie rapide</Button>
      <Button full variant="tinted" color={COURSE} onClick={() => setFit(true)}><Icon name="refresh" size={17} /> Importer depuis ma montre (.FIT)</Button>
      <QuickRunSheet open={quick} onClose={() => setQuick(false)} program={program} session={session} onDone={onImported} />
      <FitImportSheet open={fit} onClose={() => setFit(false)} clientId={program.clientId} session={session} onDone={() => onImported()} />
    </>
  )
}

/** « Ce n'est pas cette séance » : une autre séance de la semaine, une sortie en plus, ou ignorer. */
export function CorrectSheet({ open, onClose, program, session, run }: { open: boolean; onClose: () => void; program: Program; session: Session; run: ImportedRun }) {
  const nav = useNavigate()
  const week = mondayOf(run.startAt.slice(0, 10))
  const options = allSessions(program).filter((s) => s.id !== session.id && s.sport === 'course' && s.kind !== 'renfo' && s.status === 'prevue' && !s.runLog && mondayOf(s.date) === week)
  const go = (target: Parameters<typeof correctRun>[1], text: string) => { correctRun(run.id, target); onClose(); toast(text); if (typeof target === 'object') nav(`/session/${target.sessionId}`, { replace: true }); else if (target === 'extra') nav(-1) }
  return (
    <Sheet open={open} onClose={onClose} title="Ce n'est pas cette séance">
      <div className="flex flex-col gap-2.5">
        {options.map((s) => <Button key={s.id} full variant="secondary" onClick={() => go({ sessionId: s.id }, 'Sortie rattachée à l\'autre séance')}>{s.title} · {new Date(s.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })}</Button>)}
        {!options.length && <p className="text-[14px] text-muted">Aucune autre séance de course n'est prévue cette semaine.</p>}
        {!session.extra && <Button full variant="secondary" onClick={() => go('extra', 'Sortie comptée en plus')}>En faire une sortie en plus</Button>}
        <Button full variant="danger" onClick={() => { correctRun(run.id, 'ignore'); onClose(); toast('Activité ignorée') }}>Ignorer cette activité</Button>
      </div>
    </Sheet>
  )
}

// ------------------------------------------------------------------ Aujourd'hui

/** « À compléter : ta sortie de 10,2 km » : un bilan à remplir. */
export function PendingReviewCards({ program }: { program: Program }) {
  const nav = useNavigate()
  const pending = allSessions(program).filter(needsReview).sort((a, b) => b.date.localeCompare(a.date))
  if (!pending.length) return null
  return (
    <>
      {pending.map((s) => (
        <Card key={s.id} className="p-4 mb-3" onClick={() => nav(`/session/${s.id}?bilan=1`)} style={{ background: `color-mix(in srgb, ${COURSE} 13%, var(--surface))`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${COURSE} 30%, transparent)` }}>
          <div className="flex items-center gap-3">
            <span style={{ color: COURSE }}><Icon name="alert" /></span>
            <div className="flex-1 min-w-0"><div className="font-bold text-[16px]">À compléter : ta sortie de {fmtKm(s.runLog!.km)} km</div><div className="text-[13.5px] text-muted">Respectée ? Effort ressenti ? Deux réponses suffisent.</div></div>
            <Icon name="chevron" size={18} color="var(--faint)" />
          </div>
        </Card>
      ))}
    </>
  )
}

export { addDays }
