import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import './PageCommon.css'

export default function InternationalBuyerNetwork() {
  const navigate = useNavigate()
  const benefits = [
    'Access to a curated network of qualified, ready-to-buy international buyers',
    'Properties listed on our exclusive international buyer portal',
    'Strategic positioning to attract offshore demand',
    'Discreet, professional introduction service',
    'No commission on sale — marketing service only',
    'Works alongside your existing agent',
  ]
  return (
    <div className="page">
      <Navbar />
      <section style={{ background: 'var(--color-black)', color: 'white', padding: '100px 0', textAlign: 'center' }}>
        <div className="container">
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.5)', marginBottom: 16, textTransform: 'uppercase' }}>For Agents</p>
          <h1 style={{ fontSize: 'clamp(32px,5vw,60px)', fontWeight: 800, marginBottom: 20, lineHeight: 1.1 }}>International Buyer Network</h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', maxWidth: 560, margin: '0 auto 36px', fontSize: 17, lineHeight: 1.7 }}>Sell properties faster by going beyond property portals and connecting listings with a curated network of qualified, ready-to-buy international buyers.</p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn-white" onClick={() => navigate('/contact')}>Join the Network</button>
            <button style={{ padding: '14px 28px', background: 'transparent', border: '1.5px solid rgba(255,255,255,0.3)', borderRadius: 9999, color: 'white', fontWeight: 600, cursor: 'pointer' }} onClick={() => navigate('/contact')}>Learn More</button>
          </div>
        </div>
      </section>
      <section style={{ padding: '80px 0' }}>
        <div className="container">
          <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 800, marginBottom: 48, textAlign: 'center' }}>Why Agents Choose Our Network</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 20, maxWidth: 800, margin: '0 auto' }}>
            {benefits.map((b, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '20px 24px', background: 'var(--color-gray-50)', borderRadius: 12, border: '1px solid var(--color-gray-200)' }}>
                <span style={{ color: 'var(--color-green)', fontWeight: 700, fontSize: 18, flexShrink: 0 }}>✓</span>
                <p style={{ fontSize: 15, color: 'var(--color-gray-700)', lineHeight: 1.5 }}>{b}</p>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 48 }}>
            <button className="btn-primary" onClick={() => navigate('/contact')}>Register Your Listings</button>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  )
}
