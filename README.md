# 2020 Builder

Design box frames from 2020 aluminium extrusion: live 3D preview, cut list,
machining sheet, hardware BOM, stock nesting and assembly steps — plus a
printable build plan (Print → Save as PDF).

- Corner methods: blind joint, inside L-bracket, through-bolt, 3-way corner cube, hidden in-slot connector
- Slot-inserted panels (acrylic, ABS, …) sized from the profile's groove depth, with corner notches where joint hardware is in the way
- Exterior or interior + clearance sizing; mm or inches (one unit shown at a time)
- Save/open designs as JSON, export the cut list as CSV, or share the URL

Runs entirely in the browser. Live at **https://gcormier.github.io/2020builder/**
(deployed by GitHub Actions on every push to `main`).

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # engine unit tests (Vitest)
npm run lint
npm run build    # static site in dist/
```

## Layout

- `src/engine/` — pure TypeScript: sizing, frame layout, joint methods, grouping, nesting. No DOM / three.js.
- `src/engine/joints/` — one file per corner joint method.
- `src/scene/` — react-three-fiber preview.
- `src/ui/` — input panel and output tables.
- `src/state/` — design state, mirrored to the URL hash (shareable links) and localStorage.

Engine units are always mm; the mm/in toggle is display-only. See [PLAN.md](PLAN.md) for the roadmap.
