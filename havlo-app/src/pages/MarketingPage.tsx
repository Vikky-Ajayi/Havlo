import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import './PageCommon.css'
import './MarketingPage.css'

const plans = [
  {
    name: 'Global', price: '£2,000', period: '/setup + £500/month', popular: false,
    features: ['Targeted advertising in three key markets most likely to contain buyers for your property and timeline', 'Static + canvas ads', 'Lead capture form', '4 bi-weekly performance report', '3-month minimum'],
  },
  {
    name: 'Global+', price: '£3,500', period: '/setup + £1,000/month', popular: true,
    features: ['Everything in Global, plus:', '8 regions of your choice', 'Static + canvas + video', 'Dedicated property landing page', 'Weekly performance report', '3-month minimum'],
  },
  {
    name: 'Worldwide', price: '£5,000', period: '/setup + £1,500/month', popular: false,
    features: ['Maximum global exposure for properties that need the widest possible international audience', '30+ countries worldwide', 'Full creative suite – static, carousel + video', 'Dedicated property landing page', 'Weekly report + monthly strategy', 'Rolling monthly after 3 months'],
  },
  {
    name: 'Private Client', price: '£10,000', period: '/setup + £2,500+/month', popular: false, bespoke: true,
    features: ['For high-value properties that command a campaign built entirely around them', 'Bespoke worldwide targeting strategy', 'Premium creative production', 'Dedicated account manager', 'Pricing discussed privately'],
  },
]

const faqs = [
  { q: 'Do I still need my estate agent?', a: "Yes — and you keep them. Havlo works alongside your existing agent, not instead of them. We open up international buyer markets your agent doesn't have access to through portals alone. Viewings, negotiations, and the sale itself are all handled through your agent and solicitor as normal." },
  { q: 'What does month 1 look like financially?', a: 'Month 1 includes the one-time setup fee alongside your first monthly management fee — it is the most investment-heavy month. From month 2 onwards you only pay the monthly management fee, plus your ad spend directly to Meta.' },
  { q: 'Which plan is right for my property?', a: "Choose based on the reach you want, not the value of your property. Not sure? We'll recommend the right plan on your free strategy call — there is no obligation to proceed and no minimum commitment." },
  { q: 'Why is ad spend separate from your fees?', a: 'Your advertising budget goes directly from your account to Meta; Havlo never touches that money. This means full transparency — you can see every pound spent in real time — and we take no margin on your ad spend whatsoever.' },
  { q: 'Can I continue beyond the minimum term?', a: 'Yes. All plans roll monthly after the minimum term. You can pause or stop with 30 days notice once the minimum period is complete.' },
  { q: 'Do you charge a commission when the property sells?', a: 'No. This is a marketing service only. We are a marketing service, not an estate agent. There is no commission, no referral fee, and no percentage of the sale price — ever.' },
]

export default function MarketingPage() {
  const navigate = useNavigate()
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div className="page">
      <Navbar />

      {/* Hero */}
      <section className="mkt-hero">
        <div className="mkt-hero-bg" />
        <div className="container mkt-hero-content">
          <p className="section-label" style={{ color: 'rgba(255,255,255,0.6)' }}>INTERNATIONAL PROPERTY MARKETING</p>
          <h1>Your property.<br />The world's buyers.</h1>
          <p>Havlo puts slow-to-sell UK properties in front of qualified international and offshore buyers across 30+ countries using precision Meta advertising your local agent cannot replicate.</p>
          <div className="mkt-stats">
            <div className="mkt-stat"><strong>30+</strong><span>Countries reached</span></div>
            <div className="mkt-stat"><strong>£500K min.</strong><span>Property value</span></div>
            <div className="mkt-stat"><strong>0%</strong><span>Commission on sale</span></div>
          </div>
          <button className="btn-white" onClick={() => navigate('/contact')}>GET STARTED</button>
        </div>
      </section>

      {/* The Problem */}
      <section className="mkt-problem">
        <div className="container">
          <p className="section-label">THE PROBLEM</p>
          <h2>Your agent is only speaking to local buyers</h2>
          <p className="mkt-problem-sub">Rightmove and Zoopla reach a fraction of the buyers who could purchase your property. The international market — expats, diaspora investors, overseas buyers — is largely invisible to traditional estate agents.</p>
          <div className="mkt-problems">
            <div className="mkt-problem-item">
              <span className="mkt-problem-num">01</span>
              <div>
                <h4>Portals don't reach international buyers</h4>
                <p>Most offshore buyers are not browsing UK property portals. They're reached through targeted social advertising in their home markets.</p>
              </div>
              <div className="mkt-problem-stat">
                <strong>£3,000+</strong>
                <span>Average monthly carrying cost while a property sits unsold</span>
              </div>
            </div>
            <div className="mkt-problem-item">
              <span className="mkt-problem-num">02</span>
              <div>
                <h4>Every month on market costs you money</h4>
                <p>The longer a property sits, the more it costs — and the more leverage buyers gain. Additions and price reductions add up fast.</p>
              </div>
              <div className="mkt-problem-stat">
                <strong>30+</strong>
                <span>Countries Havlo campaigns actively reach</span>
              </div>
            </div>
            <div className="mkt-problem-item">
              <span className="mkt-problem-num">03</span>
              <div>
                <h4>The right buyer may not be in the UK</h4>
                <p>UK property is a global asset. Buyers in the Gulf, West Africa, Southeast Asia, and beyond are actively seeking UK property — they just cannot find yours.</p>
              </div>
              <div className="mkt-problem-stat">
                <strong>0%</strong>
                <span>Commission charged on sale — ever</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="mkt-how">
        <div className="container">
          <p className="section-label" style={{ textAlign: 'center' }}>HOW IT WORKS</p>
          <h2>From briefing to international enquiries in weeks</h2>
          <div className="mkt-how-steps">
            {['Strategy call', 'Campaign setup', 'Strategy call', 'Strategy call'].map((s, i) => (
              <div key={i} className="mkt-how-card">
                <span className="mkt-how-num">0{i+1}</span>
                <h4>{s}</h4>
                <p>We learn about your property, your timeline, and your buyer profile — making sure we have the right plan and the right regions for your specific situation.</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="mkt-pricing">
        <div className="container">
          <p className="section-label">PRICING</p>
          <h2>Choose your reach</h2>
          <p className="mkt-pricing-sub">Select a plan based on the international reach you need. All plans include full campaign management, creative production, and lead capture. We work with properties from £500,000.</p>
          <p className="mkt-pricing-note">Ad spend is paid directly by you to Meta. The management fees below do not include your Meta advertising budget. This is paid directly by you to Facebook and Instagram — it never passes through Havlo.</p>
          <div className="mkt-plans">
            {plans.map(plan => (
              <div key={plan.name} className={`mkt-plan-card ${plan.popular ? 'popular' : ''} ${plan.bespoke ? 'bespoke' : ''}`}>
                {plan.popular && <div className="mkt-plan-badge">MOST POPULAR – 1 REVIEW</div>}
                <h3>{plan.name}</h3>
                <div className="mkt-plan-price">{plan.price}<span>{plan.period}</span></div>
                <ul>
                  {plan.features.map((f, i) => <li key={i}><span className="mkt-plan-check">✓</span>{f}</li>)}
                </ul>
                <button className={plan.popular ? 'btn-white' : 'btn-primary'} onClick={() => navigate('/contact')}>
                  GET STARTED
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="mkt-faqs">
        <div className="container">
          <p className="section-label" style={{ textAlign: 'center' }}>COMMON QUESTIONS</p>
          <h2>Everything you need to know</h2>
          <div className="mkt-faq-list">
            {faqs.map((faq, i) => (
              <div key={i} className="mkt-faq-item" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                <div className="mkt-faq-q">
                  <span>{faq.q}</span>
                  <span className="mkt-faq-toggle">{openFaq === i ? '−' : '+'}</span>
                </div>
                {openFaq === i && <p className="mkt-faq-a">{faq.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mkt-cta">
        <div className="container mkt-cta-inner">
          <h2>Your buyer may not be in the UK.</h2>
          <p>Book a free 30-minute strategy call. We'll tell you which markets are most likely to contain buyers for your property — and whether Havlo is the right fit. No obligation, no pressure.</p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn-primary" style={{ background: 'var(--color-purple)' }} onClick={() => navigate('/get-started')}>GET STARTED TODAY</button>
            <button className="btn-outline" onClick={() => navigate('/contact')}>BOOK A STRATEGY CALL</button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
