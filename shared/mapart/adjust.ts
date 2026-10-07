export interface AdjustOptions {
  brightness: number
  contrast: number
  saturation: number
  hue: number
  gamma: number
  background: string
}

export const DEFAULT_ADJUST: AdjustOptions = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hue: 0,
  gamma: 1,
  background: '#151515',
}

export function parseHex(hex: string): [number, number, number] {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim())
  const value = m ? m[1] : '151515'
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ]
}

function clampByte(value: number): number {
  if (value < 0) return 0
  if (value > 255) return 255
  return value
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0)
  else if (max === gn) h = (bn - rn) / d + 2
  else h = (rn - gn) / d + 4
  return [h / 6, s, l]
}

function hue2rgb(p: number, q: number, t: number): number {
  let tt = t
  if (tt < 0) tt += 1
  if (tt > 1) tt -= 1
  if (tt < 1 / 6) return p + (q - p) * 6 * tt
  if (tt < 1 / 2) return q
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
  return p
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = l * 255
    return [v, v, v]
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return [hue2rgb(p, q, h + 1 / 3) * 255, hue2rgb(p, q, h) * 255, hue2rgb(p, q, h - 1 / 3) * 255]
}

/** 先铺背景，再按亮度、对比度、饱和度、色相、伽马处理。 */
export function adjustImage(src: Uint8ClampedArray, options: AdjustOptions): Uint8ClampedArray {
  const dst = new Uint8ClampedArray(src.length)
  const [br, bg, bb] = parseHex(options.background)
  const bright = ((options.brightness - 100) / 100) * 255
  const contrast = options.contrast / 100
  const saturation = options.saturation / 100
  const hueShift = options.hue / 360
  const gamma = options.gamma > 0 ? options.gamma : 1

  for (let i = 0; i < src.length; i += 4) {
    const alpha = src[i + 3] / 255
    let r = src[i] * alpha + br * (1 - alpha)
    let g = src[i + 1] * alpha + bg * (1 - alpha)
    let b = src[i + 2] * alpha + bb * (1 - alpha)

    r += bright
    g += bright
    b += bright

    r = (r - 128) * contrast + 128
    g = (g - 128) * contrast + 128
    b = (b - 128) * contrast + 128

    const gray = 0.299 * r + 0.587 * g + 0.114 * b
    r = gray + (r - gray) * saturation
    g = gray + (g - gray) * saturation
    b = gray + (b - gray) * saturation

    if (hueShift !== 0) {
      const [h, s, l] = rgbToHsl(clampByte(r), clampByte(g), clampByte(b))
      const next = hslToRgb((h + hueShift) % 1, s, l)
      r = next[0]
      g = next[1]
      b = next[2]
    }

    if (gamma !== 1) {
      r = 255 * Math.pow(clampByte(r) / 255, gamma)
      g = 255 * Math.pow(clampByte(g) / 255, gamma)
      b = 255 * Math.pow(clampByte(b) / 255, gamma)
    }

    dst[i] = clampByte(Math.round(r))
    dst[i + 1] = clampByte(Math.round(g))
    dst[i + 2] = clampByte(Math.round(b))
    dst[i + 3] = 255
  }
  return dst
}
