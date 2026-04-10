import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import './PageCommon.css'

export default function BuyerSeller() {
  const navigate = useNavigate()
  return (
    <div className="page">
      <Navbar />
      <section style={{ padding: '100px 0', background: 'linear-gradient(135deg, #fce7f3 0%, #ede9fe 100%)', textAlign: 'center' }}>
        <div className="container">
          <h1 style={{ fontSize: 'clamp(36px,5vw,64px)', fontWeight: 800, marginBottom: 20 }}>BUYER × SELLER</h1>
          <p style={{ color: 'var(--color-gray-600)', maxWidth: 560, margin: '0 auto 36px', fontSize: 17, lineHeight: 1.7 }}>Connecting serious buyers directly with motivated sellers through Havlo's curated network.</p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn-primary" onClick={() => navigate('/buy-abroad')}>I'm a Buyer</button>
            <button className="btn-outline" onClick={() => navigate('/elite-property')}>I'm a Seller</button>
          </div>
        </div>
      </section>
      <section style={{ padding: '80px 0' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
            <div style={{ background: '#fce7f3', borderRadius: 20, padding: 40 }}>
              <h2 style={{ fontWeight: 800, fontSize: 28, marginBottom: 16 }}>For Buyers</h2>
              <p style={{ color: 'var(--color-gray-700)', lineHeight: 1.7, marginBottom: 24 }}>Access exclusive off-market properties and connect directly with motivated sellers. Skip the portals and find your dream property abroad faster.</p>
              <button className="btn-primary" onClick={() => navigate('/buy-abroad')}>Find Properties →</button>
            </div>
            <div style={{ background: '#ede9fe', borderRadius: 20, padding: 40 }}>
              <h2 style={{ fontWeight: 800, fontSize: 28, marginBottom: 16 }}>For Sellers</h2>
              <p style={{ color: 'var(--color-gray-700)', lineHeight: 1.7, marginBottom: 24 }}>Get your property in front of qualified international buyers who are actively looking. No commission on sale — just serious introductions.</p>
              <button className="btn-primary" style={{ background: 'var(--color-purple)' }} onClick={() => navigate('/elite-property')}>List Your Property →</button>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  )
}
