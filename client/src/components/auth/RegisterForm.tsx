import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Key, Loader2, Lock, Mail, User, UserPlus } from 'lucide-react'
import { api } from '../../lib/api'

export default function RegisterForm() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', email: '', password: '', confirmPassword: '', invitationCode: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }))
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    if (form.password !== form.confirmPassword) {
      setError('密码不匹配')
      return
    }
    setLoading(true)
    try {
      await api.auth.register(form.username, form.email, form.password, form.invitationCode)
      setSuccess('注册成功，正在前往登录。')
      setTimeout(() => navigate('/login'), 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="glass-panel" style={{ maxWidth: 460, width: '100%', padding: '2.2rem' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '0.4rem' }}>创建账号</h2>
      <p className="muted" style={{ textAlign: 'center', marginBottom: '1.4rem' }}>需要管理员提供的邀请码</p>
      {error && <div className="error-box">{error}</div>}
      {success && <div className="success-box">{success}</div>}
      <form onSubmit={submit}>
        <div className="form-group">
          <label className="form-label">用户名</label>
          <div style={{ position: 'relative' }}>
            <User size={16} style={{ position: 'absolute', left: 12, top: 14, color: 'var(--text-tertiary)' }} />
            <input className="glass-input" style={{ paddingLeft: '2.3rem' }} value={form.username} onChange={set('username')} required minLength={3} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">电子邮箱</label>
          <div style={{ position: 'relative' }}>
            <Mail size={16} style={{ position: 'absolute', left: 12, top: 14, color: 'var(--text-tertiary)' }} />
            <input type="email" className="glass-input" style={{ paddingLeft: '2.3rem' }} value={form.email} onChange={set('email')} required />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">密码</label>
          <div style={{ position: 'relative' }}>
            <Lock size={16} style={{ position: 'absolute', left: 12, top: 14, color: 'var(--text-tertiary)' }} />
            <input type="password" className="glass-input" style={{ paddingLeft: '2.3rem' }} value={form.password} onChange={set('password')} required minLength={6} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">确认密码</label>
          <input type="password" className="glass-input" value={form.confirmPassword} onChange={set('confirmPassword')} required minLength={6} />
        </div>
        <div className="form-group">
          <label className="form-label">邀请码</label>
          <div style={{ position: 'relative' }}>
            <Key size={16} style={{ position: 'absolute', left: 12, top: 14, color: 'var(--text-tertiary)' }} />
            <input className="glass-input" style={{ paddingLeft: '2.3rem', fontFamily: 'monospace', letterSpacing: '1px' }} value={form.invitationCode} onChange={set('invitationCode')} required />
          </div>
        </div>
        <button className="glass-button" disabled={loading} type="submit">
          {loading ? <Loader2 size={16} /> : <UserPlus size={16} />}
          {loading ? '正在创建账号...' : '注册'}
        </button>
      </form>
      <p style={{ textAlign: 'center', marginTop: '1.2rem' }} className="muted">
        已有账号？ <Link to="/login">登录</Link>
      </p>
    </div>
  )
}
