// Retour haptique léger (« clic » sous le doigt).
// Android : navigator.vibrate. iPhone : Safari n'a pas navigator.vibrate, mais depuis iOS 18 le fait d'actionner un
// interrupteur natif (<input type="checkbox" switch>) déclenche un petit clic du moteur haptique. On en crée un invisible,
// on l'actionne, on le retire. Ailleurs (ordinateur, ancien iOS), rien ne se passe.

/** Petit clic : une touche enfoncée, un cran franchi. */
export function tick(): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') { navigator.vibrate(8); return }
    if (typeof document === 'undefined') return
    const label = document.createElement('label')
    label.ariaHidden = 'true'
    label.style.display = 'none'
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.setAttribute('switch', '')
    label.appendChild(input)
    document.head.appendChild(label)
    label.click()
    document.head.removeChild(label)
  } catch { /* pas d'haptique */ }
}

/** Deux clics rapprochés : une validation, la fin d'un repos. */
export function doubleTick(): void {
  tick()
  setTimeout(tick, 110)
}
