import { CARPETS } from './palette.js'

export const ALGORITHM_IDS = [
  'nearest',
  'floyd-steinberg',
  'atkinson',
  'jarvis-judice-ninke',
  'stucki',
  'burkes',
  'sierra',
  'sierra-lite',
  'bayer-4',
  'bayer-8',
  'blue-noise',
] as const

export type AlgorithmId = (typeof ALGORITHM_IDS)[number]

export const ALGORITHM_LABELS: Record<AlgorithmId, string> = {
  nearest: '最近色',
  'floyd-steinberg': 'Floyd–Steinberg',
  atkinson: 'Atkinson',
  'jarvis-judice-ninke': 'Jarvis–Judice–Ninke',
  stucki: 'Stucki',
  burkes: 'Burkes',
  sierra: 'Sierra',
  'sierra-lite': 'Sierra Lite',
  'bayer-4': 'Bayer 4×4',
  'bayer-8': 'Bayer 8×8',
  'blue-noise': '蓝噪声',
}

type Kernel = { div: number; taps: Array<[number, number, number]> }

const KERNELS: Partial<Record<AlgorithmId, Kernel>> = {
  'floyd-steinberg': { div: 16, taps: [[1, 0, 7], [-1, 1, 3], [0, 1, 5], [1, 1, 1]] },
  atkinson: { div: 8, taps: [[1, 0, 1], [2, 0, 1], [-1, 1, 1], [0, 1, 1], [1, 1, 1], [0, 2, 1]] },
  'jarvis-judice-ninke': {
    div: 48,
    taps: [
      [1, 0, 7], [2, 0, 5],
      [-2, 1, 3], [-1, 1, 5], [0, 1, 7], [1, 1, 5], [2, 1, 3],
      [-2, 2, 1], [-1, 2, 3], [0, 2, 5], [1, 2, 3], [2, 2, 1],
    ],
  },
  stucki: {
    div: 42,
    taps: [
      [1, 0, 8], [2, 0, 4],
      [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2],
      [-2, 2, 1], [-1, 2, 2], [0, 2, 4], [1, 2, 2], [2, 2, 1],
    ],
  },
  burkes: {
    div: 32,
    taps: [[1, 0, 8], [2, 0, 4], [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2]],
  },
  sierra: {
    div: 32,
    taps: [
      [1, 0, 5], [2, 0, 3],
      [-2, 1, 2], [-1, 1, 4], [0, 1, 5], [1, 1, 4], [2, 1, 2],
      [-1, 2, 2], [0, 2, 3], [1, 2, 2],
    ],
  },
  'sierra-lite': { div: 4, taps: [[1, 0, 2], [-1, 1, 1], [0, 1, 1]] },
}

const BAYER_4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
]

const BAYER_8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
]

function srgbToLinear(channel: number): number {
  const x = Math.min(1, Math.max(0, channel / 255))
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
}

function rgbToOklab(r: number, g: number, b: number): [number, number, number] {
  const lr = srgbToLinear(r)
  const lg = srgbToLinear(g)
  const lb = srgbToLinear(b)
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

const CARPET_LAB = CARPETS.map((c) => rgbToOklab(c.rgb[0], c.rgb[1], c.rgb[2]))

export type DistanceMode = 'oklab' | 'rgb'

export function nearestCarpet(r: number, g: number, b: number, distance: DistanceMode): number {
  let best = 0
  let bestD = Infinity
  const lab = distance === 'oklab' ? rgbToOklab(r, g, b) : null
  for (let i = 0; i < CARPETS.length; i++) {
    let d: number
    if (lab) {
      const p = CARPET_LAB[i]
      const dl = lab[0] - p[0]
      const da = lab[1] - p[1]
      const db = lab[2] - p[2]
      d = dl * dl + da * da + db * db
    } else {
      const p = CARPETS[i].rgb
      const dr = r - p[0]
      const dg = g - p[1]
      const db = b - p[2]
      d = dr * dr + dg * dg + db * db
    }
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

/** 16×16 空隙聚类式阈值，模块加载时算一次。 */
function buildBlueNoise(size: number): Float32Array {
  const count = size * size
  const thresholds = new Float32Array(count)
  const occupied = new Uint8Array(count)
  const window = 4
  for (let rank = 0; rank < count; rank++) {
    let best = -1
    let bestEnergy = Infinity
    for (let i = 0; i < count; i++) {
      if (occupied[i]) continue
      const x = i % size
      const y = (i / size) | 0
      let energy = 0
      for (let dy = -window; dy <= window; dy++) {
        for (let dx = -window; dx <= window; dx++) {
          const xx = (x + dx + size) % size
          const yy = (y + dy + size) % size
          if (!occupied[yy * size + xx]) continue
          const d2 = dx * dx + dy * dy
          energy += Math.exp(-d2 / 4.5)
        }
      }
      if (energy < bestEnergy) {
        bestEnergy = energy
        best = i
      }
    }
    occupied[best] = 1
    thresholds[best] = (rank + 0.5) / count
  }
  return thresholds
}

const BLUE_NOISE = buildBlueNoise(16)

function orderedThreshold(algorithm: AlgorithmId, x: number, y: number): number {
  if (algorithm === 'bayer-4') {
    return (BAYER_4[y & 3][x & 3] + 0.5) / 16 - 0.5
  }
  if (algorithm === 'bayer-8') {
    return (BAYER_8[y & 7][x & 7] + 0.5) / 64 - 0.5
  }
  return BLUE_NOISE[(y & 15) * 16 + (x & 15)] - 0.5
}

export interface QuantizeOptions {
  algorithm: AlgorithmId
  distance: DistanceMode
  ditherStrength: number
}

export function quantize(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  options: QuantizeOptions,
): { indices: Uint8Array; preview: Uint8ClampedArray } {
  const count = width * height
  const indices = new Uint8Array(count)
  const preview = new Uint8ClampedArray(count * 4)
  const strength = Math.min(1, Math.max(0, options.ditherStrength))
  const kernel = KERNELS[options.algorithm]
  const ordered = options.algorithm === 'bayer-4' || options.algorithm === 'bayer-8' || options.algorithm === 'blue-noise'
  const buf = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    buf[i * 3] = rgba[i * 4]
    buf[i * 3 + 1] = rgba[i * 4 + 1]
    buf[i * 3 + 2] = rgba[i * 4 + 2]
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      let r = buf[i * 3]
      let g = buf[i * 3 + 1]
      let b = buf[i * 3 + 2]
      if (ordered && strength > 0) {
        const bias = orderedThreshold(options.algorithm, x, y) * 64 * strength
        r += bias
        g += bias
        b += bias
      }
      const chosen = nearestCarpet(r, g, b, options.distance)
      indices[i] = chosen
      const pr = CARPETS[chosen].rgb
      const pi = i * 4
      preview[pi] = pr[0]
      preview[pi + 1] = pr[1]
      preview[pi + 2] = pr[2]
      preview[pi + 3] = 255
      if (!kernel || strength === 0) continue
      const er = (buf[i * 3] - pr[0]) * strength
      const eg = (buf[i * 3 + 1] - pr[1]) * strength
      const eb = (buf[i * 3 + 2] - pr[2]) * strength
      for (const [dx, dy, weight] of kernel.taps) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const ni = (ny * width + nx) * 3
        const scale = weight / kernel.div
        buf[ni] += er * scale
        buf[ni + 1] += eg * scale
        buf[ni + 2] += eb * scale
      }
    }
  }
  return { indices, preview }
}

export function countCarpets(indices: Uint8Array): number[] {
  const counts = new Array<number>(CARPETS.length).fill(0)
  for (let i = 0; i < indices.length; i++) counts[indices[i]] += 1
  return counts
}
