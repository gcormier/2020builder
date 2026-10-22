# 2020 Builder — Plan

Web app for designing rectangular box ("cube") frames from 2020 aluminum extrusion.
Live 3D preview, selectable corner joining methods, and a printable build plan
(cut list, machining ops, hardware BOM, stock nesting, assembly order).

---

## 1. Architecture recommendation: fully client-side

Everything this app does — geometry, cut lists, BOM, 3D, printing — is cheap and
deterministic. No server is needed, so:

| Layer | Choice | Why |
|---|---|---|
| Build | Vite + TypeScript | Fast dev loop, static output |
| UI | React | Form state ↔ 3D scene sync is cleanest here |
| 3D | three.js via @react-three/fiber + drei | OrbitControls, edges, labels, raycast hover for free |
| Engine | Pure TS module (`src/engine/`), no DOM/three imports | Unit-testable, portable |
| Tests | Vitest | Engine is where correctness matters |
| Print | Dedicated print route + print CSS → browser "Save as PDF" | No PDF lib needed; SVG drawings print crisply |
| State | URL hash (shareable link) + JSON save/load + localStorage last design | No backend needed |
| Deploy | **GitHub Pages via GitHub Actions** on push to `main` (repo `gcormier/2020builder`) | Free, every machine on the network just opens the URL |
| Deploy (alt) | Optional nginx static container in `~/bay` compose | Only if offline/LAN-only is wanted later |

FastAPI only earns its place later if we want server-saved projects, multi-user
libraries, or server-rendered PDFs. Keeping the engine pure TS (not tied to
React/three) means that door stays open.

---

## 2. Domain model

### Profile library (data, not code)
```ts
Profile {
  id: "2020-tslot-6" | "2020-vslot" | ...
  size: 20                 // mm, square
  slotOpening: 6           // mm
  slotType: "T" | "V"
  endTap: "M5x0.8"         // centre bore tap
  tapDepthMax: 15
  fastener: "M5"
  crossSection: Path2D-ish polyline   // for 3D extrude
}
```
MVP ships 2020 T-slot (Misumi HFS5-style) and 2020 V-slot. Same engine later
handles 1515 / 3030 / 2040 by swapping profile data.

### Design input
```ts
Design {
  units: "mm" | "in"                        // display only; engine is always mm.
                                            // mm default; toggle swaps every number in UI + print —
                                            // only one unit is ever shown at a time
  sizing: { mode: "exterior", w, d, h }
        | { mode: "interior", w, d, h, clearance: { x, y, z } }  // per side
  profileId
  joint: JointMethodId                      // global for MVP
  cornerOwner: "Z" | "X" | "Y"              // which axis runs full length
  options: { bracketsPerJoint: 1|2, tnutType, spareTnutsPerMember, kerf, stockLength, ... }
}
```

### Sizing math
- Exterior mode: bounding box = (w, d, h).
- Interior mode: exterior = interior + 2·clearance + 2·P (P = 20).
- Engine also reports an **effective envelope** — hardware that protrudes
  (through-bolt heads) or intrudes (inside L-brackets eat ~20 mm into interior
  corners). Shown as warnings, e.g. "corner brackets reduce interior clearance
  at corners to X mm".

### Members & corner ownership
12 members, 8 corner nodes. Each corner node's 20×20×20 volume is owned by
one member (or by a corner cube). Owner runs through; others butt against it.

| Scheme | X members (×4) | Y members (×4) | Z members (×4) |
|---|---|---|---|
| Z owns (verticals full height) | W − 2P | D − 2P | H |
| X owns (front/back rails full) | W | D − 2P | H − 2P |
| Corner cubes (no owner, cube size C) | W − 2C | D − 2C | H − 2C |

Engine output:
```ts
Member { id: "X-top-front", axis, origin, length, group: "A",
         ends: [EndPrep, EndPrep],   // none | tap M5 depth N
         holes: Hole[] }             // access/through holes: face, offset from end, Ø
Joint  { node, owner, butting: Member[], method }
HardwareLine { sku-ish key, desc, qty, perJoint notes }
```
Members with identical (length, end preps, holes) collapse into one cut-list
group (A, B, C…) and share a colour in 3D.

---

## 3. Corner joining methods (plugin per method)

Each method implements:
```ts
JointMethod {
  id, name, description
  ownership: "owner" | "cube"
  endReduction(profile, opts)          // per butting end
  apply(joint, profile, opts) → { memberOps[], hardware[], meshes[], notes[], warnings[] }
}
```

| Method | Machining | Hardware per joint (pair) | Notes |
|---|---|---|---|
| **Inside L-bracket** (cast 2020 corner bracket) | none | 1–2 brackets, 2× M5×8/10 BHCS + 2× T-nut each | Easiest; brackets intrude inside; T-nut preload issue (see §5) |
| **Blind joint** (end tap + access hole) | Tap butting end M5; drill Ø5 wrench hole through owner at P/2 from end, coaxial with butting member | 1× M5 BHCS (head rides in owner's slot) | Clean, strong, cheap. Screw length & hole Ø configurable — verify against chosen profile |
| **End-tap through-bolt** | Tap butting end; drill Ø5.5 clearance through owner (opt. counterbore) | 1× M5×30 SHCS (or BHCS) | Head protrudes unless counterbored → envelope warning |
| **3-way corner cube** (printed or cast) | Tap all 3 ends at each node | 1 cube + 3× M5 screws (len = cube wall + engagement) | Symmetric lengths; cube size configurable |
| **Hidden in-slot connector** | none (some types need a drilled dimple) | 1 connector w/ set screws | No intrusion, lower strength |
| **External plates / 3-way brackets** | none | plates + BHCS + T-nuts | Optional add-on to any butt scheme (v1.1) |

MVP order: **blind joint** → L-bracket → corner cube → through-bolt → hidden connector.

---

## 4. 3D preview

- Extrude real-ish 2020 cross-section per member (`ExtrudeGeometry`), cached per profile.
- Colour by cut-list group; labels on hover; click member → highlights its cut-list row (and vice versa).
- Connector meshes: simplified bracket / cube / screw-head geometry.
- Drilled holes & taps shown as small markers (actual CSG not needed).
- Toggles: exploded view slider, show hardware, show dimensions, ortho/persp, standard views (iso/front/top/side).
- Snapshot to PNG for the printed plan.

---

## 5. Printable plan (print route)

1. **Header** — design name, date, exterior + interior dims, profile, joint method, share URL/QR.
2. **Views** — iso snapshot + front/side/top orthographic SVG with dimensions.
3. **Cut list** — group, qty, length (in the selected unit), end preps, holes, colour swatch.
4. **Machining sheet** — per group: SVG strip diagram showing tap ends, hole positions/faces/Ø, drill & tap sizes, hex key size.
5. **Hardware BOM** — fasteners by type/size (BHCS/SHCS/T-nuts/brackets/cubes), qty + configurable spare %.
6. **Stock nesting** (primary — cutting ourselves) — first-fit-decreasing 1D bin packing onto chosen stock length with kerf; bar diagrams + waste.
7. **Assembly order** — generated steps, including **T-nut preload** list ("slide 4 T-nuts into slot +Y of member B2 before closing the top ring") when slide-in nuts are chosen and the frame closes the slot.
8. **Tips** — cut same-group members in one batch against a stop block, square-cut check, tolerance.

Also: CSV export of cut list + BOM, JSON design export.

---

## 6. Project layout
```
2020builder/
  src/
    engine/          # pure TS: profiles, sizing, members, joints/, bom, nesting, assembly
      joints/        # one file per JointMethod
      __tests__/
    scene/           # r3f components: Frame, Member, Connector, Dimensions
    ui/              # input panel, cut-list table, BOM table
    print/           # print route, SVG drawings, print.css
    state/           # design store, URL hash codec
  public/
  Dockerfile         # optional: nginx static
```

---

## 7. Phases

**Status:** Phases 0–2 done for the blind-joint method (engine + tests, 3D preview, input panel, cut list / hardware / stock / assembly tabs, URL-hash sharing). Pages CI in place. Next: Phase 4 print plan, then Phase 6 panels; other joint methods (Phase 3) as needed.

| # | Deliverable | Done when |
|---|---|---|
| 0 | Scaffold: Vite/TS/React/r3f, Vitest, profile data | `npm run dev` shows empty scene |
| 1 | Engine: sizing (both modes), ownership schemes, members, grouping, blind-joint method, BOM, nesting, unit tests | Tests cover all 3 ownership schemes & both input modes |
| 2 | 3D preview + input panel + cut-list/BOM tables, live update | Changing dims updates scene and tables instantly |
| 3 | Remaining joint methods + per-method warnings | Each method has tests for lengths/ops/hardware |
| 4 | Print plan: drawings, machining sheets, nesting, assembly + T-nut preload | Print-to-PDF produces a usable shop packet |
| 5 | Polish: URL share, JSON/CSV export, presets, units toggle, Docker | Deployable static container |

### Phase 6 — Panels (right after bare frame)
Slot-inserted sheet panels (e.g. 3 mm acrylic, black ABS), any subset of the 6 faces.
- Profile data gains `panelGrooveDepth` (usable insertion depth, face → core) and
  `slotOpening`; values differ by vendor (Misumi HFS5 vs generic vs V-slot), so each
  profile entry carries its own numbers + a "measured" override field.
- Panel size per face = opening between member faces + 2 × groove depth − 2 × panel clearance
  (clearance per edge configurable, default ~0.5 mm), checked against slot opening ≥ thickness.
- Panels must go in before the frame closes → assembly order inserts them at the right step.
- Blind-joint interaction: the BHCS head sits in the owner's slot right where a panel corner
  lands. Engine computes the overlap and outputs a corner notch size (or warns).
- Output: panel cut list (W × H × thickness, qty, material), nested on sheet stock (v2).

### Later (v2 candidates)
- Per-node / per-joint method overrides
- Mid rails, shelves, cross braces
- Face-mounted panels, panel sheet nesting
- More profiles (1515, 3030, 2040, 80/20 imperial)
- Vendor cut-to-length part numbers (e.g. Misumi with tapping/wrench-hole options) — needs verification of codes
- Cost estimate from price table
- Pinwheel ("rotating") ends for equal-length members on true cubes

---

## 8. Decisions
1. Units: mm default, inch toggle; one unit visible at a time everywhere.
2. Cutting/tapping ourselves → stock nesting + machining sheets are first-class; vendor part numbers stay v2.
3. First joint method: blind joint.
4. Hosting: GitHub Pages via Actions CI; optional `~/bay` container later.
5. Bare frame first; slot-inserted panels immediately after (Phase 6).
