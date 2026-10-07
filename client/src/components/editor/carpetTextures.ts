import * as THREE from 'three'
import { CARPETS } from '@shared/mapart/palette'

const FACE_SHADE: Record<string, number> = {
  down: 0.5,
  up: 1,
  north: 0.8,
  south: 0.8,
  west: 0.6,
  east: 0.6,
}

const VERTEX_MAP: Record<string, number[]> = {
  west: [0, 1, 2, 3],
  east: [4, 5, 6, 7],
  down: [0, 3, 4, 7],
  up: [2, 1, 6, 5],
  north: [7, 6, 1, 0],
  south: [3, 2, 5, 4],
}

interface ModelFace {
  uv: [number, number, number, number]
}

interface CarpetModel {
  elements: Array<{
    from: [number, number, number]
    to: [number, number, number]
    faces: Record<string, ModelFace>
  }>
}

const colorIndex = new Map<number, number>(
  CARPETS.map((carpet) => [(carpet.base[0] << 16) | (carpet.base[1] << 8) | carpet.base[2], carpet.id]),
)

const images = new Map<string, Promise<HTMLImageElement>>()
let modelRequest: Promise<CarpetModel> | null = null

export function carpetIdFromColor(r: number, g: number, b: number): number {
  const exact = colorIndex.get((r << 16) | (g << 8) | b)
  if (exact !== undefined) return exact
  let best = 0
  let bestDistance = Infinity
  for (const carpet of CARPETS) {
    const dr = r - carpet.base[0]
    const dg = g - carpet.base[1]
    const db = b - carpet.base[2]
    const distance = dr * dr + dg * dg + db * db
    if (distance < bestDistance) {
      bestDistance = distance
      best = carpet.id
    }
  }
  return best
}

function loadImage(url: string): Promise<HTMLImageElement> {
  const cached = images.get(url)
  if (cached) return cached
  const request = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`贴图加载失败 ${url}`))
    image.src = url
  })
  images.set(url, request)
  return request
}

function loadModel(): Promise<CarpetModel> {
  if (!modelRequest) {
    modelRequest = fetch('/assets/minecraft/models/block/carpet.json').then((response) => {
      if (!response.ok) throw new Error('地毯模型加载失败')
      return response.json() as Promise<CarpetModel>
    })
  }
  return modelRequest
}

function carpetGeometry(model: CarpetModel): THREE.BufferGeometry {
  const positions: number[] = []
  const uvs: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  for (const element of model.elements) {
    const [x1, y1, z1] = element.from
    const [x2, y2, z2] = element.to
    const corners = [
      [x1 - 8, y1 - 8, z1 - 8],
      [x1 - 8, y2 - 8, z1 - 8],
      [x1 - 8, y2 - 8, z2 - 8],
      [x1 - 8, y1 - 8, z2 - 8],
      [x2 - 8, y1 - 8, z2 - 8],
      [x2 - 8, y2 - 8, z2 - 8],
      [x2 - 8, y2 - 8, z1 - 8],
      [x2 - 8, y1 - 8, z1 - 8],
    ]
    for (const [name, face] of Object.entries(element.faces)) {
      const order = VERTEX_MAP[name]
      if (!order) continue
      const start = positions.length / 3
      const shade = FACE_SHADE[name] ?? 1
      const [mu1, mv1, mu2, mv2] = face.uv
      const u1 = mu1 / 16
      const v1 = (16 - mv1) / 16
      const u2 = mu2 / 16
      const v2 = (16 - mv2) / 16
      const faceUvs = [
        [u1, v2],
        [u1, v1],
        [u2, v1],
        [u2, v2],
      ]
      order.forEach((corner, vertex) => {
        const [x, y, z] = corners[corner]
        positions.push(x / 16, y / 16 + 0.5, z / 16)
        uvs.push(faceUvs[vertex][0], faceUvs[vertex][1])
        colors.push(shade, shade, shade)
      })
      indices.push(start, start + 2, start + 1, start, start + 3, start + 2)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  return geometry
}

export async function loadCarpetView(): Promise<{
  geometry: THREE.BufferGeometry
  materials: THREE.MeshBasicMaterial[]
}> {
  const model = await loadModel()
  const materials = await Promise.all(
    CARPETS.map(async (carpet) => {
      const wool = carpet.block.replace('minecraft:', '').replace('_carpet', '_wool')
      const image = await loadImage(`/assets/minecraft/textures/block/${wool}.png`)
      const texture = new THREE.Texture(image)
      texture.magFilter = THREE.NearestFilter
      texture.minFilter = THREE.NearestFilter
      texture.generateMipmaps = false
      texture.colorSpace = THREE.SRGBColorSpace
      texture.needsUpdate = true
      return new THREE.MeshBasicMaterial({ map: texture, vertexColors: true })
    }),
  )
  return { geometry: carpetGeometry(model), materials }
}
