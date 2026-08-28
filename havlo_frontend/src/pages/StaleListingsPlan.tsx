import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { CountryCodeSelect } from '../components/shared/CountryCodeSelect';
import { StaleListingsLogo } from '../components/shared/StaleListingsLogo';
import { Footer } from '../components/shared/Footer';
import { usePageMeta } from '../hooks/usePageMeta';
import { staleListingsPlanParams, trackMetaPixelEvent } from '../lib/metaPixel';

const PURPLE = '#A409D2';
const TEAL = '#006163';

/* ─── ICONS ─── */
const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 7V5C4 2.79086 5.79086 1 8 1C10.2091 1 12 2.79086 12 5V7M3.2 15H12.8C13.4627 15 14 14.4627 14 13.8V8.2C14 7.53726 13.4627 7 12.8 7H3.2C2.53726 7 2 7.53726 2 8.2V13.8C2 14.4627 2.53726 15 3.2 15Z" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CheckIcon = ({ color = '#000' }: { color?: string }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <path d="M10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2ZM14.0667 7.86667L9.26667 12.6667L9.06667 12.8667C8.93333 12.9333 8.8 13 8.66667 13C8.53333 13 8.4 12.9333 8.26667 12.8667L5.93333 10.5333C5.66667 10.2667 5.66667 9.86667 5.93333 9.6C6.2 9.33333 6.6 9.33333 6.86667 9.6L8.66667 11.4L13.2 6.86667C13.4667 6.6 13.8667 6.6 14.1333 6.86667C14.4 7.13333 14.3333 7.6 14.0667 7.86667Z" fill={color}/>
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
    preNote: 'Includes everything in Quick Insight, plus an in-depth assessment from a panel of experienced estate agents currently selling properties similar to yours in the local market.',
    features: [
      'Buyer appeal analysis',
      'Listing photography & description review',
      'Local competition benchmarking',
      'Why buyers may be overlooking this property section',
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

const AGENT_PLAN = {
  id: 'listing_recovery_assessment' as const,
  name: 'Listing Recovery Assessment',
  price: '£149.99',
  amount: 149.99,
  tagline: 'For individual stale listings.',
  turnaround: 'Delivered within 5 working days',
  priceLabel: '£149.99 per report',
  preNote: null as string | null,
  features: [
    'Full Listing Recovery Report',
    'Pricing review',
    'Photography review',
    'Listing copy review',
    'Competitive analysis',
    'Recovery recommendations',
  ],
  Illustration: GoldHouseIllustration,
  bestValue: false,
  btnBg: '#000',
  btnColor: '#fff',
  btnGold: false,
  borderColor: '1.5px solid #E8E8E8',
  selectedBorderColor: '2px solid #000',
};

const FREE_PLAN = {
  id: 'free_trial_assessment' as const,
  name: 'Free Trial Assessment',
  price: '£0',
  amount: 0,
  tagline: 'For first-time agencies.',
  turnaround: 'Delivered within 5 working days',
  priceLabel: 'Free',
  preNote: null as string | null,
  features: [
    'Listing review',
    'Pricing analysis',
    'Photography review',
    'Market positioning assessment',
    'Recovery recommendations',
  ],
  Illustration: BlueHouseIllustration,
  bestValue: false,
  btnBg: '#000',
  btnColor: '#fff',
  btnGold: false,
  borderColor: '1.5px solid #E8E8E8',
  selectedBorderColor: '2px solid #000',
};

type PlanId = 'quick_insight' | 'professional_review' | 'premium_strategy' | 'listing_recovery_assessment' | 'free_trial_assessment';

/* ─── STEPPER ─── */
function Stepper({ activeStep }: { activeStep: 1 | 2 | 3 }) {
  const steps = [
    { num: 1, label: 'Your property' },
    { num: 2, label: 'Choose Plan' },
    { num: 3, label: 'Completed' },
  ];
  return (
    <div className="sl-p-stepper-scroll" style={{ background: '#fff', borderBottom: '1px solid #F4F4F4', overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any }}>
      <div className="sl-p-stepper-inner" style={{ margin: '0 auto', display: 'flex', justifyContent: 'center', alignItems: 'center', minWidth: 'max-content' }}>
        {steps.map((step, i) => {
          const isActive = step.num === activeStep;
          const isDone = step.num < activeStep;
          const isInactive = step.num > activeStep;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: (isActive || isDone) ? PURPLE : 'transparent',
                  border: isInactive ? '2px solid #D0D0D0' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14, color: (isActive || isDone) ? '#fff' : '#B0B0B0' }}>{step.num}</span>
                </div>
                <span className="sl-p-step-label" style={{ fontFamily: 'Inter, sans-serif', fontWeight: isActive ? 600 : 400, fontSize: 14, color: isActive ? '#000' : '#B0B0B0', whiteSpace: 'nowrap' }}>{step.label}</span>
              </div>
              {i < 2 && <div className="sl-p-step-line" style={{ height: 1, background: '#E0E0E0', flexShrink: 0 }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── NAVBAR ─── */
function PlanNavbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  return (
    <header style={{ display: 'flex', width: '100%', height: 72, padding: '0 40px', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F0F0F0', background: '#FFF', boxSizing: 'border-box', position: 'sticky', top: 0, zIndex: 30 }}>
      <StaleListingsLogo style={{ height: 38, width: 'auto', display: 'block', flexShrink: 0 }} />
      {/* Desktop: secure badge */}
      <div className="sl-p-secure-wrap" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <LockIcon />
        <span className="sl-p-secure-text" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 15, color: '#000', letterSpacing: '-0.2px' }}>Secure assessment · SSL encrypted</span>
      </div>
      {/* Mobile: hamburger */}
      <button className="sl-p-hamburger" onClick={onOpenMenu} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, alignItems: 'center', justifyContent: 'center', display: 'none' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 6H21M3 12H21M3 18H21" stroke="#1F1F1E" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>
    </header>
  );
}

/* ─── MAIN COMPONENT ─── */
export function StaleListingsPlan() {
  usePageMeta({
    title: 'Choose Your Property Review Plan | Havlo',
    description: 'Select your property review plan. Stale Listings by Havlo offers expert assessment packages with scored feedback and a clear action plan to help your home sell.',
    canonical: 'https://www.heyhavlo.com/stale-listings/plan',
  });
  const navigate = useNavigate();
  const isAgentFlow = sessionStorage.getItem('sl_agent_flow') === 'true';
  const isFreePlan = sessionStorage.getItem('sl_free_plan') === 'true';
  const visiblePlans = isAgentFlow ? [FREE_PLAN, AGENT_PLAN] : PLANS;
  const [selectedPlan, setSelectedPlan] = useState<PlanId>(
    isFreePlan ? 'free_trial_assessment' : isAgentFlow ? 'listing_recovery_assessment' : 'professional_review'
  );
  const [menuOpen, setMenuOpen] = useState(false);
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
  const [promoCode, setPromoCode] = useState('');
  const [promoVerified, setPromoVerified] = useState(false);
  const [promoChecking, setPromoChecking] = useState(false);
  const [promoError, setPromoError] = useState('');

  const plan = visiblePlans.find(p => p.id === selectedPlan)!

  const address = sessionStorage.getItem('sl_address') || '';
  const listingUrl = sessionStorage.getItem('sl_listing_url') || '';
  const propertyLabel = address || listingUrl || 'Your listed property';
  const propertyDisplay = propertyLabel.length > 45 ? propertyLabel.slice(0, 45) + '…' : propertyLabel;

  const turnaroundLabel = selectedPlan === 'quick_insight' ? '24–48 hours'
    : selectedPlan === 'professional_review' ? '24 hours (priority)'
    : selectedPlan === 'listing_recovery_assessment' ? 'Within 5 working days'
    : selectedPlan === 'free_trial_assessment' ? 'Within 5 working days'
    : '24 hours + follow-up support';

  const handleVerifyPromo = async () => {
    if (!promoCode.trim()) {
      setPromoError('Please enter a promo code.');
      return;
    }
    setPromoChecking(true);
    setPromoError('');
    try {
      const result = await api.staleListingsVerifyPromo({ code: promoCode.trim(), package: selectedPlan });
      if (result.valid) {
        setPromoVerified(true);
        setPromoError('');
      } else {
        setPromoVerified(false);
        setPromoError(result.message || 'That promo code is not valid.');
      }
    } catch (err: unknown) {
      setPromoVerified(false);
      setPromoError(err instanceof Error ? err.message : 'Unable to verify promo code right now.');
    } finally {
      setPromoChecking(false);
    }
  };

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
    sessionStorage.setItem('sl_selected_plan', selectedPlan);
    if (selectedPlan !== 'free_trial_assessment') {
      trackMetaPixelEvent('AddToCart', {
        ...staleListingsPlanParams(selectedPlan),
        property_input_type: listingUrl ? 'listing_url' : address ? 'property_address' : 'unknown',
      }, `stale_add_to_cart_${selectedPlan}_${Date.now()}`);
    }
    try {
      const result = await api.staleListingsSubmit({
        ...form,
        package: selectedPlan,
        property_address: address || undefined,
        listing_url: listingUrl || undefined,
        questions_data: answers,
        redirect_url: `${window.location.origin}/stale-listings/complete`,
        promo_code: promoVerified ? promoCode.trim() : undefined,
      });
      if (selectedPlan === 'free_trial_assessment' || result.amount === 0) {
        sessionStorage.removeItem('sl_free_plan');
        navigate(`/stale-listings/complete?ref=${result.reference}`);
        return;
      }
      const checkoutUrl = result.checkout_url?.trim();
      if (!checkoutUrl) {
        throw new Error('Unable to create a secure SumUp checkout right now. Please try again in a moment.');
      }
      window.location.href = checkoutUrl;
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
    if (menuOpen || showOrderSheet || showFormModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen, showOrderSheet, showFormModal]);

  const orderRows = [
    { label: 'Plan', value: plan.name },
    { label: 'Property', value: propertyDisplay },
    { label: 'Turnaround', value: turnaroundLabel },
    { label: 'Total', value: plan.price },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#F6F6F6', fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800&family=Inter:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; }

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
          transition: box-shadow 0.18s, transform 0.18s, border-color 0.18s;
        }
        .sl-p-card:hover {
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
        }
        .sl-p-card.is-selected {
          box-shadow: 0 14px 30px rgba(0,0,0,0.10), 0 0 0 4px rgba(164, 9, 210, 0.10);
          transform: translateY(-2px);
        }
        .sl-p-selected-pill {
          position: absolute;
          top: 20px;
          left: 20px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 30px;
          padding: 0 12px;
          border-radius: 999px;
          background: #111111;
          color: #FFFFFF;
          font-family: Inter, sans-serif;
          font-weight: 700;
          font-size: 11px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .sl-p-bottom-bar {
          display: none;
        }
        .sl-p-mobile-exit {
          display: none;
        }
        .sl-p-drawer-backdrop {
          position: fixed;
          top: var(--app-viewport-offset-top, 0px);
          left: var(--app-viewport-offset-left, 0px);
          width: 100vw;
          height: var(--app-viewport-height, 100vh);
          background: rgba(0, 0, 0, 0.42);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.25s ease;
          z-index: 81;
        }
        .sl-p-drawer-backdrop.is-open {
          opacity: 1;
          pointer-events: auto;
        }
        .sl-p-drawer {
          position: fixed;
          top: var(--app-viewport-offset-top, 0px);
          right: 0;
          width: min(280px, 82vw);
          height: var(--app-viewport-height, 100vh);
          background: #FFFFFF;
          box-shadow: -8px 0 24px rgba(0, 0, 0, 0.12);
          transform: translateX(100%);
          transition: transform 0.28s ease;
          z-index: 82;
          padding: 22px 24px 36px;
          display: flex;
          flex-direction: column;
        }
        .sl-p-drawer.is-open {
          transform: translateX(0);
        }
        .sl-p-drawer-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 32px;
        }
        .sl-p-drawer-links {
          display: flex;
          flex-direction: column;
        }
        .sl-p-drawer-link {
          border: 0;
          border-bottom: 1px solid rgba(0, 0, 0, 0.08);
          background: transparent;
          color: #1A1A1A;
          font-family: Inter, sans-serif;
          font-size: 17px;
          font-weight: 600;
          text-align: left;
          padding: 14px 0;
          cursor: pointer;
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
          .sl-p-cards {
            flex-direction: column !important;
            max-width: 480px;
            margin: 0 auto;
            width: 100%;
          }
          .sl-p-card {
            flex: none !important;
            width: 100% !important;
            box-sizing: border-box !important;
          }
        }
        @media (max-width: 640px) {
          .sl-p-content { padding: 28px 16px 100px; }
          .sl-p-cards {
            flex-direction: column !important;
            max-width: 100% !important;
            width: 100% !important;
            gap: 20px !important;
          }
          .sl-p-card {
            flex: none !important;
            width: 100% !important;
            box-sizing: border-box !important;
            border-radius: 24px !important;
          }
          .sl-p-bottom-bar {
            display: flex;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: #fff;
            border-top: 1px solid #EBEBEB;
            padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
            gap: 10px;
            z-index: 20;
            box-sizing: border-box;
            align-items: stretch;
          }
          .sl-p-back-btn {
            flex: 0 0 auto;
            min-width: 112px;
            padding: 0 14px;
            font-size: 14px;
          }
          .sl-p-pay-btn {
            flex: 1 1 auto;
            min-width: 0;
            min-height: 54px;
            height: auto;
            padding: 10px 14px;
            font-size: 14px;
            line-height: 1.2;
            white-space: normal;
            text-align: center;
          }
          .sl-p-secure-wrap { display: none !important; }
          .sl-p-hamburger { display: flex !important; }
          .sl-p-order-summary { display: none; }
          .sl-form-box { padding: 28px 20px; }
          .sl-p-mobile-exit {
            display: inline-flex !important;
            align-items: center;
            gap: 8px;
            margin: 0 0 18px;
            padding: 0;
            border: 0;
            background: transparent;
            color: #4A4A4A;
            font-family: Inter, sans-serif;
            font-size: 16px;
            font-weight: 600;
            letter-spacing: -0.02em;
            cursor: pointer;
          }
        }

        /* Stepper base styles */
        .sl-p-stepper-scroll { scrollbar-width: none; -ms-overflow-style: none; }
        .sl-p-stepper-scroll::-webkit-scrollbar { display: none; }
        .sl-p-stepper-inner { padding: 20px 56px; }
        .sl-p-step-label { display: inline; }
        .sl-p-step-line { width: 80px; margin: 0 20px; }

        @media (max-width: 768px) {
          .sl-p-step-line { width: 24px !important; margin: 0 8px !important; }
          .sl-p-stepper-inner { padding: 14px 20px !important; }
        }
      `}</style>

      <PlanNavbar onOpenMenu={() => setMenuOpen(true)} />
      <Stepper activeStep={2} />
      <div className={`sl-p-drawer-backdrop${menuOpen ? ' is-open' : ''}`} onClick={() => setMenuOpen(false)} />
      <aside className={`sl-p-drawer${menuOpen ? ' is-open' : ''}`}>
        <div className="sl-p-drawer-top">
          <StaleListingsLogo style={{ height: 34, width: 'auto', display: 'block' }} />
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            style={{ border: 0, background: 'transparent', padding: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            aria-label="Close navigation menu"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="sl-p-drawer-links">
          {[
            { label: 'Back to Stale Listings', href: '/stale-listings' },
            { label: 'How it works', href: '/stale-listings#how-it-works' },
            { label: 'FAQ', href: '/stale-listings#faq' },
            { label: 'Pricing', href: '/stale-listings#pricing' },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              className="sl-p-drawer-link"
              onClick={() => {
                setMenuOpen(false);
                window.location.href = item.href;
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="sl-p-content">
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <button
            type="button"
            className="sl-p-mobile-exit"
            onClick={() => navigate('/stale-listings')}
          >
            <span aria-hidden="true">←</span>
            <span>Back to Stale Listings</span>
          </button>

          {/* Page header */}
          <div style={{ marginBottom: 36 }}>
            <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 13, color: PURPLE, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 10 }}>
              ALMOST THERE
            </div>
            <h1 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: 30, color: '#0A0A0A', letterSpacing: '-0.5px', margin: '0 0 10px', lineHeight: '1.2' }}>
              {isAgentFlow ? 'Your Listing Recovery Assessment' : 'Choose your assessment plan'}
            </h1>
            <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 15, color: '#555', lineHeight: '1.5', margin: 0, maxWidth: 480 }}>
              {isAgentFlow
                ? 'A structured report showing what\'s holding the listing back, where buyer interest breaks down, and the highest-priority actions to take.'
                : 'Find out why buyers might be overlooking your property and get a personalised roadmap to improve visibility, pricing and buyer interest.'}
            </p>
          </div>

          {/* Plan cards */}
          <div className="sl-p-cards">
            {visiblePlans.map((p) => {
              const isSelected = selectedPlan === p.id;
              const border = isSelected ? p.selectedBorderColor : p.borderColor;
              return (
                <div
                  key={p.id}
                  className={`sl-p-card${isSelected ? ' is-selected' : ''}`}
                  onClick={() => setSelectedPlan(p.id)}
                  style={{ border }}
                >
                  {isSelected && (
                    <div className="sl-p-selected-pill">
                      <CheckIcon color="#FFFFFF" />
                      Selected
                    </div>
                  )}
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
                            <span style={{ fontWeight: p.id === 'professional_review' ? 400 : 700, color: '#050405' }}>
                              {p.preNote}
                            </span>
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
                      {isSelected ? 'Selected plan' : 'Start Assessment'}
                      {isSelected ? <CheckIcon color={p.btnGold ? '#000000' : '#FFFFFF'} /> : null}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Order summary — hidden on mobile via CSS */}
          <div className="sl-p-order-summary" style={{ marginTop: 44, marginBottom: 48 }}>
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E8E8E8' }}>

              {/* ORDER SUMMARY label — plain text, top-left, no own border row */}
              <div style={{ padding: '20px 24px 16px 24px' }}>
                <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 11, color: '#999', letterSpacing: '2px', textTransform: 'uppercase' }}>
                  ORDER SUMMARY
                </span>
              </div>


              {/* Data rows */}
              {orderRows.map((row, i, arr) => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '20px 24px',
                  borderTop: i === arr.length - 1 ? '1px solid #F0F0F0' : 'none',
                }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 14, color: '#555' }}>{row.label}</span>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14, color: '#000' }}>{row.value}</span>
                </div>
              ))}

              {/* Buttons — right-aligned */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, padding: '20px 24px' }}>
                <button
                  onClick={() => navigate('/stale-listings/questions')}
                  style={{ height: 48, padding: '0 24px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.18)', background: '#fff', fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 15, color: '#000', cursor: 'pointer', letterSpacing: '-0.2px', whiteSpace: 'nowrap' }}
                >
                  Back to Questions
                </button>
                <button
                  onClick={handlePayClick}
                  style={{ height: 48, padding: '0 24px', borderRadius: 8, border: 'none', background: '#000', fontFamily: 'Inter, sans-serif', fontWeight: 500, fontSize: 15, color: '#fff', cursor: 'pointer', letterSpacing: '-0.2px', whiteSpace: 'nowrap' }}
                >
                  {selectedPlan === 'free_trial_assessment' ? 'Submit Free Listing' : 'Pay Securely and start Assessment'}
                </button>
              </div>

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
          {selectedPlan === 'free_trial_assessment' ? 'Submit Free Listing' : 'Pay Securely and start Assessment'}
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
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ border: '1px solid #E0E0E0', borderRadius: 8, padding: '5px 8px', background: '#fff', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CountryCodeSelect
                    value={form.phone_country_code}
                    onChange={c => setForm({ ...form, phone_country_code: c })}
                    buttonClassName="h-9 bg-gray-100 hover:bg-gray-200"
                  />
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#555', minWidth: 32 }}>{form.phone_country_code}</span>
                </div>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="07700 000000"
                  style={{ flex: 1, border: '1px solid #E0E0E0', borderRadius: 8, padding: '10px 14px', fontFamily: 'Inter, sans-serif', fontSize: 14, outline: 'none' }}
                />
              </div>
            </div>

            {/* Promo code */}
            {selectedPlan === 'listing_recovery_assessment' && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 500, color: '#444', marginBottom: 6 }}>Promo code (optional)</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    type="text"
                    value={promoCode}
                    onChange={e => {
                      setPromoCode(e.target.value);
                      setPromoVerified(false);
                      setPromoError('');
                    }}
                    disabled={promoVerified}
                    placeholder="Enter promo code"
                    style={{ flex: 1, border: promoVerified ? '1px solid #22C55E' : '1px solid #E0E0E0', borderRadius: 8, padding: '10px 14px', fontFamily: 'Inter, sans-serif', fontSize: 14, outline: 'none', background: promoVerified ? '#F0FDF4' : '#fff' }}
                  />
                  <button
                    type="button"
                    onClick={handleVerifyPromo}
                    disabled={promoChecking || promoVerified || !promoCode.trim()}
                    style={{
                      flexShrink: 0,
                      padding: '0 18px',
                      borderRadius: 8,
                      border: '1px solid #000',
                      background: promoVerified ? '#22C55E' : '#fff',
                      color: promoVerified ? '#fff' : '#000',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: promoChecking || promoVerified || !promoCode.trim() ? 'default' : 'pointer',
                      opacity: promoChecking ? 0.6 : 1,
                    }}
                  >
                    {promoVerified ? 'Applied' : promoChecking ? 'Checking…' : 'Verify'}
                  </button>
                </div>
                {promoError && (
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#DC2626', marginTop: 6 }}>{promoError}</div>
                )}
                {promoVerified && (
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#16A34A', marginTop: 6 }}>Promo code applied — this plan is now free.</div>
                )}
              </div>
            )}

            {/* Mini order summary */}
            <div style={{ background: '#F8F8F8', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#666' }}>Plan</span>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 700, color: '#000' }}>{plan.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#666' }}>Total</span>
                {promoVerified ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#999', textDecoration: 'line-through' }}>{plan.price}</span>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 700, color: '#16A34A' }}>Free</span>
                  </span>
                ) : (
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 700, color: '#000' }}>{plan.price}</span>
                )}
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
              {loading ? 'Processing…' : selectedPlan === 'free_trial_assessment' || promoVerified ? 'Submit Free Listing' : 'Pay Securely and start Assessment'}
            </button>
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
}
