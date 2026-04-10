import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import LoginModal from './LoginModal'
import CreateAccountModal from './CreateAccountModal'
import './Navbar.css'

export default function Navbar() {
  const [showLogin, setShowLogin] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()

  const handleSwitchToCreate = () => { setShowLogin(false); setShowCreate(true) }
  const handleSwitchToLogin = () => { setShowCreate(false); setShowLogin(true) }

  const toggleDropdown = (name: string) =>
    setActiveDropdown(prev => (prev === name ? null : name))

  return (
    <>
      <nav className="navbar">
        <div className="navbar-inner">
          <Link to="/" className="navbar-logo">
            <LogoSVG />
          </Link>

          <button className="navbar-burger" onClick={() => setMenuOpen(o => !o)} aria-label="Menu">
            <span /><span /><span />
          </button>

          <div className={`navbar-links ${menuOpen ? 'open' : ''}`}>
            <div className="nav-dropdown">
              <button className="nav-link" onClick={() => toggleDropdown('services')}>
                Services <ChevronDown />
              </button>
              {activeDropdown === 'services' && (
                <div className="dropdown-menu">
                  <Link to="/home-buying" className="dropdown-item" onClick={() => setActiveDropdown(null)}>Property Purchase</Link>
                  <Link to="/property-purchase" className="dropdown-item" onClick={() => setActiveDropdown(null)}>Property Management</Link>
                  <Link to="/sell-faster" className="dropdown-item" onClick={() => setActiveDropdown(null)}>Sell Your Property</Link>
                  <Link to="/home-buying" className="dropdown-item" onClick={() => setActiveDropdown(null)}>Complete Home-Buying Service</Link>
                </div>
              )}
            </div>

            <div className="nav-dropdown">
              <button className="nav-link" onClick={() => toggleDropdown('whoweare')}>
                Who we are <ChevronDown />
              </button>
              {activeDropdown === 'whoweare' && (
                <div className="dropdown-menu">
                  <Link to="/about" className="dropdown-item" onClick={() => setActiveDropdown(null)}>About</Link>
                  <Link to="/faq" className="dropdown-item" onClick={() => setActiveDropdown(null)}>FAQ</Link>
                  <Link to="/contact" className="dropdown-item" onClick={() => setActiveDropdown(null)}>Contact Us</Link>
                  <Link to="/referral" className="dropdown-item" onClick={() => setActiveDropdown(null)}>Referrals</Link>
                </div>
              )}
            </div>

            <div className="nav-dropdown">
              <button className="nav-link" onClick={() => toggleDropdown('exclusives')}>
                Havlo Exclusives <ChevronDown />
              </button>
              {activeDropdown === 'exclusives' && (
                <div className="dropdown-menu">
                  <Link to="/elite-property" className="dropdown-item" onClick={() => setActiveDropdown(null)}>Elite Property Introduction</Link>
                  <Link to="/marketing" className="dropdown-item" onClick={() => setActiveDropdown(null)}>International Property Marketing</Link>
                  <Link to="/property-matching" className="dropdown-item" onClick={() => setActiveDropdown(null)}>Havlo Property Matching</Link>
                  <Link to="/international-buyer-network" className="dropdown-item" onClick={() => setActiveDropdown(null)}>International Buyer Network</Link>
                  <Link to="/buyer-seller" className="dropdown-item" onClick={() => setActiveDropdown(null)}>Buyer × Seller</Link>
                </div>
              )}
            </div>

            <Link to="/contact" className="nav-link">Contact us</Link>
            <Link to="/referral" className="nav-link">Referrals</Link>
          </div>

          <div className="navbar-actions">
            <button className="btn-login" onClick={() => setShowLogin(true)}>Log in</button>
            <button className="btn-primary btn-sm" onClick={() => navigate('/get-started')}>Get Started</button>
            <div className="lang-selector">
              <span>🇬🇧</span>
              <ChevronDown />
            </div>
          </div>
        </div>
      </nav>

      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onSwitchToCreate={handleSwitchToCreate}
        />
      )}
      {showCreate && (
        <CreateAccountModal
          onClose={() => setShowCreate(false)}
          onSwitchToLogin={handleSwitchToLogin}
        />
      )}
    </>
  )
}

function ChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

export function LogoSVG() {
  return (
    <svg width="90" height="28" viewBox="0 0 90 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <text x="0" y="22" fontFamily="'Syne', sans-serif" fontWeight="800" fontSize="22" fill="#0a0a0a" letterSpacing="2">HAVLO</text>
    </svg>
  )
}
