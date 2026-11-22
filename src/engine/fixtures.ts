import type { Questionnaire } from './types'

export const BASE_Q: Questionnaire = {
  firstName: 'Test',
  birthDate: '1995-04-12',
  sex: 'homme',
  weightKg: 75,
  heightCm: 178,
  injuries: [],
  injuryNote: '',
  programType: 'muscu',
  muscuSessions: 3,
  runSessions: 2,
  availableDays: [0, 1, 2, 3, 4, 5, 6],
  maxMinutes: 75,
  priority: 'equilibre',
  strength: { goal: 'hypertrophie', level: 'debutant', lifts: {} },
  run: {
    distance: '10k', raceDate: '2026-04-26', objective: 'finir', level: 'intermediaire',
    weeklyKm: 20, longestKm: 10,
  },
  startDate: '2026-01-05',
}

/** Débutant hypertrophie 3×/sem */
export const P_DEBUTANT: Questionnaire = {
  ...BASE_Q, programType: 'muscu', muscuSessions: 3, maxMinutes: 60,
  strength: { goal: 'hypertrophie', level: 'debutant', lifts: {} },
}

/** Intermédiaire force 4×/sem, douleur à l'épaule */
export const P_FORCE_EPAULE: Questionnaire = {
  ...BASE_Q, programType: 'muscu', muscuSessions: 4, maxMinutes: 90, injuries: ['epaule'],
  strength: {
    goal: 'force', level: 'intermediaire',
    lifts: { squat: { kg: 100, reps: 5 }, bench: { kg: 80, reps: 5 }, deadlift: { kg: 120, reps: 5 }, press: { kg: 50, reps: 5 } },
  },
}

/** Marathon dans 16 semaines, 4 sorties, 3:45 */
export const P_MARATHON: Questionnaire = {
  ...BASE_Q, programType: 'course', runSessions: 4, maxMinutes: 90,
  run: {
    distance: 'marathon', raceDate: '2026-04-26', objective: 'chrono', targetSeconds: 3 * 3600 + 45 * 60,
    level: 'intermediaire', weeklyKm: 35, longestKm: 16,
    recent: { distance: '10k', seconds: 49 * 60, date: '2025-12-10' },
  },
}

/** 10 km dans 5 semaines (cas trop court) */
export const P_10K_COURT: Questionnaire = {
  ...BASE_Q, programType: 'course', runSessions: 3,
  run: {
    distance: '10k', raceDate: '2026-02-08', objective: 'chrono', targetSeconds: 50 * 60,
    level: 'debutant', weeklyKm: 15, longestKm: 8,
  },
}

/** Mixte 3 muscu + 2 course, priorité course */
export const P_MIXTE: Questionnaire = {
  ...BASE_Q, programType: 'mixte', muscuSessions: 3, runSessions: 2, priority: 'course', maxMinutes: 75,
  strength: { goal: 'hypertrophie', level: 'intermediaire', lifts: {} },
  run: {
    distance: 'semi', raceDate: '2026-03-29', objective: 'finir', level: 'intermediaire',
    weeklyKm: 25, longestKm: 12, vma: 15,
  },
}
