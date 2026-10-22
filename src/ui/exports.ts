import { MATERIALS, formatNumber, unitLabel, type Build, type Design } from '../engine'
import { describeEnds, describeHoles } from './describe'

function slug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'frame'
}

export function download(filename: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function saveDesignJson(design: Design): void {
  download(`${slug(design.name)}.2020.json`, JSON.stringify(design, null, 2), 'application/json')
}

const cell = (v: string | number) => {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const row = (...v: (string | number)[]) => v.map(cell).join(',')

/** Cut list, panels and hardware as one CSV (sections separated by blank lines). */
export function buildCsv(build: Build): string {
  const u = build.design.units
  const n = (mm: number) => formatNumber(mm, u)
  const L = unitLabel(u)
  const lines = [
    row('Cut list'),
    row('Part', 'Qty', `Length (${L})`, 'Ends', 'Holes', 'Used as'),
    ...build.groups.map((g) =>
      row(g.label, g.qty, n(g.length), describeEnds(g, u), describeHoles(g, u).join('; ') || '—', [...new Set(g.names.map((x) => x.split(',')[0]))].join('; ')),
    ),
  ]
  if (build.panelGroups.length)
    lines.push(
      '',
      row('Panels'),
      row('Panel', 'Qty', `Width (${L})`, `Height (${L})`, `Thickness (${L})`, 'Material', `Corner notch (${L})`, 'Faces'),
      ...build.panelGroups.map((g) =>
        row(g.label, g.qty, n(g.width), n(g.height), n(g.thickness), MATERIALS[g.material].name, g.cornerNotch ? n(g.cornerNotch) : '', g.faces.join('; ')),
      ),
    )
  lines.push(
    '',
    row('Hardware'),
    row('Qty', 'Buy', 'Description'),
    ...build.hardware.map((h) => row(h.qty, h.buy ?? h.qty, h.description)),
    '',
    row('Stock'),
    row('Bar', 'Cuts'),
    ...build.nesting.bars.map((b, i) => row(i + 1, b.cuts.map((c) => `${c.group} ${n(c.length)}`).join('; '))),
  )
  return lines.join('\n') + '\n'
}

export function saveCsv(build: Build): void {
  download(`${slug(build.design.name)}-cutlist.csv`, buildCsv(build), 'text/csv')
}
