import { unzip } from 'fflate'
import { carpetRegion, simplifySchematic, trimEntries, type TrimOptions } from '@shared/mapart/nbtTrim'
import { readSchematic, writeSchematic } from '@shared/mapart/structureNbt'

export interface TrimProgress {
  pct: number
  label: string
}

const NAME_PATTERN = /^(.*)_(\d+)_(\d+)\.nbt$/

function unzipAll(bytes: Uint8Array): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) => {
    unzip(bytes, (error, data) => {
      if (error) reject(error)
      else resolve(data)
    })
  })
}

export async function trimZip(
  bytes: Uint8Array,
  options: TrimOptions,
  onProgress?: (progress: TrimProgress) => void,
): Promise<{ files: Map<string, Uint8Array>; count: number }> {
  const archive = await unzipAll(bytes)
  const found: Array<{ name: string; x: number; y: number; bytes: Uint8Array }> = []
  for (const [name, data] of Object.entries(archive)) {
    const base = name.split('/').pop() ?? name
    const match = base.match(NAME_PATTERN)
    if (!match) continue
    found.push({ name, x: Number(match[2]), y: Number(match[3]), bytes: data })
  }
  if (found.length === 0) throw new Error('zip 中没有匹配 name_x_y.nbt 的文件')
  found.sort((a, b) => options.sort === 'col' ? a.x - b.x || a.y - b.y : a.y - b.y || a.x - b.x)
  const report = (pct: number, label: string) => onProgress?.({ pct, label })
  report(2, '读取 zip')
  const region = carpetRegion(readSchematic(found[0].bytes))
  const named = []
  for (let i = 0; i < found.length; i++) {
    const schematic = simplifySchematic(readSchematic(found[i].bytes), region)
    named.push({ x: found[i].x, y: found[i].y, schematic })
    report(5 + Math.round(75 * (i + 1) / found.length), `精简 ${i + 1}/${found.length}`)
    if (i % 4 === 3) await new Promise((resolve) => setTimeout(resolve, 0))
  }
  const entries = trimEntries(named, options)
  const files = new Map<string, Uint8Array>()
  const mergeTotal = entries.filter((item) => item.path.startsWith('_merge/')).length
  let mergeDone = 0
  for (const entry of entries) {
    files.set(entry.path, writeSchematic(entry.schematic))
    if (entry.path.startsWith('_merge/')) {
      mergeDone += 1
      report(80 + Math.round(15 * mergeDone / mergeTotal), `合并 ${mergeDone}/${mergeTotal}`)
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }
  report(100, '完成')
  return { files, count: found.length }
}
