import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import './PageCommon.css'

export default function PropertyPurchase() {
  const navigate = useNavigate()
  return (
    <div className="page">
      <Navbar />
      <section style={{ padding: '100px 0', textAlign: 'center', background: 'var(--color-gray-50)' }}>
        <div className="container">
          <h1 style={{ fontSize: 'clamp(36px,5vw,64px)', fontWeight: 800, marginBottom: 20 }}>Property Purchase</h1>
          <p style={{ color: 'var(--color-gray-600)', maxWidth: 560, margin: '0 auto 36px', fontSize: 17, lineHeight: 1.7 }}>Expert guidance through every step of buying property abroad. From search to completion, we handle the complexity so you don't have to.</p>
          <button className="btn-primary" onClick={() => navigate('/get-started')}>Start Your Journey</button>
        </div>
      </section>
      <section style={{ padding: '80px 0' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
            {['Property Search','Legal Due Diligence','Purchase Completion','Post-Purchase Support','Tax & Compliance','Ongoing Management'].map(s => (
              <div key={s} style={{ padding: '32px 24px', border: '1px solid var(--color-gray-200)', borderRadius: 16, background: 'white' }}>
                <h3 style={{ fontWeight: 700, marginBottom: 10 }}>{s}</h3>
                <p style={{ fontSize: 14, color: 'var(--color-gray-500)', lineHeight: 1.6 }}>Comprehensive support at every stage of your property purchase journey.</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  )
}
