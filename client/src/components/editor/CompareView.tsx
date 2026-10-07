import { useEffect, useRef, useState } from 'react'

interface Props {
  source: Uint8ClampedArray
  map: Uint8ClampedArray
  width: number
  height: number
}

function paint(target: HTMLCanvasElement, pixels: Uint8ClampedArray, width: number, height: number) {
  target.width = width
  target.height = height
  const ctx = target.getContext('2d')
  if (!ctx) return
  ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels), width, height), 0, 0)
}

export default function CompareView({ source, map, width, height }: Props) {
  const viewRef = useRef<HTMLCanvasElement>(null)
  const sourceRef = useRef<HTMLCanvasElement | null>(null)
  const mapRef = useRef<HTMLCanvasElement | null>(null)
  const [split, setSplit] = useState(0.5)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 20, y: 20 })
  const drag = useRef<{ mode: 'split' | 'pan'; x: number; y: number; panX: number; panY: number; split: number } | null>(null)

  useEffect(() => {
    if (!sourceRef.current) sourceRef.current = document.createElement('canvas')
    if (!mapRef.current) mapRef.current = document.createElement('canvas')
    paint(sourceRef.current, source, width, height)
    paint(mapRef.current, map, width, height)
  }, [source, map, width, height])

  useEffect(() => {
    const canvas = viewRef.current
    if (!canvas || !sourceRef.current || !mapRef.current) return
    const fit = () => {
      const cssW = canvas.clientWidth
      const cssH = canvas.clientHeight
      const ratio = window.devicePixelRatio || 1
      canvas.width = Math.floor(cssW * ratio)
      canvas.height = Math.floor(cssH * ratio)
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      ctx.imageSmoothingEnabled = false
      ctx.clearRect(0, 0, cssW, cssH)
      const splitX = cssW * split
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, splitX, cssH)
      ctx.clip()
      ctx.setTransform(ratio * zoom, 0, 0, ratio * zoom, pan.x * ratio, pan.y * ratio)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(sourceRef.current!, 0, 0)
      ctx.restore()
      ctx.save()
      ctx.beginPath()
      ctx.rect(splitX, 0, cssW - splitX, cssH)
      ctx.clip()
      ctx.setTransform(ratio * zoom, 0, 0, ratio * zoom, pan.x * ratio, pan.y * ratio)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(mapRef.current!, 0, 0)
      ctx.restore()
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(splitX - 1, 0, 2, cssH)
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [split, zoom, pan, source, map, width, height])

  useEffect(() => {
    const canvas = viewRef.current
    if (!canvas) return
    const scale = Math.min(canvas.clientWidth / width, canvas.clientHeight / height)
    setZoom(scale > 0 ? scale : 1)
    setPan({
      x: (canvas.clientWidth - width * (scale > 0 ? scale : 1)) / 2,
      y: (canvas.clientHeight - height * (scale > 0 ? scale : 1)) / 2,
    })
  }, [width, height])

  useEffect(() => {
    const canvas = viewRef.current
    if (!canvas) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const factor = event.deltaY > 0 ? 0.9 : 1.1
      setZoom((current) => Math.min(24, Math.max(0.2, current * factor)))
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  return (
    <div className="compare-wrap">
      <span className="compare-label" style={{ left: 12 }}>原图</span>
      <span className="compare-label" style={{ right: 12 }}>地图</span>
      <canvas
        ref={viewRef}
        className="compare-canvas"
        onPointerDown={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          const x = event.clientX - rect.left
          const splitX = rect.width * split
          try {
            event.currentTarget.setPointerCapture(event.pointerId)
          } catch {
            /* 某些环境下无法捕获指针，拖动仍由 move 事件完成。 */
          }
          drag.current = {
            mode: Math.abs(x - splitX) < 14 ? 'split' : 'pan',
            x: event.clientX,
            y: event.clientY,
            panX: pan.x,
            panY: pan.y,
            split,
          }
        }}
        onPointerMove={(event) => {
          if (!drag.current) return
          if (drag.current.mode === 'split') {
            const rect = event.currentTarget.getBoundingClientRect()
            const next = (event.clientX - rect.left) / rect.width
            setSplit(Math.min(0.92, Math.max(0.08, next)))
          } else {
            setPan({
              x: drag.current.panX + event.clientX - drag.current.x,
              y: drag.current.panY + event.clientY - drag.current.y,
            })
          }
        }}
        onPointerUp={() => { drag.current = null }}
      />
    </div>
  )
}
