import React, { useState } from 'react';
import { usePageMeta } from '../hooks/usePageMeta';
import { API_BASE } from '../lib/api';

type Step = 'form' | 'submitting' | 'success';
type FormStage = 1 | 2 | 3 | 4;

const PROPERTY_TYPES = ['House', 'Flat', 'Apartment', 'Commercial', 'Other'];
const BEDROOM_OPTIONS = ['Studio', '1-3', '3-5', '6+'];

export function BuyAbroadUkApply() {
  usePageMeta({
    title: 'UK Property Purchase Application | Havlo',
    description: 'Complete your UK property purchase application with Havlo. Our advisory team will guide you through every step of buying property in the UK.',
    canonical: 'https://www.heyhavlo.com/buyabroad/uk/apply',
  });

  const [step, setStep] = useState<Step>('form');
  const [formStage, setFormStage] = useState<FormStage>(1);
  const [error, setError] = useState('');

  // Stage 2 fields
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [occupation, setOccupation] = useState('');

  // Stage 3 fields
  const [ukArea, setUkArea] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [propertyTypeOther, setPropertyTypeOther] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [budget, setBudget] = useState('');

  const handleBudgetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    if (raw === '') { setBudget(''); return; }
    const formatted = '£' + Number(raw).toLocaleString('en-GB');
    setBudget(formatted);
  };

  const goToStage = (stage: FormStage) => {
    setFormStage(stage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
          property_type: propertyType === 'Other' ? propertyTypeOther : propertyType,
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

  const STAGE_LABELS = ['Overview', 'Your Details', 'Buying Plans', 'Payment'];

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
          display: inline-flex; align-items: center;
          text-decoration: none; color: #111; line-height: 1; flex-shrink: 0;
        }
        .bua-logo img { width: 136px; height: auto; display: block; }
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
          max-width: 1100px; margin: 0 auto;
          padding: 48px clamp(20px, 5vw, 48px) 80px;
        }

        /* ── Progress bar ── */
        .bua-progress-bar {
          display: flex; align-items: flex-start;
          margin-bottom: 36px;
        }
        /* Each step: dot centered above its label */
        .bua-progress-step {
          display: flex; flex-direction: column; align-items: center;
          flex-shrink: 0;
        }
        /* Connecting line sits between steps, vertically centred with the dots */
        .bua-progress-line-wrap {
          flex: 1; display: flex; align-items: flex-start; padding-top: 17px;
        }
        .bua-progress-dot {
          width: 34px; height: 34px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 800; flex-shrink: 0;
          transition: background .25s, color .25s, border-color .25s;
        }
        .bua-progress-dot.active  { background: #111; color: #fff; border: 2px solid #111; }
        .bua-progress-dot.done    { background: #b100df; color: #fff; border: 2px solid #b100df; }
        .bua-progress-dot.pending { background: #fff; color: #ccc; border: 2px solid #e0e0e0; }
        .bua-progress-line {
          width: 100%; height: 2px; background: #e0e0e0;
          transition: background .25s;
        }
        .bua-progress-line.done { background: #b100df; }
        .bua-progress-text {
          font-size: 11px; font-weight: 700; margin-top: 8px;
          text-align: center; white-space: nowrap; letter-spacing: 0.02em;
          text-transform: uppercase;
        }
        .bua-progress-text.active  { color: #111; }
        .bua-progress-text.done    { color: #b100df; }
        .bua-progress-text.pending { color: #ccc; }

        /* ── Card base ── */
        .bua-card {
          background: #fff; border: 1.5px solid #e8e9ec;
          border-radius: 16px; padding: 36px; margin-bottom: 24px;
        }

        /* ── Intro card ── */
        .bua-intro-badge {
          display: inline-block; background: #f3e8ff; color: #b100df;
          font-size: 11px; font-weight: 800; letter-spacing: 0.1em;
          text-transform: uppercase; border-radius: 999px;
          padding: 4px 12px; margin-bottom: 18px;
        }
        .bua-intro h1 {
          font-size: clamp(22px, 3vw, 30px); font-weight: 800;
          letter-spacing: -0.03em; color: #111; margin: 0 0 12px;
        }
        .bua-intro-lead {
          font-size: 15px; line-height: 1.65; color: #444; margin: 0 0 16px;
        }
        .bua-intro-list {
          list-style: none; padding: 0; margin: 0 0 20px;
        }
        .bua-intro-list li {
          font-size: 14px; color: #444; line-height: 1.6;
          padding: 4px 0 4px 22px; position: relative;
        }
        .bua-intro-list li::before {
          content: '✓'; position: absolute; left: 0;
          color: #b100df; font-weight: 700;
        }
        .bua-intro-analysis {
          font-size: 14px; color: #555; line-height: 1.65;
          background: #fafafa; border: 1.5px solid #f0e6ff;
          border-radius: 10px; padding: 14px 16px; margin-top: 4px;
        }

        /* ── About us card ── */
        .bua-about {
          background: #f9f9f9; border: 1.5px solid #e8e9ec;
          border-radius: 16px; padding: 28px 36px; margin-bottom: 24px;
        }
        .bua-about h3 { font-size: 14px; font-weight: 800; color: #111; margin: 0 0 12px; }
        .bua-about p, .bua-about address {
          font-size: 13px; color: #555; line-height: 1.7;
          margin: 0 0 10px; font-style: normal;
        }
        .bua-about a { color: #b100df; font-weight: 700; text-decoration: none; }
        .bua-about a:hover { text-decoration: underline; }

        /* ── Fee card ── */
        .bua-fee {
          background: #0a0a0a; color: #fff;
          border-radius: 16px; padding: 32px 36px; margin-bottom: 24px;
        }
        .bua-fee h2 {
          font-size: 18px; font-weight: 800; margin: 0 0 6px; color: #fff;
        }
        .bua-fee-total { font-size: 14px; color: #aaa; margin: 0 0 24px; }
        .bua-fee-total strong { color: #b100df; }
        .bua-fee-stages {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;
        }
        @media (max-width: 600px) { .bua-fee-stages { grid-template-columns: 1fr; } }
        .bua-fee-stage { background: #1a1a1a; border-radius: 12px; padding: 20px 18px; }
        .bua-fee-stage-label {
          font-size: 11px; font-weight: 700; color: #888;
          text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px;
        }
        .bua-fee-stage-amount { font-size: 24px; font-weight: 900; color: #b100df; margin-bottom: 6px; }
        .bua-fee-stage-name { font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 8px; }
        .bua-fee-stage-desc { font-size: 12px; color: #888; line-height: 1.55; margin-bottom: 10px; }
        .bua-fee-stage-list { list-style: none; padding: 0; margin: 0; }
        .bua-fee-stage-list li {
          font-size: 11px; color: #999; line-height: 1.6;
          padding-left: 14px; position: relative;
        }
        .bua-fee-stage-list li::before {
          content: '·'; position: absolute; left: 0; color: #b100df; font-weight: 900;
        }

        /* ── Section header ── */
        .bua-section-header {
          margin-bottom: 28px;
        }
        .bua-section-title {
          font-size: 13px; font-weight: 800; color: #b100df;
          text-transform: uppercase; letter-spacing: 0.1em;
          margin: 0 0 8px; padding-bottom: 10px;
          border-bottom: 1.5px solid #f0e6ff;
        }
        .bua-section-desc { font-size: 14px; color: #555; line-height: 1.6; margin: 10px 0 0; }

        /* ── Fields ── */
        .bua-field { margin-bottom: 20px; }
        .bua-label {
          display: block; font-size: 13px; font-weight: 700;
          color: #333; margin-bottom: 7px;
        }
        .bua-label span { color: #b100df; margin-left: 2px; }
        .bua-input, .bua-select {
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
          background-repeat: no-repeat; background-position: right 14px center;
          padding-right: 36px; cursor: pointer;
        }
        .bua-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 560px) { .bua-row { grid-template-columns: 1fr; } }
        .bua-radio-group { display: flex; flex-wrap: wrap; gap: 10px; }
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
        .bua-other-input {
          margin-top: 10px;
        }

        /* ── Payment section ── */
        .bua-payment-heading {
          font-size: 18px; font-weight: 800; color: #111; margin: 0 0 6px;
          letter-spacing: -0.02em;
        }
        .bua-payment-subheading {
          font-size: 14px; color: #555; margin: 0 0 28px; line-height: 1.6;
        }
        .bua-payment-subheading strong { color: #111; }
        .bua-payment-option {
          border: 1.5px solid #e8e9ec; border-radius: 14px;
          padding: 24px 28px; margin-bottom: 16px;
        }
        .bua-payment-option-title {
          font-size: 14px; font-weight: 800; color: #111;
          margin: 0 0 10px;
        }
        .bua-payment-option-body {
          font-size: 14px; color: #555; line-height: 1.65; margin: 0;
        }
        .bua-payment-option-body strong { color: #111; }
        .bua-pay-now-btn {
          display: inline-block; margin-top: 14px;
          background: #111; color: #fff;
          font-size: 14px; font-weight: 800;
          border-radius: 10px; padding: 12px 24px;
          text-decoration: none; transition: background .15s;
        }
        .bua-pay-now-btn:hover { background: #b100df; }
        .bua-bank-details {
          background: #f9f9f9; border-radius: 10px;
          padding: 16px 20px; margin: 12px 0;
          font-size: 13px; line-height: 1.8; color: #333;
        }
        .bua-bank-details strong { color: #111; }
        .bua-payment-note {
          background: #fff8f0; border: 1.5px solid #ffe0b2;
          border-radius: 10px; padding: 14px 18px; margin-top: 20px;
          font-size: 13px; color: #7c4700; line-height: 1.65;
        }
        .bua-payment-note strong { color: #7c4700; }
        .bua-payment-contact {
          font-size: 14px; color: #555; margin: 16px 0 0; line-height: 1.6;
        }
        .bua-payment-contact a { color: #b100df; font-weight: 700; text-decoration: none; }

        /* ── Form actions ── */
        .bua-form-actions {
          display: flex; gap: 12px; align-items: center; margin-top: 28px;
        }
        .bua-btn-primary {
          flex: 1; height: 52px; border: none; border-radius: 12px;
          background: #050505; color: #fff;
          font-size: 15px; font-weight: 900; cursor: pointer;
          transition: background .15s;
        }
        .bua-btn-primary:hover:not(:disabled) { background: #b100df; }
        .bua-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .bua-btn-back {
          height: 52px; border: 1.5px solid #e0e0e0; border-radius: 12px;
          background: #fff; color: #333;
          font-size: 14px; font-weight: 700; cursor: pointer;
          padding: 0 20px; transition: border-color .15s, color .15s; white-space: nowrap;
        }
        .bua-btn-back:hover { border-color: #b100df; color: #b100df; }
        .bua-error {
          background: #fff1f1; border: 1.5px solid #fca5a5;
          border-radius: 10px; padding: 12px 16px;
          font-size: 14px; color: #b91c1c; margin-top: 16px;
        }

        /* ── Success ── */
        .bua-success {
          background: #fff; border: 1.5px solid #e8e9ec;
          border-radius: 16px; padding: 60px 40px; text-align: center;
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

        @media (max-width: 768px) {
          .bua-header { padding: 0 20px; }
          .bua-logo img { width: 82px; }
          .bua-progress-text { font-size: 9px; }
        }
      `}</style>

      {/* Header */}
      <header className="bua-header">
        <a href="/buyabroad/uk" className="bua-logo">
          <img src="/Havlo Black Transparent.png" alt="Havlo" />
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
            {/* Progress bar */}
            <div className="bua-progress-bar">
              {STAGE_LABELS.map((label, i) => {
                const stageNum = (i + 1) as FormStage;
                const status = formStage > stageNum ? 'done' : formStage === stageNum ? 'active' : 'pending';
                return (
                  <React.Fragment key={label}>
                    <div className="bua-progress-step">
                      <div className={`bua-progress-dot ${status}`}>
                        {status === 'done' ? '✓' : stageNum}
                      </div>
                      <span className={`bua-progress-text ${status}`}>{label}</span>
                    </div>
                    {i < STAGE_LABELS.length - 1 && (
                      <div className="bua-progress-line-wrap">
                        <div className={`bua-progress-line ${formStage > stageNum ? 'done' : ''}`} />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* ── STAGE 1: Overview ── */}
            {formStage === 1 && (
              <>
                <div className="bua-card bua-intro">
                  <span className="bua-intro-badge">Buy From Nigeria · UK Property Purchase</span>
                  <h1>UK Property Purchase Application Form</h1>
                  <p className="bua-intro-lead">
                    Thank you for your interest in buying a property in the UK with Havlo — we're excited to help you on your journey.
                  </p>
                  <p className="bua-intro-lead" style={{ marginBottom: 10 }}>
                    You have met our initial qualification criteria. Please complete this application form so we can begin structuring your property search and next steps.
                  </p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 10 }}>
                    <strong>Important:</strong> Havlo is <strong>not an estate agent.</strong> We are an independent{' '}
                    <strong>property advisory</strong> that represents <strong>you, the buyer</strong> throughout the entire property purchasing process.
                  </p>
                  <p style={{ fontSize: 14, color: '#555', marginBottom: 12 }}>Our role is to guide and support you from beginning to end, including:</p>
                  <ul className="bua-intro-list">
                    <li>Understanding your property requirements</li>
                    <li>Sourcing suitable off-market and on-market opportunities</li>
                    <li>Property research and due diligence</li>
                    <li>Arranging and attending viewings where required</li>
                    <li>Negotiating the purchase price</li>
                    <li>Carrying out valuation and pricing analysis to reduce the risk of overpaying</li>
                    <li>Introducing trusted mortgage brokers (where required)</li>
                    <li>Working alongside solicitors throughout the conveyancing process</li>
                    <li>Managing the legal and administrative stages</li>
                    <li>Monitoring the transaction through to exchange and completion</li>
                    <li>Providing ongoing support until you receive the keys to your property</li>
                  </ul>
                  <div className="bua-intro-analysis">
                    Our independent property analysis includes a thorough assessment of comparable sales, local market conditions and property value to help ensure you do <strong>not overpay</strong> for your purchase.
                  </div>
                </div>

                <div className="bua-about">
                  <h3>About Us</h3>
                  <p><strong>Havlo Ltd</strong></p>
                  <address>
                    Registered in England and Wales<br />
                    Company Number: <strong>15369975</strong><br /><br />
                    2nd Floor, Berkeley Square<br />
                    London, England, W1J 6BD
                  </address>
                  <p>
                    Learn more about Havlo: <a href="https://www.heyhavlo.com" target="_blank" rel="noopener noreferrer">www.heyhavlo.com</a>
                  </p>
                  <p>
                    Buy Property in the UK From Nigeria: <a href="/buyabroad/uk">/buyabroad/uk</a>
                  </p>
                </div>

                <div className="bua-fee">
                  <h2>Our Service Fee</h2>
                  <p className="bua-fee-total">
                    Our fixed advisory fee is <strong>£5,000</strong>, payable across three stages.
                  </p>
                  <div className="bua-fee-stages">
                    <div className="bua-fee-stage">
                      <div className="bua-fee-stage-label">Stage 1</div>
                      <div className="bua-fee-stage-amount">£500</div>
                      <div className="bua-fee-stage-name">Client Onboarding</div>
                      <div className="bua-fee-stage-desc">Payable before we begin work.</div>
                      <ul className="bua-fee-stage-list">
                        <li>Open your client file</li>
                        <li>Assess your requirements</li>
                        <li>Begin sourcing properties</li>
                        <li>Carry out initial research</li>
                        <li>Develop your acquisition strategy</li>
                      </ul>
                      <div className="bua-fee-stage-desc" style={{ marginTop: 10 }}>
                        <strong style={{ color: '#fff' }}>Important:</strong> The £500 is <strong style={{ color: '#fff' }}>not an additional charge.</strong> It is <strong style={{ color: '#b100df' }}>deducted from your total £5,000</strong>, leaving £4,500 remaining.
                      </div>
                    </div>
                    <div className="bua-fee-stage">
                      <div className="bua-fee-stage-label">Stage 2</div>
                      <div className="bua-fee-stage-amount">£2,000</div>
                      <div className="bua-fee-stage-name">Property Secured</div>
                      <div className="bua-fee-stage-desc">Payable once you have agreed to proceed with a property and ready to put in an offer.</div>
                      <ul className="bua-fee-stage-list">
                        <li>Negotiate on your behalf</li>
                        <li>Coordinate with estate agents</li>
                        <li>Liaise with your mortgage broker</li>
                        <li>Work with your solicitor</li>
                        <li>Assist throughout conveyancing</li>
                        <li>Monitor surveys and legal enquiries</li>
                      </ul>
                    </div>
                    <div className="bua-fee-stage">
                      <div className="bua-fee-stage-label">Stage 3</div>
                      <div className="bua-fee-stage-amount">£2,500</div>
                      <div className="bua-fee-stage-name">Exchange / Completion</div>
                      <div className="bua-fee-stage-desc">
                        Payable prior to completion of the purchase. During this final stage we continue managing the transaction until completion, ensuring all parties remain coordinated and helping the purchase progress as smoothly as possible.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bua-form-actions">
                  <button
                    type="button"
                    className="bua-btn-primary"
                    onClick={() => goToStage(2)}
                  >
                    Next →
                  </button>
                </div>
              </>
            )}

            {/* ── STAGE 2: Client Application ── */}
            {formStage === 2 && (
              <div className="bua-card">
                <div className="bua-section-header">
                  <div className="bua-section-title">Client Application Section</div>
                  <p className="bua-section-desc">Let's start building your property plan — fill in your details below</p>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); goToStage(3); }}>
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

                  <div className="bua-field">
                    <label className="bua-label">Address <span>*</span></label>
                    <input
                      type="text"
                      className="bua-input"
                      placeholder="Your current home address"
                      value={address}
                      onChange={e => setAddress(e.target.value)}
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

                  <div className="bua-form-actions">
                    <button type="button" className="bua-btn-back" onClick={() => goToStage(1)}>← Back</button>
                    <button type="submit" className="bua-btn-primary">Next →</button>
                  </div>
                </form>
              </div>
            )}

            {/* ── STAGE 3: Buying Plans ── */}
            {formStage === 3 && (
              <div className="bua-card">
                <div className="bua-section-header">
                  <div className="bua-section-title">Buying Plans</div>
                  <p className="bua-section-desc">Tell us your buying plans so we can tailor your property search to your goals</p>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); goToStage(4); }}>
                  <div className="bua-field">
                    <label className="bua-label">
                      Which area or city in the UK are you looking to purchase a property in? <span>*</span>
                    </label>
                    <input
                      type="text"
                      className="bua-input"
                      placeholder="e.g. London, Manchester, Birmingham, Leeds"
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
                          {t === 'Other' ? 'Other:' : t}
                        </label>
                      ))}
                    </div>
                    {propertyType === 'Other' && (
                      <div className="bua-other-input">
                        <input
                          type="text"
                          className="bua-input"
                          placeholder="Please specify"
                          value={propertyTypeOther}
                          onChange={e => setPropertyTypeOther(e.target.value)}
                          required
                        />
                      </div>
                    )}
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
                      placeholder="e.g. £10,000,000"
                      value={budget}
                      onChange={handleBudgetChange}
                      inputMode="numeric"
                      required
                    />
                  </div>

                  <div className="bua-form-actions">
                    <button type="button" className="bua-btn-back" onClick={() => goToStage(2)}>← Back</button>
                    <button type="submit" className="bua-btn-primary">Next →</button>
                  </div>
                </form>
              </div>
            )}

            {/* ── STAGE 4: Payment & Submission ── */}
            {formStage === 4 && (
              <div className="bua-card">
                <div className="bua-section-header">
                  <div className="bua-section-title">Payment and Form Submission</div>
                </div>

                <p className="bua-payment-subheading">
                  To proceed with your client application, please complete the{' '}
                  <strong>£500 (₦1,000,328.11)</strong> client onboarding charge.
                </p>

                {/* Option 1 */}
                <div className="bua-payment-option">
                  <p className="bua-payment-option-title">Option 1: Pay by Card</p>
                  <p className="bua-payment-option-body">
                    Click the button below to securely complete your payment using a debit or credit card.
                    All card payments are processed securely by our authorised payment provider,
                    Sprint Technologies, on behalf of Havlo Ltd.
                  </p>
                  <a
                    href="#pay-now"
                    className="bua-pay-now-btn"
                    onClick={e => e.preventDefault()}
                  >
                    PAY NOW
                  </a>
                </div>

                {/* Option 2 */}
                <div className="bua-payment-option">
                  <p className="bua-payment-option-title">Option 2: Pay by Bank Transfer</p>
                  <p className="bua-payment-option-body">
                    You may also choose to pay via bank transfer using the details below:
                  </p>
                  <div className="bua-bank-details">
                    Account Number: <strong>4568961712</strong><br />
                    Account Name: <strong>OHENTPAY - HAVLO LTD</strong><br />
                    Bank: <strong>Fidelity Bank</strong>
                  </div>
                  <p className="bua-payment-option-body">
                    Please ensure you include any required reference details when making your transfer.
                  </p>
                  <p className="bua-payment-option-body" style={{ marginTop: 10 }}>
                    Once your payment has been confirmed, our team will contact you to begin your onboarding
                    and move you to the next stage of your property journey with Havlo.
                  </p>
                  <p className="bua-payment-contact">
                    If you experience any issues or need assistance, please contact us on{' '}
                    <a href="tel:09039861006">09039861006</a>.
                  </p>
                </div>

                {/* Option 3 */}
                <div className="bua-payment-option">
                  <p className="bua-payment-option-title">Option 3: Alternative Payment Methods</p>
                  <p className="bua-payment-option-body">
                    If you would prefer to use an alternative payment method such as cryptocurrency,
                    please contact our team directly and we will assist you. Once your payment has been
                    confirmed, our team will be in touch to begin your onboarding and move you into
                    the next stage of your property journey with Havlo.
                  </p>
                </div>

                <div className="bua-payment-note">
                  <strong>Please complete payment before submitting this form.</strong><br />
                  If you encounter any issues during payment, or would prefer an alternative payment method,
                  please contact our team on <strong>09039861006</strong> and we will provide assistance.
                </div>

                {error && <div className="bua-error">{error}</div>}

                <form onSubmit={handleSubmit}>
                  <div className="bua-form-actions">
                    <button type="button" className="bua-btn-back" onClick={() => goToStage(3)}>← Back</button>
                    <button
                      type="submit"
                      className="bua-btn-primary"
                      disabled={step === 'submitting'}
                    >
                      {step === 'submitting' ? 'Submitting…' : 'Submit Application'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
