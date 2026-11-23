// Fabrique un petit fichier .fit réaliste (5 km, départ trop rapide, FC croissante) et son .zip « Exporter l'original ».
// Usage : node scripts/make-fit-fixture.mjs
import { FitBaseType as T, FitEncoder } from 'fit-file-parser'
import { zipSync } from 'fflate'
import { writeFileSync } from 'node:fs'

const start = new Date('2026-11-20T07:30:00Z') // 08:30 à Paris
const OFFSET = 3600
const enc = new FitEncoder()
const ts = (s) => FitEncoder.toFitTimestamp(new Date(start.getTime() + s * 1000))
const f = (number, size, baseType, value) => ({ number, size, baseType, value })

enc.writeMessage(0, [f(0, 1, T.Enum, 4), f(1, 2, T.Uint16, 1), f(4, 4, T.Uint32, ts(0))], 0) // file_id : activité, Garmin

// km 1-2 à 5:05, km 3-5 à 5:40 ; une mesure toutes les 10 s
const kmTime = [305, 305, 340, 340, 340]
const total = kmTime.reduce((a, b) => a + b, 0)
let t = 0
const distAt = (sec) => {
  let rem = sec, d = 0
  for (const kt of kmTime) { if (rem <= kt) return d + (rem / kt) * 1000; rem -= kt; d += 1000 }
  return d
}
for (; t <= total; t += 10) {
  const d = distAt(t)
  const sp = t < 610 ? 1000 / 305 : 1000 / 340
  const hr = Math.round(128 + (t / total) * 44)
  enc.writeMessage(20, [f(253, 4, T.Uint32, ts(t)), f(3, 1, T.Uint8, hr), f(5, 4, T.Uint32, Math.round(d * 100)), f(6, 2, T.Uint16, Math.round(sp * 1000))], 1)
}
let lapStart = 0
kmTime.forEach((kt, i) => {
  const hr = Math.round(128 + ((lapStart + kt / 2) / total) * 44)
  enc.writeMessage(19, [f(253, 4, T.Uint32, ts(lapStart + kt)), f(2, 4, T.Uint32, ts(lapStart)), f(7, 4, T.Uint32, kt * 1000), f(8, 4, T.Uint32, kt * 1000), f(9, 4, T.Uint32, 100000), f(13, 2, T.Uint16, Math.round((1000 / kt) * 1000)), f(15, 1, T.Uint8, hr), f(16, 1, T.Uint8, hr + 4)], 2)
  lapStart += kt
})
enc.writeMessage(18, [f(253, 4, T.Uint32, ts(total)), f(2, 4, T.Uint32, ts(0)), f(5, 1, T.Enum, 1), f(6, 1, T.Enum, 2), f(7, 4, T.Uint32, total * 1000), f(8, 4, T.Uint32, total * 1000), f(9, 4, T.Uint32, 500000), f(14, 2, T.Uint16, Math.round((5000 / total) * 1000)), f(16, 1, T.Uint8, 150), f(17, 1, T.Uint8, 172), f(22, 2, T.Uint16, 38)], 3)
enc.writeMessage(34, [f(253, 4, T.Uint32, ts(total)), f(5, 4, T.Uint32, ts(total) + OFFSET), f(0, 4, T.Uint32, total * 1000), f(1, 2, T.Uint16, 1), f(2, 1, T.Enum, 0)], 4)

const bytes = enc.close()
writeFileSync(new URL('./fixtures/sortie-5km.fit', import.meta.url), bytes)
writeFileSync(new URL('./fixtures/sortie-5km.zip', import.meta.url), zipSync({ '12345678901_ACTIVITY.fit': bytes }))
console.log('OK', bytes.length, 'octets,', total, 's')
