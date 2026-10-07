import { describe, expect, it } from 'vitest'
import { quantize } from './dither.js'

describe('floyd-steinberg', () => {
  it('把已知的两像素灰阶稳定地分成白色和浅灰色地毯', () => {
    const rgba = new Uint8ClampedArray([
      176, 176, 176, 255,
      176, 176, 176, 255,
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
    expect(Array.from(first.indices)).toEqual([0, 8])
    expect(Array.from(second.indices)).toEqual(Array.from(first.indices))
    expect(Array.from(first.preview.slice(0, 4))).toEqual([220, 220, 220, 255])
    expect(Array.from(first.preview.slice(4, 8))).toEqual([132, 132, 132, 255])
  })
})
