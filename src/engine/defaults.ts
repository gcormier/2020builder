import { recommendedJointOptions } from './joints/recommend'
import { getProfile } from './profiles'
import type { Design } from './types'

export function defaultDesign(): Design {
  const profileId = '2020-ixgnij-m6'
  return {
    version: 1,
    name: 'Untitled frame',
    units: 'mm',
    sizing: { mode: 'exterior', w: 500, d: 400, h: 300 },
    profileId,
    cornerOwner: 'z',
    jointMethod: 'blind',
    jointOptions: recommendedJointOptions(getProfile(profileId)),
    stock: { length: 1000, kerf: 2.5, trim: 5 },
  }
}
