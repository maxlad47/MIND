import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import { Cover } from './kit'

/** Fondu entre onglets (la barre d'onglets, hors de ce conteneur, ne bouge pas). */
export function PageFade({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return (
    <motion.div key={pathname} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
      {children}
    </motion.div>
  )
}

/**
 * Pousser un écran de détail : il glisse depuis la droite avec un ressort, comme une navigation iOS.
 * En retour (bouton Retour), simple fondu. La barre de navigation fixe suit l'écran pendant le glissement.
 */
export function PagePush({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const type = useNavigationType()
  const push = type === 'PUSH'
  return (
    <motion.div key={pathname} className="min-h-full bg-bg"
      initial={push ? { x: '32%', opacity: 0.4 } : { opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={push ? { type: 'spring', stiffness: 360, damping: 38, mass: 0.9 } : { duration: 0.2 }}
      style={push ? { boxShadow: '-24px 0 40px -20px rgba(0,0,0,.45)' } : undefined}>
      {children}
    </motion.div>
  )
}

/** Logo MIND : pochette violet → orange avec la marque. */
export function Logo({ size = 96, radius }: { size?: number; radius?: number }) {
  return (
    <div className="relative shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
      <Cover seed="mind-logo" sports={['muscu', 'course']} scrim={false} className="absolute inset-0" style={{ borderRadius: radius ?? size * 0.235, boxShadow: '0 14px 34px -10px color-mix(in srgb, var(--muscu) 55%, transparent)' }} />
      <span className="relative font-extrabold text-white tracking-[-0.06em] leading-none" style={{ fontSize: size * 0.255, textShadow: '0 2px 12px rgba(0,0,0,.25)' }}>MIND</span>
    </div>
  )
}

/** Écran de démarrage : logo qui apparaît en ressort sur fond noir, puis fondu. Une seule fois par session. */
export function Splash() {
  const [show, setShow] = useState(() => {
    try { return !sessionStorage.getItem('mind.splash') } catch { return true }
  })
  useEffect(() => {
    if (!show) return
    try { sessionStorage.setItem('mind.splash', '1') } catch { /* ok */ }
    const t = setTimeout(() => setShow(false), 1250)
    return () => clearTimeout(t)
  }, [show])
  return (
    <AnimatePresence>
      {show && (
        <motion.div key="splash" className="fixed inset-0 z-[100] flex flex-col items-center justify-center pointer-events-none" style={{ background: '#000' }}
          initial={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.04 }} transition={{ duration: 0.45, ease: 'easeOut' }}>
          <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}
            style={{ background: 'radial-gradient(60% 40% at 25% 30%, color-mix(in srgb, var(--muscu) 55%, transparent), transparent 70%), radial-gradient(60% 40% at 80% 75%, rgba(255,159,10,.5), transparent 70%)' }} />
          <motion.div initial={{ scale: 0.6, opacity: 0, rotate: -6 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 16, delay: 0.05 }} className="relative">
            <Logo size={118} />
          </motion.div>
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.5 }} className="relative mt-6 text-white/70 text-[15px] font-medium tracking-wide">
            Muscu · Course · Toi
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
