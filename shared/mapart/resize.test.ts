import { describe, expect, it } from 'vitest'
import { resizeImage } from './resize.js'

describe('resize', () => {
  it('区域平均会把 2×2 的红蓝各半收成中间色', () => {
    const src = new Uint8ClampedArray([
      255, 0, 0, 255,
      255, 0, 0, 255,
      0, 0, 255, 255,
      0, 0, 255, 255,
    ])
    const dst = resizeImage(src, 2, 2, 1, 1, 'area')
    expect(Array.from(dst)).toEqual([128, 0, 128, 255])
  })

  it('Lanczos 缩小时会用到半径 3 以外的像素', () => {
    const width = 20
    const src = new Uint8ClampedArray(width * 4)
    src[0] = 255
    src[3] = 255
    const dst = resizeImage(src, width, 1, 1, 1, 'lanczos')
    expect(dst[0]).toBeGreaterThan(0)
  })
})
