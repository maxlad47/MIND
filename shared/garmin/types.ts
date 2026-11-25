// Types Garmin / activités importées — partagés entre l'app, le moteur et les Edge Functions (aucune dépendance).

/** Types d'activité de course (les seuls qu'on rattache à une séance). */
export type RunActivityType = 'route' | 'tapis' | 'trail' | 'piste'
export type ActivityType = RunActivityType | 'velo' | 'marche' | 'muscu' | 'autre'
export const RUN_TYPES: RunActivityType[] = ['route', 'tapis', 'trail', 'piste']
export const isRunType = (t: ActivityType | undefined): t is RunActivityType => !!t && (RUN_TYPES as string[]).includes(t)

export interface ImportedLap { meters: number; seconds: number; avgPaceSec: number; avgHr?: number }
/** `km` = longueur du tronçon (1 pour un km entier, moins pour le dernier km partiel). */
export interface ImportedSplit { km: number; seconds: number; avgPaceSec: number; avgHr?: number }
/** `t` = secondes depuis le départ. */
export interface HrPoint { t: number; hr: number }

export type ImportSource = 'garmin' | 'fit' | 'manuel'
export type ImportStatus = 'a_rattacher' | 'rattachee' | 'ignoree'

export interface ImportedRun {
  /** Stable et déterministe : dérivé de `externalId` (même activité reçue deux fois = même enregistrement). */
  id: string
  clientId: string
  source: ImportSource
  /** Sert à l'idempotence. Garmin : `garmin:<id d'activité>`, quelle que soit la méthode de liaison. */
  externalId: string
  /** Date et heure locales, `YYYY-MM-DDTHH:MM:SS`. */
  startAt: string
  km: number
  /** Temps en mouvement s'il est disponible, sinon temps total. */
  seconds: number
  avgPaceSec: number
  avgHr?: number
  maxHr?: number
  elevationGain?: number
  laps?: ImportedLap[]
  splits?: ImportedSplit[]
  hrSeries?: HrPoint[]
  activityType: ActivityType
  matchedSessionId?: string
  status: ImportStatus
  /** Raison d'un statut « ignorée » (ex. hors programme). */
  note?: string
  /** Date d'origine de la séance déplacée par le rattachement (veille ou lendemain) : sert à annuler. */
  movedFromDate?: string
}

/** Santé du jour : écrite par la synchro Garmin, un record par client et par jour. */
export interface HealthDay {
  id: string
  clientId: string
  date: string
  steps?: number
  sleepMinutes?: number
  sleepScore?: number
  sleepPhases?: { deepMin?: number; lightMin?: number; remMin?: number; awakeMin?: number }
}

/**
 * Statut de la liaison, sans aucun secret : écrit UNIQUEMENT par le serveur (le client ne peut pas se donner l'autorisation lui-même,
 * le serveur ne lit pas ce record pour décider), lu par le client et le coach.
 */
export interface GarminLink {
  id: string
  clientId: string
  /** Autorisation du coach (interrupteur de la fiche client). Le compte coach y a toujours droit. */
  allowed: boolean
  state: 'non_liee' | 'liee' | 'a_renouveler' | 'erreur'
  expiresAt?: string
  lastSyncAt?: string
  message?: string
}

/** Réglage du client, modifiable par lui et par le coach : sa FC max (zones cardio). */
export interface GarminSettings {
  id: string
  clientId: string
  maxHr?: number
  /** Objectif de pas par jour, choisi par le client (absent = pas d'objectif). */
  stepGoal?: number
}

/** Ce que sait lire un fichier FIT ou une synchro, avant d'être rattaché à un client. */
export type RunData = Omit<ImportedRun, 'id' | 'clientId' | 'source' | 'externalId' | 'status' | 'matchedSessionId' | 'note'> & { externalId?: string }
