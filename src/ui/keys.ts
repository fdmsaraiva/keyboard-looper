// Piano geometry and labels for the 88-key range A0 (21) … C8 (108).

export const LOWEST = 21
export const HIGHEST = 108

const BLACK = new Set([1, 3, 6, 8, 10])
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export const isBlack = (pitch: number) => BLACK.has(pitch % 12)

/** Index among white keys, counting from A0 = 0. For black keys, the white key to their left. */
export function whiteIndex(pitch: number): number {
  let count = 0
  for (let p = LOWEST; p < pitch; p++) if (!isBlack(p)) count++
  return isBlack(pitch) ? count - 1 : count
}

export const TOTAL_WHITES = whiteIndex(HIGHEST) + 1 // 52

/** Scientific pitch notation with C4 = middle C (MIDI 60). */
export function noteName(pitch: number): string {
  return `${NAMES[pitch % 12]}${Math.floor(pitch / 12) - 1}`
}

export const KEYS = Array.from({ length: HIGHEST - LOWEST + 1 }, (_, i) => {
  const pitch = LOWEST + i
  return { pitch, black: isBlack(pitch), white: whiteIndex(pitch) }
})

/** Short General MIDI percussion names (notes 35–81). */
export const DRUM_NAMES: Record<number, string> = {
  35: 'Kick 2',
  36: 'Kick',
  37: 'Stick',
  38: 'Snare',
  39: 'Clap',
  40: 'Snare 2',
  41: 'Tom L2',
  42: 'HH closed',
  43: 'Tom L1',
  44: 'HH pedal',
  45: 'Tom M2',
  46: 'HH open',
  47: 'Tom M1',
  48: 'Tom H2',
  49: 'Crash',
  50: 'Tom H1',
  51: 'Ride',
  52: 'China',
  53: 'Ride bell',
  54: 'Tamb.',
  55: 'Splash',
  56: 'Cowbell',
  57: 'Crash 2',
  58: 'Vibraslap',
  59: 'Ride 2',
  60: 'Bongo H',
  61: 'Bongo L',
  62: 'Conga mute',
  63: 'Conga H',
  64: 'Conga L',
  65: 'Timbale H',
  66: 'Timbale L',
  67: 'Agogo H',
  68: 'Agogo L',
  69: 'Cabasa',
  70: 'Maracas',
  71: 'Whistle S',
  72: 'Whistle L',
  73: 'Guiro S',
  74: 'Guiro L',
  75: 'Claves',
  76: 'Block H',
  77: 'Block L',
  78: 'Cuica mute',
  79: 'Cuica open',
  80: 'Triangle mute',
  81: 'Triangle',
}
