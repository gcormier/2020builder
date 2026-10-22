import type { Design } from './types'

export function defaultDesign(): Design {
  return {
    version: 1,
    name: 'Untitled frame',
    units: 'mm',
    sizing: { mode: 'exterior', w: 500, d: 400, h: 300 },
    profileId: '2020-t6',
    cornerOwner: 'z',
    jointMethod: 'blind',
    jointOptions: {
      blind: { headType: 'BHCS', screwLength: 10, wrenchHoleDiameter: 5, tapDepth: 12 },
    },
    stock: { length: 1000, kerf: 2.5, trim: 5 },
  }
}
