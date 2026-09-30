// Computer keyboard as a piano (spec §15). Keys are matched by physical
// position (KeyboardEvent.code), so the layout works on any keyboard language.
//
//   lower octave:  Z S X D C V G B H N J M ,     →  C … C (base octave)
//   upper octave:  Q 2 W 3 E R 5 T 6 Y 7 U I 9 O 0 P  →  C … E (base + 1)
//
// The base follows the on-screen keyboard: Z is the lowest C fully visible.

import { useEffect, useRef } from 'preact/hooks'
import { HIGHEST, LOWEST, whiteIndex } from './keys'

const LOWER_ROW = ['KeyZ', 'KeyS', 'KeyX', 'KeyD', 'KeyC', 'KeyV', 'KeyG', 'KeyB', 'KeyH', 'KeyN', 'KeyJ', 'KeyM', 'Comma']
const UPPER_ROW = ['KeyQ', 'Digit2', 'KeyW', 'Digit3', 'KeyE', 'KeyR', 'Digit5', 'KeyT', 'Digit6', 'KeyY', 'Digit7', 'KeyU', 'KeyI', 'Digit9', 'KeyO', 'Digit0', 'KeyP']

export const COMPUTER_KEY_VELOCITY = 100

/** Letter shown on each on-screen key that a computer key plays, for the given base. */
export function keyHints(base: number): Record<number, string> {
  const label = (code: string) => (code === 'Comma' ? ',' : code.replace(/^(Key|Digit)/, ''))
  const hints: Record<number, string> = {}
  for (const code of [...LOWER_ROW, ...UPPER_ROW]) {
    const pitch = pitchForCode(code, base)
    if (pitch !== null) hints[pitch] = pitch in hints ? `${hints[pitch]}/${label(code)}` : label(code)
  }
  return hints
}
export const MIN_BASE = 24 // C1
export const MAX_BASE = 96 // C7

/** The C that Z plays: the lowest C whose key is fully visible from `startWhite`. */
export function baseForView(startWhite: number): number {
  for (let c = MIN_BASE; c <= MAX_BASE; c += 12) {
    if (whiteIndex(c) >= startWhite - 0.01) return c
  }
  return MAX_BASE
}

/** MIDI pitch for a key code with the lower row starting at `base` (a C), or null. */
export function pitchForCode(code: string, base: number): number | null {
  let offset = LOWER_ROW.indexOf(code)
  if (offset < 0) {
    const upper = UPPER_ROW.indexOf(code)
    if (upper < 0) return null
    offset = 12 + upper
  }
  const pitch = base + offset
  return pitch >= LOWEST && pitch <= HIGHEST ? pitch : null
}

export interface ComputerKeyboardActions {
  noteOn: (pitch: number, velocity: number) => void
  noteOff: (pitch: number) => void
  /** ←/→: move the on-screen keyboard (and so the computer keys) an octave down/up. */
  octave: (direction: -1 | 1) => void
  rec: () => void
  playStop: () => void
  cancel: () => void
  undo: () => void
  redo: () => void
  sustain: () => void
}

/**
 * Listens to the physical keyboard. Returns nothing; `base` is the C at the
 * start of the lower row. Shortcuts: Enter = Rec, Space = Play/Stop,
 * Esc = Cancel, Ctrl/Cmd+Z = Undo recording, Ctrl/Cmd+Shift+Z = Redo recording,
 * Tab = Sustain, ←/→ = octave down/up.
 */
export function useComputerKeyboard(enabled: boolean, base: number, actions: ComputerKeyboardActions) {
  const ref = useRef({ base, actions })
  ref.current = { base, actions }

  useEffect(() => {
    if (!enabled) return
    // code → pitch actually started, so a release matches its press even if the octave changed meanwhile.
    const held = new Map<string, number>()

    const releaseAll = () => {
      for (const pitch of held.values()) ref.current.actions.noteOff(pitch)
      held.clear()
    }

    const onDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.tagName === 'INPUT') return
      if (target?.tagName === 'SELECT') target.blur() // letters would otherwise jump through the list
      const { base: b, actions: a } = ref.current
      const mod = e.ctrlKey || e.metaKey

      if (mod && e.code === 'KeyZ') {
        e.preventDefault()
        if (!e.repeat) (e.shiftKey ? a.redo : a.undo)()
        return
      }
      if (mod || e.altKey) return

      const pitch = pitchForCode(e.code, b)
      if (pitch !== null) {
        e.preventDefault()
        if (e.repeat || held.has(e.code)) return
        held.set(e.code, pitch)
        a.noteOn(pitch, COMPUTER_KEY_VELOCITY)
        return
      }

      const shortcut: Record<string, () => void> = {
        Enter: a.rec,
        NumpadEnter: a.rec,
        Space: a.playStop,
        Escape: a.cancel,
        Tab: a.sustain,
        ArrowLeft: () => a.octave(-1),
        ArrowRight: () => a.octave(1),
      }
      const fn = shortcut[e.code]
      if (!fn) return
      e.preventDefault()
      if (!e.repeat) fn()
    }

    const onUp = (e: KeyboardEvent) => {
      const pitch = held.get(e.code)
      if (pitch === undefined) return
      held.delete(e.code)
      ref.current.actions.noteOff(pitch)
    }

    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', releaseAll)
    return () => {
      releaseAll()
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', releaseAll)
    }
  }, [enabled])
}
