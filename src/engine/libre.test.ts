import { describe, expect, it } from 'vitest'
import { allSessions, handleMissed } from './adapt'
import { EXERCISE_BY_ID, exerciseOf, makeCustomExercise, registerCustomExercises } from './exercises'
import { BASE_Q, P_DEBUTANT, P_MIXTE } from './fixtures'
import {
  applyRunPlan, diffSessionTemplate, emptyPlanning, estimateLiftsFromHistory, isFreeRun, libreFromProgram, newLibreProgram, newTemplate, newTemplateExercise,
  syncFree, templateFromSession, withExtraSession, WEEKS_AHEAD,
} from './libre'
import { generateProgram } from './program'
import type { LibrePlanning, Program, Session, SessionTemplate } from './types'
import { addDays, weekday } from './utils'

const MON = '2026-03-02' // un lundi

function tpl(name: string, ...ids: string[]): SessionTemplate {
  const t = newTemplate(name)
  t.exercises = ids.map((id) => newTemplateExercise(id))
  return t
}
const PUSH = tpl('Push', 'dev_couche_barre', 'dev_militaire_barre')
const PULL = tpl('Pull', 'rowing_barre', 'tirage_vertical')
const LEGS = tpl('Legs', 'squat_barre', 'presse_cuisses')

const fixed = (map: Record<number, SessionTemplate>): LibrePlanning => ({
  mode: 'fixe', days: [0, 1, 2, 3, 4, 5, 6].map((d) => map[d]?.id ?? null),
})
const rotation = (days: number[], order: SessionTemplate[]): LibrePlanning => ({ mode: 'rotation', days, order: order.map((t) => t.id) })

function mk(templates: SessionTemplate[], planning: LibrePlanning, now = MON): Program {
  return newLibreProgram({ ...BASE_Q, mode: 'libre' }, { clientId: 'c1', now, templates, planning })
}
/** Séances de muscu planifiées (hors « en plus »), triées par date. */
const planned = (p: Program) => allSessions(p).filter((s) => !s.extra && s.status !== 'sautee').sort((a, b) => a.date.localeCompare(b.date))
const titles = (list: Session[]) => list.map((s) => s.title)
const find = (p: Program, date: string) => allSessions(p).find((s) => s.date === date && !s.extra)!

/** Marque une séance comme faite avec des séries saisies. */
function finish(p: Program, id: string, kg = 60): void {
  const s = allSessions(p).find((x) => x.id === id)!
  s.status = 'faite'
  s.doneAt = `${s.date}T18:00:00.000Z`
  for (const e of s.exercises ?? []) e.logs = Array.from({ length: e.sets }, (_, i) => ({ n: i + 1, kg, reps: e.repMax, rir: 2, at: s.doneAt! }))
}

describe('mode libre : génération du planning', () => {
  it('jours fixes : chaque jour est associé à son modèle, sur la semaine en cours et 4 semaines d\'avance', () => {
    const p = mk([PUSH, PULL, LEGS], fixed({ 0: PUSH, 2: PULL, 4: LEGS }))
    expect(p.mode).toBe('libre')
    expect(p.weeks).toHaveLength(1 + WEEKS_AHEAD)
    expect(p.weeks.every((w) => w.phase === 'Musculation' && w.light === false)).toBe(true)
    const list = planned(p)
    expect(list).toHaveLength(3 * (1 + WEEKS_AHEAD))
    expect(titles(list.slice(0, 6))).toEqual(['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs'])
    expect(list.slice(0, 3).map((s) => s.date)).toEqual([MON, addDays(MON, 2), addDays(MON, 4)])
    expect(list.every((s) => s.sport === 'muscu' && s.status === 'prevue' && s.templateId)).toBe(true)
    expect(list[0].exercises!.map((e) => e.exerciseId)).toEqual(['dev_couche_barre', 'dev_militaire_barre'])
  })

  it('rotation de 3 modèles sur 3 jours : A → B → C → A…', () => {
    const p = mk([PUSH, PULL, LEGS], rotation([0, 2, 4], [PUSH, PULL, LEGS]))
    expect(titles(planned(p).slice(0, 7))).toEqual(['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs', 'Push'])
  })

  it('PPL 4×/semaine en rotation : la semaine 2 commence par Pull', () => {
    const p = mk([PUSH, PULL, LEGS], rotation([0, 1, 3, 4], [PUSH, PULL, LEGS]))
    const w1 = p.weeks[0].sessions, w2 = p.weeks[1].sessions
    expect(titles(w1)).toEqual(['Push', 'Pull', 'Legs', 'Push'])
    expect(titles(w2)).toEqual(['Pull', 'Legs', 'Push', 'Pull'])
  })

  it('rotation : une séance manquée ne consomme pas son tour', () => {
    const p = mk([PUSH, PULL, LEGS], rotation([0, 1, 3, 4], [PUSH, PULL, LEGS]))
    finish(p, find(p, MON).id) // Push fait lundi, Pull du mardi jamais faite
    const thu = addDays(MON, 3)
    const after = syncFree(p, thu)
    expect(find(after, addDays(MON, 1)).status).toBe('manquee')
    // jeudi : on reprend à Pull (le dernier modèle FAIT est Push), puis Legs, Push…
    expect(titles(planned(after).filter((s) => s.date >= thu).slice(0, 4))).toEqual(['Pull', 'Legs', 'Push', 'Pull'])
    // le lundi fait n'a pas bougé
    expect(find(after, MON).status).toBe('faite')
    expect(find(after, MON).exercises![0].logs).toHaveLength(3)
  })

  it('jours fixes : une séance manquée reste simplement manquée (rien n\'est décalé)', () => {
    const p = mk([PUSH, PULL, LEGS], fixed({ 0: PUSH, 2: PULL, 4: LEGS }))
    const after = syncFree(p, addDays(MON, 3)) // lundi et mercredi non faits
    expect(find(after, MON).status).toBe('manquee')
    expect(find(after, addDays(MON, 2)).status).toBe('manquee')
    expect(find(after, addDays(MON, 4)).title).toBe('Legs')
    expect(planned(after).filter((s) => s.status === 'prevue').length).toBe(1 + 3 * WEEKS_AHEAD)
  })

  it('la fenêtre glissante se prolonge, sans fin de cycle ; les semaines non ouvertes restent vides', () => {
    const p = mk([PUSH, PULL], fixed({ 0: PUSH, 3: PULL }))
    const later = syncFree(p, addDays(MON, 70)) // l'app n'a pas été ouverte pendant 10 semaines
    expect(later.weeks[later.weeks.length - 1].startDate).toBe(addDays(MON, 70 + 7 * WEEKS_AHEAD))
    const gap = later.weeks.find((w) => w.startDate === addDays(MON, 21))!
    expect(gap.sessions.length).toBeGreaterThan(0)
    expect(gap.sessions.every((s) => s.status === 'manquee')).toBe(true) // générées d'avance, jamais faites
    const empty = later.weeks.find((w) => w.startDate === addDays(MON, 7 * (1 + WEEKS_AHEAD)))!
    expect(empty.sessions).toHaveLength(0) // semaine jamais générée : pas de manquées imaginaires
    expect(planned(later).filter((s) => s.status === 'prevue').length).toBe(2 * (1 + WEEKS_AHEAD))
  })
})

describe('mode libre : modifications', () => {
  it('un modèle modifié ne met à jour que les séances futures prévues et vierges', () => {
    const planning = fixed({ 0: PUSH, 2: PUSH, 4: PUSH })
    const p0 = mk([PUSH], planning)
    const wed = addDays(MON, 2)
    finish(p0, find(p0, MON).id)
    // vendredi : une série déjà saisie
    const fri = find(p0, addDays(MON, 4))
    fri.exercises![0].logs = [{ n: 1, kg: 80, reps: 8, rir: 2, at: '2026-03-06T10:00:00.000Z' }]
    const p1 = syncFree(p0, wed)

    const edited: SessionTemplate = { ...PUSH, name: 'Push lourd', exercises: [...PUSH.exercises, newTemplateExercise('curl_concentre')] }
    p1.libre!.templates = [edited]
    const p2 = syncFree(p1, wed)

    const mon = find(p2, MON), wedS = find(p2, wed), friS = find(p2, addDays(MON, 4)), nextWed = find(p2, addDays(wed, 7))
    expect(mon.title).toBe('Push') // fait : intact
    expect(mon.exercises).toHaveLength(2)
    expect(friS.title).toBe('Push') // série saisie : intacte
    expect(friS.exercises).toHaveLength(2)
    expect(friS.exercises![0].logs).toHaveLength(1)
    expect(wedS.title).toBe('Push lourd') // prévue et vierge : mise à jour
    expect(wedS.exercises).toHaveLength(3)
    expect(wedS.id).toBe(find(p1, wed).id) // même séance, même lien
    expect(nextWed.title).toBe('Push lourd')
  })

  it('changer le planning recalcule les séances futures vierges uniquement', () => {
    const p = mk([PUSH, PULL], fixed({ 0: PUSH, 2: PULL }))
    finish(p, find(p, MON).id)
    p.libre!.planning = fixed({ 1: PUSH, 3: PULL })
    const after = syncFree(p, addDays(MON, 1))
    expect(find(after, MON).status).toBe('faite')
    expect(find(after, addDays(MON, 1)).title).toBe('Push')
    expect(find(after, addDays(MON, 3)).title).toBe('Pull')
    expect(allSessions(after).some((s) => s.date === addDays(MON, 2) && s.status === 'prevue')).toBe(false)
  })

  it('une séance déplacée à la main garde sa date et bloque son ancien créneau', () => {
    const p = mk([PUSH, PULL], fixed({ 0: PUSH, 2: PULL }))
    const wed = find(p, addDays(MON, 2))
    wed.movedFrom = wed.date
    wed.date = addDays(MON, 3)
    const after = syncFree(p, MON)
    expect(allSessions(after).filter((s) => s.date === addDays(MON, 2) && !s.extra)).toHaveLength(0)
    expect(find(after, addDays(MON, 3)).title).toBe('Pull')
    expect(planned(after).filter((s) => s.title === 'Pull' && s.date < addDays(MON, 7))).toHaveLength(1)
  })

  it('supprimer le modèle d\'une séance retire ses séances futures vierges', () => {
    const p = mk([PUSH, PULL], fixed({ 0: PUSH, 2: PULL }))
    p.libre!.templates = [PUSH]
    p.libre!.planning = fixed({ 0: PUSH })
    const after = syncFree(p, MON)
    expect(planned(after).every((s) => s.title === 'Push')).toBe(true)
  })
})

describe('mode libre : séance en plus', () => {
  it('ne décale pas le planning et ne fait pas avancer la rotation', () => {
    const p = mk([PUSH, PULL, LEGS], rotation([0, 1, 3, 4], [PUSH, PULL, LEGS]))
    const before = titles(planned(p).filter((s) => s.date >= MON))
    const { program, sessionId } = withExtraSession(p, MON, { templateId: LEGS.id })
    const extra = allSessions(program).find((s) => s.id === sessionId)!
    expect(extra.extra).toBe(true)
    expect(extra.date).toBe(MON)
    expect(extra.title).toBe('Legs')
    expect(titles(planned(program))).toEqual(before) // planning identique
    // l'extra est faite : elle compte dans les stats mais la rotation n'avance pas
    finish(program, sessionId)
    const after = syncFree(program, MON)
    expect(titles(planned(after))).toEqual(before)
    expect(allSessions(after).filter((s) => s.status === 'faite' && s.extra)).toHaveLength(1)
    // même après la journée : la prochaine séance prévue reste celle du planning
    // le lendemain : le Push prévu lundi n'a pas été fait (manqué), la séance en plus n'a rien consommé → on repart de Push
    const tue = syncFree(after, addDays(MON, 1))
    expect(find(tue, MON).status).toBe('manquee')
    expect(titles(planned(tue).filter((s) => s.date >= addDays(MON, 1)).slice(0, 3))).toEqual(['Push', 'Pull', 'Legs'])
  })

  it('une séance en plus jamais commencée disparaît le lendemain (ce n\'est pas une séance manquée)', () => {
    const p = mk([PUSH], fixed({ 0: PUSH }))
    const { program } = withExtraSession(p, MON, 'vide')
    const next = syncFree(program, addDays(MON, 1))
    expect(allSessions(next).some((s) => s.extra)).toBe(false)
  })

  it('sortie de course libre : séance de course sans plan, comptée dans les stats', () => {
    const p = mk([PUSH], fixed({ 0: PUSH }))
    const { program, sessionId } = withExtraSession(p, MON, 'course')
    const run = allSessions(program).find((s) => s.id === sessionId)!
    expect(run.sport).toBe('course')
    expect(isFreeRun(run)).toBe(true)
    expect(isFreeRun(find(program, MON))).toBe(false)
  })
})

describe('mode libre : différences séance / modèle', () => {
  const base = () => {
    const p = mk([PUSH, PULL, LEGS], fixed({ 0: PUSH }))
    return { p, s: find(p, MON), t: p.libre!.templates.find((x) => x.id === PUSH.id)! }
  }

  it('une séance identique au modèle n\'a aucune différence ; les charges saisies ne comptent pas', () => {
    const { p, s, t } = base()
    expect(diffSessionTemplate(s, t)).toHaveLength(0)
    finish(p, s.id, 100)
    expect(diffSessionTemplate(find(p, MON), t)).toHaveLength(0)
  })

  it('détecte exercice ajouté, retiré, remplacé, réordonné, séries, reps et repos', () => {
    const { s, t } = base()
    // ajouté
    const added = structuredClone(s)
    added.exercises!.push({ ...added.exercises![0], id: 'x', exerciseId: 'curl_concentre' })
    expect(diffSessionTemplate(added, t).map((c) => c.kind)).toEqual(['ajoute'])
    // retiré
    const removed = structuredClone(s)
    removed.exercises!.pop()
    expect(diffSessionTemplate(removed, t).map((c) => c.kind)).toEqual(['retire'])
    // remplacé
    const swapped = structuredClone(s)
    swapped.exercises![1].exerciseId = 'dev_epaules_halteres'
    const sw = diffSessionTemplate(swapped, t)
    expect(sw.map((c) => c.kind)).toEqual(['remplace'])
    expect(sw[0].text).toContain('remplacé par')
    // réordonné
    const reordered = structuredClone(s)
    reordered.exercises!.reverse()
    expect(diffSessionTemplate(reordered, t).map((c) => c.kind)).toEqual(['ordre'])
    // séries, reps, repos
    const tweaked = structuredClone(s)
    tweaked.exercises![0].sets = 5
    tweaked.exercises![0].repMax = 12
    tweaked.exercises![1].restSec = 180
    const tw = diffSessionTemplate(tweaked, t)
    expect(tw.map((c) => c.kind).sort()).toEqual(['repos', 'reps', 'series'])
    expect(tw.length).toBe(3)
  })

  it('« garder les changements » met à jour le modèle puis les séances futures vierges', () => {
    const { p, s, t } = base()
    const changed = structuredClone(s)
    changed.exercises![0].sets = 5
    changed.exercises!.push({ ...changed.exercises![0], id: 'y', exerciseId: 'curl_concentre', sets: 2 })
    const next = templateFromSession(changed, t)
    expect(next.exercises.map((e) => [e.exerciseId, e.sets])).toEqual([['dev_couche_barre', 5], ['dev_militaire_barre', 3], ['curl_concentre', 2]])
    expect(next.exercises[0].id).toBe(t.exercises[0].id) // les exercices conservés gardent leur identité
    expect(diffSessionTemplate(changed, next)).toHaveLength(0)
    p.libre!.templates = [next]
    const after = syncFree(p, addDays(MON, 1))
    const nextMon = find(after, addDays(MON, 7))
    expect(nextMon.exercises).toHaveLength(3)
    expect(nextMon.exercises![0].sets).toBe(5)
  })
})

describe('mode libre : suggestions de charge', () => {
  it('désactivées par défaut : aucune charge cible', () => {
    const p = mk([PUSH], fixed({ 0: PUSH }))
    finish(p, find(p, MON).id, 80)
    const after = syncFree(p, addDays(MON, 1))
    expect(allSessions(after).filter((s) => s.status === 'prevue').every((s) => s.exercises!.every((e) => e.targetKg === undefined))).toBe(true)
  })

  it('activées : double progression du moteur (toutes les séries au haut de la fourchette → la charge monte)', () => {
    const p = mk([PUSH], fixed({ 0: PUSH }))
    p.libre!.suggestLoads = true
    finish(p, find(p, MON).id, 80) // toutes les séries à repMax, RIR 2
    const after = syncFree(p, addDays(MON, 1))
    const next = find(after, addDays(MON, 7))
    expect(next.exercises![0].targetKg).toBe(82.5)
    // on les désactive : les charges cibles disparaissent
    after.libre!.suggestLoads = false
    expect(find(syncFree(after, addDays(MON, 1)), addDays(MON, 7)).exercises![0].targetKg).toBeUndefined()
  })
})

describe('mode libre : exercices perso', () => {
  it('se résolvent comme ceux de la bibliothèque sans jamais planter, et ne polluent pas le générateur', () => {
    const c = makeCustomExercise('custom:abc', 'Curl marteau poulie', 'biceps')
    registerCustomExercises([c])
    expect(EXERCISE_BY_ID['custom:abc'].name).toBe('Curl marteau poulie')
    expect(exerciseOf('custom:abc').muscle).toBe('biceps')
    expect(exerciseOf('custom:inconnu').name).toBe('Exercice supprimé')
    const t = tpl('Bras', 'custom:abc', 'curl_concentre')
    const p = mk([t], fixed({ 0: t }))
    expect(find(p, MON).exercises![0].exerciseId).toBe('custom:abc')
    // un programme généré ne contient jamais d'exercice perso
    const g = generateProgram({ ...P_DEBUTANT }, { now: '2026-01-05', clientId: 'c' })
    expect(allSessions(g).flatMap((s) => s.exercises ?? []).some((e) => e.exerciseId.startsWith('custom:'))).toBe(false)
    registerCustomExercises([])
    expect(EXERCISE_BY_ID['custom:abc']).toBeUndefined()
  })
})

describe('mode libre : ce que MIND ne fait pas', () => {
  it('aucune réorganisation automatique : syncFree ne décale rien, handleMissed est inutile', () => {
    const p = mk([PUSH, PULL], fixed({ 0: PUSH, 2: PULL }))
    const after = syncFree(p, addDays(MON, 3))
    expect(allSessions(after).every((s) => !s.movedFrom)).toBe(true)
    expect(allSessions(after).every((s) => !s.lighten)).toBe(true)
    expect(after.warnings).toEqual([])
  })
})

describe('passage MIND → Libre', () => {
  it('« partir de mon programme actuel » : un modèle par séance distincte et le planning en jours fixes', () => {
    const g = generateProgram({ ...P_DEBUTANT, startDate: MON }, { now: MON, clientId: 'c1' })
    const week = g.weeks[0].sessions.filter((s) => s.sport === 'muscu').sort((a, b) => a.date.localeCompare(b.date))
    const conv = libreFromProgram(g, MON)
    expect(conv.templates.length).toBe(new Set(week.map((s) => s.title)).size)
    expect(conv.templates.every((t) => t.exercises.length > 0)).toBe(true)
    expect(conv.planning.mode).toBe('fixe')
    for (const s of week) {
      const id = (conv.planning as Extract<LibrePlanning, { mode: 'fixe' }>).days[weekday(s.date)]
      expect(conv.templates.find((t) => t.id === id)?.name).toBe(s.title)
    }
    // le premier modèle reprend les exercices de la séance, sans les charges
    const first = week[0]
    const t0 = conv.templates.find((t) => t.name === first.title)!
    expect(t0.exercises.map((e) => e.exerciseId)).toEqual(first.exercises!.map((e) => e.exerciseId))
    // ce planning produit des séances libres équivalentes
    const libre = newLibreProgram({ ...g.q, mode: 'libre' }, { clientId: 'c1', now: MON, ...conv })
    expect(titles(libre.weeks[0].sessions)).toEqual(titles(week))
  })

  it('un programme sans musculation donne un carnet vide (rien à reprendre)', () => {
    const g = generateProgram({ ...P_MIXTE, programType: 'course', startDate: MON }, { now: MON, clientId: 'c1' })
    const conv = libreFromProgram(g, MON)
    expect(conv.templates).toHaveLength(0)
    expect(conv.planning).toEqual(emptyPlanning())
  })
})

describe('passage Libre → MIND', () => {
  it('estime les charges de référence à partir de l\'historique, quand les exercices correspondent', () => {
    const squat = tpl('Legs', 'squat_barre')
    const bench = tpl('Push', 'dev_couche_barre', 'rowing_barre')
    const p = mk([squat, bench], fixed({ 0: bench, 2: squat }))
    finish(p, find(p, MON).id, 80)
    finish(p, find(p, addDays(MON, 2)).id, 100)
    const lifts = estimateLiftsFromHistory(allSessions(p), addDays(MON, 3))
    expect(lifts.bench).toEqual({ kg: 80, reps: 10 })
    expect(lifts.squat?.kg).toBe(100)
    expect(lifts.deadlift).toBeUndefined()
    expect(lifts.press).toBeUndefined()
  })
})

describe('muscu libre + course MIND', () => {
  const RUN_Q = { ...P_MIXTE, mode: 'libre' as const, programType: 'mixte' as const, startDate: MON, dayPrefs: { run: [1, 3, 5], longRun: 5 }, availableDays: [1, 3, 5] }
  const hybrid = () => newLibreProgram(RUN_Q, { clientId: 'c1', now: MON, templates: [PUSH, PULL], planning: fixed({ 0: PUSH, 2: PULL }) })

  it('le plan de course est généré par MIND jusqu\'à la course, la muscu libre reste sur sa fenêtre de 4 semaines', () => {
    const p = hybrid()
    expect(p.mode).toBe('libre')
    expect(p.type).toBe('mixte')
    expect(p.paces).toBeTruthy()
    expect(p.raceDate).toBe(RUN_Q.run.raceDate)
    const runs = allSessions(p).filter((s) => s.sport === 'course')
    expect(runs.length).toBeGreaterThanOrEqual(8)
    expect(runs.some((s) => s.kind === 'longue')).toBe(true)
    // les sorties sont sur les jours choisis pour la course
    expect(runs.filter((s) => s.kind !== 'course').every((s) => [1, 3, 5].includes(weekday(s.date)))).toBe(true)
    // la muscu libre ne dépasse pas la fenêtre glissante
    const muscu = allSessions(p).filter((s) => s.sport === 'muscu')
    expect(muscu.every((s) => s.date <= addDays(MON, 7 * (WEEKS_AHEAD + 1) - 1))).toBe(true)
    expect(muscu.every((s) => s.templateId)).toBe(true)
    // les semaines du carnet portent les phases du plan de course
    expect(p.weeks.some((w) => w.phase !== 'Musculation')).toBe(true)
  })

  it('syncFree ne touche pas aux séances de course (elles restent à handleMissed), la muscu manquée est simplement « manquée »', () => {
    const p = hybrid()
    const later = syncFree(p, addDays(MON, 4))
    const pastRuns = allSessions(later).filter((s) => s.sport === 'course' && s.date < addDays(MON, 4))
    expect(pastRuns.length).toBeGreaterThan(0)
    expect(pastRuns.every((s) => s.status === 'prevue')).toBe(true)
    expect(allSessions(later).filter((s) => s.sport === 'muscu' && s.date < addDays(MON, 4)).every((s) => s.status === 'manquee')).toBe(true)
    // handleMissed ne déplace que la course
    const res = handleMissed(later, addDays(MON, 4), RUN_Q.dayPrefs.run)
    expect(allSessions(res.program).filter((s) => s.sport === 'muscu').every((s) => !s.movedFrom)).toBe(true)
    expect(allSessions(res.program).filter((s) => s.sport === 'course' && s.date < addDays(MON, 4)).every((s) => s.status !== 'prevue' || s.movedFrom)).toBe(true)
  })

  it('modifier un modèle ne touche pas au plan de course ; applyRunPlan régénère seulement la course future', () => {
    const p = hybrid()
    const runsBefore = JSON.stringify(allSessions(p).filter((s) => s.sport === 'course').map((s) => [s.date, s.title, s.run!.totalKm]))
    p.libre!.templates = [{ ...PUSH, name: 'Push lourd' }, PULL]
    const after = syncFree(p, MON)
    expect(JSON.stringify(allSessions(after).filter((s) => s.sport === 'course').map((s) => [s.date, s.title, s.run!.totalKm]))).toBe(runsBefore)
    // objectif chrono → finir : la course est régénérée, la muscu libre reste identique
    const q2 = { ...after.q, run: { ...after.q.run, objective: 'finir' as const, targetSeconds: undefined } }
    const regen = syncFree(applyRunPlan(after, q2, MON), MON)
    expect(regen.objective).toBe('finir')
    expect(JSON.stringify(allSessions(regen).filter((s) => s.sport === 'muscu').map((s) => [s.date, s.title]))).toBe(JSON.stringify(allSessions(after).filter((s) => s.sport === 'muscu').map((s) => [s.date, s.title])))
  })

  it('retirer le plan de course (formulaire sans course) retire les sorties futures et garde la muscu', () => {
    const p = hybrid()
    const done = allSessions(p).find((s) => s.sport === 'course')!
    done.status = 'faite'
    done.runLog = { km: 5, seconds: 1800, feeling: 5, comment: '', source: 'manuel', at: '' }
    const without = syncFree(applyRunPlan(p, { ...p.q, programType: 'muscu' }, addDays(MON, 7)), addDays(MON, 7))
    expect(without.type).toBe('muscu')
    expect(without.paces).toBeUndefined()
    const runs = allSessions(without).filter((s) => s.sport === 'course')
    expect(runs.length).toBeGreaterThan(0)
    expect(runs.every((s) => s.date < addDays(MON, 7))).toBe(true) // plus aucune sortie future ; l'historique (faites, passées) reste
    expect(runs.some((s) => s.status === 'faite')).toBe(true)
    expect(allSessions(without).filter((s) => s.sport === 'muscu' && s.status === 'prevue').length).toBeGreaterThan(0)
  })
})
