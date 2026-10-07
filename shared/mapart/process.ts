import { adjustImage, type AdjustOptions } from './adjust.js'
import { countCarpets, quantize, type AlgorithmId, type DistanceMode } from './dither.js'
import { resizeImage, type ResizeMode } from './resize.js'

export interface ProcessRequest {
  pixels: Uint8ClampedArray
  width: number
  height: number
  outWidth: number
  outHeight: number
  resize: ResizeMode
  adjust: AdjustOptions
  distance: DistanceMode
  algorithm: AlgorithmId
  ditherStrength: number
}

export interface ProcessResult {
  indices: Uint8Array
  preview: Uint8ClampedArray
  source: Uint8ClampedArray
  counts: number[]
  width: number
  height: number
}

export function processImage(request: ProcessRequest): ProcessResult {
  const resized = resizeImage(
    request.pixels,
    request.width,
    request.height,
    request.outWidth,
    request.outHeight,
    request.resize,
  )
  const source = adjustImage(resized, request.adjust)
  const { indices, preview } = quantize(source, request.outWidth, request.outHeight, {
    algorithm: request.algorithm,
    distance: request.distance,
    ditherStrength: request.ditherStrength,
  })
  return {
    indices,
    preview,
    source,
    counts: countCarpets(indices),
    width: request.outWidth,
    height: request.outHeight,
  }
}
