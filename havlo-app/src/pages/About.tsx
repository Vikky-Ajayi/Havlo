import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import './PageCommon.css'
import './About.css'

export default function About() {
  const navigate = useNavigate()
  return (
    <div className="page">
      <Navbar />

      {/* Hero - pink gradient */}
      <section className="about-hero">
        <div className="container about-hero-content">
          <p className="section-label" style={{ textAlign: 'center' }}>ABOUT US</p>
          <h1>Making property abroad simpler,<br />safer, transparent</h1>
          <p>Havlo was created to remove the barriers that make owning property in another country feel complex and overwhelming. We're here to make it exciting again.</p>
        </div>
      </section>

      {/* Why Havlo Exists */}
      <section className="about-why">
        <div className="container">
          <div className="about-why-card">
            <span className="about-quote-icon">❝</span>
            <h2>Why Havlo Exists</h2>
            <div className="about-why-cols">
              <p>We understand that owning property in another country can be exciting — but also complex. Different laws, unfamiliar markets, distance, and ongoing management challenges often stand in the way.<br /><br />Our mission is simple: make owning property abroad feel as natural and straightforward as owning property at home.</p>
              <p>Havlo exists to remove those barriers. We combine deep local expertise with the information you need to make informed decisions and stay in control — no matter where you are in the world.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Built Around Your Goals */}
      <section className="about-goals">
        <div className="container">
          <h2>Built Around Your Goals</h2>
          <p className="about-goals-sub">Whether you're buying a second home, investing for the long term, or managing an overseas property, we start by understanding your purpose. This allows us to offer guidance and solutions that truly fit your needs.</p>
          <div className="about-pillars">
            <div className="about-pillar">
              <span className="about-pillar-mark">I</span>
              <h3>Purpose-Driven</h3>
              <p>Every recommendation is tailored to your specific goals and circumstances. No generic advice, just guidance that fits your life.</p>
            </div>
            <div className="about-pillar">
              <span className="about-pillar-mark">II</span>
              <h3>Transparent Always</h3>
              <p>We believe in complete transparency. You'll always understand the process, costs, and implications of every decision.</p>
            </div>
            <div className="about-pillar">
              <span className="about-pillar-mark">III</span>
              <h3>Trust First</h3>
              <p>Building lasting relationships through honesty, reliability, and acting in your best interest — always.</p>
            </div>
          </div>
        </div>
      </section>

      {/* From Purchase to Ongoing Management */}
      <section className="about-lifecycle">
        <div className="about-lifecycle-left">
          <div className="container">
            <h2>From Purchase to<br />Ongoing Management</h2>
            <p>Havlo supports you through the full lifecycle of owning property abroad. We're with you every step of the way.</p>
          </div>
        </div>
        <div className="about-lifecycle-right">
          {[
            { title: 'Buying Property', desc: 'Find and purchase property anywhere in the world with expert guidance on pricing, positioning, and local requirements.' },
            { title: 'Ownership Options', desc: 'Explore flexible ownership models including full ownership, shared ownership, fractional ownership, and co-investment opportunities.' },
            { title: 'Property Management', desc: 'Comprehensive overseas management including tenant sourcing, maintenance, rent collection, and ongoing value preservation.' },
            { title: 'Selling Support', desc: "When you're ready to sell, we connect you with qualified buyers and guide you through a smooth, efficient selling process." },
          ].map(item => (
            <div key={item.title} className="lifecycle-item">
              <h4>{item.title}</h4>
              <p>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trusted Partner */}
      <section className="about-trusted">
        <div className="container">
          <h2>Your Trusted Partner Abroad</h2>
          <p className="about-goals-sub">Havlo acts as your reliable partner on the ground, helping you protect your investment, reduce risk, and manage your property with confidence — even from thousands of miles away.</p>
          <div className="about-partner-grid">
            <div className="about-partner-card">
              <div className="about-partner-icon">🌐</div>
              <h4>Global Reach</h4>
              <p>Local expertise in markets worldwide, backed by a unified platform that keeps everything simple.</p>
            </div>
            <div className="about-partner-card">
              <div className="about-partner-icon">🛡️</div>
              <h4>Risk Reduction</h4>
              <p>Navigate complex regulations, legal requirements, and market conditions with expert guidance.</p>
            </div>
            <div className="about-partner-card">
              <div className="about-partner-icon">💡</div>
              <h4>Informed Decisions</h4>
              <p>Access to market insights, data, and professional advice so you always make confident choices.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="about-cta">
        <div className="container about-cta-inner">
          <h2>With Havlo, owning property<br />abroad feels simple</h2>
          <p>Join thousands of property owners who trust Havlo to guide their international property journey. Start with a conversation about your goals.</p>
          <button className="btn-primary" onClick={() => navigate('/contact')}>Talk to our Team</button>
        </div>
      </section>

      <Footer />
    </div>
  )
}
