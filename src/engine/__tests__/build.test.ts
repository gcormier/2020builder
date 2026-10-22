import { describe, expect, it } from 'vitest'
import { buildFrame } from '../build'
import { defaultDesign } from '../defaults'
import { recommendedBlindOptions } from '../joints/blind'
import { recommendedJointOptions } from '../joints/recommend'
import { nestCuts } from '../nesting'
import { getProfile } from '../profiles'
import { formatLength, fromDisplay } from '../units'
import type { Axis, Build, CutGroup, Design } from '../types'

/** Most tests pin the generic M5 profile so their geometry doesn't move with the app default. */
function design(patch: Partial<Design> = {}): Design {
  const m5 = getProfile('2020-t6')
  return {
    ...defaultDesign(),
    profileId: m5.id,
    jointOptions: recommendedJointOptions(m5),
    ...patch,
  }
}

describe('default design', () => {
  it('uses the IXGNIJ M6 profile with matching screw options and no warnings', () => {
    const d = defaultDesign()
    expect(d.profileId).toBe('2020-ixgnij-m6')
    expect(d.jointOptions.blind).toEqual(recommendedBlindOptions(getProfile('2020-ixgnij-m6')))
    const b = buildFrame(d)
    expect(b.errors).toEqual([])
    expect(b.warnings).toEqual([])
    expect(b.hardware[0].key).toBe('M6x12-BHCS')
  })
})

const lengthsByAxis = (b: Build, axis: Axis) =>
  [...new Set(b.members.filter((m) => m.axis === axis).map((m) => m.length))]

describe('sizing', () => {
  it('uses exterior dims directly', () => {
    const b = buildFrame(design())
    expect(b.exterior).toEqual({ w: 500, d: 400, h: 300 })
    expect(b.interior).toEqual({ w: 460, d: 360, h: 260 })
  })

  it('adds clearance and profile in interior mode', () => {
    const b = buildFrame(design({ sizing: { mode: 'interior', w: 400, d: 300, h: 200, clearance: 5 } }))
    expect(b.exterior).toEqual({ w: 450, d: 350, h: 250 })
    expect(b.interior).toEqual({ w: 410, d: 310, h: 210 })
  })

  it('rejects frames too small to build', () => {
    const b = buildFrame(design({ sizing: { mode: 'exterior', w: 50, d: 400, h: 300 } }))
    expect(b.errors.length).toBeGreaterThan(0)
    expect(b.members).toHaveLength(0)
  })

  it('rejects non-positive input', () => {
    expect(buildFrame(design({ sizing: { mode: 'exterior', w: 0, d: 400, h: 300 } })).errors).not.toHaveLength(0)
  })
})

describe('corner ownership', () => {
  it('Z owner: uprights full height, rails reduced by 2P', () => {
    const b = buildFrame(design({ cornerOwner: 'z' }))
    expect(b.members).toHaveLength(12)
    expect(lengthsByAxis(b, 'z')).toEqual([300])
    expect(lengthsByAxis(b, 'x')).toEqual([460])
    expect(lengthsByAxis(b, 'y')).toEqual([360])
  })

  it('X owner: width rails full, others reduced', () => {
    const b = buildFrame(design({ cornerOwner: 'x' }))
    expect(lengthsByAxis(b, 'x')).toEqual([500])
    expect(lengthsByAxis(b, 'y')).toEqual([360])
    expect(lengthsByAxis(b, 'z')).toEqual([260])
  })

  it('Y owner: depth rails full, others reduced', () => {
    const b = buildFrame(design({ cornerOwner: 'y' }))
    expect(lengthsByAxis(b, 'y')).toEqual([400])
    expect(lengthsByAxis(b, 'x')).toEqual([460])
    expect(lengthsByAxis(b, 'z')).toEqual([260])
  })

  it('members tile the box without overlapping', () => {
    for (const owner of ['x', 'y', 'z'] as Axis[]) {
      const b = buildFrame(design({ cornerOwner: owner }))
      const boxes = b.members.map((m) => {
        const i = 'xyz'.indexOf(m.axis)
        const size = [20, 20, 20]
        size[i] = m.length
        return { min: m.start, max: m.start.map((s, k) => s + size[k]) }
      })
      // Volume of the union equals the sum of parts: no two boxes intersect.
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const overlap = [0, 1, 2].every(
            (k) => Math.min(boxes[i].max[k], boxes[j].max[k]) - Math.max(boxes[i].min[k], boxes[j].min[k]) > 0,
          )
          expect(overlap, `${b.members[i].id} vs ${b.members[j].id} (owner ${owner})`).toBe(false)
        }
      // ...and everything stays inside the exterior box.
      for (const bx of boxes) {
        expect(Math.min(...bx.min)).toBeGreaterThanOrEqual(0)
        expect(bx.max[0]).toBeLessThanOrEqual(500)
        expect(bx.max[1]).toBeLessThanOrEqual(400)
        expect(bx.max[2]).toBeLessThanOrEqual(300)
      }
    }
  })
})

describe('blind joint', () => {
  const b = buildFrame(design({ cornerOwner: 'z' }))

  it('makes two joints per corner', () => {
    expect(b.joints).toHaveLength(16)
    expect(b.hardware).toEqual([
      expect.objectContaining({ key: 'M5x10-BHCS', qty: 16 }),
    ])
  })

  it('taps both ends of butting members only', () => {
    for (const m of b.members) {
      const tapped = m.ends.filter(Boolean).length
      expect(tapped).toBe(m.axis === 'z' ? 0 : 2)
    }
  })

  it('drills 2 wrench holes per owner end, on outer faces, P/2 from the end', () => {
    for (const m of b.members.filter((x) => x.axis === 'z')) {
      expect(m.holes).toHaveLength(4)
      for (const h of m.holes) {
        expect(h.offset).toBe(10)
        expect(m.outerFaces).toContain(h.face)
        expect(h.diameter).toBe(5)
      }
      expect(m.holes.filter((h) => h.end === 0).map((h) => h.faceRole).sort()).toEqual([1, 2])
    }
    for (const m of b.members.filter((x) => x.axis !== 'z')) expect(m.holes).toHaveLength(0)
  })

  it('puts screw heads inside the owner slot, pointing into the butting member', () => {
    const j = b.joints.find((x) => x.nodeId === 'n-000' && x.butting.startsWith('x'))!
    const f = j.fasteners[0]
    // Owner upright at x∈[0,20]; head sits behind the 1.8 mm lip on its +X face.
    expect(f.headCenter[0]).toBeCloseTo(20 - 1.8 - 2.75 / 2)
    expect(f.headCenter[1]).toBe(10)
    expect(f.headCenter[2]).toBe(10)
    expect(f.dir).toBe('+x')
  })

  it('warns when an SHCS head will not fit the slot', () => {
    const d = design()
    d.jointOptions = { ...d.jointOptions, blind: { ...d.jointOptions.blind, headType: 'SHCS' } }
    expect(buildFrame(d).warnings.join(' ')).toMatch(/won't slide in/)
  })

  it('warns on short thread engagement', () => {
    const d = design()
    d.jointOptions = { ...d.jointOptions, blind: { ...d.jointOptions.blind, screwLength: 8 } }
    expect(buildFrame(d).warnings.join(' ')).toMatch(/engagement/)
  })

  it('default design has no warnings', () => {
    expect(b.warnings).toEqual([])
  })

  it('produces assembly steps referencing groups', () => {
    expect(b.steps.length).toBeGreaterThan(5)
    expect(b.steps.join('\n')).toMatch(/group/)
  })
})

describe('grouping', () => {
  it('groups by length + prep, longest first', () => {
    const b = buildFrame(design({ cornerOwner: 'z' }))
    expect(b.groups.map((g) => [g.label, g.length, g.qty])).toEqual([
      ['A', 460, 4],
      ['B', 360, 4],
      ['C', 300, 4],
    ])
  })

  it('merges same-length rails across axes on a true cube', () => {
    const b = buildFrame(design({ sizing: { mode: 'exterior', w: 400, d: 400, h: 400 } }))
    expect(b.groups.map((g) => [g.length, g.qty])).toEqual([
      [400, 4],
      [360, 8],
    ])
  })

  it('does not merge same-length parts with different prep', () => {
    // Owner Z, H = 460 → uprights 460 (drilled) vs width rails 460 (tapped).
    const b = buildFrame(design({ sizing: { mode: 'exterior', w: 500, d: 400, h: 460 } }))
    expect(b.groups.filter((g) => g.length === 460)).toHaveLength(2)
  })
})

describe('nesting', () => {
  const g = (label: string, length: number, qty: number): CutGroup => ({
    label, length, qty, memberIds: [], names: [], ends: [null, null], holes: [], color: '',
  })

  it('packs first-fit-decreasing with kerf and trim', () => {
    const n = nestCuts([g('A', 460, 4), g('B', 360, 4), g('C', 300, 4)], { length: 1000, kerf: 2.5, trim: 5 })
    // FFD would need 6 bars; optimal is [460,460]×2, [360,300,300]×2, [360,360].
    for (const bar of n.bars) expect(bar.used).toBeLessThanOrEqual(1000)
    expect(n.bars.reduce((k, b) => k + b.cuts.length, 0)).toBe(12)
    expect(n.bars.length).toBe(5)
    expect(n.oversize).toEqual([])
  })

  it('stays fast and valid on large awkward cut lists', () => {
    const groups = Array.from({ length: 15 }, (_, i) => g(String(i), 137 + i * 53, 4))
    const t = performance.now()
    const n = nestCuts(groups, { length: 1500, kerf: 3, trim: 5 })
    expect(performance.now() - t).toBeLessThan(2000)
    expect(n.bars.reduce((k, b) => k + b.cuts.length, 0)).toBe(60)
    for (const bar of n.bars) expect(bar.used).toBeLessThanOrEqual(1500 + 1e-6)
  })

  it('reports cuts longer than stock', () => {
    const n = nestCuts([g('A', 1200, 2)], { length: 1000, kerf: 2.5, trim: 5 })
    expect(n.oversize).toHaveLength(2)
    expect(n.bars).toHaveLength(0)
  })
})

describe('units', () => {
  it('formats one unit at a time', () => {
    expect(formatLength(460, 'mm')).toBe('460 mm')
    expect(formatLength(25.4, 'in')).toBe('1.000″')
    expect(fromDisplay(2, 'in')).toBeCloseTo(50.8)
  })
})

describe('M6 profile (IXGNIJ, Ø5 bore)', () => {
  const m6 = (blind: Partial<Design['jointOptions']['blind']> = {}): Design => {
    const d = design({ profileId: '2020-ixgnij-m6' })
    d.jointOptions = { ...d.jointOptions, blind: { ...recommendedBlindOptions(getProfile('2020-ixgnij-m6')), ...blind } }
    return d
  }

  it('recommends M6×12 BHCS, Ø6 wrench hole, 14 deep tap', () => {
    expect(recommendedBlindOptions(getProfile('2020-ixgnij-m6'))).toEqual({
      headType: 'BHCS', screwLength: 12, wrenchHoleDiameter: 6, tapDepth: 14,
    })
  })

  it('builds with M6 hardware and no warnings', () => {
    const b = buildFrame(m6())
    expect(b.warnings).toEqual([])
    expect(b.hardware).toEqual([expect.objectContaining({ key: 'M6x12-BHCS', qty: 16, description: 'M6×12 button head (BHCS)' })])
    const tapped = b.members.find((m) => m.axis === 'x')!
    expect(tapped.ends[0]).toEqual({ thread: 'M6×1', drill: 5, depth: 14 })
    expect(b.joints[0].fasteners[0]).toMatchObject({ size: 'M6', diameter: 6, headDiameter: 10.5, headHeight: 3.3 })
    expect(b.tools.join(' ')).toMatch(/4 mm hex key/)
    expect(b.steps.join(' ')).toMatch(/M6×12 BHCS/)
    expect(b.steps.join(' ')).not.toMatch(/M5/)
  })

  it('warns that M6×10 is too short and M6 SHCS will not fit', () => {
    expect(buildFrame(m6({ screwLength: 10 })).warnings.join(' ')).toMatch(/engagement/)
    expect(buildFrame(m6({ headType: 'SHCS' })).warnings.join(' ')).toMatch(/won't slide in/)
  })
})
