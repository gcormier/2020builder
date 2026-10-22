import type { Units } from './types'

export const MM_PER_IN = 25.4

export function toDisplay(mm: number, units: Units): number {
  return units === 'mm' ? mm : mm / MM_PER_IN
}

export function fromDisplay(value: number, units: Units): number {
  return units === 'mm' ? value : value * MM_PER_IN
}

/** Number only, rounded for the unit: 0.1 mm or 0.001 in. */
export function formatNumber(mm: number, units: Units): string {
  if (units === 'mm') return String(Math.round(mm * 10) / 10)
  return (mm / MM_PER_IN).toFixed(3)
}

export function formatLength(mm: number, units: Units): string {
  return units === 'mm' ? `${formatNumber(mm, units)} mm` : `${formatNumber(mm, units)}″`
}

export function unitLabel(units: Units): string {
  return units === 'mm' ? 'mm' : 'in'
}
