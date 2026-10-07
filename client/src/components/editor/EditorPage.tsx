import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ALGORITHM_IDS, ALGORITHM_LABELS, type AlgorithmId } from '@shared/mapart/dither'
import { packageMapart } from '@shared/mapart/bundle'
import { CARPETS, formatCarpetPack, MAP_SIZE, MAX_MAPS } from '@shared/mapart/palette'
import { currentUser } from '../../lib/api'
import { useEditorSession } from '../../contexts/EditorSession'
import { Shell } from '../layout/Navbar'
import CropStage from './CropStage'
import CompareView from './CompareView'
import WorldView from './WorldView'
import PublishModal from './PublishModal'

type Stage = 'crop' | 'map' | 'compare' | 'world'

function sliceMap(pixels: Uint8ClampedArray, fullWidth: number, index: number, mapsX: number) {
  const mapX = index % mapsX
  const mapY = Math.floor(index / mapsX)
  const out = new Uint8ClampedArray(MAP_SIZE * MAP_SIZE * 4)
  for (let y = 0; y < MAP_SIZE; y++) {
    const source = ((mapY * MAP_SIZE + y) * fullWidth + mapX * MAP_SIZE) * 4
    out.set(pixels.subarray(source, source + MAP_SIZE * 4), y * MAP_SIZE * 4)
  }
  return out
}

export default function EditorPage() {
  const navigate = useNavigate()
  const [publishing, setPublishing] = useState(false)
  const session = useEditorSession()
  const {
    image, fileName, mapsX, mapsY, crop, selected, stage, brightness, contrast, saturation, hue, gamma, background,
    resize, distance, algorithm, ditherStrength, result, builtFrom, busy, fingerprint,
    setMapsX, setMapsY, setCrop, setSelected, setStage, setBrightness, setContrast, setSaturation, setHue, setGamma,
    setBackground, setResize, setDistance, setAlgorithm, setDitherStrength, onFile, generate,
  } = session

  const shown = useMemo(() => {
    if (!result) return null
    if (selected === null) return { preview: result.preview, source: result.source, width: result.width, height: result.height }
    return {
      preview: sliceMap(result.preview, result.width, selected, mapsX),
      source: sliceMap(result.source, result.width, selected, mapsX),
      width: MAP_SIZE,
      height: MAP_SIZE,
    }
  }, [result, selected, mapsX])

  const download = () => {
    if (!result) return
    const user = currentUser()
    const packed = packageMapart(result.indices, result.width, result.height, user?.username ?? '访客', '地毯地图画')
    const bytes = new Uint8Array(packed.bytes)
    const blob = new Blob([bytes], { type: packed.zip ? 'application/zip' : 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = packed.filename
    link.click()
    URL.revokeObjectURL(url)
  }

  const resetParameters = () => {
    setMapsX(1)
    setMapsY(1)
    setBrightness(100)
    setContrast(100)
    setSaturation(100)
    setHue(0)
    setGamma(1)
    setBackground('#151515')
    setResize('area')
    setDistance('oklab')
    setAlgorithm('floyd-steinberg')
    setDitherStrength(1)
  }

  const settings = {
    mapsX, mapsY, brightness, contrast, saturation, hue, gamma, background, resize, distance, algorithm, ditherStrength,
    minecraft: '26.1+',
  }

  return (
    <Shell>
      <div className="editor-grid">
        <aside className="glass-panel stack">
          <div>
            <label className="form-label">图片</label>
            <input className="glass-input" type="file" accept="image/*" onChange={(event) => {
              onFile(event.target.files?.[0])
              event.target.value = ''
            }} />
            {fileName && <p className="muted">{fileName}</p>}
          </div>
          <div className="toolbar">
            <SizeStepper label="宽" value={mapsX} onChange={setMapsX} />
            <SizeStepper label="高" value={mapsY} onChange={setMapsY} />
          </div>
          <p className="muted">{mapsX}×{mapsY} 张，{mapsX * MAP_SIZE}×{mapsY * MAP_SIZE} 格</p>
          <Slider label="亮度" min={0} max={200} value={brightness} onChange={setBrightness} />
          <Slider label="对比度" min={0} max={200} value={contrast} onChange={setContrast} />
          <Slider label="饱和度" min={0} max={200} value={saturation} onChange={setSaturation} />
          <Slider label="色相" min={-180} max={180} value={hue} onChange={setHue} />
          <Slider label="伽马" min={20} max={300} value={Math.round(gamma * 100)} onChange={(value) => setGamma(value / 100)} display={gamma.toFixed(2)} />
          <label className="color-row">背景 <input type="color" value={background} aria-label="背景" onChange={(e) => setBackground(e.target.value)} /></label>
          <ChoiceStepper
            label="缩放"
            value={resize}
            options={[
              { value: 'area', label: '区域平均' },
              { value: 'lanczos', label: 'Lanczos' },
              { value: 'nearest', label: '最近邻' },
            ]}
            onChange={(value) => setResize(value as 'area' | 'lanczos' | 'nearest')}
          />
          <ChoiceStepper
            label="色差"
            value={distance}
            options={[{ value: 'oklab', label: 'OKLab' }, { value: 'rgb', label: 'RGB' }]}
            onChange={(value) => setDistance(value as 'oklab' | 'rgb')}
          />
          <ChoiceStepper
            label="算法"
            value={algorithm}
            options={ALGORITHM_IDS.map((id) => ({ value: id, label: ALGORITHM_LABELS[id] }))}
            onChange={(value) => setAlgorithm(value as AlgorithmId)}
          />
          <Slider label="抖动" min={0} max={100} value={Math.round(ditherStrength * 100)} onChange={(value) => setDitherStrength(value / 100)} display={ditherStrength.toFixed(2)} />
          <button className="btn secondary" type="button" onClick={resetParameters} style={{ width: '100%' }}>重置参数</button>
          <button className="btn" type="button" disabled={!image || !crop || busy} onClick={generate} style={{ width: '100%' }}>
            {busy ? '生成中' : '生成地图画'}
          </button>
          {result && builtFrom !== fingerprint && <p className="muted">参数已改，需要重新生成</p>}
          <div className="materials">
            {result && CARPETS.map((carpet) => result.counts[carpet.id] > 0 ? (
              <span key={carpet.block} style={{ display: 'contents' }}>
                <span><i className="swatch" style={{ background: `rgb(${carpet.base.join(',')})` }} />{carpet.name}</span>
                <span>{result.counts[carpet.id]}</span>
                <span className="pack">{formatCarpetPack(result.counts[carpet.id])}</span>
              </span>
            ) : null)}
          </div>
          <button className="btn" type="button" disabled={!result} onClick={download}>{mapsX * mapsY > 1 ? '下载 .zip' : '下载 .litematic'}</button>
          <button className="btn secondary" type="button" disabled={!result || builtFrom !== fingerprint} onClick={() => {
            if (!localStorage.getItem('jwt_token')) {
              navigate('/login')
              return
            }
            setPublishing(true)
          }}>上架到市场</button>
          <p className="muted">适用于 Minecraft 26.1 及以上。<Link to="/guide">参数说明</Link></p>
        </aside>
        <section className="glass-panel stage">
          <div className="segment">
            {(['crop', 'map', 'compare', 'world'] as Stage[]).map((id) => (
              <button key={id} className="btn secondary" type="button" aria-pressed={stage === id} disabled={id !== 'crop' && !shown} onClick={() => setStage(id)}>
                {{ crop: '裁剪', map: '地图', compare: '对比', world: '世界' }[id]}
              </button>
            ))}
            {selected !== null && <span className="muted">正在看第 {selected + 1} 张</span>}
          </div>
          {!image || !crop ? <p className="muted">上传图片，调整参数后点击生成地图画。拖动底图，滚轮缩放，网格按 128 格对齐。</p> : null}
          {image && crop && !shown && stage !== 'crop' ? <p className="muted">点击生成地图画后，可在这里查看结果。</p> : null}
          {image && crop && stage === 'crop' && (
            <CropStage image={image} mapsX={mapsX} mapsY={mapsY} crop={crop} selected={selected} onCrop={setCrop} onSelect={setSelected} />
          )}
          {shown && stage === 'map' && <PixelCanvas pixels={shown.preview} width={shown.width} height={shown.height} />}
          {shown && stage === 'compare' && (
            <CompareView source={shown.source} map={shown.preview} width={shown.width} height={shown.height} />
          )}
          {shown && stage === 'world' && <WorldView rgba={shown.preview} width={shown.width} height={shown.height} />}
        </section>
      </div>
      {publishing && result && (
        <PublishModal
          result={result}
          settings={settings}
          onClose={() => setPublishing(false)}
        />
      )}
    </Shell>
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function Slider({ label, min, max, value, display, onChange }: {
  label: string
  min: number
  max: number
  value: number
  display?: string
  onChange: (value: number) => void
}) {
  return (
    <div className="slider-row">
      <span>{label}</span>
      <button className="nudge" type="button" aria-label={`${label}减小`} disabled={value <= min} onClick={() => onChange(clamp(value - 1, min, max))}>-</button>
      <input type="range" min={min} max={max} value={value} aria-label={label} onChange={(event) => onChange(Number(event.target.value))} />
      <button className="nudge" type="button" aria-label={`${label}增大`} disabled={value >= max} onClick={() => onChange(clamp(value + 1, min, max))}>+</button>
      <span>{display ?? value}</span>
    </div>
  )
}

function SizeStepper({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="muted size-stepper">{label}
      <button className="nudge" type="button" aria-label={`${label}减一`} disabled={value <= 1} onClick={() => onChange(value - 1)}>-</button>
      <input className="glass-input" type="number" min={1} max={MAX_MAPS} value={value} aria-label={label} onChange={(event) => onChange(clamp(Number(event.target.value) || 1, 1, MAX_MAPS))} />
      <button className="nudge" type="button" aria-label={`${label}加一`} disabled={value >= MAX_MAPS} onClick={() => onChange(value + 1)}>+</button>
    </label>
  )
}

function ChoiceStepper({ label, value, options, onChange }: {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  const index = Math.max(0, options.findIndex((option) => option.value === value))
  return (
    <label className="form-label">{label}
      <div className="select-stepper">
        <button className="nudge" type="button" aria-label={`${label}上一项`} disabled={index <= 0} onClick={() => onChange(options[index - 1].value)}>-</button>
        <select className="glass-input" value={value} aria-label={label} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <button className="nudge" type="button" aria-label={`${label}下一项`} disabled={index >= options.length - 1} onClick={() => onChange(options[index + 1].value)}>+</button>
      </div>
    </label>
  )
}

function PixelCanvas({ pixels, width, height }: { pixels: Uint8ClampedArray; width: number; height: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    node.width = width
    node.height = height
    node.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(pixels), width, height), 0, 0)
  }, [pixels, width, height])
  return <canvas ref={ref} className="pixels" />
}
