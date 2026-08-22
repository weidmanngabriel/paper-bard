import sharp from 'sharp'
import { fileURLToPath } from 'node:url'

const source = fileURLToPath(new URL('../public/favicon.svg', import.meta.url))
const outputs = [
  ['pwa-192x192.png', 192],
  ['pwa-512x512.png', 512],
  ['maskable-512x512.png', 512],
  ['apple-touch-icon.png', 180],
]

await Promise.all(outputs.map(([name, size]) =>
  sharp(source).resize(size, size).png().toFile(fileURLToPath(new URL(`../public/${name}`, import.meta.url))),
))
