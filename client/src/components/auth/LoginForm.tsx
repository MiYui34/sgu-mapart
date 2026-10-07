import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, Loader2, Lock, LogIn, User } from 'lucide-react'
import { api } from '../../lib/api'

export default function LoginForm() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { token, user } = await api.auth.login(username, password)
      localStorage.setItem('jwt_token', token)
      localStorage.setItem('user', JSON.stringify(user))
      sessionStorage.removeItem('guest_mode')
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="glass-panel" style={{ maxWidth: 420, width: '100%', padding: '2.2rem' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '0.4rem' }}>欢迎回来</h2>
      <p className="muted" style={{ textAlign: 'center', marginBottom: '1.4rem' }}>登录以发布地图画</p>
      {error && <div className="error-box">{error}</div>}
      <form onSubmit={submit}>
        <div className="form-group">
          <label className="form-label" htmlFor="username">用户名</label>
          <div style={{ position: 'relative' }}>
            <User size={16} style={{ position: 'absolute', left: 12, top: 14, color: 'var(--text-tertiary)' }} />
            <input id="username" className="glass-input" style={{ paddingLeft: '2.3rem' }} value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="password">密码</label>
          <div style={{ position: 'relative' }}>
            <Lock size={16} style={{ position: 'absolute', left: 12, top: 14, color: 'var(--text-tertiary)' }} />
            <input id="password" type="password" className="glass-input" style={{ paddingLeft: '2.3rem' }} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
        </div>
        <button className="glass-button" disabled={loading} type="submit">
          {loading ? <Loader2 size={16} className="spin" /> : <LogIn size={16} />}
          {loading ? '登录中...' : '登录'}
        </button>
      </form>
      <button
        className="glass-button secondary"
        style={{ marginTop: '0.75rem' }}
        type="button"
        onClick={() => {
          sessionStorage.setItem('guest_mode', 'true')
          navigate('/')
        }}
      >
        <Eye size={16} />以访客身份继续
      </button>
      <p style={{ textAlign: 'center', marginTop: '1.2rem' }} className="muted">
        没有账号？ <Link to="/register">使用邀请码注册</Link>
      </p>
    </div>
  )
}
