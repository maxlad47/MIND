import type { CSSProperties } from 'react'
import { hash } from '@/engine/utils'
import { getLook, type Look } from './look'

export type Sport = 'muscu' | 'course'
export const SPORT_COLOR = { muscu: 'var(--muscu)', course: 'var(--course)' } as const
export const SPORT_LABEL = { muscu: 'Musculation', course: 'Course' } as const

/**
 * « Pochettes » abstraites façon Apple Music, générées par code et déterministes à partir de l'id.
 *
 * Deux palettes de dégradés (une par thème) :
 *  - Thème 1 (Paceform) : orange Vivid, bleu Mist → bleu Ocean, bleu nuit, orange → bleu.
 *  - Thème 2 (Kinetic bleu) : rose Hot Pink, bleu clair → bleu Sky, bleu profond, bleu → rose.
 *
 * Les séances de course suivent la température de la palette : fractionné (VMA, côtes, fartlek, test, course)
 * = les teintes les plus chaudes ; seuil / spécifique = chaud tempéré ; sortie longue = intermédiaire ;
 * endurance fondamentale et récupération = les plus froides. La musculation a sa propre famille
 * (orange → bleu Ocean en thème 1, rose → bleu en thème 2).
 */

type Stops = [string, string, string] // haut, milieu, bas
type PalKey = 'g1' | 'g2' | 'g3' | 'g4' | 'mild' | 'muscu'

const PAL: Record<Look, Record<PalKey, Stops>> = {
  t1: {
    g1: ['#FFB27A', '#F76926', '#B8380A'],
    g2: ['#A9CEE7', '#3F86B8', '#01598C'],
    g3: ['#1A6FA3', '#01406A', '#02121F'],
    g4: ['#01598C', '#0A2F55', '#F76926'],
    mild: ['#A9CEE7', '#5C93BC', '#F76926'],
    muscu: ['#F76926', '#C2471A', '#01406A'],
  },
  t2: {
    g1: ['#FF7AC0', '#D83995', '#7A1A6A'],
    g2: ['#7FD3F5', '#0593C6', '#034A70'],
    g3: ['#0593C6', '#034A70', '#021821'],
    g4: ['#3FB6E6', '#6A5BC8', '#D83995'],
    mild: ['#CFF0FC', '#62C3EA', '#0593C6'],
    muscu: ['#D83995', '#7A2A9A', '#034A70'],
  },
}

type Temp = 'hot' | 'warm' | 'mild' | 'cold' | 'muscu'
const TEMP_OF: Record<string, Temp> = {
  vma: 'hot', cotes: 'hot', fartlek: 'hot', test: 'hot', course: 'hot',
  seuil: 'warm', specifique: 'warm', renfo: 'warm',
  longue: 'mild',
  ef: 'cold', recup: 'cold',
  fullbody: 'muscu', haut: 'muscu', bas: 'muscu', push: 'muscu', pull: 'muscu', jambes: 'muscu',
}
const KEY_OF: Record<Look, Record<Temp, PalKey>> = {
  t1: { hot: 'g1', warm: 'mild', mild: 'g2', cold: 'g3', muscu: 'muscu' },
  t2: { hot: 'g1', warm: 'g4', mild: 'g2', cold: 'g3', muscu: 'muscu' },
}

function rng(seed: string) {
  let a = hash(seed) || 1
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rgb = (h: string): [number, number, number] => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
const rgba = (h: string, a: number) => { const [r, g, b] = rgb(h); return `rgba(${r},${g},${b},${a})` }
const mixHex = (h: string, w: string, t: number) => {
  const [r, g, b] = rgb(h), [r2, g2, b2] = rgb(w)
  const f = (x: number, y: number) => Math.round(x + (y - x) * t)
  return '#' + [f(r, r2), f(g, g2), f(b, b2)].map((v) => v.toString(16).padStart(2, '0')).join('')
}
/** Palettes claires : voile plus fort pour garder le titre blanc lisible. */
const LIGHT = new Set(['t1:g2', 't2:mild'])

export interface CoverSpec {
  base: string
  layers: CSSProperties[]
  archetype: number
  /** fond clair : voile renforcé */
  strong: boolean
}

function stopsFor(look: Look, sports: Sport[], kind: string | undefined, r: () => number): { stops: Stops; key: PalKey } {
  let temp: Temp | undefined = kind ? TEMP_OF[kind] : undefined
  if (!temp) {
    if (sports.length === 1 && sports[0] === 'muscu') temp = 'muscu'
    else if (sports.length === 1) temp = (['hot', 'warm', 'mild', 'cold'] as Temp[])[Math.floor(r() * 4)]
    else temp = (['hot', 'warm', 'cold', 'muscu'] as Temp[])[Math.floor(r() * 4)]
  }
  const key = KEY_OF[look][temp]
  return { stops: PAL[look][key], key }
}

export function coverSpec(seed: string, sports: Sport[], kind?: string): CoverSpec {
  const look = getLook()
  const r = rng(seed + ':' + look)
  const range = (a: number, b: number) => a + (b - a) * r()
  const { stops, key } = stopsFor(look, sports, kind, r)
  const [top, mid, bot] = stops
  const light = mixHex(top, '#ffffff', 0.35)
  const angle = Math.floor(range(155, 205))
  const base = `linear-gradient(${angle}deg, ${top} 0%, ${mid} 52%, ${bot} 100%)`
  const strong = LIGHT.has(`${look}:${key}`)
  const masc = true // angles francs dans les deux thèmes
  // toutes les couleurs de la palette : deux accents pris dans les AUTRES dégradés
  const others = (['g1', 'g2', 'g3', 'g4'] as PalKey[]).filter((k) => PAL[look][k] !== stops && !(k === 'g4' && key === 'muscu'))
  const pickAcc = () => others.splice(Math.floor(r() * others.length), 1)[0]
  const A = PAL[look][pickAcc()], B = PAL[look][pickAcc()]
  const accA = A[1], accB = B[1]

  const layers: CSSProperties[] = [{ background: [
    `radial-gradient(circle at ${range(10, 90)}% ${range(0, 30)}%, ${rgba(light, 0.5)} 0%, transparent ${range(40, 60)}%)`,
    `radial-gradient(circle at ${range(0, 35)}% ${range(70, 105)}%, ${rgba(accA, 0.7)} 0%, transparent ${range(38, 55)}%)`,
    `radial-gradient(circle at ${range(65, 100)}% ${range(35, 80)}%, ${rgba(accB, 0.6)} 0%, transparent ${range(32, 48)}%)`,
  ].join(',') }]

  // thème 1 : traînées orange (8) et satin (10) ; thème 2 : traînées roses (8), satin, éclat
  const arch = look === 't1' ? [8, 10, 8, 10, 6, 8, 10][Math.floor(r() * 7)] : [8, 8, 10, 8, 5, 8, 10][Math.floor(r() * 7)]
  if (arch === 8) {
    const streak = (c: string, top: number, h: number, left: number, w: number, a: number): string =>
      `linear-gradient(90deg, transparent ${left}%, ${rgba(c, a)} ${left + w * 0.35}%, ${rgba(c, a)} ${left + w * 0.7}%, transparent ${left + w}%) 0 ${top}% / 100% ${h}% no-repeat`
    const yel = look === 't1' ? '#F76926' : '#FF4FAE'
    layers.push({ filter: 'blur(4px)', background: [
      streak(yel, range(46, 58), range(7, 11), range(-10, 15), range(55, 80), 0.95),
      streak(look === 't1' ? '#A9CEE7' : '#FCFFFF', range(62, 72), range(2, 4), range(5, 35), range(35, 55), 0.75),
      streak(yel, range(74, 86), range(5, 8), range(-5, 25), range(45, 65), 0.85),
      streak('#FEFEFE', range(30, 42), range(2, 3), range(30, 60), range(30, 45), 0.45),
    ].join(',') })
    layers.push({ background: `radial-gradient(ellipse at ${range(55, 85)}% ${range(25, 55)}%, rgba(0,0,0,.35) 0%, transparent 55%)` })
  } else if (arch === 10) {
    // satin : larges plis de lumière bleu clair, flous
    const fold = (x: number, y: number, w: number, h: number, a: number) => `radial-gradient(ellipse ${w}% ${h}% at ${x}% ${y}%, rgba(169,206,231,${a}) 0%, transparent 70%)`
    layers.push({ filter: 'blur(6px)', transform: `rotate(${Math.floor(range(-30, 30))}deg) scale(1.3)`, background: [
      fold(range(20, 45), range(25, 45), range(40, 60), range(8, 14), 0.55),
      fold(range(50, 80), range(50, 70), range(45, 65), range(7, 12), 0.45),
      fold(range(10, 40), range(70, 90), range(35, 50), range(6, 10), 0.35),
    ].join(',') })
    layers.push({ background: `linear-gradient(${Math.floor(range(150, 210))}deg, transparent 40%, rgba(1,20,40,.45))` })
  } else if (arch === 9) {
    const c1 = range(26, 36), c2 = range(64, 74), r1 = range(22, 32), r2 = range(62, 72), lw = 1
    const line = 'rgba(255,239,239,.32)'
    const glint = (x: number, y: number) => `radial-gradient(circle at ${x}% ${y}%, rgba(255,239,239,.95) 0 1.4px, rgba(255,239,239,.35) 2.4px, transparent 6px)`
    layers.push({ background: `radial-gradient(ellipse at ${range(45, 75)}% ${range(35, 65)}%, rgba(255,70,50,.55) 0%, transparent 55%)` })
    layers.push({ background: [
      glint(c1, r1), glint(c2, r1), glint(c1, r2), glint(c2, r2),
      `linear-gradient(90deg, transparent calc(${c1}% - ${lw}px), ${line} calc(${c1}% - ${lw}px) ${c1}%, transparent ${c1}%)`,
      `linear-gradient(90deg, transparent calc(${c2}% - ${lw}px), ${line} calc(${c2}% - ${lw}px) ${c2}%, transparent ${c2}%)`,
      `linear-gradient(180deg, transparent calc(${r1}% - ${lw}px), ${line} calc(${r1}% - ${lw}px) ${r1}%, transparent ${r1}%)`,
      `linear-gradient(180deg, transparent calc(${r2}% - ${lw}px), ${line} calc(${r2}% - ${lw}px) ${r2}%, transparent ${r2}%)`,
    ].join(',') })
  } else if (arch === 0) {
    layers.push({ background: [
      `radial-gradient(circle at ${range(0, 30)}% ${range(60, 110)}%, ${rgba(A[2], 0.9)} 0%, transparent ${range(45, 65)}%)`,
      `radial-gradient(circle at ${range(70, 100)}% ${range(20, 70)}%, ${rgba(B[0], 0.85)} 0%, transparent ${range(40, 60)}%)`,
    ].join(',') })
  } else if (arch === 1) {
    const size = range(76, 104)
    layers.push({ inset: 'auto', width: `${size}%`, aspectRatio: '1', left: `${range(28, 55)}%`, top: `${range(30, 55)}%`, borderRadius: '50%',
      background: `linear-gradient(160deg, ${rgba(A[0], 0.9)}, ${rgba(A[1], 0.75)} 55%, ${rgba(B[2], 0.65)})`, boxShadow: `0 0 60px ${rgba(A[0], 0.45)}` })
  } else if (arch === 2) {
    const x = r() < 0.5 ? range(0, 25) : range(75, 100), y = r() < 0.5 ? range(0, 25) : range(60, 100)
    const ring = `rgba(255,255,255,${masc ? 0.3 : 0.34})`
    layers.push({
      background: `repeating-radial-gradient(circle at ${x}% ${y}%, ${ring} 0 ${masc ? 2 : 2.5}px, transparent ${masc ? 2 : 2.5}px ${masc ? 13 : 15}px)`,
      WebkitMaskImage: `radial-gradient(circle at ${x}% ${y}%, #000 0%, transparent 78%)`, maskImage: `radial-gradient(circle at ${x}% ${y}%, #000 0%, transparent 78%)`,
    })
  } else if (arch === 3) {
    const ang = Math.floor(range(18, 65))
    const w = masc ? 6 : 9, gap = masc ? 22 : 28
    layers.push({
      background: `repeating-linear-gradient(${ang}deg, rgba(255,255,255,${masc ? 0.2 : 0.16}) 0 ${w}px, transparent ${w}px ${gap}px)`,
      WebkitMaskImage: `linear-gradient(${ang + 90}deg, #000 0%, transparent 60%)`, maskImage: `linear-gradient(${ang + 90}deg, #000 0%, transparent 60%)`,
    })
  } else if (arch === 4) {
    const o = (c: string, left: number, top: number, size: number): CSSProperties => ({
      inset: 'auto', width: `${size}%`, aspectRatio: '1', left: `${left}%`, top: `${top}%`, borderRadius: '50%',
      background: `radial-gradient(circle at 35% 30%, ${mixHex(c, '#ffffff', 0.35)}, ${c} 72%)`, mixBlendMode: 'screen', opacity: 0.75,
    })
    layers.push(o(A[0], range(-10, 15), range(-15, 15), range(60, 80)))
    layers.push(o(B[2], range(35, 60), range(30, 60), range(60, 85)))
  } else if (arch === 5) {
    const x = range(0, 100), y = range(75, 120)
    layers.push({
      background: `conic-gradient(from ${Math.floor(range(0, 360))}deg at ${x}% ${y}%, transparent 0deg, ${rgba(A[0], 0.8)} 38deg, transparent 88deg, ${rgba(B[1], 0.7)} 148deg, transparent 220deg)`,
      WebkitMaskImage: `radial-gradient(circle at ${x}% ${y}%, #000 10%, transparent 86%)`, maskImage: `radial-gradient(circle at ${x}% ${y}%, #000 10%, transparent 86%)`,
    })
  } else if (arch === 6) {
    const a = Math.floor(range(100, 130)), p1 = range(28, 44), w = range(10, 18)
    layers.push({ background: `linear-gradient(${a}deg, transparent 0 ${p1}%, rgba(255,255,255,.17) ${p1}% ${p1 + w}%, transparent ${p1 + w}% ${p1 + w + 6}%, rgba(0,0,0,.26) ${p1 + w + 6}% 100%)` })
  } else {
    layers.push({ clipPath: 'polygon(0 100%, 100% 22%, 100% 100%)', background: `linear-gradient(200deg, ${rgba(A[0], 0.7)}, ${rgba(B[2], 0.9)})` })
    layers.push({ clipPath: 'polygon(0 100%, 100% 55%, 100% 100%)', background: 'rgba(0,0,0,.25)' })
  }
  if (strong) layers.push({ background: 'rgba(255, 230, 190, 0.18)' })
  return { base, layers, archetype: arch, strong }
}

/** Fond CSS complet (pour les endroits qui n'utilisent pas le composant <Cover>). */
export function coverBackground(seed: string, sports: Sport[], kind?: string): string {
  const s = coverSpec(seed, sports, kind)
  return [(s.layers[0].background as string), s.base].join(',')
}

/** Couleurs des phases du programme, tirées de la palette du style courant. */
const PHASES: Record<Look, Record<string, string>> = {
  t1: { Base: '#5C93BC', 'Développement': '#F79A5E', 'Spécifique': '#F76926', 'Affûtage': '#2C7DB5', Musculation: '#C2471A' },
  t2: { Base: '#4FAFD8', 'Développement': '#0593C6', 'Spécifique': '#D83995', 'Affûtage': '#8A5AC8', Musculation: '#B02A7C' },
}
export const PHASE_COLOR: Record<string, string> = new Proxy({} as Record<string, string>, { get: (_t, k: string) => PHASES[getLook()][k] ?? PHASES[getLook()].Base })
