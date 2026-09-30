import { useEffect, useRef, useState } from 'preact/hooks'
import type { AudioEngine } from '../audio/engine'
import type { Looper } from '../model/looper'
import { DEFAULT_GRID, MAX_BPM, MIN_BPM, TIME_SIGNATURES } from '../model/timing'

/**
 * Metronome and loop-length controls (spec §9, §11). The tempo grid can only be
 * changed while the idea is empty; the click sound can always be muted, which
 * keeps the grid. Turning the grid off is "free timing", with a warning.
 */
export function TimeBar({ looper, engine, rerender }: { looper: Looper; engine: AudioEngine; rerender: () => void }) {
  const grid = looper.grid
  const locked = looper.loopLength !== null || looper.isRecording
  const [confirmFree, setConfirmFree] = useState(false)
  const taps = useRef<number[]>([])

  const setBpm = (bpm: number) => {
    if (!grid) return
    looper.setGrid({ ...grid, bpm: Math.round(Math.min(MAX_BPM, Math.max(MIN_BPM, bpm))) })
  }

  const tap = () => {
    const now = performance.now()
    const recent = taps.current.filter((t) => now - t < 2500)
    recent.push(now)
    taps.current = recent
    if (recent.length >= 2) {
      const intervals = recent.slice(1).map((t, i) => t - recent[i])
      setBpm(60000 / (intervals.reduce((a, b) => a + b, 0) / intervals.length))
    }
  }

  return (
    <div class="timebar">
      <BeatLight engine={engine} />

      {grid ? (
        <>
          <button type="button" class="small" disabled={locked} onClick={() => setBpm(grid.bpm - 1)} aria-label="Slower">
            −
          </button>
          <span class="bpm" title={locked ? 'Tempo is fixed once the idea has a recording' : 'Beats per minute'}>
            {grid.bpm} BPM
          </span>
          <button type="button" class="small" disabled={locked} onClick={() => setBpm(grid.bpm + 1)} aria-label="Faster">
            +
          </button>
          <button type="button" class="small" disabled={locked} onClick={tap}>
            Tap
          </button>
          <select
            class="small-select"
            disabled={locked}
            value={`${grid.signature.beats}/${grid.signature.unit}`}
            onChange={(e) => {
              const sig = TIME_SIGNATURES.find((t) => `${t.beats}/${t.unit}` === (e.currentTarget as HTMLSelectElement).value)
              if (sig) looper.setGrid({ ...grid, signature: sig })
            }}
          >
            {TIME_SIGNATURES.map((t) => (
              <option key={`${t.beats}/${t.unit}`} value={`${t.beats}/${t.unit}`}>
                {t.beats}/{t.unit}
              </option>
            ))}
          </select>
          <select
            class="small-select"
            value={looper.countInBars}
            onChange={(e) => {
              looper.countInBars = Number((e.currentTarget as HTMLSelectElement).value)
              rerender()
            }}
            title="Count-in before recording"
          >
            {[0, 1, 2].map((n) => (
              <option key={n} value={n}>
                Count-in {n}
              </option>
            ))}
          </select>
          <button
            type="button"
            class={`small${engine.clickOn ? ' on' : ''}`}
            onClick={() => {
              engine.clickOn = !engine.clickOn
              rerender()
            }}
            title="Click sound (the beat light always shows)"
          >
            Click
          </button>
          {!locked &&
            (confirmFree ? (
              <span class="warn">
                Free timing: no quantize or bar snapping for this idea.{' '}
                <button
                  type="button"
                  class="small danger"
                  onClick={() => {
                    looper.setGrid(null)
                    setConfirmFree(false)
                  }}
                >
                  Turn off
                </button>
                <button type="button" class="small" onClick={() => setConfirmFree(false)}>
                  Keep
                </button>
              </span>
            ) : (
              <button type="button" class="small" onClick={() => setConfirmFree(true)}>
                Free timing
              </button>
            ))}
        </>
      ) : (
        <>
          <span class="warn">Free timing (no metronome, no quantize)</span>
          {!locked && (
            <button type="button" class="small" onClick={() => looper.setGrid({ ...DEFAULT_GRID })}>
              Use metronome
            </button>
          )}
        </>
      )}

      <span class="spacer" />
      <span class="len" title="Length the next recording gets, in base loops">
        Loop ×{looper.multiple}
      </span>
      <button type="button" class="small" disabled={!looper.canShrink} onClick={() => looper.extendLoop(-1)} aria-label="One loop shorter">
        −1
      </button>
      <button type="button" class="small" disabled={!looper.canExtend} onClick={() => looper.extendLoop(1)} aria-label="One loop longer">
        +1
      </button>
    </div>
  )
}

/** Visual metronome: bar.beat, flashing on each beat (accented on beat 1). Redraws itself every frame. */
function BeatLight({ engine }: { engine: AudioEngine }) {
  const [label, setLabel] = useState('–.–')
  const [flash, setFlash] = useState<'' | ' flash' | ' flash accent'>('')
  useEffect(() => {
    let raf = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const pos = engine.beatPosition()
      setLabel(!pos ? '–.–' : pos.bar <= 0 ? `In ${pos.beat}` : `${pos.bar}.${pos.beat}`)
      setFlash(pos && pos.phase < 0.2 ? (pos.beat === 1 ? ' flash accent' : ' flash') : '')
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [engine])
  return (
    <span class={`beat${flash}`} title="Bar.beat">
      {label}
    </span>
  )
}
