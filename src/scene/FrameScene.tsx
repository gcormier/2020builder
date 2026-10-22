import { Bounds, OrbitControls, useBounds } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { Axis, Build, FaceDir, Fastener, Hole, Member, Vec3 } from '../engine'
import { labelTexture } from './labelSprite'
import { profileShape } from './profileShape'

export type ViewName = 'iso' | 'front' | 'right' | 'top'

export interface SceneOptions {
  xray: boolean
  hardware: boolean
  labels: boolean
}

interface Props {
  build: Build
  hover: string | null
  setHover: (g: string | null) => void
  options: SceneOptions
  view: { name: ViewName; n: number }
}

const AXIS_IDX: Record<Axis, number> = { x: 0, y: 1, z: 2 }

/** Rotation taking local +Z (extrude direction) onto the given axis. */
const EXTRUDE_ROT: Record<Axis, [number, number, number]> = {
  x: [0, Math.PI / 2, 0],
  y: [-Math.PI / 2, 0, 0],
  z: [0, 0, 0],
}

/** Rotation taking a cylinder's local +Y onto the given axis. */
const CYL_ROT: Record<Axis, [number, number, number]> = {
  x: [0, 0, -Math.PI / 2],
  y: [0, 0, 0],
  z: [Math.PI / 2, 0, 0],
}

const VIEW_DIRS: Record<ViewName, Vec3> = {
  iso: [1, -1.4, 0.9],
  front: [0, -1, 0.0001],
  right: [1, 0, 0.0001],
  top: [0, -0.0001, 1],
}

function memberCenter(m: Member, P: number): Vec3 {
  const c: Vec3 = [m.start[0] + P / 2, m.start[1] + P / 2, m.start[2] + P / 2]
  c[AXIS_IDX[m.axis]] = m.start[AXIS_IDX[m.axis]] + m.length / 2
  return c
}

function MemberMesh({
  m,
  shape,
  P,
  color,
  hot,
  dim,
  xray,
  label,
  setHover,
}: {
  m: Member
  shape: THREE.Shape
  P: number
  color: string
  hot: boolean
  dim: boolean
  xray: boolean
  label: boolean
  setHover: (g: string | null) => void
}) {
  const geom = useMemo(
    () => new THREE.ExtrudeGeometry(shape, { depth: m.length, bevelEnabled: false, curveSegments: 10 }),
    [shape, m.length],
  )
  useEffect(() => () => geom.dispose(), [geom])
  const pos: Vec3 = [m.start[0] + P / 2, m.start[1] + P / 2, m.start[2] + P / 2]
  pos[AXIS_IDX[m.axis]] = m.start[AXIS_IDX[m.axis]]

  return (
    <group>
      <mesh
        geometry={geom}
        position={pos}
        rotation={EXTRUDE_ROT[m.axis]}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHover(m.group)
        }}
        onPointerOut={() => setHover(null)}
      >
        <meshStandardMaterial
          // Rebuild when transparency toggles; three.js won't recompile the shader otherwise.
          key={xray || dim ? 'see-through' : 'solid'}
          color={color}
          metalness={0.1}
          roughness={0.55}
          emissive={hot ? color : '#000'}
          emissiveIntensity={hot ? 0.45 : 0}
          transparent={xray || dim}
          opacity={xray ? 0.28 : dim ? 0.55 : 1}
          depthWrite={!xray}
        />
      </mesh>
      {label && (
        <sprite position={memberCenter(m, P)} scale={[0.034, 0.034, 1]} renderOrder={10}>
          <spriteMaterial map={labelTexture(m.group, color, hot)} sizeAttenuation={false} depthTest={false} />
        </sprite>
      )}
    </group>
  )
}

function holeCenter(m: Member, h: Hole, P: number): Vec3 {
  const c = memberCenter(m, P)
  const a = AXIS_IDX[m.axis]
  c[a] = h.end === 0 ? m.start[a] + h.offset : m.start[a] + m.length - h.offset
  const fa = AXIS_IDX[h.face[1] as Axis]
  c[fa] = h.face[0] === '-' ? m.start[fa] - 0.15 : m.start[fa] + P + 0.15
  return c
}

function HoleMarker({ m, h, P }: { m: Member; h: Hole; P: number }) {
  return (
    <mesh position={holeCenter(m, h, P)} rotation={CYL_ROT[h.face[1] as Axis]}>
      <cylinderGeometry args={[h.diameter / 2, h.diameter / 2, 0.6, 24]} />
      <meshBasicMaterial color="#111" />
    </mesh>
  )
}

function dirSign(d: FaceDir): number {
  return d[0] === '-' ? -1 : 1
}

function Screw({ f }: { f: Fastener }) {
  const axis = f.dir[1] as Axis
  const s = dirSign(f.dir)
  const shank: Vec3 = [...f.headCenter]
  shank[AXIS_IDX[axis]] += s * (f.headHeight / 2 + f.length / 2)
  return (
    <group>
      <mesh position={f.headCenter} rotation={CYL_ROT[axis]}>
        <cylinderGeometry args={[f.headDiameter / 2, f.headDiameter / 2, f.headHeight, 24]} />
        <meshStandardMaterial color="#c9ccd1" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={shank} rotation={CYL_ROT[axis]}>
        <cylinderGeometry args={[f.diameter / 2, f.diameter / 2, f.length, 16]} />
        <meshStandardMaterial color="#9da2a8" metalness={0.8} roughness={0.35} />
      </mesh>
    </group>
  )
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
  const shape = useMemo(() => profileShape(build.profile), [build.profile])
  const P = build.profile.size
  const { w, d, h } = build.exterior
  const colorOf = new Map(build.groups.map((g) => [g.label, g.color]))
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
        <group position={[-w / 2, -d / 2, 0]}>
          {build.members.map((m) => (
            <MemberMesh
              key={m.id}
              m={m}
              shape={shape}
              P={P}
              color={colorOf.get(m.group) ?? '#888'}
              hot={hover === m.group}
              dim={hover !== null && hover !== m.group}
              xray={options.xray}
              label={options.labels}
              setHover={setHover}
            />
          ))}
          {options.hardware &&
            build.members.flatMap((m) => m.holes.map((hl, i) => <HoleMarker key={`${m.id}-${i}`} m={m} h={hl} P={P} />))}
          {options.hardware && build.joints.flatMap((j) => j.fasteners.map((f, i) => <Screw key={`${j.id}-${i}`} f={f} />))}
        </group>
        <ViewController view={view} fitKey={fitKey} />
      </Bounds>
      <gridHelper args={[gridSize, gridSize / 50, '#3a3f46', '#262a30']} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.5]} />
      <OrbitControls makeDefault enableDamping />
    </Canvas>
  )
}
