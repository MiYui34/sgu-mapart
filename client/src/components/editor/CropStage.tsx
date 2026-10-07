import { useEffect, useRef } from 'react'

export interface CropRect {
  x: number
  y: number
  w: number
  h: number
}

export function initialCrop(image: HTMLImageElement, mapsX: number, mapsY: number): CropRect {
  const aspect = mapsX / mapsY
  let w = image.width
  let h = w / aspect
  if (h > image.height) {
    h = image.height
    w = h * aspect
  }
  return {
    x: (image.width - w) / 2,
    y: (image.height - h) / 2,
    w,
    h,
  }
}

export function clampCrop(crop: CropRect, image: HTMLImageElement): CropRect {
  const w = Math.min(Math.max(8, crop.w), image.width)
  const h = Math.min(Math.max(8, crop.h), image.height)
  return {
    w,
    h,
    x: Math.min(Math.max(0, crop.x), Math.max(0, image.width - w)),
    y: Math.min(Math.max(0, crop.y), Math.max(0, image.height - h)),
  }
}

interface Props {
  image: HTMLImageElement
  mapsX: number
  mapsY: number
  crop: CropRect
  selected: number | null
  onCrop: (crop: CropRect) => void
  onSelect: (index: number | null) => void
}

export default function CropStage({ image, mapsX, mapsY, crop, selected, onCrop, onSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ x: number; y: number; crop: CropRect; moved: boolean } | null>(null)

  const draw = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    const ratio = window.devicePixelRatio || 1
    canvas.width = Math.floor(width * ratio)
    canvas.height = Math.floor(height * ratio)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.clearRect(0, 0, width, height)
    const scale = Math.min(width / crop.w, height / crop.h)
    const dw = crop.w * scale
    const dh = crop.h * scale
    const ox = (width - dw) / 2
    const oy = (height - dh) / 2
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(image, crop.x, crop.y, crop.w, crop.h, ox, oy, dw, dh)
    ctx.lineWidth = 1
    for (let my = 0; my < mapsY; my++) {
      for (let mx = 0; mx < mapsX; mx++) {
        const index = my * mapsX + mx
        const x = ox + (mx * dw) / mapsX
        const y = oy + (my * dh) / mapsY
        const cw = dw / mapsX
        const ch = dh / mapsY
        ctx.strokeStyle = selected === index ? '#f8fafc' : 'rgba(248, 113, 113, 0.9)'
        ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1)
        ctx.fillStyle = 'rgba(0,0,0,0.45)'
        ctx.fillRect(x + 6, y + 6, 28, 18)
        ctx.fillStyle = '#fff'
        ctx.font = '12px Inter, sans-serif'
        ctx.fillText(String(index + 1), x + 12, y + 19)
      }
    }
    canvas.dataset.ox = String(ox)
    canvas.dataset.oy = String(oy)
    canvas.dataset.dw = String(dw)
    canvas.dataset.dh = String(dh)
    canvas.dataset.scale = String(scale)
  }

  useEffect(() => {
    draw()
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new ResizeObserver(() => draw())
    observer.observe(canvas)
    return () => observer.disconnect()
  })

  const cellAt = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const px = event.clientX - rect.left
    const py = event.clientY - rect.top
    const ox = Number(canvas.dataset.ox)
    const oy = Number(canvas.dataset.oy)
    const dw = Number(canvas.dataset.dw)
    const dh = Number(canvas.dataset.dh)
    if (px < ox || py < oy || px > ox + dw || py > oy + dh) return null
    const mx = Math.min(mapsX - 1, Math.floor(((px - ox) / dw) * mapsX))
    const my = Math.min(mapsY - 1, Math.floor(((py - oy) / dh) * mapsY))
    return my * mapsX + mx
  }

  return (
    <canvas
      ref={canvasRef}
      className="stage-canvas"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        drag.current = { x: event.clientX, y: event.clientY, crop: { ...crop }, moved: false }
      }}
      onPointerMove={(event) => {
        if (!drag.current) return
        const canvas = canvasRef.current
        const scale = Number(canvas?.dataset.scale || 1)
        const dx = event.clientX - drag.current.x
        const dy = event.clientY - drag.current.y
        if (Math.hypot(dx, dy) > 3) drag.current.moved = true
        onCrop(clampCrop({
          ...drag.current.crop,
          x: drag.current.crop.x - dx / scale,
          y: drag.current.crop.y - dy / scale,
        }, image))
      }}
      onPointerUp={(event) => {
        const moved = drag.current?.moved
        drag.current = null
        if (!moved) {
          const index = cellAt(event)
          onSelect(index === null || selected === index ? null : index)
        }
      }}
      onWheel={(event) => {
        event.preventDefault()
        const factor = event.deltaY > 0 ? 1.08 : 0.92
        const aspect = mapsX / mapsY
        let w = crop.w * factor
        let h = w / aspect
        if (w > image.width || h > image.height) {
          if (image.width / image.height > aspect) {
            h = image.height
            w = h * aspect
          } else {
            w = image.width
            h = w / aspect
          }
        }
        if (w < 16) {
          w = 16
          h = w / aspect
        }
        const cx = crop.x + crop.w / 2
        const cy = crop.y + crop.h / 2
        onCrop(clampCrop({ x: cx - w / 2, y: cy - h / 2, w, h }, image))
      }}
    />
  )
}
