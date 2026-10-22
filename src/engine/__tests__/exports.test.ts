import { describe, expect, it } from 'vitest'
import { decodeDesign } from '../../state/design'
import { buildCsv } from '../../ui/exports'
import { buildFrame } from '../build'
import { defaultDesign } from '../defaults'

describe('exports', () => {
  it('CSV has cut list, panels, hardware and stock sections in the chosen unit', () => {
    const d = { ...defaultDesign(), panels: { ...defaultDesign().panels, faces: ['front' as const] } }
    const csv = buildCsv(buildFrame(d))
    expect(csv).toMatch(/^Cut list\nPart,Qty,Length \(mm\)/)
    expect(csv).toMatch(/\nA,4,460,/)
    expect(csv).toMatch(/\nPanels\n/)
    expect(csv).toMatch(/\nP1,1,471\.2,271\.2,3\.2,Clear acrylic,4\.5,front\n/)
    expect(csv).toMatch(/\n16,18,M6×12 button head \(BHCS\)\n/)
    const inches = buildCsv(buildFrame({ ...d, units: 'in' }))
    expect(inches).toMatch(/Length \(in\)/)
    expect(inches).toMatch(/\nA,4,18\.110,/)
  })

  it('quotes cells that contain commas', () => {
    const csv = buildCsv(buildFrame({ ...defaultDesign(), jointMethod: 'blind' }))
    expect(csv).toMatch(/"Tap both ends M6×1, 14 mm deep"/)
  })

  it('saved JSON round-trips through the loader', () => {
    const d = { ...defaultDesign(), name: 'Printer enclosure', jointMethod: 'cube' as const, hardwareSpares: 20 }
    expect(decodeDesign(JSON.stringify(d))).toEqual(d)
  })

  it('spares round up per hardware line', () => {
    const b = buildFrame({ ...defaultDesign(), hardwareSpares: 10 })
    expect(b.hardware[0]).toMatchObject({ qty: 16, buy: 18 })
    expect(buildFrame({ ...defaultDesign(), hardwareSpares: 0 }).hardware[0].buy).toBe(16)
  })
})
