import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import './PageCommon.css'
import './HomeBuying.css'

export default function HomeBuying() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'buying' | 'both'>('buying')
  const [price, setPrice] = useState(2000)

  const yourPrice = Math.round(price * 1.4)
  const conveyancing = Math.round(price * 0.8)
  const survey = Math.round(price * 0.22)

  return (
    <div className="page">
      <Navbar />

      {/* Hero */}
      <section className="hb-hero">
        <div className="container hb-hero-content">
          <h1>Buying a home abroad just<br />got a whole lot easier.</h1>
          <p>Everything you need in one, peaceful place</p>
          <button className="btn-primary" onClick={() => navigate('/get-started')}>Get started Today</button>
        </div>

        {/* Dashboard preview */}
        <div className="container hb-dashboard-preview">
          <div className="hb-dashboard-card hb-card-done">
            <span className="hb-card-status done">DONE</span>
            <p>Property sourced</p>
          </div>
          <div className="hb-dashboard-card hb-card-progress">
            <span className="hb-card-status progress">IN PROGRESS</span>
            <p>Offer made</p>
          </div>
          <div className="hb-dashboard-card hb-card-coming">
            <span className="hb-card-status coming">COMING UP</span>
            <p>Purchase completed</p>
          </div>
          <div className="hb-dashboard-card hb-card-coming2">
            <span className="hb-card-status coming">COMING UP</span>
            <p>Get the keys!</p>
          </div>
        </div>

        <div className="container hb-track-text">
          <h2>Track everything in one<br />place, on your dashboard</h2>
        </div>
      </section>

      {/* What We Offer */}
      <section className="hb-offer">
        <div className="container hb-offer-inner">
          <div className="hb-offer-left">
            <h2>What we offer</h2>
            <p>From search to completion, we provide an end-to-end experience for buying property abroad.</p>
          </div>
          <div className="hb-plans">
            <div className="hb-plan">
              <div className="hb-plan-header essential">Essential Access – From £2000</div>
              <h4>Expert mortgage advice &amp; application service Starting from £2000</h4>
              {['Property search and shortlisting support', 'Guidance on international ownership options', 'Country-specific buying process overview', 'Access to vetted local agents and partners', 'Document checklist and timeline planning'].map(f => (
                <div key={f} className="hb-plan-feature"><span className="hb-check">✓</span>{f}</div>
              ))}
            </div>
            <div className="hb-plan hb-plan-plus">
              <div className="hb-plan-header plus">Essential Plus – Starting from £5000</div>
              <h4>Property survey, legal work &amp; more</h4>
              {['Everything in Essential Access, plus:', 'End-to-end purchase coordination', 'Negotiation and offer support', 'Legal, tax, and financing guidance (via local experts)', 'Ongoing liaison with agents, lawyers, and developers', 'Support through completion and handover'].map(f => (
                <div key={f} className="hb-plan-feature"><span className="hb-check">✓</span>{f}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="hb-how">
        <div className="container">
          <h2>How it works</h2>
          <p>What's your situation?</p>
          <div className="hb-tabs">
            <button className={`hb-tab ${tab === 'buying' ? 'active' : ''}`} onClick={() => setTab('buying')}>
              <span className="hb-tab-dot" />I'm buying
            </button>
            <button className={`hb-tab ${tab === 'both' ? 'active' : ''}`} onClick={() => setTab('both')}>
              <span className="hb-tab-dot outline" />I'm buying and selling
            </button>
          </div>
          <div className="hb-journey">
            {[
              { pos: 'left', title: 'Bespoke Consultation', desc: 'We start with a personalised consultation to understand your goals, budget, and preferred locations.' },
              { pos: 'right', title: 'Curated Property Options', desc: 'Based on your brief, we present carefully selected residential or commercial properties abroad.' },
              { pos: 'left', title: 'Offer & Purchase Management', desc: 'We support negotiations, due diligence, and contracts, guiding you through every step of the buying process.' },
              { pos: 'right', title: 'Completion & Handover', desc: 'We oversee the final stages through to completion, ensuring a smooth and confident property handover.v' },
              { pos: 'left', title: 'Ongoing Ownership Support', desc: 'From property management to resale or expansion, we continue to support you after you\'ve purchased.' },
            ].map((step, i) => (
              <div key={i} className={`hb-journey-step ${step.pos}`}>
                <div className="hb-journey-dot" />
                <div className="hb-journey-card">
                  <h4>{step.title}</h4>
                  <p>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <button className="btn-primary" onClick={() => navigate('/get-started')}>Get started Today</button>
          </div>
        </div>
      </section>

      {/* Fee Calculator */}
      <section className="hb-fees">
        <div className="container hb-fees-inner">
          <div className="hb-fees-left">
            <h2>Let's talk fees</h2>
            <p>Our cost depends on your property price, but the fees start from around £2,000.</p>
          </div>
          <div className="hb-fees-right">
            <div className="hb-calculator">
              <p className="hb-calc-label">Your property price</p>
              <div className="hb-calc-input-wrap">
                <span>£</span>
                <input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} className="hb-calc-input" />
              </div>
              <div className="hb-calc-result">
                <div className="hb-calc-row">
                  <span>Your price</span>
                  <strong className="hb-calc-price">£{yourPrice.toLocaleString()}</strong>
                </div>
                <p className="hb-calc-includes">This includes:</p>
                <div className="hb-calc-breakdown">
                  <div className="hb-calc-item"><span>All your conveyancing and legal work</span><span>worth £{conveyancing.toLocaleString()}</span></div>
                  <div className="hb-calc-item"><span>Property survey</span><span>worth £{survey.toLocaleString()}</span></div>
                </div>
              </div>
              <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => navigate('/contact')}>Lock in your quote</button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
