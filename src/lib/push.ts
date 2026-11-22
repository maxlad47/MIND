// Notifications. En local : rappels via l'API Notification quand l'app est ouverte.
// En ligne : Web Push (VAPID) envoyé par l'Edge Function `daily-cron` (voir supabase/functions).

import { getDB, programOf } from './store'
import { todayISO } from '@/engine/utils'

export type PushState = 'unsupported' | 'default' | 'granted' | 'denied'

export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
}
export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}
export function pushState(): PushState {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission as PushState
}

export async function requestPush(): Promise<PushState> {
  if (!('Notification' in window)) return 'unsupported'
  const res = await Notification.requestPermission()
  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
  if (res === 'granted' && key && 'serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready
      await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(key) })
    } catch { /* l'abonnement serveur n'est pas disponible en local */ }
  }
  return res as PushState
}

function urlB64(b64: string): ArrayBuffer {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out.buffer
}

let timer: number | undefined
export function scheduleLocalReminder(userId: string, time: string): void {
  if (timer) window.clearTimeout(timer)
  if (pushState() !== 'granted') return
  const p = programOf(getDB(), userId)
  const today = todayISO()
  const has = p?.weeks.some((w) => w.sessions.some((s) => s.date === today && s.status === 'prevue'))
  if (!has) return
  const [h, m] = time.split(':').map(Number)
  const at = new Date()
  at.setHours(h, m, 0, 0)
  const ms = at.getTime() - Date.now()
  if (ms <= 0 || ms > 86400000) return
  timer = window.setTimeout(async () => {
    const reg = await navigator.serviceWorker?.getRegistration()
    const opts = { body: 'Ta séance du jour t\'attend dans MIND.', icon: '/icon-192.png' }
    if (reg) reg.showNotification('C\'est l\'heure de ta séance', opts)
    else new Notification('C\'est l\'heure de ta séance', opts)
  }, ms)
}

export async function testNotification(): Promise<boolean> {
  if (pushState() !== 'granted') return false
  const reg = await navigator.serviceWorker?.getRegistration()
  const opts = { body: 'Les notifications MIND fonctionnent.', icon: '/icon-192.png' }
  if (reg) await reg.showNotification('MIND', opts)
  else new Notification('MIND', opts)
  return true
}
