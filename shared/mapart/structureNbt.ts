import { NbtCompound, NbtFile, NbtInt, NbtList, NbtString, NbtType } from 'deepslate/nbt'
import { CARPETS, MINECRAFT_DATA_VERSION, MAP_SIZE } from './palette.js'
import { sliceMapTiles } from './bundle.js'
import { zipStore } from './zip.js'
import type { MapartPackage } from './bundle.js'

export interface SchematicBlock {
  x: number
  y: number
  z: number
  name: string
}

export interface Schematic {
  blocks: SchematicBlock[]
  author: string
  dataVersion: number
  size?: [number, number, number]
}

export interface CarpetRegion {
  x0: number
  y0: number
  z0: number
  x1: number
  y1: number
  z1: number
}

function intList(values: number[]): NbtList<NbtInt> {
  return new NbtList(values.map((value) => new NbtInt(value)), NbtType.Int)
}

export function readSchematic(bytes: Uint8Array): Schematic {
  const root = NbtFile.read(bytes).root
  const palette = root.getList('palette', NbtType.Compound)
  const names: string[] = []
  for (let i = 0; i < palette.length; i++) names.push(palette.getCompound(i).getString('Name'))
  const blocksTag = root.getList('blocks', NbtType.Compound)
  const blocks: SchematicBlock[] = []
  for (let i = 0; i < blocksTag.length; i++) {
    const block = blocksTag.getCompound(i)
    const pos = block.getList('pos', NbtType.Int)
    blocks.push({
      x: pos.getNumber(0),
      y: pos.getNumber(1),
      z: pos.getNumber(2),
      name: names[block.getNumber('state')] ?? 'minecraft:air',
    })
  }
  const sizeTag = root.getList('size', NbtType.Int)
  return {
    blocks,
    author: root.getString('author'),
    dataVersion: root.getNumber('DataVersion') || MINECRAFT_DATA_VERSION,
    size: sizeTag.length === 3 ? [sizeTag.getNumber(0), sizeTag.getNumber(1), sizeTag.getNumber(2)] : undefined,
  }
}

export function writeSchematic(schematic: Schematic): Uint8Array {
  const palette: string[] = []
  const index = new Map<string, number>()
  const blocks = schematic.blocks.map((block) => {
    let state = index.get(block.name)
    if (state === undefined) {
      state = palette.length
      index.set(block.name, state)
      palette.push(block.name)
    }
    return new NbtCompound()
      .set('pos', intList([block.x, block.y, block.z]))
      .set('state', new NbtInt(state))
  })
  const root = new NbtCompound()
    .set('blocks', new NbtList(blocks, NbtType.Compound))
    .set('entities', new NbtList([], NbtType.Compound))
    .set('palette', new NbtList(
      palette.map((name) => new NbtCompound().set('Name', new NbtString(name))),
      NbtType.Compound,
    ))
    .set('size', intList(schematic.size ?? schematicSize(schematic.blocks)))
    .set('author', new NbtString(schematic.author))
    .set('DataVersion', new NbtInt(schematic.dataVersion))
  const file = NbtFile.create({ compression: 'gzip', littleEndian: false, name: '' })
  file.root = root
  return file.write()
}

function schematicSize(blocks: SchematicBlock[]): [number, number, number] {
  if (blocks.length === 0) return [0, 0, 0]
  let x1 = 0
  let y1 = 0
  let z1 = 0
  for (const block of blocks) {
    if (block.x > x1) x1 = block.x
    if (block.y > y1) y1 = block.y
    if (block.z > z1) z1 = block.z
  }
  return [x1 + 1, y1 + 1, z1 + 1]
}

export function buildStructureNbt(indices: Uint8Array, width: number, depth: number, author: string): Uint8Array {
  if (indices.length !== width * depth) throw new Error('方块数量和尺寸不一致')
  const blocks: SchematicBlock[] = []
  for (let z = 0; z < depth; z++) {
    for (let x = 0; x < width; x++) {
      const id = indices[z * width + x]
      const carpet = CARPETS[id]
      if (!carpet) continue
      blocks.push({ x, y: 0, z, name: carpet.block })
    }
  }
  return writeSchematic({ blocks, author, dataVersion: MINECRAFT_DATA_VERSION, size: [width, 1, depth] })
}

export function packageStructureNbt(
  indices: Uint8Array,
  width: number,
  depth: number,
  author: string,
): MapartPackage {
  const tiles = sliceMapTiles(indices, width, depth)
  const mapsX = width / MAP_SIZE
  const files = tiles.map((tile) => {
    const x = (tile.index - 1) % mapsX
    const y = Math.floor((tile.index - 1) / mapsX)
    return {
      name: `地图画_${x}_${y}.nbt`,
      data: buildStructureNbt(tile.indices, MAP_SIZE, MAP_SIZE, author),
    }
  })
  if (files.length === 1) return { bytes: files[0].data, filename: files[0].name, zip: false }
  return { bytes: zipStore(files), filename: '地图画-nbt.zip', zip: true }
}
