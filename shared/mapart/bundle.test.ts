import { describe, expect, it } from 'vitest'
import { inspectMapartFile, packageMapart, sliceMapTiles } from './bundle.js'
import { inspectLitematic } from './litematic.js'
import { MAP_SIZE } from './palette.js'
import { readStoredZip } from './zip.js'

describe('mapart bundle', () => {
  it('keeps a single 128 map as one litematic', () => {
    const indices = new Uint8Array(MAP_SIZE * MAP_SIZE)
    indices[0] = 14
    const packed = packageMapart(indices, MAP_SIZE, MAP_SIZE, '测试', '单张')
    expect(packed.zip).toBe(false)
    expect(packed.filename.endsWith('.litematic')).toBe(true)
    const inspected = inspectLitematic(packed.bytes)
    expect(inspected.ok).toBe(true)
    expect(inspected.width).toBe(128)
    expect(inspected.depth).toBe(128)
  })

  it('splits a 256 by 128 image into two 128 maps inside a zip', () => {
    const width = MAP_SIZE * 2
    const depth = MAP_SIZE
    const indices = new Uint8Array(width * depth)
    for (let z = 0; z < depth; z++) {
      for (let x = 0; x < width; x++) indices[z * width + x] = x < MAP_SIZE ? 1 : 14
    }
    const tiles = sliceMapTiles(indices, width, depth)
    expect(tiles.map((tile) => tile.index)).toEqual([1, 2])
    expect(tiles[0].indices.every((value) => value === 1)).toBe(true)
    expect(tiles[1].indices.every((value) => value === 14)).toBe(true)

    const packed = packageMapart(indices, width, depth, '测试', '双张')
    expect(packed.zip).toBe(true)
    const files = readStoredZip(packed.bytes)
    expect(files.map((file) => file.name)).toEqual(['地图-1.litematic', '地图-2.litematic'])
    for (const file of files) {
      const inspected = inspectLitematic(file.data)
      expect(inspected.ok).toBe(true)
      expect(inspected.width).toBe(128)
      expect(inspected.depth).toBe(128)
    }
    expect(inspectMapartFile(packed.bytes, 2, 1)).toEqual({ ok: true, zip: true })
    expect(inspectMapartFile(packed.bytes, 1, 1).ok).toBe(false)
  })
})
