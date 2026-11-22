// Écrans de démarrage iOS (apple-touch-startup-image) générés depuis l'icône.
import sharp from 'sharp'
import fs from 'node:fs'
const sizes = [
  [1170, 2532, 390, 844, 3], [1179, 2556, 393, 852, 3], [1284, 2778, 428, 926, 3], [1290, 2796, 430, 932, 3], [750, 1334, 375, 667, 2], [1125, 2436, 375, 812, 3],
]
fs.mkdirSync('public/splash', { recursive: true })
const tags = []
for (const [w, h, dw, dh, r] of sizes) {
  const size = Math.round(w * 0.3)
  const round = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${Math.round(size * 0.225)}" fill="#fff"/></svg>`)
  const icon = await sharp('public/icon.svg').resize(size).composite([{ input: round, blend: 'dest-in' }]).png().toBuffer()
  await sharp({ create: { width: w, height: h, channels: 4, background: '#000000' } })
    .composite([{ input: icon, gravity: 'center' }]).png().toFile(`public/splash/${w}x${h}.png`)
  tags.push(`    <link rel="apple-touch-startup-image" media="(device-width: ${dw}px) and (device-height: ${dh}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)" href="/splash/${w}x${h}.png" />`)
}
fs.writeFileSync('scripts/splash-tags.txt', tags.join('\n'))
console.log('splash ok')
