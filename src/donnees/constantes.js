// Constantes du modèle de données (MODELE_DONNEES.md, V1-M0).

export const PREFIXE = 'mind_'

// Numéro de version du schéma. Toute modification du schéma l'incrémente et ajoute une migration.
export const VERSION_SCHEMA = 1

export const CLES = Object.freeze({
  version: 'mind_version',
  profil: 'mind_profil',
  chronos: 'mind_chronos',
  plan: 'mind_plan',
  semaines: 'mind_semaines',
  seances: 'mind_seances',
  charges: 'mind_charges',
  bilans: 'mind_bilans',
  pauses: 'mind_pauses',
  reglages: 'mind_reglages',
  sauvegardePrecedente: 'mind_sauvegarde_precedente',
})

// Clés incluses dans l'export : toutes, sauf la copie de sécurité (décision de Max).
export const CLES_EXPORT = Object.freeze(
  Object.values(CLES).filter((cle) => cle !== CLES.sauvegardePrecedente),
)

export const JOURS = Object.freeze(['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'])

export const STATUTS_GROUPE = Object.freeze(['prioritaire', 'secondaire', 'exclu'])

// Un groupe musculaire absent de `groupes_statut` vaut « secondaire » (décision de Max).
export const STATUT_GROUPE_DEFAUT = 'secondaire'
