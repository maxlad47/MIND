import type { CSSProperties } from 'react'
import { hash } from '@/engine/utils'
import { getLook, type Look } from './look'

export type Sport = 'muscu' | 'course'
export const SPORT_COLOR = { muscu: 'var(--muscu)', course: '#FF9F0A' } as const
export const SPORT_LABEL = { muscu: 'Musculation', course: 'Course' } as const

/**
 * « Pochettes » abstraites façon Apple Music, générées par code et déterministes à partir de l'id.
 *
 * Deux palettes de dégradés (une par style) :
 *  - Féminin  : jaune → orange-rouge, pêche → rose, citron vert → menthe, magenta → indigo.
 *  - Masculin : crème → ambre, orange → brique, orange-rouge → bordeaux, vin → quasi noir.
 *
 * Les séances de course suivent la température de la palette : fractionné (VMA, côtes, fartlek, test, course)
 * = les teintes les plus chaudes ; seuil / spécifique = chaud tempéré ; sortie longue = intermédiaire ;
 * endurance fondamentale et récupération = les plus froides. La musculation a sa propre famille
 * (magenta → indigo en féminin, rouge → vin en masculin).
 */

type Stops = [string, string, string] // haut, milieu, bas
type PalKey = 'g1' | 'g2' | 'g3' | 'g4' | 'mild' | 'muscu'

const PAL: Record<Look, Record<PalKey, Stops>> = {
  feminin: {
    g1: ['#F9CC56', '#F6993C', '#EE5238'],
    g2: ['#F7BCA6', '#EC7A93', '#E63869'],
    g3: ['#E5EF6E', '#A6EE9A', '#62F2D8'],
    g4: ['#D2307F', '#9024A9', '#3A22DD'],
    mild: ['#8EEFC9', '#6C9BE9', '#5A3EDC'],
    muscu: ['#D2307F', '#9024A9', '#3A22DD'],
  },
  masculin: {
    g1: ['#F6EADA', '#F1C27A', '#DE8D2C'],
    g2: ['#E88F30', '#C9602F', '#A23A2B'],
    g3: ['#C95A2A', '#A92A33', '#3A0F18'],
    g4: ['#7B1D29', '#46121C', '#1A0A0C'],
    mild: ['#F6EADA', '#F1C27A', '#DE8D2C'],
    muscu: ['#B93232', '#6C1826', '#1E0A0E'],
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
  feminin: { hot: 'g1', warm: 'g2', mild: 'mild', cold: 'g3', muscu: 'muscu' },
  masculin: { hot: 'g2', warm: 'g3', mild: 'g1', cold: 'g4', muscu: 'muscu' },
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
const LIGHT = new Set(['feminin:g3', 'feminin:mild', 'masculin:g1', 'masculin:mild'])

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
  const masc = look === 'masculin'
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

  const arch = masc ? [3, 6, 2, 5, 7, 6, 3][Math.floor(r() * 7)] : [0, 1, 2, 3, 4, 5][Math.floor(r() * 6)]
  if (arch === 0) {
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
  feminin: { Base: '#7FE3C0', 'Développement': '#F6993C', 'Spécifique': '#E63869', 'Affûtage': '#6A44E8', Musculation: '#B02FA0' },
  masculin: { Base: '#B8434F', 'Développement': '#E88F30', 'Spécifique': '#D1442B', 'Affûtage': '#F1C27A', Musculation: '#A92A33' },
}
export const PHASE_COLOR: Record<string, string> = new Proxy({} as Record<string, string>, { get: (_t, k: string) => PHASES[getLook()][k] ?? PHASES[getLook()].Base })
