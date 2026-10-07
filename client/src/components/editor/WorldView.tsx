import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

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
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#10141b')
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 8000)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    parent.appendChild(renderer.domElement)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    scene.add(new THREE.AmbientLight(0xffffff, 0.85))
    const sun = new THREE.DirectionalLight(0xffffff, 0.7)
    sun.position.set(1, 2, 0.4)
    scene.add(sun)

    const color = new THREE.Color()
    const dummy = new THREE.Object3D()
    const useInstances = width * height <= 128 * 128
    const objects: THREE.Object3D[] = []
    if (useInstances) {
      const geometry = new THREE.BoxGeometry(0.94, 0.0625, 0.94)
      const material = new THREE.MeshStandardMaterial()
      const mesh = new THREE.InstancedMesh(geometry, material, width * height)
      let index = 0
      for (let z = 0; z < height; z++) {
        for (let x = 0; x < width; x++) {
          dummy.position.set(x - width / 2 + 0.5, 0.03125, z - height / 2 + 0.5)
          dummy.updateMatrix()
          mesh.setMatrixAt(index, dummy.matrix)
          const pixel = (z * width + x) * 4
          color.setRGB(rgba[pixel] / 255, rgba[pixel + 1] / 255, rgba[pixel + 2] / 255, THREE.SRGBColorSpace)
          mesh.setColorAt(index, color)
          index += 1
        }
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      scene.add(mesh)
      objects.push(mesh)
    } else {
      const data = new Uint8Array(rgba)
      const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat)
      texture.magFilter = THREE.NearestFilter
      texture.minFilter = THREE.NearestFilter
      texture.colorSpace = THREE.SRGBColorSpace
      texture.flipY = true
      texture.needsUpdate = true
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.0625, height),
        new THREE.MeshStandardMaterial({ map: texture }),
      )
      scene.add(mesh)
      objects.push(mesh)
    }

    const span = Math.max(width, height)
    camera.position.set(span * 0.55, span * 0.42, span * 0.7)
    controls.target.set(0, 0, 0)
    controls.update()

    let frame = 0
    const resize = () => {
      const w = parent.clientWidth || 640
      const h = parent.clientHeight || 440
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h, false)
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
      cancelAnimationFrame(frame)
      observer.disconnect()
      controls.dispose()
      renderer.dispose()
      objects.forEach((object) => {
        object.traverse((child) => {
          if (child instanceof THREE.Mesh || child instanceof THREE.InstancedMesh) {
            child.geometry.dispose()
            const material = child.material
            if (Array.isArray(material)) material.forEach((item) => item.dispose())
            else material.dispose()
          }
        })
      })
      renderer.domElement.remove()
    }
  }, [rgba, width, height])

  return <div ref={host} className="world-host" />
}
