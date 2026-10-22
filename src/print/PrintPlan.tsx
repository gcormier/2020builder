import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { JOINT_METHODS, formatLength, type Build } from '../engine'
import { OWNER_LABELS } from '../ui/labels'
import {
  CutListTable,
  DiagonalTable,
  HardwareTable,
  Messages,
  PanelTable,
  StepsList,
  StockBars,
  StockSummary,
  ToolsList,
} from '../ui/sections'
import { MachiningSheet } from './MachiningSheet'
import { OrthoViews } from './OrthoViews'
import { Snapshot } from './Snapshot'
import './print.css'

function SheetHeader({ build, title }: { build: Build; title: string }) {
  return (
    <header className="sheet-head">
      <span>{build.design.name}</span>
      <b>{title}</b>
    </header>
  )
}

export function PrintPlan({ build, onBack }: { build: Build; onBack: () => void }) {
  const [qr, setQr] = useState('')
  const [printedOn] = useState(() => new Date().toLocaleDateString())
  const url = location.href
  const fmt = (mm: number) => formatLength(mm, build.design.units)
  const e = build.exterior
  const i = build.interior
  const method = JOINT_METHODS[build.design.jointMethod]

  useEffect(() => {
    QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'L' }).then(setQr, () => setQr(''))
  }, [url])

  return (
    <div className="print-root">
      <div className="print-bar">
        <button onClick={onBack}>← Back to editor</button>
        <span>Use your browser's print dialog → “Save as PDF” for a file. Letter or A4 both work.</span>
        <button className="primary" onClick={() => window.print()}>
          Print / Save PDF
        </button>
      </div>

      <article className="sheet">
        <header className="plan-head">
          <div>
            <h1>{build.design.name}</h1>
            <p className="muted">
              2020 Builder build plan · {printedOn} · units: {build.design.units}
            </p>
            <dl className="specs">
              <dt>Exterior</dt>
              <dd>
                {fmt(e.w)} W × {fmt(e.d)} D × {fmt(e.h)} H
              </dd>
              <dt>Interior</dt>
              <dd>
                {fmt(i.w)} × {fmt(i.d)} × {fmt(i.h)} clear
              </dd>
              <dt>Profile</dt>
              <dd>{build.profile.name}</dd>
              <dt>Corners</dt>
              <dd>
                {method.name} · {OWNER_LABELS[build.design.cornerOwner].toLowerCase()}
              </dd>
              <dt>Parts</dt>
              <dd>
                {build.groups.reduce((n, g) => n + g.qty, 0)} extrusions in {build.groups.length} groups · {build.nesting.bars.length} ×{' '}
                {fmt(build.nesting.stockLength)} bars
              </dd>
            </dl>
          </div>
          {qr && (
            <figure className="qr">
              <div dangerouslySetInnerHTML={{ __html: qr }} />
              <figcaption>Scan to open this design</figcaption>
            </figure>
          )}
        </header>
        <Messages build={build} />
        <Snapshot key={JSON.stringify(build.design)} build={build} />
        <OrthoViews build={build} />
      </article>

      <article className="sheet">
        <SheetHeader build={build} title="Cut list & materials" />
        <h2>Cut list</h2>
        <CutListTable build={build} />
        {build.panelGroups.length > 0 && (
          <>
            <h2>Panels</h2>
            <PanelTable build={build} />
          </>
        )}
        <h2>Stock layout</h2>
        <StockSummary build={build} />
        <StockBars build={build} />
        <div className="cols">
          <div>
            <h2>Hardware</h2>
            <HardwareTable build={build} />
          </div>
          <div>
            <h2>Tools</h2>
            <ToolsList build={build} />
          </div>
        </div>
      </article>

      <article className="sheet">
        <SheetHeader build={build} title="Machining" />
        <h2>Machining by part</h2>
        <MachiningSheet build={build} />
      </article>

      <article className="sheet">
        <SheetHeader build={build} title="Assembly" />
        <h2>Assembly steps</h2>
        <StepsList build={build} />
        <h2>Diagonal check</h2>
        <DiagonalTable build={build} />
        <p className="hint">Measure outside corner to outside corner on each face. Diagonals within ~{fmt(1)} of each other means the face is square.</p>
        <p className="footer muted">{url}</p>
      </article>
    </div>
  )
}
