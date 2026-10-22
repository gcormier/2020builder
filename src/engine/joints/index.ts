import type { JointMethodId } from '../types'
import { blindJoint } from './blind'
import type { JointMethod } from './types'

export const JOINT_METHODS: Record<JointMethodId, JointMethod> = {
  blind: blindJoint,
}

export type { JointMethod, JointResult } from './types'
