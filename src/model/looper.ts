// Pure looper model: recording state machine, layers and undo/redo history.
// All times are in seconds on the audio clock supplied by the caller, so the
// model can be unit-tested without an AudioContext. See docs/ESPECIFICACOES.md
// §5–§7 for the behaviour this implements.

export interface Instrument {
  program: number
  bankMSB: number
  drums: boolean
  name: string
}

/** A recorded note. `start` is a loop position in [0, loopLength); `dur` ≤ loopLength. */
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
  instrument: Instrument
  notes: Note[]
  sustain: SustainSpan[]
  volume: number // 0..1
  muted: boolean
  solo: boolean
}

export type LooperState =
  | 'empty' // no visible layers, not recording
  | 'armed' // first recording requested, waiting for the first note
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
  /** Loop length in seconds, or null when the idea is empty. */
  loopLength: number | null = null
  /** Absolute audio time corresponding to loop position 0 of the current playback. */
  loopStart = 0
  layers: Layer[] = []
  redoStack: Layer[] = []

  private nextId = 1
  private recording: Layer | null = null
  /** Absolute time the current recording started (first note for recFirst). */
  private recordStart = 0
  private heldNotes = new Map<number, Pending>()
  private heldSustain: Pending | null = null
  private sustainDown = false
  private listeners = new Set<() => void>()

  constructor(public layerLimit = 16) {}

  // --- observation -------------------------------------------------------

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit() {
    for (const fn of this.listeners) fn()
  }

  get isRecording() {
    return this.state === 'armed' || this.state === 'recFirst' || this.state === 'overdub'
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
      this.state = 'armed'
    } else if (this.state === 'playing') {
      this.startOverdub(instrument, now)
    } else if (this.state === 'stopped') {
      this.loopStart = now
      this.startOverdub(instrument, now)
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
        this.discardRecording()
        this.state = 'empty'
        break
      case 'recFirst':
        this.finishFirst(now)
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
    if (this.state === 'armed' || this.state === 'recFirst') {
      this.discardRecording()
      this.state = 'empty'
      if (this.layers.length === 0 && this.redoStack.length === 0) this.loopLength = null
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
    if (this.state === 'recFirst' && now - this.recordStart >= MAX_FIRST_RECORDING_SECONDS) {
      this.stop(this.recordStart + MAX_FIRST_RECORDING_SECONDS)
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
    if (this.state === 'recFirst' || this.state === 'overdub') {
      this.heldNotes.set(pitch, { on: t, velocity })
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
      if (this.state === 'recFirst' || this.state === 'overdub') {
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
      if (this.redoStack.length === 0) this.loopLength = null
    }
    this.emit()
  }

  // --- layer settings (not part of undo history) ---------------------------

  updateLayer(id: number, patch: Partial<Pick<Layer, 'instrument' | 'volume' | 'muted' | 'solo'>>): void {
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

  // --- internals ---------------------------------------------------------------

  private newLayer(instrument: Instrument): Layer {
    return {
      id: this.nextId++,
      instrument,
      notes: [],
      sustain: [],
      volume: 1,
      muted: false,
      solo: false,
    }
  }

  private startOverdub(instrument: Instrument, now: number) {
    this.recording = this.newLayer(instrument)
    this.recordStart = now
    this.state = 'overdub'
    if (this.sustainDown) this.heldSustain = { on: now, velocity: 0 }
  }

  private finishFirst(now: number) {
    const length = now - this.recordStart
    if (length < MIN_LOOP_SECONDS) {
      this.discardRecording()
      this.state = 'empty'
      if (this.layers.length === 0 && this.redoStack.length === 0) this.loopLength = null
      return
    }
    // A new first recording replaces any redo history (rule 4).
    this.redoStack = []
    this.loopLength = length
    this.loopStart = this.recordStart
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
    layer.notes = mergeDuplicates(layer.notes, this.loopLength!)
    this.layers.push(layer)
    this.redoStack = []
  }

  private discardRecording() {
    this.recording = null
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
