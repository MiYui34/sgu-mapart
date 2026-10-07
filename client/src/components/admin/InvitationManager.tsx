import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, Trash2 } from 'lucide-react'
import { Shell } from '../layout/Navbar'
import { api, currentUser, type Invitation } from '../../lib/api'
import { useNotification } from '../../contexts/NotificationContext'

const STATUS: Record<Invitation['status'], string> = {
  active: '可用',
  expired: '已过期',
  used_up: '已用尽',
}

export default function InvitationManager() {
  const navigate = useNavigate()
  const notify = useNotification()
  const user = currentUser()
  const [rows, setRows] = useState<Invitation[]>([])
  const [hours, setHours] = useState(24)
  const [uses, setUses] = useState(1)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      setRows(await api.invitations.list())
    } catch (error) {
      notify(error instanceof Error ? error.message : '读取失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!localStorage.getItem('jwt_token') || user?.role !== 'admin') {
      navigate('/')
      return
    }
    void load()
  }, [navigate])

  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      const res = await api.invitations.create(hours, uses)
      notify(`已生成邀请码 ${res.invitation.code}`, 'success')
      await load()
    } catch (error) {
      notify(error instanceof Error ? error.message : '生成失败', 'error')
    }
  }

  const remove = async (code: string) => {
    if (!window.confirm(`删除邀请码 ${code}？`)) return
    try {
      await api.invitations.remove(code)
      setRows((prev) => prev.filter((row) => row.code !== code))
    } catch (error) {
      notify(error instanceof Error ? error.message : '删除失败', 'error')
    }
  }

  return (
    <Shell>
      <h2 style={{ marginBottom: '1rem' }}>邀请码</h2>
      <form className="glass-panel stack" onSubmit={create} style={{ marginBottom: '1rem' }}>
        <div className="toolbar">
          <label className="muted">有效小时
            <input className="glass-input" style={{ width: 100, marginLeft: 8 }} type="number" min={1} max={720} value={hours} onChange={(e) => setHours(Number(e.target.value))} />
          </label>
          <label className="muted">次数
            <input className="glass-input" style={{ width: 90, marginLeft: 8 }} type="number" min={1} max={100} value={uses} onChange={(e) => setUses(Number(e.target.value))} />
          </label>
          <button className="btn" type="submit">生成</button>
        </div>
      </form>
      {loading ? <p className="muted">加载中...</p> : (
        <div className="stack" style={{ padding: 0 }}>
          {rows.map((row) => (
            <div key={row.code} className="glass-panel" style={{ padding: '0.9rem 1rem', display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
              <div>
                <strong style={{ fontFamily: 'monospace', letterSpacing: '0.08em' }}>{row.code}</strong>
                <div className="muted">{STATUS[row.status]} · {row.usedCount}/{row.maxUses} · 到期 {new Date(row.expiresAt).toLocaleString()}</div>
              </div>
              <div className="toolbar">
                <button className="btn secondary" type="button" onClick={() => navigator.clipboard.writeText(row.code)}><Copy size={14} />复制</button>
                <button className="btn danger" type="button" onClick={() => remove(row.code)}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
          {rows.length === 0 && <p className="muted">还没有邀请码。</p>}
        </div>
      )}
    </Shell>
  )
}
