import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import './PageCommon.css'

export default function PropertyMatching() {
  const navigate = useNavigate()
  return (
    <div className="page">
      <Navbar />
      <section className="page-hero page-hero-light" style={{ paddingBottom: 80 }}>
        <div className="container page-hero-content">
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--color-purple)', marginBottom: 12, textTransform: 'uppercase' }}>Havlo Property Matching</p>
          <h1 className="page-hero-title">Get Matched to Your<br />Perfect Property</h1>
          <p className="page-hero-sub">Get matched to the right property and enjoy discounted legal fees when buying through our nominated agent.</p>
          <button className="btn-primary" onClick={() => navigate('/get-started')}>Start Matching</button>
        </div>
      </section>
      <section style={{ padding: '80px 0', background: 'var(--color-gray-50)' }}>
        <div className="container">
          <h2 style={{ textAlign: 'center', fontSize: 'clamp(28px,4vw,44px)', fontWeight: 800, marginBottom: 48 }}>How Property Matching Works</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
            {[
              { step: '01', title: 'Share Your Criteria', desc: 'Tell us your budget, preferred locations, property type, and investment goals.' },
              { step: '02', title: 'We Find Matches', desc: 'Our team curates a shortlist of properties that precisely match your brief.' },
              { step: '03', title: 'Connect & Purchase', desc: 'We introduce you to our nominated agent and you enjoy discounted legal fees.' },
            ].map(s => (
              <div key={s.step} style={{ background: 'white', border: '1px solid var(--color-gray-200)', borderRadius: 16, padding: 32 }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 40, fontWeight: 800, color: 'var(--color-purple)' }}>{s.step}</span>
                <h3 style={{ fontWeight: 700, marginBottom: 10, marginTop: 12 }}>{s.title}</h3>
                <p style={{ fontSize: 14, color: 'var(--color-gray-600)', lineHeight: 1.6 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section style={{ padding: '80px 0', textAlign: 'center' }}>
        <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <h2 style={{ fontSize: 'clamp(28px,4vw,48px)', fontWeight: 800 }}>Ready to Find Your Property?</h2>
          <p style={{ color: 'var(--color-gray-500)', maxWidth: 480 }}>Start your property matching journey and let us do the searching for you.</p>
          <button className="btn-primary" onClick={() => navigate('/get-started')}>Get Started</button>
        </div>
      </section>
      <Footer />
    </div>
  )
}
