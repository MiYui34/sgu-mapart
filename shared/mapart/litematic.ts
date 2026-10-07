import {
  NbtCompound,
  NbtFile,
  NbtInt,
  NbtList,
  NbtLong,
  NbtLongArray,
  NbtString,
  NbtType,
} from 'deepslate/nbt'
import { AIR_BLOCK, ALLOWED_BLOCKS, CARPETS, LITEMATIC_VERSION, MINECRAFT_DATA_VERSION } from './palette.js'

const MASK64 = (1n << 64n) - 1n
const SIGN64 = 1n << 63n

export function toUnsignedLong(value: bigint): bigint {
  return value < 0n ? value + (1n << 64n) : value & MASK64
}

export function toSignedLong(value: bigint): bigint {
  const unsigned = value & MASK64
  return unsigned >= SIGN64 ? unsigned - (1n << 64n) : unsigned
}

export function bitsPerBlock(paletteSize: number): number {
  if (paletteSize <= 1) return 2
  return Math.max(2, Math.ceil(Math.log2(paletteSize)))
}

export function packIndices(indices: Uint8Array, bits: number): bigint[] {
  const longCount = Math.max(1, Math.ceil((indices.length * bits) / 64))
  const longs = new Array<bigint>(longCount).fill(0n)
  for (let i = 0; i < indices.length; i++) {
    const value = BigInt(indices[i])
    const start = i * bits
    const longIndex = Math.floor(start / 64)
    const bitOffset = start % 64
    longs[longIndex] = (longs[longIndex] | ((value << BigInt(bitOffset)) & MASK64)) & MASK64
    const endLong = Math.floor((start + bits - 1) / 64)
    if (endLong !== longIndex) {
      longs[endLong] = (longs[endLong] | (value >> BigInt(64 - bitOffset))) & MASK64
    }
  }
  return longs
}

export function unpackIndices(longs: bigint[], count: number, bits: number): Uint8Array {
  const out = new Uint8Array(count)
  const valueMask = (1n << BigInt(bits)) - 1n
  for (let i = 0; i < count; i++) {
    const start = i * bits
    const longIndex = Math.floor(start / 64)
    const bitOffset = start % 64
    const endLong = Math.floor((start + bits - 1) / 64)
    let value: bigint
    if (endLong === longIndex) {
      value = (longs[longIndex] >> BigInt(bitOffset)) & valueMask
    } else {
      value = ((longs[longIndex] >> BigInt(bitOffset)) | (longs[endLong] << BigInt(64 - bitOffset))) & valueMask
    }
    out[i] = Number(value)
  }
  return out
}

function emptyCompoundList(): NbtList {
  return new NbtList([], NbtType.Compound)
}

export function buildLitematic(
  carpetIndices: Uint8Array,
  width: number,
  depth: number,
  author: string,
  name: string,
): Uint8Array {
  const used: number[] = []
  const seen = new Set<number>()
  for (let i = 0; i < carpetIndices.length; i++) {
    const id = carpetIndices[i]
    if (!seen.has(id)) {
      seen.add(id)
      used.push(id)
    }
  }
  const paletteIndex = new Map<number, number>()
  used.forEach((id, index) => paletteIndex.set(id, index + 1))
  const stored = new Uint8Array(carpetIndices.length)
  for (let i = 0; i < carpetIndices.length; i++) stored[i] = paletteIndex.get(carpetIndices[i]) ?? 1

  const names = [AIR_BLOCK, ...used.map((id) => CARPETS[id].block)]
  const bits = bitsPerBlock(names.length)
  const longs = packIndices(stored, bits).map((value) => new NbtLong(toSignedLong(value)))

  const palette = new NbtList(
    names.map((block) => new NbtCompound().set('Name', new NbtString(block))),
    NbtType.Compound,
  )

  const region = new NbtCompound()
    .set('Position', new NbtCompound().set('x', new NbtInt(0)).set('y', new NbtInt(0)).set('z', new NbtInt(0)))
    .set('Size', new NbtCompound().set('x', new NbtInt(width)).set('y', new NbtInt(1)).set('z', new NbtInt(depth)))
    .set('BlockStatePalette', palette)
    .set('BlockStates', new NbtLongArray(longs))
    .set('Entities', emptyCompoundList())
    .set('TileEntities', emptyCompoundList())
    .set('PendingBlockTicks', emptyCompoundList())
    .set('PendingFluidTicks', emptyCompoundList())

  const volume = width * depth
  const now = BigInt(Date.now())
  const metadata = new NbtCompound()
    .set('Name', new NbtString(name))
    .set('Author', new NbtString(author || '访客'))
    .set('Description', new NbtString('由 SGU 地图画生成，仅地毯，Minecraft 26.1+'))
    .set('RegionCount', new NbtInt(1))
    .set('TotalVolume', new NbtLong(BigInt(volume)))
    .set('TotalBlocks', new NbtLong(BigInt(volume)))
    .set('EnclosingSize', new NbtCompound().set('x', new NbtInt(width)).set('y', new NbtInt(1)).set('z', new NbtInt(depth)))
    .set('TimeCreated', new NbtLong(now))
    .set('TimeModified', new NbtLong(now))

  const root = new NbtCompound()
    .set('Version', new NbtInt(LITEMATIC_VERSION))
    .set('MinecraftDataVersion', new NbtInt(MINECRAFT_DATA_VERSION))
    .set('Metadata', metadata)
    .set('Regions', new NbtCompound().set('地毯地图画', region))

  return writeFile(root)
}

function writeFile(root: NbtCompound): Uint8Array {
  const file = NbtFile.create({ compression: 'gzip', littleEndian: false, name: '' })
  file.root = root
  return file.write()
}

export interface LitematicInspection {
  ok: boolean
  error?: string
  width?: number
  depth?: number
  blocks?: number
}

export function inspectLitematic(bytes: Uint8Array): LitematicInspection {
  let file: NbtFile
  try {
    file = NbtFile.read(bytes)
  } catch {
    return { ok: false, error: '无法读取投影文件' }
  }
  try {
    const version = file.root.getNumber('MinecraftDataVersion')
    if (!Number.isFinite(version)) return { ok: false, error: '缺少游戏版本' }
    const regions = file.root.getCompound('Regions')
    const names = Array.from(regions.keys())
    if (names.length !== 1) return { ok: false, error: '投影必须只有一个区域' }
    const region = regions.getCompound(names[0])
    const size = region.getCompound('Size')
    const width = size.getNumber('x')
    const height = size.getNumber('y')
    const depth = size.getNumber('z')
    if (height !== 1 || width < 1 || depth < 1) return { ok: false, error: '投影必须是一层地毯' }
    const palette = region.getList('BlockStatePalette', NbtType.Compound)
    const blockNames: string[] = []
    for (let i = 0; i < palette.length; i++) {
      const blockName = palette.getCompound(i).getString('Name')
      if (!ALLOWED_BLOCKS.has(blockName)) return { ok: false, error: `含有非地毯方块 ${blockName}` }
      blockNames.push(blockName)
    }
    const bits = bitsPerBlock(blockNames.length)
    const rawLongs = region.getLongArray('BlockStates').toJson() as Array<[number, number]>
    const longs = rawLongs.map((pair) => toUnsignedLong(NbtLong.pairToBigint(pair)))
    const stored = unpackIndices(longs, width * depth, bits)
    for (let i = 0; i < stored.length; i++) {
      if (stored[i] >= blockNames.length) return { ok: false, error: '方块索引超出调色板' }
    }
    return { ok: true, width, depth, blocks: stored.length }
  } catch {
    return { ok: false, error: '投影结构不完整' }
  }
}
