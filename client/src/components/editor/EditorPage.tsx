import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ALGORITHM_IDS, ALGORITHM_LABELS, type AlgorithmId } from '@shared/mapart/dither'
import { buildLitematic } from '@shared/mapart/litematic'
import { CARPETS, MAP_SIZE, MAX_MAPS, woolCount } from '@shared/mapart/palette'
import type { ProcessRequest, ProcessResult } from '@shared/mapart/process'
import { currentUser } from '../../lib/api'
import { Shell } from '../layout/Navbar'
import { useNotification } from '../../contexts/NotificationContext'
import CropStage, { clampCrop, initialCrop, type CropRect } from './CropStage'
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

function extractCrop(image: HTMLImageElement, crop: CropRect) {
  const sw = Math.max(1, Math.round(crop.w))
  const sh = Math.max(1, Math.round(crop.h))
  const scale = Math.min(1, 1600 / Math.max(sw, sh))
  const width = Math.max(1, Math.round(sw * scale))
  const height = Math.max(1, Math.round(sh * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('无法读取图片')
  ctx.drawImage(image, crop.x, crop.y, crop.w, crop.h, 0, 0, width, height)
  return { pixels: ctx.getImageData(0, 0, width, height).data, width, height }
}

export default function EditorPage() {
  const navigate = useNavigate()
  const notify = useNotification()
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [mapsX, setMapsX] = useState(1)
  const [mapsY, setMapsY] = useState(1)
  const [crop, setCrop] = useState<CropRect | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [stage, setStage] = useState<Stage>('crop')
  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [saturation, setSaturation] = useState(100)
  const [hue, setHue] = useState(0)
  const [gamma, setGamma] = useState(1)
  const [background, setBackground] = useState('#151515')
  const [resize, setResize] = useState<'nearest' | 'lanczos'>('lanczos')
  const [distance, setDistance] = useState<'oklab' | 'rgb'>('oklab')
  const [algorithm, setAlgorithm] = useState<AlgorithmId>('floyd-steinberg')
  const [ditherStrength, setDitherStrength] = useState(1)
  const [result, setResult] = useState<ProcessResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const loadUrl = (url: string) => {
    const next = new Image()
    next.onload = () => {
      setImage(next)
      setCrop(initialCrop(next, mapsX, mapsY))
      setSelected(null)
      setStage('crop')
    }
    next.src = url
  }

  const onFile = (file: File | undefined) => {
    if (!file) return
    const url = URL.createObjectURL(file)
    const next = new Image()
    next.onload = () => {
      setImage(next)
      setCrop(initialCrop(next, mapsX, mapsY))
      setSelected(null)
      setStage('crop')
      URL.revokeObjectURL(url)
    }
    next.src = url
  }

  useEffect(() => {
    if (!image || !crop) return
    const aspect = mapsX / mapsY
    const cx = crop.x + crop.w / 2
    const cy = crop.y + crop.h / 2
    let w = crop.w
    let h = w / aspect
    if (h > image.height) {
      h = image.height
      w = h * aspect
    }
    if (w > image.width) {
      w = image.width
      h = w / aspect
    }
    setCrop(clampCrop({ x: cx - w / 2, y: cy - h / 2, w, h }, image))
    setSelected(null)
    // 只在张数变化时重算裁剪比例。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapsX, mapsY])

  const request = useMemo<ProcessRequest | null>(() => {
    if (!image || !crop) return null
    const extracted = extractCrop(image, crop)
    return {
      pixels: extracted.pixels,
      width: extracted.width,
      height: extracted.height,
      outWidth: mapsX * MAP_SIZE,
      outHeight: mapsY * MAP_SIZE,
      resize,
      adjust: { brightness, contrast, saturation, hue, gamma, background },
      distance,
      algorithm,
      ditherStrength,
    }
  }, [image, crop, mapsX, mapsY, resize, brightness, contrast, saturation, hue, gamma, background, distance, algorithm, ditherStrength])

  useEffect(() => {
    if (!request) return
    const worker = new Worker(new URL('../../mapart/worker.ts', import.meta.url), { type: 'module' })
    const timer = window.setTimeout(() => {
      setBusy(true)
      worker.postMessage(request)
    }, 120)
    worker.onmessage = (event: MessageEvent<ProcessResult>) => {
      setResult(event.data)
      setBusy(false)
    }
    worker.onerror = () => {
      setBusy(false)
      notify('生成失败', 'error')
    }
    return () => {
      window.clearTimeout(timer)
      worker.terminate()
    }
  }, [request, notify])

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
    const bytes = new Uint8Array(buildLitematic(result.indices, result.width, result.height, user?.username ?? '访客', '地毯地图画'))
    const blob = new Blob([bytes], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'carpet-mapart.litematic'
    link.click()
    URL.revokeObjectURL(url)
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
            <input className="glass-input" type="file" accept="image/*" onChange={(event) => onFile(event.target.files?.[0])} />
            <button className="btn secondary" style={{ marginTop: 8 }} type="button" onClick={() => loadUrl('/sample.svg')}>载入示例</button>
          </div>
          <div className="toolbar">
            <label className="muted">宽
              <input className="glass-input" style={{ width: 70, marginLeft: 6 }} type="number" min={1} max={MAX_MAPS} value={mapsX} onChange={(e) => setMapsX(Math.min(MAX_MAPS, Math.max(1, Number(e.target.value) || 1)))} />
            </label>
            <label className="muted">高
              <input className="glass-input" style={{ width: 70, marginLeft: 6 }} type="number" min={1} max={MAX_MAPS} value={mapsY} onChange={(e) => setMapsY(Math.min(MAX_MAPS, Math.max(1, Number(e.target.value) || 1)))} />
            </label>
          </div>
          <p className="muted">{mapsX}×{mapsY} 张 · {mapsX * MAP_SIZE}×{mapsY * MAP_SIZE} 格{busy ? ' · 生成中' : ''}</p>
          <Slider label="亮度" min={0} max={200} value={brightness} onChange={setBrightness} />
          <Slider label="对比度" min={0} max={200} value={contrast} onChange={setContrast} />
          <Slider label="饱和度" min={0} max={200} value={saturation} onChange={setSaturation} />
          <Slider label="色相" min={-180} max={180} value={hue} onChange={setHue} />
          <Slider label="伽马" min={20} max={300} value={Math.round(gamma * 100)} onChange={(value) => setGamma(value / 100)} display={gamma.toFixed(2)} />
          <label className="slider-row">背景 <input type="color" value={background} onChange={(e) => setBackground(e.target.value)} /> <span /></label>
          <label className="form-label">缩放
            <select className="glass-input" value={resize} onChange={(e) => setResize(e.target.value as 'nearest' | 'lanczos')}>
              <option value="lanczos">Lanczos</option>
              <option value="nearest">最近邻</option>
            </select>
          </label>
          <label className="form-label">色差
            <select className="glass-input" value={distance} onChange={(e) => setDistance(e.target.value as 'oklab' | 'rgb')}>
              <option value="oklab">OKLab</option>
              <option value="rgb">RGB</option>
            </select>
          </label>
          <label className="form-label">算法
            <select className="glass-input" value={algorithm} onChange={(e) => setAlgorithm(e.target.value as AlgorithmId)}>
              {ALGORITHM_IDS.map((id) => <option key={id} value={id}>{ALGORITHM_LABELS[id]}</option>)}
            </select>
          </label>
          <Slider label="抖动" min={0} max={100} value={Math.round(ditherStrength * 100)} onChange={(value) => setDitherStrength(value / 100)} display={ditherStrength.toFixed(2)} />
          <div className="materials">
            {result && CARPETS.map((carpet) => result.counts[carpet.id] > 0 ? (
              <span key={carpet.block} style={{ display: 'contents' }}>
                <span><i className="swatch" style={{ background: `rgb(${carpet.rgb.join(',')})` }} />{carpet.name}</span>
                <span>{result.counts[carpet.id]}</span>
                <span>羊毛 {woolCount(result.counts[carpet.id])}</span>
              </span>
            ) : null)}
          </div>
          <button className="btn" type="button" disabled={!result} onClick={download}>下载 .litematic</button>
          <button className="btn secondary" type="button" disabled={!result} onClick={() => {
            if (!localStorage.getItem('jwt_token')) {
              navigate('/login')
              return
            }
            setPublishing(true)
          }}>上架到市场</button>
          <p className="muted">Minecraft 26.1+ · 仅地毯 · 访客可本地下载</p>
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
          {!image || !crop ? <p className="muted">上传图片，或载入示例。拖动底图，滚轮缩放，网格按 128 格对齐。</p> : null}
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

function Slider({ label, min, max, value, display, onChange }: {
  label: string
  min: number
  max: number
  value: number
  display?: string
  onChange: (value: number) => void
}) {
  return (
    <label className="slider-row">
      {label}
      <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <span>{display ?? value}</span>
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
