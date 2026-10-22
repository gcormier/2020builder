import { useMemo, useState } from 'react'
import { buildFrame } from './engine'
import { FrameScene, type SceneOptions, type ViewName } from './scene/FrameScene'
import { useDesign } from './state/design'
import { InputPanel } from './ui/InputPanel'
import { OutputTabs } from './ui/OutputTabs'

const VIEWS: [ViewName, string][] = [
  ['iso', 'Iso'],
  ['front', 'Front'],
  ['right', 'Right'],
  ['top', 'Top'],
]

export default function App() {
  const [design, update] = useDesign()
  const build = useMemo(() => buildFrame(design), [design])
  const [hover, setHover] = useState<string | null>(null)
  const [options, setOptions] = useState<SceneOptions>({ xray: false, hardware: true, labels: true })
  const [view, setView] = useState<{ name: ViewName; n: number }>({ name: 'iso', n: 0 })
  const toggle = (k: keyof SceneOptions) => setOptions((o) => ({ ...o, [k]: !o[k] }))

  return (
    <div className="app">
      <InputPanel design={design} build={build} update={update} />
      <main>
        <div className="viewport">
          <FrameScene build={build} hover={hover} setHover={setHover} options={options} view={view} />
          <div className="toolbar">
            {VIEWS.map(([v, label]) => (
              <button key={v} onClick={() => setView((s) => ({ name: v, n: s.n + 1 }))}>
                {label}
              </button>
            ))}
            <span className="sep" />
            {(['labels', 'hardware', 'xray'] as const).map((k) => (
              <button key={k} className={options[k] ? 'on' : ''} onClick={() => toggle(k)}>
                {k === 'xray' ? 'X-ray' : k[0].toUpperCase() + k.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <OutputTabs build={build} hover={hover} setHover={setHover} />
      </main>
    </div>
  )
}
