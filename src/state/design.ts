import { useEffect, useState } from 'react'
import { defaultDesign, type Design } from '../engine'

const STORAGE_KEY = '2020builder.design'
const HASH_PREFIX = '#d='

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): string {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

export function encodeDesign(d: Design): string {
  return toBase64Url(JSON.stringify(d))
}

/** Parse and merge onto defaults so older/partial designs still load. */
export function decodeDesign(json: string): Design | null {
  try {
    const p = JSON.parse(json) as Partial<Design>
    if (p.version !== 1) return null
    const def = defaultDesign()
    return {
      ...def,
      ...p,
      sizing: p.sizing ?? def.sizing,
      jointOptions: { blind: { ...def.jointOptions.blind, ...p.jointOptions?.blind } },
      stock: { ...def.stock, ...p.stock },
    }
  } catch {
    return null
  }
}

function initialDesign(): Design {
  if (location.hash.startsWith(HASH_PREFIX)) {
    try {
      const d = decodeDesign(fromBase64Url(location.hash.slice(HASH_PREFIX.length)))
      if (d) return d
    } catch {
      /* fall through */
    }
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    const d = saved && decodeDesign(saved)
    if (d) return d
  } catch {
    /* storage unavailable */
  }
  return defaultDesign()
}

/** Design state mirrored to the URL hash (shareable) and localStorage (last design). */
export function useDesign(): [Design, (update: (d: Design) => Design) => void] {
  const [design, setDesign] = useState(initialDesign)

  useEffect(() => {
    history.replaceState(null, '', HASH_PREFIX + encodeDesign(design))
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(design))
    } catch {
      /* storage unavailable */
    }
  }, [design])

  return [design, (update) => setDesign((d) => update(d))]
}
