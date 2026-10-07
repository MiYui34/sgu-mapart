export type ResizeMode = 'nearest' | 'lanczos' | 'area'

function clampByte(value: number): number {
  if (value < 0) return 0
  if (value > 255) return 255
  return Math.round(value)
}

function lanczos(x: number, a: number): number {
  const ax = Math.abs(x)
  if (ax < 1e-8) return 1
  if (ax >= a) return 0
  const pix = Math.PI * ax
  return (a * Math.sin(pix) * Math.sin(pix / a)) / (pix * pix)
}

function resizeNearest(
  src: Uint8ClampedArray,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
): Uint8ClampedArray {
  const dst = new Uint8ClampedArray(dw * dh * 4)
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(sh - 1, Math.floor(((y + 0.5) * sh) / dh))
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(sw - 1, Math.floor(((x + 0.5) * sw) / dw))
      const si = (sy * sw + sx) * 4
      const di = (y * dw + x) * 4
      dst[di] = src[si]
      dst[di + 1] = src[si + 1]
      dst[di + 2] = src[si + 2]
      dst[di + 3] = src[si + 3]
    }
  }
  return dst
}

/** 每一格覆盖到的源像素按面积加权平均，缩小照片时颜色最接近原图。 */
function resizeArea(
  src: Uint8ClampedArray,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
): Uint8ClampedArray {
  const dst = new Uint8ClampedArray(dw * dh * 4)
  for (let y = 0; y < dh; y++) {
    const y0 = (y * sh) / dh
    const y1 = ((y + 1) * sh) / dh
    const yStart = Math.floor(y0)
    const yEnd = Math.min(sh - 1, Math.ceil(y1) - 1)
    for (let x = 0; x < dw; x++) {
      const x0 = (x * sw) / dw
      const x1 = ((x + 1) * sw) / dw
      const xStart = Math.floor(x0)
      const xEnd = Math.min(sw - 1, Math.ceil(x1) - 1)
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let weightSum = 0
      for (let yy = yStart; yy <= yEnd; yy++) {
        const yWeight = Math.min(yy + 1, y1) - Math.max(yy, y0)
        if (yWeight <= 0) continue
        for (let xx = xStart; xx <= xEnd; xx++) {
          const xWeight = Math.min(xx + 1, x1) - Math.max(xx, x0)
          if (xWeight <= 0) continue
          const weight = xWeight * yWeight
          const si = (yy * sw + xx) * 4
          r += src[si] * weight
          g += src[si + 1] * weight
          b += src[si + 2] * weight
          a += src[si + 3] * weight
          weightSum += weight
        }
      }
      const di = (y * dw + x) * 4
      if (weightSum === 0) continue
      dst[di] = clampByte(r / weightSum)
      dst[di + 1] = clampByte(g / weightSum)
      dst[di + 2] = clampByte(b / weightSum)
      dst[di + 3] = clampByte(a / weightSum)
    }
  }
  return dst
}

function resizeLanczos(
  src: Uint8ClampedArray,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
): Uint8ClampedArray {
  const radius = 3
  const xScale = dw / sw
  const yScale = dh / sh
  const xNorm = Math.min(xScale, 1)
  const yNorm = Math.min(yScale, 1)
  const horizontal = new Float32Array(dw * sh * 4)
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < dw; x++) {
      const sx = (x + 0.5) / xScale - 0.5
      const support = radius / xNorm
      const x0 = Math.max(0, Math.ceil(sx - support))
      const x1 = Math.min(sw - 1, Math.floor(sx + support))
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let weightSum = 0
      for (let xx = x0; xx <= x1; xx++) {
        const weight = lanczos((sx - xx) * xNorm, radius)
        if (weight === 0) continue
        const si = (y * sw + xx) * 4
        r += src[si] * weight
        g += src[si + 1] * weight
        b += src[si + 2] * weight
        a += src[si + 3] * weight
        weightSum += weight
      }
      const di = (y * dw + x) * 4
      if (weightSum === 0) continue
      horizontal[di] = r / weightSum
      horizontal[di + 1] = g / weightSum
      horizontal[di + 2] = b / weightSum
      horizontal[di + 3] = a / weightSum
    }
  }

  const dst = new Uint8ClampedArray(dw * dh * 4)
  for (let y = 0; y < dh; y++) {
    const sy = (y + 0.5) / yScale - 0.5
    const support = radius / yNorm
    const y0 = Math.max(0, Math.ceil(sy - support))
    const y1 = Math.min(sh - 1, Math.floor(sy + support))
    for (let x = 0; x < dw; x++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let weightSum = 0
      for (let yy = y0; yy <= y1; yy++) {
        const weight = lanczos((sy - yy) * yNorm, radius)
        if (weight === 0) continue
        const si = (yy * dw + x) * 4
        r += horizontal[si] * weight
        g += horizontal[si + 1] * weight
        b += horizontal[si + 2] * weight
        a += horizontal[si + 3] * weight
        weightSum += weight
      }
      const di = (y * dw + x) * 4
      if (weightSum === 0) continue
      dst[di] = clampByte(r / weightSum)
      dst[di + 1] = clampByte(g / weightSum)
      dst[di + 2] = clampByte(b / weightSum)
      dst[di + 3] = clampByte(a / weightSum)
    }
  }
  return dst
}

export function resizeImage(
  src: Uint8ClampedArray,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
  mode: ResizeMode,
): Uint8ClampedArray {
  if (sw === dw && sh === dh) {
    const dst = new Uint8ClampedArray(dw * dh * 4)
    dst.set(src)
    return dst
  }
  if (mode === 'nearest') return resizeNearest(src, sw, sh, dw, dh)
  if (mode === 'area') return resizeArea(src, sw, sh, dw, dh)
  return resizeLanczos(src, sw, sh, dw, dh)
}
