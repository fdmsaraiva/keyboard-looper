// Computer keyboard as a piano (spec §15). Keys are matched by physical
// position (KeyboardEvent.code), so the layout works on any keyboard language.
// Each row continues to its right end, so the two rows overlap by a few notes:
//
//   lower:  Z S X D C V G B H N J M , L . ; /          →  C … E  (base … base + 16)
//   upper:  Q 2 W 3 E R 5 T 6 Y 7 U I 9 O 0 P [ = ]    →  C … G  (base + 12 … base + 31)
//
// (Characters as on a US layout; other layouts use the keys in the same places.)
// The base follows the on-screen keyboard: Z is the lowest C fully visible.

import { useEffect, useRef, useState } from 'preact/hooks'
import { HIGHEST, LOWEST, whiteIndex } from './keys'

/** Semitone offset from the base C for every playing key. */
const OFFSETS: Record<string, number> = {
  // lower row (white keys) with the home row above it (black keys)
  KeyZ: 0, KeyS: 1, KeyX: 2, KeyD: 3, KeyC: 4, KeyV: 5, KeyG: 6, KeyB: 7, KeyH: 8, KeyN: 9, KeyJ: 10, KeyM: 11,
  Comma: 12, KeyL: 13, Period: 14, Semicolon: 15, Slash: 16,
  // upper row (white keys) with the number row above it (black keys)
  KeyQ: 12, Digit2: 13, KeyW: 14, Digit3: 15, KeyE: 16, KeyR: 17, Digit5: 18, KeyT: 19, Digit6: 20, KeyY: 21,
  Digit7: 22, KeyU: 23, KeyI: 24, Digit9: 25, KeyO: 26, Digit0: 27, KeyP: 28, BracketLeft: 29, Equal: 30, BracketRight: 31,
}

const US_LABELS: Record<string, string> = {
  Comma: ',', Period: '.', Semicolon: ';', Slash: '/', BracketLeft: '[', Equal: '=', BracketRight: ']',
}

export const COMPUTER_KEY_VELOCITY = 100

const defaultLabel = (code: string) => US_LABELS[code] ?? code.replace(/^(Key|Digit)/, '')

/**
 * Labels for the playing keys as printed on this computer's keyboard, where the
 * browser can tell (Chrome/Edge); otherwise US-layout characters.
 */
export function useKeyLabels(): (code: string) => string {
  const [layout, setLayout] = useState<Map<string, string> | null>(null)
  useEffect(() => {
    const kb = (navigator as Navigator & { keyboard?: { getLayoutMap?: () => Promise<Map<string, string>> } }).keyboard
    kb?.getLayoutMap?.().then(setLayout, () => {})
  }, [])
  return (code) => (layout?.get(code) ?? defaultLabel(code)).toUpperCase()
}

/** Label shown on each on-screen key that a computer key plays, for the given base. */
export function keyHints(base: number, label: (code: string) => string = defaultLabel): Record<number, string> {
  const hints: Record<number, string> = {}
  for (const code of Object.keys(OFFSETS)) {
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
  const offset = OFFSETS[code]
  if (offset === undefined) return null
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
      for (const pitch of new Set(held.values())) ref.current.actions.noteOff(pitch)
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
        // Both rows can play the same note; only the first key down sounds it.
        const alreadyHeld = [...held.values()].includes(pitch)
        held.set(e.code, pitch)
        if (!alreadyHeld) a.noteOn(pitch, COMPUTER_KEY_VELOCITY)
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
      if (![...held.values()].includes(pitch)) ref.current.actions.noteOff(pitch)
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
