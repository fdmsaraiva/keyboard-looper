import { useRef } from 'preact/hooks'
import { KEYS, TOTAL_WHITES } from './keys'

interface Props {
  startWhite: number
  visibleWhites: number
  minWhites: number
  maxWhites: number
  onChange: (startWhite: number, visibleWhites: number) => void
}

/**
 * Miniature of the whole keyboard with a window marking the visible part.
 * One finger drags the window; two fingers pinch to zoom. The keys themselves
 * are only for playing (spec §12).
 */
export function NavBar({ startWhite, visibleWhites, minWhites, maxWhites, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const pointers = useRef(new Map<number, number>()) // pointerId → clientX
  const pinch = useRef<{ dist: number; whites: number } | null>(null)
  const drag = useRef<{ x: number; start: number } | null>(null)

  const clamp = (start: number, whites: number) => {
    const w = Math.min(maxWhites, Math.max(minWhites, whites))
    const s = Math.min(TOTAL_WHITES - w, Math.max(0, start))
    onChange(s, w)
  }

  const whitesPerPx = () => TOTAL_WHITES / (ref.current?.clientWidth || 1)

  return (
    <div class="navbar">
      <button type="button" class="zoom" onClick={() => clamp(startWhite - 1, visibleWhites + 2)} aria-label="Zoom out">
        −
      </button>
      <div
        ref={ref}
        class="nav-track"
        onPointerDown={(e) => {
          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
          pointers.current.set(e.pointerId, e.clientX)
          if (pointers.current.size === 1) {
            // Tapping outside the window jumps there; inside it starts a drag.
            const rect = ref.current!.getBoundingClientRect()
            const at = (e.clientX - rect.left) * whitesPerPx()
            const start = at < startWhite || at > startWhite + visibleWhites ? at - visibleWhites / 2 : startWhite
            if (start !== startWhite) clamp(start, visibleWhites)
            drag.current = { x: e.clientX, start }
          } else if (pointers.current.size === 2) {
            const [a, b] = [...pointers.current.values()]
            pinch.current = { dist: Math.abs(a - b) || 1, whites: visibleWhites }
            drag.current = null
          }
        }}
        onPointerMove={(e) => {
          if (!pointers.current.has(e.pointerId)) return
          pointers.current.set(e.pointerId, e.clientX)
          if (pinch.current && pointers.current.size >= 2) {
            const [a, b] = [...pointers.current.values()]
            const whites = pinch.current.whites * (Math.abs(a - b) / pinch.current.dist)
            const center = startWhite + visibleWhites / 2
            clamp(center - whites / 2, whites)
          } else if (drag.current) {
            clamp(drag.current.start + (e.clientX - drag.current.x) * whitesPerPx(), visibleWhites)
          }
        }}
        onPointerUp={(e) => {
          pointers.current.delete(e.pointerId)
          if (pointers.current.size < 2) pinch.current = null
          if (pointers.current.size === 0) drag.current = null
        }}
        onPointerCancel={(e) => pointers.current.delete(e.pointerId)}
      >
        {KEYS.filter((k) => k.black).map((k) => (
          <div key={k.pitch} class="nav-black" style={{ left: `${((k.white + 0.7) / TOTAL_WHITES) * 100}%` }} />
        ))}
        <div
          class="nav-window"
          style={{
            left: `${(startWhite / TOTAL_WHITES) * 100}%`,
            width: `${(visibleWhites / TOTAL_WHITES) * 100}%`,
          }}
        />
      </div>
      <button type="button" class="zoom" onClick={() => clamp(startWhite + 1, visibleWhites - 2)} aria-label="Zoom in">
        +
      </button>
    </div>
  )
}
