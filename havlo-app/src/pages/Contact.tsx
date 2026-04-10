import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import './PageCommon.css'
import './Contact.css'

export default function Contact() {
  return (
    <div className="page">
      <Navbar />
      <section className="contact-hero">
        <div className="container">
          <h1>Ready to Chat? Call Us Now</h1>
          <p>For any complaints or suggestions, please contact us via:</p>
          <div className="contact-phone-bar">
            <div className="contact-phone-col">
              <span>AFRICA</span>
              <strong>+44 7585 637752</strong>
            </div>
            <div className="contact-phone-divider" />
            <div className="contact-phone-col">
              <span>EUROPE &amp; AMERICA</span>
              <strong>+44 7585 637752</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="contact-methods">
        <div className="container contact-methods-grid">
          <div className="contact-method">
            <div className="contact-method-icon">✉️</div>
            <h4>EMAIL</h4>
            <a href="mailto:info@havlo.co">info@havlo.co</a>
          </div>
          <div className="contact-method">
            <div className="contact-method-icon" style={{ color: 'var(--color-purple)' }}>📅</div>
            <h4>BOOK A CALL</h4>
            <a href="https://link.calendly.com" target="_blank" rel="noreferrer">link.caledly.com</a>
          </div>
          <div className="contact-method">
            <div className="contact-method-icon" style={{ color: 'var(--color-green)' }}>💬</div>
            <h4>WHATSAPP</h4>
            <a href="#">Start a whatsapp chat</a>
          </div>
        </div>
      </section>

      <section className="contact-form-section">
        <div className="container">
          <div className="contact-form-card">
            <div className="contact-form-grid">
              <div className="form-group">
                <label className="form-label">First Name*</label>
                <input className="form-input" type="text" placeholder="Enter first name" />
              </div>
              <div className="form-group">
                <label className="form-label">Last Name*</label>
                <input className="form-input" type="text" placeholder="Enter last name" />
              </div>
              <div className="form-group">
                <label className="form-label">Email*</label>
                <input className="form-input" type="email" placeholder="Enter your email address" />
              </div>
              <div className="form-group">
                <label className="form-label">Phone*</label>
                <div className="contact-phone-input">
                  <select className="contact-country-code">
                    <option>+44</option>
                    <option>+1</option>
                    <option>+234</option>
                  </select>
                  <input className="form-input" type="tel" placeholder="Enter your phone number" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Finance type</label>
                <select className="form-select">
                  <option value="">Select</option>
                  <option>Cash</option>
                  <option>Mortgage</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Currency*</label>
                <div className="contact-currency-wrap">
                  <select className="contact-currency-select">
                    <option>GBP</option>
                    <option>USD</option>
                    <option>EUR</option>
                    <option>NGN</option>
                  </select>
                  <input className="form-input" type="number" placeholder="Amount" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Country of residence</label>
                <select className="form-select">
                  <option value="">Select</option>
                  <option>United Kingdom</option>
                  <option>Nigeria</option>
                  <option>United States</option>
                  <option>UAE</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Are you an expat?</label>
                <select className="form-select">
                  <option value="">Select</option>
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </div>
            </div>
            <div className="form-group" style={{ marginTop: 4 }}>
              <label className="form-label">Please also provide a brief overview of your requirements:</label>
              <textarea className="form-textarea" placeholder="How can we be of help" />
            </div>
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <button className="btn-primary" style={{ padding: '16px 64px' }}>Submit</button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
