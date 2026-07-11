import React, { useState } from 'react';
import { usePageMeta } from '../hooks/usePageMeta';
import { API_BASE } from '../lib/api';

type Step = 'form' | 'submitting' | 'success';

const PROPERTY_TYPES = ['House', 'Flat', 'Apartment', 'Commercial'];
const BEDROOM_OPTIONS = ['Studio', '1–3', '3–5', '6+'];

export function BuyAbroadUkApply() {
  usePageMeta({
    title: 'UK Property Purchase Application | Havlo',
    description: 'Complete your UK property purchase application with Havlo. Our advisory team will guide you through every step of buying property in the UK.',
    canonical: 'https://www.heyhavlo.com/buyabroad/uk/apply',
  });

  const [step, setStep] = useState<Step>('form');
  const [error, setError] = useState('');

  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [occupation, setOccupation] = useState('');
  const [ukArea, setUkArea] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [budget, setBudget] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setStep('submitting');
    try {
      const resp = await fetch(`${API_BASE}/public/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          date_of_birth: dob,
          email,
          mobile,
          address,
          occupation,
          uk_area: ukArea,
          property_type: propertyType,
          bedrooms,
          budget,
        }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setStep('success');
    } catch {
      setError('Something went wrong. Please try again or contact us directly.');
      setStep('form');
    }
  };

  return (
    <div className="bua-page">
      <style>{`
        .bua-page { font-family: Inter, sans-serif; background: #fafafa; min-height: 100vh; }

        /* ── Header ── */
        .bua-header {
          position: sticky; top: 0; z-index: 100;
          height: 80px; background: #fff;
          border-bottom: 1px solid #eee;
          display: flex; align-items: center;
          padding: 0 max(60px, calc((100vw - 1240px) / 2));
        }
        .bua-logo {
          display: inline-flex; flex-direction: column; align-items: center;
          text-decoration: none; color: #111; line-height: 1; flex-shrink: 0;
        }
        .bua-logo img { width: 136px; height: auto; display: block; }
        .bua-logo span { margin-top: 2px; font-size: 14px; font-weight: 400; color: #555; }
        .bua-header-spacer { flex: 1; }
        .bua-header-back {
          font-size: 13px; font-weight: 700; color: #111;
          text-decoration: none;
          border: 1.5px solid #e0e0e0;
          border-radius: 10px; padding: 9px 18px;
          transition: border-color .15s; white-space: nowrap;
        }
        .bua-header-back:hover { border-color: #b100df; color: #b100df; }

        /* ── Body ── */
        .bua-body {
          max-width: 760px; margin: 0 auto;
          padding: 48px clamp(20px, 5vw, 48px) 80px;
        }

        /* ── Intro card ── */
        .bua-intro {
          background: #fff; border: 1.5px solid #e8e9ec;
          border-radius: 16px; padding: 32px 36px; margin-bottom: 24px;
        }
        .bua-intro-badge {
          display: inline-block; background: #f3e8ff; color: #b100df;
          font-size: 11px; font-weight: 800; letter-spacing: 0.1em;
          text-transform: uppercase; border-radius: 999px;
          padding: 4px 12px; margin-bottom: 18px;
        }
        .bua-intro h1 {
          font-size: clamp(22px, 3vw, 30px); font-weight: 800;
          letter-spacing: -0.03em; color: #111; margin: 0 0 14px;
        }
        .bua-intro-lead {
          font-size: 15px; line-height: 1.65; color: #444; margin: 0 0 20px;
        }
        .bua-intro-list {
          list-style: none; padding: 0; margin: 0;
        }
        .bua-intro-list li {
          font-size: 14px; color: #444; line-height: 1.6;
          padding: 4px 0 4px 22px; position: relative;
        }
        .bua-intro-list li::before {
          content: '✓'; position: absolute; left: 0;
          color: #b100df; font-weight: 700;
        }

        /* ── Fee card ── */
        .bua-fee {
          background: #0a0a0a; color: #fff;
          border-radius: 16px; padding: 32px 36px; margin-bottom: 32px;
        }
        .bua-fee h2 {
          font-size: 18px; font-weight: 800; margin: 0 0 6px; color: #fff;
        }
        .bua-fee-total {
          font-size: 14px; color: #aaa; margin: 0 0 24px;
        }
        .bua-fee-total strong { color: #b100df; }
        .bua-fee-stages {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;
        }
        @media (max-width: 600px) {
          .bua-fee-stages { grid-template-columns: 1fr; }
        }
        .bua-fee-stage {
          background: #1a1a1a; border-radius: 12px; padding: 20px 18px;
        }
        .bua-fee-stage-label {
          font-size: 11px; font-weight: 700; color: #888;
          text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px;
        }
        .bua-fee-stage-amount {
          font-size: 24px; font-weight: 900; color: #b100df; margin-bottom: 6px;
        }
        .bua-fee-stage-name {
          font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 6px;
        }
        .bua-fee-stage-desc {
          font-size: 12px; color: #888; line-height: 1.5;
        }

        /* ── Form ── */
        .bua-form-card {
          background: #fff; border: 1.5px solid #e8e9ec;
          border-radius: 16px; padding: 36px;
        }
        .bua-section-title {
          font-size: 13px; font-weight: 800; color: #b100df;
          text-transform: uppercase; letter-spacing: 0.1em;
          margin: 0 0 20px; padding-bottom: 10px;
          border-bottom: 1.5px solid #f0e6ff;
        }
        .bua-section-title + .bua-section-title { margin-top: 32px; }
        .bua-field { margin-bottom: 20px; }
        .bua-label {
          display: block; font-size: 13px; font-weight: 700;
          color: #333; margin-bottom: 7px;
        }
        .bua-label span { color: #b100df; margin-left: 2px; }
        .bua-input, .bua-select, .bua-textarea {
          width: 100%; height: 46px;
          border: 1.5px solid #e0e0e0; border-radius: 10px;
          padding: 0 14px; font-size: 14px; font-family: Inter, sans-serif;
          background: #fff; color: #111; outline: none; box-sizing: border-box;
          transition: border-color .15s;
        }
        .bua-input:focus, .bua-select:focus { border-color: #b100df; }
        .bua-input::placeholder { color: #bbb; }
        .bua-select {
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 14px center;
          padding-right: 36px; cursor: pointer;
        }
        .bua-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 560px) { .bua-row { grid-template-columns: 1fr; } }
        .bua-radio-group {
          display: flex; flex-wrap: wrap; gap: 10px;
        }
        .bua-radio-label {
          display: flex; align-items: center; gap: 8px;
          font-size: 14px; color: #333; cursor: pointer;
          border: 1.5px solid #e0e0e0; border-radius: 10px;
          padding: 10px 16px; transition: border-color .15s, background .15s;
          user-select: none;
        }
        .bua-radio-label:has(input:checked) {
          border-color: #b100df; background: #faf0ff; color: #b100df; font-weight: 700;
        }
        .bua-radio-label input { display: none; }
        .bua-submit {
          width: 100%; height: 52px; border: none; border-radius: 12px;
          background: #050505; color: #fff;
          font-size: 15px; font-weight: 900; cursor: pointer;
          margin-top: 28px; transition: background .15s;
        }
        .bua-submit:hover:not(:disabled) { background: #b100df; }
        .bua-submit:disabled { opacity: 0.6; cursor: not-allowed; }
        .bua-error {
          background: #fff1f1; border: 1.5px solid #fca5a5;
          border-radius: 10px; padding: 12px 16px;
          font-size: 14px; color: #b91c1c; margin-top: 16px;
        }

        /* ── Success ── */
        .bua-success {
          background: #fff; border: 1.5px solid #e8e9ec;
          border-radius: 16px; padding: 60px 40px;
          text-align: center; margin-top: 0;
        }
        .bua-success-icon {
          width: 72px; height: 72px; border-radius: 50%;
          background: #f3e8ff; display: flex; align-items: center; justify-content: center;
          margin: 0 auto 24px; font-size: 32px;
        }
        .bua-success h2 {
          font-size: 26px; font-weight: 800; color: #111; margin: 0 0 12px;
          letter-spacing: -0.02em;
        }
        .bua-success p {
          font-size: 15px; color: #555; line-height: 1.6; max-width: 440px; margin: 0 auto;
        }
      `}</style>

      {/* Header */}
      <header className="bua-header">
        <a href="/buyabroad/uk" className="bua-logo">
          <img src="/havlo-logo.svg" alt="Havlo" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <span>Buy Abroad</span>
        </a>
        <div className="bua-header-spacer" />
        <a href="/buyabroad/uk" className="bua-header-back">← Back to Buy Abroad</a>
      </header>

      <div className="bua-body">
        {step === 'success' ? (
          <div className="bua-success">
            <div className="bua-success-icon">🎉</div>
            <h2>Application Received</h2>
            <p>
              Thank you for completing your application. A member of the Havlo advisory team will
              be in touch shortly to confirm your next steps and arrange your onboarding call.
            </p>
          </div>
        ) : (
          <>
            {/* Intro */}
            <div className="bua-intro">
              <span className="bua-intro-badge">UK Property Purchase Application</span>
              <h1>Let's start building your property plan</h1>
              <p className="bua-intro-lead">
                You have met our initial qualification criteria. Please complete this application
                form so we can begin structuring your property search and next steps.
              </p>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 10 }}>
                <strong>Important:</strong> Havlo is <strong>not an estate agent.</strong> We are an independent{' '}
                <strong>property advisory</strong> that represents <strong>you, the buyer</strong> throughout the
                entire property purchasing process. Our role includes:
              </p>
              <ul className="bua-intro-list">
                <li>Understanding your property requirements</li>
                <li>Sourcing suitable off-market and on-market opportunities</li>
                <li>Property research and due diligence</li>
                <li>Arranging and attending viewings where required</li>
                <li>Negotiating the purchase price on your behalf</li>
                <li>Valuation and pricing analysis to reduce the risk of overpaying</li>
                <li>Introducing trusted mortgage brokers (where required)</li>
                <li>Working alongside solicitors throughout conveyancing</li>
                <li>Monitoring the transaction through to exchange and completion</li>
                <li>Providing ongoing support until you receive your keys</li>
              </ul>
            </div>

            {/* Fee breakdown */}
            <div className="bua-fee">
              <h2>Our Service Fee</h2>
              <p className="bua-fee-total">
                Fixed advisory fee: <strong>£5,000</strong> — payable across three stages
              </p>
              <div className="bua-fee-stages">
                <div className="bua-fee-stage">
                  <div className="bua-fee-stage-label">Stage 1</div>
                  <div className="bua-fee-stage-amount">£500</div>
                  <div className="bua-fee-stage-name">Client Onboarding</div>
                  <div className="bua-fee-stage-desc">
                    Payable before we begin. Deducted from your total fee — £4,500 remains.
                  </div>
                </div>
                <div className="bua-fee-stage">
                  <div className="bua-fee-stage-label">Stage 2</div>
                  <div className="bua-fee-stage-amount">£2,000</div>
                  <div className="bua-fee-stage-name">Property Secured</div>
                  <div className="bua-fee-stage-desc">
                    Payable once you agree to proceed with a property and are ready to offer.
                  </div>
                </div>
                <div className="bua-fee-stage">
                  <div className="bua-fee-stage-label">Stage 3</div>
                  <div className="bua-fee-stage-amount">£2,500</div>
                  <div className="bua-fee-stage-name">Exchange / Completion</div>
                  <div className="bua-fee-stage-desc">
                    Payable prior to completion. We manage the transaction through to the end.
                  </div>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="bua-form-card">
              <form onSubmit={handleSubmit}>
                <div className="bua-section-title">Personal Details</div>

                <div className="bua-field">
                  <label className="bua-label">Full Name <span>*</span></label>
                  <input
                    type="text"
                    className="bua-input"
                    placeholder="e.g. Chukwuemeka Adeyemi"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    required
                  />
                </div>

                <div className="bua-row">
                  <div className="bua-field">
                    <label className="bua-label">Date of Birth <span>*</span></label>
                    <input
                      type="date"
                      className="bua-input"
                      value={dob}
                      onChange={e => setDob(e.target.value)}
                      required
                    />
                  </div>
                  <div className="bua-field">
                    <label className="bua-label">Occupation <span>*</span></label>
                    <input
                      type="text"
                      className="bua-input"
                      placeholder="e.g. Business Owner"
                      value={occupation}
                      onChange={e => setOccupation(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="bua-row">
                  <div className="bua-field">
                    <label className="bua-label">Email Address <span>*</span></label>
                    <input
                      type="email"
                      className="bua-input"
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="bua-field">
                    <label className="bua-label">Mobile Number <span>*</span></label>
                    <input
                      type="tel"
                      className="bua-input"
                      placeholder="+234 800 000 0000"
                      value={mobile}
                      onChange={e => setMobile(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="bua-field">
                  <label className="bua-label">Residential Address <span>*</span></label>
                  <input
                    type="text"
                    className="bua-input"
                    placeholder="Your current home address"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    required
                  />
                </div>

                <div className="bua-section-title" style={{ marginTop: 32 }}>Buying Plans</div>

                <div className="bua-field">
                  <label className="bua-label">
                    Which area or city in the UK are you looking to purchase in? <span>*</span>
                  </label>
                  <input
                    type="text"
                    className="bua-input"
                    placeholder="e.g. London, Liverpool, Manchester, Birmingham, Leeds"
                    value={ukArea}
                    onChange={e => setUkArea(e.target.value)}
                    required
                  />
                </div>

                <div className="bua-field">
                  <label className="bua-label">What type of property are you interested in? <span>*</span></label>
                  <div className="bua-radio-group">
                    {PROPERTY_TYPES.map(t => (
                      <label key={t} className="bua-radio-label">
                        <input
                          type="radio"
                          name="property_type"
                          value={t}
                          checked={propertyType === t}
                          onChange={() => setPropertyType(t)}
                          required
                        />
                        {t}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="bua-field">
                  <label className="bua-label">How many bedrooms? <span>*</span></label>
                  <div className="bua-radio-group">
                    {BEDROOM_OPTIONS.map(b => (
                      <label key={b} className="bua-radio-label">
                        <input
                          type="radio"
                          name="bedrooms"
                          value={b}
                          checked={bedrooms === b}
                          onChange={() => setBedrooms(b)}
                          required
                        />
                        {b}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="bua-field">
                  <label className="bua-label">What is your maximum purchase budget? <span>*</span></label>
                  <input
                    type="text"
                    className="bua-input"
                    placeholder="e.g. £500,000"
                    value={budget}
                    onChange={e => setBudget(e.target.value)}
                    required
                  />
                </div>

                {error && <div className="bua-error">{error}</div>}

                <button
                  type="submit"
                  className="bua-submit"
                  disabled={step === 'submitting'}
                >
                  {step === 'submitting' ? 'Submitting…' : 'Submit Application'}
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
