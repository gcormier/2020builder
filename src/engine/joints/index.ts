import type { JointMethodId } from '../types'
import { blindJoint } from './blind'
import { bracketJoint } from './bracket'
import { cubeJoint } from './cube'
import { hiddenJoint } from './hidden'
import { throughBoltJoint } from './through'
import type { JointMethod } from './types'

export const JOINT_METHODS: Record<JointMethodId, JointMethod> = {
  blind: blindJoint,
  bracket: bracketJoint,
  through: throughBoltJoint,
  cube: cubeJoint,
  hidden: hiddenJoint,
}

export type { JointMethod, JointResult } from './types'
export { recommendedBlindOptions } from './blind'
export { recommendedJointOptions } from './recommend'
export { SCREW_LENGTHS } from './common'
