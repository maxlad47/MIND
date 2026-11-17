export class ErreurDonnees extends Error {
  constructor(message, details = []) {
    super(message)
    this.name = 'ErreurDonnees'
    this.details = details
  }
}

// Une donnée ne respecte pas le schéma. Rien n'est écrit.
export class ErreurValidation extends ErreurDonnees {
  constructor(cle, details) {
    super(`Données invalides pour ${cle}`, details)
    this.name = 'ErreurValidation'
    this.cle = cle
  }
}

// Les données viennent d'une version de l'appli plus récente que celle-ci.
export class ErreurVersion extends ErreurDonnees {
  constructor(versionDonnees, versionAppli) {
    super(`Données en version ${versionDonnees}, plus récente que l'appli (version ${versionAppli})`)
    this.name = 'ErreurVersion'
    this.versionDonnees = versionDonnees
    this.versionAppli = versionAppli
  }
}

// Le fichier de sauvegarde ne peut pas être importé. Les données actuelles sont intactes.
export class ErreurImport extends ErreurDonnees {
  constructor(message, details = []) {
    super(message, details)
    this.name = 'ErreurImport'
  }
}
