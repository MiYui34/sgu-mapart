import { buildLitematic, inspectLitematic } from './litematic.js'
import { MAP_SIZE } from './palette.js'
import { readStoredZip, zipStore } from './zip.js'

export interface MapTile {
  index: number
  indices: Uint8Array
}

export function sliceMapTiles(indices: Uint8Array, width: number, depth: number): MapTile[] {
  if (width % MAP_SIZE !== 0 || depth % MAP_SIZE !== 0 || indices.length !== width * depth) {
    throw new Error('投影尺寸不是 128 的倍数')
  }
  const mapsX = width / MAP_SIZE
  const mapsY = depth / MAP_SIZE
  const tiles: MapTile[] = []
  for (let mapY = 0; mapY < mapsY; mapY++) {
    for (let mapX = 0; mapX < mapsX; mapX++) {
      const tile = new Uint8Array(MAP_SIZE * MAP_SIZE)
      for (let z = 0; z < MAP_SIZE; z++) {
        const source = (mapY * MAP_SIZE + z) * width + mapX * MAP_SIZE
        tile.set(indices.subarray(source, source + MAP_SIZE), z * MAP_SIZE)
      }
      tiles.push({ index: mapY * mapsX + mapX + 1, indices: tile })
    }
  }
  return tiles
}

export interface MapartPackage {
  bytes: Uint8Array
  filename: string
  zip: boolean
}

export function packageMapart(
  indices: Uint8Array,
  width: number,
  depth: number,
  author: string,
  title: string,
): MapartPackage {
  const tiles = sliceMapTiles(indices, width, depth)
  if (tiles.length === 1) {
    return {
      bytes: buildLitematic(tiles[0].indices, MAP_SIZE, MAP_SIZE, author, title),
      filename: 'carpet-mapart.litematic',
      zip: false,
    }
  }
  const files = tiles.map((tile) => ({
    name: `地图-${tile.index}.litematic`,
    data: buildLitematic(tile.indices, MAP_SIZE, MAP_SIZE, author, `${title} ${tile.index}`),
  }))
  return { bytes: zipStore(files), filename: 'carpet-mapart.zip', zip: true }
}

export function inspectMapartFile(
  bytes: Uint8Array,
  mapsX: number,
  mapsY: number,
): { ok: boolean; error?: string; zip?: boolean } {
  const expected = mapsX * mapsY
  if (expected === 1) {
    const inspected = inspectLitematic(bytes)
    if (!inspected.ok) return inspected
    if (inspected.width !== MAP_SIZE || inspected.depth !== MAP_SIZE) {
      return { ok: false, error: '单张地图必须是 128×128' }
    }
    return { ok: true, zip: false }
  }
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    return { ok: false, error: '多张地图需要按 128 格拆开并打包成 zip' }
  }
  let files
  try {
    files = readStoredZip(bytes)
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '压缩包无法读取' }
  }
  if (files.length !== expected) {
    return { ok: false, error: '压缩包里的投影数量和地图张数不一致' }
  }
  for (const file of files) {
    const inspected = inspectLitematic(file.data)
    if (!inspected.ok) return inspected
    if (inspected.width !== MAP_SIZE || inspected.depth !== MAP_SIZE) {
      return { ok: false, error: '每张投影必须是 128×128' }
    }
  }
  return { ok: true, zip: true }
}
