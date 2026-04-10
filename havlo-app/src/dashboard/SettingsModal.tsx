import { useState } from 'react'
import './SettingsModal.css'

interface Props { onClose: () => void }

export default function SettingsModal({ onClose }: Props) {
  const [tab, setTab] = useState<'profile' | 'password'>('profile')
  const [showOld, setShowOld] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box settings-modal">
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 28, marginBottom: 20 }}>Settings</h2>

        <div className="settings-tabs">
          <button className={`settings-tab ${tab === 'profile' ? 'active' : ''}`} onClick={() => setTab('profile')}>Profile</button>
          <button className={`settings-tab ${tab === 'password' ? 'active' : ''}`} onClick={() => setTab('password')}>Change Password</button>
        </div>

        {tab === 'profile' && (
          <div className="settings-form">
            <input className="form-input" type="text" placeholder="First name" />
            <input className="form-input" type="text" placeholder="Last name" />
            <input className="form-input" type="email" placeholder="Email" />
            <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '16px' }}>Save Changes</button>
          </div>
        )}

        {tab === 'password' && (
          <div className="settings-form">
            <div style={{ position: 'relative' }}>
              <input className="form-input" type={showOld ? 'text' : 'password'} placeholder="Old password" style={{ paddingRight: 48 }} />
              <button onClick={() => setShowOld(v => !v)} className="pw-toggle">{showOld ? '👁' : '🙈'}</button>
            </div>
            <div style={{ position: 'relative' }}>
              <input className="form-input" type={showNew ? 'text' : 'password'} placeholder="New password" style={{ paddingRight: 48 }} />
              <button onClick={() => setShowNew(v => !v)} className="pw-toggle">{showNew ? '👁' : '🙈'}</button>
            </div>
            <div style={{ position: 'relative' }}>
              <input className="form-input" type={showConfirm ? 'text' : 'password'} placeholder="Confirm new password" style={{ paddingRight: 48 }} />
              <button onClick={() => setShowConfirm(v => !v)} className="pw-toggle">{showConfirm ? '👁' : '🙈'}</button>
            </div>
            <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '16px' }}>Update Password</button>
          </div>
        )}
      </div>
    </div>
  )
}
