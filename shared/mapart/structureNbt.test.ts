import { unzipSync, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { readStoredZip } from './zip.js'
import { MAP_SIZE } from './palette.js'
import { buildTree, carpetRegion, mergeSchematics, simplifySchematic, trimEntries } from './nbtTrim.js'
import { buildStructureNbt, packageStructureNbt, readSchematic, writeSchematic } from './structureNbt.js'

describe('structure nbt', () => {
  it('writes a carpet layer that round-trips', () => {
    const indices = new Uint8Array(4)
    indices[3] = 14
    const schematic = readSchematic(buildStructureNbt(indices, 2, 2, '访客'))
    expect(schematic.size).toEqual([2, 1, 2])
    expect(schematic.author).toBe('访客')
    expect(schematic.blocks).toEqual([
      { x: 0, y: 0, z: 0, name: 'minecraft:white_carpet' },
      { x: 1, y: 0, z: 0, name: 'minecraft:white_carpet' },
      { x: 0, y: 0, z: 1, name: 'minecraft:white_carpet' },
      { x: 1, y: 0, z: 1, name: 'minecraft:red_carpet' },
    ])
  })

  it('packs each 128 map as name_x_y.nbt', () => {
    const indices = new Uint8Array(MAP_SIZE * MAP_SIZE * 2)
    const packed = packageStructureNbt(indices, MAP_SIZE * 2, MAP_SIZE, '访客')
    expect(packed.zip).toBe(true)
    expect(readStoredZip(packed.bytes).map((file) => file.name)).toEqual(['地图画_0_0.nbt', '地图画_1_0.nbt'])
  })

  it('keeps only the carpet box and merges the next tile to the south', () => {
    const source = readSchematic(writeSchematic({
      author: '甲',
      dataVersion: 4786,
      blocks: [
        { x: 2, y: 4, z: 3, name: 'minecraft:stone' },
        { x: 5, y: 4, z: 8, name: 'minecraft:white_carpet' },
      ],
    }))
    const region = carpetRegion(source)
    const simplified = simplifySchematic(source, region)
    expect(simplified.blocks).toEqual([{ x: 0, y: 0, z: 0, name: 'minecraft:white_carpet' }])
    const other = { ...simplified, author: '乙' }
    const merged = mergeSchematics(simplified, other, 'NS')
    expect(merged.size).toEqual([128, 1, 256])
    expect(merged.blocks.map((block) => block.z)).toEqual([0, 128])
    const entries = trimEntries([
      { x: 1, y: 0, schematic: simplified },
      { x: 0, y: 0, schematic: other },
    ], { sort: 'col', folder: 'none', merge: true, dir: 'NS' })
    expect(entries.map((entry) => entry.path)).toEqual([
      '0-0-0,0-s.nbt',
      '1-0-1,0-s.nbt',
      '_merge/0-0,0-1,0-m.nbt',
    ])
  })

  it('reads a deflated zip, drops blocks outside the carpet, and merges east to west', () => {
    const tile = (color: string) => writeSchematic({
      author: '访客',
      dataVersion: 4786,
      size: [130, 2, 130],
      blocks: [
        { x: 0, y: 0, z: 0, name: 'minecraft:stone' },
        { x: 1, y: 1, z: 1, name: 'minecraft:white_carpet' },
        { x: 2, y: 1, z: 3, name: color },
      ],
    })
    const archive = unzipSync(zipSync({
      '地图画_0_0.nbt': tile('minecraft:red_carpet'),
      '地图画_1_0.nbt': tile('minecraft:blue_carpet'),
    }))
    const named = Object.entries(archive).map(([name, bytes]) => {
      const match = name.match(/_(\d+)_(\d+)\.nbt$/)
      return { x: Number(match?.[1]), y: Number(match?.[2]), schematic: readSchematic(bytes) }
    })
    const region = carpetRegion(named[0].schematic)
    const simplified = named.map((item) => ({ ...item, schematic: simplifySchematic(item.schematic, region) }))
    expect(simplified[0].schematic.blocks.some((block) => block.name === 'minecraft:stone')).toBe(false)
    expect(simplified[0].schematic.size).toEqual([2, 1, 3])
    const entries = trimEntries(simplified, { sort: 'row', folder: 'none', merge: true, dir: 'EW' })
    expect(buildTree(entries.map((entry) => entry.path), false)).toContain('_merge/')
    const merged = readSchematic(writeSchematic(entries.find((entry) => entry.path.startsWith('_merge/'))!.schematic))
    expect(merged.size).toEqual([256, 1, 128])
    expect(merged.blocks.map((block) => block.name).sort()).toEqual([
      'minecraft:blue_carpet',
      'minecraft:red_carpet',
      'minecraft:white_carpet',
      'minecraft:white_carpet',
    ])
  })
})
