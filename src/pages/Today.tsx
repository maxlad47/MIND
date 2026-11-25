import { motion } from 'framer-motion'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { allSessions, currentWeek, weekStats } from '@/engine/adapt'
import { exerciseOf } from '@/engine/exercises'
import { isFreeRun, isLibre, trainingDays } from '@/engine/libre'
import type { Program } from '@/engine/types'
import { addDays, fmtKm, mondayOf, prettyDate, shortDate, todayISO } from '@/engine/utils'
import { acceptAdaptation, addExtraSession, programOf, refuseAdaptation, startNextCycle, submitQuestionnaire, useDB } from '@/lib/store'
import { analyzeWeek } from '@/lib/ai'
import { Button, Card, Carousel, Chip, Cover, EmptyState, Icon, Page, Ring, SectionTitle, SportBadge, SportIcon, spring, toast } from '@/ui/kit'
import { ExtraSessionSheet } from '@/ui/free'
import { FitImportSheet, PendingReviewCards } from '@/ui/runs'
import { RecoveryCard } from '@/ui/recovery'
import { BellButton, CheckinSheet, coverSeed, NotificationsSheet, SessionTile, sessionMeta, sessionSubtitle, tintOf, WarningBanner, WeekStrip } from '@/ui/parts'

export function TodayView({ clientId, onboardPath = '/onboarding', onOpenSessions }: { clientId: string; onboardPath?: string; onOpenSessions?: () => void }) {
  const db = useDB()
  const nav = useNavigate()
  const today = todayISO()
  const program = programOf(db, clientId)
  const [checkin, setCheckin] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [extra, setExtra] = useState(false)
  const [fit, setFit] = useState(false)

  if (!program) {
    return <EmptyState icon="sparkle" title="Pas encore de programme" text="Réponds à quelques questions et MIND génère ton programme personnalisé tout de suite."
      action={<Button onClick={() => nav(onboardPath)}>Créer mon programme</Button>} />
  }

  const libre = isLibre(program)
  const openSessions = onOpenSessions ?? (() => nav('/app/sessions'))
  if (libre && (program.libre?.templates.length ?? 0) === 0 && program.type === 'muscu') {
    return <EmptyState icon="program" color="var(--muscu)" title="Crée ta première séance" text="Tu suis déjà ton programme : ajoute tes séances (ex. Push, Pull, Legs), puis place-les dans ta semaine."
      action={<Button color="var(--muscu)" onClick={openSessions}>Créer ma première séance</Button>} />
  }

  const week = currentWeek(program, today)
  const all = allSessions(program).filter((s) => s.status !== 'sautee')
  const todays = all.filter((s) => s.date === today).sort((a, b) => (a.slot === 'am' ? -1 : 1) - (b.slot === 'am' ? -1 : 1))
  const upcoming = all.filter((s) => s.date > today && s.status === 'prevue').sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8)
  const thisWeek = week.sessions.filter((s) => s.status !== 'sautee').sort((a, b) => a.date.localeCompare(b.date))
  const pending = db.adaptations.filter((a) => a.programId === program.id && a.status === 'propose')
  const lastComment = [...db.comments].filter((c) => c.clientId === clientId && c.authorRole === 'coach').sort((a, b) => b.at.localeCompare(a.at))[0]
  const records = db.records.filter((r) => r.clientId === clientId).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8)
  const analysis = db.analyses.filter((a) => a.programId === program.id).sort((a, b) => b.weekN - a.weekN)[0]
  const lastWeekN = week.n - 1
  const total = program.weeks.length
  const finished = today > addDays(program.weeks[total - 1].startDate, 6)
  const stats = weekStats(program, week.n)

  const begin = (sid: string, s: typeof todays[number]) => {
    if (s.sport === 'muscu' && s.status === 'prevue' && !db.checkins.some((c) => c.sessionId === sid)) setCheckin(sid)
    else nav(`/session/${sid}`)
  }

  const finishGoal = () => {
    const q = { ...program.q, run: { ...program.q.run, objective: 'finir' as const, targetSeconds: undefined } }
    submitQuestionnaire(clientId, q)
    toast('Objectif passé en « Finir »')
  }

  return (
    <>
      <Card className="p-4 mb-5">
        <div className="flex items-center gap-3 mb-2">
          <Ring value={stats.planned ? stats.done / stats.planned : 0} size={52} stroke={6} color={program.type === 'course' ? 'var(--course)' : 'var(--muscu)'}>
            <span className="text-[13px] font-extrabold num">{stats.done}/{stats.planned}</span>
          </Ring>
          <div className="flex-1 min-w-0">
            <div className="text-[17px] font-bold leading-tight">{libre ? `Semaine du ${shortDate(week.startDate)}` : `Semaine ${week.n} sur ${total}`}</div>
            <div className="text-[13.5px] text-muted mt-0.5">{libre ? `${stats.planned} séance${stats.planned > 1 ? 's' : ''} cette semaine` : `${week.phase}${week.light ? ' · semaine allégée' : ''}`}</div>
          </div>
        </div>
        <WeekStrip start={week.startDate} sessions={week.sessions} today={today} onOpen={(id) => nav(`/session/${id}`)} />
      </Card>

      <RecoveryCard clientId={clientId} />
      <PendingReviewCards program={program} />

      {libre && (program.libre?.templates.length ?? 0) > 0 && trainingDays(program.libre!.planning).length === 0 && (
        <Card className="p-4 mb-4" style={{ background: 'color-mix(in srgb, var(--muscu) 13%, var(--surface))', boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--muscu) 30%, transparent)' }}>
          <div className="flex gap-3"><span style={{ color: 'var(--muscu)' }}><Icon name="calendar" /></span>
            <div className="flex-1"><div className="font-bold">Règle ton planning</div><p className="text-[14px] text-muted mt-0.5 leading-snug">Choisis tes jours d'entraînement pour que tes séances apparaissent ici.</p>
              <div className="mt-3"><Button small color="var(--muscu)" onClick={openSessions}>Régler mon planning</Button></div></div></div>
        </Card>
      )}

      <WarningBanner program={program} onFinish={finishGoal} onChangeGoal={() => nav('/onboarding?edit=1')} />

      {pending.map((a) => (
        <Card key={a.id} className="p-4 mb-3" style={{ background: 'color-mix(in srgb, var(--accent) 11%, var(--surface))', boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--accent) 26%, transparent)' }}>
          <div className="flex gap-3">
            <div style={{ color: 'var(--accent)' }}><Icon name="sparkle" /></div>
            <div className="flex-1">
              <div className="text-[12px] uppercase tracking-wide text-muted font-semibold">Suggestion</div>
              <div className="text-[15px] font-semibold mt-0.5">{a.text}</div>
              <div className="flex gap-2 mt-3">
                <Button small onClick={() => { acceptAdaptation(a.id); toast('Ajustement appliqué') }}>Accepter</Button>
                <Button small variant="secondary" onClick={() => refuseAdaptation(a.id)}>Refuser</Button>
              </div>
            </div>
          </div>
        </Card>
      ))}

      {finished && !libre && program.type === 'muscu' && (
        <Card className="p-4 mb-4">
          <div className="font-bold text-[17px]">Cycle terminé</div>
          <p className="text-muted text-[14px] mt-1">Tu as fini les 8 semaines. Génère le cycle suivant pour continuer à progresser.</p>
          <div className="mt-3"><Button small onClick={() => { startNextCycle(clientId); toast('Nouveau cycle prêt') }}>Générer le cycle suivant</Button></div>
        </Card>
      )}

      {/* Séance du jour */}
      {todays.length > 0 ? (
        <div className="flex flex-col gap-4">
          {todays.map((s, i) => (
            <motion.div key={s.id} initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ ...spring, delay: i * 0.06 }}>
              <Cover seed={coverSeed(s)} sports={[tintOf(s)]} kind={s.kind} className="rounded-[28px]" style={{ height: 340, boxShadow: 'var(--shadow-cover)' }}>
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                  <SportBadge sports={[s.sport]} label={isFreeRun(s) ? 'Sortie libre' : s.extra ? 'Séance en plus' : s.kind === 'renfo' ? 'Renfo coureur' : s.sport === 'muscu' ? 'Musculation' : 'Course'} slot={s.slot ? (s.slot === 'am' ? 'matin' : 'soir') : undefined} />
                  {s.estMinutes > 0 && <div className="rounded-full glass-dark px-3 h-8 flex items-center gap-1.5 text-white text-[13px] font-semibold border border-white/10"><Icon name="clock" size={15} /> {s.estMinutes} min</div>}
                </div>
                <div className="absolute bottom-0 inset-x-0 p-5 text-white">
                  <div className="t-over opacity-80">Aujourd'hui</div>
                  <div className="t-display text-[34px] leading-[1.04] font-extrabold tracking-[-0.025em] mt-1.5" style={{ textShadow: '0 2px 14px rgba(0,0,0,.3)' }}>{s.title}</div>
                  <div className="text-[15px] font-medium opacity-95 mt-1.5">{sessionMeta(s)}</div>
                  <div className="text-[13.5px] opacity-80 line-clamp-1 mt-0.5">{sessionSubtitle(s)}</div>
                  <div className="mt-4 flex gap-2.5">
                    {s.status === 'prevue' && (
                      <motion.button whileTap={{ scale: 0.96 }} transition={spring} className="h-[52px] px-7 rounded-full bg-white text-black font-bold text-[17px] flex items-center gap-2 shadow-lg" onClick={() => begin(s.id, s)}>
                        <Icon name="play" size={18} /> Commencer
                      </motion.button>
                    )}
                    {s.status === 'faite' && <div className="h-[52px] px-5 rounded-full bg-ok text-white font-bold flex items-center gap-2"><Icon name="check" size={18} strokeWidth={3} /> Terminée</div>}
                    {s.status === 'manquee' && <div className="h-[52px] px-5 rounded-full glass-dark text-white font-semibold flex items-center">Manquée</div>}
                    <motion.button whileTap={{ scale: 0.96 }} transition={spring} className="h-[52px] px-5 rounded-full glass-light text-white font-semibold text-[16px] border border-white/20" onClick={() => nav(`/session/${s.id}`)}>Détails</motion.button>
                  </div>
                </div>
              </Cover>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-[28px] p-6" style={{ background: 'linear-gradient(150deg, color-mix(in srgb, #5E5CE6 34%, var(--surface)), var(--surface) 70%)', boxShadow: 'var(--shadow-card)' }}>
          <div className="absolute -right-6 -top-6 opacity-20 text-white"><Icon name="moon" size={150} strokeWidth={1.2} /></div>
          <div className="relative">
            <div className="t-over text-muted">Aujourd'hui</div>
            <div className="text-[30px] leading-tight font-extrabold tracking-tight mt-1">Jour de repos</div>
            <p className="text-muted text-[15px] mt-1.5 max-w-[260px]">Ton corps progresse pendant la récupération. Profites-en.</p>
            {upcoming[0] && (
              <motion.button whileTap={{ scale: 0.97 }} transition={spring} onClick={() => nav(`/session/${upcoming[0].id}`)} className="mt-4 flex items-center gap-3 rounded-[18px] bg-surface2/80 p-2 pr-4 text-left">
                <Cover seed={coverSeed(upcoming[0])} sports={[tintOf(upcoming[0])]} kind={upcoming[0].kind} className="rounded-[12px] shrink-0" style={{ width: 48, height: 48 }} scrim={false}>
                  <div className="absolute inset-0 flex items-center justify-center"><SportIcon sport={upcoming[0].sport} size={20} color="#fff" /></div>
                </Cover>
                <div className="min-w-0"><div className="text-[12px] text-muted font-semibold">Prochaine séance · <span className="cap-first inline-block">{prettyDate(upcoming[0].date)}</span></div><div className="font-bold truncate">Voir « {upcoming[0].title} »</div></div>
              </motion.button>
            )}
          </div>
        </div>
      )}

      {libre && (
        <div className="mt-4"><Button full variant="tinted" color="var(--muscu)" onClick={() => setExtra(true)}><Icon name="plus" size={18} strokeWidth={2.4} /> Séance en plus</Button></div>
      )}
      {/* muscu MIND + course libre : une sortie à saisir librement (km, temps, ressenti) */}
      {!libre && program.type === 'muscu' && program.weeks.some((w) => w.startDate === mondayOf(today)) && (
        <div className="mt-4"><Button full variant="tinted" color="var(--course)" onClick={() => { const id = addExtraSession(program.id, 'course'); if (id) nav(`/session/${id}`) }}><SportIcon sport="course" size={18} /> Sortie libre</Button></div>
      )}

      {(program.type !== 'muscu' || libre || db.importedRuns.some((r) => r.clientId === clientId)) && (
        <div className="mt-4"><Button full variant="tinted" color="var(--course)" onClick={() => setFit(true)}><Icon name="refresh" size={17} /> Importer une sortie (.FIT)</Button></div>
      )}

      {lastWeekN >= 1 && !analysis && program.weeks.some((w) => w.n === lastWeekN) && (
        <div className="mt-4">
          <Button variant="secondary" full disabled={busy} onClick={async () => {
            setBusy(true); const src = await analyzeWeek(program.id, lastWeekN); setBusy(false)
            toast(src === 'ia' ? 'Analyse de ta semaine par l\'IA prête' : 'Analyse de ta semaine prête')
          }}><Icon name="sparkle" size={18} /> Analyser ma semaine</Button>
        </div>
      )}
      {analysis && (
        <Card className="p-4 mt-4">
          <div className="flex items-center gap-2 t-over text-muted"><span style={{ color: 'var(--accent)' }}><Icon name="sparkle" size={16} /></span> Bilan de la semaine {analysis.weekN}{analysis.source === 'ia' ? ' · IA' : ''}</div>
          <p className="text-[15.5px] mt-2 leading-snug">{analysis.summary}</p>
        </Card>
      )}

      {thisWeek.length > 0 && (<>
        <SectionTitle action={<span className="text-[14px] text-muted font-medium pb-0.5">{stats.done}/{stats.planned} faites</span>}>Cette semaine</SectionTitle>
        <Carousel>{thisWeek.map((s) => <SessionTile key={s.id} s={s} onClick={() => nav(`/session/${s.id}`)} />)}</Carousel>
      </>)}

      {upcoming.length > 0 && (<>
        <SectionTitle>À venir</SectionTitle>
        <Carousel>{upcoming.map((s) => <SessionTile key={s.id} s={s} width={150} onClick={() => nav(`/session/${s.id}`)} />)}</Carousel>
      </>)}

      {lastComment && (<>
        <SectionTitle>Message de ton coach</SectionTitle>
        <Card className="p-4" onClick={() => nav(`/session/${lastComment.sessionId}`)}>
          <div className="flex gap-3">
            <Cover seed={'coach' + lastComment.authorName} sports={['muscu', 'course']} scrim={false} className="w-11 h-11 rounded-full shrink-0">
              <div className="absolute inset-0 flex items-center justify-center font-extrabold text-white text-[18px]">{lastComment.authorName[0]}</div>
            </Cover>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2"><span className="font-bold text-[15px]">{lastComment.authorName}</span><span className="text-[12px] text-muted">coach</span></div>
              <div className="text-[15px] mt-0.5 leading-snug">{lastComment.text}</div>
            </div>
          </div>
        </Card>
      </>)}

      {records.length > 0 && (<>
        <SectionTitle>Records récents</SectionTitle>
        <Carousel>
          {records.map((r) => (
            <Cover key={r.id} seed={r.id} sports={['muscu']} className="snap-start shrink-0 rounded-[20px]" style={{ width: 176, height: 132, boxShadow: 'var(--shadow-cover)' }}>
              <div className="absolute inset-0 p-3.5 flex flex-col justify-between text-white">
                <div className="flex items-center gap-1.5 t-over"><Icon name="trophy" size={15} /> Record</div>
                <div>
                  <div className="text-[13px] font-semibold leading-tight line-clamp-2 opacity-95">{exerciseOf(r.exerciseId).name}</div>
                  <div className="text-[24px] leading-tight font-extrabold tracking-tight num">{fmtKm(r.kg)} kg × {r.reps}</div>
                </div>
              </div>
            </Cover>
          ))}
        </Carousel>
      </>)}

      <FitImportSheet open={fit} onClose={() => setFit(false)} clientId={clientId} onDone={(sid) => { if (sid) nav(`/session/${sid}?bilan=1`) }} />
      {libre && <ExtraSessionSheet open={extra} onClose={() => setExtra(false)} program={program} />}
      <CheckinSheet open={!!checkin} onClose={() => setCheckin(null)} clientId={clientId} sessionId={checkin ?? ''} onDone={() => { const id = checkin; setCheckin(null); if (id) nav(`/session/${id}`) }} />
    </>
  )
}

export default function TodayPage({ clientId }: { clientId: string }) {
  const [bell, setBell] = useState(false)
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  return (
    <Page title="Aujourd'hui" subtitle={today.charAt(0).toUpperCase() + today.slice(1)} right={<BellButton userId={clientId} onClick={() => setBell(true)} />}>
      <TodayView clientId={clientId} />
      <NotificationsSheet open={bell} onClose={() => setBell(false)} userId={clientId} />
    </Page>
  )
}

export type { Program }
void mondayOf
