import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AlgorithmId } from '@shared/mapart/dither'
import { MAP_SIZE } from '@shared/mapart/palette'
import { processImage, type ProcessRequest, type ProcessResult } from '@shared/mapart/process'
import type { ResizeMode } from '@shared/mapart/resize'
import { useNotification } from './NotificationContext'
import { clampCrop, initialCrop, type CropRect } from '../components/editor/CropStage'

type Stage = 'crop' | 'map' | 'compare' | 'world'

interface EditorSessionValue {
  image: HTMLImageElement | null
  fileName: string
  mapsX: number
  mapsY: number
  crop: CropRect | null
  selected: number | null
  stage: Stage
  brightness: number
  contrast: number
  saturation: number
  hue: number
  gamma: number
  background: string
  resize: ResizeMode
  distance: 'oklab' | 'rgb'
  algorithm: AlgorithmId
  ditherStrength: number
  result: ProcessResult | null
  builtFrom: string | null
  busy: boolean
  fingerprint: string
  setMapsX: (value: number) => void
  setMapsY: (value: number) => void
  setCrop: (crop: CropRect) => void
  setSelected: (index: number | null) => void
  setStage: (stage: Stage) => void
  setBrightness: (value: number) => void
  setContrast: (value: number) => void
  setSaturation: (value: number) => void
  setHue: (value: number) => void
  setGamma: (value: number) => void
  setBackground: (value: string) => void
  setResize: (value: ResizeMode) => void
  setDistance: (value: 'oklab' | 'rgb') => void
  setAlgorithm: (value: AlgorithmId) => void
  setDitherStrength: (value: number) => void
  onFile: (file: File | undefined) => void
  generate: () => void
}

const EditorSessionContext = createContext<EditorSessionValue | null>(null)

export function useEditorSession() {
  const value = useContext(EditorSessionContext)
  if (!value) throw new Error('做图状态尚未就绪')
  return value
}

export function EditorSessionProvider({ children }: { children: ReactNode }) {
  const notify = useNotification()
  const objectUrl = useRef<string | null>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [fileName, setFileName] = useState('')
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
  const [resize, setResize] = useState<ResizeMode>('area')
  const [distance, setDistance] = useState<'oklab' | 'rgb'>('oklab')
  const [algorithm, setAlgorithm] = useState<AlgorithmId>('floyd-steinberg')
  const [ditherStrength, setDitherStrength] = useState(1)
  const [result, setResult] = useState<ProcessResult | null>(null)
  const [builtFrom, setBuiltFrom] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onFile = (file: File | undefined) => {
    if (!file) return
    const url = URL.createObjectURL(file)
    const next = new Image()
    next.onload = () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
      objectUrl.current = url
      setFileName(file.name)
      setImage(next)
      setCrop(initialCrop(next, mapsX, mapsY))
      setSelected(null)
      setStage('crop')
      setResult(null)
      setBuiltFrom(null)
    }
    next.onerror = () => {
      URL.revokeObjectURL(url)
      notify('图片无法读取', 'error')
    }
    next.src = url
  }

  useEffect(() => () => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
  }, [])

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
    setResult(null)
    setBuiltFrom(null)
    // 只在张数变化时重算裁剪比例。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapsX, mapsY])

  const fingerprint = useMemo(() => {
    if (!image || !crop) return ''
    return [
      image.src,
      mapsX,
      mapsY,
      crop.x.toFixed(2),
      crop.y.toFixed(2),
      crop.w.toFixed(2),
      crop.h.toFixed(2),
      brightness,
      contrast,
      saturation,
      hue,
      gamma,
      background,
      resize,
      distance,
      algorithm,
      ditherStrength,
    ].join('|')
  }, [image, crop, mapsX, mapsY, brightness, contrast, saturation, hue, gamma, background, resize, distance, algorithm, ditherStrength])

  const generate = () => {
    if (!image || !crop || busy) return
    const sw = Math.max(1, Math.round(crop.w))
    const sh = Math.max(1, Math.round(crop.h))
    const scale = Math.min(1, 4096 / Math.max(sw, sh))
    const width = Math.max(1, Math.round(sw * scale))
    const height = Math.max(1, Math.round(sh * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) {
      notify('图片无法读取', 'error')
      return
    }
    ctx.imageSmoothingEnabled = resize !== 'nearest'
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(image, crop.x, crop.y, crop.w, crop.h, 0, 0, width, height)
    const request: ProcessRequest = {
      pixels: ctx.getImageData(0, 0, width, height).data,
      width,
      height,
      outWidth: mapsX * MAP_SIZE,
      outHeight: mapsY * MAP_SIZE,
      resize,
      adjust: { brightness, contrast, saturation, hue, gamma, background },
      distance,
      algorithm,
      ditherStrength,
    }
    const stamp = fingerprint
    setBusy(true)
    window.setTimeout(() => {
      try {
        setResult(processImage(request))
        setBuiltFrom(stamp)
        setStage((current) => current === 'crop' ? 'map' : current)
      } catch {
        notify('生成失败', 'error')
      } finally {
        setBusy(false)
      }
    }, 0)
  }

  const value: EditorSessionValue = {
    image,
    fileName,
    mapsX,
    mapsY,
    crop,
    selected,
    stage,
    brightness,
    contrast,
    saturation,
    hue,
    gamma,
    background,
    resize,
    distance,
    algorithm,
    ditherStrength,
    result,
    builtFrom,
    busy,
    fingerprint,
    setMapsX,
    setMapsY,
    setCrop,
    setSelected,
    setStage,
    setBrightness,
    setContrast,
    setSaturation,
    setHue,
    setGamma,
    setBackground,
    setResize,
    setDistance,
    setAlgorithm,
    setDitherStrength,
    onFile,
    generate,
  }

  return <EditorSessionContext.Provider value={value}>{children}</EditorSessionContext.Provider>
}
