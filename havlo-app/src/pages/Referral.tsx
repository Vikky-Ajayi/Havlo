import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import './PageCommon.css'

export default function Referral() {
  const navigate = useNavigate()
  return (
    <div className="page">
      <Navbar />
      <section style={{ padding: '100px 0', background: 'linear-gradient(135deg, #0f172a, #312e81)', color: 'white', textAlign: 'center' }}>
        <div className="container">
          <h1 style={{ fontSize: 'clamp(32px,5vw,60px)', fontWeight: 800, marginBottom: 20 }}>Refer & Earn</h1>
          <p style={{ color: 'rgba(255,255,255,0.75)', maxWidth: 520, margin: '0 auto 36px', fontSize: 17, lineHeight: 1.7 }}>Know someone looking to buy, sell or manage property abroad? Refer them to Havlo and earn a reward when they complete a transaction.</p>
          <button className="btn-white" onClick={() => navigate('/contact')}>Start Referring</button>
        </div>
      </section>
      <section style={{ padding: '80px 0' }}>
        <div className="container">
          <h2 style={{ textAlign: 'center', fontWeight: 800, fontSize: 'clamp(28px,4vw,44px)', marginBottom: 48 }}>How it Works</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24, maxWidth: 860, margin: '0 auto' }}>
            {[
              { num: '01', title: 'Make a Referral', desc: 'Share your unique referral link or introduce your contact to Havlo directly.' },
              { num: '02', title: 'They Sign Up', desc: 'Your referral creates an account and engages with Havlo\'s services.' },
              { num: '03', title: 'You Earn', desc: 'Once they complete a transaction, you receive your referral reward.' },
            ].map(s => (
              <div key={s.num} style={{ textAlign: 'center', padding: '32px 24px', background: 'var(--color-gray-50)', borderRadius: 16 }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 48, fontWeight: 800, color: 'var(--color-purple)' }}>{s.num}</span>
                <h3 style={{ fontWeight: 700, marginBottom: 10, marginTop: 12 }}>{s.title}</h3>
                <p style={{ fontSize: 14, color: 'var(--color-gray-600)', lineHeight: 1.6 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  )
}
