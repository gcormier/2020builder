import type { Frame } from '../frameContext'
import type { CutGroup, Joint } from '../types'
import type { JointMethod, JointResult } from './types'
import { BASE_TOOLS, buttJoints, cutStep, faceAssemblySteps, insetBox, plural, ranges, squareStep } from './common'

const LEG = 18

export const hiddenJoint: JointMethod = {
  id: 'hidden',
  name: 'Hidden in-slot connector',
  description:
    'L-shaped connector that rides inside the slots of both members, locked with set screws. No machining and nothing shows, but it is the lightest-duty option.',
  ownership: 'owner',

  apply(frame: Frame): JointResult {
    const { profile } = frame
    const P = profile.size
    const lip = profile.slotLipThickness
    const floor = P - profile.slotDepth + 0.3
    const joints: Joint[] = []

    for (const j of buttJoints(frame)) {
      const t: [number, number] = [P / 2 - 2.5, P / 2 + 2.5]
      joints.push({
        id: `${j.node.id}-${j.B}`,
        nodeId: j.node.id,
        owner: j.owner.id,
        ownerEnd: j.sO,
        butting: j.butting.id,
        buttingEnd: j.sB,
        method: 'hidden',
        fasteners: [],
        connectors: [
          {
            kind: 'hidden',
            color: '#d4a017',
            boxes: [
              insetBox(j.at, ranges(j, [P, P + LEG], [floor, P - lip], t)),
              insetBox(j.at, ranges(j, [floor, P - lip], [P, P + LEG], t)),
              insetBox(j.at, ranges(j, [floor, P + 1], [floor, P + 1], t)),
            ],
          },
        ],
      })
    }

    return {
      joints,
      ops: [],
      hardware: [{ key: 'hidden-2020', category: 'connector', description: `2020 hidden inner corner connector (L-type, ${profile.slotOpening} mm slot, set screws included)`, qty: joints.length }],
      tools: ['Hex key to suit the connector set screws (usually 2.5 mm)', ...BASE_TOOLS],
      warnings: [],
      notes: [
        'Hidden connectors are the lightest-duty option — fine for enclosures and covers, not for frames that carry load. Each one fills the end of two slots at its corner.',
      ],
    }
  },

  steps(frame: Frame, groups: CutGroup[]): string[] {
    const O = frame.nodes[0].owner!
    return [
      cutStep(groups),
      ...faceAssemblySteps(
        frame,
        `At each joint, slide a connector into the inner slots of both members, butt the end square against the ${plural(O).slice(0, -1)} and lightly tighten the set screws through the slot opening.`,
      ),
      squareStep(frame, 'fully tighten every set screw'),
    ]
  },
}
