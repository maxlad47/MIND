// Export et import de la sauvegarde (V1-M4, MODELE_DONNEES.md §3). Sans affichage ni accès au navigateur.
//
// Fichier : { application: 'MIND', date_export, donnees: { mind_version, mind_profil, ... } }
// Toutes les clés `mind_*` présentes sont exportées, sauf `mind_sauvegarde_precedente`.

import { CLES, CLES_EXPORT, VERSION_SCHEMA } from './constantes.js'
import { dateDuJour, estDateValide, joursEntre } from './dates.js'
import { ErreurImport, ErreurValidation, ErreurVersion } from './erreurs.js'
import { creerCopieSecurite, ecrireCollection, lireCollection, lireEtat } from './index.js'
import { MIGRATIONS, migrer } from './migrations/index.js'
import { valider } from './schema.js'

export const DELAI_RAPPEL_JOURS = 30

const estObjet = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)

// ---------- Export ----------

// Enregistre la date d'export dans les réglages (avant de lire l'état, pour qu'elle figure dans le fichier,
// afin qu'une restauration ne déclenche pas de rappel superflu), puis renvoie le contenu du fichier.
export function exporterDonnees(depot, aujourdhui = dateDuJour()) {
  const reglages = lireCollection(depot, CLES.reglages)
  ecrireCollection(depot, CLES.reglages, { ...reglages, derniere_export: aujourdhui })
  const donnees = lireEtat(depot)
  if (!donnees[CLES.version]) donnees[CLES.version] = { schema_version: VERSION_SCHEMA }
  const contenu = JSON.stringify({ application: 'MIND', date_export: aujourdhui, donnees }, null, 2)
  return { contenu, nomFichier: `mind-sauvegarde-${aujourdhui}.json` }
}

// ---------- Import ----------

function lireFichier(texte) {
  let fichier
  try {
    fichier = JSON.parse(texte)
  } catch {
    throw new ErreurImport("Ce fichier n'est pas une sauvegarde MIND lisible.")
  }
  if (!estObjet(fichier) || fichier.application !== 'MIND' || !estObjet(fichier.donnees)) {
    throw new ErreurImport("Ce fichier n'est pas une sauvegarde MIND.")
  }
  if (!estDateValide(fichier.date_export)) {
    throw new ErreurImport("La date d'export du fichier est absente ou invalide.")
  }
  const inconnues = Object.keys(fichier.donnees).filter((cle) => !CLES_EXPORT.includes(cle))
  if (inconnues.length > 0) {
    throw new ErreurImport(`Le fichier contient des données inconnues : ${inconnues.join(', ')}.`)
  }
  const erreursVersion = valider(CLES.version, fichier.donnees[CLES.version])
  if (!(CLES.version in fichier.donnees) || erreursVersion.length > 0) {
    throw new ErreurImport('Le numéro de version des données est absent ou invalide dans le fichier.')
  }
  return fichier
}

// Remplace toutes les données par celles du fichier.
// Ordre : lecture, refus si le fichier est plus récent que l'appli, migration en mémoire, validation de chaque
// collection (rien n'est écrit tant que tout n'est pas valide), copie de sécurité, puis remplacement.
// Si l'écriture échoue en cours de route, l'état d'avant est rétabli.
export function importerDonnees(
  depot,
  texte,
  { migrations = MIGRATIONS, versionCible = VERSION_SCHEMA, aujourdhui = dateDuJour() } = {},
) {
  const fichier = lireFichier(texte)
  const depuis = fichier.donnees[CLES.version].schema_version
  if (depuis > versionCible) throw new ErreurVersion(depuis, versionCible)

  let etat
  try {
    etat = depuis < versionCible ? migrer(fichier.donnees, depuis, versionCible, migrations) : fichier.donnees
  } catch (erreur) {
    throw new ErreurImport(`Migration du fichier impossible : ${erreur.message}`)
  }
  etat = { ...etat, [CLES.version]: { schema_version: versionCible } }

  for (const [cle, valeur] of Object.entries(etat)) {
    const erreurs = valider(cle, valeur)
    if (erreurs.length > 0) throw new ErreurValidation(cle, erreurs)
  }

  const avant = lireEtat(depot)
  creerCopieSecurite(depot, 'import', aujourdhui)
  try {
    for (const cle of CLES_EXPORT) {
      if (cle in etat) depot.ecrire(cle, etat[cle])
      else depot.supprimer(cle)
    }
  } catch {
    try {
      for (const cle of CLES_EXPORT) {
        if (cle in avant) depot.ecrire(cle, avant[cle])
        else depot.supprimer(cle)
      }
    } catch {
      throw new ErreurImport("L'écriture a échoué et les données précédentes n'ont pas pu être rétablies. Une copie de sécurité existe.")
    }
    throw new ErreurImport("L'écriture a échoué (stockage plein ?). Tes données précédentes ont été rétablies.")
  }
  return { date_export: fichier.date_export, migre: depuis < versionCible }
}

// ---------- Rappel ----------

// Vrai s'il faut rappeler d'exporter : un profil existe et aucun export depuis DELAI_RAPPEL_JOURS jours (ou jamais).
export function rappelExportNecessaire(depot, aujourdhui = dateDuJour()) {
  if (depot.lire(CLES.profil) === undefined) return false
  const { derniere_export: derniere } = lireCollection(depot, CLES.reglages)
  if (!derniere) return true
  return joursEntre(derniere, aujourdhui) >= DELAI_RAPPEL_JOURS
}
