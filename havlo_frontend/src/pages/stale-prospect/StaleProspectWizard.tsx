import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  confirmProspectProperty,
  createProspectCheckout,
  getProspectPaymentStatus,
  getProspectPreview,
  getProspectReport,
  lookupProspect,
  submitProspectDetails,
} from './api';
import {
  formatGbp,
  stepperIndexFor,
  unlockPrice,
  STEPPER_ITEMS,
  type FullReportData,
  type ProspectPreview,
  type ProspectReport,
  type WizardStep,
} from './types';

// ── Small shared bits ──────────────────────────────────────────────────────

const UkFlag = () => (
  <svg viewBox="0 0 60 30" className="slw-uk-flag" aria-hidden="true">
    <rect width="60" height="30" fill="#00247d" />
    <path d="M0 0L60 30M60 0L0 30" stroke="#fff" strokeWidth="6" />
    <path d="M0 0L60 30M60 0L0 30" stroke="#cf142b" strokeWidth="2" />
    <path d="M30 0V30M0 15H60" stroke="#fff" strokeWidth="10" />
    <path d="M30 0V30M0 15H60" stroke="#cf142b" strokeWidth="6" />
  </svg>
);

const HavloLogo = () => (
  <div className="slw-logo">
    <span className="slw-logo-mark">H&#7488;VLO</span>
    <span className="slw-logo-sub">StaleListings</span>
  </div>
);

const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="slw-header">
      <a href="/stale-listings" className="slw-logo-link"><HavloLogo /></a>
      <nav className="slw-nav slw-noprint">
        <a href="/stale-listings">How it works</a>
        <a href="/stale-listings">Faq</a>
        <a href="/stale-listings">Pricing</a>
      </nav>
      <button
        type="button"
        className="slw-burger slw-noprint"
        aria-label="Open menu"
        onClick={() => setMenuOpen((v) => !v)}
      >
        <span /><span /><span />
      </button>
      {menuOpen && (
        <nav className="slw-mobile-nav">
          <a href="/stale-listings">How it works</a>
          <a href="/stale-listings">Faq</a>
          <a href="/stale-listings">Pricing</a>
        </nav>
      )}
    </header>
  );
};

const Footer = () => (
  <footer className="slw-footer slw-noprint">
    <HavloLogo />
    <p>&copy; 2025 StaleListings. All rights reserved.</p>
    <div className="slw-footer-links">
      <a href="/privacy-policy">Privacy Policy</a>
      <a href="/terms">Terms</a>
    </div>
  </footer>
);

const GoBack = ({ onClick }: { onClick: () => void }) => (
  <button type="button" className="slw-goback slw-noprint" onClick={onClick}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 17l-5-5 5-5M6 12h12" />
    </svg>
    Go Back
  </button>
);

const Stepper = ({ step }: { step: WizardStep }) => {
  const activeIndex = stepperIndexFor(step);
  return (
    <div className="slw-stepper-wrap slw-noprint">
      <ol className="slw-stepper">
        {STEPPER_ITEMS.map((item, index) => (
          <li
            key={item.key}
            className={
              index === activeIndex ? 'slw-step-active' : index < activeIndex ? 'slw-step-done' : ''
            }
          >
            <span>{item.label}</span>
            {index < STEPPER_ITEMS.length - 1 && <i className="slw-step-sep" />}
          </li>
        ))}
      </ol>
    </div>
  );
};

const Spinner = () => <div className="slw-spinner" />;

// ── Step: Landing (Enter Property ID) ──────────────────────────────────────

const LandingStep = ({
  onSubmit,
  loading,
  error,
}: {
  onSubmit: (code: string) => void;
  loading: boolean;
  error: string;
}) => {
  const [code, setCode] = useState('');
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (code.trim()) onSubmit(code.trim());
  };
  return (
    <>
      <section className="slw-hero">
        <h1>
          Don&rsquo;t Let Your Home
          <br />
          Sit <span className="slw-accent">on the Market</span>
        </h1>
        <p className="slw-hero-copy">
          Havlo has analysed your property and identified factors that may be affecting its
          ability to sell. Enter the Property ID shown in your Havlo letter to view your
          assessment.
        </p>
        <form className="slw-id-form" onSubmit={handleSubmit}>
          <label className="slw-id-input">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
            <input
              type="text"
              placeholder="Enter property ID"
              value={code}
              maxLength={12}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <p className="slw-id-hint">
            <span className="slw-info-dot">i</span> Your Property ID can be found on the letter you received from Havlo.
          </p>
          {error && <p className="slw-error">{error}</p>}
          <button type="submit" className="slw-btn-black slw-id-submit" disabled={loading}>
            {loading ? 'Searching…' : 'Find My Property'}
          </button>
        </form>
        <div className="slw-stats">
          <div><b>10K+</b><span>Listings<br />Analyzed</span></div>
          <div><b>91K+</b><span>Seller<br />Recommendations</span></div>
          <div><b>300+</b><span>Market Signals<br />Analyzed</span></div>
        </div>
        <div className="slw-rating">
          <span>Excellent</span>
          <span className="slw-trustpilot-stars" aria-hidden="true">
            {Array.from({ length: 5 }).map((_, i) => <i key={i}>★</i>)}
          </span>
          <b>Based on verified customer feedback</b>
        </div>
      </section>
      <div className="slw-hero-image" />
      <section className="slw-value-section">
        <h2>
          Homes that sit too long lose
          <br />
          buyer attention. Yours doesn&rsquo;t
          <br />
          have to.
        </h2>
        <div className="slw-value-grid">
          <div>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 11l9-8 9 8M5 10v10h14V10" /></svg>
            <h3>Spot What Buyers Notice</h3>
            <p>Uncover the small issues that can reduce buyer interest and slow down your sale.</p>
          </div>
          <div>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z" /></svg>
            <h3>Expert-Backed Selling Insights</h3>
            <p>Combine data-driven analysis with experienced local property expertise.</p>
          </div>
          <div>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11 17l2 2 4-4M3 12l4-4 4 4M7 8v9M21 12l-4-4-4 4M17 8v9" /></svg>
            <h3>Works With Your Current Agent</h3>
            <p>Use our recommendations alongside your existing estate agent, no switching required.</p>
          </div>
        </div>
      </section>
    </>
  );
};

// ── Step: Finding Property (brief loading transition) ──────────────────────

const FindingStep = () => (
  <section className="slw-finding">
    <Spinner />
    <p>Finding your property…</p>
  </section>
);

// ── Step: Confirm Property ─────────────────────────────────────────────────

const ConfirmStep = ({
  prospect,
  onConfirm,
  onReject,
  loading,
}: {
  prospect: ProspectPreview;
  onConfirm: () => void;
  onReject: () => void;
  loading: boolean;
}) => {
  const snapshot = prospect.listing_snapshot || {};
  const image = snapshot.image || (snapshot.images && snapshot.images[0]) || '';
  return (
    <section className="slw-confirm">
      <h1>We Found Your Property</h1>
      <p className="slw-confirm-copy">We&rsquo;ve used your Property ID to find a match. Please confirm this is your property.</p>
      <div className="slw-confirm-card">
        <div className="slw-confirm-image" style={image ? { backgroundImage: `url(${image})` } : undefined} />
        <div className="slw-confirm-details">
          <h2>{prospect.property_address}</h2>
          {prospect.asking_price ? (
            <>
              <div className="slw-confirm-price">{formatGbp(prospect.asking_price)}</div>
              <span className="slw-badge">Asking Price</span>
            </>
          ) : null}
          <div className="slw-confirm-facts">
            {prospect.bedrooms ? (
              <span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 18v2M21 18v2M3 12V8a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>{prospect.bedrooms} Bedrooms</span>
            ) : null}
            {prospect.bathrooms ? (
              <span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-3zM7 12V6a2 2 0 0 1 3.5-1.3" /></svg>{prospect.bathrooms} Bathrooms</span>
            ) : null}
          </div>
          <p className="slw-confirm-question">Is this your property?</p>
          <button type="button" className="slw-btn-black slw-confirm-yes" onClick={onConfirm} disabled={loading}>
            {loading ? 'Confirming…' : 'Yes, This Is My Property'}
          </button>
          <button type="button" className="slw-btn-outline" onClick={onReject} disabled={loading}>
            No, Try Another ID
          </button>
        </div>
      </div>
    </section>
  );
};

// ── Step: No Property found ────────────────────────────────────────────────

const NotFoundStep = ({ onTryAgain }: { onTryAgain: () => void }) => (
  <section className="slw-not-found">
    <img src="/stale-listings/property-not-found.png" alt="" className="slw-not-found-illustration" />
    <h1>We couldn&rsquo;t find your property</h1>
    <p>Please check the Property ID on your Havlo letter and try again.</p>
    <button type="button" className="slw-btn-black" onClick={onTryAgain}>Try Again</button>
    <a href="mailto:myhavloservices@gmail.com" className="slw-help-link">Need help finding your Property ID?</a>
  </section>
);

// ── Step: Your Details ─────────────────────────────────────────────────────

const DetailsStep = ({
  onSubmit,
  loading,
  error,
}: {
  onSubmit: (fields: { full_name: string; email: string; confirm_email: string; mobile_number: string }) => void;
  loading: boolean;
  error: string;
}) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [localError, setLocalError] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (email.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()) {
      setLocalError('Email and confirm email must match.');
      return;
    }
    setLocalError('');
    onSubmit({ full_name: fullName.trim(), email: email.trim(), confirm_email: confirmEmail.trim(), mobile_number: mobile.trim() });
  };

  return (
    <section className="slw-details">
      <h1>Your Property Assessment Is Ready</h1>
      <p>
        We&rsquo;ve analysed your property and its position in the market to identify what may be
        affecting its ability to sell &mdash; and what could help attract more interest.
      </p>
      <p>
        No agent switching required. Your Havlo recommendations can be implemented alongside your
        current agent.
      </p>
      <p>Sellers who implement our recommendations typically see results within 4&ndash;6 weeks.</p>
      <p className="slw-accent-line">Enter your details to view your initial findings.</p>

      <form className="slw-details-form" onSubmit={handleSubmit}>
        <label>
          Full Name
          <input type="text" placeholder="e.g John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </label>
        <label>
          Email Address
          <input type="email" placeholder="name@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Confirm Email Address
          <input type="email" placeholder="name@email.com" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} required />
        </label>
        <label>
          Mobile Number
          <div className="slw-phone-input">
            <UkFlag />
            <input type="tel" placeholder="0000 000 0000 .000" value={mobile} onChange={(e) => setMobile(e.target.value)} required />
          </div>
        </label>
        <p className="slw-consent">
          <span className="slw-info-dot">i</span> Your details help us personalise your assessment and send you your property
          insights. We may also contact you with recommendations relevant to your property.
        </p>
        {(localError || error) && <p className="slw-error">{localError || error}</p>}
        <button type="submit" className="slw-btn-black" disabled={loading}>
          {loading ? 'Saving…' : 'Reveal My Assessment'}
        </button>
      </form>
    </section>
  );
};

// ── Shared: saleability gauge ──────────────────────────────────────────────

const SaleabilityGauge = ({ score, size = 190 }: { score: number; size?: number }) => {
  // Semicircle gauge, 0-100 mapped left-to-right across 180deg, needle
  // rotates from -90deg (score 0) to +90deg (score 100).
  const angle = -90 + (Math.min(100, Math.max(0, score)) / 100) * 180;
  const r = size / 2 - 14;
  const cx = size / 2;
  const cy = size / 2;
  return (
    <div className="slw-gauge" style={{ width: size, height: size / 2 + 40 }}>
      <svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`}>
        <defs>
          <linearGradient id="slw-gauge-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#E33709" />
            <stop offset="35%" stopColor="#F5A623" />
            <stop offset="65%" stopColor="#E9D400" />
            <stop offset="100%" stopColor="#00E9B2" />
          </linearGradient>
        </defs>
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="url(#slw-gauge-grad)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d={`M ${cx - r - 8} ${cy} A ${r + 8} ${r + 8} 0 0 1 ${cx + r + 8} ${cy}`}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="1"
          strokeDasharray="1 7"
        />
        <line
          x1={cx}
          y1={cy}
          x2={cx + r * 0.72 * Math.cos((angle * Math.PI) / 180)}
          y2={cy + r * 0.72 * Math.sin((angle * Math.PI) / 180)}
          stroke="#111"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r="4" fill="#111" />
      </svg>
      <div className="slw-gauge-score"><b>{score}</b>/100</div>
    </div>
  );
};

const SCORE_LABELS: Record<string, string> = {
  pricing: 'Pricing',
  listing_presentation: 'Listing presentation',
  market_positioning: 'Market positioning',
  competition: 'Competition',
  buyer_appeal: 'Buyer appeal',
};

const ScoreBar = ({ label, value }: { label: string; value: number }) => {
  const color = value < 45 ? '#E33709' : value < 65 ? '#F5A623' : '#00C08B';
  return (
    <div className="slw-score-bar-row">
      <div className="slw-score-bar-label"><span>{label}</span><b>{value}/100</b></div>
      <div className="slw-score-bar-track"><div className="slw-score-bar-fill" style={{ width: `${value}%`, background: color }} /></div>
    </div>
  );
};

// ── Step: Assessment (locked preview) ──────────────────────────────────────

const LOCKED_FINDING_LABELS = [
  'Recommended Pricing Range',
  'Detailed Competitor Analysis',
  'Buyer Perception Analysis',
  'Listing Performance Analysis',
  'Photography Assessment',
  '30-Day Action Plan',
  'Property Positioning Strategy',
  'Recommended Changes',
];

const FULL_REPORT_INCLUDES = [
  'Detailed property analysis', 'Pricing analysis', 'Comparable property analysis',
  'Local competition', 'Listing assessment', 'Buyer appeal analysis',
  'Photography and presentation assessment', 'Key issues affecting the listing',
  'Recommended improvements', 'Recommended positioning', 'Action plan',
];

const AssessmentStep = ({
  prospect,
  onUnlock,
}: {
  prospect: ProspectPreview;
  onUnlock: () => void;
}) => {
  const snapshot = prospect.listing_snapshot || {};
  const image = snapshot.image || (snapshot.images && snapshot.images[0]) || '';
  const preview = prospect.preview || {};
  const revealed = preview.key_issues || [];
  const totalFactors = revealed.length + LOCKED_FINDING_LABELS.length;
  const price = unlockPrice(prospect.asking_price);

  return (
    <section className="slw-assessment">
      <h1>Your Havlo property assessment</h1>
      <div className="slw-assess-top">
        <div className="slw-assess-property">
          <div className="slw-assess-image" style={image ? { backgroundImage: `url(${image})` } : undefined} />
          <div className="slw-assess-property-info">
            <h2>{prospect.property_address}</h2>
            <div className="slw-assess-facts">
              <div><span>Asking Price</span><b className="slw-accent">{formatGbp(prospect.asking_price)}</b></div>
              <div><span>Days on Market</span><b>{prospect.listing_duration_days ?? '—'} days</b></div>
            </div>
          </div>
        </div>
        <div className="slw-assess-gauge-card">
          <SaleabilityGauge score={preview.overall_score ?? 50} />
          <b>Property Saleability Score</b>
          <p>Our assessment identified several factors that may be affecting your property&rsquo;s ability to attract and convert buyers.</p>
        </div>
      </div>

      <h2 className="slw-assess-heading">We&rsquo;ve identified {totalFactors} potential factors</h2>
      <p className="slw-assess-subheading">{revealed.length} revealed &middot; {LOCKED_FINDING_LABELS.length} remain locked in your full report.</p>

      <div className="slw-assess-findings-grid">
        <div>
          <h3 className="slw-accent">{revealed.length} findings revealed</h3>
          {revealed.map((finding, i) => (
            <div className="slw-finding-card" key={i}>
              <span className="slw-finding-icon">{FINDING_ICONS[finding.icon || 'timing'] || '●'}</span>
              <div>
                <b>{finding.title}</b>
                <p>{finding.description}</p>
              </div>
            </div>
          ))}
        </div>
        <div>
          <h3>{LOCKED_FINDING_LABELS.length} findings locked</h3>
          <div className="slw-locked-grid">
            {LOCKED_FINDING_LABELS.map((label) => (
              <div className="slw-locked-card" key={label}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="slw-unlock-cta">
        <div className="slw-unlock-cta-copy">
          <h2>See your complete property assessment</h2>
          <p>A detailed analysis of your property and practical recommendations for why it may be taking longer to sell &mdash; pricing, competition, listing performance and a step-by-step action plan.</p>
          <div className="slw-price-box">
            <div>
              <span>Full report &middot; one-time payment</span>
              <b>{formatGbp(price, { maximumFractionDigits: 2 })}</b>
            </div>
            <button type="button" className="slw-btn-white" onClick={onUnlock}>Unlock my full Assessment</button>
          </div>
        </div>
        <div className="slw-unlock-cta-includes">
          <b>Full report includes</b>
          <ul>{FULL_REPORT_INCLUDES.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      </div>
    </section>
  );
};

const FINDING_ICONS: Record<string, string> = {
  price: '£', photos: '📷', description: '✏️', location: '📍', marketing: '●', condition: '🏠', timing: '⏱',
};

// ── Step: Payment ───────────────────────────────────────────────────────────

const PaymentStep = ({
  prospect,
  onPayCard,
  onPayBankTransfer,
  bankDetails,
  loading,
  error,
}: {
  prospect: ProspectPreview;
  onPayCard: () => void;
  onPayBankTransfer: () => void;
  bankDetails: { reference: string; accountName: string; accountNumber: string; bankName: string } | null;
  loading: boolean;
  error: string;
}) => {
  const [method, setMethod] = useState<'card' | 'bank_transfer'>('card');
  const snapshot = prospect.listing_snapshot || {};
  const image = snapshot.image || (snapshot.images && snapshot.images[0]) || '';
  const price = unlockPrice(prospect.asking_price);

  return (
    <section className="slw-payment">
      <h1>Unlock your full property assessment</h1>
      <div className="slw-payment-grid">
        <div className="slw-payment-methods">
          <b>Select a payment method to continue.</b>
          <button type="button" className={`slw-method ${method === 'card' ? 'slw-method-active' : ''}`} onClick={() => setMethod('card')}>
            <span className="slw-method-icon">💳</span>
            <span><b>Card</b><small>Visa, Amex, MasterCard, Verve</small></span>
          </button>
          <button type="button" className={`slw-method ${method === 'bank_transfer' ? 'slw-method-active' : ''}`} onClick={() => setMethod('bank_transfer')}>
            <span className="slw-method-icon">🏦</span>
            <span><b>Bank Transfer</b><small>Pay Directly from your Bank</small></span>
          </button>
        </div>
        <div className="slw-payment-summary">
          <div className="slw-payment-image" style={image ? { backgroundImage: `url(${image})` } : undefined} />
          <h2>{prospect.property_address}</h2>
          <div className="slw-payment-breakdown">
            <div><span>Havlo Property Assessment</span><b>{formatGbp(price, { maximumFractionDigits: 2 })}</b></div>
            <div className="slw-payment-total"><span>Total due today</span><b>{formatGbp(price, { maximumFractionDigits: 2 })}</b></div>
          </div>
        </div>
      </div>

      {bankDetails ? (
        <div className="slw-bank-details">
          <b>Bank transfer details</b>
          <p>Transfer {formatGbp(price, { maximumFractionDigits: 2 })} using the details below, including the reference &mdash; your report unlocks once we confirm the payment.</p>
          <div className="slw-bank-details-grid">
            <div><span>Account Name</span><b>{bankDetails.accountName}</b></div>
            <div><span>Account Number</span><b>{bankDetails.accountNumber}</b></div>
            <div><span>Bank</span><b>{bankDetails.bankName}</b></div>
            <div><span>Reference (required)</span><b>{bankDetails.reference}</b></div>
          </div>
        </div>
      ) : (
        <>
          {error && <p className="slw-error">{error}</p>}
          <button
            type="button"
            className="slw-btn-black slw-pay-btn"
            disabled={loading}
            onClick={method === 'card' ? onPayCard : onPayBankTransfer}
          >
            {loading ? 'Processing…' : method === 'card' ? `Pay ${formatGbp(price, { maximumFractionDigits: 2 })} & View My Report` : 'Get Bank Transfer Details'}
          </button>
        </>
      )}
    </section>
  );
};

// ── Step: Success ───────────────────────────────────────────────────────────

const SuccessStep = ({
  prospect,
  onViewReport,
  onDownloadPdf,
}: {
  prospect: ProspectPreview;
  onViewReport: () => void;
  onDownloadPdf: () => void;
}) => (
  <section className="slw-success">
    <div className="slw-success-check">✓</div>
    <h1>Your full assessment is ready</h1>
    <p>Your complete Havlo Property Assessment for {prospect.property_address} has been unlocked.</p>
    <button type="button" className="slw-btn-black" onClick={onViewReport}>View My full Assessment</button>
    <button type="button" className="slw-btn-outline" onClick={onDownloadPdf}>Download PDF Report</button>
  </section>
);

// ── Step: Full Report ───────────────────────────────────────────────────────

const FullReportStep = ({
  report,
  onOpenRecommendation,
  onDownloadPdf,
}: {
  report: ProspectReport;
  onOpenRecommendation: () => void;
  onDownloadPdf: () => void;
}) => {
  const data: FullReportData = report.report_data || {};
  const snapshot = report.listing_snapshot || {};
  const image = snapshot.image || (snapshot.images && snapshot.images[0]) || '';
  const scores = data.scores || {};
  const heroFindings = (data.key_findings || []).filter((f) => f.type === 'issue').slice(0, 2);
  if (heroFindings.length < 2) {
    for (const f of data.key_findings || []) {
      if (heroFindings.length >= 2) break;
      if (!heroFindings.includes(f)) heroFindings.push(f);
    }
  }

  return (
    <section className="slw-report">
      <div className="slw-report-head">
        <h1>Full Property Assessment</h1>
        <button type="button" className="slw-btn-outline slw-pdf-btn" onClick={onDownloadPdf}>Download PDF Report</button>
      </div>

      <div className="slw-report-summary-row">
        <div className="slw-report-summary-card">
          <b>Executive summary</b>
          <p>{data.executive_summary}</p>
        </div>
        <div className="slw-report-property-card">
          <div className="slw-report-image" style={image ? { backgroundImage: `url(${image})` } : undefined} />
          <div>
            <h2>{report.property_address}</h2>
            <div className="slw-assess-facts">
              <div><span>Asking Price</span><b className="slw-accent">{formatGbp(report.asking_price)}</b></div>
              <div><span>Days on Market</span><b>{report.listing_duration_days ?? '—'} days</b></div>
            </div>
          </div>
        </div>
      </div>

      <h2 className="slw-section-heading">Saleability Score</h2>
      <div className="slw-score-row">
        <div className="slw-score-gauge-card">
          <SaleabilityGauge score={data.overall_score ?? 50} />
          <b>Property Saleability Score</b>
          <p>Our assessment identified several factors that may be affecting your property&rsquo;s ability to attract and convert buyers.</p>
        </div>
        <div className="slw-score-bars-card">
          {Object.entries(SCORE_LABELS).map(([key, label]) => (
            <ScoreBar key={key} label={label} value={scores[key as keyof typeof scores] ?? 50} />
          ))}
        </div>
      </div>

      <h2 className="slw-section-heading">Why your property may not be selling</h2>
      <div className="slw-why-not-selling">
        {heroFindings.map((finding, i) => (
          <div className="slw-why-card" key={i}>
            <h3>{String(i + 1).padStart(2, '0')} &mdash; {finding.title}</h3>
            <div><span className="slw-why-label slw-why-evidence">EVIDENCE</span><p>{finding.evidence}</p></div>
            <div><span className="slw-why-label slw-why-impact">IMPACT</span><p>{finding.impact}</p></div>
            <div><span className="slw-why-label slw-why-recommend">RECOMMEND</span><p>{finding.recommend}</p></div>
          </div>
        ))}
      </div>

      <div className="slw-report-two-col">
        <div className="slw-competition-card">
          <b>Competition analysis</b>
          <p>Properties currently competing for the same buyers:</p>
          {(data.active_competition || []).map((c, i) => (
            <div className="slw-competitor-row" key={i}>
              <div>
                <b>{c.address}</b>
                <span>{c.beds} bed &middot; {c.distance} &middot; {c.differentiator}</span>
              </div>
              <div className="slw-competitor-price">
                <b>{c.price}</b>
                <span>{c.days_listed} days listed</span>
              </div>
            </div>
          ))}
        </div>
        <div className="slw-actions-card">
          <b>Recommended actions</b>
          {(data.action_plan || []).map((action, i) => (
            <div className="slw-action-row" key={i}>
              <b>{action.title}</b>
              <p>{action.description}</p>
              {action.why_it_matters && <p className="slw-why-it-matters"><i>Why it matters: {action.why_it_matters}</i></p>}
            </div>
          ))}
        </div>
      </div>

      <h2 className="slw-section-heading">30-day action plan</h2>
      <div className="slw-thirty-day-grid">
        {(data.thirty_day_plan || []).map((week) => (
          <div className="slw-week-card" key={week.week}>
            <span>Week {week.week}</span>
            <b>{week.title}</b>
          </div>
        ))}
      </div>

      <div className="slw-recommendation-callout">
        <b>Havlo Stale Listing Recommendation</b>
        <button type="button" className="slw-btn-black" onClick={onOpenRecommendation}>View full recommendation</button>
      </div>
    </section>
  );
};

// ── Recommendation modal ────────────────────────────────────────────────────

const RecommendationModal = ({ contactName, onClose }: { contactName: string; onClose: () => void }) => (
  <div className="slw-modal-overlay" onClick={onClose}>
    <div className="slw-modal" onClick={(e) => e.stopPropagation()}>
      <div className="slw-modal-head">
        <h2>Havlo Stale Listing Recommendation</h2>
        <button type="button" className="slw-modal-close" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="slw-modal-body">
        <p>Dear {contactName || '(name)'},</p>
        <p>Following our assessment of your property&rsquo;s current market position, we believe there may be an opportunity to broaden the way your property is promoted and reach potential buyers beyond traditional property-portal searches. In addition to the assessment report for your property, we recommend discussing the following strategies with your estate agent:</p>

        <h3>1) Neighbourhood Buyer Outreach</h3>
        <p>Your property&rsquo;s next buyer may already live nearby &mdash; or have a reason to want to.</p>
        <p>Neighbouring households are an often-overlooked source of potential buyers. A neighbour may have family members, adult children, friends or colleagues who would like to live closer, or they may personally be considering purchasing a larger, smaller or additional property within the area.</p>
        <p>Some Havlo clients have used targeted neighbourhood outreach to generate buyer interest within weeks, including from people who were not actively searching for a property.</p>
        <p>We recommend asking your agent to create a dedicated property flyer or letter and distribute it to carefully selected surrounding households. Rather than simply announcing that the property is for sale, the communication should clearly present the opportunity and encourage neighbours to share it with anyone they know who may want to live nearby.</p>
        <p>This creates a direct route to potential buyers who may never have encountered the property through Rightmove, Zoopla or other portals.</p>

        <h3>2) Havlo Premium Digital Buyer Acquisition</h3>
        <p>You may also wish to explore Sell Faster (Havlo Relaunch&trade;) &mdash; Havlo&rsquo;s property-intelligence-led digital buyer acquisition programme, designed to work alongside your existing estate agent.</p>
        <p>Using insights from your property&rsquo;s market position, Havlo identifies relevant buyer audiences and develops precision-targeted Meta campaigns designed to reach potential buyers based on factors such as location, lifestyle, interests and potential buyer profile.</p>
        <p>Rather than relying solely on buyers actively searching property portals, Sell Faster (Havlo Relaunch&trade;) adds an additional route to market by taking the property directly to potential buyers who may not yet be searching.</p>
        <p>Your estate agent remains your agent. Havlo&rsquo;s role is to provide additional property intelligence and buyer reach to support the existing sales process.</p>

        <h3>3) Explore Alternative Buyer Profiles</h3>
        <p>Ask your agent to consider buyer groups beyond the traditional owner-occupier, including private investors, landlords, relocation buyers and second-home purchasers.</p>
        <p>For example, a buyer may see greater value in purchasing the property as a rental investment rather than occupying it themselves.</p>

        <h3>4) Reposition the Opportunity</h3>
        <p>Consider whether the property&rsquo;s strongest proposition is being communicated effectively.<br />
        This could include its investment potential, rental opportunity, location, lifestyle appeal or suitability for a particular type of buyer.<br />
        Sometimes the challenge is not simply finding more buyers, it is reaching the right buyers with the right proposition.</p>

        <h3>OUR ADVISORY VIEW</h3>
        <p>We recommend discussing these strategies with your existing agent and exploring how they could complement your current marketing approach.<br />
        Your agent already has the property. The opportunity may simply be to expand how, where and to whom it is presented.</p>
        <p>If you would like to explore a more targeted buyer acquisition strategy, Havlo can assess whether its Premium Digital Buyer Acquisition Campaign may be appropriate for your property.</p>

        <h3>Prepared &amp; reviewed by</h3>
        <p className="slw-modal-team">Havlo Sales Advisory Team</p>
        <p>Property Intelligence &bull; Sales Strategy &bull; Buyer Generation</p>
        <p className="slw-modal-disclaimer">This recommendation is strategic guidance based on the information available to Havlo at the time of assessment. Individual strategies should be evaluated against the property&rsquo;s circumstances and current market conditions. Results will vary and no particular strategy guarantees a sale.</p>
      </div>
    </div>
  </div>
);

// ── Main wizard ─────────────────────────────────────────────────────────────

export const StaleProspectWizard = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [step, setStep] = useState<WizardStep>('landing');
  const [prospect, setProspect] = useState<ProspectPreview | null>(null);
  const [report, setReport] = useState<ProspectReport | null>(null);
  const [access, setAccess] = useState<{ token?: string; code?: string }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bootLoading, setBootLoading] = useState(true);
  const [bankDetails, setBankDetails] = useState<{ reference: string; accountName: string; accountNumber: string; bankName: string } | null>(null);
  const [showRecommendation, setShowRecommendation] = useState(false);
  const [pendingPrint, setPendingPrint] = useState(false);
  const [pollHandle, setPollHandle] = useState<number | null>(null);

  const query = useMemo(() => {
    const token = params.get('token') || undefined;
    const code = params.get('code') || undefined;
    return { token, code };
  }, [params]);

  // Resume mid-flow on reload (or land straight into the right step after a
  // SumUp/bank-transfer redirect back to /stale-listings/prospect/complete)
  // using the property_confirmed/has_contact_details/payment_status flags
  // the backend already tracks — never forces someone back through steps
  // they've already completed.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!query.token && !query.code) {
        setBootLoading(false);
        return;
      }
      try {
        const data = await getProspectPreview(query);
        if (cancelled) return;
        setProspect(data);
        setAccess({ token: query.token, code: data.property_code });
        if (data.is_unlocked) {
          const reportData = await getProspectReport({ token: query.token, code: data.property_code });
          if (cancelled) return;
          setReport(reportData);
          setStep('report');
        } else if (data.payment_status === 'pending') {
          // Landed back from a SumUp redirect while it was still confirming
          // — poll the same way the payment step itself would.
          setStep('payment');
          const handle = window.setInterval(async () => {
            try {
              const status = await getProspectPaymentStatus({ token: query.token, code: data.property_code });
              if (status.payment_status === 'completed') {
                window.clearInterval(handle);
                const reportData = await getProspectReport({ token: query.token, code: data.property_code });
                setReport(reportData);
                setStep('success');
              }
            } catch {
              // ignore transient poll failures
            }
          }, 4000);
          setPollHandle(handle);
        } else if (data.has_contact_details) {
          setStep('assessment');
        } else if (data.property_confirmed) {
          setStep('details');
        } else {
          setStep('confirm');
        }
      } catch {
        if (!cancelled) setStep('landing');
      } finally {
        if (!cancelled) setBootLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoBack = () => {
    if (step === 'confirm' || step === 'not_found') setStep('landing');
    else if (step === 'details') setStep('confirm');
    else if (step === 'assessment') setStep('details');
    else if (step === 'payment') setStep('assessment');
    else navigate(-1);
  };

  const handleLandingSubmit = async (code: string) => {
    setLoading(true);
    setError('');
    setStep('finding');
    try {
      const data = await lookupProspect(code);
      setProspect(data);
      setAccess({ code: data.property_code });
      setStep(data.property_confirmed ? (data.has_contact_details ? 'assessment' : 'details') : 'confirm');
    } catch {
      setStep('not_found');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmYes = async () => {
    setLoading(true);
    try {
      await confirmProspectProperty(access.token ? { token: access.token } : { property_code: access.code });
      setStep('details');
    } catch {
      setError('Something went wrong confirming your property. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDetailsSubmit = async (fields: { full_name: string; email: string; confirm_email: string; mobile_number: string }) => {
    setLoading(true);
    setError('');
    try {
      await submitProspectDetails({ ...fields, token: access.token, property_code: access.code });
      if (prospect) setProspect({ ...prospect, has_contact_details: true });
      setStep('assessment');
    } catch (e: any) {
      setError(e?.message === 'Email and confirm email must match.' ? e.message : 'We could not save your details. Please check them and try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadReport = async () => {
    const data = await getProspectReport(access);
    setReport(data);
    return data;
  };

  const handlePayCard = async () => {
    setLoading(true);
    setError('');
    try {
      const redirectUrl = window.location.href.split('#')[0];
      const result = await createProspectCheckout({ ...access, payment_method: 'card', redirect_url: redirectUrl });
      if (result.unlocked) {
        await loadReport();
        setStep('success');
      } else if (result.checkout_url) {
        window.location.href = result.checkout_url;
      }
    } catch {
      setError('We could not start checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePayBankTransfer = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await createProspectCheckout({ ...access, payment_method: 'bank_transfer' });
      if (result.unlocked) {
        await loadReport();
        setStep('success');
        return;
      }
      setBankDetails({
        reference: result.bank_transfer_reference || '',
        accountName: result.bank_transfer_account_name || '',
        accountNumber: result.bank_transfer_account_number || '',
        bankName: result.bank_transfer_bank_name || '',
      });
      // Poll for the admin to mark the bank transfer paid, same idea as the
      // existing SumUp payment-status polling — check every 15s so the
      // homeowner doesn't have to manually refresh once it's confirmed.
      const handle = window.setInterval(async () => {
        try {
          const status = await getProspectPaymentStatus(access);
          if (status.payment_status === 'completed') {
            window.clearInterval(handle);
            await loadReport();
            setBankDetails(null);
            setStep('success');
          }
        } catch {
          // ignore transient poll failures
        }
      }, 15000);
      setPollHandle(handle);
    } catch {
      setError('We could not retrieve bank transfer details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => () => {
    if (pollHandle) window.clearInterval(pollHandle);
  }, [pollHandle]);

  const handleViewReport = async () => {
    if (!report) {
      setLoading(true);
      try {
        await loadReport();
      } finally {
        setLoading(false);
      }
    }
    setStep('report');
  };

  const handleDownloadPdf = async () => {
    if (step !== 'report') {
      setPendingPrint(true);
      await handleViewReport();
      return;
    }
    window.print();
  };

  useEffect(() => {
    if (pendingPrint && step === 'report' && report) {
      setPendingPrint(false);
      const t = window.setTimeout(() => window.print(), 200);
      return () => window.clearTimeout(t);
    }
  }, [pendingPrint, step, report]);

  if (bootLoading) {
    return (
      <div className="slw-page">
        <Header />
        <FindingStep />
        <Footer />
        <WizardStyles />
      </div>
    );
  }

  return (
    <div className="slw-page">
      <Header />
      <div className="slw-shell">
        {step !== 'landing' && step !== 'finding' && <GoBack onClick={handleGoBack} />}
        {step !== 'finding' && <Stepper step={step} />}
        <main className="slw-main">
          {step === 'landing' && <LandingStep onSubmit={handleLandingSubmit} loading={loading} error={error} />}
          {step === 'finding' && <FindingStep />}
          {step === 'confirm' && prospect && (
            <ConfirmStep prospect={prospect} onConfirm={handleConfirmYes} onReject={() => setStep('landing')} loading={loading} />
          )}
          {step === 'not_found' && <NotFoundStep onTryAgain={() => setStep('landing')} />}
          {step === 'details' && <DetailsStep onSubmit={handleDetailsSubmit} loading={loading} error={error} />}
          {step === 'assessment' && prospect && (
            <AssessmentStep prospect={prospect} onUnlock={() => setStep('payment')} />
          )}
          {step === 'payment' && prospect && (
            <PaymentStep
              prospect={prospect}
              onPayCard={handlePayCard}
              onPayBankTransfer={handlePayBankTransfer}
              bankDetails={bankDetails}
              loading={loading}
              error={error}
            />
          )}
          {step === 'success' && prospect && (
            <SuccessStep prospect={prospect} onViewReport={handleViewReport} onDownloadPdf={handleDownloadPdf} />
          )}
          {step === 'report' && report && (
            <FullReportStep report={report} onOpenRecommendation={() => setShowRecommendation(true)} onDownloadPdf={handleDownloadPdf} />
          )}
        </main>
      </div>
      <Footer />
      {showRecommendation && (
        <RecommendationModal contactName={report?.contact_name || ''} onClose={() => setShowRecommendation(false)} />
      )}
      <WizardStyles />
    </div>
  );
};

const WizardStyles = () => (
  <style>{`
    .slw-page{font-family:'Inter','Plus Jakarta Sans',sans-serif;color:#0a0a0a;background:#fff;min-height:100vh;display:flex;flex-direction:column}
    .slw-page *{box-sizing:border-box}
    .slw-header{display:flex;align-items:center;justify-content:space-between;padding:20px 60px;border-bottom:1px solid #eee;position:relative}
    .slw-logo-link{text-decoration:none;color:inherit}
    .slw-logo{display:flex;flex-direction:column;line-height:1}
    .slw-logo-mark{font-family:'Right Grotesk','Bricolage Grotesque',sans-serif;font-weight:900;font-size:24px;letter-spacing:0.5px}
    .slw-logo-sub{font-size:11px;color:#555;margin-top:2px}
    .slw-nav{display:flex;gap:32px;font-weight:600;font-size:15px}
    .slw-nav a{color:#111;text-decoration:none}
    .slw-burger{display:none;flex-direction:column;gap:4px;background:none;border:none;cursor:pointer;padding:8px}
    .slw-burger span{width:22px;height:2px;background:#111;display:block}
    .slw-mobile-nav{position:absolute;top:100%;left:0;right:0;background:#fff;border-bottom:1px solid #eee;display:flex;flex-direction:column;padding:12px 20px;gap:14px;font-weight:600;z-index:20}
    .slw-mobile-nav a{color:#111;text-decoration:none}

    .slw-shell{max-width:1240px;margin:0 auto;padding:0 60px;width:100%;flex:1}
    .slw-goback{display:flex;align-items:center;gap:8px;background:none;border:none;color:#666;font-size:15px;cursor:pointer;padding:28px 0 0;font-family:inherit}
    .slw-stepper-wrap{overflow-x:auto;margin:22px 0 10px;-ms-overflow-style:none;scrollbar-width:none}
    .slw-stepper-wrap::-webkit-scrollbar{display:none}
    .slw-stepper{display:flex;align-items:center;list-style:none;margin:0;padding:0;white-space:nowrap;font-size:15px;font-weight:600;color:#9aa0a6}
    .slw-stepper li{display:flex;align-items:center;gap:10px}
    .slw-step-sep{width:34px;height:1px;background:#e2e4e8;margin:0 6px}
    .slw-step-active{color:#A409D2}
    .slw-step-done{color:#111}
    .slw-main{padding:20px 0 80px}

    .slw-accent{color:#A409D2}
    .slw-hero{text-align:center;max-width:760px;margin:40px auto 0}
    .slw-hero h1{font-family:'Right Grotesk','Bricolage Grotesque',sans-serif;font-weight:900;font-size:56px;line-height:1.02;letter-spacing:-1px;margin:0}
    .slw-hero-copy{color:#555;font-size:16px;line-height:1.6;margin:22px auto 0;max-width:560px}
    .slw-id-form{margin:28px auto 0;max-width:560px}
    .slw-id-input{display:flex;align-items:center;gap:12px;background:#eef0f2;border-radius:14px;padding:16px 20px;color:#111}
    .slw-id-input input{border:none;background:none;outline:none;font-size:16px;flex:1;color:#111;font-family:inherit}
    .slw-id-input input::placeholder{color:#9aa0a6}
    .slw-id-hint{display:flex;align-items:center;justify-content:center;gap:8px;color:#666;font-size:13px;margin:12px 0 0}
    .slw-info-dot{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:#A409D2;color:#fff;font-size:11px;font-style:italic;font-weight:700;flex:none}
    .slw-id-submit{margin-top:18px;width:100%}
    .slw-error{color:#c02626;font-size:14px;margin:10px 0 0}

    .slw-stats{display:flex;justify-content:center;gap:56px;margin:32px 0 0}
    .slw-stats b{font-family:'Right Grotesk','Bricolage Grotesque',sans-serif;font-size:28px;display:block}
    .slw-stats span{color:#666;font-size:13px}
    .slw-rating{display:flex;align-items:center;justify-content:center;gap:10px;margin:24px 0 40px;font-size:14px}
    .slw-trustpilot-stars{display:inline-flex;gap:3px}
    .slw-trustpilot-stars i{background:#00b67a;color:#fff;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-style:normal;font-size:13px;border-radius:3px}

    .slw-hero-image{height:230px;border-radius:0;margin:0 -60px;background:linear-gradient(180deg,#e9d5ff 0%,#fbcfe8 45%,#fff 100%);position:relative;overflow:hidden}
    .slw-hero-image::after{content:"";position:absolute;inset:0;background:url('/stale-listings/hero-house.png') center bottom / cover no-repeat}

    .slw-value-section{padding:56px 0 40px}
    .slw-value-section h2{font-family:'Right Grotesk','Bricolage Grotesque',sans-serif;font-weight:800;font-size:34px;line-height:1.15;margin:0 0 40px}
    .slw-value-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:36px}
    .slw-value-grid svg{color:#A409D2;margin-bottom:16px}
    .slw-value-grid h3{font-size:19px;margin:0 0 8px}
    .slw-value-grid p{color:#666;font-size:14.5px;line-height:1.55;margin:0}

    .slw-finding{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;padding:120px 0;color:#555;font-size:16px}
    .slw-spinner{width:40px;height:40px;border-radius:50%;border:3px solid #eee;border-top-color:#A409D2;animation:slw-spin 0.8s linear infinite}
    @keyframes slw-spin{to{transform:rotate(360deg)}}

    .slw-confirm{max-width:900px;margin:0 auto;text-align:center}
    .slw-confirm h1{font-family:'Right Grotesk','Bricolage Grotesque',sans-serif;font-weight:900;font-size:36px;margin:0 0 10px}
    .slw-confirm-copy{color:#666;margin:0 0 32px}
    .slw-confirm-card{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid #eee;border-radius:16px;overflow:hidden;text-align:left;background:#fff}
    .slw-confirm-image{min-height:280px;background-size:cover;background-position:center;background-color:#e5e7eb}
    .slw-confirm-details{padding:32px}
    .slw-confirm-details h2{font-size:26px;margin:0 0 12px;line-height:1.2}
    .slw-confirm-price{color:#A409D2;font-size:26px;font-weight:800}
    .slw-badge{display:inline-block;background:#fbeaff;color:#A409D2;font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px;margin-top:8px}
    .slw-confirm-facts{display:flex;gap:24px;margin:20px 0;padding-top:20px;border-top:1px solid #eee;color:#333;font-size:15px}
    .slw-confirm-facts span{display:flex;align-items:center;gap:8px}
    .slw-confirm-facts svg{color:#A409D2}
    .slw-confirm-question{font-weight:700;margin:8px 0 12px}

    .slw-btn-black{background:#0a0a0a;color:#fff;border:none;border-radius:12px;padding:16px 24px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit;width:100%}
    .slw-btn-black:disabled{opacity:0.6;cursor:default}
    .slw-btn-outline{background:#fff;color:#111;border:1px solid #ddd;border-radius:12px;padding:16px 24px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit;width:100%;margin-top:12px}

    .slw-not-found{max-width:520px;margin:40px auto 0;text-align:center}
    .slw-not-found-illustration{width:260px;margin:0 auto 24px;display:block}
    .slw-not-found h1{font-family:'Right Grotesk','Bricolage Grotesque',sans-serif;font-weight:900;font-size:30px;margin:0 0 12px}
    .slw-not-found p{color:#666;margin:0 0 28px}
    .slw-help-link{display:block;margin-top:18px;color:#A409D2;font-weight:700;text-decoration:none}

    .slw-details{max-width:640px;margin:0 auto;text-align:center}
    .slw-details h1{font-family:'Right Grotesk','Bricolage Grotesque',sans-serif;font-weight:900;font-size:34px;margin:0 0 20px}
    .slw-details p{color:#555;line-height:1.6;margin:0 0 16px}
    .slw-accent-line{color:#A409D2;font-weight:700}
    .slw-details-form{text-align:left;background:#fff;border:1px solid #eee;border-radius:16px;padding:32px;margin-top:24px}
    .slw-details-form label{display:block;font-size:14px;font-weight:600;margin-bottom:18px}
    .slw-details-form input{width:100%;margin-top:8px;background:#f3f4f6;border:none;border-radius:10px;padding:14px 16px;font-size:15px;font-family:inherit;outline:none}
    .slw-phone-input{display:flex;align-items:center;gap:10px;background:#f3f4f6;border-radius:10px;padding:0 14px;margin-top:8px}
    .slw-uk-flag{width:26px;height:16px;border-radius:2px;flex:none}
    .slw-phone-input input{background:none;padding:14px 0}
    .slw-consent{display:flex;gap:8px;color:#666;font-size:13px;line-height:1.5;margin:6px 0 22px}
    .slw-consent .slw-info-dot{margin-top:2px}

    /* Assessment step */
    .slw-assessment h1{font-family:'Right Grotesk','Bricolage Grotesque',sans-serif;font-weight:900;font-size:32px;margin:0 0 24px}
    .slw-assess-top{display:grid;grid-template-columns:1.6fr 1fr;gap:0;background:#f7f8fa;border-radius:18px;padding:20px;margin-bottom:36px}
    .slw-assess-property{display:grid;grid-template-columns:1fr 1fr;gap:20px;background:#fff;border-radius:14px;padding:16px;margin-right:16px}
    .slw-assess-image{border-radius:10px;min-height:170px;background-size:cover;background-position:center;background-color:#e5e7eb}
    .slw-assess-property-info h2{font-size:20px;margin:0 0 16px;line-height:1.3}
    .slw-assess-facts{display:flex;flex-direction:column;gap:14px}
    .slw-assess-facts div{display:flex;flex-direction:column;gap:4px}
    .slw-assess-facts span{color:#777;font-size:13px}
    .slw-assess-facts b{font-size:20px}
    .slw-assess-gauge-card{background:#fff;border-radius:14px;padding:20px;text-align:center;display:flex;flex-direction:column;align-items:center}
    .slw-assess-gauge-card b{margin-top:6px;font-size:16px}
    .slw-assess-gauge-card p{color:#777;font-size:13px;line-height:1.5;margin:8px 0 0}
    .slw-gauge{display:flex;flex-direction:column;align-items:center;position:relative}
    .slw-gauge-score{margin-top:-32px;font-size:15px;color:#666}
    .slw-gauge-score b{font-size:30px;color:#111}

    .slw-assess-heading{font-family:'Right Grotesk','Bricolage Grotesque',sans-serif;font-size:26px;margin:0 0 6px}
    .slw-assess-subheading{color:#777;margin:0 0 22px}
    .slw-assess-findings-grid{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-bottom:40px}
    .slw-assess-findings-grid h3{font-size:17px;margin:0 0 16px}
    .slw-finding-card{display:flex;gap:14px;border:1px solid #eee;border-radius:14px;padding:18px;margin-bottom:14px}
    .slw-finding-icon{font-size:20px;flex:none}
    .slw-finding-card b{display:block;margin-bottom:6px;font-size:15px}
    .slw-finding-card p{color:#666;font-size:14px;line-height:1.5;margin:0}
    .slw-locked-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .slw-locked-card{display:flex;align-items:flex-start;gap:8px;background:#f7f8fa;border-radius:12px;padding:14px;color:#8a8f98;font-size:13.5px;line-height:1.35}
    .slw-locked-card svg{flex:none;margin-top:1px}

    .slw-unlock-cta{background:#f7f8fa;border-radius:18px;padding:32px;display:grid;grid-template-columns:1.3fr 1fr;gap:32px}
    .slw-unlock-cta-copy h2{font-family:'Right Grotesk','Bricolage Grotesque',sans-serif;font-size:26px;margin:0 0 12px}
    .slw-unlock-cta-copy p{color:#666;line-height:1.6;margin:0 0 22px}
    .slw-price-box{background:#0a0a0a;color:#fff;border-radius:14px;padding:22px}
    .slw-price-box>div{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:16px}
    .slw-price-box span{font-size:14px;color:#ccc}
    .slw-price-box b{font-size:24px}
    .slw-btn-white{background:#fff;color:#111;border:none;border-radius:12px;padding:16px 24px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit;width:100%}
    .slw-unlock-cta-includes{background:#fff;border-radius:14px;padding:24px}
    .slw-unlock-cta-includes b{display:block;margin-bottom:14px;font-size:16px}
    .slw-unlock-cta-includes ul{margin:0;padding-left:20px;color:#444;font-size:14px;line-height:2}

    /* Payment step */
    .slw-payment h1{font-family:'Right Grotesk','Bricolage Grotesque',sans-serif;font-weight:900;font-size:32px;margin:0 0 24px}
    .slw-payment-grid{display:grid;grid-template-columns:1fr 1.1fr;gap:0;background:#f7f8fa;border-radius:18px;padding:24px}
    .slw-payment-methods{display:flex;flex-direction:column;gap:12px}
    .slw-payment-methods>b{font-size:15px;margin-bottom:6px}
    .slw-method{display:flex;align-items:center;gap:14px;background:#f3f4f6;border:2px solid transparent;border-radius:12px;padding:16px;text-align:left;cursor:pointer;font-family:inherit}
    .slw-method-active{background:#fff;border-color:#A409D2}
    .slw-method-icon{font-size:20px}
    .slw-method b{display:block;font-size:15px}
    .slw-method small{color:#777;font-size:12.5px}
    .slw-payment-summary{background:#fff;border-radius:14px;padding:20px;margin-left:20px}
    .slw-payment-image{border-radius:10px;min-height:170px;background-size:cover;background-position:center;margin-bottom:16px;background-color:#e5e7eb}
    .slw-payment-summary h2{font-size:19px;margin:0 0 16px}
    .slw-payment-breakdown div{display:flex;justify-content:space-between;padding:10px 0;font-size:14px;color:#555}
    .slw-payment-total{border-top:1px solid #eee;font-weight:700;color:#111 !important}
    .slw-payment-total span,.slw-payment-total b{color:#111}
    .slw-pay-btn{max-width:520px;margin:28px auto 0;display:block}
    .slw-bank-details{max-width:520px;margin:28px auto 0;background:#f7f8fa;border-radius:14px;padding:24px}
    .slw-bank-details p{color:#666;font-size:14px;margin:6px 0 18px}
    .slw-bank-details-grid{display:grid;gap:12px}
    .slw-bank-details-grid div{display:flex;justify-content:space-between;background:#fff;border-radius:10px;padding:12px 16px;font-size:14px}
    .slw-bank-details-grid span{color:#777}

    /* Success step */
    .slw-success{max-width:460px;margin:40px auto 0;text-align:center}
    .slw-success-check{width:64px;height:64px;border-radius:50%;background:#d1fae5;color:#059669;font-size:28px;display:flex;align-items:center;justify-content:center;margin:0 auto 24px}
    .slw-success h1{font-family:'Right Grotesk','Bricolage Grotesque',sans-serif;font-weight:900;font-size:26px;margin:0 0 12px}
    .slw-success p{color:#666;margin:0 0 28px;line-height:1.5}
    .slw-success .slw-btn-outline{margin-top:12px}

    /* Full report */
    .slw-report-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}
    .slw-report h1{font-family:'Right Grotesk','Bricolage Grotesque',sans-serif;font-weight:900;font-size:32px;margin:0}
    .slw-pdf-btn{width:auto;padding:12px 20px}
    .slw-report-summary-row{display:grid;grid-template-columns:1fr 1.3fr;gap:20px;background:#f7f8fa;border-radius:18px;padding:20px;margin-bottom:36px}
    .slw-report-summary-card,.slw-report-property-card{background:#fff;border-radius:14px;padding:24px}
    .slw-report-summary-card b{display:block;font-size:18px;margin-bottom:12px}
    .slw-report-summary-card p{color:#555;line-height:1.6;margin:0;font-size:14.5px}
    .slw-report-property-card{display:grid;grid-template-columns:1fr 1.1fr;gap:20px;align-items:center}
    .slw-report-image{border-radius:10px;align-self:stretch;background-size:cover;background-position:center;background-color:#e5e7eb;min-height:150px}
    .slw-report-property-card h2{font-size:19px;margin:0 0 16px}

    .slw-section-heading{font-family:'Right Grotesk','Bricolage Grotesque',sans-serif;font-size:26px;margin:44px 0 20px}
    .slw-score-row{display:grid;grid-template-columns:1fr 1.4fr;gap:20px;background:#f7f8fa;border-radius:18px;padding:24px}
    .slw-score-gauge-card{background:#fff;border-radius:14px;padding:24px;text-align:center;display:flex;flex-direction:column;align-items:center}
    .slw-score-gauge-card b{margin-top:6px}
    .slw-score-gauge-card p{color:#777;font-size:13px;line-height:1.5;margin:8px 0 0}
    .slw-score-bars-card{background:#fff;border-radius:14px;padding:24px 28px}
    .slw-score-bar-row{margin-bottom:20px}
    .slw-score-bar-row:last-child{margin-bottom:0}
    .slw-score-bar-label{display:flex;justify-content:space-between;font-size:14px;margin-bottom:8px}
    .slw-score-bar-track{height:8px;border-radius:4px;background:#eee}
    .slw-score-bar-fill{height:100%;border-radius:4px}

    .slw-why-not-selling{display:grid;grid-template-columns:1fr 1fr;gap:20px;background:#f7f8fa;border-radius:18px;padding:24px}
    .slw-why-card{background:#fff;border-radius:14px;padding:22px}
    .slw-why-card h3{font-size:17px;margin:0 0 16px}
    .slw-why-card>div{margin-bottom:14px}
    .slw-why-card>div:last-child{margin-bottom:0}
    .slw-why-label{display:block;font-size:11px;font-weight:800;letter-spacing:0.5px;margin-bottom:4px}
    .slw-why-evidence{color:#d97706}
    .slw-why-impact{color:#dc2626}
    .slw-why-recommend{color:#059669}
    .slw-why-card p{margin:0;font-size:14px;color:#444;line-height:1.5}

    .slw-report-two-col{display:grid;grid-template-columns:1fr 1fr;gap:20px;background:#f7f8fa;border-radius:18px;padding:24px;margin-top:20px}
    .slw-competition-card,.slw-actions-card{background:#fff;border-radius:14px;padding:22px}
    .slw-competition-card>b,.slw-actions-card>b{display:block;font-size:17px;margin-bottom:6px}
    .slw-competition-card>p{color:#777;font-size:13.5px;margin:0 0 16px}
    .slw-competitor-row{display:flex;justify-content:space-between;gap:12px;padding:14px 0;border-top:1px solid #f0f0f0}
    .slw-competitor-row:first-of-type{border-top:none}
    .slw-competitor-row b{display:block;font-size:14.5px}
    .slw-competitor-row span{color:#777;font-size:12.5px}
    .slw-competitor-price{text-align:right}
    .slw-action-row{padding:14px 0;border-top:1px solid #f0f0f0}
    .slw-action-row:first-of-type{border-top:none}
    .slw-action-row b{display:block;font-size:14.5px;margin-bottom:6px}
    .slw-action-row p{margin:0 0 6px;font-size:13.5px;color:#444;line-height:1.5}
    .slw-why-it-matters{color:#777 !important;font-size:12.5px !important}

    .slw-thirty-day-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;background:#f7f8fa;border-radius:18px;padding:20px}
    .slw-week-card{background:#fff;border-radius:12px;padding:18px}
    .slw-week-card span{color:#A409D2;font-size:12px;font-weight:700;display:block;margin-bottom:8px}
    .slw-week-card b{font-size:14.5px;line-height:1.4}

    .slw-recommendation-callout{display:flex;justify-content:space-between;align-items:center;background:#fff;border:1px solid #eee;border-radius:16px;padding:24px 28px;margin-top:36px}
    .slw-recommendation-callout b{font-size:19px}
    .slw-recommendation-callout .slw-btn-black{width:auto;padding:14px 22px}

    /* Recommendation modal */
    .slw-modal-overlay{position:fixed;inset:0;background:rgba(20,20,20,0.55);display:flex;align-items:flex-start;justify-content:center;padding:40px 20px;z-index:100;overflow-y:auto}
    .slw-modal{background:#fff;border-radius:20px;max-width:900px;width:100%;padding:0;max-height:calc(100vh - 80px);display:flex;flex-direction:column}
    .slw-modal-head{display:flex;justify-content:space-between;align-items:flex-start;padding:32px 32px 0}
    .slw-modal-head h2{font-family:'Right Grotesk','Bricolage Grotesque',sans-serif;font-size:28px;margin:0}
    .slw-modal-close{background:#f3f4f6;border:none;border-radius:50%;width:36px;height:36px;cursor:pointer;font-size:15px;flex:none}
    .slw-modal-body{padding:24px 32px 32px;overflow-y:auto;line-height:1.6;font-size:14.5px;color:#333}
    .slw-modal-body h3{font-size:17px;margin:24px 0 8px}
    .slw-modal-body h3:first-of-type{margin-top:0}
    .slw-modal-body p{margin:0 0 12px}
    .slw-modal-team{font-weight:700;color:#999}
    .slw-modal-disclaimer{color:#999;font-size:12.5px;margin-top:16px}

    @media print{
      .slw-noprint{display:none !important}
      .slw-page{background:#fff}
      .slw-shell{padding:0 24px}
    }

    @media (max-width: 900px){
      .slw-header{padding:16px 20px}
      .slw-nav{display:none}
      .slw-burger{display:flex}
      .slw-shell{padding:0 20px}
      .slw-hero h1{font-size:34px}
      .slw-hero-image{margin:0 -20px;height:170px}
      .slw-stats{gap:28px}
      .slw-stats b{font-size:22px}
      .slw-value-grid{grid-template-columns:1fr;gap:32px}
      .slw-value-section h2{font-size:26px}
      .slw-confirm-card{grid-template-columns:1fr}
      .slw-confirm-image{min-height:220px}

      .slw-assess-top{grid-template-columns:1fr;gap:16px}
      .slw-assess-property{grid-template-columns:1fr;margin-right:0;margin-bottom:16px}
      .slw-assess-findings-grid{grid-template-columns:1fr;gap:28px}
      .slw-locked-grid{grid-template-columns:1fr}
      .slw-unlock-cta{grid-template-columns:1fr}

      .slw-payment-grid{grid-template-columns:1fr}
      .slw-payment-summary{margin-left:0;margin-top:20px}

      .slw-report-summary-row{grid-template-columns:1fr}
      .slw-report-property-card{grid-template-columns:1fr}
      .slw-report-image{min-height:180px}
      .slw-score-row{grid-template-columns:1fr}
      .slw-why-not-selling{grid-template-columns:1fr}
      .slw-report-two-col{grid-template-columns:1fr}
      .slw-thirty-day-grid{grid-template-columns:1fr 1fr}
      .slw-recommendation-callout{flex-direction:column;align-items:flex-start;gap:16px}
      .slw-recommendation-callout .slw-btn-black{width:100%}
      .slw-report-head{flex-direction:column;align-items:flex-start;gap:14px}
      .slw-pdf-btn{width:100%}
    }
  `}</style>
);
