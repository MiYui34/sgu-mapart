import { processImage, type ProcessRequest, type ProcessResult } from '@shared/mapart/process'

self.onmessage = (event: MessageEvent<ProcessRequest>) => {
  const result: ProcessResult = processImage(event.data)
  const transfer = [result.indices.buffer, result.preview.buffer, result.source.buffer]
  self.postMessage(result, { transfer })
}
