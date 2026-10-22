import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import type { Build } from '../engine'
import { FrameModel } from '../scene/FrameModel'

const FOV = 30
const ISO_DIR = new THREE.Vector3(1, -1.4, 0.9).normalize()

function Capture({ target, onCapture }: { target: THREE.Vector3; onCapture: (src: string) => void }) {
  const { gl, camera } = useThree()
  const frames = useRef(0)
  const done = useRef(false)
  useLayoutEffect(() => {
    camera.lookAt(target)
    camera.updateProjectionMatrix()
  }, [camera, target])
  // A few frames lets textures (labels) upload before we grab the buffer.
  useFrame(() => {
    if (done.current || ++frames.current < 4) return
    done.current = true
    onCapture(gl.domElement.toDataURL('image/png'))
  })
  return null
}

/** Renders the frame once, then swaps the WebGL canvas for a PNG so it prints reliably. Remount (key) to retake. */
export function Snapshot({ build }: { build: Build }) {
  const [src, setSrc] = useState<string | null>(null)
  const { w, d, h } = build.exterior
  const target = new THREE.Vector3(0, 0, h / 2)
  const radius = 0.5 * Math.hypot(w, d, h)
  // Bounding sphere is conservative for a box; pull in a bit so the frame fills the image.
  const dist = (radius / Math.sin(((FOV / 2) * Math.PI) / 180)) * 0.95
  const position = target.clone().addScaledVector(ISO_DIR, dist)

  if (src) return <img className="snapshot" src={src} alt="3D view of the frame" />
  return (
    <div className="snapshot stage">
      <Canvas
        dpr={2}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        camera={{ fov: FOV, position: position.toArray(), up: [0, 0, 1], near: 1, far: dist * 4 }}
      >
        <color attach="background" args={['#ffffff']} />
        <hemisphereLight args={['#ffffff', '#8a8f96', 1.3]} />
        <directionalLight position={[w, -d * 1.5, h * 2.5]} intensity={1.5} />
        <directionalLight position={[-w, d, h]} intensity={0.5} />
        <FrameModel build={build} options={{ xray: false, hardware: true, labels: true }} />
        <Capture target={target} onCapture={setSrc} />
      </Canvas>
    </div>
  )
}
