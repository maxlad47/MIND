import { useEffect, useState } from 'react'
import { creerDepot, ErreurVersion, initialiserDonnees, stockageNavigateur } from './donnees/index.js'
import { rappelExportNecessaire } from './donnees/sauvegarde.js'
import { enregistrer } from './pwa.js'
import BandeauMiseAJour from './ecrans/BandeauMiseAJour.jsx'
import Profil from './ecrans/Profil.jsx'
import Sauvegarde from './ecrans/Sauvegarde.jsx'

// Ouvre le stockage et prépare les données. Renvoie { depot } ou { probleme } (texte à afficher).
function ouvrirDonnees() {
  const stockage = stockageNavigateur()
  if (!stockage) {
    return { probleme: "Le stockage de l'appareil est indisponible (navigation privée ou données bloquées). MIND ne peut pas enregistrer ton profil." }
  }
  const depot = creerDepot(stockage)
  try {
    initialiserDonnees(depot)
  } catch (erreur) {
    if (erreur instanceof ErreurVersion) {
      return { probleme: "Ces données viennent d'une version plus récente de MIND. Mets l'appli à jour avant de continuer ; rien n'a été modifié." }
    }
    return { probleme: `Les données enregistrées sont illisibles ou invalides (${erreur.message}). Rien n'a été modifié.` }
  }
  return { depot }
}

export default function App() {
  const [donnees] = useState(ouvrirDonnees)
  // Un changement d'état relance le rendu, donc le calcul du rappel ; `profilRev` recharge le formulaire après un import.
  const [, setRappelRev] = useState(0)
  // Fonction qui applique la mise à jour, quand une nouvelle version est prête (production seulement).
  const [miseAJour, setMiseAJour] = useState(null)
  useEffect(() => {
    if (import.meta.env.PROD) enregistrer((appliquer) => setMiseAJour(() => appliquer))
  }, [])
  const [profilRev, setProfilRev] = useState(0)
  const actualiserRappel = () => setRappelRev((r) => r + 1)
  if (donnees.probleme) {
    return (
      <main className="page">
        <h1>MIND</h1>
        <p className="erreur" role="alert">
          {donnees.probleme}
        </p>
      </main>
    )
  }
  const rappel = rappelExportNecessaire(donnees.depot)
  return (
    <main className="page">
      {miseAJour && <BandeauMiseAJour onAppliquer={miseAJour} />}
      {rappel && (
        <p className="rappel" role="status">
          Pense à exporter ta sauvegarde : aucun export depuis plus de 30 jours.
        </p>
      )}
      <Profil key={profilRev} depot={donnees.depot} onEnregistre={actualiserRappel} />
      <Sauvegarde
        depot={donnees.depot}
        onExporte={actualiserRappel}
        onImporte={() => {
          setProfilRev((r) => r + 1)
          actualiserRappel()
        }}
      />
    </main>
  )
}
