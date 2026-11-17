// « Nouvelle version disponible » : s'affiche quand une nouvelle version de l'appli est prête.
export default function BandeauMiseAJour({ onAppliquer }) {
  return (
    <div className="mise-a-jour" role="status">
      <span>Nouvelle version disponible.</span>
      <button type="button" onClick={onAppliquer}>
        Mettre à jour
      </button>
    </div>
  )
}
