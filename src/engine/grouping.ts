import type { CutGroup, Hole, Member, TapPrep } from './types'

export const GROUP_COLORS = [
  '#4e79a7',
  '#f28e2b',
  '#59a14f',
  '#e15759',
  '#76b7b2',
  '#edc948',
  '#b07aa1',
  '#ff9da7',
  '#9c755f',
  '#bab0ac',
]

const r = (n: number) => Math.round(n * 10) / 10

function endSig(tap: TapPrep | null, holes: Hole[], swapRoles: boolean): string {
  const t = tap ? `T${tap.thread}/${r(tap.depth)}` : '-'
  const h = holes
    .map((x) => `${r(x.offset)}@${swapRoles ? 3 - x.faceRole : x.faceRole}:${r(x.diameter)}`)
    .sort()
    .join(',')
  return `${t}[${h}]`
}

/**
 * Identity of a part as it leaves the shop. Members are interchangeable if they
 * match after flipping end-for-end or swapping which outer face is "1".
 */
export function partSignature(m: Member): string {
  const variants: string[] = []
  for (const flip of [false, true]) {
    for (const swap of [false, true]) {
      const e0 = endSig(m.ends[0], m.holes.filter((h) => h.end === 0), swap)
      const e1 = endSig(m.ends[1], m.holes.filter((h) => h.end === 1), swap)
      variants.push(flip ? `${e1}|${e0}` : `${e0}|${e1}`)
    }
  }
  return `${r(m.length)}|${variants.sort()[0]}`
}

/** Collapse identical members into cut-list groups A, B, C… (longest first). Sets member.group. */
export function groupMembers(members: Member[]): CutGroup[] {
  const bySig = new Map<string, Member[]>()
  for (const m of members) {
    const sig = partSignature(m)
    bySig.set(sig, [...(bySig.get(sig) ?? []), m])
  }
  const sorted = [...bySig.entries()].sort(
    ([sa, a], [sb, b]) => b[0].length - a[0].length || sa.localeCompare(sb),
  )
  return sorted.map(([, ms], i) => {
    const label = String.fromCharCode(65 + i)
    for (const m of ms) m.group = label
    const rep = ms[0]
    return {
      label,
      length: rep.length,
      qty: ms.length,
      memberIds: ms.map((m) => m.id),
      names: ms.map((m) => m.name),
      ends: rep.ends,
      holes: rep.holes,
      color: GROUP_COLORS[i % GROUP_COLORS.length],
    }
  })
}
