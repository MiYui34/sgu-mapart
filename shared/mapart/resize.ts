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

export function resizeImage(
  src: Uint8ClampedArray,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
  mode: 'nearest' | 'lanczos',
): Uint8ClampedArray {
  const dst = new Uint8ClampedArray(dw * dh * 4)
  if (sw === dw && sh === dh) {
    dst.set(src)
    return dst
  }
  if (mode === 'nearest') {
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

  const radius = 3
  for (let y = 0; y < dh; y++) {
    const sy = ((y + 0.5) * sh) / dh - 0.5
    const y0 = Math.floor(sy - radius + 1)
    const y1 = Math.floor(sy + radius)
    for (let x = 0; x < dw; x++) {
      const sx = ((x + 0.5) * sw) / dw - 0.5
      const x0 = Math.floor(sx - radius + 1)
      const x1 = Math.floor(sx + radius)
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let wsum = 0
      for (let yy = y0; yy <= y1; yy++) {
        const wy = lanczos(sy - yy, radius)
        if (wy === 0) continue
        const cy = Math.min(sh - 1, Math.max(0, yy))
        for (let xx = x0; xx <= x1; xx++) {
          const w = wy * lanczos(sx - xx, radius)
          if (w === 0) continue
          const cx = Math.min(sw - 1, Math.max(0, xx))
          const si = (cy * sw + cx) * 4
          r += src[si] * w
          g += src[si + 1] * w
          b += src[si + 2] * w
          a += src[si + 3] * w
          wsum += w
        }
      }
      const di = (y * dw + x) * 4
      if (wsum === 0) continue
      dst[di] = clampByte(r / wsum)
      dst[di + 1] = clampByte(g / wsum)
      dst[di + 2] = clampByte(b / wsum)
      dst[di + 3] = clampByte(a / wsum)
    }
  }
  return dst
}
