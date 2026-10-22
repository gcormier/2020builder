import { MATERIALS, formatLength, type Build } from '../engine'
import { describeEnds, describeHoles } from './describe'

// Output blocks shared by the on-screen tabs and the printed plan.

interface HoverProps {
  hover?: string | null
  setHover?: (g: string | null) => void
}

export function Swatch({ color }: { color: string }) {
  return <span className="swatch" style={{ background: color }} />
}

export function Messages({ build }: { build: Build }) {
  return (
    <>
      {build.errors.length > 0 && (
        <ul className="msgs error">
          {build.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {build.notes.length > 0 && (
        <ul className="msgs info">
          {build.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      {build.warnings.length > 0 && (
        <ul className="msgs warn">
          {build.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
    </>
  )
}

export function CutListTable({ build, hover, setHover }: { build: Build } & HoverProps) {
  const u = build.design.units
  const fmt = (mm: number) => formatLength(mm, u)
  const pieces = build.groups.reduce((n, g) => n + g.qty, 0)
  return (
    <table>
      <thead>
        <tr>
          <th>Part</th>
          <th className="num">Qty</th>
          <th className="num">Length</th>
          <th>Ends</th>
          <th>Holes</th>
          <th>Used as</th>
        </tr>
      </thead>
      <tbody>
        {build.groups.map((g) => (
          <tr
            key={g.label}
            className={hover === g.label ? 'hot' : ''}
            onMouseEnter={setHover && (() => setHover(g.label))}
            onMouseLeave={setHover && (() => setHover(null))}
          >
            <td>
              <Swatch color={g.color} /> <b>{g.label}</b>
            </td>
            <td className="num">{g.qty}</td>
            <td className="num">
              <b>{fmt(g.length)}</b>
            </td>
            <td>{describeEnds(g, u)}</td>
            <td>
              {describeHoles(g, u).map((h) => (
                <div key={h}>{h}</div>
              ))}
              {g.holes.length === 0 && '—'}
            </td>
            <td className="muted">{[...new Set(g.names.map((x) => x.split(',')[0]))].join(', ')}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td>Total</td>
          <td className="num">{pieces}</td>
          <td className="num">{fmt(build.nesting.totalCutLength)}</td>
          <td colSpan={3} />
        </tr>
      </tfoot>
    </table>
  )
}

export function HardwareTable({ build }: { build: Build }) {
  const spares = build.design.hardwareSpares
  return (
    <table>
      <thead>
        <tr>
          <th className="num">Qty</th>
          {spares > 0 && <th className="num">Buy (+{spares}%)</th>}
          <th>Hardware</th>
        </tr>
      </thead>
      <tbody>
        {build.hardware.map((h) => (
          <tr key={h.key}>
            <td className="num">{h.qty}</td>
            {spares > 0 && (
              <td className="num">
                <b>{h.buy}</b>
              </td>
            )}
            <td>{h.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function ToolsList({ build }: { build: Build }) {
  return (
    <ul className="tools">
      {build.tools.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  )
}

export function StockSummary({ build }: { build: Build }) {
  const n = build.nesting
  const fmt = (mm: number) => formatLength(mm, build.design.units)
  return (
    <p>
      <b>{n.bars.length}</b> bar{n.bars.length === 1 ? '' : 's'} of {fmt(n.stockLength)} · cut length {fmt(n.totalCutLength)} · offcut +
      kerf {fmt(n.totalStock - n.totalCutLength)} ({n.totalStock ? Math.round((n.totalCutLength / n.totalStock) * 100) : 0}% used)
    </p>
  )
}

export function StockBars({ build, hover, setHover }: { build: Build } & HoverProps) {
  const n = build.nesting
  const { kerf, trim } = build.design.stock
  const fmt = (mm: number) => formatLength(mm, build.design.units)
  const colorOf = new Map(build.groups.map((g) => [g.label, g.color]))
  return (
    <div>
      {n.bars.map((bar, i) => (
        <div className="bar-row" key={i}>
          <span className="bar-label">Bar {i + 1}</span>
          <div className="bar">
            {trim > 0 && <span className="seg trim" style={{ flexBasis: `${(trim / n.stockLength) * 100}%` }} />}
            {bar.cuts.map((c, j) => {
              const pct = ((c.length + kerf) / n.stockLength) * 100
              return (
                <span
                  key={j}
                  className={`seg ${hover === c.group ? 'hot' : ''}`}
                  title={`${c.group}: ${fmt(c.length)}`}
                  style={{ flexBasis: `${pct}%`, background: colorOf.get(c.group) }}
                  onMouseEnter={setHover && (() => setHover(c.group))}
                  onMouseLeave={setHover && (() => setHover(null))}
                >
                  {pct < 9 ? c.group : `${c.group} ${fmt(c.length)}`}
                </span>
              )
            })}
            <span className="seg rest">{fmt(bar.remaining)}</span>
          </div>
        </div>
      ))}
      {n.oversize.length > 0 && (
        <p className="msgs error">Won’t fit any bar: {n.oversize.map((c) => `${c.group} ${fmt(c.length)}`).join(', ')}</p>
      )}
    </div>
  )
}

export function StepsList({ build }: { build: Build }) {
  return (
    <ol className="steps">
      {build.steps.map((s) => (
        <li key={s}>{s}</li>
      ))}
    </ol>
  )
}

export function DiagonalTable({ build }: { build: Build }) {
  const fmt = (mm: number) => formatLength(mm, build.design.units)
  return (
    <table>
      <thead>
        <tr>
          <th>Face</th>
          <th className="num">Diagonal</th>
        </tr>
      </thead>
      <tbody>
        {build.diagonals.map((d) => (
          <tr key={d.face}>
            <td>
              {d.face}{' '}
              <span className="muted">
                ({fmt(d.a)} × {fmt(d.b)})
              </span>
            </td>
            <td className="num">
              <b>{fmt(d.length)}</b>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function PanelTable({ build }: { build: Build }) {
  if (!build.panelGroups.length) return null
  const fmt = (mm: number) => formatLength(mm, build.design.units)
  const area = build.panelGroups.reduce((n, g) => n + g.qty * g.width * g.height, 0)
  return (
    <table className="panels-table">
      <thead>
        <tr>
          <th>Panel</th>
          <th className="num">Qty</th>
          <th className="num">Size</th>
          <th className="num">Thick</th>
          <th>Material</th>
          <th>Corner notch</th>
          <th>Faces</th>
        </tr>
      </thead>
      <tbody>
        {build.panelGroups.map((g) => (
          <tr key={g.label}>
            <td>
              <Swatch color={MATERIALS[g.material].color} /> <b>{g.label}</b>
            </td>
            <td className="num">{g.qty}</td>
            <td className="num">
              <b>
                {fmt(g.width)} × {fmt(g.height)}
              </b>
            </td>
            <td className="num">{fmt(g.thickness)}</td>
            <td>{MATERIALS[g.material].name}</td>
            <td>{g.cornerNotch ? `${fmt(g.cornerNotch)} square, all 4 corners` : '—'}</td>
            <td className="muted">{g.faces.join(', ')}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td>Total</td>
          <td className="num">{build.panelGroups.reduce((n, g) => n + g.qty, 0)}</td>
          <td className="num">
            {build.design.units === 'mm' ? `${(area / 1e6).toFixed(2)} m²` : `${(area / 645.16 / 144).toFixed(2)} ft²`}
          </td>
          <td colSpan={4} />
        </tr>
      </tfoot>
    </table>
  )
}
