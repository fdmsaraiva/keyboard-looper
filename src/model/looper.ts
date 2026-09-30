// Pure looper model: recording state machine, layers and undo/redo history.
// All times are in seconds on the audio clock supplied by the caller, so the
// model can be unit-tested without an AudioContext. See docs/ESPECIFICACOES.md
// §5–§11 for the behaviour this implements.

import { barSeconds, beatSeconds, type Grid, guessQuantizeGrid, type QuantizeGrid, quantizeNotes, stepSeconds } from './timing'

export interface Instrument {
  program: number
  bankMSB: number
  drums: boolean
  name: string
}

/** A recorded note. `start` is a position in [0, layer length); `dur` ≤ layer length. */
export interface Note {
  pitch: number
  velocity: number
  start: number
  dur: number
}

/** A sustain-pedal interval, positioned like a note. */
export interface SustainSpan {
  start: number
  dur: number
}

export interface Layer {
  id: number
  /** The layer repeats every `length` seconds: a whole number of base loops (spec §11). */
  length: number
  instrument: Instrument
  notes: Note[]
  sustain: SustainSpan[]
  volume: number // 0..1
  muted: boolean
  solo: boolean
  /** Applied on playback only; the notes keep the timing as played. */
  quantize: { on: boolean; grid: QuantizeGrid }
}

export type LooperState =
  | 'empty' // no visible layers, not recording
  | 'armed' // first recording requested (free timing), waiting for the first note
  | 'countIn' // recording requested with the grid on, counting in
  | 'recFirst' // recording the layer that defines the loop
  | 'playing'
  | 'overdub'
  | 'stopped' // has layers, playback stopped

export const MIN_LOOP_SECONDS = 0.5
export const MAX_FIRST_RECORDING_SECONDS = 300
/** Same pitch within this distance (seconds) in one layer is merged into one note. */
export const DUPLICATE_WINDOW = 0.03

interface Pending {
  // Absolute time the note/sustain began.
  on: number
  velocity: number
  // Set once the element has been committed into a layer and is still held.
  committed?: { layer: Layer; item: Note | SustainSpan }
}

export class Looper {
  state: LooperState = 'empty'
  /**
   * Current loop length in seconds (the length the next recording gets), or
   * null when the idea is empty. Always `multiple × baseLength`.
   */
  loopLength: number | null = null
  /** Length of the first recording; every layer is a whole multiple of it. */
  baseLength: number | null = null
  /** Absolute audio time corresponding to loop position 0 of the current playback. */
  loopStart = 0
  layers: Layer[] = []
  redoStack: Layer[] = []
  /** Tempo grid, or null for free timing (no quantisation or bar features). */
  grid: Grid | null
  countInBars = 1
  /** With the grid on, Stop just before a bar line keeps recording until this time. */
  closingAt: number | null = null

  private nextId = 1
  private recording: Layer | null = null
  /** Absolute time the current recording started (first note for recFirst). */
  private recordStart = 0
  private heldNotes = new Map<number, Pending>()
  private heldSustain: Pending | null = null
  /** Notes pressed before this time (during a count-in) are ignored. */
  private recordFrom = Number.NEGATIVE_INFINITY
  private sustainDown = false
  private listeners = new Set<() => void>()

  constructor(
    public layerLimit = 16,
    grid: Grid | null = null,
  ) {
    this.grid = grid
  }

  /** Grid changes are only allowed while the idea is empty (the tempo is fixed after recording). */
  setGrid(grid: Grid | null) {
    if (this.loopLength !== null || this.isRecording) return
    this.grid = grid
    this.emit()
  }

  // --- observation -------------------------------------------------------

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit() {
    for (const fn of this.listeners) fn()
  }

  get isRecording() {
    return this.state === 'armed' || this.state === 'countIn' || this.state === 'recFirst' || this.state === 'overdub'
  }

  get isPlaying() {
    return this.state === 'playing' || this.state === 'overdub'
  }

  get canRecord() {
    return !this.isRecording && this.layers.length < this.layerLimit
  }

  get canUndo() {
    return !this.isRecording && this.layers.length > 0
  }

  get canRedo() {
    return !this.isRecording && this.redoStack.length > 0
  }

  /** Current layer being recorded (not yet part of `layers`). */
  get recordingLayer(): Layer | null {
    return this.recording
  }

  /** Loop position (seconds) of absolute time `t`. */
  position(t: number): number {
    if (!this.loopLength) return 0
    const p = (t - this.loopStart) % this.loopLength
    return p < 0 ? p + this.loopLength : p
  }

  // --- transport ----------------------------------------------------------

  /** Rec button. `startAt` is used when playback has to (re)start from the loop beginning. */
  rec(instrument: Instrument, now: number): void {
    if (!this.canRecord) return
    if (this.state === 'empty') {
      this.recording = this.newLayer(instrument)
      if (this.grid) {
        // Count in, then record from the first bar line (spec §6.1).
        this.recordStart = now + this.countInBars * barSeconds(this.grid)
        this.loopStart = this.recordStart
        this.recordFrom = this.recordStart - beatSeconds(this.grid) / 2
        this.state = this.countInBars > 0 ? 'countIn' : 'recFirst'
      } else {
        this.state = 'armed'
      }
    } else if (this.state === 'playing') {
      this.startOverdub(instrument, now)
    } else if (this.state === 'stopped') {
      // Restart from the loop beginning, after a count-in when the grid is on.
      const countIn = this.grid ? this.countInBars * barSeconds(this.grid) : 0
      this.loopStart = now + countIn
      this.startOverdub(instrument, now)
      if (this.grid) this.recordFrom = this.loopStart - beatSeconds(this.grid) / 2
    }
    this.emit()
  }

  play(now: number): void {
    if (this.state !== 'stopped') return
    this.loopStart = now
    this.state = 'playing'
    this.emit()
  }

  stop(now: number): void {
    switch (this.state) {
      case 'armed':
      case 'countIn':
        this.discardRecording()
        this.state = 'empty'
        break
      case 'recFirst':
        if (this.closingAt !== null) return
        if (this.grid) {
          // Round to the nearest bar (spec §6.1): keep recording up to a bar
          // line just ahead, or cut notes started after a bar line just passed.
          const bar = barSeconds(this.grid)
          const bars = Math.max(1, Math.round((now - this.recordStart) / bar))
          const end = this.recordStart + bars * bar
          if (end > now) {
            this.closingAt = end
            break
          }
          this.finishFirst(end)
        } else {
          this.finishFirst(now)
        }
        break
      case 'overdub':
        this.commitRecording(now)
        this.state = 'playing'
        break
      case 'playing':
        this.state = 'stopped'
        break
      default:
        return
    }
    this.emit()
  }

  cancel(): void {
    if (this.state === 'armed' || this.state === 'countIn' || this.state === 'recFirst') {
      this.closingAt = null
      this.discardRecording()
      this.state = 'empty'
      if (this.layers.length === 0 && this.redoStack.length === 0) this.resetLength()
    } else if (this.state === 'overdub') {
      this.discardRecording()
      this.state = 'playing'
    } else {
      return
    }
    this.emit()
  }

  /** Called periodically; enforces the first-recording time limit. */
  tick(now: number): void {
    if (this.state === 'countIn' && now >= this.recordStart) {
      this.state = 'recFirst'
      if (this.sustainDown && !this.heldSustain) this.heldSustain = { on: this.recordStart, velocity: 0 }
      this.emit()
    }
    if (this.state === 'recFirst' && this.closingAt !== null && now >= this.closingAt) {
      const end = this.closingAt
      this.closingAt = null
      this.finishFirst(end)
      this.emit()
      return
    }
    if (this.state === 'recFirst' && this.closingAt === null && now - this.recordStart >= MAX_FIRST_RECORDING_SECONDS) {
      if (this.grid) {
        const bar = barSeconds(this.grid)
        this.finishFirst(this.recordStart + Math.floor(MAX_FIRST_RECORDING_SECONDS / bar) * bar)
        this.emit()
      } else {
        this.stop(this.recordStart + MAX_FIRST_RECORDING_SECONDS)
      }
    }
  }

  // --- performance input -------------------------------------------------

  noteOn(pitch: number, velocity: number, t: number): void {
    if (this.state === 'armed') {
      this.state = 'recFirst'
      this.recordStart = t
      if (this.sustainDown) this.heldSustain = { on: t, velocity: 0 }
      this.emit()
    }
    // A retrigger of a still-held pitch closes the previous one first.
    if (this.heldNotes.has(pitch)) this.noteOff(pitch, t)
    const recording = this.state === 'countIn' || this.state === 'recFirst' || this.state === 'overdub'
    if (recording && t >= this.recordFrom && (this.closingAt === null || t < this.closingAt)) {
      // A note played a little early for the first beat counts as on the beat.
      const beat1 = this.state === 'overdub' ? this.loopStart : this.recordStart
      this.heldNotes.set(pitch, { on: Math.max(t, beat1), velocity })
    }
  }

  noteOff(pitch: number, t: number): void {
    const held = this.heldNotes.get(pitch)
    if (!held) return
    this.heldNotes.delete(pitch)
    if (held.committed) {
      // Released after its layer was committed: finalise the duration.
      ;(held.committed.item as Note).dur = this.clampDur(t - held.on)
      this.emit()
      return
    }
    if (!this.recording) return
    this.recording.notes.push(this.makeNote(pitch, held.velocity, held.on, t))
  }

  sustain(down: boolean, t: number): void {
    this.sustainDown = down
    if (down) {
      if ((this.state === 'recFirst' || this.state === 'overdub') && t >= this.recordFrom) {
        if (!this.heldSustain) this.heldSustain = { on: t, velocity: 0 }
      }
      return
    }
    const held = this.heldSustain
    this.heldSustain = null
    if (!held) return
    if (held.committed) {
      held.committed.item.dur = this.clampDur(t - held.on)
      this.emit()
      return
    }
    if (!this.recording) return
    const n = this.makeNote(0, 0, held.on, t)
    this.recording.sustain.push({ start: n.start, dur: n.dur })
  }

  // --- history -------------------------------------------------------------

  undo(): void {
    if (!this.canUndo) return
    const layer = this.layers.pop()!
    this.redoStack.push(layer)
    if (this.layers.length === 0) this.state = 'empty'
    this.emit()
  }

  redo(): void {
    if (!this.canRedo) return
    const layer = this.redoStack.pop()!
    this.layers.push(layer)
    if (this.state === 'empty') this.state = 'stopped'
    this.emit()
  }

  deleteLayer(id: number): void {
    const i = this.layers.findIndex((l) => l.id === id)
    if (i < 0) return
    this.layers.splice(i, 1)
    if (this.layers.length === 0 && !this.isRecording) {
      this.state = 'empty'
      if (this.redoStack.length === 0) this.resetLength()
    }
    this.emit()
  }

  // --- layer settings (not part of undo history) ---------------------------

  updateLayer(id: number, patch: Partial<Pick<Layer, 'instrument' | 'volume' | 'muted' | 'solo' | 'quantize'>>): void {
    const layer = this.layers.find((l) => l.id === id)
    if (!layer) return
    Object.assign(layer, patch)
    this.emit()
  }

  /** Layers that should currently sound, honouring mute and solo. */
  audibleLayers(): Layer[] {
    const anySolo = this.layers.some((l) => l.solo)
    return this.layers.filter((l) => !l.muted && (!anySolo || l.solo))
  }

  /** Notes as they should sound: quantised when the layer asks for it and the idea has a grid. */
  playbackNotes(layer: Layer): Note[] {
    if (!layer.quantize.on || !this.grid) return layer.notes
    return quantizeNotes(layer.notes, stepSeconds(this.grid, layer.quantize.grid), layer.length)
  }

  /** Number of base loops in the current loop length. */
  get multiple(): number {
    return this.loopLength && this.baseLength ? Math.round(this.loopLength / this.baseLength) : 1
  }

  get canExtend() {
    return !this.isRecording && this.baseLength !== null
  }

  get canShrink() {
    return this.canExtend && this.multiple > 1
  }

  /**
   * Adds (or removes) one base loop to the length that the next recordings get.
   * Existing layers keep their own length and keep repeating (spec §11).
   */
  extendLoop(delta: 1 | -1 = 1): void {
    if (delta > 0 ? !this.canExtend : !this.canShrink) return
    this.loopLength = (this.multiple + delta) * this.baseLength!
    this.emit()
  }

  // --- internals -------------------------------------------------------------

  private resetLength() {
    this.loopLength = null
    this.baseLength = null
  }

  private newLayer(instrument: Instrument): Layer {
    return {
      id: this.nextId++,
      length: 0,
      instrument,
      notes: [],
      sustain: [],
      volume: 1,
      muted: false,
      solo: false,
      quantize: { on: false, grid: '1/16' },
    }
  }

  private startOverdub(instrument: Instrument, now: number) {
    this.recording = this.newLayer(instrument)
    this.recordStart = now
    this.recordFrom = Number.NEGATIVE_INFINITY
    this.state = 'overdub'
    if (this.sustainDown) this.heldSustain = { on: now, velocity: 0 }
  }

  private finishFirst(now: number) {
    const length = now - this.recordStart
    if (length < MIN_LOOP_SECONDS) {
      this.discardRecording()
      this.state = 'empty'
      if (this.layers.length === 0 && this.redoStack.length === 0) this.resetLength()
      return
    }
    // A new first recording replaces any redo history (rule 4).
    this.redoStack = []
    this.loopLength = length
    this.baseLength = length
    this.loopStart = this.recordStart
    // Notes started at or after the loop end (a late Stop) are dropped (spec §6.1).
    if (this.recording) this.recording.notes = this.recording.notes.filter((n) => n.start < length - 1e-6)
    for (const [pitch, held] of this.heldNotes) if (!held.committed && held.on >= now - 1e-6) this.heldNotes.delete(pitch)
    this.commitRecording(now)
    this.state = 'playing'
  }

  private commitRecording(now: number) {
    const layer = this.recording
    if (!layer) return
    this.recording = null
    // Elements still held continue into the loop; their durations are finalised on release.
    for (const [pitch, held] of this.heldNotes) {
      const note = this.makeNote(pitch, held.velocity, held.on, now)
      layer.notes.push(note)
      held.committed = { layer, item: note }
    }
    if (this.heldSustain) {
      const n = this.makeNote(0, 0, this.heldSustain.on, now)
      const span = { start: n.start, dur: n.dur }
      layer.sustain.push(span)
      this.heldSustain.committed = { layer, item: span }
    }
    layer.length = this.loopLength!
    layer.notes = mergeDuplicates(layer.notes, layer.length)
    if (this.grid) layer.quantize = { on: true, grid: guessQuantizeGrid(layer.notes, this.grid) }
    this.layers.push(layer)
    this.redoStack = []
  }

  private discardRecording() {
    this.recording = null
    this.recordFrom = Number.NEGATIVE_INFINITY
    for (const [pitch, held] of this.heldNotes) {
      if (!held.committed) this.heldNotes.delete(pitch)
    }
    if (this.heldSustain && !this.heldSustain.committed) this.heldSustain = null
  }

  private makeNote(pitch: number, velocity: number, on: number, off: number): Note {
    const start = this.state === 'recFirst' ? on - this.recordStart : this.position(on)
    return { pitch, velocity, start, dur: this.clampDur(off - on) }
  }

  private clampDur(d: number): number {
    const max = this.loopLength ?? Number.POSITIVE_INFINITY
    return Math.max(0.01, Math.min(d, max))
  }
}

/** Merge same-pitch notes whose starts are within DUPLICATE_WINDOW (circularly), keeping the loudest. */
export function mergeDuplicates(notes: Note[], loopLength: number): Note[] {
  const out: Note[] = []
  const sorted = [...notes].sort((a, b) => a.start - b.start)
  for (const n of sorted) {
    const dup = out.find((o) => {
      if (o.pitch !== n.pitch) return false
      const d = Math.abs(o.start - n.start)
      return Math.min(d, loopLength - d) < DUPLICATE_WINDOW
    })
    if (!dup) {
      out.push(n)
    } else if (n.velocity > dup.velocity) {
      Object.assign(dup, n)
    }
  }
  return out
}
