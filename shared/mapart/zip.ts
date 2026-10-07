const CRC_TABLE = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
  let value = i
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  CRC_TABLE[i] = value >>> 0
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

export interface ZipEntry {
  name: string
  data: Uint8Array
}

/** 不压缩地打包。文件名按 UTF-8 写入。 */
export function zipStore(files: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder()
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0
  for (const file of files) {
    const name = encoder.encode(file.name)
    const crc = crc32(file.data)
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true)
    local.setUint16(6, 0x800, true)
    local.setUint16(8, 0, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, file.data.length, true)
    local.setUint32(22, file.data.length, true)
    local.setUint16(26, name.length, true)
    const localBytes = new Uint8Array(local.buffer)
    localParts.push(localBytes, name, file.data)

    const central = new DataView(new ArrayBuffer(46))
    central.setUint32(0, 0x02014b50, true)
    central.setUint16(4, 20, true)
    central.setUint16(6, 20, true)
    central.setUint16(8, 0x800, true)
    central.setUint16(10, 0, true)
    central.setUint32(16, crc, true)
    central.setUint32(20, file.data.length, true)
    central.setUint32(24, file.data.length, true)
    central.setUint16(28, name.length, true)
    central.setUint32(42, offset, true)
    centralParts.push(new Uint8Array(central.buffer), name)
    offset += localBytes.length + name.length + file.data.length
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, files.length, true)
  end.setUint16(10, files.length, true)
  end.setUint32(12, centralSize, true)
  end.setUint32(16, offset, true)
  return concat([...localParts, ...centralParts, new Uint8Array(end.buffer)])
}

export function readStoredZip(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const decoder = new TextDecoder()
  const files: ZipEntry[] = []
  let offset = 0
  while (offset + 4 <= bytes.length) {
    const signature = view.getUint32(offset, true)
    if (signature === 0x02014b50 || signature === 0x06054b50) break
    if (signature !== 0x04034b50) throw new Error('压缩包格式不正确')
    if (offset + 30 > bytes.length) throw new Error('压缩包不完整')
    const flags = view.getUint16(offset + 6, true)
    const method = view.getUint16(offset + 8, true)
    const size = view.getUint32(offset + 18, true)
    const nameLength = view.getUint16(offset + 26, true)
    const extraLength = view.getUint16(offset + 28, true)
    if ((flags & 0x8) !== 0) throw new Error('压缩包格式不正确')
    if (method !== 0) throw new Error('压缩包里的文件必须是未压缩存储')
    const nameStart = offset + 30
    const dataStart = nameStart + nameLength + extraLength
    const dataEnd = dataStart + size
    if (dataEnd > bytes.length) throw new Error('压缩包不完整')
    if (files.length >= 64) throw new Error('压缩包里的文件过多')
    if (size > 1_000_000) throw new Error('压缩包里的文件过大')
    files.push({
      name: decoder.decode(bytes.subarray(nameStart, nameStart + nameLength)),
      data: bytes.slice(dataStart, dataEnd),
    })
    offset = dataEnd
  }
  if (files.length === 0) throw new Error('压缩包是空的')
  return files
}
