import { AXES, MEMBER_NAMES, axisIndex, face, others, sideName } from './geometry'
import type { Box } from './sizing'
import type { Axis, FrameNode, Member, Side, Vec3 } from './types'

export type Ownership = { kind: 'owner'; axis: Axis } | { kind: 'cube'; size: number }

export const dimOf = (box: Box, a: Axis): number => (a === 'x' ? box.w : a === 'y' ? box.d : box.h)

export function memberId(axis: Axis, sa: Side, sb: Side): string {
  return `${axis}-${sa}${sb}`
}

/** Lay out the 12 edge members and 8 corner nodes of a box frame. */
export function layoutFrame(
  ext: Box,
  profileSize: number,
  ownership: Ownership,
): { members: Member[]; nodes: FrameNode[] } {
  const P = profileSize
  const members: Member[] = []

  for (const axis of AXES) {
    const [a, b] = others(axis)
    const reduction =
      ownership.kind === 'cube' ? ownership.size : ownership.axis === axis ? 0 : P
    for (const sa of [0, 1] as Side[]) {
      for (const sb of [0, 1] as Side[]) {
        const start: Vec3 = [0, 0, 0]
        start[axisIndex(axis)] = reduction
        start[axisIndex(a)] = sa === 0 ? 0 : dimOf(ext, a) - P
        start[axisIndex(b)] = sb === 0 ? 0 : dimOf(ext, b) - P
        members.push({
          id: memberId(axis, sa, sb),
          axis,
          name: `${MEMBER_NAMES[axis]}, ${sideName(a, sa)}-${sideName(b, sb)}`,
          start,
          length: dimOf(ext, axis) - 2 * reduction,
          outerFaces: [face(a, sa), face(b, sb)],
          ends: [null, null],
          holes: [],
          group: '',
        })
      }
    }
  }

  const nodes: FrameNode[] = []
  for (const sx of [0, 1] as Side[]) {
    for (const sy of [0, 1] as Side[]) {
      for (const sz of [0, 1] as Side[]) {
        const corner: [Side, Side, Side] = [sx, sy, sz]
        const at = (axis: Axis) => {
          const [a, b] = others(axis)
          return memberId(axis, corner[axisIndex(a)], corner[axisIndex(b)])
        }
        nodes.push({
          id: `n-${sx}${sy}${sz}`,
          corner,
          members: { x: at('x'), y: at('y'), z: at('z') },
          owner: ownership.kind === 'owner' ? ownership.axis : null,
        })
      }
    }
  }

  return { members, nodes }
}
