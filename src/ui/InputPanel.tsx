import {
  JOINT_METHODS,
  PROFILES,
  formatLength,
  getProfile,
  recommendedBlindOptions,
  type Axis,
  type BlindJointOptions,
  type Build,
  type Design,
  type Sizing,
  type Units,
} from '../engine'
import { NumberField } from './NumberField'

interface Props {
  design: Design
  build: Build
  update: (fn: (d: Design) => Design) => void
}

const OWNER_LABELS: Record<Axis, string> = {
  z: 'Uprights run full height',
  x: 'Width rails run full width',
  y: 'Depth rails run full depth',
}

const SCREW_LENGTHS = [8, 10, 12, 14, 16, 20]

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: [T, string][]
  onChange: (v: T) => void
}) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map(([v, label]) => (
        <button key={v} role="radio" aria-checked={v === value} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  )
}

/** Switch sizing mode while keeping the same physical frame. */
function convertSizing(s: Sizing, mode: Sizing['mode'], P: number): Sizing {
  if (s.mode === mode) return s
  if (mode === 'interior') {
    const clearance = 0
    const sub = 2 * P + 2 * clearance
    return { mode, w: s.w - sub, d: s.d - sub, h: s.h - sub, clearance }
  }
  const add = 2 * P + 2 * (s.mode === 'interior' ? s.clearance : 0)
  return { mode, w: s.w + add, d: s.d + add, h: s.h + add }
}

export function InputPanel({ design, build, update }: Props) {
  const u = design.units
  const s = design.sizing
  const blind = design.jointOptions.blind
  const profile = getProfile(design.profileId)
  const P = profile.size
  const setSizing = (patch: Partial<Sizing>) => update((d) => ({ ...d, sizing: { ...d.sizing, ...patch } as Sizing }))
  const setBlind = (patch: Partial<BlindJointOptions>) =>
    update((d) => ({ ...d, jointOptions: { ...d.jointOptions, blind: { ...d.jointOptions.blind, ...patch } } }))
  const setStock = (patch: Partial<Design['stock']>) => update((d) => ({ ...d, stock: { ...d.stock, ...patch } }))
  const fmt = (mm: number) => formatLength(mm, u)

  return (
    <aside className="panel">
      <header className="brand">
        <h1>2020 Builder</h1>
        <Segmented<Units>
          value={u}
          options={[
            ['mm', 'mm'],
            ['in', 'in'],
          ]}
          onChange={(units) => update((d) => ({ ...d, units }))}
        />
      </header>

      <section>
        <label className="field">
          <span>Name</span>
          <input type="text" value={design.name} onChange={(e) => update((d) => ({ ...d, name: e.target.value }))} />
        </label>
      </section>

      <section>
        <h2>Size</h2>
        <Segmented<Sizing['mode']>
          value={s.mode}
          options={[
            ['exterior', 'Exterior'],
            ['interior', 'Interior + clearance'],
          ]}
          onChange={(mode) => update((d) => ({ ...d, sizing: convertSizing(d.sizing, mode, P) }))}
        />
        <div className="grid3">
          <NumberField label="Width (X)" value={s.w} units={u} onChange={(w) => setSizing({ w })} />
          <NumberField label="Depth (Y)" value={s.d} units={u} onChange={(d) => setSizing({ d })} />
          <NumberField label="Height (Z)" value={s.h} units={u} onChange={(h) => setSizing({ h })} />
        </div>
        {s.mode === 'interior' && (
          <NumberField
            label="Clearance per side"
            value={s.clearance}
            units={u}
            onChange={(clearance) => setSizing({ clearance } as Partial<Sizing>)}
          />
        )}
        <dl className="summary">
          <dt>Exterior</dt>
          <dd>
            {fmt(build.exterior.w)} × {fmt(build.exterior.d)} × {fmt(build.exterior.h)}
          </dd>
          <dt>Interior</dt>
          <dd>
            {fmt(build.interior.w)} × {fmt(build.interior.d)} × {fmt(build.interior.h)}
          </dd>
        </dl>
      </section>

      <section>
        <h2>Profile</h2>
        <select
          value={design.profileId}
          onChange={(e) => {
            const next = getProfile(e.target.value)
            update((d) => {
              // A different end-tap thread invalidates screw / hole / tap choices.
              const sameThread = getProfile(d.profileId).endTap.nominal === next.endTap.nominal
              return {
                ...d,
                profileId: next.id,
                jointOptions: sameThread ? d.jointOptions : { ...d.jointOptions, blind: recommendedBlindOptions(next) },
              }
            })
          }}
        >
          {PROFILES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <p className="hint">
          End tap {profile.endTap.thread} into Ø{profile.centerBore} mm bore · slot {profile.slotOpening} mm. {profile.notes}
        </p>
      </section>

      <section>
        <h2>Corners</h2>
        <label className="field">
          <span>Joint method</span>
          <select
            value={design.jointMethod}
            onChange={(e) => update((d) => ({ ...d, jointMethod: e.target.value as Design['jointMethod'] }))}
          >
            {Object.values(JOINT_METHODS).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <p className="hint">{JOINT_METHODS[design.jointMethod].description}</p>
        <label className="field">
          <span>Corner ownership</span>
          <select value={design.cornerOwner} onChange={(e) => update((d) => ({ ...d, cornerOwner: e.target.value as Axis }))}>
            {(Object.keys(OWNER_LABELS) as Axis[]).map((a) => (
              <option key={a} value={a}>
                {OWNER_LABELS[a]}
              </option>
            ))}
          </select>
        </label>
        {design.jointMethod === 'blind' && (
          <div className="grid2">
            <label className="field">
              <span>Screw head</span>
              <select value={blind.headType} onChange={(e) => setBlind({ headType: e.target.value as BlindJointOptions['headType'] })}>
                <option value="BHCS">BHCS (button)</option>
                <option value="SHCS">SHCS (socket)</option>
              </select>
            </label>
            <label className="field">
              <span>Screw</span>
              <select value={blind.screwLength} onChange={(e) => setBlind({ screwLength: Number(e.target.value) })}>
                {SCREW_LENGTHS.map((l) => (
                  <option key={l} value={l}>
                    M{profile.endTap.nominal}×{l}
                  </option>
                ))}
              </select>
            </label>
            <NumberField label="Tap depth" value={blind.tapDepth} units={u} onChange={(tapDepth) => setBlind({ tapDepth })} />
            <NumberField
              label="Wrench hole drill"
              value={blind.wrenchHoleDiameter}
              suffix="mm"
              step={0.5}
              onChange={(wrenchHoleDiameter) => setBlind({ wrenchHoleDiameter })}
            />
          </div>
        )}
      </section>

      <section>
        <h2>Stock</h2>
        <div className="grid3">
          <NumberField label="Bar length" value={design.stock.length} units={u} onChange={(length) => setStock({ length })} />
          <NumberField label="Kerf" value={design.stock.kerf} units={u} step={u === 'in' ? 0.01 : 0.1} onChange={(kerf) => setStock({ kerf })} />
          <NumberField label="End trim" value={design.stock.trim} units={u} onChange={(trim) => setStock({ trim })} />
        </div>
      </section>
    </aside>
  )
}
