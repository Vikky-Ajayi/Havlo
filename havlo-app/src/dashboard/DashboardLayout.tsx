import { useState } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import SettingsModal from './SettingsModal'
import './DashboardLayout.css'

export default function DashboardLayout() {
  const [showSettings, setShowSettings] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <aside className="dash-sidebar">
        <div className="dash-logo">
          <Link to="/">HAVLO</Link>
        </div>
        <nav className="dash-nav">
          <Link to="/dashboard/consultation" className={`dash-nav-item ${location.pathname.includes('consultation') ? 'active' : ''}`}>
            <span className="dash-nav-icon">❓</span>Consultation
          </Link>
          <Link to="/dashboard/experts" className={`dash-nav-item ${location.pathname.includes('experts') ? 'active' : ''}`}>
            <span className="dash-nav-icon">💬</span>Chat with experts
          </Link>
        </nav>
        <div className="dash-sidebar-bottom">
          <div className="dash-user">
            <div className="dash-avatar">A</div>
            <div>
              <p className="dash-user-name">Allen Walker</p>
            </div>
          </div>
          <button className="dash-logout" onClick={() => navigate('/')}>
            <span>↩</span> Log out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="dash-main">
        {/* Top bar */}
        <header className="dash-topbar">
          <h2 className="dash-page-title">
            {location.pathname.includes('consultation') ? 'Consultation' : location.pathname.includes('experts') ? 'Chat with Experts' : location.pathname.includes('book') ? 'Book a Session' : 'Dashboard'}
          </h2>
          <div className="dash-topbar-right">
            <button className="dash-account-btn" onClick={() => setShowSettings(true)}>
              <div className="dash-avatar-sm">F</div>
              Account ▾
            </button>
          </div>
        </header>

        <div className="dash-content">
          <Outlet />
        </div>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}
