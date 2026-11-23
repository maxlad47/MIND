// Données de démonstration : un coach et quatre clients avec un historique réaliste.
// Générées à l'ouverture de l'app, relatives à la date du jour.

import { adjustLoadsAfterSession, allSessions } from '@/engine/adapt'
import { EXERCISE_BY_ID, makeCustomExercise, registerCustomExercises } from '@/engine/exercises'
import { newLibreProgram, newTemplate, newTemplateExercise, syncFree } from '@/engine/libre'
import { generateProgram } from '@/engine/program'
import { epley } from '@/engine/strength'
import type { LibrePlanning, Program, Questionnaire, SessionTemplate } from '@/engine/types'
import { addDays, hash, mondayOf, todayISO, uid } from '@/engine/utils'
import { COACH_EMAIL, getDB, hashPw, mutate, type DB, type Profile } from './store'

export const DEMO_PASSWORD = 'mind1234'
export const DEMO_ACCOUNTS = {
  coach: COACH_EMAIL,
  client: 'camille@demo.mind',
  /** Nina : mode libre (« J'ai déjà mon programme »), PPL 4×/semaine en rotation. */
  libre: 'nina@demo.mind',
}

const baseQ = (today: string): Questionnaire => ({
  firstName: '', birthDate: '1992-06-18', sex: 'femme', weightKg: 62, heightCm: 170, injuries: [], injuryNote: '',
  programType: 'muscu', muscuSessions: 3, runSessions: 3, availableDays: [0, 1, 2, 3, 4, 5, 6], maxMinutes: 75, priority: 'equilibre',
  strength: { goal: 'hypertrophie', level: 'intermediaire', lifts: {} },
  run: { distance: '10k', raceDate: addDays(today, 70), objective: 'finir', level: 'intermediaire', weeklyKm: 25, longestKm: 12 },
  startDate: addDays(mondayOf(today), -21),
})

function defaultKg(exId: string): number {
  const ex = EXERCISE_BY_ID[exId]
  if (ex.equipment === 'poids_du_corps') return 0
  if (ex.equipment === 'halteres') return ex.compound ? 16 : 8
  if (ex.equipment === 'barre') return ex.compound ? 45 : 25
  if (ex.equipment === 'smith') return 40
  return ex.compound ? 40 : 22
}

function simulate(program: Program, today: string, adherence: number, key: string, stopAfter?: string): { program: Program; prs: DB['records'] } {
  let p = program
  const prs: DB['records'] = []
  const past = allSessions(p).filter((s) => s.date < today).sort((a, b) => a.date.localeCompare(b.date))
  past.forEach((ps, idx) => {
    const s = allSessions(p).find((x) => x.id === ps.id)!
    const r = (hash(key + s.date + s.title) % 100) / 100
    if ((stopAfter && s.date > stopAfter) || r > adherence) { s.status = 'manquee'; return }
    s.status = 'faite'
    s.doneAt = `${s.date}T18:30:00.000Z`
    s.feeling = 5 + (hash(key + s.date) % 3)
    if (s.exercises) {
      s.durationMin = Math.max(30, s.estMinutes - 5 + (hash(key + s.id) % 10))
      for (const e of s.exercises) {
        const kg = e.targetKg ?? defaultKg(e.exerciseId)
        const week = Math.floor(idx / 3)
        for (let n = 1; n <= e.sets; n++) {
          const h = hash(key + s.date + e.exerciseId + n)
          const reps = Math.min(e.repMax, e.repMin + week + (h % 2) + (idx > 4 ? 1 : 0))
          e.logs.push({ n, kg, reps, rir: Math.max(0, e.rir + (h % 2) - (n === e.sets ? 1 : 0)), at: s.doneAt })
        }
        const best = e.logs.reduce((a, b) => (epley(b.kg, b.reps) > epley(a.kg, a.reps) ? b : a))
        const prev = Math.max(0, ...allSessions(p).filter((x) => x.status === 'faite' && x.date < s.date).flatMap((x) => x.exercises ?? [])
          .filter((x) => x.exerciseId === e.exerciseId).flatMap((x) => x.logs).map((l) => epley(l.kg, l.reps)))
        if (prev > 0 && best.kg > 0 && epley(best.kg, best.reps) > prev * 1.005) {
          prs.push({ id: uid('pr'), clientId: p.clientId, exerciseId: e.exerciseId, kg: best.kg, reps: best.reps, e1rm: epley(best.kg, best.reps), date: s.date, sessionId: s.id })
        }
      }
      p = adjustLoadsAfterSession(p, s.id, s.date).program
    } else if (s.run) {
      const h = hash(key + s.date + 'run')
      const km = Math.round(s.run.totalKm * (0.97 + (h % 6) / 100) * 10) / 10
      const pace = (s.run.estMinutes * 60) / Math.max(1, s.run.totalKm)
      s.runLog = { km, seconds: Math.round(km * pace * (0.98 + (h % 5) / 100)), feeling: 4 + (h % 4), comment: '', source: 'manuel', at: s.doneAt }
    }
  })
  return { program: p, prs }
}

/** Charges de départ (kg) des exercices de Nina, et progression par semaine. */
const NINA_KG: Record<string, [base: number, perWeek: number]> = {
  dev_couche_barre: [50, 2.5], dev_incline_halteres: [18, 1], dev_epaules_halteres: [12, 1], elev_lat_halteres: [6, 0.5], ext_triceps_poulie: [22, 2.5],
  tirage_vertical: [50, 2.5], rowing_haltere: [22, 1], face_pull: [18, 2.5], curl_halteres: [10, 0], 'custom:demo_curl_marteau': [14, 1],
  squat_barre: [70, 5], rdl_barre: [60, 5], presse_cuisses: [120, 5], leg_curl_assis: [35, 2.5], mollets_debout: [50, 2.5],
}

/** Nina : PPL 4×/semaine en rotation, 3 semaines d'historique avec des charges qui progressent, un exercice perso. */
function addNina(db: DB, today: string): Profile {
  const id = uid('u')
  db.users.push({ id, email: DEMO_ACCOUNTS.libre, pass: hashPw(DEMO_PASSWORD), role: 'client' })
  const profile: Profile = { id, role: 'client', firstName: 'Nina', email: DEMO_ACCOUNTS.libre, reminderTime: '18:00', theme: 'auto', notifications: false, createdAt: new Date(Date.now() - 25 * 86400000).toISOString(), onboarded: true }
  db.profiles.push(profile)

  const custom = makeCustomExercise('custom:demo_curl_marteau', 'Curl marteau à la poulie', 'biceps')
  registerCustomExercises([custom])
  const te = (exId: string, sets: number, repMin: number, repMax: number, restSec: number, rir?: number) =>
    Object.assign(newTemplateExercise(exId), { sets, repMin, repMax, restSec, ...(rir !== undefined ? { rir } : {}) })
  const tpl = (name: string, ...ex: ReturnType<typeof te>[]): SessionTemplate => Object.assign(newTemplate(name), { exercises: ex })
  const push = tpl('Push', te('dev_couche_barre', 4, 6, 8, 150, 2), te('dev_incline_halteres', 3, 8, 12, 90), te('dev_epaules_halteres', 3, 8, 12, 90), te('elev_lat_halteres', 3, 12, 15, 60), te('ext_triceps_poulie', 3, 10, 15, 60))
  const pull = tpl('Pull', te('tirage_vertical', 4, 8, 10, 120, 2), te('rowing_haltere', 3, 8, 12, 90), te('face_pull', 3, 12, 15, 60), te('curl_halteres', 3, 10, 12, 60), te(custom.id, 3, 10, 15, 60))
  const legs = tpl('Legs', te('squat_barre', 4, 6, 8, 180, 2), te('rdl_barre', 3, 8, 10, 120), te('presse_cuisses', 3, 10, 12, 120), te('leg_curl_assis', 3, 10, 15, 75), te('mollets_debout', 4, 12, 15, 60))
  const planning: LibrePlanning = { mode: 'rotation', days: [0, 1, 3, 4], order: [push.id, pull.id, legs.id] } // lundi, mardi, jeudi, vendredi

  const q = { ...baseQ(today), firstName: 'Nina', mode: 'libre' as const, programType: 'muscu' as const, birthDate: '1996-02-11', weightKg: 60, heightCm: 168, startDate: addDays(mondayOf(today), -21) }
  db.questionnaires.push({ id: uid('q'), clientId: id, version: 1, data: q, at: q.startDate })

  let prog = newLibreProgram(q, { clientId: id, now: q.startDate, templates: [push, pull, legs], planning, customExercises: [custom] })
  // historique : toutes les séances passées sont faites, avec des charges qui montent semaine après semaine
  const past = allSessions(prog).filter((s) => s.date < today).sort((a, b) => a.date.localeCompare(b.date))
  for (const s of past) {
    s.status = 'faite'
    s.doneAt = `${s.date}T18:30:00.000Z`
    s.feeling = 6 + (hash('nina' + s.date) % 3)
    s.durationMin = Math.max(35, s.estMinutes - 4 + (hash('nina' + s.id) % 8))
    for (const e of s.exercises ?? []) {
      const [base, step] = NINA_KG[e.exerciseId] ?? [20, 0]
      const kg = base + step * (s.weekN - 1)
      for (let n = 1; n <= e.sets; n++) {
        const h = hash('nina' + s.date + e.exerciseId + n)
        e.logs.push({ n, kg, reps: Math.min(e.repMax, e.repMin + (h % 3) + (s.weekN > 1 ? 1 : 0)), rir: Math.max(0, 2 - (n === e.sets ? 1 : 0) + (h % 2)), at: s.doneAt })
      }
      const best = e.logs.reduce((a, b) => (epley(b.kg, b.reps) > epley(a.kg, a.reps) ? b : a))
      const prev = Math.max(0, ...allSessions(prog).filter((x) => x.status === 'faite' && x.date < s.date).flatMap((x) => x.exercises ?? [])
        .filter((x) => x.exerciseId === e.exerciseId).flatMap((x) => x.logs).map((l) => epley(l.kg, l.reps)))
      if (prev > 0 && epley(best.kg, best.reps) > prev * 1.005) {
        db.records.push({ id: uid('pr'), clientId: id, exerciseId: e.exerciseId, kg: best.kg, reps: best.reps, e1rm: epley(best.kg, best.reps), date: s.date, sessionId: s.id })
      }
    }
  }
  prog = syncFree(prog, today) // la rotation repart du dernier modèle fait
  db.programs.push(prog)
  return profile
}

export function buildSeed(today = todayISO()): DB {
  const db = JSON.parse(JSON.stringify(getDB())) as DB
  const mk = (email: string, firstName: string, role: 'coach' | 'client'): Profile => {
    const id = uid('u')
    db.users.push({ id, email, pass: hashPw(DEMO_PASSWORD), role })
    const p: Profile = { id, role, firstName, email, reminderTime: '18:00', theme: 'auto', notifications: false, createdAt: new Date(Date.now() - 40 * 86400000).toISOString(), onboarded: role === 'coach' }
    db.profiles.push(p)
    return p
  }
  const coach = mk(COACH_EMAIL, 'Max', 'coach')

  const add = (profile: Profile, q: Questionnaire, adherence: number, stopAfter?: string) => {
    profile.onboarded = true
    q.firstName = profile.firstName
    db.questionnaires.push({ id: uid('q'), clientId: profile.id, version: 1, data: q, at: q.startDate })
    const prog = generateProgram(q, { clientId: profile.id, now: q.startDate })
    const sim = simulate(prog, today, adherence, profile.firstName, stopAfter)
    db.programs.push(sim.program)
    db.records.push(...sim.prs)
    return sim.program
  }

  // Camille : musculation + semi-marathon, priorité course
  const camille = mk('camille@demo.mind', 'Camille', 'client')
  const qc = baseQ(today)
  Object.assign(qc, {
    programType: 'mixte', muscuSessions: 3, runSessions: 3, priority: 'course', availableDays: [0, 1, 2, 4, 5, 6],
    strength: { goal: 'hypertrophie', level: 'intermediaire', lifts: { squat: { kg: 70, reps: 6 }, bench: { kg: 45, reps: 8 }, deadlift: { kg: 85, reps: 5 } } },
    run: { distance: 'semi', raceDate: addDays(mondayOf(today), 7 * 9 + 6), objective: 'chrono', targetSeconds: 6000 + 600, level: 'intermediaire', weeklyKm: 28, longestKm: 14, recent: { distance: '10k', seconds: 52 * 60, date: addDays(today, -30) } },
  })
  const pc = add(camille, qc, 0.9)

  // Hugo : force, douleur à l'épaule
  const hugo = mk('hugo@demo.mind', 'Hugo', 'client')
  const qh = baseQ(today)
  Object.assign(qh, {
    sex: 'homme', weightKg: 84, heightCm: 182, injuries: ['epaule'], injuryNote: 'Tendinite en cours de guérison', programType: 'muscu', muscuSessions: 4, maxMinutes: 90,
    strength: { goal: 'force', level: 'intermediaire', lifts: { squat: { kg: 110, reps: 5 }, bench: { kg: 85, reps: 5 }, deadlift: { kg: 140, reps: 5 }, press: { kg: 55, reps: 5 } } },
  })
  add(hugo, qh, 0.85)
  db.checkins.push({ id: uid('ck'), clientId: hugo.id, date: addDays(today, -2), energy: 3, sleep: 2, soreness: 4, pain: true, painZone: 'coude' })
  db.notifications.push({ id: uid('n'), userId: coach.id, title: 'Douleur signalée', body: 'Hugo signale une douleur (coude).', link: `/coach/client/${hugo.id}`, at: new Date(Date.now() - 2 * 86400000).toISOString(), read: false })

  // Léa : marathon dans 14 semaines
  const lea = mk('lea@demo.mind', 'Léa', 'client')
  const ql = baseQ(today)
  Object.assign(ql, {
    programType: 'course', runSessions: 4, maxMinutes: 90,
    run: { distance: 'marathon', raceDate: addDays(mondayOf(today), 7 * 13 + 6), objective: 'chrono', targetSeconds: 3 * 3600 + 50 * 60, level: 'intermediaire', weeklyKm: 35, longestKm: 16, recent: { distance: 'semi', seconds: 108 * 60, date: addDays(today, -40) } },
  })
  const pl = add(lea, ql, 0.95)
  const nextWeek = pl.weeks.find((w) => w.startDate === addDays(mondayOf(today), 7))
  if (nextWeek) {
    db.adaptations.unshift({
      id: uid('ad'), clientId: lea.id, programId: pl.id, date: today, kind: 'suggestion_ia', status: 'propose',
      text: `Ressenti élevé sur les deux dernières sorties : alléger la semaine ${nextWeek.n} de 15 %.`, payload: { type: 'scale_week', weekN: nextWeek.n, factor: 0.85 },
    })
  }

  // Théo : décroche
  const theo = mk('theo@demo.mind', 'Théo', 'client')
  const qt = baseQ(today)
  Object.assign(qt, { sex: 'homme', weightKg: 78, heightCm: 180, programType: 'muscu', muscuSessions: 3, maxMinutes: 60, strength: { goal: 'hypertrophie', level: 'debutant', lifts: {} } })
  add(theo, qt, 0.9, addDays(today, -10))

  // Nina : mode libre, PPL 4×/semaine en rotation
  addNina(db, today)

  // Un commentaire du coach + une réponse sur une séance faite de Camille
  const done = allSessions(pc).filter((s) => s.status === 'faite' && s.sport === 'muscu').sort((a, b) => b.date.localeCompare(a.date))[0]
  if (done) {
    db.comments.push(
      { id: uid('c'), sessionId: done.id, clientId: camille.id, authorId: coach.id, authorRole: 'coach', authorName: 'Max', text: 'Belle séance ! La charge monte bien, tu peux garder 1 rep en réserve sur la dernière série.', at: new Date(Date.now() - 86400000).toISOString() },
    )
    db.notifications.push({ id: uid('n'), userId: camille.id, title: 'Max a commenté ta séance', body: 'Belle séance ! La charge monte bien…', link: `/session/${done.id}`, at: new Date(Date.now() - 86400000).toISOString(), read: false })
  }
  db.seeded = true
  db.sessionUserId = null
  db.lastJobs = {}
  return db
}

export function ensureSeed(): void {
  if (getDB().seeded) {
    // démo déjà créée avant le mode libre : on ajoute Nina sans toucher au reste
    if (!getDB().users.some((u) => u.email === DEMO_ACCOUNTS.libre)) mutate((d) => { addNina(d, todayISO()) })
    return
  }
  const seeded = buildSeed()
  mutate((d) => { Object.assign(d, seeded) })
}
