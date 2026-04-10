import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import Ticker from '../components/Ticker'
import TrustpilotBar from '../components/TrustpilotBar'
import './Home.css'

const mediaLogos = ['BusinessDay', 'The Guardian', 'Punch', 'TechCabal', 'Nairametrics']

export default function Home() {
  const navigate = useNavigate()
  return (
    <div className="home">
      <Navbar />

      {/* Hero */}
      <section className="hero">
        <div className="container hero-content">
          <h1 className="hero-title">Property Done Smarter</h1>
          <p className="hero-sub">
            Buy, sell, or promote property with ease. From international<br />
            purchases to connecting with serious buyers — we help you<br />
            move faster.
          </p>
          <button className="btn-primary hero-cta" onClick={() => navigate('/get-started')}>
            Get started Today
          </button>
        </div>
        <div className="hero-image-wrap">
          <div className="hero-image-bg" />
          <img
            src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&q=80"
            alt="Modern property"
            className="hero-img"
          />
        </div>
      </section>

      <Ticker />

      {/* As seen on */}
      <div className="seen-on">
        <div className="container seen-on-inner">
          <span className="seen-label">AS SEEN ON</span>
          {mediaLogos.map(logo => (
            <span key={logo} className="seen-logo">{logo}</span>
          ))}
        </div>
      </div>

      <TrustpilotBar />

      {/* What We Offer */}
      <section className="what-we-offer">
        <div className="container">
          <p className="section-label" style={{ textAlign: 'center' }}>WHAT WE OFFER</p>
          <h2 className="offer-title">Simplifying every step<br />of your property journey</h2>

          <div className="offer-grid">
            {/* Buyers */}
            <div className="offer-col offer-buyers">
              <div className="offer-col-header">
                <span className="offer-badge offer-badge-pink">For Buyers</span>
              </div>
              <div className="offer-card offer-card-pink">
                <h3>Buy Property Abroad</h3>
                <p>Expert advisory for acquiring residential and commercial property abroad. We handle the complexity so you don't have to.</p>
                <button className="offer-learn" onClick={() => navigate('/buy-abroad')}>LEARN MORE →</button>
              </div>
              <div className="offer-card offer-card-pink">
                <h3>Property Matching</h3>
                <p>Get matched to the right property and enjoy discounted legal fees when buying through our nominated agent.</p>
                <button className="offer-learn" onClick={() => navigate('/property-matching')}>LEARN MORE →</button>
              </div>
            </div>

            {/* Sellers */}
            <div className="offer-col offer-sellers">
              <div className="offer-col-header">
                <span className="offer-badge offer-badge-teal">For Sellers</span>
              </div>
              <div className="offer-card offer-card-teal">
                <h3>Elite Property Introductions</h3>
                <p>Showcase your property to a curated list of ready-to-buy offshore buyers who are actively seeking.</p>
                <button className="offer-learn" onClick={() => navigate('/elite-property')}>LEARN MORE →</button>
              </div>
              <div className="offer-card offer-card-teal">
                <h3>Sell Faster (Havlo Relaunch™)</h3>
                <p>A dedicated programme helping slow to slow-to-sell properties listed for over 6 months find their buyer.</p>
                <button className="offer-learn" onClick={() => navigate('/sell-faster')}>LEARN MORE →</button>
              </div>
              <div className="offer-card offer-card-teal">
                <h3>Property Sale Audit (Havlo Relaunch Assessment)</h3>
                <p>Uncover why your property hasn't sold and get a clear, actionable plan to relaunch it successfully.</p>
                <button className="offer-learn" onClick={() => navigate('/sell-faster')}>LEARN MORE →</button>
              </div>
            </div>

            {/* Agents */}
            <div className="offer-col offer-agents">
              <div className="offer-col-header">
                <span className="offer-badge offer-badge-lavender">For Agents</span>
              </div>
              <div className="offer-card offer-card-lavender">
                <h3>International Buyer Network</h3>
                <p>Sell properties faster by going beyond property portals and connecting listings with a curated network of qualified, ready-to-buy international buyers.</p>
                <button className="offer-learn" onClick={() => navigate('/international-buyer-network')}>LEARN MORE →</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Havlo Difference */}
      <section className="difference-section">
        <div className="container">
          <h2 className="difference-title">The Havlo Difference</h2>
          <div className="difference-grid">
            <div className="difference-card">
              <span className="difference-num">01</span>
              <h3>Results-Driven Approach</h3>
              <p>Thousands of property owners have trusted Havlo, backed by a track record of successful transactions that speak for themselves.</p>
            </div>
            <div className="difference-card">
              <span className="difference-num">01</span>
              <h3>Global Network, Local Insight</h3>
              <p>We combine international reach with deep local knowledge — giving you an edge no matter where the deal takes place.</p>
            </div>
            <div className="difference-card">
              <span className="difference-num">01</span>
              <h3>End-to-End Support</h3>
              <p>From first enquiry to final handshake, our team navigates every legal, financial, and logistical detail alongside you.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="cta-banner">
        <div className="container cta-banner-inner">
          <h2>Ready to Start Your<br />Property Journey?</h2>
          <p>Get expert guidance and unbiased advice for your international property purchase. Let us make the process smooth and stress-free.</p>
          <button className="btn-primary cta-banner-btn" onClick={() => navigate('/get-started')}>
            Get started Today
          </button>
        </div>
      </section>

      <Footer />
    </div>
  )
}
