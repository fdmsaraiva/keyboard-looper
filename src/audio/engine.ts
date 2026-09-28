// Audio engine: owns the AudioContext and the SoundFont synthesizer, plays the
// live keyboard and schedules the recorded layers of the looper ahead of time.

import { WorkletSynthesizer } from 'spessasynth_lib'
import workletUrl from 'spessasynth_lib/dist/spessasynth_processor.min.js?url'
import type { Instrument, Layer, Looper } from '../model/looper'

const LIVE_CHANNEL = 0
/** Channel 0 is the live keyboard; each layer gets one of the remaining 15. */
export const MAX_LAYERS = 15
/** How far ahead (seconds) recorded events are handed to the synthesizer. */
const LOOKAHEAD = 0.12
const TICK_MS = 25
const CC_BANK = 0
const CC_VOLUME = 7
const CC_SUSTAIN = 64
const CC_ALL_NOTES_OFF = 123

export interface Preset {
  program: number
  bankMSB: number
  drums: boolean
  name: string
}

export class AudioEngine {
  readonly ctx: AudioContext
  synth!: WorkletSynthesizer
  presets: Preset[] = []

  private scheduledUntil = 0
  private channelOf = new Map<number, number>() // layer id → MIDI channel
  private channelInstrument = new Map<number, string>() // channel → instrument key
  private channelVolume = new Map<number, number>()
  private lastLoopStart = Number.NaN
  private wasPlaying = false
  private timer: number | undefined

  constructor(private looper: Looper) {
    this.ctx = new AudioContext({ latencyHint: 'interactive' })
  }

  /** `soundfontUrls` are concatenated in order (hosts with a per-file size limit get a split file). */
  async load(soundfontUrls: string[], onProgress: (fraction: number) => void): Promise<void> {
    const [bank] = await Promise.all([
      fetchAllWithProgress(soundfontUrls, onProgress),
      this.ctx.audioWorklet.addModule(workletUrl),
    ])
    this.synth = new WorkletSynthesizer(this.ctx)
    this.synth.connect(this.ctx.destination)
    await this.synth.soundBankManager.addSoundBank(bank, 'main')
    await this.synth.isReady
    this.presets = this.synth.presetList
      .map((p) => ({ program: p.program, bankMSB: p.bankMSB, drums: p.isDrum, name: p.name.trim() }))
      .sort((a, b) => Number(a.drums) - Number(b.drums) || a.program - b.program || a.bankMSB - b.bankMSB)
    this.timer = window.setInterval(() => this.tick(), TICK_MS)
  }

  /** Must be called from a user gesture on mobile browsers. */
  async resume(): Promise<void> {
    if (this.ctx.state !== 'running') await this.ctx.resume()
  }

  get now(): number {
    return this.ctx.currentTime
  }

  get latencyMs(): { base: number; output: number } {
    return {
      base: Math.round((this.ctx.baseLatency ?? 0) * 1000),
      output: Math.round(((this.ctx as AudioContext & { outputLatency?: number }).outputLatency ?? 0) * 1000),
    }
  }

  get voiceCount(): number {
    return this.synth?.voiceCount ?? 0
  }

  // --- live playing --------------------------------------------------------

  setLiveInstrument(instrument: Instrument) {
    this.applyInstrument(LIVE_CHANNEL, instrument)
  }

  liveNoteOn(pitch: number, velocity: number) {
    this.synth.noteOn(LIVE_CHANNEL, pitch, velocity)
    this.looper.noteOn(pitch, velocity, this.now)
  }

  liveNoteOff(pitch: number) {
    this.synth.noteOff(LIVE_CHANNEL, pitch)
    this.looper.noteOff(pitch, this.now)
  }

  liveSustain(down: boolean) {
    this.synth.controllerChange(LIVE_CHANNEL, CC_SUSTAIN, down ? 127 : 0)
    this.looper.sustain(down, this.now)
  }

  // --- layer playback ------------------------------------------------------

  /** Called when layers change (mute, delete, instrument…) to silence what should stop. */
  silenceLayer(layerId: number) {
    const ch = this.channelOf.get(layerId)
    if (ch === undefined) return
    this.synth.controllerChange(ch, CC_SUSTAIN, 0)
    this.synth.controllerChange(ch, CC_ALL_NOTES_OFF, 0)
  }

  private tick() {
    const l = this.looper
    l.tick(this.now)
    const playing = l.isPlaying && !!l.loopLength
    if (!playing) {
      if (this.wasPlaying) this.silenceAll()
      this.wasPlaying = false
      return
    }
    const now = this.now
    if (!this.wasPlaying || l.loopStart !== this.lastLoopStart) {
      this.scheduledUntil = Math.max(now, l.loopStart)
      this.lastLoopStart = l.loopStart
    }
    this.wasPlaying = true
    const from = Math.max(this.scheduledUntil, now)
    const to = now + LOOKAHEAD
    if (to <= from) return
    this.releaseUnusedChannels()
    for (const layer of l.audibleLayers()) this.scheduleLayer(layer, from, to)
    this.scheduledUntil = to
  }

  private scheduleLayer(layer: Layer, from: number, to: number) {
    const l = this.looper
    const len = l.loopLength!
    const ch = this.channelFor(layer)
    const vol = Math.round(layer.volume * 127)
    if (this.channelVolume.get(ch) !== vol) {
      this.synth.controllerChange(ch, CC_VOLUME, vol)
      this.channelVolume.set(ch, vol)
    }
    const occurrences = (start: number, fn: (t: number) => void) => {
      let k = Math.ceil((from - l.loopStart - start) / len)
      for (let t = l.loopStart + k * len + start; t < to; k++, t = l.loopStart + k * len + start) fn(t)
    }
    for (const s of layer.sustain) {
      occurrences(s.start, (t) => {
        this.synth.controllerChange(ch, CC_SUSTAIN, 127, { time: t })
        this.synth.controllerChange(ch, CC_SUSTAIN, 0, { time: t + s.dur })
      })
    }
    for (const n of layer.notes) {
      occurrences(n.start, (t) => {
        this.synth.noteOn(ch, n.pitch, n.velocity, { time: t })
        this.synth.noteOff(ch, n.pitch, { time: t + n.dur })
      })
    }
  }

  private channelFor(layer: Layer): number {
    let ch = this.channelOf.get(layer.id)
    if (ch === undefined) {
      const used = new Set(this.channelOf.values())
      ch = 1
      while (used.has(ch)) ch++
      // The prototype caps layers at MAX_LAYERS so the 16 default channels suffice.
      this.channelOf.set(layer.id, ch)
    }
    this.applyInstrument(ch, layer.instrument)
    return ch
  }

  private applyInstrument(ch: number, inst: Instrument) {
    const key = `${inst.drums}:${inst.bankMSB}:${inst.program}`
    if (this.channelInstrument.get(ch) === key) return
    this.channelInstrument.set(ch, key)
    this.synth.midiChannels[ch].setDrums(inst.drums)
    this.synth.controllerChange(ch, CC_BANK, inst.drums ? 0 : inst.bankMSB)
    this.synth.programChange(ch, inst.program)
  }

  private releaseUnusedChannels() {
    const ids = new Set(this.looper.layers.map((x) => x.id))
    for (const [id, ch] of this.channelOf) {
      if (!ids.has(id)) {
        this.synth.controllerChange(ch, CC_ALL_NOTES_OFF, 0)
        this.channelOf.delete(id)
      }
    }
  }

  private silenceAll() {
    // Events already handed to the synth up to `scheduledUntil` still fire, so
    // silence both now and just after the last scheduled event.
    for (const ch of this.channelOf.values()) {
      for (const time of [this.now, this.scheduledUntil + 0.005]) {
        this.synth.controllerChange(ch, CC_SUSTAIN, 0, { time })
        this.synth.controllerChange(ch, CC_ALL_NOTES_OFF, 0, { time })
      }
    }
  }
}

async function fetchAllWithProgress(urls: string[], onProgress: (f: number) => void): Promise<ArrayBuffer> {
  const responses = await Promise.all(urls.map((u) => fetch(u)))
  for (const [i, res] of responses.entries()) {
    if (!res.ok || !res.body) throw new Error(`Could not load ${urls[i]} (${res.status})`)
  }
  const total = responses.reduce((sum, r) => sum + (Number(r.headers.get('content-length')) || 0), 0)
  const chunks: Uint8Array[] = []
  let received = 0
  for (const res of responses) {
    const reader = res.body!.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      received += value.length
      if (total) onProgress(Math.min(1, received / total))
    }
  }
  const out = new Uint8Array(received)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.length
  }
  return out.buffer
}
