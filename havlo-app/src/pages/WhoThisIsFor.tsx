import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import './PageCommon.css'

export default function WhoThisIsFor() {
  const navigate = useNavigate()
  return (
    <div className="page">
      <Navbar />
      <section style={{ padding: '100px 0', background: 'linear-gradient(135deg,#0f172a 0%,#1e1b4b 100%)', color: 'white', textAlign: 'center' }}>
        <div className="container">
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>WHO THIS IS FOR</p>
          <h1 style={{ fontSize: 'clamp(36px,5vw,64px)', fontWeight: 800, marginBottom: 24 }}>Built for Serious Property Buyers</h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', maxWidth: 560, margin: '0 auto 40px', fontSize: 17, lineHeight: 1.7 }}>We work exclusively with a select group of investors and buyers who meet a clear set of criteria — and are ready to move.</p>
          <button className="btn-white" onClick={() => navigate('/get-started')}>Get Started Today</button>
        </div>
      </section>
      <section style={{ padding: '80px 0' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
            {['High-Value Investors','Rental & Capital Buyers','Residency Investors','Ready-to-Purchase Buyers','Property Developers','Family Office Allocators'].map(t => (
              <div key={t} style={{ background: 'var(--color-gray-50)', border: '1px solid var(--color-gray-200)', borderRadius: 16, padding: '28px 24px' }}>
                <h3 style={{ fontWeight: 700, marginBottom: 8 }}>{t}</h3>
                <p style={{ fontSize: 14, color: 'var(--color-gray-500)', lineHeight: 1.6 }}>Serious allocation seeking structured, high-yield real estate with clear return profiles and risk-managed entry points.</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  )
}
