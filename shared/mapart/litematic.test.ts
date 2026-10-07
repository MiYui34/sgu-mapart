import { describe, expect, it } from 'vitest'
import { CARPETS } from './palette.js'
import { bitsPerBlock, buildLitematic, inspectLitematic, packIndices, unpackIndices } from './litematic.js'

describe('litematic bit packing', () => {
  it('能按位读回调色板下标', () => {
    const indices = Uint8Array.from({ length: 40 }, (_, i) => (i * 3) & 31)
    const bits = 5
    const packed = packIndices(indices, bits)
    expect(Array.from(unpackIndices(packed, indices.length, bits))).toEqual(Array.from(indices))
  })

  it('写出的投影只有空气和地毯，并且尺寸正确', () => {
    const carpets = Uint8Array.from([0, 14, 14, 8])
    const bytes = buildLitematic(carpets, 2, 2, '测试', '小样')
    const inspected = inspectLitematic(bytes)
    expect(inspected.ok).toBe(true)
    expect(inspected.width).toBe(2)
    expect(inspected.depth).toBe(2)
    expect(inspected.blocks).toBe(4)
    expect(bitsPerBlock(1 + new Set(carpets).size)).toBeGreaterThanOrEqual(2)
    expect(CARPETS[0].block).toBe('minecraft:white_carpet')
  })

  it('拒绝含有其他方块的说法由调色板白名单保证', () => {
    const bytes = buildLitematic(Uint8Array.from([15]), 1, 1, '测试', '黑')
    const broken = new Uint8Array(bytes)
    broken[10] ^= 0xff
    const inspected = inspectLitematic(broken)
    expect(inspected.ok).toBe(false)
  })
})
