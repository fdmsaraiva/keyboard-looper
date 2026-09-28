// Downloads the embedded General MIDI soundfont (MuseScore_General, MIT licence)
// into public/soundfonts. It is ~40 MB, so it is fetched at build time instead
// of being committed to the repository.
import { createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const BASE = 'https://ftp.osuosl.org/pub/musescore/soundfont/MuseScore_General/'
const FILES = ['MuseScore_General.sf3', 'MuseScore_General_License.md']
const DIR = new URL('../public/soundfonts/', import.meta.url)

mkdirSync(DIR, { recursive: true })
for (const name of FILES) {
  const target = new URL(name, DIR)
  if (existsSync(target) && statSync(target).size > 0) continue
  process.stdout.write(`Downloading ${name}… `)
  const res = await fetch(BASE + name)
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`)
  await pipeline(Readable.fromWeb(res.body), createWriteStream(target))
  console.log('done')
}
