import { SCREW_LENGTHS, getProfile, type Design, type HeadType, type JointOptions } from '../engine'
import { NumberField } from './NumberField'

interface Props {
  design: Design
  update: (fn: (d: Design) => Design) => void
}

function HeadSelect({ value, onChange }: { value: HeadType; onChange: (v: HeadType) => void }) {
  return (
    <label className="field">
      <span>Screw head</span>
      <select value={value} onChange={(e) => onChange(e.target.value as HeadType)}>
        <option value="BHCS">BHCS (button)</option>
        <option value="SHCS">SHCS (socket)</option>
      </select>
    </label>
  )
}

function ScrewSelect({ size, value, onChange }: { size: number; value: number; onChange: (v: number) => void }) {
  const lengths = SCREW_LENGTHS.includes(value) ? SCREW_LENGTHS : [...SCREW_LENGTHS, value].sort((a, b) => a - b)
  return (
    <label className="field">
      <span>Screw</span>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {lengths.map((l) => (
          <option key={l} value={l}>
            M{size}×{l}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Options for the selected joint method. Hardware sizes stay in mm; positions follow the unit toggle. */
export function JointOptionsPanel({ design, update }: Props) {
  const u = design.units
  const d = getProfile(design.profileId).endTap.nominal
  const o = design.jointOptions
  const set = <K extends keyof JointOptions>(k: K, patch: Partial<JointOptions[K]>) =>
    update((dd) => ({ ...dd, jointOptions: { ...dd.jointOptions, [k]: { ...dd.jointOptions[k], ...patch } } }))

  switch (design.jointMethod) {
    case 'blind':
      return (
        <div className="grid2">
          <HeadSelect value={o.blind.headType} onChange={(headType) => set('blind', { headType })} />
          <ScrewSelect size={d} value={o.blind.screwLength} onChange={(screwLength) => set('blind', { screwLength })} />
          <NumberField label="Tap depth" value={o.blind.tapDepth} units={u} onChange={(tapDepth) => set('blind', { tapDepth })} />
          <NumberField
            label="Wrench hole drill"
            value={o.blind.wrenchHoleDiameter}
            suffix="mm"
            step={0.5}
            onChange={(wrenchHoleDiameter) => set('blind', { wrenchHoleDiameter })}
          />
        </div>
      )
    case 'bracket':
      return (
        <div className="grid2">
          <label className="field">
            <span>Screw size</span>
            <select value={o.bracket.screwSize} onChange={(e) => set('bracket', { screwSize: Number(e.target.value) as 4 | 5 | 6 })}>
              {[4, 5, 6].map((s) => (
                <option key={s} value={s}>
                  M{s}
                </option>
              ))}
            </select>
          </label>
          <ScrewSelect size={o.bracket.screwSize} value={o.bracket.screwLength} onChange={(screwLength) => set('bracket', { screwLength })} />
          <HeadSelect value={o.bracket.headType} onChange={(headType) => set('bracket', { headType })} />
          <label className="field">
            <span>T-nuts</span>
            <select value={o.bracket.tnut} onChange={(e) => set('bracket', { tnut: e.target.value as JointOptions['bracket']['tnut'] })}>
              <option value="drop-in">Drop-in / spring</option>
              <option value="slide-in">Slide-in</option>
            </select>
          </label>
          <NumberField
            label="Bracket thickness"
            value={o.bracket.bracketThickness}
            units={u}
            step={u === 'in' ? 0.01 : 0.5}
            onChange={(bracketThickness) => set('bracket', { bracketThickness })}
          />
        </div>
      )
    case 'through':
      return (
        <div className="grid2">
          <HeadSelect value={o.through.headType} onChange={(headType) => set('through', { headType })} />
          <ScrewSelect size={d} value={o.through.screwLength} onChange={(screwLength) => set('through', { screwLength })} />
          <NumberField label="Tap depth" value={o.through.tapDepth} units={u} onChange={(tapDepth) => set('through', { tapDepth })} />
          <NumberField
            label="Clearance drill"
            value={o.through.clearanceHole}
            suffix="mm"
            step={0.1}
            onChange={(clearanceHole) => set('through', { clearanceHole })}
          />
        </div>
      )
    case 'cube':
      return (
        <div className="grid2">
          <HeadSelect value={o.cube.headType} onChange={(headType) => set('cube', { headType })} />
          <ScrewSelect size={d} value={o.cube.screwLength} onChange={(screwLength) => set('cube', { screwLength })} />
          <NumberField label="Tap depth" value={o.cube.tapDepth} units={u} onChange={(tapDepth) => set('cube', { tapDepth })} />
          <NumberField label="Cube wall" value={o.cube.wall} units={u} step={u === 'in' ? 0.01 : 0.5} onChange={(wall) => set('cube', { wall })} />
        </div>
      )
    case 'hidden':
      return <p className="hint">No options — connectors come with their own set screws.</p>
  }
}
