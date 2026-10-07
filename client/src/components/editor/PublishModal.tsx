import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { buildLitematic } from '@shared/mapart/litematic'
import type { ProcessResult } from '@shared/mapart/process'
import { api, currentUser } from '../../lib/api'
import { useNotification } from '../../contexts/NotificationContext'

interface Props {
  result: ProcessResult
  settings: Record<string, unknown>
  onClose: () => void
}

function toPng(pixels: Uint8ClampedArray, width: number, height: number): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('无法导出封面'))
  ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels), width, height), 0, 0)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('无法导出封面'))), 'image/png')
  })
}

export default function PublishModal({ result, settings, onClose }: Props) {
  const navigate = useNavigate()
  const notify = useNotification()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    try {
      const png = await toPng(result.preview, result.width, result.height)
      const author = currentUser()?.username ?? '访客'
      const bytes = buildLitematic(result.indices, result.width, result.height, author, title || '地毯地图画')
      const file = new Uint8Array(bytes)
      const form = new FormData()
      form.append('preview', png, 'preview.png')
      form.append('litematic', new Blob([file]), 'map.litematic')
      form.append('title', title)
      form.append('description', description)
      form.append('tags', tags)
      form.append('mapsX', String(settings.mapsX))
      form.append('mapsY', String(settings.mapsY))
      form.append('settings', JSON.stringify(settings))
      const created = await api.works.publish(form)
      notify('已上架', 'success')
      navigate(`/market/${created.id}`)
    } catch (error) {
      notify(error instanceof Error ? error.message : '上架失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal-panel" onClick={(event) => event.stopPropagation()} onSubmit={submit}>
        <h3>上架到市场</h3>
        <label className="form-label">标题
          <input className="glass-input" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={80} />
        </label>
        <label className="form-label">简介
          <textarea className="glass-input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="form-label">标签
          <input className="glass-input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="用逗号分开" />
        </label>
        <div className="toolbar">
          <button className="btn" disabled={loading} type="submit">{loading ? '上传中...' : '发布'}</button>
          <button className="btn secondary" type="button" onClick={onClose}>取消</button>
        </div>
      </form>
    </div>
  )
}
