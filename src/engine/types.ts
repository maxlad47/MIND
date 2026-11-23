// Types du moteur MIND — TypeScript pur, aucune dépendance UI.

export type Zone = 'epaule' | 'coude' | 'poignet' | 'dos' | 'hanche' | 'genou' | 'cheville'
export const ZONES: { id: Zone; label: string }[] = [
  { id: 'epaule', label: 'Épaule' },
  { id: 'coude', label: 'Coude' },
  { id: 'poignet', label: 'Poignet' },
  { id: 'dos', label: 'Dos / lombaires' },
  { id: 'hanche', label: 'Hanche' },
  { id: 'genou', label: 'Genou' },
  { id: 'cheville', label: 'Cheville' },
]

export type Muscle =
  | 'pectoraux' | 'dos' | 'epaules' | 'biceps' | 'triceps'
  | 'quadriceps' | 'ischios' | 'fessiers' | 'mollets' | 'abdos'

export const MUSCLE_LABEL: Record<Muscle, string> = {
  pectoraux: 'Pectoraux', dos: 'Dos', epaules: 'Épaules', biceps: 'Biceps', triceps: 'Triceps',
  quadriceps: 'Quadriceps', ischios: 'Ischio-jambiers', fessiers: 'Fessiers', mollets: 'Mollets', abdos: 'Abdominaux',
}
export const LOWER_MUSCLES: Muscle[] = ['quadriceps', 'ischios', 'fessiers', 'mollets']

export type Pattern =
  | 'push_h' | 'push_inc' | 'push_v' | 'pull_v' | 'pull_h' | 'squat' | 'hinge' | 'lunge'
  | 'leg_ext' | 'leg_curl' | 'fly' | 'lat_raise' | 'rear_delt' | 'curl' | 'tri_ext'
  | 'calf' | 'core' | 'hip_thrust' | 'glute_iso' | 'shrug'

export const PATTERN_LABEL: Record<Pattern, string> = {
  push_h: 'Poussée horizontale', push_inc: 'Poussée inclinée', push_v: 'Poussée verticale',
  pull_v: 'Tirage vertical', pull_h: 'Tirage horizontal', squat: 'Squat / presse', hinge: 'Charnière de hanche',
  lunge: 'Fente / unilatéral', leg_ext: 'Extension de jambe', leg_curl: 'Flexion de jambe', fly: 'Écarté',
  lat_raise: 'Élévation latérale', rear_delt: 'Deltoïde postérieur', curl: 'Flexion de coude',
  tri_ext: 'Extension de coude', calf: 'Mollets', core: 'Gainage / abdos', hip_thrust: 'Poussée de hanche',
  glute_iso: 'Isolation fessiers', shrug: 'Trapèzes',
}

export type Level = 'debutant' | 'intermediaire' | 'avance'
export type Equipment = 'barre' | 'halteres' | 'machine' | 'poulie' | 'poids_du_corps' | 'smith'

export interface Exercise {
  id: string
  name: string
  muscle: Muscle
  secondary: Muscle[]
  pattern: Pattern
  equipment: Equipment
  level: Level
  contra: Zone[]
  alts: string[]
  cue: string
  compound: boolean
}

export type Goal = 'hypertrophie' | 'force' | 'mixte'
export type ProgramType = 'muscu' | 'course' | 'mixte'
export type Priority = 'course' | 'muscu' | 'equilibre'
export type RaceDistance = '10k' | 'semi' | 'marathon'
export type RecentDistance = '5k' | '10k' | 'semi' | 'marathon'
export type SplitKey =
  | 'fullbody' | 'fullbody3' | 'haut_bas_full' | 'haut_bas' | 'haut_bas_ppj' | 'ppj'
  | 'haut_bas2' | 'ppj3' | 'ppj4' | 'muscle4' | 'muscle5' | 'muscle6' // choix de formule
  | 'push_pull_full' | 'push_pull' // sans jambes

export interface Lift { kg: number; reps: number }

/** « genere » : MIND crée le programme. « libre » : le client suit son propre programme, MIND sert de carnet. Absent = « genere ». */
export type ProgramMode = 'genere' | 'libre'

export interface Questionnaire {
  /** Mode d'utilisation. Absent = « genere » (anciens programmes). */
  mode?: ProgramMode
  firstName: string
  birthDate: string
  sex: 'homme' | 'femme' | 'autre'
  weightKg: number
  heightCm: number
  injuries: Zone[]
  injuryNote: string
  /** Muscles que le client ne veut pas travailler (ex. les jambes). */
  excludedMuscles?: Muscle[]
  programType: ProgramType
  muscuSessions: number
  runSessions: number
  availableDays: number[] // 0 = lundi … 6 = dimanche (union des jours de muscu et de course)
  /** Jours choisis par sport et jour de la sortie longue (0 = lundi). Absent = tous les jours disponibles. */
  dayPrefs?: { muscu?: number[]; run?: number[]; longRun?: number }
  maxMinutes: 45 | 60 | 75 | 90
  priority: Priority
  strength: {
    goal: Goal
    level: Level
    lifts: { squat?: Lift; bench?: Lift; deadlift?: Lift; press?: Lift }
    split?: SplitKey
  }
  run: {
    distance: RaceDistance
    raceDate: string
    objective: 'finir' | 'chrono'
    targetSeconds?: number
    level: Level
    vma?: number
    /** ancien format : un seul chrono de référence */
    recent?: { distance: RecentDistance; seconds: number; date: string }
    /** chronos de référence (5 km, 10 km, semi, marathon) */
    recents?: { distance: RecentDistance; seconds: number; date: string }[]
    weeklyKm: number
    longestKm: number
    /** Volume hebdomadaire visé au pic de la préparation (km). Absent = valeur par défaut selon distance/niveau. */
    peakKm?: number
    /** Démarrage : tout de suite (fractionné dès le début) ou progressif (endurance d'abord). Absent = avis de MIND. */
    startMode?: 'direct' | 'progressif'
  }
  startDate: string
}

export type SessionStatus = 'prevue' | 'faite' | 'manquee' | 'sautee'
export type RunKind =
  | 'ef' | 'longue' | 'vma' | 'seuil' | 'specifique' | 'cotes' | 'fartlek' | 'recup' | 'test' | 'course'
export type StrengthKind = 'fullbody' | 'haut' | 'bas' | 'push' | 'pull' | 'jambes' | 'pecs' | 'dos' | 'epaules' | 'bras'
export type Phase = 'Base' | 'Développement' | 'Spécifique' | 'Affûtage' | 'Musculation'

export interface SetLog { n: number; kg: number; reps: number; rir: number; at: string }

export interface SessionExercise {
  id: string
  exerciseId: string
  order: number
  sets: number
  repMin: number
  repMax: number
  rir: number
  restSec: number
  targetKg?: number
  logs: SetLog[]
  note?: string
  /** Mode libre : le client n'a pas fixé de RIR visé (on n'affiche pas « RIR 2 » par défaut). */
  noRir?: boolean
}

export interface RunBlock {
  label: string
  /** distance en mètres (optionnel si durée) */
  meters?: number
  seconds?: number
  reps?: number
  /** allure cible en secondes par km */
  paceSec?: number
  recSec?: number
  recLabel?: string
}

export interface RunPlan {
  warmup: string
  blocks: RunBlock[]
  cooldown: string
  totalKm: number
  estMinutes: number
}

export interface RunLog {
  km: number
  seconds: number
  feeling: number
  comment: string
  source: 'manuel' | 'strava' | 'apple_sante'
  at: string
}

export interface Session {
  id: string
  weekN: number
  date: string // YYYY-MM-DD
  slot?: 'am' | 'pm'
  sport: 'muscu' | 'course'
  kind: RunKind | StrengthKind
  title: string
  status: SessionStatus
  estMinutes: number
  exercises?: SessionExercise[]
  run?: RunPlan
  runLog?: RunLog
  legLoad?: 'heavy' | 'light' | 'none'
  lighten?: boolean
  feeling?: number
  doneAt?: string
  durationMin?: number
  movedFrom?: string
  note?: string
  /** Mode libre : séance modèle dont cette séance est issue. */
  templateId?: string
  /** Mode libre : « séance en plus », hors planning (ne décale rien, ne fait pas avancer la rotation). */
  extra?: boolean
}

export interface Week {
  n: number
  startDate: string
  phase: Phase
  light: boolean // semaine allégée / décharge
  note?: string
  sessions: Session[]
}

export interface Paces {
  vma: number
  recup: number
  ef: number
  marathon: number
  semi: number
  seuil: number
  dix: number
  vmaPace: number
  source: 'vma' | 'chrono' | 'niveau'
}

export type WarningCode =
  | 'prepa_trop_courte' | 'chrono_irrealiste' | 'prepa_longue' | 'muscu_prioritaire_course'
  | 'conflit_placement' | 'blessure' | 'jours_insuffisants' | 'duree_courte' | 'chrono_a_confirmer' | 'muscles_exclus' | 'pic_non_atteint'

export interface PlanWarning {
  code: WarningCode
  message: string
  suggestion?: string
}

// ------------------------------------------------------------------ mode libre

/** Un exercice d'une séance modèle. Le RIR visé est facultatif. */
export interface TemplateExercise {
  id: string
  exerciseId: string
  sets: number
  repMin: number
  repMax: number
  restSec: number
  rir?: number
  note?: string
}

/** Séance modèle créée par le client (ex. Push, Pull, Legs). */
export interface SessionTemplate {
  id: string
  name: string
  exercises: TemplateExercise[]
}

/**
 * Planning du mode libre.
 * - « fixe » : `days[0..6]` (lundi → dimanche) = id du modèle du jour, ou null pour un repos.
 * - « rotation » : jours d'entraînement cochés + ordre des modèles ; MIND les enchaîne A → B → C → A…
 */
export type LibrePlanning =
  | { mode: 'fixe'; days: (string | null)[] }
  | { mode: 'rotation'; days: number[]; order: string[] }

export interface LibrePlan {
  templates: SessionTemplate[]
  planning: LibrePlanning
  /** Interrupteur « Suggestions de charge » (désactivé par défaut). */
  suggestLoads: boolean
  /** Exercices créés par le client (ids « custom:… »). */
  customExercises: Exercise[]
}

export interface Program {
  id: string
  clientId: string
  /** Absent = « genere ». */
  mode?: ProgramMode
  /** Séances modèles et planning (mode libre uniquement). */
  libre?: LibrePlan
  type: ProgramType
  goal: Goal
  priority: Priority
  startDate: string
  raceDate?: string
  raceDistance?: RaceDistance
  targetSeconds?: number
  objective?: 'finir' | 'chrono'
  status: 'actif' | 'termine' | 'archive'
  weeks: Week[]
  paces?: Paces
  warnings: PlanWarning[]
  split?: SplitKey
  cycle: number
  createdAt: string
  q: Questionnaire
}

export interface Checkin {
  id: string
  clientId: string
  sessionId?: string
  date: string
  energy: number
  sleep: number
  soreness: number
  pain: boolean
  painZone?: Zone
}

export type AdaptationKind =
  | 'deplacee' | 'sautee' | 'charge' | 'allures' | 'allegee' | 'remplacement' | 'suggestion_ia' | 'manuelle'
export interface Adaptation {
  id: string
  clientId: string
  programId: string
  date: string
  kind: AdaptationKind
  text: string
  status: 'applique' | 'propose' | 'accepte' | 'refuse' | 'annule'
  /** Instantané des séances avant modification, pour annuler */
  undo?: { sessions: Session[] }
  payload?: unknown
}
