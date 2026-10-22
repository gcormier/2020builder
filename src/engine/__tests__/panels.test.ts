import { describe, expect, it } from 'vitest'
import { buildFrame } from '../build'
import { defaultDesign } from '../defaults'
import type { Design, FaceName, JointMethodId } from '../types'

const ALL: FaceName[] = ['front', 'back', 'left', 'right', 'top', 'bottom']

function design(method: JointMethodId, faces: FaceName[] = ['front'], patch: Partial<Design['panels']> = {}): Design {
  const d = defaultDesign() // IXGNIJ M6, 500 × 400 × 300, slot depth 6.1
  return { ...d, jointMethod: method, panels: { ...d.panels, faces, ...patch } }
}

describe('panel sizing', () => {
  it('is the opening plus groove depth minus clearance on each edge', () => {
    const b = buildFrame(design('blind'))
    const p = b.panels[0]
    // 500 − 2×20 + 2 × (6.1 − 0.5) = 471.2; 300 − 40 + 11.2 = 271.2
    expect(p.width).toBeCloseTo(471.2)
    expect(p.height).toBeCloseTo(271.2)
    expect(p.thickness).toBe(3.2)
  })

  it('groups identical sheets across opposite faces', () => {
    const b = buildFrame(design('through', ALL))
    expect(b.panelGroups.map((g) => [g.label, Math.round(g.width * 10) / 10, Math.round(g.height * 10) / 10, g.qty])).toEqual([
      ['P1', 471.2, 271.2, 2],
      ['P2', 371.2, 271.2, 2],
      ['P3', 471.2, 371.2, 2],
    ])
  })

  it('adds a panel step before assembly', () => {
    const steps = buildFrame(design('blind')).steps
    const i = steps.findIndex((s) => s.startsWith('Cut the panels'))
    expect(i).toBeGreaterThan(0)
    expect(steps[i + 1]).toMatch(/^Build the /)
  })
})

describe('corner notches from joint hardware', () => {
  const notch = (m: JointMethodId) => buildFrame(design(m, ALL)).panelGroups.map((g) => g.cornerNotch)

  it('blind joint: screw head pokes ~0.85 mm into the panel corner → small notch', () => {
    expect(new Set(notch('blind'))).toEqual(new Set([4.5]))
  })

  it('through-bolt: shank passes below the panel edge → no notch', () => {
    expect(notch('through')).toEqual([0, 0, 0])
  })

  it('corner cube: panel corner would hit the cube → notch the groove depth', () => {
    expect(new Set(notch('cube'))).toEqual(new Set([6.5]))
  })

  it('inside brackets block vertical-face corners → big notch; top/bottom stay clear', () => {
    // Uprights own the corners, so every bracket sits in a vertical plane.
    const b = buildFrame(design('bracket', ALL))
    const byFace = Object.fromEntries(b.panels.map((p) => [p.face, p.cornerNotch]))
    for (const f of ['front', 'back', 'left', 'right']) expect(byFace[f]).toBeGreaterThanOrEqual(25)
    expect(byFace.top).toBe(0)
    expect(byFace.bottom).toBe(0)
    expect(b.notes.join(' ')).toMatch(/notch all four corners/)
  })
})

describe('panel fit checks', () => {
  it('warns when the sheet is too thick for the slot', () => {
    expect(buildFrame(design('blind', ['front'], { thickness: 6.5 })).warnings.join(' ')).toMatch(/won't fit/)
  })

  it('notes rattle room for thin sheet', () => {
    expect(buildFrame(design('blind', ['front'], { thickness: 3 })).notes.join(' ')).toMatch(/play/)
  })

  it('no panels → no panel output', () => {
    const b = buildFrame(design('blind', []))
    expect(b.panels).toEqual([])
    expect(b.steps.join(' ')).not.toMatch(/panels/)
  })
})
