import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'preact/hooks'
import { AudioEngine, MAX_LAYERS } from '../audio/engine'
import { type Instrument, type Layer, Looper } from '../model/looper'
import { InstrumentSelect } from './InstrumentSelect'
import { Keyboard } from './Keyboard'
import { TOTAL_WHITES, whiteIndex } from './keys'
import { LoopStrip, layerColor } from './LoopStrip'
import { NavBar } from './NavBar'

const SOUNDFONT_FILE = `${import.meta.env.BASE_URL}soundfonts/MuseScore_General.sf3`
/** VITE_SOUNDFONT_PARTS > 0 loads the soundfont split into .part0, .part1… (see scripts/split-soundfont.mjs). */
const SOUNDFONT_PARTS = Number(import.meta.env.VITE_SOUNDFONT_PARTS || 0)
/** Extra extension for hosts that only serve known file types. */
const PART_SUFFIX = import.meta.env.VITE_SOUNDFONT_PART_SUFFIX || ''
const SOUNDFONT_URLS = SOUNDFONT_PARTS
  ? Array.from({ length: SOUNDFONT_PARTS }, (_, i) => `${SOUNDFONT_FILE}.part${i}${PART_SUFFIX}`)
  : [SOUNDFONT_FILE]
const DEFAULT_INSTRUMENT: Instrument = { program: 0, bankMSB: 0, drums: false, name: 'Grand Piano' }
/** Smallest comfortable white key on touch screens: about 7 mm (spec §12). */
const MIN_KEY_PX_TOUCH = 26
const MIN_KEY_PX_MOUSE = 12

type Phase = { kind: 'loading'; progress: number } | { kind: 'ready' } | { kind: 'running' } | { kind: 'error'; message: string }

export function App() {
  const looper = useMemo(() => new Looper(MAX_LAYERS), [])
  const engine = useMemo(() => new AudioEngine(looper), [looper])
  const [, bump] = useReducer((n: number) => n + 1, 0)
  const rerender = useCallback(() => bump(undefined), [])
  const [phase, setPhase] = useState<Phase>({ kind: 'loading', progress: 0 })
  const [instrument, setInstrument] = useState<Instrument>(DEFAULT_INSTRUMENT)
  const [sustain, setSustain] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [view, setView] = useState({ start: whiteIndex(48), whites: 15 }) // C3 upward, ~2 octaves
  const [maxWhites, setMaxWhites] = useState(TOTAL_WHITES)
  const [loadSeconds, setLoadSeconds] = useState(0)

  useEffect(() => looper.subscribe(rerender), [looper])

  useEffect(() => {
    const t0 = performance.now()
    engine
      .load(SOUNDFONT_URLS, (progress) => setPhase({ kind: 'loading', progress }))
      .then(() => {
        setLoadSeconds((performance.now() - t0) / 1000)
        const piano = engine.presets.find((p) => !p.drums && p.program === 0 && p.bankMSB === 0)
        if (piano) setInstrument({ ...piano })
        setPhase({ kind: 'ready' })
      })
      .catch((e: Error) => setPhase({ kind: 'error', message: e.message }))
  }, [engine])

  useEffect(() => {
    if (phase.kind === 'running') engine.setLiveInstrument(instrument)
  }, [engine, instrument, phase.kind])

  // Largest zoom-out keeps white keys at a playable width.
  useEffect(() => {
    const update = () => {
      const minPx = matchMedia('(pointer: fine)').matches ? MIN_KEY_PX_MOUSE : MIN_KEY_PX_TOUCH
      const max = Math.min(TOTAL_WHITES, Math.floor(window.innerWidth / minPx))
      setMaxWhites(max)
      setView((v) => ({ ...v, whites: Math.min(v.whites, max) }))
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // Keep the info line (latency, voices, memory) fresh.
  useEffect(() => {
    const id = setInterval(rerender, 500)
    return () => clearInterval(id)
  }, [])

  const start = async () => {
    await engine.resume()
    engine.setLiveInstrument(instrument)
    try {
      await (navigator as Navigator & { wakeLock?: { request: (t: string) => Promise<unknown> } }).wakeLock?.request('screen')
    } catch {
      // Wake lock is a convenience; ignore refusals.
    }
    setPhase({ kind: 'running' })
  }

  const chooseInstrument = (i: Instrument) => {
    setInstrument(i)
    if (i.drums) setView((v) => ({ ...v, start: Math.max(0, whiteIndex(35) - 1) }))
  }

  const now = useCallback(() => engine.now, [engine])
  const noteOn = useCallback((p: number, v: number) => engine.liveNoteOn(p, v), [engine])
  const noteOff = useCallback((p: number) => engine.liveNoteOff(p), [engine])

  const toggleSustain = () => {
    const next = !sustain
    setSustain(next)
    engine.liveSustain(next)
  }

  // Leaving the app stops playback and cancels a recording (spec §18).
  const stateRef = useRef(looper)
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState !== 'hidden') return
      const l = stateRef.current
      l.cancel()
      if (l.isPlaying) l.stop(engine.now)
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [engine])

  if (phase.kind !== 'running') {
    return (
      <div class="splash">
        <h1>Piano Loop Station</h1>
        <p class="sub">Prototype</p>
        {phase.kind === 'loading' && <p>Loading sounds… {Math.round(phase.progress * 100)}%</p>}
        {phase.kind === 'error' && <p class="error">{phase.message}</p>}
        {phase.kind === 'ready' && (
          <button type="button" class="big" onClick={start}>
            Tap to start
          </button>
        )}
      </div>
    )
  }

  const s = looper.state
  const recording = looper.isRecording
  const lat = engine.latencyMs
  const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory

  return (
    <div class="app">
      <div class="topbar">
        <button
          type="button"
          class={`t rec${recording ? ' on' : ''}${s === 'armed' ? ' armed' : ''}`}
          disabled={!looper.canRecord}
          onClick={() => looper.rec(instrument, engine.now)}
        >
          ● Rec
        </button>
        <button type="button" class="t" disabled={s !== 'stopped'} onClick={() => looper.play(engine.now)}>
          ▶ Play
        </button>
        <button type="button" class="t" disabled={s === 'empty' || s === 'stopped'} onClick={() => looper.stop(engine.now)}>
          ■ Stop
        </button>
        {recording && (
          <button type="button" class="t cancel" onClick={() => looper.cancel()}>
            ✕ Cancel
          </button>
        )}
        <button type="button" class="t" disabled={!looper.canUndo} onClick={() => looper.undo()} title="Undo recording">
          ↶ Undo rec
        </button>
        <button type="button" class="t" disabled={!looper.canRedo} onClick={() => looper.redo()} title="Redo recording">
          ↷ Redo rec
        </button>
        <button type="button" class={`t${sustain ? ' sus-on' : ''}`} onClick={toggleSustain}>
          Sustain
        </button>
        <InstrumentSelect presets={engine.presets} value={instrument} onChange={chooseInstrument} />
        <span class="info">
          {stateLabel(s)} · {looper.layers.length}/{MAX_LAYERS} layers
          {looper.loopLength ? ` · ${looper.loopLength.toFixed(2)} s` : ''} · latency {lat.base}+{lat.output} ms · voices{' '}
          {engine.voiceCount} · load {loadSeconds.toFixed(1)} s{mem ? ` · heap ${Math.round(mem.usedJSHeapSize / 1e6)} MB` : ''}
        </span>
      </div>

      <LoopStrip looper={looper} now={now} onTap={() => setPanelOpen(!panelOpen)} />

      {panelOpen && (
        <div class="panel">
          {looper.layers.length === 0 && <p class="hint">No layers yet. Press Rec and play.</p>}
          {looper.layers.map((layer, i) => (
            <LayerRow key={layer.id} layer={layer} index={i} looper={looper} engine={engine} />
          ))}
        </div>
      )}

      <NavBar
        startWhite={view.start}
        visibleWhites={view.whites}
        minWhites={7}
        maxWhites={maxWhites}
        onChange={(start, whites) => setView({ start, whites })}
      />
      <Keyboard startWhite={view.start} visibleWhites={view.whites} drums={instrument.drums} onNoteOn={noteOn} onNoteOff={noteOff} />
    </div>
  )
}

function LayerRow({ layer, index, looper, engine }: { layer: Layer; index: number; looper: Looper; engine: AudioEngine }) {
  const [volOpen, setVolOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  return (
    <div class="layer">
      <span class="dot" style={{ background: layerColor(index) }} />
      <span class="num">{index + 1}</span>
      <InstrumentSelect
        presets={engine.presets}
        value={layer.instrument}
        onChange={(instrument) => {
          engine.silenceLayer(layer.id)
          looper.updateLayer(layer.id, { instrument })
        }}
      />
      <button
        type="button"
        class={`small${layer.muted ? ' on' : ''}`}
        onClick={() => {
          engine.silenceLayer(layer.id)
          looper.updateLayer(layer.id, { muted: !layer.muted })
        }}
      >
        M
      </button>
      <button
        type="button"
        class={`small${layer.solo ? ' on' : ''}`}
        onClick={() => {
          for (const l of looper.layers) engine.silenceLayer(l.id)
          looper.updateLayer(layer.id, { solo: !layer.solo })
        }}
      >
        S
      </button>
      <button type="button" class="small vol" onClick={() => setVolOpen(!volOpen)} title="Volume">
        {Math.round(layer.volume * 100)}
      </button>
      {volOpen && (
        <div class="vol-pop">
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(layer.volume * 100)}
            onInput={(e) => looper.updateLayer(layer.id, { volume: Number((e.currentTarget as HTMLInputElement).value) / 100 })}
          />
          <button type="button" class="small" onClick={() => setVolOpen(false)}>
            OK
          </button>
        </div>
      )}
      {confirmDelete ? (
        <>
          <button
            type="button"
            class="small danger"
            onClick={() => {
              engine.silenceLayer(layer.id)
              looper.deleteLayer(layer.id)
            }}
          >
            Delete
          </button>
          <button type="button" class="small" onClick={() => setConfirmDelete(false)}>
            Keep
          </button>
        </>
      ) : (
        <button type="button" class="small del" onClick={() => setConfirmDelete(true)} title="Delete layer (cannot be undone)">
          🗑
        </button>
      )}
    </div>
  )
}

function stateLabel(s: Looper['state']): string {
  return {
    empty: 'Empty',
    armed: 'Waiting for first note',
    recFirst: 'Recording',
    playing: 'Playing',
    overdub: 'Overdubbing',
    stopped: 'Stopped',
  }[s]
}
