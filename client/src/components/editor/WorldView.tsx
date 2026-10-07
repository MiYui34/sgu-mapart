import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CARPETS } from '@shared/mapart/palette'
import { carpetIdFromColor, loadCarpetView } from './carpetTextures'

interface Props {
  rgba: Uint8ClampedArray
  width: number
  height: number
}

export default function WorldView({ rgba, width, height }: Props) {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const parent = host.current
    if (!parent) return
    let disposed = false
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#10141b')
    const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 12000)
    const renderer = new THREE.WebGLRenderer({ antialias: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.NoToneMapping
    parent.appendChild(renderer.domElement)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true

    const buckets = CARPETS.map(() => [] as number[])
    for (let z = 0; z < height; z++) {
      for (let x = 0; x < width; x++) {
        const pixel = (z * width + x) * 4
        buckets[carpetIdFromColor(rgba[pixel], rgba[pixel + 1], rgba[pixel + 2])].push(x, z)
      }
    }

    const dummy = new THREE.Object3D()
    const meshes: THREE.InstancedMesh[] = []
    let geometry: THREE.BufferGeometry | null = null
    let materials: THREE.MeshBasicMaterial[] = []
    void loadCarpetView().then((assets) => {
      if (disposed) {
        assets.geometry.dispose()
        assets.materials.forEach((material) => {
          material.map?.dispose()
          material.dispose()
        })
        return
      }
      geometry = assets.geometry
      materials = assets.materials
      buckets.forEach((cells, id) => {
        const count = cells.length / 2
        if (count === 0) return
        const mesh = new THREE.InstancedMesh(geometry!, materials[id], count)
        mesh.frustumCulled = false
        for (let index = 0; index < count; index++) {
          dummy.position.set(cells[index * 2] - width / 2 + 0.5, 0, cells[index * 2 + 1] - height / 2 + 0.5)
          dummy.updateMatrix()
          mesh.setMatrixAt(index, dummy.matrix)
        }
        mesh.instanceMatrix.needsUpdate = true
        scene.add(mesh)
        meshes.push(mesh)
      })
    })

    const span = Math.max(width, height)
    camera.position.set(span * 0.08, Math.max(2.2, span * 0.045), span * 0.28)
    controls.target.set(0, 0, span * 0.02)
    controls.update()

    let frame = 0
    const resize = () => {
      const viewWidth = parent.clientWidth || 640
      const viewHeight = parent.clientHeight || 440
      camera.aspect = viewWidth / viewHeight
      camera.updateProjectionMatrix()
      renderer.setSize(viewWidth, viewHeight, false)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(parent)
    const loop = () => {
      controls.update()
      renderer.render(scene, camera)
      frame = requestAnimationFrame(loop)
    }
    loop()
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      controls.dispose()
      renderer.dispose()
      geometry?.dispose()
      materials.forEach((material) => {
        material.map?.dispose()
        material.dispose()
      })
      meshes.forEach((mesh) => scene.remove(mesh))
      renderer.domElement.remove()
    }
  }, [rgba, width, height])

  return <div ref={host} className="world-host" />
}
