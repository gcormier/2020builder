import type { Sizing } from './types'

export interface Box {
  w: number
  d: number
  h: number
}

/** Exterior bounding box. Interior = clear space between inner member faces. */
export function exteriorOf(sizing: Sizing, profileSize: number): Box {
  if (sizing.mode === 'exterior') return { w: sizing.w, d: sizing.d, h: sizing.h }
  const add = 2 * sizing.clearance + 2 * profileSize
  return { w: sizing.w + add, d: sizing.d + add, h: sizing.h + add }
}

export function interiorOf(exterior: Box, profileSize: number): Box {
  const sub = 2 * profileSize
  return { w: exterior.w - sub, d: exterior.d - sub, h: exterior.h - sub }
}
