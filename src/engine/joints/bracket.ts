import type { Frame } from '../frameContext'
import { axisIndex, face } from '../geometry'
import type { CutGroup, FaceDir, Joint, Vec3 } from '../types'
import type { JointMethod, JointResult } from './types'
import { BASE_TOOLS, HEAD_LABELS, buttJoints, cutStep, faceAssemblySteps, fmtFor, headSpec, insetBox, plural, ranges, squareStep } from './common'

const LEG = 20

/** Faces of each member that take a T-nut, one entry per nut. */
function nutFaces(frame: Frame): Map<string, FaceDir[]> {
  const out = new Map<string, FaceDir[]>()
  const add = (id: string, f: FaceDir) => out.set(id, [...(out.get(id) ?? []), f])
  for (const j of buttJoints(frame)) {
    add(j.owner.id, face(j.B, j.sB === 0 ? 1 : 0))
    add(j.butting.id, face(j.O, j.sO === 0 ? 1 : 0))
  }
  return out
}

export const bracketJoint: JointMethod = {
  id: 'bracket',
  name: 'Inside corner bracket (L-bracket + T-nuts)',
  description:
    'Cast 2020 corner bracket inside each joint, two screws into T-nuts. No cutting beyond length — no tapping or drilling. Brackets sit inside the corners.',
  ownership: 'owner',

  apply(frame: Frame): JointResult {
    const { profile } = frame
    const opts = frame.design.jointOptions.bracket
    const P = profile.size
    const t = opts.bracketThickness
    const size = `M${opts.screwSize}`
    const head = headSpec(opts.screwSize, opts.headType)
    const joints: Joint[] = []

    for (const j of buttJoints(frame)) {
      const { O, B, T, owner, butting, sO, sB } = j
      const width: [number, number] = [1, P - 1]
      const plateOwner = insetBox(j.at, ranges(j, [P, P + LEG], [P, P + t], width))
      const plateButting = insetBox(j.at, ranges(j, [P, P + t], [P, P + LEG], width))
      const screw = (normal: typeof O, along: typeof O, dir: FaceDir) => {
        const c: Vec3 = [0, 0, 0]
        c[axisIndex(normal)] = j.at(normal, P + t + head.height / 2)
        c[axisIndex(along)] = j.at(along, P + LEG / 2)
        c[axisIndex(T)] = j.at(T, P / 2)
        return {
          kind: opts.headType,
          size,
          diameter: opts.screwSize,
          length: opts.screwLength,
          headDiameter: head.diameter,
          headHeight: head.height,
          headCenter: c,
          dir,
        }
      }
      joints.push({
        id: `${j.node.id}-${B}`,
        nodeId: j.node.id,
        owner: owner.id,
        ownerEnd: sO,
        butting: butting.id,
        buttingEnd: sB,
        method: 'bracket',
        fasteners: [screw(B, O, face(B, sB)), screw(O, B, face(O, sO))],
        connectors: [{ kind: 'bracket', color: '#b8bcc2', boxes: [plateOwner, plateButting] }],
      })
    }

    const fmt = fmtFor(frame)
    const n = joints.length
    const warnings: string[] = []
    const tip = opts.screwLength - t
    const minTip = profile.slotLipThickness + 0.6 * opts.screwSize
    if (tip < minTip)
      warnings.push(`${size}×${opts.screwLength} only reaches ${fmt(tip)} past the bracket — not enough to pass the lip and fully engage a T-nut (≈ ${fmt(minTip)}). Use a longer screw.`)
    if (tip > profile.slotDepth)
      warnings.push(`${size}×${opts.screwLength} reaches ${fmt(tip)} into a ${fmt(profile.slotDepth)} deep slot — it will bottom out before clamping. Use a shorter screw.`)
    if (opts.screwSize > profile.slotOpening)
      warnings.push(`${size} won't pass the ${fmt(profile.slotOpening)} slot opening.`)

    return {
      joints,
      ops: [],
      hardware: [
        { key: 'bracket-2020', category: 'connector', description: `2020 inside corner bracket (cast, ${LEG} mm legs, ${fmt(t)} thick)`, qty: n },
        { key: `${size}x${opts.screwLength}-${opts.headType}`, category: 'fastener', description: `${size}×${opts.screwLength} ${HEAD_LABELS[opts.headType]}`, qty: 2 * n },
        {
          key: `tnut-${size}-${opts.tnut}`,
          category: 'nut',
          description: `${size} T-nut for ${profile.slotOpening} mm slot (${opts.tnut === 'drop-in' ? 'drop-in / spring' : 'slide-in'})`,
          qty: 2 * n,
        },
      ],
      tools: [`${head.hexKey} mm hex key`, ...BASE_TOOLS],
      warnings,
      notes: [`Brackets sit inside every corner, about ${fmt(P + LEG)} along each member from the outside edge — keep that clear for anything mounted inside.`],
    }
  },

  steps(frame: Frame, groups: CutGroup[]): string[] {
    const opts = frame.design.jointOptions.bracket
    const O = frame.nodes[0].owner!
    const steps = [cutStep(groups)]
    if (opts.tnut === 'slide-in') {
      const faces = nutFaces(frame)
      const lines = groups.map((g) => {
        const f = faces.get(g.memberIds[0]) ?? []
        const distinct = new Set(f).size
        const where = distinct === 1 ? 'the one inner face that will point toward the middle of the frame' : `each of its ${distinct} inner faces (opposite faces 1 and 2)`
        return `${g.label}: ${f.length} per member — one near each end of ${where}`
      })
      steps.push(
        `Preload slide-in T-nuts before assembly — once a joint is made the slot end is closed. ${lines.join('; ')}. Add spares in any slot you'll want to mount things to later.`,
      )
    }
    steps.push(
      ...faceAssemblySteps(
        frame,
        `At each joint, butt the end square against the side of the ${plural(O).slice(0, -1)} and fit one bracket in the inside corner, one leg on each member${opts.tnut === 'drop-in' ? ' (drop the T-nuts into the slots as you go)' : ''}.`,
      ),
      squareStep(frame, 'fully tighten every bracket screw'),
    )
    return steps
  },
}
