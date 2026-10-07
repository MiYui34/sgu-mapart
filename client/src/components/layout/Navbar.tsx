import { Grid3x3, KeyRound, LogIn, LogOut, Moon, Sun } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { currentUser } from '../../lib/api'

export default function Navbar() {
  const navigate = useNavigate()
  const token = localStorage.getItem('jwt_token')
  const user = token ? currentUser() : null
  const light = document.documentElement.classList.contains('light-theme')

  const toggleTheme = () => {
    document.documentElement.classList.toggle('light-theme')
    localStorage.setItem('theme', document.documentElement.classList.contains('light-theme') ? 'light' : 'dark')
    navigate(0)
  }

  const logout = () => {
    localStorage.removeItem('jwt_token')
    localStorage.removeItem('user')
    sessionStorage.removeItem('guest_mode')
    navigate('/login')
  }

  return (
    <header className="nav">
      <Link to="/" className="nav-brand">
        <span className="logo-mark"><Grid3x3 size={18} /></span>
        <strong>SGU 地图画</strong>
      </Link>
      <nav className="nav-links">
        <Link to="/">做图</Link>
        <Link to="/guide">说明</Link>
        <Link to="/market">市场</Link>
        {user?.role === 'admin' && (
          <Link to="/admin/invitations"><KeyRound size={15} style={{ verticalAlign: '-2px' }} /> 邀请码</Link>
        )}
      </nav>
      <div className="nav-actions">
        <button className="icon-button" type="button" onClick={toggleTheme} title="切换主题">
          {light ? <Moon size={18} /> : <Sun size={18} />}
        </button>
        {user ? (
          <>
            <span className="muted">{user.username}</span>
            <button className="btn secondary" type="button" onClick={logout}><LogOut size={16} />退出</button>
          </>
        ) : (
          <button className="btn" type="button" onClick={() => navigate('/login')}><LogIn size={16} />登录</button>
        )}
      </div>
    </header>
  )
}

export function Footer() {
  return (
    <footer className="site-footer">
      <span>地图画作品版权归上传者。源代码遵循 GPL-3.0。</span>
      <a href="https://github.com/MiYui34/sgu-mapart" target="_blank" rel="noreferrer">github.com/MiYui34/sgu-mapart</a>
    </footer>
  )
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="page">{children}</main>
      <Footer />
    </>
  )
}
