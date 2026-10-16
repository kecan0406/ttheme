import { readFileSync } from 'node:fs'
import { decodePng } from '../../src/core/png.ts'

const image = decodePng(readFileSync(process.argv[2] ?? ''))
const at = (Math.round(image.height * 0.6) * image.width + Math.round(image.width * 0.7)) * 4
const hex = [...image.data.slice(at, at + 3)].map((c) => c.toString(16).padStart(2, '0')).join('')

console.log(`srgb #${hex}`)
