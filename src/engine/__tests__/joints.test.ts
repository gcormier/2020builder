import { describe, expect, it } from 'vitest'
import { decodeDesign } from '../../state/design'
import { buildFrame } from '../build'
import { defaultDesign } from '../defaults'
import { JOINT_METHODS } from '../joints'
import { recommendedJointOptions } from '../joints/recommend'
import { PROFILES, getProfile } from '../profiles'
import type { Axis, Build, Design, JointMethodId, Vec3 } from '../types'

function design(method: JointMethodId, patch: Partial<Design> = {}, profileId = '2020-ixgnij-m6'): Design {
  return { ...defaultDesign(), profileId, jointOptions: recommendedJointOptions(getProfile(profileId)), jointMethod: method, ...patch }
}

type Box = { min: Vec3; max: Vec3 }
const overlaps = (a: Box, b: Box) => [0, 1, 2].every((k) => Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]) > 0.01)
const memberBoxes = (b: Build): Box[] =>
  b.members.map((m) => {
    const size: Vec3 = [20, 20, 20]
    size['xyz'.indexOf(m.axis)] = m.length
    return { min: m.start, max: m.start.map((s, k) => s + size[k]) as Vec3 }
  })
const qty = (b: Build, key: string) => b.hardware.find((h) => h.key.startsWith(key))?.qty

describe('every method × profile × owner', () => {
  for (const method of Object.keys(JOINT_METHODS) as JointMethodId[])
    for (const p of PROFILES)
      for (const owner of ['x', 'y', 'z'] as Axis[])
        it(`${method} / ${p.id} / ${owner}: builds clean with recommended options`, () => {
          const b = buildFrame(design(method, { cornerOwner: owner }, p.id))
          expect(b.errors).toEqual([])
          expect(b.warnings).toEqual([])
          expect(b.members).toHaveLength(12)
          expect(b.steps.length).toBeGreaterThan(3)
          expect(b.steps.join(' ')).not.toMatch(/\$\{|undefined|NaN/)
        })
})

describe('inside corner bracket', () => {
  const b = buildFrame(design('bracket'))

  it('needs no machining', () => {
    expect(b.members.every((m) => m.holes.length === 0 && m.ends.every((e) => e === null))).toBe(true)
  })

  it('uses one bracket, two screws and two T-nuts per joint', () => {
    expect(b.joints).toHaveLength(16)
    expect(qty(b, 'bracket')).toBe(16)
    expect(qty(b, 'M5x10')).toBe(32)
    expect(qty(b, 'tnut')).toBe(32)
  })

  it('keeps brackets clear of every extrusion and each other', () => {
    const members = memberBoxes(b)
    const plates = b.joints.flatMap((j) => j.connectors.flatMap((c) => c.boxes))
    expect(plates).toHaveLength(32)
    for (const p of plates) for (const m of members) expect(overlaps(p, m)).toBe(false)
    const perBracket = b.joints.map((j) => j.connectors[0].boxes)
    for (let i = 0; i < perBracket.length; i++)
      for (let k = i + 1; k < perBracket.length; k++)
        for (const a of perBracket[i]) for (const c of perBracket[k]) expect(overlaps(a, c)).toBe(false)
  })

  it('adds a preload step only for slide-in T-nuts', () => {
    expect(b.steps.join(' ')).not.toMatch(/Preload/)
    const d = design('bracket')
    d.jointOptions.bracket.tnut = 'slide-in'
    const s = buildFrame(d).steps.join(' ')
    expect(s).toMatch(/Preload slide-in T-nuts/)
    // Uprights own the corners: 4 nuts each on two faces; rails: 2 nuts on one face.
    expect(s).toMatch(/C: 4 per member/)
    expect(s).toMatch(/A: 2 per member/)
  })

  it('warns on screws too short for the nut or long enough to bottom out', () => {
    const short = design('bracket')
    short.jointOptions.bracket.screwLength = 6
    expect(buildFrame(short).warnings.join(' ')).toMatch(/not enough/)
    const long = design('bracket')
    long.jointOptions.bracket.screwLength = 16
    expect(buildFrame(long).warnings.join(' ')).toMatch(/bottom out/)
  })
})

describe('through-bolt', () => {
  const b = buildFrame(design('through'))

  it('drills clearance holes through the owners and taps the butting ends', () => {
    const uprights = b.members.filter((m) => m.axis === 'z')
    for (const m of uprights) {
      expect(m.holes).toHaveLength(4)
      expect(m.holes.every((h) => h.diameter === 6.2 && h.offset === 10)).toBe(true)
    }
    expect(b.members.filter((m) => m.axis !== 'z').every((m) => m.ends.every((e) => e?.thread === 'M6×1'))).toBe(true)
    expect(qty(b, 'M6x30')).toBe(16)
  })

  it('puts bolt heads outside and reports the larger envelope', () => {
    for (const f of b.joints.map((j) => j.fasteners[0])) {
      const outside = f.headCenter[0] < 0 || f.headCenter[0] > 500 || f.headCenter[1] < 0 || f.headCenter[1] > 400
      expect(outside).toBe(true)
    }
    // Uprights own: heads on the X and Y faces, M6 BHCS is 3.3 tall.
    expect(b.notes.join(' ')).toMatch(/506\.6 mm × 406\.6 mm × 300 mm/)
  })
})

describe('3-way corner cube', () => {
  const b = buildFrame(design('cube'))

  it('shortens every member by two cubes, regardless of owner', () => {
    const lengths = (bb: Build) => Object.fromEntries((['x', 'y', 'z'] as Axis[]).map((a) => [a, bb.members.find((m) => m.axis === a)!.length]))
    expect(lengths(b)).toEqual({ x: 460, y: 360, z: 260 })
    expect(lengths(buildFrame(design('cube', { cornerOwner: 'x' })))).toEqual({ x: 460, y: 360, z: 260 })
  })

  it('taps all 24 ends and uses 8 cubes + 24 screws', () => {
    expect(b.members.flatMap((m) => m.ends).filter(Boolean)).toHaveLength(24)
    expect(qty(b, 'cube')).toBe(8)
    expect(qty(b, 'M6x16')).toBe(24)
  })

  it('places cubes in the corners without overlapping members', () => {
    const cubes = b.joints.flatMap((j) => j.connectors.flatMap((c) => c.boxes))
    expect(cubes).toHaveLength(8)
    for (const c of cubes) for (const m of memberBoxes(b)) expect(overlaps(c, m)).toBe(false)
  })
})

describe('hidden connector', () => {
  it('needs no machining and one connector per joint', () => {
    const b = buildFrame(design('hidden'))
    expect(b.members.every((m) => m.holes.length === 0 && m.ends.every((e) => e === null))).toBe(true)
    expect(qty(b, 'hidden')).toBe(16)
    expect(b.notes.join(' ')).toMatch(/lightest-duty/)
  })
})

describe('loading older saved designs', () => {
  it('fills options for methods added later, matched to the saved profile', () => {
    const old = JSON.stringify({
      version: 1,
      name: 'old',
      units: 'mm',
      sizing: { mode: 'exterior', w: 500, d: 400, h: 300 },
      profileId: '2020-t6',
      cornerOwner: 'z',
      jointMethod: 'blind',
      jointOptions: { blind: { headType: 'BHCS', screwLength: 10, wrenchHoleDiameter: 5, tapDepth: 12 } },
      stock: { length: 1000, kerf: 2.5, trim: 5 },
    })
    const d = decodeDesign(old)!
    expect(d.jointOptions.through.tapDepth).toBe(12)
    expect(d.jointOptions.bracket.screwSize).toBe(5)
    expect(buildFrame({ ...d, jointMethod: 'cube' }).errors).toEqual([])
  })
})
