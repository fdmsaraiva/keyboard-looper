import { useEffect, useRef, useState } from 'preact/hooks'
import { DRUM_NAMES, KEYS, noteName } from './keys'

interface Props {
  /** Leftmost visible position, in white keys from A0 (may be fractional). */
  startWhite: number
  /** Number of white keys that fit in the width. */
  visibleWhites: number
  drums: boolean
  onNoteOn: (pitch: number, velocity: number) => void
  onNoteOff: (pitch: number) => void
}

const MIN_VELOCITY = 30

/**
 * Multi-touch piano. Every pointer is tracked on its own so chords work, and
 * sliding a finger across keys plays a glissando. Velocity comes from how far
 * down the key the finger lands (nearer the player = louder).
 */
export function Keyboard({ startWhite, visibleWhites, drums, onNoteOn, onNoteOff }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [down, setDown] = useState<ReadonlySet<number>>(new Set())
  const pointers = useRef(new Map<number, number>()) // pointerId → pitch
  const handlers = useRef({ onNoteOn, onNoteOff })
  handlers.current = { onNoteOn, onNoteOff }

  useEffect(() => {
    const el = ref.current!
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const refreshDown = () => setDown(new Set(pointers.current.values()))

  const keyAt = (x: number, y: number): { pitch: number; velocity: number } | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null
    const pitch = el?.dataset.pitch
    if (!el || pitch === undefined) return null
    const r = el.getBoundingClientRect()
    const depth = Math.min(1, Math.max(0, (y - r.top) / r.height))
    return { pitch: Number(pitch), velocity: Math.round(MIN_VELOCITY + (127 - MIN_VELOCITY) * depth) }
  }

  const press = (id: number, x: number, y: number) => {
    const hit = keyAt(x, y)
    const current = pointers.current.get(id)
    if (hit?.pitch === current) return
    if (current !== undefined) {
      pointers.current.delete(id)
      if (![...pointers.current.values()].includes(current)) handlers.current.onNoteOff(current)
    }
    if (hit) {
      pointers.current.set(id, hit.pitch)
      handlers.current.onNoteOn(hit.pitch, hit.velocity)
    }
    refreshDown()
  }

  const release = (id: number) => {
    const current = pointers.current.get(id)
    if (current === undefined) return
    pointers.current.delete(id)
    if (![...pointers.current.values()].includes(current)) handlers.current.onNoteOff(current)
    refreshDown()
  }

  const ww = width / visibleWhites
  const visible = KEYS.filter((k) => k.white >= Math.floor(startWhite) - 1 && k.white <= startWhite + visibleWhites + 1)

  return (
    <div
      ref={ref}
      class="keyboard"
      onPointerDown={(e) => {
        e.preventDefault()
        ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
        press(e.pointerId, e.clientX, e.clientY)
      }}
      onPointerMove={(e) => {
        if (pointers.current.has(e.pointerId)) press(e.pointerId, e.clientX, e.clientY)
      }}
      onPointerUp={(e) => release(e.pointerId)}
      onPointerCancel={(e) => release(e.pointerId)}
      onPointerLeave={(e) => release(e.pointerId)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {width > 0 &&
        visible.map((k) => {
          const left = k.black ? (k.white + 1 - startWhite) * ww - ww * 0.3 : (k.white - startWhite) * ww
          const label = drums ? DRUM_NAMES[k.pitch] : k.pitch % 12 === 0 ? noteName(k.pitch) : ''
          return (
            <div
              key={k.pitch}
              data-pitch={k.pitch}
              class={`key ${k.black ? 'black' : 'white'}${down.has(k.pitch) ? ' down' : ''}`}
              style={{ left: `${left}px`, width: `${k.black ? ww * 0.6 : ww}px` }}
            >
              {label && <span class="label">{label}</span>}
            </div>
          )
        })}
    </div>
  )
}
