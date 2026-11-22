import { useSyncExternalStore } from 'react'

/**
 * « Style » de l'interface : féminin (rose, formes très rondes, pochettes lumineuses) ou
 * masculin (bleu électrique, angles plus francs, titres en capitales, pochettes plus sombres et plus nettes).
 * Masculin par défaut à l'ouverture ; choix manuel dans Profil, propre à l'appareil (localStorage). Il ne dépend jamais des réponses du formulaire :
 * l'interface ne change pas quand on choisit « Homme » ou « Femme ».
 */
export type Look = 'feminin' | 'masculin'

const KEY = 'mind.look'
let current: Look = (() => { try { return localStorage.getItem(KEY) === 'feminin' ? 'feminin' : 'masculin' } catch { return 'masculin' } })()
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
