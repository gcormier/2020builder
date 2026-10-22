import * as THREE from 'three'

const cache = new Map<string, THREE.CanvasTexture>()

/** Badge texture (rounded rect + text), cached by content. Lives in WebGL so snapshots include it. */
export function labelTexture(text: string, bg: string, outline: boolean): THREE.CanvasTexture {
  const key = `${text}|${bg}|${outline}`
  const hit = cache.get(key)
  if (hit) return hit
  const s = 64
  const c = document.createElement('canvas')
  c.width = c.height = s
  const g = c.getContext('2d')!
  g.fillStyle = bg
  g.beginPath()
  g.roundRect(6, 6, s - 12, s - 12, 10)
  g.fill()
  if (outline) {
    g.lineWidth = 5
    g.strokeStyle = '#fff'
    g.stroke()
  }
  g.fillStyle = '#fff'
  g.font = '600 32px system-ui, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.shadowColor = 'rgba(0,0,0,0.5)'
  g.shadowBlur = 2
  g.fillText(text, s / 2, s / 2 + 2)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  cache.set(key, tex)
  return tex
}
