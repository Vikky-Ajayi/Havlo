import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import './PageCommon.css'

const sections = [
  { title: '1. Introduction', content: 'These Terms of Use govern your access to and use of the Havlo platform and services. By accessing or using Havlo, you agree to be bound by these terms. If you do not agree to these terms, please do not use our services.' },
  { title: '2. Description of Services', content: 'Havlo provides a platform for general information and facilitation services related to buying, managing, and selling property abroad. Havlo does not act as a real estate agent, broker, lawyer, financial advisor, or tax advisor, unless explicitly stated otherwise.' },
  { title: '3. Eligibility', content: 'You must be at least 18 years of age to use our services. By using Havlo, you represent and warrant that you meet this requirement and that you have the legal capacity to enter into a binding agreement.' },
  { title: '4. User Accounts', content: 'To access certain features of the platform, you may be required to create an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.' },
  { title: '5. Intellectual Property', content: 'All content on the Havlo platform, including text, graphics, logos, and software, is the property of Havlo or its content suppliers and is protected by applicable intellectual property laws.' },
  { title: '6. Disclaimer of Warranties', content: 'The Havlo platform is provided on an "as is" and "as available" basis without any warranties of any kind, either express or implied. Havlo does not warrant that the platform will be uninterrupted, error-free, or free from viruses or other harmful components.' },
  { title: '7. Limitation of Liability', content: 'To the maximum extent permitted by applicable law, Havlo shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or in connection with your use of the platform.' },
  { title: '8. Governing Law', content: 'These Terms of Use shall be governed by and construed in accordance with the laws of England and Wales, without regard to its conflict of law provisions.' },
]

export default function Terms() {
  return (
    <div className="page">
      <Navbar />
      <section style={{ padding: '80px 0 40px', background: 'var(--color-gray-50)', textAlign: 'center' }}>
        <div className="container">
          <h1 style={{ fontSize: 'clamp(32px,5vw,56px)', fontWeight: 800 }}>Terms of Use</h1>
          <p style={{ color: 'var(--color-gray-500)', marginTop: 12 }}>Last updated: April 2026</p>
        </div>
      </section>
      <section style={{ padding: '60px 0 80px' }}>
        <div className="container" style={{ maxWidth: 780 }}>
          {sections.map(s => (
            <div key={s.title} style={{ marginBottom: 36 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>{s.title}</h2>
              <p style={{ color: 'var(--color-gray-600)', lineHeight: 1.8, fontSize: 15 }}>{s.content}</p>
            </div>
          ))}
        </div>
      </section>
      <Footer />
    </div>
  )
}
