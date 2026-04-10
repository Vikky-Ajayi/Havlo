import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import TrustpilotBar from '../components/TrustpilotBar'
import './PageCommon.css'
import './EliteProperty.css'

const pillars = [
  { icon: '👤', title: 'Direct Buyer Access', desc: 'We connect your property with a curated group of offshore buyers actively seeking property abroad.' },
  { icon: '🌍', title: 'Global Visibility That Matters', desc: 'Your property is positioned in front of serious international offices and leaders—not just scrolling listing platforms.' },
  { icon: '⚡', title: 'Faster Path to Transactions', desc: 'By targeting offshore international buyers, we significantly increase the likelihood of genuine transactions.' },
  { icon: '🎯', title: 'Strategic Positioning', desc: 'We present your property in a way that resonates with offshore buyers, not just local listing buyers.' },
]

const reasons = [
  { num: '01', title: "We Don't List. We Introduce.", desc: 'Unlike portals, we introduce your property in focused, high-impact settings in front of decision-ready buyers.' },
  { num: '02', title: 'Access to Capital-Rich Buyers', desc: 'We work with serious international investors with substantial purchasing power and a higher probability of genuine transactions.' },
  { num: '03', title: 'Borderless Demand Creation', desc: "We expand beyond your domestic market. Likely to convert, these buyers see opportunity where others can't and appetite may be stronger." },
  { num: '04', title: 'Advisory-Led Approach', desc: 'We educate offshore buyers and prepare your property for access to offshore buyers and a higher probability of successful transactions.' },
  { num: '05', title: 'Speed Through Targeting', desc: 'We work with highly targeted groups of serious buyers and significantly increase the probability of genuine transactions.' },
  { num: '06', title: 'Discreet & Professional', desc: 'We operate with the highest levels of integrity and professionalism, ideal for high-value or sensitive properties.' },
]

export default function EliteProperty() {
  const navigate = useNavigate()
  return (
    <div className="page">
      <Navbar />

      {/* Hero */}
      <section className="elite-hero">
        <div className="elite-hero-bg" />
        <div className="container elite-hero-content">
          <h1>Sell Your Property to the World,<br />Not Just Your Local Market</h1>
          <p>Havlo connects your property directly with vetted foreign buyers who are actively looking to acquire real estate abroad — so you achieve faster, better outcomes.</p>
          <div className="elite-hero-actions">
            <button className="btn-primary" onClick={() => navigate('/contact')}>Access Global Buyers</button>
            <button className="btn-outline" style={{ color: 'white', borderColor: 'white' }} onClick={() => navigate('/contact')}>Submit Your Property</button>
          </div>
        </div>
      </section>

      {/* Not a real estate agent */}
      <section className="elite-different">
        <div className="container">
          <div className="elite-diff-inner">
            <div className="elite-diff-left">
              <p className="section-label">WHAT MAKES HAVLO DIFFERENT</p>
              <h2>We are not a real estate agent</h2>
              <p>Our role is to complement your agent's efforts by connecting your current sale process with serious offshore buyers without disrupting your current sales process.</p>
              <p>Havlo is a global advisory platform that accelerates property sales by introducing properties to a curated list of offshore international buyers, instead of listing and alerting your property with decision-makers.</p>
              <ul className="elite-diff-list">
                <li>Family Offices</li>
                <li>International Investors</li>
                <li>High-Net-Worth Individuals</li>
                <li>Cross-border Buyers seeking overseas assets</li>
              </ul>
            </div>
            <div className="elite-diff-right">
              <div className="elite-globe">
                <img src="https://images.unsplash.com/photo-1614850523011-8f49fce4b851?w=400&q=80" alt="Global network" style={{ width: '100%', borderRadius: 'var(--radius-xl)' }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <TrustpilotBar />

      {/* Precision Access */}
      <section className="elite-pillars">
        <div className="container">
          <p className="section-label" style={{ textAlign: 'center' }}>WHAT WE DO</p>
          <h2>Precision Access to Global Capital</h2>
          <p className="elite-sub">Four pillars that set our approach apart from conventional property marketing.</p>
          <div className="elite-pillars-grid">
            {pillars.map(p => (
              <div key={p.title} className="elite-pillar-card">
                <span className="elite-pillar-icon">{p.icon}</span>
                <h4>{p.title}</h4>
                <p>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Sellers Choose */}
      <section className="elite-reasons">
        <div className="container">
          <p className="section-label" style={{ textAlign: 'center' }}>SIX REASONS WE DELIVER RESULTS</p>
          <h2>Why Sellers Choose Havlo</h2>
          <div className="elite-reasons-grid">
            {reasons.map(r => (
              <div key={r.num} className="elite-reason-card">
                <span className="elite-reason-num">{r.num}</span>
                <h4>{r.title}</h4>
                <p>{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="elite-how">
        <div className="container">
          <p className="section-label" style={{ textAlign: 'center' }}>HOW IT WORKS</p>
          <h2>Four steps to Global Buyers</h2>
          <p className="elite-sub">A highly efficient, results-driven process to showcase your property to a global network of international buyers with Havlomatch Impact.</p>
          <div className="elite-steps">
            {[
              { title: 'Submit Your Property', desc: 'Share key details about your property so our expert team can review suitability.' },
              { title: 'Engagement & Offers', desc: 'We build the campaign from scratch with curated creative, audience targeting, regulations, and tracking. Our targeting goes directly to buyers.' },
              { title: 'Buyer Matching', desc: 'We match with offshore buyers who have already expressed a clear desire to acquire property abroad with a higher probability of success.' },
              { title: 'Close with Your Preferred Parties', desc: 'We introduce you to shortlisted buyers where you maintain control over the transaction.' },
            ].map((step, i) => (
              <div key={i} className="elite-step">
                <span className="elite-step-num">0{i + 1}</span>
                <div>
                  <h4>{step.title}</h4>
                  <p>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <button className="btn-primary" onClick={() => navigate('/contact')}>SUBMIT YOUR PROPERTY</button>
          </div>
        </div>
      </section>

      {/* Tap Into Global Demand CTA */}
      <section className="elite-cta">
        <div className="container elite-cta-inner">
          <h2>Tap Into Global Demand</h2>
          <p>Stop waiting for buyers to find your property — put it directly in front of the world's most motivated buyers.</p>
          <button className="btn-primary" onClick={() => navigate('/contact')}>REACH GLOBAL BUYERS →</button>
        </div>
      </section>

      <Footer />
    </div>
  )
}
