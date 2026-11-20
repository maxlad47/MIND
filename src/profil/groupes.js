// Liste des groupes musculaires (décision de Max, 17/11/2026).
// Alignée sur `data/exercices.json` (V0-M7) : chaque `muscle_principal` est une de ces clés
// (vérifié par src/donnees/exercices.test.js). Les clés sont stockées dans
// `mind_reglages.groupes_statut` ; les libellés ne servent qu'à l'affichage.
export const GROUPES_MUSCULAIRES = Object.freeze([
  { cle: 'pectoraux', libelle: 'Pectoraux' },
  { cle: 'dos', libelle: 'Dos' },
  { cle: 'epaules', libelle: 'Épaules' },
  { cle: 'biceps', libelle: 'Biceps' },
  { cle: 'triceps', libelle: 'Triceps' },
  { cle: 'quadriceps', libelle: 'Quadriceps' },
  { cle: 'ischios', libelle: 'Ischio-jambiers' },
  { cle: 'fessiers', libelle: 'Fessiers' },
  { cle: 'mollets', libelle: 'Mollets' },
  { cle: 'abdos', libelle: 'Abdominaux' },
])
