import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { LogoSVG } from '../components/Navbar'
import './WizardLayout.css'

type Step = 1 | 2 | 3 | 4 | 5 | 6


export default function WizardLayout() {
  const [step, setStep] = useState<Step>(1)
  const [helpType, setHelpType] = useState<string[]>([])
  const [countries, setCountries] = useState<string[]>(['Nigeria', 'Ghana', 'United Kingdom'])
  const [propertyType, setPropertyType] = useState<string>('')
  const [timeline, setTimeline] = useState<string>('')
  const [budget, setBudget] = useState('')
  const [currency, setCurrency] = useState('GBP')
  const navigate = useNavigate()

  const progress = ((step - 1) / 5) * 100

  const helpOptions = [
    'Initial Consultation and Needs Assessment', 'Property Cover',
    'Financial and Tax Advisory', 'Legal and Regulatory Guidance',
    'International Property Search', 'Property Insurance',
    'Post-Purchase/Property management Services', 'Due Diligence and Documentation',
  ]

  const toggleHelp = (opt: string) => {
    setHelpType(prev => prev.includes(opt) ? prev.filter(h => h !== opt) : [...prev, opt])
  }

  const next = () => { if (step < 5) setStep((step + 1) as Step); else setStep(6 as Step) }
  const back = () => { if (step > 1) setStep((step - 1) as Step) }

  if (step === 6) {
    return (
      <div className="wizard-thanks">
        <div className="wizard-thanks-inner">
          <div className="wizard-thanks-icon">🎉</div>
          <h1>Thanks for your interest!</h1>
          <p>Our team will be in touch within 24 hours to discuss your property journey.</p>
          <button className="btn-primary" onClick={() => navigate('/')}>Back to Home</button>
        </div>
      </div>
    )
  }

  return (
    <div className="wizard">
      {/* Nav */}
      <nav className="wizard-nav">
        <Link to="/"><LogoSVG /></Link>
        <div className="wizard-nav-right">
          <span className="wizard-step-label">Step {step} of 5</span>
        </div>
      </nav>

      <div className="wizard-body">
        {/* Left panel */}
        <div className="wizard-left">
          <button className="wizard-back" onClick={back} disabled={step === 1}>
            ‹ Go back
          </button>
          <div className="wizard-progress-bar">
            <div className="wizard-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <p className="wizard-step-count">{step} of 5</p>

          {step === 1 && (
            <div className="wizard-content">
              <h2>How can we help?</h2>
              <p>Get started by letting us know a little bit about what you need</p>
              <div className="wizard-options-grid">
                {helpOptions.map(opt => (
                  <button
                    key={opt}
                    className={`wizard-option ${helpType.includes(opt) ? 'selected' : ''}`}
                    onClick={() => toggleHelp(opt)}
                  >
                    <span className={`wizard-option-radio ${helpType.includes(opt) ? 'checked' : ''}`}>
                      {helpType.includes(opt) && '✓'}
                    </span>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="wizard-content">
              <h2>Where are you looking?</h2>
              <p>Select the country or countries where you're looking to buy property</p>
              <div className="wizard-tags-input">
                {countries.map(c => (
                  <span key={c} className="wizard-tag">{c} <button onClick={() => setCountries(prev => prev.filter(x => x !== c))}>×</button></span>
                ))}
                <select className="wizard-country-select" onChange={(e) => { if (e.target.value && !countries.includes(e.target.value)) setCountries(p => [...p, e.target.value]); e.target.value = '' }}>
                  <option value="">+ Add country</option>
                  {['United Kingdom', 'Nigeria', 'Ghana', 'UAE', 'United States', 'South Africa', 'Spain', 'Portugal', 'Italy', 'France'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="wizard-content">
              <h2>What type of property?</h2>
              <p>Help us understand your investment goals and preferences</p>
              <div className="wizard-property-options">
                {[
                  { value: 'Residential', label: 'Residential', sub: 'Primary or secondary home for living' },
                  { value: 'Vacation Home', label: 'Vacation Home', sub: 'Holiday retreat and getaway property' },
                  { value: 'Investment', label: 'Investment', sub: 'Rental income and capital appreciation' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    className={`wizard-property-opt ${propertyType === opt.value ? 'selected' : ''}`}
                    onClick={() => setPropertyType(opt.value)}
                  >
                    <div>
                      <strong>{opt.label}</strong>
                      <p>{opt.sub}</p>
                    </div>
                    <span className={`wizard-radio ${propertyType === opt.value ? 'checked' : ''}`} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="wizard-content">
              <h2>When are you looking to buy?</h2>
              <p>This helps us show you the most relevant properties and advisors</p>
              <div className="wizard-timeline-options">
                {[
                  { value: 'within3', label: 'Within 3 months' },
                  { value: '3to6', label: '3-6 months' },
                  { value: 'just-looking', label: 'Just exploring' },
                ].map(opt => (
                  <button key={opt.value} className={`wizard-timeline-opt ${timeline === opt.value ? 'selected' : ''}`} onClick={() => setTimeline(opt.value)}>
                    <span className={`wizard-radio ${timeline === opt.value ? 'checked' : ''}`} />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="wizard-content">
              <h2>What's your budget?</h2>
              <p>You can enter your budget in your local currency, or use USD or GBP — whichever you prefer.</p>
              <div className="wizard-budget-wrap">
                <select className="wizard-currency-select" value={currency} onChange={e => setCurrency(e.target.value)}>
                  <option>GBP</option>
                  <option>USD</option>
                  <option>EUR</option>
                  <option>NGN</option>
                </select>
                <input className="wizard-budget-input" type="number" placeholder="Enter amount e.g 1000" value={budget} onChange={e => setBudget(e.target.value)} />
              </div>
            </div>
          )}

          <button className="btn-primary wizard-continue" onClick={next}>Continue</button>
        </div>

        {/* Right panel */}
        <div className="wizard-right">
          <div className="wizard-trust-card">
            <div className="wizard-trust-logo">HAVLO</div>
            <p>Leave everything to us - we'll find you the best mortgage deal, and do all the work on your behalf <strong>all for free!</strong></p>
            <hr />
            <div className="wizard-trust-tp">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#00b67a"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              <span><strong>Trustpilot</strong></span>
              <div className="wizard-tp-stars">{[1,2,3,4,5].map(i => <span key={i} className="wizard-tp-star">★</span>)}</div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--color-gray-600)' }}><strong>Rated Excellent</strong> based on over 10,000 customer reviews</p>
          </div>
        </div>
      </div>

      {/* Ticker at bottom */}
      <div className="wizard-ticker">
        {['Assessment', 'International Property Search', 'Legal and Regulatory Guidance', 'Due Diligence', 'Assessment', 'International Property Search', 'Legal and Regulatory Guidance', 'Due Diligence'].map((item, i) => (
          <span key={i} className="wizard-ticker-item"><span className="wizard-ticker-dot" />{item}</span>
        ))}
      </div>
    </div>
  )
}
