import { AnimatePresence, motion, useDragControls, useMotionValue } from 'framer-motion'
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { coverSpec, SPORT_COLOR, type Sport } from './cover'

export const ACCENT = 'var(--accent)'
export const spring = { type: 'spring', stiffness: 380, damping: 34 } as const
export const springSoft = { type: 'spring', stiffness: 260, damping: 30 } as const
export const springT = spring

// ------------------------------------------------------------------ icônes
const PATHS: Record<string, string> = {
  today: 'M7 2v3M17 2v3M3.5 8.5h17M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 19 20.5H5A1.5 1.5 0 0 1 3.5 19V6A1.5 1.5 0 0 1 5 4.5ZM8 14l3 3 5-6',
  program: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  progress: 'M5 20v-7M12 20V5M19 20v-10',
  profile: 'M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM4 21a8 8 0 0 1 16 0',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18.5 14.2A6.5 6.5 0 0 1 21.5 20',
  alert: 'M12 3.5 2.8 19.5h18.4L12 3.5ZM12 10v4.2M12 17h.01',
  back: 'M15 5l-7 7 7 7',
  chevron: 'M9 5l7 7-7 7',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6 6 18',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16ZM10 21h4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  swap: 'M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7',
  grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  chat: 'M4 5h16v11H9l-5 4V5Z',
  flame: 'M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9Z',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0V4ZM8 6H4v1.5A3.5 3.5 0 0 0 7.5 11M16 6h4v1.5A3.5 3.5 0 0 1 16.5 11M12 13v4M8 20h8M10 17h4',
  edit: 'M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3ZM19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z',
  undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  share: 'M12 15V4M8 8l4-4 4 4M5 12v7h14v-7',
  home: 'M4 11l8-7 8 7v9h-5v-6H9v6H4v-9Z',
  play: 'M8 5.5v13l11-6.5-11-6.5Z',
  contrast: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 3v18',
  logout: 'M10 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H10M15 8l4 4-4 4M19 12H9',
  refresh: 'M20 12a8 8 0 1 1-2.5-5.8M20 4v4.5h-4.5',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5.5M12 7.8h.01',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM12 12h.01',
  bolt: 'M13 3 5 13.5h6L10 21l9-11h-6.5L13 3Z',
  calendar: 'M7 2v3M17 2v3M3.5 8.5h17M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 19 20.5H5A1.5 1.5 0 0 1 3.5 19V6A1.5 1.5 0 0 1 5 4.5Z',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z',
  heart: 'M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20Z',
}
const FILLED = new Set(['play'])

export function Icon({ name, size = 22, color, strokeWidth = 1.9 }: { name: keyof typeof PATHS | string; size?: number; color?: string; strokeWidth?: number }) {
  const filled = FILLED.has(name)
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? (color ?? 'currentColor') : 'none'} stroke={color ?? 'currentColor'} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name] ?? ''} />
    </svg>
  )
}

/** Icônes de la barre d'onglets : contour au repos, plein quand l'onglet est actif (comme SF Symbols). */
export function TabIcon({ name, active, size = 26 }: { name: string; active: boolean; size?: number }) {
  const id = useId().replace(/:/g, '')
  const common = { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true } as const
  const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
  if (!active) return <svg {...common}><path d={PATHS[name] ?? ''} {...stroke} /></svg>
  switch (name) {
    case 'today':
      return (
        <svg {...common}>
          <mask id={`m${id}`}><rect width="24" height="24" fill="#fff" /><path d="M3 8.5h18" stroke="#000" strokeWidth="1.6" /><path d="M8 14l3 3 5-6" stroke="#000" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></mask>
          <path d="M7 2v3M17 2v3" {...stroke} strokeWidth={2.2} />
          <rect x="3" y="4" width="18" height="17" rx="3.2" fill="currentColor" mask={`url(#m${id})`} />
        </svg>)
    case 'progress':
      return <svg {...common}><rect x="3.8" y="11.5" width="4.4" height="9" rx="1.6" fill="currentColor" /><rect x="9.8" y="3.5" width="4.4" height="17" rx="1.6" fill="currentColor" /><rect x="15.8" y="8" width="4.4" height="12.5" rx="1.6" fill="currentColor" /></svg>
    case 'profile':
      return <svg {...common}><circle cx="12" cy="7.5" r="4.6" fill="currentColor" /><path d="M3.5 21a8.5 8.5 0 0 1 17 0Z" fill="currentColor" /></svg>
    case 'users':
      return <svg {...common}><circle cx="9" cy="7.6" r="3.9" fill="currentColor" /><path d="M1.8 20.5a7.2 7.2 0 0 1 14.4 0Z" fill="currentColor" /><path d="M16 4.3a3.6 3.6 0 0 1 0 6.4M18.5 14.2A6.5 6.5 0 0 1 21.5 20" {...stroke} strokeWidth={2.2} /></svg>
    case 'alert':
      return (
        <svg {...common}>
          <mask id={`m${id}`}><rect width="24" height="24" fill="#fff" /><path d="M12 9.5v4.5M12 17h.01" stroke="#000" strokeWidth="2.2" strokeLinecap="round" /></mask>
          <path d="M10.3 3.9a2 2 0 0 1 3.4 0l8 14A2 2 0 0 1 20 21H4a2 2 0 0 1-1.7-3.1l8-14Z" fill="currentColor" mask={`url(#m${id})`} />
        </svg>)
    default:
      return <svg {...common}><path d={PATHS[name] ?? ''} {...stroke} strokeWidth={2.5} /></svg>
  }
}

/** Haltère (musculation) et coureur penché en pleine foulée (course) : pleins, lisibles à 16 px. */
export function SportIcon({ sport, size = 18, color }: { sport: Sport; size?: number; color?: string }) {
  const c = color ?? SPORT_COLOR[sport]
  return sport === 'muscu' ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={c} aria-hidden>
      <rect x="1.4" y="8.6" width="2.4" height="6.8" rx="1.1" /><rect x="4.4" y="5.6" width="3.2" height="12.8" rx="1.5" /><rect x="7.6" y="10.9" width="8.8" height="2.2" />
      <rect x="16.4" y="5.6" width="3.2" height="12.8" rx="1.5" /><rect x="20.2" y="8.6" width="2.4" height="6.8" rx="1.1" />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="15.6" cy="4.4" r="1.9" fill={c} stroke="none" />
      <path d="M13.6 8.5 10 10.5l-1.5 3.6M13.6 8.5l2.5 2.6 3.1.5M13.6 8.5l-1.3 4.2 3 2.3.7 4.6M12.3 12.7 9.4 15.6 5.8 16.6" />
    </svg>
  )
}

/** Pastille ronde translucide avec l'icône du sport — posée sur une pochette. */
export function SportBadge({ sports, label, slot }: { sports: Sport[]; label?: string; slot?: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full glass-dark px-3 h-8 text-white text-[13px] font-semibold border border-white/10">
      {sports.map((s) => <SportIcon key={s} sport={s} size={16} color="#fff" />)}
      {label && <span>{label}{slot ? ` · ${slot}` : ''}</span>}
    </div>
  )
}

// ------------------------------------------------------------------ défilement / barre de navigation
function useScrollY(): number {
  const [y, setY] = useState(0)
  useEffect(() => {
    let raf = 0
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setY(window.scrollY)) }
    setY(window.scrollY)
    window.addEventListener('scroll', on, { passive: true })
    return () => { window.removeEventListener('scroll', on); cancelAnimationFrame(raf) }
  }, [])
  return y
}
const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/**
 * Page iOS : gros titre de 34 px qui se réduit en titre centré dans une barre translucide au défilement.
 * Avec `hero`, une pochette pleine largeur passe sous la barre (comme une page d'album Apple Music).
 */
export function Page({
  title, subtitle, back, right, children, tabbed = true, large = true, hero, heroHeight = 300,
}: { title: string; subtitle?: string; back?: boolean | string; right?: ReactNode; children: ReactNode; tabbed?: boolean; large?: boolean; hero?: ReactNode; heroHeight?: number }) {
  const y = useScrollY()
  const nav = useNavigate()
  const hasHero = !!hero
  // progression de 0 (titre grand visible) à 1 (titre dans la barre)
  const p = hasHero ? clamp01((y - (heroHeight - 130)) / 40) : large ? clamp01((y - 26) / 26) : 1
  const goBack = () => (typeof back === 'string' ? nav(back) : nav(-1))
  return (
    <div className="min-h-full" style={{ paddingBottom: tabbed ? 'calc(96px + env(safe-area-inset-bottom) + var(--rest-h, 0px))' : 'calc(36px + env(safe-area-inset-bottom) + var(--rest-h, 0px))' }}>
      <div className="fixed top-0 inset-x-0 z-30 pointer-events-none">
        <div className="absolute inset-0 glass border-b border-sep" style={{ opacity: p }} />
        <div className="relative pt-safe">
          <div className="h-11 px-2 flex items-center relative max-w-xl mx-auto pointer-events-auto">
            <div className="w-24 flex items-center">
              {back ? (hasHero && p < 1 ? (
                <button className="tap w-11 h-11 flex items-center justify-center" aria-label="Retour" onClick={goBack}>
                  <span className="w-9 h-9 rounded-full glass-dark flex items-center justify-center text-white"><Icon name="back" size={20} strokeWidth={2.4} /></span>
                </button>
              ) : (
                <button className="tap flex items-center text-[17px] h-11 pl-1 pr-3" style={{ color: ACCENT }} onClick={goBack}>
                  <Icon name="back" size={24} strokeWidth={2.3} /> <span>Retour</span>
                </button>
              )) : null}
            </div>
            <div className="flex-1 text-center text-[17px] font-semibold truncate" style={{ opacity: p, transform: `translateY(${(1 - p) * 6}px)` }}>{title}</div>
            <div className="w-24 flex justify-end pr-1">{right}</div>
          </div>
        </div>
      </div>
      {hasHero && (
        <div className="max-w-xl mx-auto">
          <div className="relative overflow-hidden rounded-b-[28px]" style={{ height: `calc(${heroHeight}px + env(safe-area-inset-top))`, boxShadow: 'var(--shadow-cover)' }}>{hero}</div>
        </div>
      )}
      <div className="max-w-xl mx-auto px-4" style={{ paddingTop: hasHero ? 18 : 'calc(env(safe-area-inset-top) + 44px)' }}>
        {large && !hasHero && (
          <div className="pt-1 pb-4" style={{ opacity: 1 - p }}>
            <h1 className="t-large">{title}</h1>
            {subtitle && <p className="text-muted text-[15px] mt-1">{subtitle}</p>}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ barre d'onglets
export interface TabDef { to: string; label: string; icon: string; badge?: number }
export function TabBar({ tabs }: { tabs: TabDef[] }) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 glass border-t border-sep pb-safe" aria-label="Navigation principale">
      <div className="max-w-xl mx-auto flex">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to.split('/').length <= 2}
            className={({ isActive }) => `tap flex-1 min-h-[50px] flex flex-col items-center justify-center gap-[3px] pt-1.5 pb-1 text-[10.5px] font-semibold relative ${isActive ? '' : 'text-muted'}`}
            style={({ isActive }) => (isActive ? { color: ACCENT } : undefined)}>
            {({ isActive }) => (<>
              <motion.span key={String(isActive)} initial={isActive ? { scale: 0.78 } : false} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 520, damping: 18 }} className="flex">
                <TabIcon name={t.icon} active={isActive} />
              </motion.span>
              <span className="tracking-[0.01em]">{t.label}</span>
              {t.badge ? <span className="absolute top-1 left-1/2 ml-2.5 min-w-[18px] h-[18px] rounded-full bg-bad text-white text-[11px] font-bold flex items-center justify-center px-1 border-2 border-bg box-content">{t.badge}</span> : null}
            </>)}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

// ------------------------------------------------------------------ composants de base
export function Card({ children, className = '', onClick, style }: { children: ReactNode; className?: string; onClick?: () => void; style?: CSSProperties }) {
  return (
    <div onClick={onClick} style={style} role={onClick ? 'button' : undefined} className={`card ${onClick ? 'tap cursor-pointer' : ''} ${className}`}>{children}</div>
  )
}

export function Button({
  children, onClick, variant = 'primary', disabled, full, small, type = 'button', color,
}: { children: ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'tinted' | 'ghost' | 'danger'; disabled?: boolean; full?: boolean; small?: boolean; type?: 'button' | 'submit'; color?: string }) {
  const base = `btn hit rounded-full font-semibold inline-flex items-center justify-center gap-2 select-none relative ${small ? 'h-10 px-4 text-[15px]' : 'h-[52px] px-6 text-[17px]'} ${full ? 'w-full' : ''} ${disabled ? 'opacity-40 pointer-events-none' : ''}`
  const c = color ?? ACCENT
  const styles: Record<string, CSSProperties> = {
    primary: { background: c, color: '#fff', boxShadow: `0 8px 22px -8px color-mix(in srgb, ${c} 70%, transparent)` },
    secondary: { background: 'var(--surface2)', color: 'var(--text)' },
    tinted: { background: `color-mix(in srgb, ${c} 16%, transparent)`, color: c },
    ghost: { color: c },
    danger: { background: 'rgba(255,69,58,.14)', color: '#FF453A' },
  }
  return (
    <motion.button type={type} disabled={disabled} onClick={onClick} whileTap={{ scale: 0.965 }} transition={spring} className={base} style={styles[variant]}>
      {children}
    </motion.button>
  )
}

export function Chip({ children, color, active, onClick }: { children: ReactNode; color?: string; active?: boolean; onClick?: () => void }) {
  const c = color ?? ACCENT
  const cls = 'inline-flex items-center gap-1 rounded-full px-3 h-8 text-[14px] font-semibold whitespace-nowrap'
  const st: CSSProperties = active ? { background: c, color: '#fff' } : { background: `color-mix(in srgb, ${c} 17%, transparent)`, color: c }
  if (!onClick) return <span className={cls} style={st}>{children}</span>
  return <button onClick={onClick} aria-pressed={active} className={`tap hit ${cls}`} style={st}>{children}</button>
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  const gid = useId()
  return (
    <div className="flex p-[3px] rounded-[11px] bg-surface2 relative" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)} className="hit relative flex-1 h-[38px] text-[13px] font-semibold z-10 px-1 truncate" style={{ color: value === o.value ? 'var(--text)' : 'var(--muted)' }}>
          {value === o.value && <motion.div layoutId={`seg-${gid}`} className="absolute inset-0 rounded-[9px]" style={{ zIndex: -1, background: 'var(--surface3)', boxShadow: '0 2px 6px rgba(0,0,0,.2)' }} transition={spring} />}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function SectionTitle({ children, action, className = '' }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={`flex items-end justify-between mt-8 mb-3 ${className}`}>
      <h2 className="t-title2">{children}</h2>
      {action}
    </div>
  )
}

/** Rangée horizontale façon Apple Music : défilement par aimantation, jamais de scroll horizontal de la page. */
export function Carousel({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-4 px-4 flex items-start gap-3.5 overflow-x-auto snap-x snap-proximity hide-scroll pb-2 overscroll-x-contain" style={{ scrollPaddingLeft: 16 }}>
      {children}
      <div className="shrink-0 w-1" aria-hidden />
    </div>
  )
}

/** Pochette générée (dégradés + forme + grain), voile sombre en bas pour la lisibilité du titre. */
export function Cover({ seed, sports, kind, className = '', style, children, scrim = true }: { seed: string; sports: Sport[]; kind?: string; className?: string; style?: CSSProperties; children?: ReactNode; scrim?: boolean }) {
  const spec = coverSpec(seed, sports, kind)
  return (
    <div className={`${/\b(absolute|fixed|sticky)\b/.test(className) ? '' : 'relative'} overflow-hidden ${className}`} style={{ background: spec.base, ...style }}>
      {spec.layers.map((l, i) => <div key={i} className="absolute inset-0" style={l} />)}
      <div className="absolute inset-0 grain" />
      {scrim && <div className="absolute inset-0" style={{ background: spec.strong ? 'linear-gradient(180deg, rgba(0,0,0,.06) 12%, rgba(0,0,0,.34) 50%, rgba(0,0,0,.74) 100%)' : 'linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,.6) 100%)' }} />}
      <div className="absolute inset-0 rounded-[inherit] pointer-events-none" style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.14)' }} />
      <div className="relative h-full">{children}</div>
    </div>
  )
}

export function Skeleton({ h = 20, w = '100%', r = 12 }: { h?: number; w?: number | string; r?: number }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: r }} aria-hidden />
}

/** Squelette d'écran : gros titre + carte + rangée de pochettes. */
export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Chargement">
      <Skeleton h={44} r={14} />
      <Skeleton h={190} r={24} />
      <div className="flex gap-3 overflow-hidden">{Array.from({ length: rows }, (_, i) => <Skeleton key={i} h={150} w={150} r={20} />)}</div>
    </div>
  )
}

/** Anneau de progression animé (comme les anneaux d'Activité). */
export function Ring({ value, size = 56, stroke = 7, color = ACCENT, children }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = clamp01(value)
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`color-mix(in srgb, ${color} 20%, transparent)`} strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - v) }} transition={{ type: 'spring', stiffness: 90, damping: 20, delay: 0.1 }} />
      </svg>
      {children && <div className="absolute inset-0 flex items-center justify-center">{children}</div>}
    </div>
  )
}

/** Carte de chiffre clé. */
export function StatTile({ label, value, sub, color, icon }: { label: string; value: string; sub?: string; color?: string; icon?: ReactNode }) {
  return (
    <div className="card p-3.5 min-w-0">
      <div className="flex items-center gap-1.5 text-[12px] text-muted font-semibold">{icon}<span className="truncate">{label}</span></div>
      <div className="text-[28px] font-extrabold leading-[1.1] num mt-1 tracking-tight" style={{ color }}>{value}</div>
      {sub && <div className="text-[12px] text-muted mt-0.5 leading-snug">{sub}</div>}
    </div>
  )
}

export function EmptyState({ icon = 'sparkle', title, text, action, color = ACCENT }: { icon?: string; title: string; text: string; action?: ReactNode; color?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={springSoft} className="flex flex-col items-center text-center py-12 px-6 gap-3">
      <div className="w-[76px] h-[76px] rounded-[26px] flex items-center justify-center mb-1" style={{ background: `linear-gradient(145deg, color-mix(in srgb, ${color} 30%, transparent), color-mix(in srgb, ${color} 10%, transparent))`, color }}>
        <Icon name={icon} size={34} />
      </div>
      <div className="t-title3">{title}</div>
      <p className="text-muted text-[15px] max-w-[280px] leading-snug">{text}</p>
      {action && <div className="mt-2">{action}</div>}
    </motion.div>
  )
}

export function ErrorState({ text, retry }: { text?: string; retry?: () => void }) {
  return <EmptyState icon="alert" color="#FF9F0A" title="Oups, quelque chose a coincé" text={text ?? 'Rien de grave : tes données sont en sécurité. Réessaie dans un instant.'} action={retry ? <Button variant="secondary" small onClick={retry}>Réessayer</Button> : undefined} />
}

export function Row({ children, onClick, border = true }: { children: ReactNode; onClick?: () => void; border?: boolean }) {
  return (
    <div onClick={onClick} role={onClick ? 'button' : undefined} className={`flex items-center gap-3 px-4 min-h-[52px] py-2.5 relative ${onClick ? 'tap-soft cursor-pointer active:bg-surface2' : ''}`}>
      {children}
      {border && <span className="absolute bottom-0 right-0 h-px bg-sep" style={{ left: 16 }} />}
    </div>
  )
}
/** Pastille colorée avec icône, comme dans les Réglages iOS. */
export function RowIcon({ name, color }: { name: string; color: string }) {
  return <span className="w-[30px] h-[30px] rounded-[8px] flex items-center justify-center text-white shrink-0" style={{ background: color }}><Icon name={name} size={18} strokeWidth={2.1} /></span>
}
export function Group({ children, header, footer }: { children: ReactNode; header?: string; footer?: string }) {
  return (
    <div className="mb-6">
      {header && <div className="px-4 pb-1.5 text-[13px] uppercase tracking-wide text-muted font-medium">{header}</div>}
      <div className="bg-surface rounded-[var(--r-lg)] overflow-hidden [&>*:last-child>span.absolute]:hidden" style={{ boxShadow: 'var(--shadow-card)' }}>{children}</div>
      {footer && <div className="px-4 pt-1.5 text-[13px] text-muted leading-snug">{footer}</div>}
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label?: string }) {
  return (
    <button role="switch" aria-checked={checked} aria-label={label} onClick={onChange} className="tap relative w-[56px] h-11 shrink-0 flex items-center justify-center">
      <span className="relative block w-[51px] h-[31px] rounded-full transition-colors duration-200" style={{ background: checked ? '#30D158' : 'var(--surface3)' }}>
        <motion.span className="absolute top-[2px] left-[2px] w-[27px] h-[27px] rounded-full bg-white" style={{ boxShadow: '0 2px 5px rgba(0,0,0,.3)' }} animate={{ x: checked ? 20 : 0 }} transition={{ type: 'spring', stiffness: 600, damping: 32 }} />
      </span>
    </button>
  )
}

// ------------------------------------------------------------------ feuille modale
export function Sheet({ open, onClose, title, children, tall }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; tall?: boolean }) {
  const controls = useDragControls()
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [open])
  const y = useMotionValue(0)
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
          <motion.div className="absolute inset-0" style={{ background: 'var(--scrim)', WebkitBackdropFilter: 'blur(3px)', backdropFilter: 'blur(3px)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} onClick={onClose} />
          <motion.div
            className="absolute bottom-0 inset-x-0 glass-strong max-w-xl mx-auto flex flex-col"
            style={{ y, maxHeight: tall ? '93%' : '86%', borderRadius: 'var(--r-sheet) var(--r-sheet) 0 0', boxShadow: 'var(--shadow-float), 0 -1px 0 var(--sep)' }}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={spring}
            drag="y" dragControls={controls} dragListener={false} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0.02, bottom: 0.7 }}
            onDragEnd={(_, i) => { if (i.offset.y > 110 || i.velocity.y > 600) onClose() }}>
            <div className="shrink-0 touch-none cursor-grab" onPointerDown={(e) => controls.start(e)}>
              <div className="w-10 h-[5px] rounded-full mx-auto mt-2 mb-1.5" style={{ background: 'var(--muted)', opacity: 0.4 }} />
              {title && (
                <div className="flex items-center justify-between px-5 pb-2.5 pt-1.5">
                  <h3 className="text-[21px] font-bold tracking-tight">{title}</h3>
                  <button onClick={onClose} aria-label="Fermer" className="tap hit relative w-8 h-8 rounded-full bg-surface3/70 flex items-center justify-center text-muted"><Icon name="x" size={15} strokeWidth={2.6} /></button>
                </div>
              )}
            </div>
            <div className="overflow-y-auto overscroll-contain px-5" style={{ paddingBottom: 'calc(22px + env(safe-area-inset-bottom))' }}>{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

// ------------------------------------------------------------------ champs
export function Field({ label, children, hint }: { label?: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      {label && <div className="text-[13px] text-muted mb-1.5 ml-1 font-medium">{label}</div>}
      {children}
      {hint && <div className="text-[12px] text-muted mt-1 ml-1">{hint}</div>}
    </label>
  )
}
export const inputCls = 'w-full h-12 rounded-[14px] bg-surface px-4 outline-none focus:ring-2 focus:ring-inset focus:ring-accent/60 placeholder:text-muted/60 transition-shadow'

export function NumberInput({ value, onChange, step = 1, min = 0, max = 999, suffix, width = 96 }: { value: number | undefined; onChange: (v: number | undefined) => void; step?: number; min?: number; max?: number; suffix?: string; width?: number }) {
  const [raw, setRaw] = useState(value === undefined ? '' : String(value))
  const last = useRef(value)
  useEffect(() => {
    if (last.current !== value) { setRaw(value === undefined ? '' : String(value).replace('.', ',')); last.current = value }
  }, [value])
  const bump = (dir: 1 | -1) => {
    const base = value ?? 0
    const v = dir > 0 ? Math.min(max, Math.round((base + step) * 100) / 100) : Math.max(min, Math.round((base - step) * 100) / 100)
    last.current = v; setRaw(String(v).replace('.', ',')); onChange(v)
  }
  return (
    <div className="inline-flex items-center rounded-[14px] bg-surface2 h-12 overflow-hidden shrink-0" style={{ width: width + 96 }}>
      <button aria-label="Diminuer" className="tap w-12 h-12 flex items-center justify-center text-muted" onClick={() => bump(-1)}><Icon name="minus" size={18} strokeWidth={2.4} /></button>
      <div className="flex-1 flex items-center justify-center min-w-0">
        <input inputMode="decimal" value={raw} className="w-full min-w-0 h-12 bg-transparent text-center outline-none num font-bold text-[17px]"
          onChange={(e) => {
            const t = e.target.value.replace(',', '.')
            setRaw(e.target.value)
            if (t === '') { last.current = undefined; onChange(undefined); return }
            const n = Number(t)
            if (!Number.isNaN(n)) { const v = Math.min(max, Math.max(min, n)); last.current = v; onChange(v) }
          }} />
        {suffix && <span className="text-muted text-sm pr-2">{suffix}</span>}
      </div>
      <button aria-label="Augmenter" className="tap w-12 h-12 flex items-center justify-center text-muted" onClick={() => bump(1)}><Icon name="plus" size={18} strokeWidth={2.4} /></button>
    </div>
  )
}

/** Saisie d'une durée en champs séparés (le clavier numérique d'iOS n'a pas la touche « : »). */
export function DurationInput({ value, onChange, hours = true, compact }: { value: number | undefined; onChange: (seconds: number | undefined) => void; hours?: boolean; compact?: boolean }) {
  const split = (v?: number) => {
    if (!v) return { h: '', m: '', s: '' }
    return { h: Math.floor(v / 3600) ? String(Math.floor(v / 3600)) : '', m: String(Math.floor((v % 3600) / 60)), s: String(Math.round(v % 60)) }
  }
  const [f, setF] = useState(split(value))
  const total = (x: { h: string; m: string; s: string }) => (Number(x.h) || 0) * 3600 + (Number(x.m) || 0) * 60 + (Number(x.s) || 0)
  useEffect(() => { if ((value ?? 0) !== total(f)) setF(split(value)) }, [value])
  const set = (k: 'h' | 'm' | 's', v: string) => {
    const clean = v.replace(/\D/g, '').slice(0, 2)
    const next = { ...f, [k]: clean }
    setF(next)
    const t = total(next)
    onChange(t > 0 ? t : undefined)
  }
  const cell = `${compact ? 'h-11 w-11 text-[16px]' : 'h-12 w-14 text-[17px]'} rounded-[14px] bg-surface2 text-center num font-bold outline-none focus:ring-2 focus:ring-inset focus:ring-accent/60`
  const lab = compact ? 'text-[12px] text-muted mr-1.5 ml-0.5 font-medium' : 'text-[13px] text-muted mr-2 ml-1 font-medium'
  return (
    <div className="inline-flex items-center">
      {hours && (<><input className={cell} inputMode="numeric" placeholder="0" value={f.h} onChange={(e) => set('h', e.target.value)} aria-label="Heures" /><span className={lab}>h</span></>)}
      <input className={cell} inputMode="numeric" placeholder="00" value={f.m} onChange={(e) => set('m', e.target.value)} aria-label="Minutes" /><span className={lab}>min</span>
      <input className={cell} inputMode="numeric" placeholder="00" value={f.s} onChange={(e) => set('s', e.target.value)} aria-label="Secondes" /><span className={lab}>s</span>
    </div>
  )
}

// ------------------------------------------------------------------ toasts
type ToastMsg = { id: number; text: string }
let toastId = 0
const toastListeners = new Set<(t: ToastMsg) => void>()
export function toast(text: string) {
  const t = { id: ++toastId, text }
  toastListeners.forEach((l) => l(t))
}
export function Toaster() {
  const [list, setList] = useState<ToastMsg[]>([])
  useEffect(() => {
    const l = (t: ToastMsg) => {
      setList((x) => [...x, t])
      setTimeout(() => setList((x) => x.filter((y) => y.id !== t.id)), 3200)
    }
    toastListeners.add(l)
    return () => { toastListeners.delete(l) }
  }, [])
  return (
    <div className="fixed top-0 inset-x-0 z-[60] pt-safe pointer-events-none flex flex-col items-center gap-2 mt-2" aria-live="polite">
      <AnimatePresence>
        {list.map((t) => (
          <motion.div key={t.id} layout initial={{ y: -50, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -30, opacity: 0, scale: 0.95 }} transition={spring}
            className="glass-strong rounded-[22px] px-5 py-3 text-[14.5px] font-semibold border border-sep max-w-[90%] text-center" style={{ boxShadow: 'var(--shadow-float)' }}>{t.text}</motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

