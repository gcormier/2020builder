import { useState } from 'react'
import { formatNumber, fromDisplay, unitLabel, type Units } from '../engine'

interface Props {
  label: string
  /** Value in mm. */
  value: number
  onChange: (mm: number) => void
  /** Display unit for lengths; omit for fixed-mm hardware sizes. */
  units?: Units
  suffix?: string
  step?: number
  min?: number
}

/** Length input that shows the selected unit but always reports mm. */
export function NumberField({ label, value, onChange, units, suffix, step, min = 0 }: Props) {
  const display = units ? formatNumber(value, units) : String(value)
  // While editing, keep the raw text so unit conversion doesn't fight the user's typing.
  const [draft, setDraft] = useState<string | null>(null)

  return (
    <label className="field">
      <span>{label}</span>
      <span className="input-wrap">
        <input
          type="number"
          inputMode="decimal"
          value={draft ?? display}
          step={step ?? (units === 'in' ? 0.125 : 1)}
          min={min}
          onFocus={() => setDraft(display)}
          onBlur={() => setDraft(null)}
          onChange={(e) => {
            setDraft(e.target.value)
            const n = parseFloat(e.target.value)
            if (Number.isFinite(n)) onChange(units ? fromDisplay(n, units) : n)
          }}
        />
        <span className="suffix">{suffix ?? (units ? unitLabel(units) : '')}</span>
      </span>
    </label>
  )
}
