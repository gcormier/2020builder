import type { JointOptions, Profile } from '../types'
import { recommendedBlindOptions } from './blind'

/** Starting options for every joint method, matched to the profile's end-tap thread. */
export function recommendedJointOptions(profile: Profile): JointOptions {
  const m6 = profile.endTap.nominal >= 6
  return {
    blind: recommendedBlindOptions(profile),
    bracket: { screwSize: 5, screwLength: 10, headType: 'BHCS', tnut: 'drop-in', bracketThickness: 4 },
    through: m6
      ? { headType: 'BHCS', screwLength: 30, tapDepth: 14, clearanceHole: 6.2 }
      : { headType: 'BHCS', screwLength: 30, tapDepth: 12, clearanceHole: 5.5 },
    cube: { headType: 'SHCS', screwLength: 16, tapDepth: m6 ? 14 : 12, wall: 6 },
  }
}
