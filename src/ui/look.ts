import { useSyncExternalStore } from 'react'

/**
 * Thème de l'interface (choix manuel dans Profil, propre à l'appareil, localStorage) :
 *  - Thème 1 « Paceform » : bleu Ocean #01598C, bleu Mist #A9CEE7, orange Vivid #F76926 — capitales grasses en italique, photos filées, satin.
 *  - Thème 2 « Kinetic bleu » : bleu Sky #0593C6, blanc #FCFFFF, rose Hot Pink #D83995 — titres très gras serrés, traînées roses.
 * Thème 1 par défaut. Il ne dépend jamais des réponses du formulaire.
 * Anciennes valeurs enregistrées : « masculin » → Thème 1, « feminin » → Thème 2.
 */
export type Look = 't1' | 't2'

const KEY = 'mind.look'
let current: Look = (() => {
  try { const v = localStorage.getItem(KEY); return v === 't2' || v === 'feminin' ? 't2' : 't1' } catch { return 't1' }
})()
const listeners = new Set<() => void>()

function apply() { document.documentElement.dataset.look = current }

export function getLook(): Look { return current }
export function setLook(l: Look) {
  current = l
  try { localStorage.setItem(KEY, l) } catch { /* ok */ }
  apply(); listeners.forEach((fn) => fn())
}
export function useLook(): Look {
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l) } }, getLook)
}
apply()
