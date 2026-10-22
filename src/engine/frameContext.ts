import type { Box } from './sizing'
import type { Design, FrameNode, Member, Profile } from './types'

/** Everything a joint method needs to see about the laid-out frame. */
export interface Frame {
  design: Design
  profile: Profile
  ext: Box
  members: Member[]
  nodes: FrameNode[]
  member(id: string): Member
}

export function makeFrame(
  design: Design,
  profile: Profile,
  ext: Box,
  members: Member[],
  nodes: FrameNode[],
): Frame {
  const byId = new Map(members.map((m) => [m.id, m]))
  return {
    design,
    profile,
    ext,
    members,
    nodes,
    member(id) {
      const m = byId.get(id)
      if (!m) throw new Error(`unknown member ${id}`)
      return m
    },
  }
}
