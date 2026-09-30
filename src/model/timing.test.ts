import { describe, expect, it } from 'vitest'
import type { Note } from './looper'
import { type Grid, guessQuantizeGrid, quantizeNotes, stepSeconds } from './timing'

const g: Grid = { bpm: 100, signature: { beats: 4, unit: 4 } } // quarter = 0.6 s
const notesAt = (starts: number[]): Note[] => starts.map((start) => ({ pitch: 60, velocity: 100, start, dur: 0.1 }))
const jitter = (xs: number[], amount: number) => xs.map((x, i) => x + (i % 2 ? amount : -amount / 2))

describe('guessQuantizeGrid', () => {
  it('picks quarters for notes on the beat', () => {
    expect(guessQuantizeGrid(notesAt(jitter([0, 0.6, 1.2, 1.8], 0.03)), g)).toBe('1/4')
  })
  it('picks eighths for straight eighths played loosely', () => {
    expect(guessQuantizeGrid(notesAt(jitter([0, 0.3, 0.6, 0.9, 1.2, 1.5], 0.03)), g)).toBe('1/8')
  })
  it('picks eighth triplets for triplets', () => {
    expect(guessQuantizeGrid(notesAt(jitter([0, 0.2, 0.4, 0.6, 0.8, 1.0], 0.02)), g)).toBe('1/8T')
  })
  it('picks sixteenths for sixteenth runs', () => {
    expect(guessQuantizeGrid(notesAt(jitter([0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1.05], 0.02)), g)).toBe('1/16')
  })
  it('defaults to eighths with very few notes', () => {
    expect(guessQuantizeGrid(notesAt([0.13]), g)).toBe('1/8')
  })
})

describe('quantizeNotes', () => {
  it('snaps starts to the nearest step and wraps at the loop end', () => {
    const step = stepSeconds(g, '1/8') // 0.3
    const q = quantizeNotes(notesAt([0.28, 0.46, 2.35]), step, 2.4)
    expect(q.map((n) => +n.start.toFixed(3))).toEqual([0.3, 0.6, 0])
  })
})
