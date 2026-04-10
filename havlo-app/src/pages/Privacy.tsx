import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import './PageCommon.css'

const sections = [
  { title: '1. Information We Collect', content: 'We collect information you provide directly to us, such as when you create an account, fill out a form, or contact us. This may include your name, email address, phone number, location data, and financial information relevant to property transactions.' },
  { title: '2. How We Use Your Information', content: 'We use the information we collect to provide, maintain, and improve our services, process transactions, send you technical notices and support messages, respond to your comments and questions, and send you marketing communications.' },
  { title: '3. Information Sharing', content: 'We do not sell, trade, or otherwise transfer your personal information to third parties without your consent, except as described in this policy. We may share information with service providers who assist us in operating our platform and conducting our business.' },
  { title: '4. Data Security', content: 'We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the Internet is 100% secure.' },
  { title: '5. Data Retention', content: 'We retain your personal information for as long as necessary to fulfil the purposes outlined in this Privacy Policy, unless a longer retention period is required or permitted by law.' },
  { title: '6. Your Rights', content: 'Depending on your location, you may have certain rights regarding your personal information, including the right to access, correct, or delete your data. To exercise these rights, please contact us at privacy@havlo.co.' },
  { title: '7. Cookies', content: 'We use cookies and similar tracking technologies to track activity on our platform and hold certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.' },
  { title: '8. Contact Us', content: 'If you have any questions about this Privacy Policy, please contact us at privacy@havlo.co or write to us at 64 North Row, Mayfair, London W1K 7DA.' },
]

export default function Privacy() {
  return (
    <div className="page">
      <Navbar />
      <section style={{ padding: '80px 0 40px', background: 'var(--color-gray-50)', textAlign: 'center' }}>
        <div className="container">
          <h1 style={{ fontSize: 'clamp(32px,5vw,56px)', fontWeight: 800 }}>Privacy Policy</h1>
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
