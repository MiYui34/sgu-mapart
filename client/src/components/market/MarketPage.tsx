import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Shell } from '../layout/Navbar'
import { api, type WorkSummary } from '../../lib/api'

export default function MarketPage() {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<'new' | 'downloads'>('new')
  const [works, setWorks] = useState<WorkSummary[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      api.works.list(q, sort).then(setWorks).catch((err: Error) => setError(err.message))
    }, 200)
    return () => window.clearTimeout(timer)
  }, [q, sort])

  return (
    <Shell>
      <div className="toolbar" style={{ marginBottom: '1rem' }}>
        <h2>地图画市场</h2>
        <input className="glass-input" style={{ maxWidth: 280 }} placeholder="搜索标题、标签或作者" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="glass-input" style={{ maxWidth: 140 }} value={sort} onChange={(e) => setSort(e.target.value as 'new' | 'downloads')}>
          <option value="new">最新</option>
          <option value="downloads">下载量</option>
        </select>
      </div>
      {error && <div className="error-box">{error}</div>}
      <div className="card-grid">
        {works.map((work) => (
          <Link key={work.id} to={`/market/${work.id}`} className="glass-panel work-card">
            <img src={work.previewUrl} alt={work.title} />
            <div>
              <strong>{work.title}</strong>
              <p className="muted">{work.mapsX}×{work.mapsY} · {work.author} · {work.downloads} 次下载</p>
            </div>
          </Link>
        ))}
      </div>
      {works.length === 0 && !error && <p className="muted">还没有作品。</p>}
    </Shell>
  )
}
