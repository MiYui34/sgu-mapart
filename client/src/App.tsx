import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { NotificationProvider } from './contexts/NotificationContext'
import LoginForm from './components/auth/LoginForm'
import RegisterForm from './components/auth/RegisterForm'
import InvitationManager from './components/admin/InvitationManager'
import EditorPage from './components/editor/EditorPage'
import MarketPage from './components/market/MarketPage'
import WorkDetail from './components/market/WorkDetail'
import { Footer } from './components/layout/Navbar'

function AuthScreen({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '2rem' }}>
        <div style={{ width: 'min(460px, 100%)' }}>
          <h1 style={{ textAlign: 'center', marginBottom: '1.2rem' }}>SGU 地图画</h1>
          {children}
        </div>
      </div>
      <Footer />
    </div>
  )
}

export default function App() {
  return (
    <NotificationProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<AuthScreen><LoginForm /></AuthScreen>} />
          <Route path="/register" element={<AuthScreen><RegisterForm /></AuthScreen>} />
          <Route path="/admin/invitations" element={<InvitationManager />} />
          <Route path="/" element={<EditorPage />} />
          <Route path="/market" element={<MarketPage />} />
          <Route path="/market/:id" element={<WorkDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </NotificationProvider>
  )
}
