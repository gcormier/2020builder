import { useState } from 'react'
import { formatLength, type Build } from '../engine'
import { describeEnds, describeHoles } from './describe'

interface Props {
  build: Build
  hover: string | null
  setHover: (g: string | null) => void
}

const TABS = ['Cut list', 'Hardware & tools', 'Stock', 'Assembly'] as const
type Tab = (typeof TABS)[number]

function Swatch({ color }: { color: string }) {
  return <span className="swatch" style={{ background: color }} />
}

export function OutputTabs({ build, hover, setHover }: Props) {
  const [tab, setTab] = useState<Tab>('Cut list')
  const u = build.design.units
  const fmt = (mm: number) => formatLength(mm, u)
  const colorOf = new Map(build.groups.map((g) => [g.label, g.color]))
  const pieces = build.groups.reduce((n, g) => n + g.qty, 0)
  const n = build.nesting
  const waste = n.totalStock - n.totalCutLength

  return (
    <section className="outputs">
      {build.errors.length > 0 && (
        <ul className="msgs error">
          {build.errors.map((e) => (
            <li key={e}>{e}</li>
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

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </nav>

      <div className="tab-body">
        {tab === 'Cut list' && (
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
                  onMouseEnter={() => setHover(g.label)}
                  onMouseLeave={() => setHover(null)}
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
                <td className="num">{fmt(n.totalCutLength)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        )}

        {tab === 'Hardware & tools' && (
          <div className="cols">
            <table>
              <thead>
                <tr>
                  <th className="num">Qty</th>
                  <th>Hardware</th>
                </tr>
              </thead>
              <tbody>
                {build.hardware.map((h) => (
                  <tr key={h.key}>
                    <td className="num">
                      <b>{h.qty}</b>
                    </td>
                    <td>{h.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div>
              <h3>Tools</h3>
              <ul className="tools">
                {build.tools.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {tab === 'Stock' && (
          <div>
            <p>
              <b>{n.bars.length}</b> bar{n.bars.length === 1 ? '' : 's'} of {fmt(n.stockLength)} · cut length {fmt(n.totalCutLength)} ·
              offcut + kerf {fmt(waste)} ({n.totalStock ? Math.round((n.totalCutLength / n.totalStock) * 100) : 0}% used)
            </p>
            {n.bars.map((bar, i) => (
              <div className="bar-row" key={i}>
                <span className="bar-label">Bar {i + 1}</span>
                <div className="bar">
                  {build.design.stock.trim > 0 && (
                    <span className="seg trim" style={{ flexBasis: `${(build.design.stock.trim / n.stockLength) * 100}%` }} />
                  )}
                  {bar.cuts.map((c, j) => (
                    <span
                      key={j}
                      className={`seg ${hover === c.group ? 'hot' : ''}`}
                      title={`${c.group}: ${fmt(c.length)}`}
                      style={{
                        flexBasis: `${((c.length + build.design.stock.kerf) / n.stockLength) * 100}%`,
                        background: colorOf.get(c.group),
                      }}
                      onMouseEnter={() => setHover(c.group)}
                      onMouseLeave={() => setHover(null)}
                    >
                      {c.group} {fmt(c.length)}
                    </span>
                  ))}
                  <span className="seg rest">{fmt(bar.remaining)}</span>
                </div>
              </div>
            ))}
            {n.oversize.length > 0 && (
              <p className="msgs error">
                Won’t fit any bar: {n.oversize.map((c) => `${c.group} ${fmt(c.length)}`).join(', ')}
              </p>
            )}
          </div>
        )}

        {tab === 'Assembly' && (
          <div className="cols">
            <ol className="steps">
              {build.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <div>
              <h3>Diagonal check</h3>
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
              <p className="hint">Outside corner to outside corner. Faces 1 and 2 on drilled parts are the two adjacent faces that end up on the outside of the frame.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
