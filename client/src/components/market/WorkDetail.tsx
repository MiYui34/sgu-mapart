import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Shell } from '../layout/Navbar'
import { api, currentUser, type WorkSummary } from '../../lib/api'
import { useNotification } from '../../contexts/NotificationContext'
import WorldView from '../editor/WorldView'

export default function WorkDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const notify = useNotification()
  const [work, setWork] = useState<WorkSummary | null>(null)
  const [mode, setMode] = useState<'map' | 'world'>('map')
  const [pixels, setPixels] = useState<{ rgba: Uint8ClampedArray; width: number; height: number } | null>(null)
  const user = currentUser()

  useEffect(() => {
    api.works.get(id).then(setWork).catch((error: Error) => notify(error.message, 'error'))
  }, [id, notify])

  useEffect(() => {
    if (!work) return
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(image, 0, 0)
      setPixels({
        rgba: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
        width: canvas.width,
        height: canvas.height,
      })
    }
    image.src = work.previewUrl
  }, [work])

  if (!work) {
    return <Shell><p className="muted">加载中...</p></Shell>
  }

  const mine = user && (user.id === work.userId || user.role === 'admin')

  return (
    <Shell>
      <p className="muted"><Link to="/market">市场</Link> / {work.title}</p>
      <h2 style={{ margin: '0.4rem 0 0.8rem' }}>{work.title}</h2>
      <div className="toolbar" style={{ marginBottom: '0.8rem' }}>
        <button className="btn secondary" type="button" aria-pressed={mode === 'map'} onClick={() => setMode('map')}>地图</button>
        <button className="btn secondary" type="button" aria-pressed={mode === 'world'} onClick={() => setMode('world')}>世界</button>
        <a className="btn" href={`/api/works/${work.id}/download`}>下载 .{work.fileExt === 'zip' ? 'zip' : 'litematic'}</a>
        {mine && (
          <button className="btn danger" type="button" onClick={async () => {
            if (!window.confirm('下架这件作品？')) return
            await api.works.remove(work.id)
            navigate('/market')
          }}>下架</button>
        )}
      </div>
      <p className="muted" style={{ marginBottom: '0.8rem' }}>
        {work.author}，{work.mapsX}×{work.mapsY} 张，{work.downloads} 次下载
        {work.tags.length > 0 ? `，${work.tags.join(' / ')}` : ''}
      </p>
      {work.description && <p style={{ marginBottom: '1rem' }}>{work.description}</p>}
      <div className="glass-panel stage">
        {mode === 'map' && <img src={work.previewUrl} alt={work.title} className="pixels" style={{ width: '100%' }} />}
        {mode === 'world' && pixels && <WorldView rgba={pixels.rgba} width={pixels.width} height={pixels.height} />}
      </div>
    </Shell>
  )
}
