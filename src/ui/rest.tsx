// Bandeau du minuteur de repos : compact, en verre dépoli, au-dessus de la barre d'onglets. La séance reste accessible en dessous.
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useLocation } from 'react-router-dom'
import { adjustRest, clearChain, markRestFired, playRestEnd, remainingSec, skipRest, useNow, useRest } from '@/lib/rest'
import { fmtTime } from '@/engine/utils'
import { Icon, RollingNumber, spring } from './kit'
import { doubleTick, tick } from '@/lib/haptics'

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
    if (markRestFired() && now - timer.endAt < 3000) { playRestEnd(); doubleTick() }
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

  // sens du défilement des chiffres : vers le bas pendant le décompte, vers le haut après un +15
  const prevLeft = useRef(left)
  const down = left <= prevLeft.current
  useEffect(() => { prevLeft.current = left }, [left])
  const pct = timer && timer.totalSec > 0 ? Math.min(1, Math.max(0, 1 - left / timer.totalSec)) : 0
  return (
    <AnimatePresence>
      {active && (
        <motion.div key="rest" className="fixed inset-x-0 z-40 px-3 pointer-events-none" style={{ bottom: bottom ? bottom + 8 : 'calc(8px + env(safe-area-inset-bottom))' }}
          initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={spring}>
          <div className="max-w-xl mx-auto">
            {timer ? (
              <motion.div role="timer" aria-label="Minuteur de repos" className="glass-strong rounded-[22px] pointer-events-auto relative overflow-hidden border border-sep flex items-center gap-1.5 pl-[7px] pr-[7px]"
                style={{ height: BANNER_H, boxShadow: 'var(--shadow-float)' }}
                animate={finished ? { scale: [1, 1.03, 1, 1.03, 1], boxShadow: ['var(--shadow-float)', '0 0 0 3px #30D158', 'var(--shadow-float)', '0 0 0 3px #30D158', 'var(--shadow-float)'] } : { scale: 1 }}
                transition={finished ? { duration: 1.2 } : spring}>
                <div className="well flex-1 min-w-0 h-[50px] rounded-[14px] pl-3 pr-2.5 flex flex-col justify-center">
                  <div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted truncate leading-none mb-[3px]">{finished ? 'Repos terminé' : timer.label}</div>
                  {finished
                    ? <div className="text-[22px] leading-[1.08] font-extrabold tracking-tight" style={{ color: '#30D158' }}>Go !</div>
                    : <RollingNumber text={fmtTime(left)} down={down} className="text-[22px] leading-none font-extrabold tracking-tight" />}
                  {/* réglette graduée : la part écoulée s'allume */}
                  <div className="relative h-[3px] mt-[4px]">
                    <div className="absolute inset-0 ruler" style={{ color: 'var(--faint)', opacity: 0.45 }} />
                    <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${pct * 100}%`, transition: 'width .25s linear' }}>
                      <div className="h-full ruler" style={{ width: 400, color: finished ? '#30D158' : 'var(--accent)' }} />
                    </div>
                  </div>
                </div>
                <button className="key hit w-11 h-11 rounded-[13px] text-[14px] font-bold num" aria-label="Retirer 15 secondes" onClick={() => { tick(); adjustRest(-15) }}>−15</button>
                <button className="key hit w-11 h-11 rounded-[13px] text-[14px] font-bold num" aria-label="Ajouter 15 secondes" onClick={() => { tick(); adjustRest(15) }}>+15</button>
                <button className="key key-tint hit h-11 px-3.5 rounded-[13px] text-[14px] font-bold" style={{ '--key-color': finished ? '#30D158' : 'var(--accent)' } as CSSProperties} onClick={() => { tick(); skipRest() }}>{finished ? 'OK' : 'Passer'}</button>
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
