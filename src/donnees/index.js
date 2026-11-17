// Accès aux données de l'appli (MODELE_DONNEES.md, V1-M0).
// Aucune dépendance à React ni à l'interface : le stockage est passé en paramètre.

import { CLES, CLES_EXPORT, VERSION_SCHEMA } from './constantes.js'
import { ErreurValidation, ErreurVersion } from './erreurs.js'
import { MIGRATIONS, migrer } from './migrations/index.js'
import { dateDuJour } from './dates.js'
import { valeurParDefaut, valider } from './schema.js'

export * from './constantes.js'
export * from './erreurs.js'
export { dateDuJour, estDateValide } from './dates.js'
export { creerDepot, creerStockageMemoire, stockageNavigateur } from './stockage.js'
export { profilVide, reglagesParDefaut, statutGroupe, valeurParDefaut, valider } from './schema.js'

// Lit une collection ; renvoie sa valeur par défaut si elle n'a jamais été écrite.
export function lireCollection(depot, cle) {
  const valeur = depot.lire(cle)
  return valeur === undefined ? valeurParDefaut(cle) : valeur
}

// Valide puis écrit une collection. Si la valeur est invalide, rien n'est écrit.
export function ecrireCollection(depot, cle, valeur) {
  const erreurs = valider(cle, valeur)
  if (erreurs.length > 0) throw new ErreurValidation(cle, erreurs)
  depot.ecrire(cle, valeur)
}

// État complet : toutes les clés exportables présentes dans le dépôt.
export function lireEtat(depot) {
  const etat = {}
  for (const cle of CLES_EXPORT) {
    const valeur = depot.lire(cle)
    if (valeur !== undefined) etat[cle] = valeur
  }
  return etat
}

// Copie de sécurité (décision de Max) : une seule, remplacée à chaque fois, exclue de l'export.
// Créée avant toute migration et avant tout import (`cause` : 'migration' ou 'import').
export function creerCopieSecurite(depot, cause, aujourdhui = dateDuJour()) {
  const version = depot.lire(CLES.version)
  const copie = {
    date: aujourdhui,
    cause,
    schema_version: version?.schema_version ?? null,
    donnees: lireEtat(depot),
  }
  ecrireCollection(depot, CLES.sauvegardePrecedente, copie)
  return copie
}

// À appeler au démarrage de l'appli.
// - Première ouverture : écrit `mind_version`.
// - Données plus récentes que l'appli : lève ErreurVersion, rien n'est écrit.
// - Données plus anciennes : migre en mémoire, valide le résultat, crée la copie de sécurité, puis écrit.
//   Si une migration ou une validation échoue, les données actuelles restent intactes (pas de copie).
export function initialiserDonnees(
  depot,
  { migrations = MIGRATIONS, versionCible = VERSION_SCHEMA, aujourdhui } = {},
) {
  const version = depot.lire(CLES.version)
  if (version === undefined) {
    depot.ecrire(CLES.version, { schema_version: versionCible })
    return { version: versionCible, cree: true, migre: false }
  }

  const erreursVersion = valider(CLES.version, version)
  if (erreursVersion.length > 0) throw new ErreurValidation(CLES.version, erreursVersion)

  const depuis = version.schema_version
  if (depuis > versionCible) throw new ErreurVersion(depuis, versionCible)
  if (depuis === versionCible) return { version: depuis, cree: false, migre: false }

  const etat = migrer(lireEtat(depot), depuis, versionCible, migrations)
  for (const [cle, valeur] of Object.entries(etat)) {
    const erreurs = valider(cle, valeur)
    if (erreurs.length > 0) throw new ErreurValidation(cle, erreurs)
  }
  creerCopieSecurite(depot, 'migration', aujourdhui)
  for (const [cle, valeur] of Object.entries(etat)) depot.ecrire(cle, valeur)
  depot.ecrire(CLES.version, { schema_version: versionCible })
  return { version: versionCible, cree: false, migre: true }
}
