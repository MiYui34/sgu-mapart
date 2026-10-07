import { describe, expect, it } from 'vitest'
import { adjustImage, DEFAULT_ADJUST } from './adjust.js'

function pixel(r: number, g: number, b: number, brightness = 100) {
  const src = new Uint8ClampedArray([r, g, b, 255])
  const dst = adjustImage(src, { ...DEFAULT_ADJUST, brightness })
  return [dst[0], dst[1], dst[2]]
}

describe('adjust', () => {
  it('亮度 80 只温和变暗，白色不会掉成浅灰', () => {
    expect(pixel(255, 255, 255)).toEqual([255, 255, 255])
    const mid = pixel(128, 128, 128, 80)
    expect(mid[0]).toBeGreaterThan(105)
    expect(mid[0]).toBeLessThan(120)
    const white = pixel(255, 255, 255, 80)
    expect(white[0]).toBeGreaterThan(210)
  })
})
