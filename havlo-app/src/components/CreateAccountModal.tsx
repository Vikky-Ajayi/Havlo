import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface Props {
  onClose: () => void
  onSwitchToLogin: () => void
}

export default function CreateAccountModal({ onClose, onSwitchToLogin }: Props) {
  const [showPw, setShowPw] = useState(false)
  const [showPw2, setShowPw2] = useState(false)
  const navigate = useNavigate()

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 520 }}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 32, marginBottom: 6 }}>Create account</h2>
        <p style={{ fontSize: 14, color: 'var(--color-gray-500)', marginBottom: 24 }}>Join thousands of Users finding their dream properties worldwide</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <input className="form-input" type="text" placeholder="First name" />
            <input className="form-input" type="text" placeholder="Last name" />
          </div>
          <input className="form-input" type="email" placeholder="Email" />
          <div style={{ position: 'relative' }}>
            <input className="form-input" type="text" placeholder="+44   Enter phone number" />
          </div>
          <div style={{ position: 'relative' }}>
            <input className="form-input" type={showPw ? 'text' : 'password'} placeholder="Password" style={{ paddingRight: 48 }} />
            <button onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-gray-500)', fontSize: 18 }}>
              {showPw ? '👁' : '🙈'}
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <input className="form-input" type={showPw2 ? 'text' : 'password'} placeholder="Repeat password" style={{ paddingRight: 48 }} />
            <button onClick={() => setShowPw2(v => !v)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-gray-500)', fontSize: 18 }}>
              {showPw2 ? '👁' : '🙈'}
            </button>
          </div>
          <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '16px', borderRadius: 'var(--radius-full)' }}
            onClick={() => { onClose(); navigate('/dashboard/consultation') }}>
            Create account
          </button>
          <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--color-gray-600)' }}>
            Already have an account?{' '}
            <button onClick={onSwitchToLogin} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline', color: 'var(--color-black)' }}>
              Log in
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
