import { describe, expect, it } from 'vitest'
import { baseForView, pitchForCode } from './computerKeyboard'
import { whiteIndex } from './keys'

describe('pitchForCode', () => {
  it('maps the lower row from the base C', () => {
    expect(pitchForCode('KeyZ', 48)).toBe(48) // C3
    expect(pitchForCode('KeyS', 48)).toBe(49) // C#3
    expect(pitchForCode('KeyM', 48)).toBe(59) // B3
    expect(pitchForCode('Comma', 48)).toBe(60) // C4
  })

  it('maps the upper row one octave higher', () => {
    expect(pitchForCode('KeyQ', 48)).toBe(60)
    expect(pitchForCode('Digit2', 48)).toBe(61)
    expect(pitchForCode('KeyP', 48)).toBe(76) // E5
  })

  it('ignores unmapped keys and pitches outside the piano', () => {
    expect(pitchForCode('KeyA', 48)).toBeNull()
    expect(pitchForCode('KeyP', 96)).toBeNull() // above C8
  })
})

describe('baseForView', () => {
  it('uses the lowest fully visible C', () => {
    expect(baseForView(whiteIndex(48))).toBe(48) // view starts exactly on C3
    expect(baseForView(whiteIndex(48) + 0.5)).toBe(60) // C3 half cut off → C4
    expect(baseForView(whiteIndex(50))).toBe(60) // view starts on D3
    expect(baseForView(0)).toBe(24) // A0: first C is C1
  })
})
