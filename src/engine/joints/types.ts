import type { Frame } from '../frameContext'
import type { CutGroup, HardwareLine, Joint, JointMethodId, MemberOp } from '../types'

export interface JointResult {
  joints: Joint[]
  ops: MemberOp[]
  hardware: HardwareLine[]
  tools: string[]
  warnings: string[]
  notes: string[]
}

export interface JointMethod {
  id: JointMethodId
  name: string
  description: string
  ownership: 'owner' | 'cube'
  apply(frame: Frame): JointResult
  /** Prep + assembly steps. Runs after ops are applied and members are grouped. */
  steps(frame: Frame, groups: CutGroup[]): string[]
}
