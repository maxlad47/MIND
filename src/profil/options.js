// Libellés affichés pour les valeurs du profil (les valeurs stockées sont définies dans src/donnees/schema.js).
import { JOURS } from '../donnees/index.js'

export const OBJECTIFS_COURSE = [
  ['10km', '10 km'],
  ['semi', 'Semi-marathon'],
  ['marathon', 'Marathon'],
  ['pas_de_course', 'Pas de course visée'],
]
export const SOUS_OBJECTIFS = [
  ['garder_forme', 'Garder la forme'],
  ['courir_plus', 'Courir plus'],
  ['courir_plus_vite', 'Courir plus vite'],
]
export const OBJECTIFS_MUSCU = [
  ['force', 'Force'],
  ['force_esthetique', 'Force et esthétique'],
  ['hypertrophie', 'Hypertrophie et esthétisme'],
  ['tonification', 'Tonification'],
  ['aucun', 'Pas de muscu'],
]
export const OBJECTIFS_PRIORITAIRES = [
  ['course', 'Course'],
  ['muscu', 'Musculation'],
]
export const ORGANISATIONS = [
  ['full_body', 'Full body'],
  ['haut_bas', 'Haut / bas'],
  ['ppj', 'Push / pull / jambes'],
  ['ppH', 'Push / pull / haut-bas'],
  ['haut_bas_fb', 'Haut / bas + full body'],
  ['je_ne_sais_pas', 'Je ne sais pas'],
]
export const NIVEAUX_MUSCU = [
  ['debutant', 'Débutant (moins de 6 mois)'],
  ['intermediaire', 'Intermédiaire (6 mois à 2 ans)'],
  ['confirme', 'Confirmé (plus de 2 ans)'],
]
export const EQUIPEMENTS = [
  ['salle', 'Salle'],
  ['maison_halteres', 'Maison avec haltères'],
  ['poids_du_corps', 'Poids du corps'],
]
export const STATUTS_GROUPE_LIBELLES = [
  ['prioritaire', 'Prioritaire'],
  ['secondaire', 'Secondaire'],
  ['exclu', 'Exclu'],
]
export const JOURS_LIBELLES = {
  lun: 'Lun',
  mar: 'Mar',
  mer: 'Mer',
  jeu: 'Jeu',
  ven: 'Ven',
  sam: 'Sam',
  dim: 'Dim',
}
export { JOURS }
