import { describe, expect, it } from 'vitest'
import { quantize } from './dither.js'

describe('floyd-steinberg', () => {
  it('把 200 灰分成浅灰色和白色，误差扩散到右边', () => {
    const rgba = new Uint8ClampedArray([
      200, 200, 200, 255,
      200, 200, 200, 255,
    ])
    const first = quantize(rgba, 2, 1, {
      algorithm: 'floyd-steinberg',
      distance: 'rgb',
      ditherStrength: 1,
    })
    const second = quantize(rgba, 2, 1, {
      algorithm: 'floyd-steinberg',
      distance: 'rgb',
      ditherStrength: 1,
    })
    expect(Array.from(first.indices)).toEqual([8, 0])
    expect(Array.from(second.indices)).toEqual(Array.from(first.indices))
    expect(Array.from(first.preview.slice(0, 4))).toEqual([153, 153, 153, 255])
    expect(Array.from(first.preview.slice(4, 8))).toEqual([255, 255, 255, 255])
  })

  it('210 灰在 OKLab 下仍混有浅灰，不会整片变成白色', () => {
    const count = 32 * 32
    const rgba = new Uint8ClampedArray(count * 4)
    for (let i = 0; i < count; i++) {
      rgba[i * 4] = 210
      rgba[i * 4 + 1] = 210
      rgba[i * 4 + 2] = 210
      rgba[i * 4 + 3] = 255
    }
    const result = quantize(rgba, 32, 32, {
      algorithm: 'floyd-steinberg',
      distance: 'oklab',
      ditherStrength: 1,
    })
    let sum = 0
    let white = 0
    for (let i = 0; i < count; i++) {
      sum += result.preview[i * 4]
      if (result.indices[i] === 0) white += 1
    }
    const mean = sum / count
    expect(mean).toBeGreaterThan(195)
    expect(mean).toBeLessThan(225)
    expect(white / count).toBeLessThan(0.8)
  })

  it('抖动只有 0.32 时，230 灰也不会整片变成白色', () => {
    const count = 24 * 24
    const rgba = new Uint8ClampedArray(count * 4)
    for (let i = 0; i < count; i++) {
      rgba[i * 4] = 230
      rgba[i * 4 + 1] = 230
      rgba[i * 4 + 2] = 230
      rgba[i * 4 + 3] = 255
    }
    const result = quantize(rgba, 24, 24, {
      algorithm: 'floyd-steinberg',
      distance: 'oklab',
      ditherStrength: 0.32,
    })
    let sum = 0
    let white = 0
    for (let i = 0; i < count; i++) {
      sum += result.preview[i * 4]
      if (result.indices[i] === 0) white += 1
    }
    expect(sum / count).toBeGreaterThan(210)
    expect(sum / count).toBeLessThan(248)
    expect(white / count).toBeLessThan(0.92)
  })
})
