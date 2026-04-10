import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import './PageCommon.css'
import './SellFaster.css'

const problems = [
  { icon: '💰', title: 'Mispricing', desc: 'Overpriced or misaligned with what buyers are willing to pay today' },
  { icon: '📸', title: 'Poor listing quality', desc: 'Weak photos, thin descriptions, or no virtual tour discouraging clicks' },
  { icon: '🌐', title: 'Limited exposure', desc: 'Not reaching enough qualified buyers across portals and social media' },
  { icon: '🏠', title: 'Presentation gaps', desc: 'Minor staging or improvement issues reducing in-person appeal' },
  { icon: '📊', title: 'No clear strategy', desc: 'Relisting without a data-backed plan rarely produces different results' },
]

const whatYouGet = [
  { num: '01', title: 'Market & pricing analysis', items: ['Compare your home to recently sold and active listings', 'Identify price adjustments to attract buyers faster', 'Understand local market trends and buyer expectations'] },
  { num: '02', title: 'Listing quality audit', items: ['Professional evaluation of photos, descriptions, and virtual tours', 'Suggestions to improve online appeal and click-through', 'Suggestions your current agent can implement immediately'] },
  { num: '03', title: 'Marketing & exposure review', items: ['Audit of how your property is advertised across all channels', 'Strategies to maximise visibility to serious, qualified buyers'] },
  { num: '04', title: 'Actionable relaunch roadmap', items: ['Step-by-step plan covering pricing, listing, marketing, staging, and improvements', 'Designed for easy implementation by your current agent'] },
  { num: '05', title: 'Professional report & consultation', items: ['Detailed PDF report with charts, scoring, and actionable steps', 'A 30-60 minute call to walk you through every recommendation'] },
]

const whyReasons = [
  'Independent, unbiased, and professional guidance you can trust',
  'Saves time, stress, and money from a prolonged listing',
  'Premium, actionable insights tailored specifically to your property',
  'Conducted by agents who actively sell in your area with local knowledge',
  'Works alongside your current agent — no switching required',
]

export default function SellFaster() {
  const navigate = useNavigate()
  return (
    <div className="page">
      <Navbar />

      {/* Hero - dark with purple overlay */}
      <section className="sf-hero">
        <div className="sf-hero-bg" />
        <div className="container sf-hero-content">
          <h1>Sell Your Home Faster with Havlo<br />Relaunch Assessment</h1>
          <p>Your home has been on the market too long. Get a data-driven, independent roadmap to selling faster — without switching agents.</p>
          <button className="btn-white" onClick={() => navigate('/contact')}>
            Book your relaunch assessment 🚀
          </button>
          <div className="sf-stats">
            <div className="sf-stat"><span className="sf-stat-num">5+</span><span>Areas of your listing we audit</span></div>
            <div className="sf-stat"><span className="sf-stat-num">74k</span><span>Average time to first offers after relaunch</span></div>
            <div className="sf-stat"><span className="sf-stat-num">100%</span><span>Remote — no disruption to your daily life</span></div>
          </div>
        </div>
      </section>

      {/* The Problem */}
      <section className="sf-problem">
        <div className="container">
          <p className="section-label" style={{ textAlign: 'center' }}>THE PROBLEM</p>
          <h2>Why homes stall on the market</h2>
          <p className="sf-problem-sub">If your property has been listed for months without offers, one or more of these issues is likely holding you back.</p>
          <div className="sf-problems-grid">
            {problems.map(p => (
              <div key={p.title} className="sf-problem-card">
                <span className="sf-problem-icon">{p.icon}</span>
                <h4>{p.title}</h4>
                <p>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What You Get */}
      <section className="sf-whatyouget">
        <div className="container">
          <p className="section-label" style={{ textAlign: 'center' }}>WHAT YOU GET</p>
          <h2>What You Get With Relaunch Assessment</h2>
          <p className="sf-problem-sub">A thorough, independent evaluation covering every factor that affects how fast your home sells.</p>
          <div className="sf-wyg-grid">
            {whatYouGet.map(item => (
              <div key={item.num} className="sf-wyg-card">
                <span className="sf-wyg-num">{item.num}</span>
                <h4>{item.title}</h4>
                <ul>
                  {item.items.map((i, idx) => <li key={idx}>{i}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="sf-howitworks">
        <div className="container sf-how-inner">
          <div className="sf-how-left">
            <p className="section-label">HOW IT WORKS</p>
            <h2>Simple four-step process</h2>
            <p>Entirely remote — no disruption to your life or your current agent relationship.</p>
          </div>
          <div className="sf-how-steps">
            <div className="sf-how-step">You provide your property details and current listing links.</div>
            <div className="sf-how-step">We conduct a comprehensive market and listing assessment remotely.</div>
            <div className="sf-how-step">Receive a premium report with visual analysis, scoring, and recommendations.</div>
            <div className="sf-how-step">Schedule a call to go over the report if you want personalised guidance.</div>
          </div>
        </div>
      </section>

      {/* Why Relaunch */}
      <section className="sf-why">
        <div className="container">
          <p className="section-label" style={{ textAlign: 'center' }}>WHY US</p>
          <h2>Why Relaunch Assessment?</h2>
          <p className="sf-problem-sub">Independent expertise that works with your existing agent — not against them.</p>
          <div className="sf-why-grid">
            {whyReasons.map((r, i) => (
              <div key={i} className="sf-why-item">
                <span className="sf-why-check">✓</span>
                <p>{r}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="sf-testimonial">
        <div className="container sf-testimonial-inner">
          <span className="sf-quote">"</span>
          <blockquote>
            After following the Relaunch Assessment recommendations, our property attracted multiple offers in just 2 weeks. The process was clear, actionable, and saved us months of frustration.
          </blockquote>
          <p className="sf-testimonial-author">— HOMEOWNER</p>
        </div>
      </section>

      {/* Pricing CTA */}
      <section className="sf-pricing-cta">
        <div className="container sf-pricing-inner">
          <div>
            <h2>Get your Relaunch<br />Assessment today</h2>
            <p>A complete roadmap and consultation to finally get your property sold.</p>
          </div>
          <div className="sf-pricing-box">
            <p className="sf-price">£1,999.99 <span>one-time fee</span></p>
            <button className="btn-white" onClick={() => navigate('/contact')}>Book your relaunch assessment</button>
            <p className="sf-price-note">Unlimited PDF Report • 30-60 min consultation call</p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
