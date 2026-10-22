// Engine coordinate system: millimetres, Z up.
// X = width (left → right), Y = depth (front → back), Z = height (bottom → top).
// The frame occupies [0, W] × [0, D] × [0, H].

export type Axis = 'x' | 'y' | 'z'
export type Side = 0 | 1
export type Vec3 = [number, number, number]
export type FaceDir = '+x' | '-x' | '+y' | '-y' | '+z' | '-z'
export type Units = 'mm' | 'in'

export interface Profile {
  id: string
  name: string
  /** Square profile size, e.g. 20 for 2020. */
  size: number
  slotType: 'T' | 'V'
  /** Width of the slot opening at the face. */
  slotOpening: number
  /** Thickness of the slot lips (face → inside of lip). */
  slotLipThickness: number
  /** Face → bottom of slot cavity. */
  slotDepth: number
  /** Width of the cavity behind the lips. */
  slotCavityWidth: number
  /** Diagonal web (core corner → outer corner) thickness; sets the cavity walls. Omit for a generic look. */
  webThickness?: number
  /** Relief at the slot mouth: wider than slotOpening for a short depth. Cosmetic. */
  slotMouth?: { width: number; depth: number }
  /** Centre bore diameter (already tap-drill size on most 2020). */
  centerBore: number
  endTap: { thread: string; drill: number; nominal: number }
  /** Values are nominal — measure your stock. */
  notes: string
}

export type Sizing =
  | { mode: 'exterior'; w: number; d: number; h: number }
  | { mode: 'interior'; w: number; d: number; h: number; clearance: number }

export type HeadType = 'BHCS' | 'SHCS'

export interface BlindJointOptions {
  headType: HeadType
  screwLength: number
  wrenchHoleDiameter: number
  tapDepth: number
}

export interface BracketOptions {
  /** Bracket screws thread into T-nuts, so their size is independent of the profile's end tap. */
  screwSize: 4 | 5 | 6
  screwLength: number
  headType: HeadType
  /** Drop-in nuts go in any time; slide-in nuts must be preloaded before slots are closed. */
  tnut: 'drop-in' | 'slide-in'
  bracketThickness: number
}

export interface ThroughBoltOptions {
  headType: HeadType
  screwLength: number
  tapDepth: number
  clearanceHole: number
}

export interface CubeOptions {
  headType: HeadType
  screwLength: number
  tapDepth: number
  /** Cube material between the counterbore floor (head seat) and the face against the extrusion. */
  wall: number
}

export type JointMethodId = 'blind' | 'bracket' | 'through' | 'cube' | 'hidden'

export interface JointOptions {
  blind: BlindJointOptions
  bracket: BracketOptions
  through: ThroughBoltOptions
  cube: CubeOptions
}

export interface StockOptions {
  length: number
  kerf: number
  /** Material lost squaring the factory end of each bar. */
  trim: number
}

export type FaceName = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom'

export type PanelMaterial = 'acrylic' | 'abs' | 'polycarbonate' | 'acm' | 'wood'

export interface PanelOptions {
  faces: FaceName[]
  thickness: number
  material: PanelMaterial
  /** Gap left at each edge between the panel and the slot floor. */
  clearance: number
}

export interface Design {
  version: 1
  name: string
  units: Units
  sizing: Sizing
  profileId: string
  /** Which axis's members run full length through the corners. */
  cornerOwner: Axis
  jointMethod: JointMethodId
  jointOptions: JointOptions
  stock: StockOptions
  panels: PanelOptions
  /** Extra hardware to buy, percent (rounded up per line). */
  hardwareSpares: number
}

export interface TapPrep {
  thread: string
  drill: number
  depth: number
}

export interface Hole {
  end: Side
  /** Distance from that end to the hole centre. */
  offset: number
  /** Global face the hole is drilled into. */
  face: FaceDir
  /** 1 or 2: which of the member's two outer faces (see Member.outerFaces). */
  faceRole: 1 | 2
  diameter: number
  note: string
}

export interface Member {
  id: string
  axis: Axis
  name: string
  /** Bounding-box min corner. */
  start: Vec3
  length: number
  /** The two outward-facing faces (this member sits on a frame edge). */
  outerFaces: [FaceDir, FaceDir]
  ends: [TapPrep | null, TapPrep | null]
  holes: Hole[]
  /** Cut-list group label, assigned after grouping. */
  group: string
}

export interface FrameNode {
  id: string
  corner: [Side, Side, Side]
  members: Record<Axis, string>
  owner: Axis | null
}

export interface Fastener {
  kind: HeadType
  size: string
  /** Nominal thread diameter. */
  diameter: number
  length: number
  headDiameter: number
  headHeight: number
  /** Centre of the head. */
  headCenter: Vec3
  /** Direction from head toward the screw tip. */
  dir: FaceDir
}

/** Bracket / corner cube / connector body, as boxes for rendering. */
export interface Connector {
  kind: string
  color: string
  boxes: { min: Vec3; max: Vec3 }[]
}

export interface Joint {
  id: string
  nodeId: string
  owner: string
  ownerEnd: Side
  butting: string
  buttingEnd: Side
  method: JointMethodId
  fasteners: Fastener[]
  connectors: Connector[]
}

export interface HardwareLine {
  key: string
  category: 'fastener' | 'connector' | 'nut'
  description: string
  qty: number
  /** qty plus spares, filled in by the build. */
  buy?: number
}

export type MemberOp =
  | { kind: 'tap'; memberId: string; end: Side; tap: TapPrep }
  | { kind: 'hole'; memberId: string; hole: Hole }

export interface CutGroup {
  label: string
  length: number
  qty: number
  memberIds: string[]
  names: string[]
  ends: [TapPrep | null, TapPrep | null]
  holes: Hole[]
  color: string
}

export interface BarCut {
  group: string
  length: number
}

export interface Bar {
  cuts: BarCut[]
  used: number
  remaining: number
}

export interface Nesting {
  stockLength: number
  bars: Bar[]
  totalCutLength: number
  totalStock: number
  /** Cuts that don't fit a single bar. */
  oversize: BarCut[]
}

export interface Diagonal {
  face: string
  a: number
  b: number
  length: number
}

/** One sheet panel sitting in the slots of a frame face. */
export interface Panel {
  id: string
  face: FaceName
  /** Panel cut-list group label (P1, P2…). */
  group: string
  /** Sheet cut size (in-plane) and thickness. */
  width: number
  height: number
  thickness: number
  material: PanelMaterial
  /** Placement for rendering. */
  min: Vec3
  max: Vec3
  color: string
  opacity: number
  /** Corner notch needed to clear joint hardware (0 = none). */
  cornerNotch: number
}

export interface PanelGroup {
  label: string
  width: number
  height: number
  thickness: number
  material: PanelMaterial
  qty: number
  faces: FaceName[]
  cornerNotch: number
}

export interface Build {
  design: Design
  profile: Profile
  exterior: { w: number; d: number; h: number }
  interior: { w: number; d: number; h: number }
  members: Member[]
  panels: Panel[]
  panelGroups: PanelGroup[]
  nodes: FrameNode[]
  joints: Joint[]
  groups: CutGroup[]
  hardware: HardwareLine[]
  tools: string[]
  steps: string[]
  /** Informational, not problems (e.g. hardware that intrudes or protrudes). */
  notes: string[]
  diagonals: Diagonal[]
  nesting: Nesting
  warnings: string[]
  errors: string[]
}
