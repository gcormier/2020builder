import type { Axis, FaceDir, Side, Vec3 } from './types'

export const AXES: Axis[] = ['x', 'y', 'z']

export const axisIndex = (a: Axis): 0 | 1 | 2 => (a === 'x' ? 0 : a === 'y' ? 1 : 2)

/** The two axes perpendicular to `a`, in x→y→z order. */
export function others(a: Axis): [Axis, Axis] {
  return a === 'x' ? ['y', 'z'] : a === 'y' ? ['x', 'z'] : ['x', 'y']
}

export function face(axis: Axis, side: Side): FaceDir {
  return `${side === 0 ? '-' : '+'}${axis}` as FaceDir
}

export function faceAxis(f: FaceDir): Axis {
  return f[1] as Axis
}

export function vec(values: Partial<Record<Axis, number>>): Vec3 {
  return [values.x ?? 0, values.y ?? 0, values.z ?? 0]
}

const SIDE_NAMES: Record<Axis, [string, string]> = {
  x: ['left', 'right'],
  y: ['front', 'back'],
  z: ['bottom', 'top'],
}

export function sideName(axis: Axis, side: Side): string {
  return SIDE_NAMES[axis][side]
}

export const MEMBER_NAMES: Record<Axis, string> = {
  x: 'Width rail',
  y: 'Depth rail',
  z: 'Upright',
}
