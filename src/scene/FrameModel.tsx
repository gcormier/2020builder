import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { Axis, Build, Connector, FaceDir, Fastener, Hole, Member, Vec3 } from '../engine'
import { labelTexture } from './labelSprite'
import { profileShape } from './profileShape'

export interface SceneOptions {
  xray: boolean
  hardware: boolean
  labels: boolean
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

function memberCenter(m: Member, P: number): Vec3 {
  const c: Vec3 = [m.start[0] + P / 2, m.start[1] + P / 2, m.start[2] + P / 2]
  c[AXIS_IDX[m.axis]] = m.start[AXIS_IDX[m.axis]] + m.length / 2
  return c
}

interface MemberProps {
  m: Member
  shape: THREE.Shape
  P: number
  color: string
  hot: boolean
  dim: boolean
  xray: boolean
  label: boolean
  setHover?: (g: string | null) => void
}

function MemberMesh({ m, shape, P, color, hot, dim, xray, label, setHover }: MemberProps) {
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
        onPointerOver={
          setHover &&
          ((e) => {
            e.stopPropagation()
            setHover(m.group)
          })
        }
        onPointerOut={setHover && (() => setHover(null))}
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

function ConnectorMesh({ c, xray }: { c: Connector; xray: boolean }) {
  return (
    <group>
      {c.boxes.map((b, i) => (
        <mesh key={i} position={b.min.map((v, k) => (v + b.max[k]) / 2) as Vec3}>
          <boxGeometry args={b.max.map((v, k) => v - b.min[k]) as Vec3} />
          <meshStandardMaterial
            key={xray ? 'see-through' : 'solid'}
            color={c.color}
            metalness={0.5}
            roughness={0.4}
            transparent={xray}
            opacity={xray ? 0.5 : 1}
          />
        </mesh>
      ))}
    </group>
  )
}

function PanelMesh({ min, max, color, opacity }: { min: Vec3; max: Vec3; color: string; opacity: number }) {
  return (
    <mesh position={min.map((v, k) => (v + max[k]) / 2) as Vec3} renderOrder={5}>
      <boxGeometry args={max.map((v, k) => v - min[k]) as Vec3} />
      <meshStandardMaterial color={color} transparent opacity={opacity} roughness={0.2} metalness={0} depthWrite={false} />
    </mesh>
  )
}

interface ModelProps {
  build: Build
  options: SceneOptions
  hover?: string | null
  setHover?: (g: string | null) => void
}

/** The frame in engine coordinates, recentred so the footprint sits on the origin. */
export function FrameModel({ build, options, hover = null, setHover }: ModelProps) {
  const shape = useMemo(() => profileShape(build.profile), [build.profile])
  const P = build.profile.size
  const { w, d } = build.exterior
  const colorOf = new Map(build.groups.map((g) => [g.label, g.color]))

  return (
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
      {options.hardware &&
        build.joints.flatMap((j) => j.connectors.map((c, i) => <ConnectorMesh key={`${j.id}-c${i}`} c={c} xray={options.xray} />))}
      {build.panels.map((p) => (
        <PanelMesh key={p.id} min={p.min} max={p.max} color={p.color} opacity={p.opacity} />
      ))}
    </group>
  )
}
