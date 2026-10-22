import { formatLength, type Build, type CutGroup } from '../engine'
import { describeEnds, describeHoles } from '../ui/describe'
import { Swatch } from '../ui/sections'

const W = 660
const STRIP = 22
const ZONE_PX = 230

function needsMachining(g: CutGroup): boolean {
  return g.holes.length > 0 || g.ends.some(Boolean)
}

/** One group's part drawing: ends to scale, broken in the middle when long. */
function PartDiagram({ g, build }: { g: CutGroup; build: Build }) {
  const fmt = (mm: number) => formatLength(mm, build.design.units)
  const L = g.length
  const maxOffset = Math.max(0, ...g.holes.map((h) => h.offset), ...g.ends.map((t) => t?.depth ?? 0))
  const zoneMM = Math.max(40, maxOffset + 25)
  const broken = L > 2 * zoneMM + 30
  const zs = broken ? ZONE_PX / zoneMM : W / L
  // mm from end 0 → px
  const X = (mm: number) => (!broken ? mm * zs : mm <= zoneMM ? mm * zs : W - (L - mm) * zs)

  const roles = [...new Set(g.holes.map((h) => h.faceRole))].sort()
  const strips: { label: string; role: number | null }[] = roles.length
    ? roles.map((r) => ({ label: `Face ${r}`, role: r }))
    : [{ label: 'Any face', role: null }]
  const rowH = STRIP + 34
  const H = strips.length * rowH + 30
  const P = build.profile.size

  return (
    <svg className="part" width="100%" viewBox={`-60 0 ${W + 70} ${H}`}>
      {strips.map((s, i) => {
        const y = 20 + i * rowH
        const holes = g.holes.filter((h) => s.role === null || h.faceRole === s.role)
        return (
          <g key={s.label}>
            <text x={-56} y={y + STRIP / 2 + 4} className="strip-label">
              {s.label}
            </text>
            {broken ? (
              <>
                <rect x={0} y={y} width={ZONE_PX} height={STRIP} className="stock" />
                <rect x={W - ZONE_PX} y={y} width={ZONE_PX} height={STRIP} className="stock" />
                <path d={`M ${ZONE_PX} ${y} l 6 ${STRIP / 3} l -6 ${STRIP / 3} l 6 ${STRIP / 3}`} className="break" />
                <path d={`M ${W - ZONE_PX} ${y} l -6 ${STRIP / 3} l 6 ${STRIP / 3} l -6 ${STRIP / 3}`} className="break" />
                {i === 0 && (
                  <text x={W / 2} y={y + STRIP / 2 + 4} textAnchor="middle" className="len">
                    {fmt(L)} overall
                  </text>
                )}
              </>
            ) : (
              <>
                <rect x={0} y={y} width={W} height={STRIP} className="stock" />
                {i === 0 && (
                  <text x={W / 2} y={y - 6} textAnchor="middle" className="len">
                    {fmt(L)} overall
                  </text>
                )}
              </>
            )}
            {/* centre line of the slot on this face */}
            <line x1={0} x2={W} y1={y + STRIP / 2} y2={y + STRIP / 2} className="center" />
            {g.ends.map((t, end) => {
              if (!t) return null
              const x0 = end === 0 ? 0 : W
              const x1 = end === 0 ? X(t.depth) : W - t.depth * zs
              return (
                <g key={`t${end}`}>
                  <line x1={x0} x2={x1} y1={y + STRIP / 2} y2={y + STRIP / 2} className="tap" />
                  {i === strips.length - 1 && (
                    <text x={end === 0 ? 2 : W - 2} y={y + STRIP + 14} textAnchor={end === 0 ? 'start' : 'end'} className="note">
                      Tap {t.thread}, {fmt(t.depth)} deep
                    </text>
                  )}
                </g>
              )
            })}
            {holes.map((h, j) => {
              const pos = h.end === 0 ? h.offset : L - h.offset
              const cx = X(pos)
              const r = Math.max((h.diameter / 2) * zs, 3)
              const ex = h.end === 0 ? 0 : W
              return (
                <g key={j}>
                  <circle cx={cx} cy={y + STRIP / 2} r={r} className="hole" />
                  <g className="dim">
                    <line x1={ex} x2={cx} y1={y - 5} y2={y - 5} markerStart="url(#arrow)" markerEnd="url(#arrow)" />
                    <line x1={cx} x2={cx} y1={y - 8} y2={y + 2} />
                    <text x={(ex + cx) / 2} y={y - 8} textAnchor="middle">
                      {fmt(h.offset)}
                    </text>
                  </g>
                  {i === strips.length - 1 && j === 0 && h.end === 0 && (
                    <text x={cx + r + 4} y={y + STRIP + 14} className="note">
                      Ø{h.diameter} mm
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        )
      })}
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 2 L 10 5 L 0 8 z" fill="#333" />
        </marker>
      </defs>
      <text x={W} y={H - 4} textAnchor="end" className="note muted">
        {broken ? `Ends drawn to scale; ${fmt(P)} profile` : `Drawn to scale; ${fmt(P)} profile`}
      </text>
    </svg>
  )
}

export function MachiningSheet({ build }: { build: Build }) {
  const u = build.design.units
  const machined = build.groups.filter(needsMachining)
  const cutOnly = build.groups.filter((g) => !needsMachining(g))
  const notes = [...new Set(build.groups.flatMap((g) => g.holes.map((h) => h.note)))]

  return (
    <div className="machining">
      {machined.map((g) => (
        <section key={g.label} className="part-block">
          <h3>
            <Swatch color={g.color} /> {g.label} — {[...new Set(g.names.map((x) => x.split(',')[0]))].join(', ')} ×{g.qty} · cut{' '}
            {formatLength(g.length, u)}
          </h3>
          <ul>
            {describeEnds(g, u) !== '—' && <li>{describeEnds(g, u)}</li>}
            {describeHoles(g, u).map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
          <PartDiagram g={g} build={build} />
        </section>
      ))}
      {cutOnly.length > 0 && (
        <p>
          <b>Cut only, no machining:</b> {cutOnly.map((g) => `${g.label} (${formatLength(g.length, u)} ×${g.qty})`).join(', ')}
        </p>
      )}
      {notes.length > 0 && (
        <p className="hint">
          Hole notes: {notes.join('; ')}. Faces 1 and 2 are two adjacent faces that end up on the outside of the frame.
        </p>
      )}
    </div>
  )
}
