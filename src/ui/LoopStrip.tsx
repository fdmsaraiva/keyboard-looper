import { useEffect, useRef } from 'preact/hooks'
import type { Looper } from '../model/looper'

export const LAYER_COLORS = ['#f59e0b', '#38bdf8', '#a78bfa', '#34d399', '#f472b6', '#facc15', '#60a5fa', '#fb7185']

export const layerColor = (index: number) => LAYER_COLORS[index % LAYER_COLORS.length]

/**
 * Thin loop visualisation: each layer is a lane with its notes drawn in its
 * colour (muted layers faded) and a moving playhead. Tapping it toggles the
 * layers panel (spec §8.2).
 */
export function LoopStrip({ looper, now, onTap }: { looper: Looper; now: () => number; onTap: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let raf = 0
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const c = canvas.current
      if (!c) return
      const dpr = window.devicePixelRatio || 1
      const w = c.clientWidth
      const h = c.clientHeight
      if (c.width !== w * dpr || c.height !== h * dpr) {
        c.width = w * dpr
        c.height = h * dpr
      }
      const g = c.getContext('2d')!
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, w, h)
      const len = looper.loopLength
      if (!len) {
        if (looper.state === 'recFirst' || looper.state === 'armed') {
          g.fillStyle = '#ef4444'
          g.globalAlpha = 0.25 + 0.2 * Math.sin(now() * 6)
          g.fillRect(0, 0, w, h)
          g.globalAlpha = 1
        }
        return
      }
      const layers = looper.layers
      const lanes = Math.max(1, layers.length + (looper.recordingLayer ? 1 : 0))
      const laneH = h / lanes
      const audible = new Set(looper.audibleLayers().map((l) => l.id))
      layers.forEach((layer, i) => {
        g.globalAlpha = audible.has(layer.id) ? 1 : 0.25
        g.fillStyle = layerColor(i)
        const pitches = layer.notes.map((n) => n.pitch)
        const lo = Math.min(...pitches)
        const span = Math.max(1, Math.max(...pitches) - lo)
        for (const n of layer.notes) {
          const y = i * laneH + (1 - (n.pitch - lo) / span) * (laneH - 3)
          const x = (n.start / len) * w
          const nw = Math.max(2, (n.dur / len) * w)
          g.fillRect(x, y, Math.min(nw, w - x), 2)
          if (x + nw > w) g.fillRect(0, y, x + nw - w, 2) // wraps around the loop end
        }
      })
      g.globalAlpha = 1
      if (looper.isPlaying) {
        const x = (looper.position(now()) / len) * w
        g.fillStyle = looper.state === 'overdub' ? '#ef4444' : '#e5e7eb'
        g.fillRect(x - 1, 0, 2, h)
      }
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [looper, now])

  return <canvas ref={canvas} class="strip" onClick={onTap} />
}
