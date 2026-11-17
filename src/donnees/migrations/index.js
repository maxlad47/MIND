// Migrations du schéma (décision de Max : dossier src/donnees/, un numéro de version par migration).
//
// Une migration est { vers: <numéro de version atteinte>, appliquer(etat) -> nouvel état }.
// `etat` est un objet { 'mind_profil': ..., 'mind_reglages': ..., ... } (clés présentes seulement).
// Une migration ne modifie pas son argument : elle renvoie un nouvel état.
//
// Le schéma initial est la version 1 : aucune migration pour l'instant.
// Chaque migration future est un fichier de ce dossier, nommé par son numéro de version.

export const MIGRATIONS = []

// Applique, dans l'ordre, les migrations de `depuis` (exclue) à `vers` (incluse).
// Lève une erreur si une étape manque. Ne touche pas au stockage.
export function migrer(etat, depuis, vers, migrations = MIGRATIONS) {
  let courant = etat
  for (let version = depuis + 1; version <= vers; version += 1) {
    const migration = migrations.find((m) => m.vers === version)
    if (!migration) throw new Error(`Migration vers la version ${version} introuvable`)
    courant = migration.appliquer(courant)
  }
  return courant
}
