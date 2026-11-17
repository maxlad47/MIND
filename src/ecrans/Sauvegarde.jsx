import { useRef, useState } from 'react'
import { ErreurValidation, ErreurVersion } from '../donnees/index.js'
import { exporterDonnees, importerDonnees } from '../donnees/sauvegarde.js'

// Télécharge un fichier texte (Blob + lien temporaire).
function telecharger(nomFichier, contenu) {
  const url = URL.createObjectURL(new Blob([contenu], { type: 'application/json' }))
  const lien = document.createElement('a')
  lien.href = url
  lien.download = nomFichier
  document.body.append(lien)
  lien.click()
  lien.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function messageErreur(erreur) {
  if (erreur instanceof ErreurVersion) {
    return "Cette sauvegarde vient d'une version plus récente de MIND. Mets l'appli à jour, puis réessaie. Tes données n'ont pas été modifiées."
  }
  if (erreur instanceof ErreurValidation) {
    return `Cette sauvegarde contient des données invalides (${erreur.details.slice(0, 3).join(' ; ')}). Tes données n'ont pas été modifiées.`
  }
  return `${erreur.message} Tes données actuelles sont conservées.`
}

export default function Sauvegarde({ depot, onExporte, onImporte }) {
  const champFichier = useRef(null)
  const [retour, setRetour] = useState(null) // { type: 'ok' | 'erreur', texte }

  const exporter = () => {
    try {
      const { contenu, nomFichier } = exporterDonnees(depot)
      telecharger(nomFichier, contenu)
      setRetour({ type: 'ok', texte: `Sauvegarde exportée : ${nomFichier}` })
      onExporte()
    } catch {
      setRetour({ type: 'erreur', texte: 'Export impossible : le stockage de l’appareil a refusé l’écriture.' })
    }
  }

  const importer = async (e) => {
    const fichier = e.target.files?.[0]
    e.target.value = '' // permet de choisir deux fois le même fichier
    if (!fichier) return
    try {
      const texte = await fichier.text()
      const confirme = window.confirm(
        'Remplacer toutes les données actuelles par cette sauvegarde ?\n\nUne copie de sécurité de tes données actuelles est faite automatiquement.',
      )
      if (!confirme) return
      const resultat = importerDonnees(depot, texte)
      setRetour({ type: 'ok', texte: `Sauvegarde du ${resultat.date_export} restaurée. Une copie de sécurité de tes données précédentes a été conservée.` })
      onImporte()
    } catch (erreur) {
      setRetour({ type: 'erreur', texte: messageErreur(erreur) })
    }
  }

  return (
    <section className="sauvegarde">
      <h2>Sauvegarde</h2>
      <p className="aide">
        Tes données restent sur ce téléphone. Exporte un fichier pour les garder ou les restaurer sur un autre appareil.
        Importer remplace toutes les données actuelles.
      </p>
      <div className="boutons">
        <button type="button" onClick={exporter}>
          Exporter ma sauvegarde
        </button>
        <button type="button" className="secondaire" onClick={() => champFichier.current?.click()}>
          Importer une sauvegarde
        </button>
        <input ref={champFichier} type="file" accept=".json,application/json" hidden onChange={importer} />
      </div>
      {retour && (
        <p className={retour.type === 'ok' ? 'confirmation' : 'erreur'} role={retour.type === 'ok' ? 'status' : 'alert'}>
          {retour.texte}
        </p>
      )}
    </section>
  )
}
