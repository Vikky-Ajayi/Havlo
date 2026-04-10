import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import './PageCommon.css'

export default function CookiePolicy() {
  return (
    <div className="page">
      <Navbar />
      <section style={{ padding: '80px 0 40px', background: 'var(--color-gray-50)', textAlign: 'center' }}>
        <div className="container">
          <h1 style={{ fontSize: 'clamp(32px,5vw,56px)', fontWeight: 800 }}>Cookie Policy</h1>
          <p style={{ color: 'var(--color-gray-500)', marginTop: 12 }}>Last updated: April 2026</p>
        </div>
      </section>
      <section style={{ padding: '60px 0 80px' }}>
        <div className="container" style={{ maxWidth: 780 }}>
          {[
            { title: 'What Are Cookies?', content: 'Cookies are small text files that are stored on your computer or mobile device when you visit a website. They are widely used to make websites work more efficiently and to provide information to website owners.' },
            { title: 'How We Use Cookies', content: 'We use cookies to understand how you interact with our platform, to improve your experience, to remember your preferences, and to deliver targeted advertising. We use both session cookies and persistent cookies.' },
            { title: 'Types of Cookies We Use', content: 'Essential Cookies: Required for the platform to function properly. Performance Cookies: Help us understand how visitors interact with our platform. Functionality Cookies: Remember your preferences and settings. Marketing Cookies: Used to deliver relevant advertisements.' },
            { title: 'Managing Cookies', content: 'You can control and manage cookies in various ways. Most browsers allow you to refuse cookies or to alert you when cookies are being sent. Note that if you disable cookies, some features of our platform may not function properly.' },
            { title: 'Third-Party Cookies', content: 'We may use third-party service providers, such as Google Analytics and Meta, who may also set cookies on your device when you visit our platform. These cookies are subject to the respective third-party privacy policies.' },
            { title: 'Contact Us', content: 'If you have any questions about our use of cookies, please contact us at privacy@havlo.co.' },
          ].map(s => (
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
