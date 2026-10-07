import type { CarpetRegion, Schematic, SchematicBlock } from './structureNbt.js'

export type TrimSort = 'row' | 'col'
export type TrimFolder = 'none' | 'row' | 'col'
export type TrimDir = 'NS' | 'SN' | 'EW' | 'WE'

export interface TrimOptions {
  sort: TrimSort
  folder: TrimFolder
  merge: boolean
  dir: TrimDir
}

export interface NamedSchematic {
  x: number
  y: number
  schematic: Schematic
}

export interface TrimEntry {
  path: string
  schematic: Schematic
}

export function carpetRegion(schematic: Schematic): CarpetRegion {
  let x0: number | undefined
  let y0: number | undefined
  let z0: number | undefined
  let x1: number | undefined
  let y1: number | undefined
  let z1: number | undefined
  for (const block of schematic.blocks) {
    if (!block.name.endsWith('_carpet')) continue
    if (x0 === undefined || block.x < x0) x0 = block.x
    if (x1 === undefined || block.x > x1) x1 = block.x
    if (y0 === undefined || block.y < y0) y0 = block.y
    if (y1 === undefined || block.y > y1) y1 = block.y
    if (z0 === undefined || block.z < z0) z0 = block.z
    if (z1 === undefined || block.z > z1) z1 = block.z
  }
  if (x0 === undefined || y0 === undefined || z0 === undefined || x1 === undefined || y1 === undefined || z1 === undefined) {
    throw new Error('未找到地毯方块，无法确定裁剪区域')
  }
  return { x0, y0, z0, x1, y1, z1 }
}

export function simplifySchematic(schematic: Schematic, region: CarpetRegion): Schematic {
  const blocks = schematic.blocks
    .filter((block) => block.x >= region.x0 && block.x <= region.x1 && block.y >= region.y0 && block.y <= region.y1 && block.z >= region.z0 && block.z <= region.z1)
    .map((block) => ({
      x: block.x - region.x0,
      y: block.y - region.y0,
      z: block.z - region.z0,
      name: block.name,
    }))
  return {
    ...schematic,
    blocks,
    size: [region.x1 - region.x0 + 1, region.y1 - region.y0 + 1, region.z1 - region.z0 + 1],
  }
}

export function mergeSchematics(a: Schematic, b: Schematic, dir: TrimDir): Schematic {
  const place = (source: Schematic, axis: 'x' | 'z', offset: number): SchematicBlock[] => source.blocks.map((block) => ({
    ...block,
    [axis]: block[axis] + offset,
  }))
  let blocks: SchematicBlock[]
  if (dir === 'NS') blocks = [...place(a, 'z', 0), ...place(b, 'z', 128)]
  else if (dir === 'SN') blocks = [...place(a, 'z', 128), ...place(b, 'z', 0)]
  else if (dir === 'EW') blocks = [...place(a, 'x', 128), ...place(b, 'x', 0)]
  else blocks = [...place(a, 'x', 0), ...place(b, 'x', 128)]
  const size: [number, number, number] = dir === 'EW' || dir === 'WE' ? [256, 1, 128] : [128, 1, 256]
  return { blocks, author: a.author, dataVersion: a.dataVersion, size }
}

function digits(value: number): number {
  return Math.max(1, String(value).length)
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0')
}

export function trimEntries(list: NamedSchematic[], options: TrimOptions): TrimEntry[] {
  const sorted = [...list].sort((a, b) => options.sort === 'col' ? a.x - b.x || a.y - b.y : a.y - b.y || a.x - b.x)
  const count = sorted.length
  const maxX = Math.max(...sorted.map((item) => item.x))
  const maxY = Math.max(...sorted.map((item) => item.y))
  const indexWidth = digits(Math.max(0, count - 1))
  const xWidth = digits(maxX)
  const yWidth = digits(maxY)
  const mergeWidth = digits(Math.max(0, Math.ceil(count / 2) - 1))
  const entries: TrimEntry[] = []
  for (let i = 0; i < count; i++) {
    const item = sorted[i]
    const paired = options.merge && (i % 2 === 0 ? i + 1 < count : true)
    const name = paired
      ? `${pad(i, indexWidth)}-${pad(Math.floor(i / 2), mergeWidth)}-${pad(item.x, xWidth)},${pad(item.y, yWidth)}-s.nbt`
      : `${pad(i, indexWidth)}-${pad(item.x, xWidth)},${pad(item.y, yWidth)}-s.nbt`
    const folder = options.folder === 'row' ? `y${pad(item.y, yWidth)}/` : options.folder === 'col' ? `x${pad(item.x, xWidth)}/` : ''
    entries.push({ path: folder + name, schematic: item.schematic })
  }
  if (options.merge) {
    for (let i = 0; i + 1 < count; i += 2) {
      const a = sorted[i]
      const b = sorted[i + 1]
      const name = `${pad(i / 2, mergeWidth)}-${pad(a.x, xWidth)},${pad(a.y, yWidth)}-${pad(b.x, xWidth)},${pad(b.y, yWidth)}-m.nbt`
      entries.push({
        path: `_merge/${name}`,
        schematic: mergeSchematics(a.schematic, b.schematic, options.dir),
      })
    }
  }
  return entries
}

export function buildTree(paths: string[], full: boolean): string[] {
  interface Node { children: Map<string, Node>; files: string[] }
  const root: Node = { children: new Map(), files: [] }
  for (const path of paths) {
    const parts = path.split('/')
    let current = root
    for (let i = 0; i < parts.length - 1; i++) {
      let child = current.children.get(parts[i])
      if (!child) {
        child = { children: new Map(), files: [] }
        current.children.set(parts[i], child)
      }
      current = child
    }
    current.files.push(parts[parts.length - 1])
  }
  const lines: string[] = []
  const walk = (node: Node, indent: string) => {
    const folders = [...node.children.keys()].sort()
    const files = [...node.files].sort()
    const limit = full ? Infinity : 3
    let shown = 0
    for (const folder of folders) {
      if (shown >= limit) break
      lines.push(`${indent}${folder}/`)
      walk(node.children.get(folder)!, `${indent}  `)
      shown += 1
    }
    if (folders.length > shown) lines.push(`${indent}...`)
    for (const file of files.slice(0, limit)) lines.push(`${indent}${file}`)
    if (files.length > Math.min(files.length, limit)) lines.push(`${indent}...`)
  }
  walk(root, '')
  return lines
}
