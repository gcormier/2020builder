import type { Bar, BarCut, CutGroup, Nesting, StockOptions } from './types'

const EPS = 1e-9
/** Search budget for the exact packer before falling back to first-fit-decreasing. */
const NODE_LIMIT = 200_000

/** First-fit-decreasing: bin index per item. `sizes` must be sorted descending. */
function firstFit(sizes: number[], cap: number): number[] {
  const rem: number[] = []
  return sizes.map((s) => {
    let i = rem.findIndex((r) => r >= s - EPS)
    if (i < 0) i = rem.push(cap) - 1
    rem[i] -= s
    return i
  })
}

/** Exact packing into exactly `bins` bins, or null if impossible / over budget. */
function packInto(sizes: number[], cap: number, bins: number): number[] | null {
  const rem = Array<number>(bins).fill(cap)
  const assign = Array<number>(sizes.length)
  let nodes = 0
  const suffix = sizes.map((_, i) => sizes.slice(i).reduce((a, b) => a + b, 0))

  const dfs = (i: number): boolean | null => {
    if (i === sizes.length) return true
    if (++nodes > NODE_LIMIT) return null
    if (suffix[i] > rem.reduce((a, b) => a + b, 0) + EPS) return false
    const tried = new Set<number>()
    for (let b = 0; b < bins; b++) {
      if (rem[b] < sizes[i] - EPS) continue
      const key = Math.round(rem[b] * 1000)
      if (tried.has(key)) continue // identical bins are interchangeable
      tried.add(key)
      rem[b] -= sizes[i]
      assign[i] = b
      const r = dfs(i + 1)
      rem[b] += sizes[i]
      if (r !== false) return r && true
      if (r === null) return null
    }
    return false
  }

  const r = dfs(0)
  return r ? assign : null
}

/**
 * 1D cutting-stock nesting. Every cut is charged one kerf (conservative: the
 * last piece on a bar could skip it), and each bar loses `trim` up front.
 * Tries an exact minimum-bar packing, falling back to first-fit-decreasing.
 */
export function nestCuts(groups: CutGroup[], stock: StockOptions): Nesting {
  const all: BarCut[] = groups
    .flatMap((g) => Array.from({ length: g.qty }, () => ({ group: g.label, length: g.length })))
    .sort((a, b) => b.length - a.length || a.group.localeCompare(b.group))

  const usable = stock.length - stock.trim
  const oversize = all.filter((c) => c.length + stock.kerf > usable + EPS)
  const cuts = all.filter((c) => c.length + stock.kerf <= usable + EPS)
  const sizes = cuts.map((c) => c.length + stock.kerf)

  let assign = firstFit(sizes, usable)
  const ffdBins = assign.length ? Math.max(...assign) + 1 : 0
  const lowerBound = Math.ceil(sizes.reduce((a, b) => a + b, 0) / usable - EPS)
  for (let k = lowerBound; k < ffdBins; k++) {
    const exact = packInto(sizes, usable, k)
    if (exact) {
      assign = exact
      break
    }
  }

  const bars: Bar[] = []
  assign.forEach((b, i) => {
    bars[b] ??= { cuts: [], used: stock.trim, remaining: usable }
    bars[b].cuts.push(cuts[i])
    bars[b].used += sizes[i]
    bars[b].remaining -= sizes[i]
  })
  const packed = bars.filter(Boolean).sort((a, b) => b.used - a.used)

  return {
    stockLength: stock.length,
    bars: packed,
    totalCutLength: all.reduce((n, c) => n + c.length, 0),
    totalStock: packed.length * stock.length,
    oversize,
  }
}
