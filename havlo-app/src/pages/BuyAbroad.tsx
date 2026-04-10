import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import Ticker from '../components/Ticker'
import TrustpilotBar from '../components/TrustpilotBar'
import './PageCommon.css'
import './BuyAbroad.css'

const regions = [
  { flag: '🇪🇺', name: 'Europe', countries: 'United Kingdom, Spain, Portugal' },
  { flag: '🌍', name: 'Middle East', countries: 'UAE, Saudi Arabia, Oman' },
  { flag: '🌎', name: 'Americas', countries: 'United States, Mexico, Canada' },
  { flag: '🌏', name: 'Asia & Asia-Pacific', countries: 'Thailand, Indonesia, Japan' },
  { flag: '🌍', name: 'Africa', countries: 'South Africa, Morocco, Egypt' },
  { flag: '🌏', name: 'Oceania', countries: 'Australia' },
]

const buyerTypes = ['High-Value Investors', 'Rental & Capital Buyers', 'Residency Investors', 'Ready-to-Purchase Buyers']

export default function BuyAbroad() {
  const navigate = useNavigate()
  return (
    <div className="page">
      <Navbar />

      {/* Hero */}
      <section className="page-hero page-hero-light">
        <div className="container page-hero-content">
          <h1 className="page-hero-title">A Smoother Way to Buy<br />Property Overseas</h1>
          <p className="page-hero-sub">Your property search, survey, legal work and purchase — all done in one peaceful place.</p>
          <button className="btn-primary" onClick={() => navigate('/get-started')}>Get started Today</button>
        </div>
        <div className="page-hero-img-wrap">
          <img src="https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200&q=80" alt="Luxury property" className="page-hero-img" />
        </div>
      </section>

      <Ticker />
      <TrustpilotBar />

      {/* Who This Is For */}
      <section className="who-section">
        <div className="container">
          <p className="section-label">WHO THIS IS FOR</p>
          <h2>We work exclusively with a select group of investors and buyers who need a clear set of criteria — and are ready to move.</h2>
          <div className="who-tabs">
            {buyerTypes.map((t, i) => (
              <button key={t} className={`who-tab ${i === 0 ? 'active' : ''}`}>{t}</button>
            ))}
          </div>
          <div className="who-card">
            <div className="who-card-img">
              <img src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=500&q=80" alt="" />
            </div>
            <div className="who-card-body">
              <span className="who-num">— 01</span>
              <h3>Investors Deploying $X+</h3>
              <p>Serious real or absolute allocation seeking structured, high-yield real estate with clear return profiles and risk-managed entry points.</p>
              <p className="who-threshold">MINIMUM THRESHOLD APPLIES</p>
              <p className="who-qualify">Not sure if you qualify? Let's have a private conversation.</p>
              <button className="btn-outline" onClick={() => navigate('/contact')}>SCHEDULE A CONSULTATION →</button>
            </div>
          </div>
        </div>
      </section>

      {/* Where We Operate */}
      <section className="operate-section">
        <div className="container">
          <h2 style={{ textAlign: 'center', marginBottom: 12 }}>Where We Operate</h2>
          <p style={{ textAlign: 'center', color: 'var(--color-gray-500)', marginBottom: 48 }}>We specialise in helping you purchase property across select international markets, with expert local knowledge and dedicated support.</p>
          <div className="operate-grid">
            {regions.map(r => (
              <div key={r.name} className="operate-card">
                <span className="operate-flag">{r.flag}</span>
                <h4>{r.name}</h4>
                <p>{r.countries}</p>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 36 }}>
            <button className="btn-primary" onClick={() => navigate('/contact')}>View All</button>
          </div>
        </div>
      </section>

      {/* Help section - purple */}
      <section className="help-purple">
        <div className="container">
          <h2>Need help buying a property abroad? We can help.</h2>
          <p>Get unbiased property purchase advice from our expert team and understand the complexities of international real estate.</p>
          <div className="help-steps">
            <div className="help-step">
              <span className="help-step-num">01</span>
              <div>
                <h3>Need help buying a property abroad? We can help.</h3>
                <p>Need help buying a property abroad? We can help.</p>
              </div>
            </div>
            <div className="help-step">
              <span className="help-step-num">02</span>
              <div>
                <h3>We do your legal work and survey too</h3>
                <p>For a competitive price, we can help you with every aspect of buying a home abroad.</p>
              </div>
            </div>
            <div className="help-step">
              <span className="help-step-num">03</span>
              <div>
                <h3>A friendly team by your side</h3>
                <p>A dedicated case manager designed to guide you through the process from start to finish.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-banner" style={{ background: 'white', padding: '80px 0', textAlign: 'center' }}>
        <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <h2 style={{ fontSize: 'clamp(32px,5vw,52px)', fontWeight: 800 }}>Ready to Start Your<br />Property Journey?</h2>
          <p style={{ color: 'var(--color-gray-500)', maxWidth: 500 }}>Get expert guidance and unbiased advice for your international property purchase. Let us make the process smooth and stress-free.</p>
          <button className="btn-primary" onClick={() => navigate('/get-started')}>Get started Today</button>
        </div>
      </section>

      <Footer />
    </div>
  )
}
