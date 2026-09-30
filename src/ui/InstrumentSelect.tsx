import { memo } from 'preact/compat'
import type { Preset } from '../audio/engine'
import type { Instrument } from '../model/looper'

export const instrumentKey = (i: { drums: boolean; bankMSB: number; program: number }) =>
  `${i.drums ? 'd' : 'm'}:${i.bankMSB}:${i.program}`

/** Quick picks for the four priority groups (spec §14): piano, bass, drums, synth. */
const QUICK: { label: string; drums: boolean; program: number }[] = [
  { label: 'Piano', drums: false, program: 0 },
  { label: 'E. Piano', drums: false, program: 4 },
  { label: 'Bass', drums: false, program: 33 },
  { label: 'Synth Bass', drums: false, program: 38 },
  { label: 'Drums', drums: true, program: 0 },
  { label: 'Saw Lead', drums: false, program: 81 },
  { label: 'Synth Pad', drums: false, program: 89 },
]

/** Memoised: the lists have ~300 options and must not be rebuilt on unrelated redraws. */
export const InstrumentSelect = memo(function InstrumentSelect({
  presets,
  value,
  onChange,
}: {
  presets: Preset[]
  value: Instrument
  onChange: (i: Instrument) => void
}) {
  const byKey = new Map(presets.map((p) => [instrumentKey(p), p]))
  const quick = QUICK.map((q) => ({ q, p: presets.find((p) => p.drums === q.drums && p.program === q.program && (q.drums || p.bankMSB === 0)) })).filter(
    (x) => x.p,
  )
  return (
    <select
      class="instrument"
      value={instrumentKey(value)}
      onChange={(e) => {
        const p = byKey.get((e.currentTarget as HTMLSelectElement).value)
        if (p) onChange({ ...p })
      }}
    >
      <optgroup label="Quick">
        {quick.map(({ q, p }) => (
          <option key={`q${q.label}`} value={instrumentKey(p!)}>
            ★ {q.label} — {p!.name}
          </option>
        ))}
      </optgroup>
      <optgroup label="Instruments">
        {presets
          .filter((p) => !p.drums)
          .map((p) => (
            <option key={instrumentKey(p)} value={instrumentKey(p)}>
              {p.program + 1}. {p.name}
              {p.bankMSB ? ` (bank ${p.bankMSB})` : ''}
            </option>
          ))}
      </optgroup>
      <optgroup label="Drum kits">
        {presets
          .filter((p) => p.drums)
          .map((p) => (
            <option key={instrumentKey(p)} value={instrumentKey(p)}>
              {p.name}
            </option>
          ))}
      </optgroup>
    </select>
  )
},
// onChange handlers are recreated on every parent redraw but do the same thing,
// so only the preset list and the selected instrument decide a redraw.
(a, b) => a.presets === b.presets && instrumentKey(a.value) === instrumentKey(b.value))
