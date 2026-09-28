// Splits the soundfont in dist/ into parts below a host's per-file size limit
// (used for the claude.ai artifact preview, which caps files at 15 MB).
import { readFileSync, rmSync, writeFileSync } from 'node:fs'

const file = new URL('../dist/soundfonts/MuseScore_General.sf3', import.meta.url)
const parts = Number(process.argv[2] || 3)
const suffix = process.argv[3] || ''
const data = readFileSync(file)
const size = Math.ceil(data.length / parts)
for (let i = 0; i < parts; i++) writeFileSync(new URL(`${file.href}.part${i}${suffix}`), data.subarray(i * size, (i + 1) * size))
rmSync(file)
console.log(`Split into ${parts} parts of ≤ ${(size / 1e6).toFixed(1)} MB`)
