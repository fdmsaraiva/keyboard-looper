// Tempo grid, quantisation and grid guessing (spec §9, §10).

import type { Note } from './looper'

export interface TimeSignature {
  beats: number
  /** 4 = quarter-note beats, 8 = eighth-note beats. */
  unit: 4 | 8
}

export const TIME_SIGNATURES: TimeSignature[] = [
  { beats: 2, unit: 4 },
  { beats: 3, unit: 4 },
  { beats: 4, unit: 4 },
  { beats: 6, unit: 8 },
]

/** The idea's tempo grid. `bpm` counts beats of the signature's unit. */
export interface Grid {
  bpm: number
  signature: TimeSignature
}

export const DEFAULT_GRID: Grid = { bpm: 100, signature: { beats: 4, unit: 4 } }
export const MIN_BPM = 30
export const MAX_BPM = 300

export const beatSeconds = (g: Grid) => 60 / g.bpm
export const barSeconds = (g: Grid) => g.signature.beats * beatSeconds(g)
const quarterSeconds = (g: Grid) => (g.signature.unit === 4 ? beatSeconds(g) : beatSeconds(g) * 2)

export type QuantizeGrid = '1/4' | '1/8' | '1/16' | '1/8T' | '1/16T'

/** Coarsest first: the guess prefers the widest grid that explains the notes. */
export const QUANTIZE_GRIDS: QuantizeGrid[] = ['1/4', '1/8', '1/8T', '1/16', '1/16T']

const PER_QUARTER: Record<QuantizeGrid, number> = { '1/4': 1, '1/8': 2, '1/16': 4, '1/8T': 3, '1/16T': 6 }

export const stepSeconds = (g: Grid, q: QuantizeGrid) => quarterSeconds(g) / PER_QUARTER[q]

/** Note starts moved to the nearest grid step (wrapping at the loop end). Durations are kept. */
export function quantizeNotes(notes: Note[], step: number, loopLength: number): Note[] {
  return notes.map((n) => {
    let start = Math.round(n.start / step) * step
    if (start >= loopLength - 1e-6) start -= loopLength
    return { ...n, start: Math.max(0, start) }
  })
}

/** Mean distance (seconds) from each start to the nearest step. */
function meanDeviation(starts: number[], step: number): number {
  let sum = 0
  for (const s of starts) {
    const r = s % step
    sum += Math.min(r, step - r)
  }
  return sum / starts.length
}

/**
 * Guess the quantisation grid from where the notes fall: the coarsest grid
 * whose average deviation is small both relative to the step and in absolute
 * time (human timing plus touch latency jitter). Few notes → 1/8.
 */
export function guessQuantizeGrid(notes: Note[], grid: Grid): QuantizeGrid {
  const starts = notes.map((n) => n.start)
  if (starts.length < 4) return '1/8'
  for (const q of QUANTIZE_GRIDS) {
    const step = stepSeconds(grid, q)
    const dev = meanDeviation(starts, step)
    if (dev < 0.2 * step && dev < 0.045) return q
  }
  return '1/16'
}
