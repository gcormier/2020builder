import { formatLength, type Build, type Vec3 } from '../engine'

interface ViewSpec {
  title: string
  /** Engine axis index drawn left→right, bottom→top, and the viewing depth axis. */
  u: 0 | 1 | 2
  v: 0 | 1 | 2
  depth: 0 | 1 | 2
  /** True when the viewer sits on the +depth side (draw ascending depth). */
  nearMax: boolean
}

const VIEWS: ViewSpec[] = [
  { title: 'Front', u: 0, v: 2, depth: 1, nearMax: false },
  { title: 'Right side', u: 1, v: 2, depth: 0, nearMax: true },
  { title: 'Top', u: 0, v: 1, depth: 2, nearMax: true },
]

const M = 38 // margin for dimension lines
const ARROW = 'url(#arrow)'

interface Box {
  min: Vec3
  max: Vec3
  fill: string
  stroke: string
  label?: string
}

function HDim({ x1, x2, y, yRef, label }: { x1: number; x2: number; y: number; yRef: number; label: string }) {
  return (
    <g className="dim">
      <line x1={x1} y1={yRef} x2={x1} y2={y + (y > yRef ? 3 : -3)} />
      <line x1={x2} y1={yRef} x2={x2} y2={y + (y > yRef ? 3 : -3)} />
      <line x1={x1} y1={y} x2={x2} y2={y} markerStart={ARROW} markerEnd={ARROW} />
      <text x={(x1 + x2) / 2} y={y - 3} textAnchor="middle">
        {label}
      </text>
    </g>
  )
}

function VDim({ y1, y2, x, xRef, label }: { y1: number; y2: number; x: number; xRef: number; label: string }) {
  const cy = (y1 + y2) / 2
  return (
    <g className="dim">
      <line x1={xRef} y1={y1} x2={x + (x > xRef ? 3 : -3)} y2={y1} />
      <line x1={xRef} y1={y2} x2={x + (x > xRef ? 3 : -3)} y2={y2} />
      <line x1={x} y1={y1} x2={x} y2={y2} markerStart={ARROW} markerEnd={ARROW} />
      <text x={x - 3} y={cy} textAnchor="middle" transform={`rotate(-90 ${x - 3} ${cy})`}>
        {label}
      </text>
    </g>
  )
}

function extentOf(build: Build): Vec3 {
  const e = build.exterior
  return [e.w, e.d, e.h]
}

/** Dimensioned orthographic views at a shared scale. */
export function OrthoViews({ build }: { build: Build }) {
  const P = build.profile.size
  const fmt = (mm: number) => formatLength(mm, build.design.units)
  const ext = extentOf(build)
  const colorOf = new Map(build.groups.map((g) => [g.label, g.color]))
  // All three views share one scale and fit side by side on a 7.3 in printable width.
  const rowWidth = 660 - VIEWS.length * 2 * M - (VIEWS.length - 1) * 20
  const scale = Math.min(rowWidth / VIEWS.reduce((n, v) => n + ext[v.u], 0), ...VIEWS.map((v) => 170 / ext[v.v]))

  const boxes: Box[] = [
    ...build.panels.map((p) => ({ min: p.min, max: p.max, fill: '#cfe3f5', stroke: '#8fb3d6' })),
    ...build.members.map((m) => {
      const size: Vec3 = [P, P, P]
      size['xyz'.indexOf(m.axis)] = m.length
      return {
        min: m.start,
        max: m.start.map((s, k) => s + size[k]) as Vec3,
        fill: colorOf.get(m.group) ?? '#999',
        stroke: '#1d2126',
        label: m.group,
      }
    }),
  ]

  return (
    <div className="ortho">
      {VIEWS.map((v) => {
        const U = ext[v.u] * scale
        const V = ext[v.v] * scale
        const W = U + 2 * M
        const H = V + 2 * M
        const X = (mm: number) => M + mm * scale
        const Y = (mm: number) => M + V - mm * scale
        const sorted = [...boxes].sort((a, b) => (v.nearMax ? a.max[v.depth] - b.max[v.depth] : b.min[v.depth] - a.min[v.depth]))
        const inner = (n: number) => n - 2 * P
        return (
          <figure key={v.title}>
            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                  <path d="M 0 2 L 10 5 L 0 8 z" fill="#333" />
                </marker>
              </defs>
              {sorted.map((b, i) => {
                const x = X(b.min[v.u])
                const y = Y(b.max[v.v])
                const w = (b.max[v.u] - b.min[v.u]) * scale
                const h = (b.max[v.v] - b.min[v.v]) * scale
                return <rect key={i} x={x} y={y} width={w} height={h} fill={b.fill} stroke={b.stroke} strokeWidth={0.6} />
              })}
              <HDim x1={X(0)} x2={X(ext[v.u])} y={H - 12} yRef={Y(0)} label={fmt(ext[v.u])} />
              <HDim x1={X(P)} x2={X(ext[v.u] - P)} y={14} yRef={Y(ext[v.v])} label={fmt(inner(ext[v.u]))} />
              <VDim y1={Y(0)} y2={Y(ext[v.v])} x={14} xRef={X(0)} label={fmt(ext[v.v])} />
              <VDim y1={Y(P)} y2={Y(ext[v.v] - P)} x={W - 12} xRef={X(ext[v.u])} label={fmt(inner(ext[v.v]))} />
            </svg>
            <figcaption>{v.title}</figcaption>
          </figure>
        )
      })}
      <p className="hint">Outer dimensions bottom/left, clear opening between members top/right.</p>
    </div>
  )
}
