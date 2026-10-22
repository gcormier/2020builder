import type { Profile } from './types'

// Nominal dimensions. Vendors differ by a few tenths; measure your stock
// before trusting slot-depth-sensitive numbers (screw stand-off, panel grooves).
export const PROFILES: Profile[] = [
  {
    id: '2020-t6',
    name: '2020 T-slot, 6 mm slot (generic / Misumi HFS5-2020)',
    size: 20,
    slotType: 'T',
    slotOpening: 6.2,
    slotLipThickness: 1.8,
    slotDepth: 6.1,
    slotCavityWidth: 11,
    centerBore: 4.2,
    endTap: { thread: 'M5×0.8', drill: 4.2, nominal: 5 },
    notes: 'Nominal values — measure your stock.',
  },
  {
    id: '2020-ixgnij-m6',
    name: '2020 T-slot, Ø5 bore / M6 (IXGNIJ, Amazon)',
    size: 20,
    slotType: 'T',
    slotOpening: 6.2,
    slotLipThickness: 1.8,
    slotDepth: 6.1,
    slotCavityWidth: 11,
    webThickness: 1.5,
    slotMouth: { width: 7.2, depth: 0.76 },
    centerBore: 5,
    endTap: { thread: 'M6×1', drill: 5, nominal: 6 },
    notes: 'From the seller drawing; 5 mm bore confirmed on real stock.',
  },
  {
    id: '2020-v',
    name: '2020 V-slot (OpenBuilds-style)',
    size: 20,
    slotType: 'V',
    slotOpening: 6.2,
    slotLipThickness: 1.8,
    slotDepth: 6.0,
    slotCavityWidth: 11,
    centerBore: 4.2,
    endTap: { thread: 'M5×0.8', drill: 4.2, nominal: 5 },
    notes: 'Nominal values — measure your stock.',
  },
]

export function getProfile(id: string): Profile {
  return PROFILES.find((p) => p.id === id) ?? PROFILES[0]
}
