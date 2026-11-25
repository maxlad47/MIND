// Bandeau du minuteur de repos : compact, en verre dépoli, au-dessus de la barre d'onglets. La séance reste accessible en dessous.
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { adjustRest, clearChain, markRestFired, playRestEnd, remainingSec, skipRest, useNow, useRest } from '@/lib/rest'
import { fmtTime } from '@/engine/utils'
import { Icon, spring } from './kit'

/** Hauteur réservée en bas de page pendant qu'un repos est affiché (les écrans s'en servent pour ne pas être masqués). */
const BANNER_H = 62

export function RestBanner() {
  const { timer, chain } = useRest()
  const { pathname } = useLocation()
  // le minuteur accompagne la séance et les onglets ; il ne masque jamais le formulaire d'inscription
  const active = (!!timer || !!chain) && !pathname.startsWith('/onboarding')
  const now = useNow(active)
  const [bottom, setBottom] = useState(0)

  const left = timer ? remainingSec(timer, now) : 0
  const finished = !!timer && left === 0

  // fin du repos : son court (si autorisé et l'app au premier plan) + animation ; un repos terminé bien avant le retour dans l'app reste silencieux
  useEffect(() => {
    if (!timer || left > 0) return
    if (markRestFired() && now - timer.endAt < 3000) playRestEnd()
    const id = setTimeout(skipRest, 5000)
    return () => clearTimeout(id)
  }, [timer?.endAt, left === 0])
  useEffect(() => {
    if (!chain) return
    const id = setTimeout(clearChain, 3200)
    return () => clearTimeout(id)
  }, [chain?.at])

  // position : juste au-dessus de la barre d'onglets quand il y en a une
  useEffect(() => {
    const nav = document.querySelector('nav[aria-label="Navigation principale"]') as HTMLElement | null
    setBottom(nav ? nav.getBoundingClientRect().height : 0)
  })
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--rest-h', active ? `${BANNER_H + 8}px` : '0px')
    return () => { root.style.setProperty('--rest-h', '0px') }
  }, [active])

  const pct = timer && timer.totalSec > 0 ? Math.min(1, Math.max(0, 1 - left / timer.totalSec)) : 0
  return (
    <AnimatePresence>
      {active && (
        <motion.div key="rest" className="fixed inset-x-0 z-40 px-3 pointer-events-none" style={{ bottom: bottom ? bottom + 8 : 'calc(8px + env(safe-area-inset-bottom))' }}
          initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={spring}>
          <div className="max-w-xl mx-auto">
            {timer ? (
              <motion.div role="timer" aria-label="Minuteur de repos" className="glass-strong rounded-[22px] pointer-events-auto relative overflow-hidden border border-sep flex items-center gap-1 pl-4 pr-1.5"
                style={{ height: BANNER_H, boxShadow: 'var(--shadow-float)' }}
                animate={finished ? { scale: [1, 1.03, 1, 1.03, 1], boxShadow: ['var(--shadow-float)', '0 0 0 3px #30D158', 'var(--shadow-float)', '0 0 0 3px #30D158', 'var(--shadow-float)'] } : { scale: 1 }}
                transition={finished ? { duration: 1.2 } : spring}>
                <div className="absolute left-0 bottom-0 h-[3px]" style={{ width: `${pct * 100}%`, background: finished ? '#30D158' : 'var(--accent)', transition: 'width .25s linear' }} />
                <div className="min-w-0 flex-1">
                  <div className="text-[11.5px] font-semibold uppercase tracking-wide text-muted truncate">{finished ? 'Repos terminé' : timer.label}</div>
                  <div className="num text-[26px] leading-none font-extrabold tracking-tight" style={{ color: finished ? '#30D158' : undefined }}>{finished ? 'Go !' : fmtTime(left)}</div>
                </div>
                <button className="tap hit w-11 h-11 rounded-full bg-surface2 text-[14px] font-bold num" aria-label="Retirer 15 secondes" onClick={() => adjustRest(-15)}>−15</button>
                <button className="tap hit w-11 h-11 rounded-full bg-surface2 text-[14px] font-bold num" aria-label="Ajouter 15 secondes" onClick={() => adjustRest(15)}>+15</button>
                <button className="tap hit h-11 px-3.5 rounded-full text-[14px] font-bold" style={{ background: 'var(--accent)', color: '#fff' }} onClick={skipRest}>{finished ? 'OK' : 'Passer'}</button>
              </motion.div>
            ) : chain ? (
              <div role="status" className="glass-strong rounded-[22px] pointer-events-auto border border-sep flex items-center gap-2.5 px-4" style={{ height: 52, boxShadow: 'var(--shadow-float)' }}>
                <span style={{ color: 'var(--accent)' }}><Icon name="bolt" size={20} /></span>
                <span className="text-[16px] font-bold">{chain.label}</span>
                <span className="text-[13px] text-muted">sans repos</span>
              </div>
            ) : null}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
