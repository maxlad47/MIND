// Enregistrement du service worker et détection d'une nouvelle version (V1-M2).
// Séparé de l'affichage pour être testable sans navigateur.

// Appelle `onMiseAJour(appliquer)` quand une nouvelle version est installée et en attente.
// `appliquer()` demande au nouveau service worker de prendre la main ; la page se recharge alors (voir enregistrer).
// Une première installation (aucun service worker actif avant) n'est pas une mise à jour.
export function surveillerMiseAJour(registration, aUnControleur, onMiseAJour) {
  const signaler = (worker) => onMiseAJour(() => worker.postMessage('SKIP_WAITING'))

  if (registration.waiting && aUnControleur()) signaler(registration.waiting)

  registration.addEventListener('updatefound', () => {
    const installation = registration.installing
    if (!installation) return
    installation.addEventListener('statechange', () => {
      if (installation.state === 'installed' && aUnControleur()) signaler(installation)
    })
  })
}

// À appeler une fois au démarrage, en production seulement. Ne fait rien si le navigateur ne gère pas
// les service workers (ou en navigation privée où l'enregistrement est refusé).
export async function enregistrer(onMiseAJour) {
  if (!('serviceWorker' in navigator)) return
  const conteneur = navigator.serviceWorker
  try {
    const registration = await conteneur.register(`${import.meta.env.BASE_URL}sw.js`)
    surveillerMiseAJour(registration, () => Boolean(conteneur.controller), onMiseAJour)

    // Recharge la page une fois la nouvelle version active (uniquement si l'utilisateur l'a demandé).
    let rechargement = false
    conteneur.addEventListener('controllerchange', () => {
      if (rechargement) return
      rechargement = true
      window.location.reload()
    })

    // Vérifie s'il existe une version plus récente quand l'appli revient au premier plan.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update().catch(() => {})
    })
  } catch {
    // Enregistrement impossible : l'appli fonctionne normalement, sans mode hors ligne.
  }
}
