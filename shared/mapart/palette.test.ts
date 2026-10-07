import { describe, expect, it } from 'vitest'
import { formatCarpetPack } from './palette.js'

describe('formatCarpetPack', () => {
  it('按 64 个一组、1728 个一盒换算', () => {
    expect(formatCarpetPack(0)).toBe('0 个')
    expect(formatCarpetPack(63)).toBe('63 个')
    expect(formatCarpetPack(64)).toBe('1 组')
    expect(formatCarpetPack(65)).toBe('1 组 1 个')
    expect(formatCarpetPack(1728)).toBe('1 盒')
    expect(formatCarpetPack(1728 + 64 + 3)).toBe('1 盒 1 组 3 个')
    expect(formatCarpetPack(1728 * 2 + 64 * 26 + 63)).toBe('2 盒 26 组 63 个')
  })
})
