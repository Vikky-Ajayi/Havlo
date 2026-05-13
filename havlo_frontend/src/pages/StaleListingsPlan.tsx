import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

const PURPLE = '#A409D2';
const TEAL = '#006163';
const COUNTRY_CODES = ['+44', '+1', '+971', '+65', '+852', '+61', '+49', '+33'];

/* ─── ICONS ─── */
const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 7V5C4 2.79086 5.79086 1 8 1C10.2091 1 12 2.79086 12 5V7M3.2 15H12.8C13.4627 15 14 14.4627 14 13.8V8.2C14 7.53726 13.4627 7 12.8 7H3.2C2.53726 7 2 7.53726 2 8.2V13.8C2 14.4627 2.53726 15 3.2 15Z" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <path d="M10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2ZM14.0667 7.86667L9.26667 12.6667L9.06667 12.8667C8.93333 12.9333 8.8 13 8.66667 13C8.53333 13 8.4 12.9333 8.26667 12.8667L5.93333 10.5333C5.66667 10.2667 5.66667 9.86667 5.93333 9.6C6.2 9.33333 6.6 9.33333 6.86667 9.6L8.66667 11.4L13.2 6.86667C13.4667 6.6 13.8667 6.6 14.1333 6.86667C14.4 7.13333 14.3333 7.6 14.0667 7.86667Z" fill="#000"/>
  </svg>
);

const VerifyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <path d="M14.3736 7.16036L13.4669 6.10703C13.2936 5.90703 13.1536 5.5337 13.1536 5.26703V4.1337C13.1536 3.42703 12.5736 2.84703 11.8669 2.84703H10.7336C10.4736 2.84703 10.0936 2.70703 9.89358 2.5337L8.84025 1.62703C8.38025 1.2337 7.62691 1.2337 7.16025 1.62703L6.11358 2.54036C5.91358 2.70703 5.53358 2.84703 5.27358 2.84703H4.12025C3.41358 2.84703 2.83358 3.42703 2.83358 4.1337V5.2737C2.83358 5.5337 2.69358 5.90703 2.52691 6.10703L1.62691 7.16703C1.24025 7.62703 1.24025 8.3737 1.62691 8.8337L2.52691 9.8937C2.69358 10.0937 2.83358 10.467 2.83358 10.727V11.867C2.83358 12.5737 3.41358 13.1537 4.12025 13.1537H5.27358C5.53358 13.1537 5.91358 13.2937 6.11358 13.467L7.16691 14.3737C7.62691 14.767 8.38025 14.767 8.84691 14.3737L9.90025 13.467C10.1002 13.2937 10.4736 13.1537 10.7402 13.1537H11.8736C12.5802 13.1537 13.1602 12.5737 13.1602 11.867V10.7337C13.1602 10.4737 13.3002 10.0937 13.4736 9.8937L14.3802 8.84036C14.7669 8.38036 14.7669 7.62036 14.3736 7.16036ZM10.7736 6.74036L7.55358 9.96036C7.46025 10.0537 7.33358 10.107 7.20025 10.107C7.06691 10.107 6.94025 10.0537 6.84691 9.96036L5.23358 8.34703C5.04025 8.1537 5.04025 7.8337 5.23358 7.64036C5.42691 7.44703 5.74691 7.44703 5.94025 7.64036L7.20025 8.90036L10.0669 6.0337C10.2602 5.84036 10.5802 5.84036 10.7736 6.0337C10.9669 6.22703 10.9669 6.54703 10.7736 6.74036Z" fill="#149D4F"/>
  </svg>
);

const CloseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 6L6 18M6 6L18 18" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

/* ─── HOUSE ILLUSTRATIONS ─── */
const BlueHouseIllustration = () => (
  <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 0' }}>
    <svg width="110" height="100" viewBox="0 0 110 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="55,8 102,42 8,42" fill="#6AABDF"/>
      <polygon points="55,14 98,42 12,42" fill="#5B9BD5"/>
      <rect x="12" y="42" width="86" height="50" fill="#4A7FC1"/>
      <rect x="41" y="58" width="28" height="34" fill="#2B5A9E"/>
      <rect x="17" y="50" width="20" height="17" fill="#87BCDE"/>
      <rect x="73" y="50" width="20" height="17" fill="#87BCDE"/>
      <rect x="17" y="54" width="20" height="1" fill="#6AABDF" opacity="0.5"/>
      <rect x="27" y="50" width="1" height="17" fill="#6AABDF" opacity="0.5"/>
      <rect x="73" y="54" width="20" height="1" fill="#6AABDF" opacity="0.5"/>
      <rect x="83" y="50" width="1" height="17" fill="#6AABDF" opacity="0.5"/>
      <circle cx="55" cy="75" r="3" fill="#1A3A6E"/>
      <rect x="50" y="92" width="10" height="2" rx="1" fill="#1A3A6E" opacity="0.3"/>
    </svg>
  </div>
);

const GoldHouseIllustration = () => (
  <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 0' }}>
    <svg width="110" height="100" viewBox="0 0 110 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="85" cy="20" r="6" fill="#FFE44D" opacity="0.7"/>
      <circle cx="94" cy="12" r="3.5" fill="#FFE44D" opacity="0.5"/>
      <circle cx="78" cy="13" r="2.5" fill="#FFE44D" opacity="0.5"/>
      <polygon points="55,8 102,42 8,42" fill="#FFD84D"/>
      <polygon points="55,14 98,42 12,42" fill="#F5C842"/>
      <rect x="12" y="42" width="86" height="50" fill="#EAA501"/>
      <rect x="41" y="58" width="28" height="34" fill="#C07800"/>
      <rect x="17" y="50" width="20" height="17" fill="#FFE085"/>
      <rect x="73" y="50" width="20" height="17" fill="#FFE085"/>
      <rect x="17" y="54" width="20" height="1" fill="#EAA501" opacity="0.5"/>
      <rect x="27" y="50" width="1" height="17" fill="#EAA501" opacity="0.5"/>
      <rect x="73" y="54" width="20" height="1" fill="#EAA501" opacity="0.5"/>
      <rect x="83" y="50" width="1" height="17" fill="#EAA501" opacity="0.5"/>
      <circle cx="55" cy="75" r="3" fill="#7A4800"/>
    </svg>
  </div>
);

const TealHouseIllustration = () => (
  <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 0' }}>
    <svg width="110" height="100" viewBox="0 0 110 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="85" cy="18" r="5" fill="#FFE44D" opacity="0.7"/>
      <circle cx="93" cy="11" r="3" fill="#FFE44D" opacity="0.5"/>
      <circle cx="78" cy="11" r="2" fill="#FFE44D" opacity="0.5"/>
      <polygon points="55,8 102,42 8,42" fill="#3DCCCC"/>
      <polygon points="55,14 98,42 12,42" fill="#26B5B5"/>
      <rect x="12" y="42" width="86" height="50" fill="#1A9A9A"/>
      <rect x="41" y="58" width="28" height="34" fill="#0D7070"/>
      <rect x="17" y="50" width="20" height="17" fill="#6DDDDD"/>
      <rect x="73" y="50" width="20" height="17" fill="#6DDDDD"/>
      <rect x="17" y="54" width="20" height="1" fill="#0D7070" opacity="0.5"/>
      <rect x="27" y="50" width="1" height="17" fill="#0D7070" opacity="0.5"/>
      <rect x="73" y="54" width="20" height="1" fill="#0D7070" opacity="0.5"/>
      <rect x="83" y="50" width="1" height="17" fill="#0D7070" opacity="0.5"/>
      <circle cx="55" cy="75" r="3" fill="#014040"/>
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
    preNote: null as string | null,
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
    btnBg: '#000',
    btnColor: '#fff',
    btnGold: false,
    borderColor: '1.5px solid #E8E8E8',
    selectedBorderColor: '2px solid #000',
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
    btnBg: '#EAA501',
    btnColor: '#000',
    btnGold: true,
    borderColor: '2px solid ' + TEAL,
    selectedBorderColor: '2px solid ' + TEAL,
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
    btnBg: '#000',
    btnColor: '#fff',
    btnGold: false,
    borderColor: '1.5px solid #E8E8E8',
    selectedBorderColor: '2px solid #000',
  },
];

type PlanId = 'quick_insight' | 'professional_review' | 'premium_strategy';

/* ─── STEPPER ─── */
function Stepper({ activeStep }: { activeStep: 1 | 2 | 3 }) {
  const steps = [
    { num: 1, label: 'Your property' },
    { num: 2, label: 'Choose Plan' },
    { num: 3, label: 'Completed' },
  ];
  return (
    <div style={{ background: '#fff', borderBottom: '1px solid #F0F0F0' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px', height: 64, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0 }}>
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
                  <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14, color: (isActive || isDone) ? '#fff' : '#B0B0B0' }}>{step.num}</span>
                </div>
                <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: isActive ? 600 : 400, fontSize: 15, color: isActive ? '#000' : isInactive ? '#B0B0B0' : '#555' }}>{step.label}</span>
              </div>
              {i < 2 && (
                <div style={{ width: 72, height: 1, background: '#E0E0E0', margin: '0 18px' }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── NAVBAR ─── */
function PlanNavbar() {
  return (
    <header style={{ display: 'flex', width: '100%', height: 72, padding: '0 40px', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F0F0F0', background: '#FFF', boxSizing: 'border-box', position: 'sticky', top: 0, zIndex: 30 }}>
      <img src="/stale-logo.png" alt="StaleListings" style={{ height: 38, width: 'auto', display: 'block', flexShrink: 0 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <LockIcon />
        <span className="sl-p-secure-text" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 15, color: '#000', letterSpacing: '-0.2px' }}>Secure assessment · SSL encrypted</span>
      </div>
    </header>
  );
}

/* ─── MAIN COMPONENT ─── */
export function StaleListingsPlan() {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('professional_review');
  const [showOrderSheet, setShowOrderSheet] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
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

  const address = sessionStorage.getItem('sl_address') || '';
  const listingUrl = sessionStorage.getItem('sl_listing_url') || '';
  const propertyLabel = address || listingUrl || 'Your listed property';
  const propertyDisplay = propertyLabel.length > 45 ? propertyLabel.slice(0, 45) + '…' : propertyLabel;

  const turnaroundLabel = selectedPlan === 'quick_insight' ? '24–48 hours'
    : selectedPlan === 'professional_review' ? '24 hours (priority)'
    : '24 hours + follow-up support';

  const handlePaySubmit = async () => {
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

  const handlePayClick = () => {
    if (window.innerWidth <= 640) {
      setShowOrderSheet(true);
    } else {
      setShowFormModal(true);
    }
  };

  useEffect(() => {
    if (showOrderSheet || showFormModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showOrderSheet, showFormModal]);

  const orderRows = [
    { label: 'Plan', value: plan.name },
    { label: 'Property', value: propertyDisplay },
    { label: 'Turnaround', value: turnaroundLabel },
    { label: 'Total', value: plan.price },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#F6F6F6', fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800&family=Inter:wght@400;500;600;700&display=swap');

        .sl-p-cards {
          display: flex;
          flex-direction: row;
          gap: 16px;
          align-items: stretch;
          width: 100%;
        }
        .sl-p-card {
          flex: 1 0 0;
          background: #fff;
          border-radius: 32px;
          padding: 24px;
          cursor: pointer;
          box-sizing: border-box;
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 32px;
          transition: box-shadow 0.15s;
        }
        .sl-p-card:hover {
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
        }
        .sl-p-bottom-bar {
          position: sticky;
          bottom: 0;
          background: #fff;
          border-top: 1px solid #EBEBEB;
          padding: 16px 40px;
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 12px;
          box-sizing: border-box;
          z-index: 20;
        }
        .sl-p-back-btn {
          height: 50px;
          padding: 0 28px;
          border-radius: 8px;
          border: 1px solid rgba(0,0,0,0.20);
          background: #fff;
          font-family: Inter, sans-serif;
          font-weight: 500;
          font-size: 15px;
          color: #000;
          cursor: pointer;
          letter-spacing: -0.2px;
          white-space: nowrap;
        }
        .sl-p-pay-btn {
          height: 50px;
          padding: 0 28px;
          border-radius: 8px;
          border: none;
          background: #000;
          font-family: Inter, sans-serif;
          font-weight: 500;
          font-size: 15px;
          color: #fff;
          cursor: pointer;
          letter-spacing: -0.2px;
          white-space: nowrap;
        }
        .sl-p-pay-btn:disabled {
          background: #888;
          cursor: not-allowed;
        }
        .sl-p-content {
          flex: 1;
          padding: 44px 40px 32px;
          box-sizing: border-box;
        }

        /* Mobile bottom sheet animation */
        .sl-order-sheet {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: #fff;
          border-radius: 20px 20px 0 0;
          padding: 28px 24px 36px;
          box-sizing: border-box;
          z-index: 100;
          animation: slideUp 0.28s cubic-bezier(0.32, 0.72, 0, 1);
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }

        /* Form modal */
        .sl-form-modal {
          position: fixed;
          inset: 0;
          z-index: 200;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          box-sizing: border-box;
        }
        .sl-form-box {
          background: #fff;
          border-radius: 20px;
          padding: 36px 32px;
          width: 100%;
          max-width: 500px;
          box-sizing: border-box;
          position: relative;
          max-height: 90vh;
          overflow-y: auto;
        }

        @media (max-width: 900px) {
          .sl-p-cards { grid-template-columns: 1fr; max-width: 480px; margin: 0 auto; width: 100%; }
        }
        @media (max-width: 640px) {
          .sl-p-content { padding: 28px 16px 24px; }
          .sl-p-bottom-bar { padding: 12px 16px; gap: 10px; }
          .sl-p-back-btn { display: none; }
          .sl-p-pay-btn { flex: 1; }
          .sl-p-secure-text { display: none; }
          .sl-p-order-summary { display: none; }
          .sl-form-box { padding: 28px 20px; }
        }
      `}</style>

      <PlanNavbar />
      <Stepper activeStep={2} />

      {/* ── MAIN CONTENT ── */}
      <div className="sl-p-content">
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>

          {/* Page header */}
          <div style={{ marginBottom: 36 }}>
            <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 13, color: PURPLE, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 10 }}>
              ALMOST THERE
            </div>
            <h1 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: 30, color: '#0A0A0A', letterSpacing: '-0.5px', margin: '0 0 10px', lineHeight: '1.2' }}>
              Choose your assessment plan
            </h1>
            <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 15, color: '#555', lineHeight: '1.5', margin: 0, maxWidth: 480 }}>
              Based on your answers, a property specialist will analyse your listing and prepare your personalised report.
            </p>
          </div>

          {/* Plan cards */}
          <div className="sl-p-cards">
            {PLANS.map((p) => {
              const isSelected = selectedPlan === p.id;
              const border = isSelected ? p.selectedBorderColor : p.borderColor;
              return (
                <div
                  key={p.id}
                  className="sl-p-card"
                  onClick={() => setSelectedPlan(p.id)}
                  style={{ border }}
                >
                  {/* BEST VALUE badge */}
                  {p.bestValue && (
                    <div style={{ position: 'absolute', top: 20, right: 20, background: '#E53935', color: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 11, letterSpacing: '0.5px', padding: '4px 10px', borderRadius: 20, textTransform: 'uppercase' }}>
                      BEST VALUE
                    </div>
                  )}

                  {/* ── TOP SECTION (grows to fill) ── */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
                    <p.Illustration />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 24, alignSelf: 'stretch' }}>
                      {/* Name + tagline */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignSelf: 'stretch' }}>
                        <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 24, color: '#000', letterSpacing: '-0.03em', lineHeight: '150%' }}>
                          {p.name}
                        </div>
                        <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 16, color: '#000', letterSpacing: '-0.03em', lineHeight: '120%' }}>
                          {p.tagline}
                        </div>
                      </div>
                      {/* Features */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 16, borderTop: '1px solid rgba(0,0,0,0.1)', alignSelf: 'stretch' }}>
                        {p.preNote && (
                          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, letterSpacing: '-0.03em', lineHeight: '130%' }}>
                            <span style={{ fontWeight: 700, color: '#050405' }}>
                              {p.id === 'professional_review'
                                ? 'Includes everything in Quick Insight, plus'
                                : 'Includes everything in professional review plus'}:
                            </span>
                            {p.id === 'professional_review' && (
                              <span style={{ fontWeight: 400, color: '#050405' }}> a detailed review by an estate agent actively selling similar properties in the local area.</span>
                            )}
                          </div>
                        )}
                        {p.features.map((feat, j) => (
                          <div key={j} style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                            <VerifyIcon />
                            <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 14, color: '#050405', letterSpacing: '-0.03em', lineHeight: '120%', flex: 1 }}>{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* ── BOTTOM SECTION (pinned to bottom) ── */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                    {/* Turnaround pill — full width, text centered */}
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 12px', borderRadius: 10, background: '#FAEBFE', alignSelf: 'stretch' }}>
                      <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14, color: '#602ED3', letterSpacing: '-0.02em', lineHeight: '130%' }}>
                        {p.turnaround}
                      </span>
                    </div>
                    {/* Price */}
                    <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 24, color: '#000', letterSpacing: '-0.03em', lineHeight: '120%', alignSelf: 'stretch', textAlign: 'center' }}>
                      {p.priceLabel}
                    </div>
                    {/* CTA button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedPlan(p.id); }}
                      style={{ display: 'flex', height: 44, padding: '8px', justifyContent: 'center', alignItems: 'center', gap: 8, borderRadius: 10, background: p.btnBg, color: p.btnColor, fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 16, letterSpacing: '-0.02em', border: 'none', cursor: 'pointer', alignSelf: 'stretch' }}
                    >
                      Start Assessment
                      {isSelected && p.btnGold && <CheckIcon />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Order summary — hidden on mobile via CSS */}
          <div className="sl-p-order-summary" style={{ marginTop: 44 }}>
            <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 11, color: '#888', letterSpacing: '1.8px', textTransform: 'uppercase', marginBottom: 10 }}>
              ORDER SUMMARY
            </div>
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #EBEBEB', overflow: 'hidden' }}>
              {orderRows.map((row, i) => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '18px 24px',
                  borderBottom: i < orderRows.length - 1 ? '1px solid #F0F0F0' : 'none',
                }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 14, color: '#666' }}>{row.label}</span>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14, color: '#000' }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── STICKY BOTTOM BAR ── */}
      <div className="sl-p-bottom-bar">
        <button className="sl-p-back-btn" onClick={() => navigate('/stale-listings/questions')}>
          Back to Questions
        </button>
        <button className="sl-p-pay-btn" onClick={handlePayClick}>
          Pay Securely and start Assessment
        </button>
      </div>

      {/* ── MOBILE ORDER SUMMARY BOTTOM SHEET ── */}
      {showOrderSheet && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowOrderSheet(false)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />
          <div className="sl-order-sheet" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13, color: '#888', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                ORDER SUMMARY
              </span>
              <button
                onClick={() => setShowOrderSheet(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <CloseIcon />
              </button>
            </div>

            {/* Rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 28 }}>
              {orderRows.map((row, i) => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 0',
                  borderBottom: i < orderRows.length - 1 ? '1px solid #F0F0F0' : 'none',
                }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 14, color: '#555' }}>{row.label}</span>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14, color: '#000', textAlign: 'right', maxWidth: '60%' }}>{row.value}</span>
                </div>
              ))}
            </div>

            {/* Buttons */}
            <button
              onClick={() => { setShowOrderSheet(false); setShowFormModal(true); }}
              style={{ width: '100%', height: 52, borderRadius: 10, border: 'none', background: '#000', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 16, color: '#fff', cursor: 'pointer', marginBottom: 12 }}
            >
              Pay Securely and start Assessment
            </button>
            <button
              onClick={() => { setShowOrderSheet(false); navigate('/stale-listings/questions'); }}
              style={{ width: '100%', height: 52, borderRadius: 10, border: '1px solid rgba(0,0,0,0.20)', background: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 16, color: '#000', cursor: 'pointer' }}
            >
              Back to Questions
            </button>
          </div>
        </div>
      )}

      {/* ── CONTACT FORM MODAL ── */}
      {showFormModal && (
        <div className="sl-form-modal" onClick={() => { if (!loading) setShowFormModal(false); }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
          <div className="sl-form-box" onClick={e => e.stopPropagation()}>
            {/* Close */}
            <button
              onClick={() => { if (!loading) setShowFormModal(false); }}
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}
            >
              <CloseIcon />
            </button>

            <h2 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: 22, color: '#0A0A0A', margin: '0 0 4px', letterSpacing: '-0.4px' }}>
              Your details
            </h2>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, color: '#666', margin: '0 0 24px' }}>
              We'll send your report to this email address.
            </p>

            {/* Name row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
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

            {/* Email */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 500, color: '#444', marginBottom: 6 }}>Email address</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="jane@email.com"
                style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #E0E0E0', borderRadius: 8, padding: '10px 14px', fontFamily: 'Inter, sans-serif', fontSize: 14, outline: 'none' }}
              />
            </div>

            {/* Phone */}
            <div style={{ marginBottom: 22 }}>
              <label style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 500, color: '#444', marginBottom: 6 }}>Phone number</label>
              <div style={{ display: 'flex', gap: 10 }}>
                <select
                  value={form.phone_country_code}
                  onChange={e => setForm({ ...form, phone_country_code: e.target.value })}
                  style={{ border: '1px solid #E0E0E0', borderRadius: 8, padding: '10px 10px', fontFamily: 'Inter, sans-serif', fontSize: 14, background: '#fff', outline: 'none', flexShrink: 0 }}
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

            {/* Mini order summary */}
            <div style={{ background: '#F8F8F8', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#666' }}>Plan</span>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 700, color: '#000' }}>{plan.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#666' }}>Total</span>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 700, color: '#000' }}>{plan.price}</span>
              </div>
            </div>

            {error && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 14px', fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#DC2626', marginBottom: 16 }}>
                {error}
              </div>
            )}

            <button
              onClick={handlePaySubmit}
              disabled={loading}
              style={{ width: '100%', height: 50, borderRadius: 8, border: 'none', background: loading ? '#888' : '#000', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 16, color: '#fff', cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              {loading ? 'Processing…' : 'Pay Securely and start Assessment'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
