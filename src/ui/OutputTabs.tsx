import { useState } from 'react'
import type { Build } from '../engine'
import {
  CutListTable,
  DiagonalTable,
  HardwareTable,
  Messages,
  StepsList,
  StockBars,
  StockSummary,
  ToolsList,
} from './sections'

interface Props {
  build: Build
  hover: string | null
  setHover: (g: string | null) => void
}

const TABS = ['Cut list', 'Hardware & tools', 'Stock', 'Assembly'] as const
type Tab = (typeof TABS)[number]

export function OutputTabs({ build, hover, setHover }: Props) {
  const [tab, setTab] = useState<Tab>('Cut list')

  return (
    <section className="outputs">
      <Messages build={build} />

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </nav>

      <div className="tab-body">
        {tab === 'Cut list' && <CutListTable build={build} hover={hover} setHover={setHover} />}

        {tab === 'Hardware & tools' && (
          <div className="cols">
            <HardwareTable build={build} />
            <div>
              <h3>Tools</h3>
              <ToolsList build={build} />
            </div>
          </div>
        )}

        {tab === 'Stock' && (
          <div>
            <StockSummary build={build} />
            <StockBars build={build} hover={hover} setHover={setHover} />
          </div>
        )}

        {tab === 'Assembly' && (
          <div className="cols">
            <StepsList build={build} />
            <div>
              <h3>Diagonal check</h3>
              <DiagonalTable build={build} />
              <p className="hint">
                Outside corner to outside corner. Faces 1 and 2 on drilled parts are the two adjacent faces that end up on the outside of
                the frame.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
