import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

const PURPLE = '#A409D2';

/* ─── SHARED NAV SVG LOGO ─── */
const StaleListingsLogo = () => (
  <div style={{ display:'flex', flexDirection:'column', justifyContent:'space-between', width:215, height:52 }}>
    <svg width="215" height="33" viewBox="0 0 215 33" fill="none" xmlns="http://www.w3.org/2000/svg">
      <text x="0" y="26" fontFamily='"Plus Jakarta Sans", sans-serif' fontWeight="800" fontSize="26" fill="#313131" letterSpacing="-0.5">StaleListings</text>
    </svg>
    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
      <span style={{ fontFamily:'Inter, sans-serif', fontSize:16, color:'#000', fontWeight:400, letterSpacing:'-0.32px' }}>By</span>
      <svg width="63" height="16" viewBox="0 0 63 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <text x="0" y="13" fontFamily='"Plus Jakarta Sans", sans-serif' fontWeight="800" fontSize="13" fill="#313131" letterSpacing="-0.3">HAVLO</text>
      </svg>
    </div>
  </div>
);

const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 7V5C4 2.79086 5.79086 1 8 1C10.2091 1 12 2.79086 12 5V7M3.2 15H12.8C13.4627 15 14 14.4627 14 13.8V8.2C14 7.53726 13.4627 7 12.8 7H3.2C2.53726 7 2 7.53726 2 8.2V13.8C2 14.4627 2.53726 15 3.2 15Z" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
    <path d="M10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2ZM14.0667 7.86667L9.26667 12.6667L9.06667 12.8667C8.93333 12.9333 8.8 13 8.66667 13C8.53333 13 8.4 12.9333 8.26667 12.8667L5.93333 10.5333C5.66667 10.2667 5.66667 9.86667 5.93333 9.6C6.2 9.33333 6.6 9.33333 6.86667 9.6L8.66667 11.4L13.2 6.86667C13.4667 6.6 13.8667 6.6 14.1333 6.86667C14.4 7.13333 14.3333 7.6 14.0667 7.86667Z" fill="black"/>
  </svg>
);

const VerifyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
    <path d="M14.3736 7.16036L13.4669 6.10703C13.2936 5.90703 13.1536 5.5337 13.1536 5.26703V4.1337C13.1536 3.42703 12.5736 2.84703 11.8669 2.84703H10.7336C10.4736 2.84703 10.0936 2.70703 9.89358 2.5337L8.84025 1.62703C8.38025 1.2337 7.62691 1.2337 7.16025 1.62703L6.11358 2.54036C5.91358 2.70703 5.53358 2.84703 5.27358 2.84703H4.12025C3.41358 2.84703 2.83358 3.42703 2.83358 4.1337V5.2737C2.83358 5.5337 2.69358 5.90703 2.52691 6.10703L1.62691 7.16703C1.24025 7.62703 1.24025 8.3737 1.62691 8.8337L2.52691 9.8937C2.69358 10.0937 2.83358 10.467 2.83358 10.727V11.867C2.83358 12.5737 3.41358 13.1537 4.12025 13.1537H5.27358C5.53358 13.1537 5.91358 13.2937 6.11358 13.467L7.16691 14.3737C7.62691 14.767 8.38025 14.767 8.84691 14.3737L9.90025 13.467C10.1002 13.2937 10.4736 13.1537 10.7402 13.1537H11.8736C12.5802 13.1537 13.1602 12.5737 13.1602 11.867V10.7337C13.1602 10.4737 13.3002 10.0937 13.4736 9.8937L14.3802 8.84036C14.7669 8.38036 14.7669 7.62036 14.3736 7.16036ZM10.7736 6.74036L7.55358 9.96036C7.46025 10.0537 7.33358 10.107 7.20025 10.107C7.06691 10.107 6.94025 10.0537 6.84691 9.96036L5.23358 8.34703C5.04025 8.1537 5.04025 7.8337 5.23358 7.64036C5.42691 7.44703 5.74691 7.44703 5.94025 7.64036L7.20025 8.90036L10.0669 6.0337C10.2602 5.84036 10.5802 5.84036 10.7736 6.0337C10.9669 6.22703 10.9669 6.54703 10.7736 6.74036Z" fill="#149D4F"/>
  </svg>
);

/* ─── HOUSE ILLUSTRATIONS (colored SVG) ─── */
const BlueHouseIllustration = () => (
  <div style={{ width:220, height:122, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
    <svg width="100" height="90" viewBox="0 0 100 90" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="50,5 95,40 5,40" fill="#5B9BD5"/>
      <rect x="10" y="40" width="80" height="45" fill="#4A7FC1"/>
      <rect x="38" y="55" width="24" height="30" fill="#2B5A9E"/>
      <rect x="15" y="48" width="16" height="14" fill="#87BCDE"/>
      <rect x="69" y="48" width="16" height="14" fill="#87BCDE"/>
      <polygon points="50,12 88,40 12,40" fill="#6AABDF"/>
    </svg>
  </div>
);

const GoldHouseIllustration = () => (
  <div style={{ width:220, height:122, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
    <svg width="100" height="90" viewBox="0 0 100 90" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="50,5 95,40 5,40" fill="#F5C842"/>
      <rect x="10" y="40" width="80" height="45" fill="#EAA501"/>
      <rect x="38" y="55" width="24" height="30" fill="#C07800"/>
      <rect x="15" y="48" width="16" height="14" fill="#FFE085"/>
      <rect x="69" y="48" width="16" height="14" fill="#FFE085"/>
      <polygon points="50,12 88,40 12,40" fill="#FFD84D"/>
      <circle cx="78" cy="20" r="5" fill="#FFE44D" opacity="0.8"/>
      <circle cx="85" cy="12" r="3" fill="#FFE44D" opacity="0.5"/>
      <circle cx="71" cy="14" r="2" fill="#FFE44D" opacity="0.6"/>
    </svg>
  </div>
);

const TealHouseIllustration = () => (
  <div style={{ width:220, height:122, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
    <svg width="100" height="90" viewBox="0 0 100 90" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="50,5 95,40 5,40" fill="#26B5B5"/>
      <rect x="10" y="40" width="80" height="45" fill="#1A9A9A"/>
      <rect x="38" y="55" width="24" height="30" fill="#0D7070"/>
      <rect x="15" y="48" width="16" height="14" fill="#6DDDDD"/>
      <rect x="69" y="48" width="16" height="14" fill="#6DDDDD"/>
      <polygon points="50,12 88,40 12,40" fill="#3DCCCC"/>
      <rect x="25" y="42" width="12" height="2" rx="1" fill="#0D7070"/>
      <rect x="63" y="42" width="12" height="2" rx="1" fill="#0D7070"/>
    </svg>
  </div>
);

/* ─── PLAN DATA ─── */
const PLANS = [
  {
    id: 'quick_insight' as const,
    name: 'Quick Insight',
    price: '£79.99',
    amount: 79.99,
    tagline: 'Vendors wanting a fast professional opinion.',
    turnaround: 'Turnaround: 24–48 hours',
    priceLabel: '£79.99 per report',
    preNote: null,
    features: [
      'Data-driven property market analysis',
      'Human estate agent review',
      'Local comparable sales review',
      'Pricing position check',
      'Online listing performance review',
      'Summary report with key issues slowing the sale',
      '3–5 actionable recommendations',
    ],
    Illustration: BlueHouseIllustration,
    bestValue: false,
    btnStyle: { background: '#000', color: '#FEFFFF' } as React.CSSProperties,
    border: '1px solid rgba(0,0,0,0.05)',
    selectedBorder: '2px solid #000',
  },
  {
    id: 'professional_review' as const,
    name: 'Professional Review',
    price: '£299.99',
    amount: 299.99,
    tagline: 'Serious sellers wanting expert guidance to improve saleability.',
    turnaround: 'Turnaround: 24 hours',
    priceLabel: '£299.99 per report',
    preNote: 'Includes everything in Quick Insight, plus: a detailed review by an estate agent actively selling similar properties in the local area.',
    features: [
      'Buyer appeal analysis',
      'Listing photography & description review',
      'Local competition benchmarking',
      '"Why buyers may be overlooking this property" section',
      'Recommended pricing strategy',
      'Priority turnaround',
    ],
    Illustration: GoldHouseIllustration,
    bestValue: true,
    btnStyle: { background: '#EAA501', color: '#000' } as React.CSSProperties,
    border: '1px solid rgba(0,0,0,0.05)',
    selectedBorder: '2px solid #006163',
  },
  {
    id: 'premium_strategy' as const,
    name: 'Premium Strategy',
    price: '£1,499.99',
    amount: 1499.99,
    tagline: 'High-value homes or properties stuck on the market for months.',
    turnaround: '24 hours + follow-up support',
    priceLabel: '£1499.99 per report',
    preNote: 'Includes everything in professional review plus:',
    features: [
      'Detailed property positioning strategy',
      'Multi-platform listing audit',
      'Area demand and buyer demographic analysis',
      'Home presentation/staging recommendations',
      'Marketing improvement roadmap',
      'Re-launch strategy',
      'Estate agent strategy review with improvement recommendations',
      'Follow-up review after changes are implemented',
      'Direct access for Q&A support for 14–30 days',
    ],
    Illustration: TealHouseIllustration,
    bestValue: false,
    btnStyle: { background: '#000', color: '#FEFFFF' } as React.CSSProperties,
    border: '1px solid rgba(0,0,0,0.05)',
    selectedBorder: '2px solid #000',
  },
];

type PlanId = 'quick_insight' | 'professional_review' | 'premium_strategy';
const COUNTRY_CODES = ['+44', '+1', '+971', '+65', '+852', '+61', '+49', '+33'];

/* ─── SHARED STEPPER ─── */
function Stepper({ activeStep }: { activeStep: 1 | 2 | 3 }) {
  const steps = [
    { num: 1, label: 'Your property' },
    { num: 2, label: 'Choose Plan' },
    { num: 3, label: 'Completed' },
  ];
  return (
    <div style={{ background: '#fff', borderBottom: '1px solid #F4F4F4' }}>
      <div style={{ maxWidth: 1328, margin: '0 auto', padding: '20px 56px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0 }}>
        {steps.map((step, i) => {
          const isActive = step.num === activeStep;
          const isDone = step.num < activeStep;
          const isInactive = step.num > activeStep;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: (isActive || isDone) ? PURPLE : 'transparent',
                  border: isInactive ? '2px solid #D0D0D0' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <span style={{
                    fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14,
                    color: (isActive || isDone) ? '#fff' : '#B0B0B0',
                  }}>{step.num}</span>
                </div>
                <span style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: isActive ? 600 : 400,
                  fontSize: 14,
                  color: isActive ? '#000' : isInactive ? '#B0B0B0' : '#000',
                }}>{step.label}</span>
              </div>
              {i < 2 && (
                <div style={{ width: 80, height: 1, background: '#E0E0E0', margin: '0 20px' }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── SHARED NAVBAR ─── */
function PlanNavbar() {
  return (
    <header style={{ display: 'flex', width: '100%', height: 80, padding: '12px 56px', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F4F4F4', background: '#FFF', backdropFilter: 'blur(5px)', boxSizing: 'border-box' }}>
      <img src="/stale-logo.png" alt="StaleListings" style={{ height: 40, width: 'auto', display: 'block', flexShrink: 0 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <LockIcon />
        <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 16, color: '#000', letterSpacing: '-0.32px' }}>Secure assessment · SSL encrypted</span>
      </div>
    </header>
  );
}

/* ─── MAIN COMPONENT ─── */
export function StaleListingsPlan() {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('professional_review');
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_country_code: '+44',
    phone: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const plan = PLANS.find(p => p.id === selectedPlan)!;

  const handlePay = async () => {
    if (!form.first_name || !form.last_name || !form.email || !form.phone) {
      setError('Please fill in all fields.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      setError('Please enter a valid email address.');
      return;
    }

    const answers = JSON.parse(sessionStorage.getItem('sl_answers') || '{}');
    const listingUrl = sessionStorage.getItem('sl_listing_url') || '';
    const address = sessionStorage.getItem('sl_address') || '';

    setLoading(true);
    setError('');

    try {
      const result = await api.staleListingsSubmit({
        ...form,
        package: selectedPlan,
        property_address: address || undefined,
        listing_url: listingUrl || undefined,
        questions_data: answers,
        redirect_url: `${window.location.origin}/stale-listings/complete`,
      });
      if (result.checkout_url) {
        window.location.href = result.checkout_url;
      } else {
        navigate(`/stale-listings/complete?ref=${result.reference}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const address = sessionStorage.getItem('sl_address') || '';
  const listingUrl = sessionStorage.getItem('sl_listing_url') || '';
  const propertyLabel = address || listingUrl || 'Your listed property';

  const turnaroundLabel = selectedPlan === 'quick_insight' ? '24–48 hours'
    : selectedPlan === 'professional_review' ? '24 hours (priority)'
    : '24 hours + follow-up support';

  return (
    <div style={{ minHeight: '100vh', background: '#F7F9F9', fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800&family=Inter:wght@400;500;600;700&display=swap');
        .sl-plan-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
        @media (max-width: 1024px) { .sl-plan-cards { grid-template-columns: 1fr; max-width: 480px; margin: 0 auto; width: 100%; } }
        @media (max-width: 640px) {
          .sl-plan-navbar { padding: 12px 20px !important; }
          .sl-plan-content { padding: 32px 20px !important; }
          .sl-stepper { padding: 16px 20px !important; }
          .sl-plan-bottom { padding: 20px !important; flex-direction: column !important; gap: 12px !important; }
          .sl-plan-bottom button { width: 100% !important; }
        }
      `}</style>

      <PlanNavbar />
      <Stepper activeStep={2} />

      {/* Content */}
      <div className="sl-plan-content" style={{ flex: 1, padding: '48px 56px 100px', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: 1328, margin: '0 auto' }}>

          {/* Page header */}
          <div style={{ marginBottom: 40 }}>
            <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14, color: PURPLE, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8 }}>
              ALMOST THERE
            </div>
            <h1 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: 32, color: '#000', letterSpacing: '-0.5px', margin: '0 0 12px' }}>
              Choose your assessment plan
            </h1>
            <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 16, color: '#444', lineHeight: '150%', margin: 0, maxWidth: 520 }}>
              Based on your answers, a property specialist will analyse your listing and prepare your personalised report.
            </p>
          </div>

          {/* Plan cards */}
          <div className="sl-plan-cards">
            {PLANS.map((p) => {
              const isSelected = selectedPlan === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPlan(p.id)}
                  style={{
                    display: 'flex',
                    padding: 24,
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 32,
                    flex: '1 0 0',
                    borderRadius: 32,
                    border: isSelected ? p.selectedBorder : p.border,
                    background: '#FFF',
                    overflow: 'hidden',
                    position: 'relative',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                    transition: 'border 0.15s',
                  }}
                >
                  {/* BEST VALUE badge */}
                  {p.bestValue && (
                    <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', padding: '8px', justifyContent: 'center', alignItems: 'center', gap: 8, borderRadius: 8, background: '#E63660' }}>
                      <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 16, color: '#FFF', letterSpacing: '-0.32px', textTransform: 'uppercase', lineHeight: '100%' }}>BEST VALUE</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32, alignSelf: 'stretch' }}>
                    <p.Illustration />

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 24, alignSelf: 'stretch' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 20, alignSelf: 'stretch' }}>
                        <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 24, color: '#000', letterSpacing: '-0.72px', lineHeight: '150%', alignSelf: 'stretch' }}>
                          {p.name}
                        </div>
                        <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 16, color: '#000', letterSpacing: '-0.32px', lineHeight: '120%', alignSelf: 'stretch' }}>
                          {p.tagline}
                        </div>
                      </div>

                      {/* Features list */}
                      <div style={{ display: 'flex', paddingTop: 16, flexDirection: 'column', alignItems: 'flex-start', gap: 16, alignSelf: 'stretch', borderTop: '1px solid rgba(0,0,0,0.10)' }}>
                        {p.preNote && (
                          <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 14, color: '#050405', lineHeight: '120%', letterSpacing: '-0.42px' }}>
                            <strong>Includes everything in Quick Insight, plus</strong>
                            {p.id === 'professional_review' ? ': a detailed review by an estate agent actively selling similar properties in the local area.' : ':'}
                          </div>
                        )}
                        {p.features.map((feat, j) => (
                          <div key={j} style={{ display: 'flex', alignItems: p.id === 'professional_review' && feat.includes('"') ? 'flex-start' : 'center', gap: 8, alignSelf: 'stretch' }}>
                            <VerifyIcon />
                            <div style={{ flex: '1 0 0', fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 14, color: '#050405', lineHeight: '120%', letterSpacing: '-0.42px' }}>
                              {feat}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Turnaround + Price + CTA */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32, alignSelf: 'stretch' }}>
                    <div style={{ display: 'flex', padding: 12, flexDirection: 'column', alignItems: 'flex-start', gap: 12, borderRadius: 10, background: '#FAEBFE', alignSelf: 'stretch' }}>
                      <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14, color: '#602ED3', lineHeight: '130%', letterSpacing: '-0.28px', alignSelf: 'stretch' }}>
                        {p.turnaround}
                      </div>
                    </div>
                    <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 24, color: '#000', lineHeight: '120%', letterSpacing: '-0.72px' }}>
                      {p.priceLabel}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedPlan(p.id); }}
                      style={{ display: 'flex', height: 44, padding: 8, justifyContent: 'center', alignItems: 'center', gap: 8, alignSelf: 'stretch', borderRadius: 10, border: 'none', cursor: 'pointer', ...p.btnStyle }}
                    >
                      <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 16, letterSpacing: '-0.32px', lineHeight: '100%' }}>
                        Start Assessment
                      </span>
                      {isSelected && p.bestValue && <CheckIcon />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Contact form */}
          <div style={{ marginTop: 40, background: '#fff', borderRadius: 24, border: '1px solid rgba(0,0,0,0.08)', padding: 32, maxWidth: 600 }}>
            <h3 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 700, fontSize: 18, color: '#000', margin: '0 0 6px' }}>Your details</h3>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#666', margin: '0 0 24px' }}>We'll send your report to this email address.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              {[
                { key: 'first_name', label: 'First name', placeholder: 'Jane' },
                { key: 'last_name', label: 'Last name', placeholder: 'Smith' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 500, color: '#444', marginBottom: 6 }}>{f.label}</label>
                  <input
                    type="text"
                    value={(form as Record<string, string>)[f.key]}
                    onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #E0E0E0', borderRadius: 8, padding: '10px 14px', fontFamily: 'Inter, sans-serif', fontSize: 14, outline: 'none' }}
                  />
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 500, color: '#444', marginBottom: 6 }}>Email address</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="jane@email.com"
                style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #E0E0E0', borderRadius: 8, padding: '10px 14px', fontFamily: 'Inter, sans-serif', fontSize: 14, outline: 'none' }}
              />
            </div>
            <div style={{ marginBottom: 0 }}>
              <label style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 500, color: '#444', marginBottom: 6 }}>Phone number</label>
              <div style={{ display: 'flex', gap: 10 }}>
                <select
                  value={form.phone_country_code}
                  onChange={e => setForm({ ...form, phone_country_code: e.target.value })}
                  style={{ border: '1px solid #E0E0E0', borderRadius: 8, padding: '10px 10px', fontFamily: 'Inter, sans-serif', fontSize: 14, background: '#fff', outline: 'none' }}
                >
                  {COUNTRY_CODES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="07700 000000"
                  style={{ flex: 1, border: '1px solid #E0E0E0', borderRadius: 8, padding: '10px 14px', fontFamily: 'Inter, sans-serif', fontSize: 14, outline: 'none' }}
                />
              </div>
            </div>
          </div>

          {/* Order summary */}
          <div style={{ marginTop: 40, maxWidth: 960 }}>
            <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 10, color: '#666', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 12 }}>ORDER SUMMARY</div>
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden' }}>
              {[
                { label: 'Plan', value: plan.name },
                { label: 'Property', value: propertyLabel.length > 40 ? propertyLabel.slice(0, 40) + '…' : propertyLabel },
                { label: 'Turnaround', value: turnaroundLabel },
                { label: 'Total', value: plan.price },
              ].map((row, i, arr) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '16px 24px',
                  borderBottom: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 14, color: '#666' }}>{row.label}</span>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14, color: '#000' }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ marginTop: 20, background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10, padding: '12px 16px', fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#DC2626', maxWidth: 960 }}>
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="sl-plan-bottom" style={{
        position: 'sticky', bottom: 0, background: '#fff',
        borderTop: '1px solid rgba(0,0,0,0.08)',
        padding: '20px 56px',
        display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16,
        boxSizing: 'border-box',
        zIndex: 20,
      }}>
        <button
          onClick={() => navigate('/stale-listings/questions')}
          style={{ display: 'flex', height: 52, padding: '16px 32px', justifyContent: 'center', alignItems: 'center', gap: 8, borderRadius: 10, border: '1px solid rgba(0,0,0,0.15)', background: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 16, color: '#000', cursor: 'pointer', letterSpacing: '-0.32px' }}
        >
          Back to Questions
        </button>
        <button
          onClick={handlePay}
          disabled={loading}
          style={{ display: 'flex', height: 52, padding: '16px 32px', justifyContent: 'center', alignItems: 'center', gap: 8, borderRadius: 10, background: loading ? '#888' : '#000', border: 'none', fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 16, color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '-0.32px' }}
        >
          {loading ? 'Processing…' : 'Pay Securely and start Assessment'}
        </button>
      </div>
    </div>
  );
}
