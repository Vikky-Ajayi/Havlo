import { Link } from 'react-router-dom'
import './Footer.css'

export default function Footer() {
  return (
    <footer className="footer">
      {/* Office addresses */}
      <div className="footer-addresses">
        <div className="container footer-addresses-inner">
          <div className="footer-address">
            <span className="footer-flag">🇬🇧</span>
            <span className="footer-country">United Kingdom</span>
            <p>64 North Row<br />Mayfair<br />London W1K 7DA</p>
          </div>
          <div className="footer-address">
            <span className="footer-flag">🇺🇸</span>
            <span className="footer-country">United states</span>
            <p>64 North Row<br />Mayfair<br />London W1K 7DA</p>
          </div>
          <div className="footer-address">
            <span className="footer-flag">🇳🇬</span>
            <span className="footer-country">Nigeria</span>
            <p>64 North Row<br />Mayfair<br />London W1K 7DA</p>
          </div>
          <div className="footer-address">
            <span className="footer-flag">🇦🇪</span>
            <span className="footer-country">UAE</span>
            <p>64 North Row<br />Mayfair<br />London W1K 7DA</p>
          </div>
          <div className="footer-address">
            <span className="footer-flag">🇮🇹</span>
            <span className="footer-country">Italy</span>
            <p>64 North Row<br />Mayfair<br />London W1K 7DA</p>
          </div>
        </div>
      </div>

      {/* Newsletter + social */}
      <div className="footer-newsletter-row">
        <div className="container footer-newsletter-inner">
          <div className="footer-newsletter">
            <input type="email" placeholder="Enter your email" className="footer-email-input" />
            <button className="footer-newsletter-btn">Join Newsletter</button>
          </div>
          <div className="footer-socials">
            <a href="#" className="footer-social" aria-label="Facebook">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>
            </a>
            <a href="#" className="footer-social" aria-label="Instagram">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
            </a>
            <a href="#" className="footer-social" aria-label="X/Twitter">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
          </div>
        </div>
      </div>

      {/* Main footer links */}
      <div className="footer-main">
        <div className="container footer-main-inner">
          <div className="footer-brand">
            <div className="footer-logo">HAVLO</div>
            <div className="footer-trustpilot">
              <div className="footer-tp-row">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#00b67a"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                <span className="footer-tp-label">Trustpilot</span>
              </div>
              <div className="footer-tp-stars">
                {[1,2,3,4,5].map(i => (
                  <span key={i} className="footer-tp-star">★</span>
                ))}
              </div>
            </div>
          </div>

          <div className="footer-col">
            <h4>Services</h4>
            <Link to="/property-purchase">Property purchase</Link>
            <Link to="/property-purchase">Property management</Link>
            <Link to="/sell-faster">Sell your property</Link>
            <Link to="/home-buying">Complete home-buying service</Link>
          </div>

          <div className="footer-col">
            <h4>Who we are</h4>
            <Link to="/about">About</Link>
            <Link to="/faq">FAQ</Link>
            <Link to="/contact">Contact Us</Link>
            <Link to="/referral">Press</Link>
          </div>

          <div className="footer-col">
            <h4>Legal</h4>
            <Link to="/terms">Terms of Service</Link>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/cookie-policy">Cookie Policy</Link>
          </div>
        </div>

        <div className="container footer-disclaimer">
          <p>
            Havlo is a platform that provides general information and facilitation services related to buying, managing, and selling property abroad. Havlo does not act as a real estate agent, broker, lawyer, financial advisor, or tax advisor, unless explicitly stated otherwise. Information provided on this website is for general guidance only and should not be considered legal, financial, tax, or investment advice.
          </p>
          <p>
            Property laws, regulations, taxes, and ownership rights vary by country and are subject to change. Users are responsible for conducting their own due diligence and are encouraged to seek independent professional advice before making any property-related decisions.
          </p>
          <p>
            Havlo is not responsible for decisions made based on information provided through the platform, nor for the actions or services of third-party providers, partners, or local professionals. Use of this website and Havlo's services is subject to applicable terms and conditions.
          </p>
        </div>

        <div className="footer-bottom">
          <p>@HAVLO- All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
