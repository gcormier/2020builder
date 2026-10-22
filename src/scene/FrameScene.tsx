import { Bounds, OrbitControls, useBounds } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'
import type { Build, Vec3 } from '../engine'
import { FrameModel, type SceneOptions } from './FrameModel'

export type { SceneOptions } from './FrameModel'

export type ViewName = 'iso' | 'front' | 'right' | 'top'

interface Props {
  build: Build
  hover: string | null
  setHover: (g: string | null) => void
  options: SceneOptions
  view: { name: ViewName; n: number }
}

const VIEW_DIRS: Record<ViewName, Vec3> = {
  iso: [1, -1.4, 0.9],
  front: [0, -1, 0.0001],
  right: [1, 0, 0.0001],
  top: [0, -0.0001, 1],
}

function ViewController({ view, fitKey }: { view: Props['view']; fitKey: string }) {
  const bounds = useBounds()
  useEffect(() => {
    bounds.refresh().fit()
  }, [bounds, fitKey])
  useEffect(() => {
    const { center, distance } = bounds.refresh().getSize()
    const d = new THREE.Vector3(...VIEW_DIRS[view.name]).normalize().multiplyScalar(distance)
    // No .fit(): on perspective cameras drei's fit() is reset(), which keeps the
    // current direction and would undo moveTo. `distance` is already the fit distance.
    bounds.moveTo(center.clone().add(d)).lookAt({ target: center, up: [0, 0, 1] })
    // view.n re-triggers the same named view.
  }, [bounds, view.name, view.n])
  return null
}

export function FrameScene({ build, hover, setHover, options, view }: Props) {
  const { w, d, h } = build.exterior
  const gridSize = Math.ceil((Math.max(w, d) * 1.6) / 100) * 100
  const fitKey = `${w}|${d}|${h}`

  return (
    <Canvas
      camera={{ up: [0, 0, 1], position: [w * 1.2, -d * 2, h * 1.5], fov: 35, near: 1, far: 50000 }}
      dpr={[1, 2]}
      onPointerMissed={() => setHover(null)}
    >
      <color attach="background" args={['#15171a']} />
      <hemisphereLight args={['#ffffff', '#30343a', 1.1]} />
      <directionalLight position={[w, -d * 1.5, h * 2.5]} intensity={1.6} />
      <directionalLight position={[-w, d, h]} intensity={0.5} />
      <Bounds fit clip observe margin={1.25}>
        <FrameModel build={build} options={options} hover={hover} setHover={setHover} />
        <ViewController view={view} fitKey={fitKey} />
      </Bounds>
      <gridHelper args={[gridSize, gridSize / 50, '#3a3f46', '#262a30']} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.5]} />
      <OrbitControls makeDefault enableDamping />
    </Canvas>
  )
}
