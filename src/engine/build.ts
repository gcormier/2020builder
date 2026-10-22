import { layoutFrame, type Ownership } from './frame'
import { makeFrame } from './frameContext'
import { groupMembers } from './grouping'
import { JOINT_METHODS } from './joints'
import { nestCuts } from './nesting'
import { getProfile } from './profiles'
import { exteriorOf, interiorOf } from './sizing'
import type { Build, Design, Diagonal } from './types'
import { formatLength } from './units'

function validate(design: Design, minExterior: number, ext: { w: number; d: number; h: number }): string[] {
  const errors: string[] = []
  const s = design.sizing
  for (const [k, v] of Object.entries({ width: s.w, depth: s.d, height: s.h })) {
    if (!Number.isFinite(v) || v <= 0) errors.push(`${k} must be a positive number`)
  }
  if (s.mode === 'interior' && (!Number.isFinite(s.clearance) || s.clearance < 0))
    errors.push('clearance must be zero or more')
  if (errors.length) return errors
  for (const [k, v] of Object.entries({ width: ext.w, depth: ext.d, height: ext.h })) {
    if (v < minExterior) errors.push(`exterior ${k} must be at least ${formatLength(minExterior, design.units)}`)
  }
  const st = design.stock
  if (!(st.length > 0) || !(st.kerf >= 0) || !(st.trim >= 0)) errors.push('stock length, kerf and trim must be valid')
  return errors
}

function diagonals(w: number, d: number, h: number): Diagonal[] {
  const diag = (face: string, a: number, b: number) => ({ face, a, b, length: Math.hypot(a, b) })
  return [diag('Front / back', w, h), diag('Left / right', d, h), diag('Top / bottom', w, d)]
}

export function buildFrame(design: Design): Build {
  const profile = getProfile(design.profileId)
  const P = profile.size
  const ext = exteriorOf(design.sizing, P)
  const interior = interiorOf(ext, P)
  const method = JOINT_METHODS[design.jointMethod]

  const empty: Build = {
    design,
    profile,
    exterior: ext,
    interior,
    members: [],
    panels: [],
    nodes: [],
    joints: [],
    groups: [],
    hardware: [],
    tools: [],
    steps: [],
    notes: [],
    diagonals: [],
    nesting: { stockLength: design.stock.length, bars: [], totalCutLength: 0, totalStock: 0, oversize: [] },
    warnings: [],
    errors: [],
  }

  // Shortest member must be at least one profile width long.
  const errors = validate(design, 3 * P, ext)
  if (errors.length) return { ...empty, errors }

  const ownership: Ownership =
    method.ownership === 'owner' ? { kind: 'owner', axis: design.cornerOwner } : { kind: 'cube', size: P }
  const { members, nodes } = layoutFrame(ext, P, ownership)
  const frame = makeFrame(design, profile, ext, members, nodes)

  const result = method.apply(frame)
  for (const op of result.ops) {
    const m = frame.member(op.memberId)
    if (op.kind === 'tap') m.ends[op.end] = op.tap
    else m.holes.push(op.hole)
  }

  const groups = groupMembers(members)
  const nesting = nestCuts(groups, design.stock)
  const warnings = [...result.warnings]
  if (nesting.oversize.length)
    warnings.push(
      `${nesting.oversize.length} cut(s) are longer than the usable stock (${formatLength(design.stock.length - design.stock.trim, design.units)}). Use longer stock.`,
    )

  return {
    ...empty,
    members,
    nodes,
    joints: result.joints,
    groups,
    hardware: result.hardware,
    tools: result.tools,
    steps: method.steps(frame, groups),
    notes: result.notes,
    diagonals: diagonals(ext.w, ext.d, ext.h),
    nesting,
    warnings,
  }
}
