import { describe, expect, it } from 'vitest'
import { type Instrument, Looper, mergeDuplicates } from './looper'

const piano: Instrument = { program: 0, bankMSB: 0, drums: false, name: 'Piano' }
const bass: Instrument = { program: 33, bankMSB: 0, drums: false, name: 'Bass' }

/** Records a first layer of `len` seconds with one note, starting at t=10. */
function withFirstLayer(len = 2) {
  const l = new Looper()
  l.rec(piano, 9)
  l.noteOn(60, 100, 10)
  l.noteOff(60, 10.5)
  l.stop(10 + len)
  return l
}

function overdub(l: Looper, at: number, pitch = 64) {
  l.rec(bass, at)
  l.noteOn(pitch, 90, at + 0.1)
  l.noteOff(pitch, at + 0.2)
  l.stop(at + 0.3)
}

describe('first recording', () => {
  it('arms and starts on the first note', () => {
    const l = new Looper()
    l.rec(piano, 5)
    expect(l.state).toBe('armed')
    l.noteOn(60, 100, 10)
    expect(l.state).toBe('recFirst')
    l.noteOff(60, 10.5)
    l.stop(12)
    expect(l.state).toBe('playing')
    expect(l.loopLength).toBeCloseTo(2)
    expect(l.loopStart).toBe(10)
    expect(l.layers).toHaveLength(1)
    expect(l.layers[0].notes[0]).toMatchObject({ pitch: 60, start: 0, dur: 0.5 })
  })

  it('discards recordings shorter than the minimum', () => {
    const l = new Looper()
    l.rec(piano, 0)
    l.noteOn(60, 100, 1)
    l.stop(1.2)
    expect(l.state).toBe('empty')
    expect(l.loopLength).toBeNull()
    expect(l.layers).toHaveLength(0)
  })

  it('stop while armed returns to empty', () => {
    const l = new Looper()
    l.rec(piano, 0)
    l.stop(1)
    expect(l.state).toBe('empty')
  })

  it('cancel discards the first recording', () => {
    const l = new Looper()
    l.rec(piano, 0)
    l.noteOn(60, 100, 1)
    l.cancel()
    expect(l.state).toBe('empty')
    expect(l.layers).toHaveLength(0)
    expect(l.loopLength).toBeNull()
  })

  it('auto-stops after the maximum first recording time', () => {
    const l = new Looper()
    l.rec(piano, 0)
    l.noteOn(60, 100, 1)
    l.tick(302)
    expect(l.state).toBe('playing')
    expect(l.loopLength).toBe(300)
  })

  it('a note held across Stop continues into the loop and is finalised on release', () => {
    const l = new Looper()
    l.rec(piano, 0)
    l.noteOn(60, 100, 10)
    l.stop(12) // still held
    const note = l.layers[0].notes[0]
    l.noteOff(60, 12.5)
    expect(note.dur).toBeCloseTo(2) // 2.5 s held, capped at the 2 s loop length
    const l2 = new Looper()
    l2.rec(piano, 0)
    l2.noteOn(60, 100, 10)
    l2.noteOn(62, 100, 11)
    l2.stop(12)
    l2.noteOff(62, 12.3)
    expect(l2.layers[0].notes.find((n) => n.pitch === 62)!.dur).toBeCloseTo(1.3)
  })
})

describe('overdub', () => {
  it('records at loop positions and wraps', () => {
    const l = withFirstLayer(2)
    l.rec(bass, 13)
    expect(l.state).toBe('overdub')
    l.noteOn(64, 90, 13.5) // position 1.5
    l.noteOff(64, 13.6)
    l.noteOn(65, 90, 14.2) // next cycle, position 0.2
    l.noteOff(65, 14.3)
    l.stop(14.4)
    expect(l.state).toBe('playing')
    expect(l.layers).toHaveLength(2)
    const notes = l.layers[1].notes
    expect(notes.map((n) => n.pitch).sort()).toEqual([64, 65])
    expect(notes.find((n) => n.pitch === 64)!.start).toBeCloseTo(1.5)
    expect(notes.find((n) => n.pitch === 65)!.start).toBeCloseTo(0.2)
    expect(l.layers[1].instrument.name).toBe('Bass')
  })

  it('cancel keeps playing and discards the layer', () => {
    const l = withFirstLayer()
    l.rec(bass, 13)
    l.noteOn(64, 90, 13.5)
    l.cancel()
    expect(l.state).toBe('playing')
    expect(l.layers).toHaveLength(1)
  })

  it('rec from stopped restarts playback at the loop start', () => {
    const l = withFirstLayer()
    l.stop(13)
    expect(l.state).toBe('stopped')
    l.rec(bass, 20)
    expect(l.state).toBe('overdub')
    expect(l.loopStart).toBe(20)
  })

  it('merges repeated notes across passes', () => {
    const l = withFirstLayer(2)
    l.rec(bass, 12)
    l.noteOn(64, 60, 12.5)
    l.noteOff(64, 12.6)
    l.noteOn(64, 110, 14.51) // same position next pass
    l.noteOff(64, 14.6)
    l.stop(15)
    expect(l.layers[1].notes).toHaveLength(1)
    expect(l.layers[1].notes[0].velocity).toBe(110)
  })

  it('records sustain spans', () => {
    const l = withFirstLayer(2)
    l.rec(bass, 12)
    l.sustain(true, 12.5)
    l.sustain(false, 13)
    l.stop(13.1)
    expect(l.layers[1].sustain[0].start).toBeCloseTo(0.5)
    expect(l.layers[1].sustain[0].dur).toBeCloseTo(0.5)
  })
})

describe('undo / redo / delete (spec §7)', () => {
  it('undo and redo are cumulative', () => {
    const l = withFirstLayer()
    overdub(l, 12)
    overdub(l, 13)
    l.undo()
    l.undo()
    expect(l.layers).toHaveLength(1)
    l.redo()
    expect(l.layers).toHaveLength(2)
  })

  it('a new committed recording clears redo, a cancelled one keeps it', () => {
    const l = withFirstLayer()
    overdub(l, 12)
    l.undo()
    l.rec(bass, 13)
    l.cancel()
    expect(l.canRedo).toBe(true)
    overdub(l, 14)
    expect(l.canRedo).toBe(false)
  })

  it('rule 1: deleted layers never come back through redo', () => {
    const l = withFirstLayer() // id 1
    overdub(l, 12) // 2
    overdub(l, 13) // 3
    overdub(l, 14) // 4
    overdub(l, 15) // 5
    l.deleteLayer(3)
    const ids = () => l.layers.map((x) => x.id)
    expect(ids()).toEqual([1, 2, 4, 5])
    l.undo()
    l.undo()
    l.undo()
    l.undo()
    expect(ids()).toEqual([])
    expect(l.canUndo).toBe(false)
    l.redo()
    l.redo()
    l.redo()
    l.redo()
    expect(ids()).toEqual([1, 2, 4, 5])
  })

  it('rule 3: deleting layer 1 keeps the loop length', () => {
    const l = withFirstLayer(2)
    overdub(l, 12)
    l.deleteLayer(1)
    expect(l.loopLength).toBeCloseTo(2)
  })

  it('rule 4: empty with redo keeps length; empty without redo resets', () => {
    const l = withFirstLayer(2)
    l.undo()
    expect(l.state).toBe('empty')
    expect(l.loopLength).toBeCloseTo(2)
    l.redo()
    expect(l.state).toBe('stopped')
    l.deleteLayer(1)
    expect(l.loopLength).toBeNull()
  })

  it('rule 4: recording from empty-with-redo defines a new length and clears redo', () => {
    const l = withFirstLayer(2)
    l.undo()
    l.rec(piano, 20)
    expect(l.state).toBe('armed')
    l.noteOn(60, 100, 21)
    l.stop(24)
    expect(l.loopLength).toBeCloseTo(3)
    expect(l.canRedo).toBe(false)
  })

  it('undo/redo are disabled while recording', () => {
    const l = withFirstLayer()
    l.rec(bass, 12)
    expect(l.canUndo).toBe(false)
    l.undo()
    expect(l.layers).toHaveLength(1)
  })

  it('respects the layer limit', () => {
    const l = withFirstLayer()
    l.layerLimit = 2
    overdub(l, 12)
    expect(l.canRecord).toBe(false)
    l.rec(bass, 13)
    expect(l.state).toBe('playing')
  })
})

describe('mute / solo', () => {
  it('solo wins over non-solo, mute removes', () => {
    const l = withFirstLayer()
    overdub(l, 12)
    overdub(l, 13)
    l.updateLayer(2, { solo: true })
    expect(l.audibleLayers().map((x) => x.id)).toEqual([2])
    l.updateLayer(2, { solo: false, muted: true })
    expect(l.audibleLayers().map((x) => x.id)).toEqual([1, 3])
  })
})

describe('mergeDuplicates', () => {
  it('treats positions near the loop boundary as the same point', () => {
    const merged = mergeDuplicates(
      [
        { pitch: 60, velocity: 50, start: 0.005, dur: 0.1 },
        { pitch: 60, velocity: 80, start: 1.99, dur: 0.1 },
      ],
      2,
    )
    expect(merged).toHaveLength(1)
    expect(merged[0].velocity).toBe(80)
  })
})
