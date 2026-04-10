import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface Props {
  onClose: () => void
  onSwitchToCreate: () => void
}

export default function LoginModal({ onClose, onSwitchToCreate }: Props) {
  const [showPw, setShowPw] = useState(false)
  const navigate = useNavigate()

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 28, marginBottom: 24 }}>Log in</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <input className="form-input" type="email" placeholder="Email" />
          <div style={{ position: 'relative' }}>
            <input className="form-input" type={showPw ? 'text' : 'password'} placeholder="Password" style={{ paddingRight: 48 }} />
            <button onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-gray-500)', fontSize: 18 }}>
              {showPw ? '👁' : '🙈'}
            </button>
          </div>
          <div style={{ textAlign: 'center' }}>
            <button onClick={() => { onClose(); navigate('/forgot-password') }} style={{ background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: 14, color: 'var(--color-gray-700)' }}>
              Forgot Password?
            </button>
          </div>
          <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '16px', borderRadius: 'var(--radius-full)' }}
            onClick={() => { onClose(); navigate('/dashboard/consultation') }}>
            Log in
          </button>
          <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--color-gray-600)' }}>
            Don't have an account?{' '}
            <button onClick={onSwitchToCreate} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline', color: 'var(--color-black)' }}>
              Create Account
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
