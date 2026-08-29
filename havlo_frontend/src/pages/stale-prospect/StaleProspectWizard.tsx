import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CountryCodeSelect } from '../../components/shared/CountryCodeSelect';
import { StaleListingsLogo } from '../../components/shared/StaleListingsLogo';
import { Footer as SiteFooter } from '../../components/shared/Footer';
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
  type ActiveCompetitor,
  type ComparableSale,
  type FullReportData,
  type ProspectPreview,
  type ProspectReport,
  type ReportAction,
  type ThirtyDayPlanWeek,
  type WizardStep,
} from './types';

// ── Small shared bits ──────────────────────────────────────────────────────

// Same icon set as the "Homes that sit too long..." section on
// StaleListingsLanding.tsx, which this section's copy was taken from —
// reused verbatim rather than re-drawn so the house/bulb/handshake marks
// are pixel-identical to the rest of the site instead of rough approximations.
const PURPLE = '#A409D2';
const HouseIcon = () => (
  <svg width="28" height="28" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 19.9825V24.1665C5 29.6662 5 32.416 6.70855 34.1247C8.41708 35.8332 11.1669 35.8332 16.6667 35.8332H23.3333C28.833 35.8332 31.5828 35.8332 33.2915 34.1247C35 32.416 35 29.6662 35 24.1665V19.9825C35 17.1803 35 15.7794 34.4068 14.5666C33.8137 13.3538 32.7078 12.4936 30.496 10.7734L27.1627 8.18075C23.7218 5.50459 22.0015 4.1665 20 4.1665C17.9985 4.1665 16.2782 5.50459 12.8374 8.18075L9.50402 10.7734C7.29222 12.4936 6.18632 13.3538 5.59317 14.5666C5 15.7794 5 17.1803 5 19.9825Z" stroke={PURPLE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M28.333 29.1667V22.5" stroke={PURPLE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const BulbIcon = () => (
  <svg width="28" height="28" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10.149 24.9986C9.51836 23.5809 9.16675 22.0038 9.16675 20.3418C9.16675 14.1692 14.017 9.16528 20.0001 9.16528C25.9832 9.16528 30.8334 14.1692 30.8334 20.3418C30.8334 22.0038 30.4818 23.5809 29.8511 24.9986" stroke={PURPLE} strokeWidth="3" strokeLinecap="round" />
    <path d="M20 3.33191V4.99858" stroke={PURPLE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M36.6667 19.9988H35" stroke={PURPLE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4.99992 19.9988H3.33325" stroke={PURPLE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M31.784 8.21313L30.6055 9.39165" stroke={PURPLE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9.39458 9.39324L8.21606 8.21472" stroke={PURPLE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M24.1951 32.1759C25.8791 31.6313 26.5544 30.0899 26.7444 28.5396C26.8011 28.0764 26.4201 27.6923 25.9534 27.6923L14.1282 27.6926C13.6455 27.6926 13.2579 28.1023 13.3155 28.5814C13.5016 30.1288 13.9713 31.2591 15.7558 32.1759M24.1951 32.1759C24.1951 32.1759 16.0496 32.1759 15.7558 32.1759M24.1951 32.1759C23.9926 35.4176 23.0564 36.7014 20.0114 36.6654C16.7544 36.7256 16.0051 35.1388 15.7558 32.1759" stroke={PURPLE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const HandshakeIcon = () => (
  <svg width="28" height="28" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M36.6663 11.2498H32.0182C31.0163 11.2498 30.5153 11.2498 30.043 11.1068C29.5707 10.9638 29.1538 10.6859 28.3202 10.1302C27.0698 9.29655 25.6433 8.34559 24.9347 8.13104C24.2262 7.9165 23.4747 7.9165 21.9718 7.9165C19.9282 7.9165 18.6108 7.9165 17.692 8.2971C16.7732 8.6777 16.0506 9.40029 14.6055 10.8454L13.3337 12.1172C13.008 12.4429 12.8451 12.6058 12.7446 12.7665C12.3719 13.3625 12.4132 14.1283 12.8478 14.6807C12.9651 14.8297 13.1445 14.9741 13.5033 15.2629C14.8296 16.3302 16.7417 16.2237 17.9427 15.0155L19.9997 12.9463H21.6663L31.6663 23.0058C32.5868 23.9318 32.5868 25.433 31.6663 26.359C30.7458 27.285 29.2535 27.285 28.333 26.359L27.4997 25.5206M22.4997 27.1973L24.1663 28.8738C25.0868 29.7998 26.5792 29.7998 27.4997 28.8738C28.4202 27.948 28.4202 26.4466 27.4997 25.5206L22.4997 20.491M19.1663 23.864L22.4997 27.1973C23.4202 28.1231 23.4202 29.6245 22.4997 30.5505C21.5792 31.4763 20.0868 31.4763 19.1663 30.5505L16.6663 28.0355M3.33301 24.5831H3.86457C5.24647 24.5831 5.93744 24.5831 6.55692 24.8435C7.17641 25.104 7.65992 25.5975 8.62696 26.5846L13.333 31.3888C14.2535 32.3146 15.7459 32.3146 16.6663 31.3888C17.5868 30.4628 17.5868 28.9615 16.6663 28.0355L15.833 27.1973" stroke={PURPLE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M36.6667 24.5835H32.5" stroke={PURPLE} strokeWidth="3" strokeLinecap="round" />
    <path d="M14.1663 11.25H3.33301" stroke={PURPLE} strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="slw-header">
      <a href="/stale-listings" className="slw-logo-link"><StaleListingsLogo className="slw-logo-mark" /></a>
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

// Wrapped in slw-noprint (same as Header's nav) so the full marketing
// footer - newsletter, socials, nav links, disclaimer - never shows up in
// the "Download PDF Report" print output, only on the live wizard pages.
const Footer = () => (
  <div className="slw-noprint">
    <SiteFooter />
  </div>
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
  const activeRef = useRef<HTMLLIElement | null>(null);

  // On narrow viewports the stepper scrolls horizontally instead of
  // wrapping (matches the mobile design, which shows the active step
  // centered with neighbours peeking at both edges) — without this, later
  // steps render off-screen to the right with no indication to scroll.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeIndex]);

  return (
    <div className="slw-stepper-wrap slw-noprint">
      <ol className="slw-stepper">
        {STEPPER_ITEMS.map((item, index) => (
          <li
            key={item.key}
            ref={index === activeIndex ? activeRef : undefined}
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
  const handleCodeChange = (value: string) => {
    const next = value.replace(/\D/g, '').slice(0, 4);
    setCode(next);
    if (next.length === 4 && !loading) {
      window.setTimeout(() => onSubmit(next), 80);
    }
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
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M7.26562 7H9.23438L8.73438 9H6.76562L7.26562 7ZM14 3V13C14 13.2652 13.8946 13.5196 13.7071 13.7071C13.5196 13.8946 13.2652 14 13 14H3C2.73478 14 2.48043 13.8946 2.29289 13.7071C2.10536 13.5196 2 13.2652 2 13V3C2 2.73478 2.10536 2.48043 2.29289 2.29289C2.48043 2.10536 2.73478 2 3 2H13C13.2652 2 13.5196 2.10536 13.7071 2.29289C13.8946 2.48043 14 2.73478 14 3ZM13 6.5C13 6.36739 12.9473 6.24021 12.8536 6.14645C12.7598 6.05268 12.6326 6 12.5 6H10.5156L10.985 4.12125C11.0146 3.99351 10.9929 3.85926 10.9244 3.7474C10.856 3.63555 10.7464 3.55504 10.6192 3.52324C10.492 3.49144 10.3574 3.51088 10.2444 3.57738C10.1313 3.64388 10.049 3.7521 10.015 3.87875L9.48438 6H7.51562L7.985 4.12125C8.01462 3.99351 7.99287 3.85926 7.92445 3.7474C7.85602 3.63555 7.7464 3.55504 7.61919 3.52324C7.49198 3.49144 7.35737 3.51088 7.24436 3.57738C7.13135 3.64388 7.04898 3.7521 7.015 3.87875L6.48438 6H4C3.86739 6 3.74021 6.05268 3.64645 6.14645C3.55268 6.24021 3.5 6.36739 3.5 6.5C3.5 6.63261 3.55268 6.75979 3.64645 6.85355C3.74021 6.94732 3.86739 7 4 7H6.23438L5.73438 9H3.5C3.36739 9 3.24021 9.05268 3.14645 9.14645C3.05268 9.24021 3 9.36739 3 9.5C3 9.63261 3.05268 9.75979 3.14645 9.85355C3.24021 9.94732 3.36739 10 3.5 10H5.48438L5.015 11.8787C4.98286 12.0074 5.00313 12.1435 5.07134 12.2572C5.13956 12.3709 5.25013 12.4528 5.37875 12.485C5.41963 12.4952 5.46162 12.5002 5.50375 12.5C5.61514 12.4998 5.72329 12.4625 5.81104 12.3939C5.89879 12.3253 5.96111 12.2293 5.98812 12.1213L6.51562 10H8.48438L8.015 11.8787C7.98286 12.0074 8.00313 12.1435 8.07134 12.2572C8.13956 12.3709 8.25013 12.4528 8.37875 12.485C8.41842 12.4949 8.45913 12.4999 8.5 12.5C8.61139 12.4998 8.71954 12.4625 8.80729 12.3939C8.89504 12.3253 8.95736 12.2293 8.98438 12.1213L9.51562 10H12C12.1326 10 12.2598 9.94732 12.3536 9.85355C12.4473 9.75979 12.5 9.63261 12.5 9.5C12.5 9.36739 12.4473 9.24021 12.3536 9.14645C12.2598 9.05268 12.1326 9 12 9H9.76562L10.2656 7H12.5C12.6326 7 12.7598 6.94732 12.8536 6.85355C12.9473 6.75979 13 6.63261 13 6.5Z" fill="#333E48" />
            </svg>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Enter property ID"
              value={code}
              maxLength={4}
              onChange={(e) => handleCodeChange(e.target.value)}
            />
          </label>
          <p className="slw-id-hint">
            <span className="slw-info-dot">i</span> Your Property ID can be found on the letter you received from Havlo.
          </p>
          {error && <p className="slw-error">{error}</p>}
          <button type="submit" className="slw-btn-black slw-id-submit" disabled={loading} aria-label="Find my property">
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
            <HouseIcon />
            <h3>Spot What Buyers Notice</h3>
            <p>Uncover the small issues that can reduce buyer interest and slow down your sale.</p>
          </div>
          <div>
            <BulbIcon />
            <h3>Expert-Backed Selling Insights</h3>
            <p>Combine data-driven analysis with experienced local property expertise.</p>
          </div>
          <div>
            <HandshakeIcon />
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
              <span>
                <svg width="20" height="20" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M29.3332 23.334H2.6665" stroke="#A409D2" strokeWidth="2.66667" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M29.3332 28V21.3333C29.3332 18.8192 29.3332 17.5621 28.5521 16.7811C27.771 16 26.514 16 23.9998 16H7.99984C5.48568 16 4.2286 16 3.44756 16.7811C2.6665 17.5621 2.6665 18.8192 2.6665 21.3333V28" stroke="#A409D2" strokeWidth="2.66667" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M14.6667 16V13.6179C14.6667 13.1103 14.5904 12.9405 14.1996 12.7405C13.386 12.3239 12.3982 12 11.3333 12C10.2685 12 9.28073 12.3239 8.467 12.7405C8.07628 12.9405 8 13.1103 8 13.6179V16" stroke="#A409D2" strokeWidth="2.66667" strokeLinecap="round" />
                  <path d="M24.0002 16V13.6179C24.0002 13.1103 23.9239 12.9405 23.5331 12.7405C22.7195 12.3239 21.7318 12 20.6668 12C19.6019 12 18.6142 12.3239 17.8006 12.7405C17.4098 12.9405 17.3335 13.1103 17.3335 13.6179V16" stroke="#A409D2" strokeWidth="2.66667" strokeLinecap="round" />
                  <path d="M28 16V9.81409C28 8.89191 28 8.43081 27.7439 7.99537C27.4876 7.55993 27.1227 7.33455 26.3925 6.88377C23.4492 5.06637 19.8657 4 16 4C12.1342 4 8.55085 5.06637 5.60744 6.88377C4.87739 7.33455 4.51236 7.55993 4.25617 7.99537C4 8.43081 4 8.89191 4 9.81409V16" stroke="#A409D2" strokeWidth="2.66667" strokeLinecap="round" />
                </svg>
                {prospect.bedrooms} Bedrooms
              </span>
            ) : null}
            {prospect.bathrooms ? (
              <span>
                <svg width="20" height="20" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M25.3333 13.334H6.66667C5.19391 13.334 4 14.5279 4 16.0007C4 20.4189 7.58172 24.0007 12 24.0007H20C24.4183 24.0007 28 20.4189 28 16.0007C28 14.5279 26.8061 13.334 25.3333 13.334Z" stroke="#A409D2" strokeWidth="2.66667" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M6.6665 13.3327V8.66602C6.6665 7.56144 7.56193 6.66602 8.6665 6.66602C9.77108 6.66602 10.6665 7.56144 10.6665 8.66602V9.33268" stroke="#A409D2" strokeWidth="2.66667" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M9.33333 24L8 25.3333M22.6667 24L24 25.3333" stroke="#A409D2" strokeWidth="2.66667" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {prospect.bathrooms} Bathrooms
              </span>
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
  const [dialCode, setDialCode] = useState('+44');
  const [mobile, setMobile] = useState('');
  const [localError, setLocalError] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (email.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()) {
      setLocalError('Email and confirm email must match.');
      return;
    }
    setLocalError('');
    onSubmit({
      full_name: fullName.trim(),
      email: email.trim(),
      confirm_email: confirmEmail.trim(),
      mobile_number: `${dialCode} ${mobile.trim()}`.trim(),
    });
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
            <CountryCodeSelect value={dialCode} onChange={setDialCode} />
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

const SaleabilityGauge = ({ score, size = 247 }: { score: number; size?: number }) => {
  const angle = 180 - (Math.min(100, Math.max(0, score)) / 100) * 180;
  const r = size / 2 - 14;
  const cx = size / 2;
  const cy = size / 2;
  const point = (deg: number, radius = r) => ({
    x: cx + radius * Math.cos((deg * Math.PI) / 180),
    y: cy - radius * Math.sin((deg * Math.PI) / 180),
  });
  const arcPath = (from: number, to: number) => {
    const start = point(from);
    const end = point(to);
    return `M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`;
  };
  const segments = [
    { from: 180, to: 148, color: '#F03A17' },
    { from: 140, to: 108, color: '#FF8A00' },
    { from: 100, to: 68, color: '#D7D93A' },
    { from: 60, to: 28, color: '#3FD88E' },
    { from: 20, to: 0, color: '#09D9B2' },
  ];
  return (
    <div className="slw-gauge" style={{ width: size, height: size / 2 + 40 }}>
      <svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`}>
        {segments.map((segment) => (
          <path
            key={segment.color}
            d={arcPath(segment.from, segment.to)}
            fill="none"
            stroke={segment.color}
            strokeWidth="13"
            strokeLinecap="round"
          />
        ))}
        <path
          d={`M ${cx - r - 8} ${cy} A ${r + 8} ${r + 8} 0 0 1 ${cx + r + 8} ${cy}`}
          fill="none"
          stroke="#d1d5db"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="0.5 8"
        />
        <line
          x1={cx}
          y1={cy}
          x2={cx + r * 0.48 * Math.cos((angle * Math.PI) / 180)}
          y2={cy - r * 0.48 * Math.sin((angle * Math.PI) / 180)}
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

// ── Shared: long-text handling ──────────────────────────────────────────────
//
// Real Groq-generated report text runs 1000-3000+ characters per field (the
// prompt deliberately asks for consultant-length prose), which is exactly
// right for a report someone paid for and wants to actually read, but is far
// too dense for the small, scannable cards the design uses. Rather than
// shortening the underlying content, every long block on these two pages is
// shown clamped by default with a "Read more" toggle — nothing is ever lost,
// the page just doesn't open looking like a wall of text.

// Re-chunks long text into short, readable paragraphs for display. Two
// problems this solves at once:
// - executive_summary genuinely has \n\n breaks in the data, but each one
//   is still a dense 4-6 sentence block — real, but not fine-grained
//   enough to read comfortably.
// - evidence/impact/recommend (derived by splitIntoThree below for any
//   report older than that schema) have NO breaks at all: splitIntoThree
//   joins each third of the sentences with a single space, so pre-line
//   has nothing to render as a break and the whole thing looks like one
//   wall of text regardless of the white-space CSS.
// Treating any existing blank line as a hard boundary (never merging two
// authored paragraphs into one) and then re-splitting every paragraph
// down to at most `perParagraph` sentences fixes both: real paragraph
// intent is preserved, and anything longer just gets broken up further.
function reflowParagraphs(text: string, perParagraph = 2): string {
  const clean = (text || '').trim();
  if (!clean) return '';
  const paragraphs = clean.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  for (const paragraph of paragraphs.length ? paragraphs : [clean]) {
    const sentences = paragraph.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).filter(Boolean);
    for (let i = 0; i < sentences.length; i += perParagraph) {
      out.push(sentences.slice(i, i + perParagraph).join(' '));
    }
  }
  return out.join('\n\n');
}

const ExpandableText = ({
  text,
  maxChars = 220,
  allowExpand = true,
  as: Tag = 'p',
  className,
}: {
  text?: string;
  maxChars?: number;
  allowExpand?: boolean;
  as?: 'p' | 'span';
  className?: string;
}) => {
  const [expanded, setExpanded] = useState(false);
  // "Read more" clamping only makes sense on screen — the truncated string
  // is all the DOM ever contains when collapsed, so printing/downloading a
  // PDF while collapsed would permanently lose that text from the page (no
  // amount of print CSS can bring back text that was never rendered). Force
  // every instance open for the duration of the print, and hide the button
  // itself since there's nothing to click on paper.
  const [forcePrint, setForcePrint] = useState(false);
  useEffect(() => {
    const onBeforePrint = () => setForcePrint(true);
    const onAfterPrint = () => setForcePrint(false);
    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('afterprint', onAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('afterprint', onAfterPrint);
    };
  }, []);
  const raw = (text || '').trim();
  if (!raw) return null;
  const clean = reflowParagraphs(raw);
  const isLong = clean.length > maxChars;
  const truncated = isLong ? clean.slice(0, maxChars).replace(/\s+\S*$/, '') + '…' : clean;
  const shown = expanded || forcePrint ? clean : truncated;
  return (
    // The underlying text is written (and, since the duplication fix,
    // stored) as \n\n-separated paragraphs, but plain HTML collapses
    // newlines by default — every long field was rendering as one
    // undifferentiated block no matter how it was punctuated in the data.
    // pre-line respects the existing blank lines as real paragraph breaks
    // while still wrapping normally within each line.
    <Tag className={className} style={{ whiteSpace: 'pre-line' }}>
      {shown}
      {isLong && allowExpand && !forcePrint && (
        <button type="button" className="slw-read-more slw-noprint" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </Tag>
  );
};

// Older reports (generated before evidence/impact/recommend existed) only
// ever stored one long `description` per finding. Rather than showing those
// three labels with nothing under them, split the description into rough
// thirds on sentence boundaries so every report — old or new — gets a
// sensible EVIDENCE / IMPACT / RECOMMEND breakdown.
function splitIntoThree(text: string): [string, string, string] {
  const clean = (text || '').trim();
  if (!clean) return ['', '', ''];
  const sentences = clean.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).filter(Boolean);
  if (sentences.length < 3) return [clean, '', ''];
  const third = Math.ceil(sentences.length / 3);
  return [
    sentences.slice(0, third).join(' '),
    sentences.slice(third, third * 2).join(' '),
    sentences.slice(third * 2).join(' '),
  ];
}

// Same idea for action_plan.why_it_matters, which is also empty on older
// reports — fall back to the description's first sentence.
function firstSentence(text: string): string {
  const clean = (text || '').trim();
  if (!clean) return '';
  const match = clean.match(/^.*?[.!?](?=\s|$)/);
  return (match ? match[0] : clean).trim();
}

// Older reports never generated active_competition (currently-listed
// properties competing for the same buyers), but they do have
// comparable_sales (recently sold nearby properties) — real, sourced data,
// just a different kind of comparison. Reusing it keeps the section always
// populated with something true rather than inventing competitor listings
// that were never actually found.
function deriveCompetitionFromComparables(comparableSales?: ComparableSale[]): ActiveCompetitor[] {
  return (comparableSales || [])
    .filter((sale) => !sale.is_subject)
    .map((sale) => ({
      address: sale.address,
      price: sale.sold_asking,
      beds: typeof sale.beds === 'number' ? sale.beds : undefined,
      differentiator: sale.property_type,
    }));
}

// Older reports never generated thirty_day_plan either. action_plan is
// always present and already ordered URGENT -> HIGH -> MEDIUM, so bucket
// those same real actions into four weeks instead of showing an empty
// section — every word is still something the report actually said.
function deriveThirtyDayPlanFromActions(actions?: ReportAction[]): ThirtyDayPlanWeek[] {
  const list = (actions || []).filter((a) => a.title);
  if (!list.length) return [];
  const weekCount = Math.min(4, list.length);
  const weeks: ThirtyDayPlanWeek[] = [];
  // Distribute evenly across exactly weekCount weeks (never fewer): taking a
  // flat ceil(list.length / weekCount) per week only works when it divides
  // evenly - e.g. 6 actions over 4 weeks gives ceil(6/4)=2/week, which uses
  // up all 6 actions in 3 weeks and leaves week 4 with nothing to slice, so
  // it silently got dropped instead of shown. Recomputing the chunk size
  // from what's left before each week guarantees every week gets at least
  // one item.
  let idx = 0;
  for (let i = 0; i < weekCount; i++) {
    const remainingWeeks = weekCount - i;
    const take = Math.ceil((list.length - idx) / remainingWeeks);
    const chunk = list.slice(idx, idx + take);
    idx += take;
    weeks.push({ week: i + 1, title: chunk.map((a) => a.title).join(' and ') });
  }
  return weeks;
}

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
                <ExpandableText text={finding.description} maxChars={150} />
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

      <div className="slw-rating">
        <span>Excellent</span>
        <span className="slw-trustpilot-stars" aria-hidden="true">
          {Array.from({ length: 5 }).map((_, i) => <i key={i}>★</i>)}
        </span>
        <b>Based on verified customer feedback</b>
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

const CardMethodIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={PURPLE} strokeWidth="1.8"><rect x="2" y="5" width="20" height="14" rx="2.5" /><path d="M2 10h20" /><path d="M6 15h4" /></svg>
);
const BankMethodIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={PURPLE} strokeWidth="1.8"><path d="M3 10l9-6 9 6" /><path d="M4 10v9M9 10v9M15 10v9M20 10v9" /><path d="M2 21h20" /></svg>
);
const PromoMethodIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={PURPLE} strokeWidth="1.8"><path d="M20.5 12.79V6a1 1 0 0 0-1-1h-6.79a1 1 0 0 0-.7.29l-8 8a1 1 0 0 0 0 1.42l6.79 6.79a1 1 0 0 0 1.42 0l8-8a1 1 0 0 0 .28-.71z" /><circle cx="16" cy="8" r="1.4" fill={PURPLE} stroke="none" /></svg>
);

const PaymentStep = ({
  prospect,
  onPayCard,
  onPayBankTransfer,
  onApplyPromo,
  bankDetails,
  loading,
  error,
}: {
  prospect: ProspectPreview;
  onPayCard: () => void;
  onPayBankTransfer: () => void;
  onApplyPromo: (code: string) => void;
  bankDetails: { reference: string; accountName: string; accountNumber: string; bankName: string } | null;
  loading: boolean;
  error: string;
}) => {
  const [method, setMethod] = useState<'card' | 'bank_transfer' | 'promo'>('card');
  const [promoCode, setPromoCode] = useState('');
  const snapshot = prospect.listing_snapshot || {};
  const image = snapshot.image || (snapshot.images && snapshot.images[0]) || '';
  const price = unlockPrice(prospect.asking_price);

  const handlePayClick = () => {
    if (method === 'card') onPayCard();
    else if (method === 'bank_transfer') onPayBankTransfer();
    else if (promoCode.trim()) onApplyPromo(promoCode.trim());
  };

  return (
    <section className="slw-payment">
      <h1>Unlock your full property assessment</h1>
      <div className="slw-payment-grid">
        <div className="slw-payment-methods">
          <b>Select a payment method to continue.</b>
          <button type="button" className={`slw-method ${method === 'card' ? 'slw-method-active' : ''}`} onClick={() => setMethod('card')}>
            <span className="slw-method-icon"><CardMethodIcon /></span>
            <span><b>Card</b><small>Visa, Amex, MasterCard, Verve</small></span>
          </button>
          <button type="button" className={`slw-method ${method === 'bank_transfer' ? 'slw-method-active' : ''}`} onClick={() => setMethod('bank_transfer')}>
            <span className="slw-method-icon"><BankMethodIcon /></span>
            <span><b>Bank Transfer</b><small>Pay Directly from your Bank</small></span>
          </button>
          {method === 'promo' ? (
            // Selecting Promo Code transforms this card in place into the
            // input, rather than adding a separate field below it.
            <div className="slw-method slw-method-active">
              <span className="slw-method-icon"><PromoMethodIcon /></span>
              <input
                type="text"
                className="slw-promo-inline-input"
                placeholder="Enter promo code"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                autoCapitalize="characters"
                autoFocus
              />
            </div>
          ) : (
            <button type="button" className="slw-method" onClick={() => setMethod('promo')}>
              <span className="slw-method-icon"><PromoMethodIcon /></span>
              <span><b>Promo Code</b><small>Have a code? Redeem it here</small></span>
            </button>
          )}
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
            disabled={loading || (method === 'promo' && !promoCode.trim())}
            onClick={handlePayClick}
          >
            {loading
              ? 'Processing…'
              : method === 'card'
                ? `Pay ${formatGbp(price, { maximumFractionDigits: 2 })} & View My Report`
                : method === 'bank_transfer'
                  ? 'Get Bank Transfer Details'
                  : 'Apply Code & View My Report'}
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
    <svg className="slw-success-check" width="80" height="80" viewBox="0 0 80 80" fill="none">
      <path
        d="M40 4l4.7 6.2 7.4-2.6 2.4 7.5 7.8.4-.4 7.8 7.5 2.4-2.6 7.4L73 40l-6.2 4.7 2.6 7.4-7.5 2.4-.4 7.8-7.8-.4-2.4 7.5-7.4-2.6L40 73l-4.7-6.2-7.4 2.6-2.4-7.5-7.8-.4.4-7.8-7.5-2.4 2.6-7.4L4 40l6.2-4.7-2.6-7.4 7.5-2.4.4-7.8 7.8.4 2.4-7.5 7.4 2.6L40 4z"
        fill="#d1fae5"
      />
      <path d="M27 41l9 9 17-17" stroke="#059669" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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

  // The property card is a float (see the layout comment below), so a
  // plain grid/flex align-items:stretch can't make the executive summary
  // card match its height anymore — nothing in CSS can size one float's
  // sibling off the float's own height. Measuring it directly is the only
  // way to get "own card, same height as the property card at rest" back
  // while keeping the float's "text flows past it once expanded" behaviour:
  // min-height only ever acts as a floor, so once Read More grows the text
  // taller than this, the card simply grows past it exactly as before.
  const propertyCardRef = useRef<HTMLDivElement>(null);
  const [propertyCardHeight, setPropertyCardHeight] = useState<number | undefined>(undefined);
  useEffect(() => {
    const el = propertyCardRef.current;
    if (!el) return;
    const update = () => setPropertyCardHeight(el.getBoundingClientRect().height);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const heroFindings = (data.key_findings || []).filter((f) => f.type === 'issue').slice(0, 2);
  if (heroFindings.length < 2) {
    for (const f of data.key_findings || []) {
      if (heroFindings.length >= 2) break;
      if (!heroFindings.includes(f)) heroFindings.push(f);
    }
  }

  // Competition analysis and the 30-day plan must always have something —
  // older reports never generated active_competition/thirty_day_plan, so
  // fall back to real data the report does have (comparable_sales,
  // action_plan) rather than showing an empty section.
  const hasRealCompetition = (data.active_competition || []).length > 0;
  const competitionItems = hasRealCompetition
    ? (data.active_competition as ActiveCompetitor[])
    : deriveCompetitionFromComparables(data.comparable_sales);
  const thirtyDayPlan = (data.thirty_day_plan || []).length > 0
    ? (data.thirty_day_plan as ThirtyDayPlanWeek[])
    : deriveThirtyDayPlanFromActions(data.action_plan);

  return (
    <section className="slw-report">
      <div className="slw-report-head">
        <h1>Full Property Assessment</h1>
        <button type="button" className="slw-btn-outline slw-pdf-btn" onClick={onDownloadPdf}>Download PDF Report</button>
      </div>

      <div className="slw-report-summary-row">
        {/* Property card is floated and comes first in source order so the
            executive summary text below wraps around it at the top and,
            once the text runs taller than the image/price block, keeps
            going at the row's full width underneath — a float is the only
            way to get that "narrow beside it, full-width once past it"
            reflow with plain CSS; a grid can't do it since both columns
            are always the same fixed width top to bottom. */}
        <div className="slw-report-property-card" ref={propertyCardRef}>
          <div className="slw-report-image" style={image ? { backgroundImage: `url(${image})` } : undefined} />
          <div className="slw-report-property-text">
            <h2>{report.property_address}</h2>
            <div className="slw-assess-facts">
              <div><span>Asking Price</span><b className="slw-accent">{formatGbp(report.asking_price)}</b></div>
              <div><span>Days on Market</span><b>{report.listing_duration_days ?? '—'} days</b></div>
            </div>
          </div>
        </div>
        <div className="slw-report-summary-card" style={propertyCardHeight ? { minHeight: propertyCardHeight } : undefined}>
          <b>Executive summary</b>
          <ExpandableText text={data.executive_summary} maxChars={320} />
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
        {heroFindings.map((finding, i) => {
          // Reports generated before evidence/impact/recommend existed only
          // ever stored one long description — derive the three-way split
          // from it instead of rendering three labels with nothing under them.
          const hasStructured = finding.evidence && finding.impact && finding.recommend;
          const [ev, im, rec] = hasStructured
            ? [finding.evidence as string, finding.impact as string, finding.recommend as string]
            : splitIntoThree(finding.description || '');
          return (
            <div className="slw-why-card" key={i}>
              <h3>{String(i + 1).padStart(2, '0')} &mdash; {finding.title}</h3>
              <div><span className="slw-why-label slw-why-evidence">EVIDENCE</span><ExpandableText text={ev} maxChars={180} /></div>
              <div><span className="slw-why-label slw-why-impact">IMPACT</span><ExpandableText text={im} maxChars={180} /></div>
              <div><span className="slw-why-label slw-why-recommend">RECOMMEND</span><ExpandableText text={rec} maxChars={180} /></div>
            </div>
          );
        })}
      </div>

      <div className={`slw-report-two-col ${competitionItems.length === 0 ? 'slw-report-two-col-single' : ''}`}>
        {competitionItems.length > 0 && (
          <div className="slw-competition-card">
            <b>Competition analysis</b>
            <p>{hasRealCompetition ? 'Properties currently competing for the same buyers:' : 'Recent comparable sales in the area:'}</p>
            {competitionItems.map((c, i) => (
              <div className="slw-competitor-row" key={i}>
                <div>
                  <b>{c.address}</b>
                  <span>{[c.beds ? `${c.beds} bed` : null, c.distance, c.differentiator].filter(Boolean).join(' · ')}</span>
                </div>
                <div className="slw-competitor-price">
                  <b>{c.price}</b>
                  {c.days_listed != null && <span>{c.days_listed} days listed</span>}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="slw-actions-card">
          <b>Recommended actions</b>
          {/* Two highlighted headline points, not the full write-up — this
              card sits next to Competition analysis (a handful of short
              comparable rows) and used to run every action's full
              paragraph-length description, making it several times taller
              than its neighbour. The complete list with full detail lives
              one click away in the Recommendation modal. */}
          {(data.action_plan || []).slice(0, 2).map((action, i) => {
            const highlight = action.why_it_matters || firstSentence(action.description || '');
            return (
              <div className="slw-action-highlight" key={i}>
                <b>{action.title}</b>
                {highlight && <p>{highlight}</p>}
              </div>
            );
          })}
          {(data.action_plan || []).length > 2 && (
            <button type="button" className="slw-actions-see-all" onClick={onOpenRecommendation}>
              See all {data.action_plan!.length} recommended actions →
            </button>
          )}
        </div>
      </div>

      {thirtyDayPlan.length > 0 && (
        <>
          <h2 className="slw-section-heading">30-day action plan</h2>
          <div className="slw-thirty-day-grid">
            {thirtyDayPlan.map((week) => (
              <div className="slw-week-card" key={week.week}>
                <span>Week {week.week}</span>
                <b>{week.title}</b>
              </div>
            ))}
          </div>
        </>
      )}

      {/* On screen this is just a callout with a button that opens the modal
          below — meaningless once printed (a button can't be clicked on
          paper, and the modal is never in the DOM unless it's actually
          open), which is exactly why the printed/downloaded report never
          contained the recommendations at all. slw-noprint hides this;
          .slw-print-recommendation right after it is the opposite - hidden
          on screen, shown only in print - and renders the same full detail
          the modal does, so the PDF actually contains it. */}
      <div className="slw-recommendation-callout slw-noprint">
        <b>Havlo Stale Listing Recommendation</b>
        <button type="button" className="slw-btn-black" onClick={onOpenRecommendation}>View full recommendation</button>
      </div>
      <div className="slw-print-recommendation">
        <h2 className="slw-section-heading">Havlo Stale Listing Recommendation</h2>
        <div className="slw-modal-body">
          <RecommendationContent contactName={report.contact_name || ''} actions={data.action_plan || []} />
        </div>
      </div>
    </section>
  );
};

// ── Recommendation modal ────────────────────────────────────────────────────

const RecommendationContent = ({ contactName, actions }: { contactName: string; actions: ReportAction[] }) => (
  <>
    <p>Dear {contactName || '(name)'},</p>
    <p>Following our assessment of your property&rsquo;s current market position, here is the complete set of recommended actions in priority order, along with why each one matters and how to execute it:</p>

    {actions.map((action, i) => (
      <div className="slw-modal-action" key={i}>
        <h3>{i + 1}) {action.title}
          {action.priority && <span className="slw-modal-priority"> &middot; {action.priority}</span>}
        </h3>
        {action.description && <p style={{ whiteSpace: 'pre-line' }}>{reflowParagraphs(action.description)}</p>}
        {action.why_it_matters && <p><i>Why it matters: {action.why_it_matters}</i></p>}
        {(action.bullets || []).length > 0 && (
          <ul className="slw-modal-bullets">
            {action.bullets!.map((bullet, bi) => <li key={bi}>{bullet}</li>)}
          </ul>
        )}
      </div>
    ))}

    <h3>OUR ADVISORY VIEW</h3>
    <p>We recommend working through these actions in the order shown, starting with the highest-priority items, and reviewing the result of each before moving to the next.<br />
    Your existing agent remains fully in control of the sale &mdash; these recommendations are designed to support their work, not replace it.</p>

    <h3>Prepared &amp; reviewed by</h3>
    <p className="slw-modal-team">Havlo Sales Advisory Team</p>
    <p>Property Intelligence &bull; Sales Strategy &bull; Buyer Generation</p>
    <p className="slw-modal-disclaimer">This recommendation is strategic guidance based on the information available to Havlo at the time of assessment. Individual strategies should be evaluated against the property&rsquo;s circumstances and current market conditions. Results will vary and no particular strategy guarantees a sale.</p>
  </>
);

const RecommendationModal = ({
  contactName,
  actions,
  onClose,
}: {
  contactName: string;
  actions: ReportAction[];
  onClose: () => void;
}) => (
  <div className="slw-modal-overlay" onClick={onClose}>
    <div className="slw-modal" onClick={(e) => e.stopPropagation()}>
      <div className="slw-modal-head">
        <h2>Havlo Stale Listing Recommendation</h2>
        <button type="button" className="slw-modal-close" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="slw-modal-scroll">
      <div className="slw-modal-body">
        <RecommendationContent contactName={contactName} actions={actions} />
      </div>
      </div>
    </div>
  </div>
);

// ── Main wizard ─────────────────────────────────────────────────────────────

export const StaleProspectWizard = () => {
  const [params, setSearchParams] = useSearchParams();
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

  useEffect(() => {
    document.body.classList.add('slw-prospect-active');
    const hideInjectedChat = () => {
      const tawk = (window as any).Tawk_API;
      if (tawk?.hideWidget) tawk.hideWidget();
      document.querySelectorAll<HTMLElement>('body > iframe, body > div#chat-bubble').forEach((element) => {
        element.style.setProperty('display', 'none', 'important');
        element.style.setProperty('visibility', 'hidden', 'important');
        element.style.setProperty('pointer-events', 'none', 'important');
      });
    };
    hideInjectedChat();
    const observer = new MutationObserver(hideInjectedChat);
    observer.observe(document.body, { childList: true, subtree: false });
    return () => {
      observer.disconnect();
      document.body.classList.remove('slw-prospect-active');
      const tawk = (window as any).Tawk_API;
      if (tawk?.showWidget) tawk.showWidget();
    };
  }, []);

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
        } else if (!data.has_contact_details) {
          // property_confirmed/has_contact_details must be checked before
          // payment_status: every prospect is created with payment_status
          // "pending" (it only ever becomes "completed", never anything
          // else pre-payment), so a prospect who has never even confirmed
          // their property still has payment_status "pending" - checking
          // that first (as this used to) sent every fresh QR-code scan
          // straight to the Payment step, skipping Confirm Property and
          // Your Details entirely.
          setStep(data.property_confirmed ? 'details' : 'confirm');
        } else if (data.payment_status === 'pending') {
          // Already has contact details on file and isn't unlocked yet -
          // either landed back from a SumUp/bank-transfer redirect while
          // still confirming, or is simply revisiting the same link after
          // already reaching Payment - either way, resume the same polling
          // the payment step itself would run.
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
        } else {
          setStep('assessment');
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

  // Keep the URL's token/code in sync with access as the user progresses
  // through the wizard, so refreshing on any step (confirm, details,
  // assessment, payment...) has something for the resume-on-reload effect
  // above to key off — otherwise a refresh always lands back on 'landing'.
  useEffect(() => {
    if (!access.token && !access.code) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (access.token) next.set('token', access.token);
        if (access.code) next.set('code', access.code);
        return next;
      },
      { replace: true },
    );
  }, [access.token, access.code, setSearchParams]);

  const handleGoBack = () => {
    if (step === 'confirm' || step === 'not_found') setStep('landing');
    else if (step === 'details') setStep('confirm');
    else if (step === 'assessment') setStep('details');
    else if (step === 'payment') setStep('assessment');
    else if (step === 'success') setStep('payment');
    else if (step === 'report') setStep('success');
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

  // createProspectCheckout (unlike getProspectReport/getProspectPaymentStatus)
  // matches the backend schema field name property_code, not access's own
  // code field - spreading `access` straight into it sends a `code` key the
  // backend's checkout endpoint doesn't recognize, so every checkout call
  // must translate through this instead of `...access`.
  const checkoutAccess = () => (access.token ? { token: access.token } : { property_code: access.code });

  const handlePayCard = async () => {
    setLoading(true);
    setError('');
    try {
      const redirectUrl = window.location.href.split('#')[0];
      const result = await createProspectCheckout({ ...checkoutAccess(), payment_method: 'card', redirect_url: redirectUrl });
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

  const handleApplyPromo = async (code: string) => {
    setLoading(true);
    setError('');
    try {
      // payment_method here is a required field but irrelevant once a valid
      // promo_code is present — the backend unlocks on the code alone before
      // it ever looks at how payment would otherwise have been taken.
      const result = await createProspectCheckout({ ...checkoutAccess(), payment_method: 'card', promo_code: code });
      if (result.unlocked) {
        await loadReport();
        setStep('success');
      } else {
        setError('That promo code is not valid. Please check it and try again.');
      }
    } catch {
      setError('We could not apply that code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePayBankTransfer = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await createProspectCheckout({ ...checkoutAccess(), payment_method: 'bank_transfer' });
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
        {step !== 'landing' && step !== 'finding' && <Stepper step={step} />}
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
              onApplyPromo={handleApplyPromo}
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
        <RecommendationModal
          contactName={report?.contact_name || ''}
          actions={report?.report_data?.action_plan || []}
          onClose={() => setShowRecommendation(false)}
        />
      )}
      <WizardStyles />
    </div>
  );
};

const WizardStyles = () => (
  <style>{`
    .slw-page{font-family:'Inter','Plus Jakarta Sans',sans-serif;color:#1f2024;background:#fff;min-height:100vh;display:flex;flex-direction:column}
    body.slw-prospect-active{overflow-x:hidden}
    body.slw-prospect-active > iframe,
    body.slw-prospect-active #chat-bubble{display:none !important;visibility:hidden !important;pointer-events:none !important}
    .slw-page *{box-sizing:border-box}
    .slw-header{display:flex;align-items:center;justify-content:space-between;padding:16px max(24px,calc((100vw - 1240px)/2));border-bottom:1px solid #eee;position:relative}
    .slw-logo-link{display:inline-flex;align-items:center;text-decoration:none;color:inherit}
    .slw-footer{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:24px max(24px,calc((100vw - 1240px)/2));border-top:1px solid #eee;color:#2f3034;font-size:13px;font-weight:700}
    .slw-footer-links{display:flex;gap:20px}
    .slw-footer-links a{color:#2f3034;text-decoration:none}
    .slw-logo-mark{width:137px;height:52px;display:block;object-fit:contain}
    .slw-nav{display:flex;gap:32px;font-weight:600;font-size:15px}
    .slw-nav a{color:#111;text-decoration:none}
    .slw-burger{display:none;flex-direction:column;gap:4px;background:none;border:none;cursor:pointer;padding:8px}
    .slw-burger span{width:22px;height:2px;background:#111;display:block}
    .slw-mobile-nav{position:absolute;top:100%;left:0;right:0;background:#fff;border-bottom:1px solid #eee;display:flex;flex-direction:column;padding:12px 20px;gap:14px;font-weight:600;z-index:20}
    .slw-mobile-nav a{color:#111;text-decoration:none}

    .slw-shell{max-width:1240px;margin:0 auto;width:min(calc(100% - 200px),1240px);flex:1}
    .slw-goback{display:flex;align-items:center;gap:8px;background:none;border:none;color:#666;font-size:14px;cursor:pointer;padding:58px 0 0;font-family:inherit}
    .slw-stepper-wrap{overflow-x:auto;margin:48px 0 36px;-ms-overflow-style:none;scrollbar-width:none}
    .slw-stepper-wrap::-webkit-scrollbar{display:none}
    .slw-stepper{display:flex;align-items:center;justify-content:space-between;list-style:none;margin:0;padding:0;white-space:nowrap;font-size:15px;font-weight:700;color:#26313d}
    .slw-stepper li{display:flex;align-items:center;gap:24px}
    .slw-step-sep{width:56px;height:1px;background:#e2e4e8;margin:0}
    .slw-step-active{color:#A409D2}
    .slw-step-done{color:#111}
    .slw-main{padding:0 0 80px}

    .slw-accent{color:#A409D2}
    .slw-hero{text-align:center;max-width:760px;margin:48px auto 0;position:relative;z-index:2;padding-bottom:34px}
    .slw-hero h1{font-family:'Right Grotesk','Bricolage Grotesque',sans-serif;font-weight:900;font-size:64px;line-height:100%;letter-spacing:-0.03em;text-align:center;text-box-trim:both;text-box-edge:cap alphabetic;margin:0;color:#202124}
    .slw-hero-copy{font-family:'Inter',sans-serif;font-weight:500;color:#334155;font-size:16px;line-height:150%;letter-spacing:-0.02em;text-align:center;text-box-trim:both;text-box-edge:cap alphabetic;margin:18px auto 0;max-width:590px}
    .slw-id-form{margin:24px auto 0;max-width:560px}
    .slw-id-input{display:flex;align-items:center;gap:18px;background:#eef0f2;border-radius:12px;padding:16px 18px;color:#111}
    .slw-id-input input{border:none;background:none;outline:none;font-size:16px;flex:1;color:#111;font-family:inherit}
    .slw-id-input input::placeholder{color:#9aa0a6}
    .slw-id-hint{display:flex;align-items:center;justify-content:center;gap:8px;color:#334155;font-size:13px;margin:10px 0 0}
    .slw-info-dot{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:#A409D2;color:#fff;font-size:11px;font-style:italic;font-weight:700;flex:none}
    .slw-id-submit{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;padding:0;border:0}
    .slw-error{color:#c02626;font-size:14px;margin:10px 0 0}

    .slw-stats{display:flex;justify-content:center;gap:64px;margin:24px 0 0}
    .slw-stats b{font-family:'Righteous',cursive;font-weight:400;font-size:32px;line-height:120%;letter-spacing:-0.03em;text-box-trim:both;text-box-edge:cap alphabetic;display:block;color:#202124}
    .slw-stats span{color:#334155;font-size:13px;line-height:1.55}
    .slw-rating{display:flex;align-items:center;justify-content:center;gap:10px;margin:20px 0 0;font-size:14px;font-weight:700}
    .slw-rating b{font-family:'Inter',sans-serif;font-weight:700;font-size:16px;line-height:150%;letter-spacing:-0.02em;text-box-trim:both;text-box-edge:cap alphabetic}
    .slw-trustpilot-stars{display:inline-flex;gap:3px}
    .slw-trustpilot-stars i{background:#00b67a;color:#fff;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-style:normal;font-size:13px;border-radius:3px}

    .slw-hero-image{height:510px;border-radius:0;margin:-118px calc(50% - 50vw) 0;background:#fff;position:relative;overflow:hidden;z-index:1}
    .slw-hero-image::before{content:"";position:absolute;left:0;right:0;top:0;height:240px;background:linear-gradient(180deg,#fff 0%,rgba(255,255,255,.96) 26%,rgba(255,255,255,.66) 58%,rgba(255,255,255,0) 100%);z-index:2;pointer-events:none}
    .slw-hero-image::after{content:"";position:absolute;inset:0;background:url('/stale-listings/hero-house.png') center -146px / cover no-repeat;z-index:1}

    .slw-value-section{padding:72px 4px 64px}
    .slw-value-section h2{font-family:'Plus Jakarta Sans','Inter',sans-serif;font-weight:600;font-size:48px;line-height:120%;letter-spacing:-0.03em;text-box-trim:both;text-box-edge:cap alphabetic;margin:0 0 80px;color:#202124}
    .slw-value-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:46px}
    .slw-value-grid svg{color:#A409D2;margin-bottom:50px}
    .slw-value-grid h3{font-family:'Plus Jakarta Sans','Inter',sans-serif;font-size:32px;line-height:120%;letter-spacing:-0.03em;text-box-trim:both;text-box-edge:cap alphabetic;margin:0 0 14px;font-weight:600;color:#202124}
    .slw-value-grid p{color:#111;font-size:18px;line-height:1.45;margin:0}

    .slw-finding{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;padding:120px 0;color:#555;font-size:16px}
    .slw-spinner{width:40px;height:40px;border-radius:50%;border:3px solid #eee;border-top-color:#A409D2;animation:slw-spin 0.8s linear infinite}
    @keyframes slw-spin{to{transform:rotate(360deg)}}

    .slw-confirm{max-width:none;margin:0 auto;text-align:center}
    .slw-confirm h1{font-family:'Right Grotesk','Bricolage Grotesque',sans-serif;font-weight:900;font-size:40px;line-height:100%;letter-spacing:-0.03em;text-align:center;text-box-trim:both;text-box-edge:cap alphabetic;margin:0 0 12px;color:#202124}
    .slw-confirm-copy{font-family:'Inter',sans-serif;font-weight:500;color:#334155;margin:0 0 38px;font-size:20px;line-height:150%;letter-spacing:-0.02em;text-box-trim:both;text-box-edge:cap alphabetic}
    .slw-confirm-card{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid #eee;border-radius:16px;overflow:hidden;text-align:left;background:#fff}
    .slw-confirm-image{min-height:542px;background-size:cover;background-position:center;background-color:#e5e7eb}
    .slw-confirm-details{padding:36px 40px;display:flex;flex-direction:column;justify-content:center}
    .slw-confirm-details h2{font-family:'Bricolage Grotesque',sans-serif;font-size:40px;font-weight:300;letter-spacing:-0.03em;text-box-trim:both;text-box-edge:cap alphabetic;margin:0 0 14px;line-height:100%;color:#202124}
    .slw-confirm-price{font-family:'Bricolage Grotesque',sans-serif;color:#A409D2;font-size:32px;font-weight:500;line-height:100%;letter-spacing:-0.03em;text-box-trim:both;text-box-edge:cap alphabetic}
    .slw-badge{display:inline-block;align-self:flex-start;background:#fbeaff;color:#A409D2;font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px;margin-top:8px}
    .slw-confirm-facts{display:flex;gap:34px;margin:28px 0 44px;padding-top:28px;border-top:1px solid #eee;color:#333;font-family:'Inter',sans-serif;font-weight:500;font-size:20px;line-height:150%;letter-spacing:-0.02em}
    .slw-confirm-facts span{display:flex;align-items:center;gap:8px}
    .slw-confirm-facts svg{color:#A409D2}
    .slw-confirm-question{font-family:'Inter',sans-serif;font-weight:500;font-size:20px;line-height:150%;letter-spacing:-0.02em;text-box-trim:both;text-box-edge:cap alphabetic;margin:0 0 18px;text-align:center}

    .slw-btn-black{background:#0a0a0a;color:#fff;border:none;border-radius:7px;padding:16px 24px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit;width:100%}
    .slw-btn-black:disabled{opacity:0.6;cursor:default}
    .slw-btn-outline{background:#fff;color:#111;border:1px solid #ddd;border-radius:7px;padding:16px 24px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit;width:100%;margin-top:12px}
    .slw-id-submit{display:none !important}

    .slw-not-found{max-width:520px;margin:62px auto 0;text-align:center}
    .slw-not-found-illustration{width:300px;margin:0 auto 34px;display:block}
    .slw-not-found h1{font-family:'Right Grotesk','Bricolage Grotesque',sans-serif;font-weight:900;font-size:39px;line-height:1;margin:0 0 18px;color:#202124}
    .slw-not-found p{color:#334155;margin:0 0 36px;font-size:16px;line-height:1.45}
    .slw-help-link{display:block;margin-top:18px;color:#A409D2;font-weight:700;text-decoration:none}

    .slw-details{max-width:640px;margin:0 auto;text-align:center}
    .slw-details h1{font-family:'Right Grotesk','Bricolage Grotesque',sans-serif;font-weight:900;font-size:40px;line-height:100%;letter-spacing:-0.03em;text-align:center;text-box-trim:both;text-box-edge:cap alphabetic;margin:0 0 18px;color:#202124}
    .slw-details p{color:#334155;line-height:1.55;margin:0 auto 26px;max-width:550px;font-size:16px}
    .slw-details p.slw-accent-line{color:#A409D2;font-weight:700}
    .slw-details-form{text-align:left;background:#fff;border:1px solid #eee;border-radius:12px;padding:26px;margin:34px auto 0;box-shadow:0 16px 40px rgba(15,23,42,.08);max-width:891px}
    .slw-details-form label{display:block;font-size:12px;font-weight:600;margin-bottom:20px;color:#111}
    .slw-details-form input{width:100%;margin-top:8px;background:#f1f2f4;border:none;border-radius:12px;padding:18px 18px;font-size:15px;font-family:inherit;outline:none}
    .slw-phone-input{display:flex;align-items:center;gap:12px;background:#f1f2f4;border-radius:12px;padding:0 14px;margin-top:8px}
    .slw-phone-input input{background:none;padding:14px 0}
    .slw-consent{display:flex;gap:8px;color:#666;font-size:13px;line-height:1.5;margin:6px 0 22px}
    .slw-consent .slw-info-dot{margin-top:2px}
    .slw-details-form .slw-btn-black{max-width:190px;margin:18px auto 0;display:block;white-space:nowrap;padding:14px 18px;font-size:14px}

    /* Assessment step */
    .slw-assessment h1{font-family:'Right Grotesk','Bricolage Grotesque',sans-serif;font-weight:900;font-size:42px;line-height:1;margin:0 0 34px;color:#202124}
    .slw-assess-top{display:grid;grid-template-columns:2fr .85fr;gap:14px;background:#f5f6f8;border-radius:18px;padding:14px;margin-bottom:50px}
    .slw-assess-property{display:grid;grid-template-columns:1fr 1.05fr;gap:24px;background:#fff;border-radius:14px;padding:12px 24px 12px 12px;margin-right:0;align-items:center}
    .slw-assess-image{border-radius:10px;min-height:306px;background-size:cover;background-position:center;background-color:#e5e7eb}
    .slw-assess-property-info h2{font-family:'Bricolage Grotesque',sans-serif;font-size:42px;font-weight:500;margin:0 0 86px;line-height:1;color:#202124}
    .slw-assess-facts{display:grid;grid-template-columns:1fr 1fr;gap:24px;border-top:1px solid #e5e7eb;padding-top:22px}
    .slw-assess-facts div{display:flex;flex-direction:column;gap:4px}
    .slw-assess-facts span{color:#111;font-size:15px}
    .slw-assess-facts b{font-size:30px;line-height:1}
    .slw-assess-gauge-card{background:#fff;border-radius:14px;padding:28px 20px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center}
    .slw-assess-gauge-card b{margin-top:6px;font-size:16px}
    .slw-assess-gauge-card p{color:#667085;font-size:13px;line-height:1.45;margin:8px 0 0;max-width:250px}
    .slw-gauge{display:flex;flex-direction:column;align-items:center;position:relative}
    .slw-gauge-score{margin-top:8px;font-size:15px;color:#666}
    .slw-gauge-score b{font-size:30px;color:#111}

    .slw-assess-heading{font-family:'Right Grotesk','Bricolage Grotesque',sans-serif;font-size:32px;line-height:1;margin:0 0 14px;color:#202124}
    .slw-assess-subheading{color:#4b5563;margin:0 0 28px;font-weight:700}
    .slw-assess-findings-grid{display:grid;grid-template-columns:1fr 1.45fr;gap:32px;margin-bottom:60px}
    .slw-assess-findings-grid h3{font-size:17px;margin:0 0 28px;font-weight:800}
    .slw-finding-card{display:flex;gap:16px;border:2px solid #edf0f4;border-radius:14px;padding:20px;margin-bottom:14px;box-shadow:0 1px 0 rgba(15,23,42,.02)}
    .slw-finding-icon{font-size:20px;flex:none}
    .slw-finding-card b{display:block;margin-bottom:7px;font-size:17px;color:#202124}
    .slw-finding-card p{color:#475467;font-size:14px;line-height:1.42;margin:0}
    .slw-locked-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
    .slw-locked-card{display:flex;flex-direction:column;align-items:flex-start;justify-content:space-between;gap:36px;background:#f5f6f8;border-radius:10px;padding:18px;color:#737b86;font-size:14px;line-height:1.35;min-height:118px}
    .slw-locked-card svg{flex:none;margin-top:1px}
    .slw-assess-findings-grid + .slw-rating{margin:36px 0 40px}

    .slw-unlock-cta{background:#f5f6f8;border-radius:18px;padding:32px;display:grid;grid-template-columns:1fr 1.08fr;gap:32px;align-items:center}
    .slw-unlock-cta-copy h2{font-family:'Right Grotesk','Bricolage Grotesque',sans-serif;font-size:32px;line-height:1.05;margin:0 0 20px;color:#202124}
    .slw-unlock-cta-copy p{color:#475467;line-height:1.55;margin:0 0 34px;font-size:16px}
    .slw-price-box{background:#0a0a0a;color:#fff;border-radius:18px;padding:28px}
    .slw-price-box>div{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:16px}
    .slw-price-box span{font-size:14px;color:#ccc}
    .slw-price-box b{font-family:'Right Grotesk','Bricolage Grotesque',sans-serif;font-size:42px}
    .slw-btn-white{background:#fff;color:#111;border:none;border-radius:7px;padding:16px 24px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit;width:100%}
    .slw-unlock-cta-includes{background:#fff;border-radius:16px;padding:28px}
    .slw-unlock-cta-includes b{display:block;margin-bottom:14px;font-size:16px}
    .slw-unlock-cta-includes ul{margin:0;padding-left:20px;color:#444;font-size:14px;line-height:2}

    /* Payment step */
    .slw-payment h1{font-family:'Right Grotesk','Bricolage Grotesque',sans-serif;font-weight:900;font-size:42px;line-height:1;margin:0 0 54px;color:#202124}
    .slw-payment-grid{display:grid;grid-template-columns:.48fr 1fr;gap:16px;background:#f5f6f8;border-radius:18px;padding:14px}
    .slw-payment-methods{display:flex;flex-direction:column;gap:14px;background:#fff;border-radius:16px;padding:24px}
    .slw-payment-methods>b{font-size:18px;margin-bottom:14px;color:#111}
    .slw-method{display:flex;align-items:center;gap:16px;background:#f1f2f4;border:1.5px solid transparent;border-radius:10px;padding:20px;text-align:left;cursor:pointer;font-family:inherit}
    .slw-method-active{background:#fff;border-color:#A409D2}
    .slw-promo-inline-input{flex:1;min-width:0;border:none;background:transparent;padding:0;font-family:inherit;font-size:15px;font-weight:600;color:#202124;letter-spacing:0.04em;outline:none}
    .slw-promo-inline-input::placeholder{color:#9aa0a6;font-weight:500;letter-spacing:normal}
    .slw-method-icon{display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;background:#f3e6fb;flex:none}
    .slw-method b{display:block;font-size:15px}
    .slw-method small{color:#777;font-size:12.5px}
    .slw-payment-summary{background:#fff;border-radius:16px;padding:12px 28px 12px 12px;margin-left:0;display:grid;grid-template-columns:1fr 1fr;gap:28px;align-items:center}
    .slw-payment-image{border-radius:10px;min-height:338px;background-size:cover;background-position:center;background-color:#e5e7eb;grid-row:1 / span 2}
    .slw-payment-summary h2{font-family:'Bricolage Grotesque',sans-serif;font-size:40px;font-weight:500;line-height:100%;letter-spacing:-0.03em;text-box-trim:both;text-box-edge:cap alphabetic;margin:0 0 92px;color:#202124}
    .slw-payment-breakdown{grid-column:2}
    .slw-payment-breakdown div{display:flex;justify-content:space-between;padding:15px 0;font-size:15px;color:#111}
    .slw-payment-total{border-top:1px solid #eee;font-weight:700;color:#111 !important}
    .slw-payment-total span,.slw-payment-total b{color:#111}
    .slw-pay-btn{max-width:370px;margin:56px auto 0;display:block}
    .slw-bank-details{max-width:520px;margin:28px auto 0;background:#f7f8fa;border-radius:14px;padding:24px}
    .slw-bank-details p{color:#666;font-size:14px;margin:6px 0 18px}
    .slw-bank-details-grid{display:grid;gap:12px}
    .slw-bank-details-grid div{display:flex;justify-content:space-between;background:#fff;border-radius:10px;padding:12px 16px;font-size:14px}
    .slw-bank-details-grid span{color:#777}

    /* Success step */
    .slw-success{max-width:460px;margin:90px auto 0;text-align:center}
    .slw-success-check{display:block;margin:0 auto 30px}
    .slw-success h1{font-family:'Right Grotesk','Bricolage Grotesque',sans-serif;font-weight:900;font-size:39px;line-height:1;margin:0 0 18px;color:#202124}
    .slw-success p{color:#334155;margin:0 0 32px;line-height:1.5}
    .slw-success .slw-btn-outline{margin-top:12px}

    /* Full report */
    .slw-report-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}
    .slw-report h1{font-family:'Right Grotesk','Bricolage Grotesque',sans-serif;font-weight:900;font-size:42px;line-height:1;margin:0;color:#202124}
    .slw-pdf-btn{width:auto;padding:12px 20px}
    /* Not a grid: .slw-report-property-card floats right so the executive
       summary text (a normal flow block, no float/BFC of its own) wraps
       narrow beside it and then continues at the row's full width once it
       runs past the float's bottom edge. overflow:auto here only makes
       this container's own height include its floated child - it doesn't
       touch how .slw-report-summary-card wraps, that's a plain block. */
    .slw-report-summary-row{background:#f5f6f8;border-radius:18px;padding:14px;margin-bottom:36px;overflow:auto}
    .slw-report-summary-card,.slw-report-property-card{background:#fff;border-radius:14px;padding:24px}
    .slw-report-summary-card b{display:block;font-family:'Right Grotesk','Bricolage Grotesque',sans-serif;font-size:28px;line-height:1;margin-bottom:22px;color:#202124}
    .slw-report-summary-card p{color:#555;line-height:1.6;margin:0;font-size:14.5px}
    .slw-report-property-card{float:right;width:66%;margin-left:14px;margin-bottom:14px;display:grid;grid-template-columns:1fr 1.1fr;gap:24px;align-items:start;padding:12px 28px 12px 12px}
    .slw-report-image{border-radius:10px;align-self:stretch;background-size:cover;background-position:center;background-color:#e5e7eb;min-height:260px;max-height:460px}
    .slw-report-property-text{align-self:stretch;display:flex;flex-direction:column;justify-content:space-between;min-height:100%}
    .slw-report-property-card h2{font-family:'Right Grotesk','Bricolage Grotesque',sans-serif;font-size:40px;line-height:1;margin:0;color:#202124}

    .slw-section-heading{font-family:'Right Grotesk','Bricolage Grotesque',sans-serif;font-size:32px;line-height:1;margin:44px 0 20px;color:#202124}
    .slw-score-row{display:grid;grid-template-columns:.75fr 2fr;gap:14px;background:#f5f6f8;border-radius:18px;padding:14px}
    .slw-score-gauge-card{background:#fff;border-radius:14px;padding:24px;text-align:center;display:flex;flex-direction:column;align-items:center}
    .slw-score-gauge-card b{margin-top:6px}
    .slw-score-gauge-card p{color:#777;font-size:13px;line-height:1.5;margin:8px 0 0}
    .slw-score-bars-card{background:#fff;border-radius:14px;padding:24px 28px}
    .slw-score-bar-row{margin-bottom:20px}
    .slw-score-bar-row:last-child{margin-bottom:0}
    .slw-score-bar-label{display:flex;justify-content:space-between;font-size:14px;margin-bottom:8px}
    .slw-score-bar-track{height:8px;border-radius:4px;background:#eee}
    .slw-score-bar-fill{height:100%;border-radius:4px}

    .slw-why-not-selling{display:grid;grid-template-columns:1fr 1fr;gap:14px;background:#f5f6f8;border-radius:18px;padding:14px}
    .slw-why-card{background:#fff;border-radius:14px;padding:22px}
    .slw-why-card h3{font-size:17px;margin:0 0 16px}
    .slw-why-card>div{display:flex;gap:16px;margin-bottom:14px}
    .slw-why-card>div:last-child{margin-bottom:0}
    .slw-why-label{display:block;font-size:11px;font-weight:800;letter-spacing:0.5px;flex:0 0 86px}
    .slw-why-evidence{color:#d97706}
    .slw-why-impact{color:#dc2626}
    .slw-why-recommend{color:#059669}
    .slw-why-card p{margin:0;font-size:14px;color:#444;line-height:1.5}

    .slw-report-two-col{display:grid;grid-template-columns:1fr 1fr;gap:14px;background:#f5f6f8;border-radius:18px;padding:14px;margin-top:38px}
    .slw-report-two-col-single{grid-template-columns:1fr}
    .slw-read-more{display:inline;background:none;border:none;padding:0;margin-left:4px;color:#A409D2;font-weight:700;font-size:inherit;cursor:pointer;font-family:inherit;text-decoration:underline;text-underline-offset:2px}
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
    .slw-action-highlight{background:#F9F1FC;border-left:3px solid #A409D2;border-radius:0 10px 10px 0;padding:12px 16px;margin-bottom:12px}
    .slw-action-highlight:last-of-type{margin-bottom:16px}
    .slw-action-highlight b{display:block;font-size:14.5px;color:#202124;margin-bottom:4px}
    .slw-action-highlight p{margin:0;font-size:13px;color:#555;line-height:1.5}
    .slw-actions-see-all{display:block;width:100%;text-align:left;background:none;border:none;padding:0;color:#A409D2;font-weight:700;font-size:13.5px;cursor:pointer;font-family:inherit}

    .slw-thirty-day-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;background:#f5f6f8;border-radius:18px;padding:14px}
    .slw-week-card{background:#fff;border-radius:12px;padding:18px}
    .slw-week-card span{color:#D35506;font-size:12px;font-weight:700;display:block;margin-bottom:8px}
    .slw-week-card b{font-size:14.5px;line-height:1.4}

    .slw-recommendation-callout{display:flex;justify-content:space-between;align-items:center;background:#fff;border:14px solid #f5f6f8;border-radius:18px;padding:24px 28px;margin-top:42px}
    .slw-recommendation-callout b{font-family:'Right Grotesk','Bricolage Grotesque',sans-serif;font-size:32px;line-height:1}
    .slw-recommendation-callout .slw-btn-black{width:auto;padding:14px 22px}
    .slw-print-recommendation{display:none}

    /* Recommendation modal */
    .slw-modal-overlay{position:fixed;inset:0;background:rgba(20,20,20,0.55);display:flex;align-items:flex-start;justify-content:center;z-index:100}
    .slw-modal{background:#fff;border-radius:28px 28px 0 0;max-width:100%;width:100%;height:calc(100vh - 96px);margin-top:96px;padding:0;display:flex;flex-direction:column;overflow:hidden}
    .slw-modal-head{flex:none;display:flex;justify-content:space-between;align-items:flex-start;padding:48px 64px 0;max-width:1180px;margin:0 auto;width:100%}
    .slw-modal-head h2{font-family:'Right Grotesk','Bricolage Grotesque',sans-serif;font-size:44px;margin:0}
    .slw-modal-close{background:#f3f4f6;border:none;border-radius:50%;width:40px;height:40px;cursor:pointer;font-size:15px;flex:none}
    .slw-modal-scroll{flex:1;min-height:0;overflow-y:auto;scrollbar-width:none;-ms-overflow-style:none}
    .slw-modal-scroll::-webkit-scrollbar{display:none}
    .slw-modal-body{margin:32px auto 64px;max-width:1180px;width:calc(100% - 64px);border:1px solid #eee;border-radius:20px;padding:32px 40px;line-height:1.6;font-size:14.5px;color:#333}
    .slw-modal-body h3{font-size:17px;margin:24px 0 8px}
    .slw-modal-body h3:first-of-type{margin-top:0}
    .slw-modal-body p{margin:0 0 12px}
    .slw-modal-team{font-weight:700;color:#999}
    .slw-modal-disclaimer{color:#999;font-size:12.5px;margin-top:16px}
    .slw-modal-action{padding:20px 0;border-top:1px solid #eee}
    .slw-modal-action:first-of-type{padding-top:0;border-top:none}
    .slw-modal-priority{font-size:12px;font-weight:700;color:#A409D2;text-transform:uppercase;letter-spacing:0.4px}
    .slw-modal-bullets{margin:0 0 12px;padding-left:20px}
    .slw-modal-bullets li{margin-bottom:6px}

    /* @page can't nest inside @media print (a page-context rule, not a
       media-context one) - reasonable, consistent page margins instead of
       whatever the browser's own print default is, for every printed page. */
    @page{margin:15mm 12mm}

    @media print{
      /* The desktop grid layouts below (summary/property, score, why-not-
         selling, competition/actions, 30-day plan) are all designed for a
         1440px-wide screen. A browser's print engine renders that same CSS
         at a portrait page's much narrower content width (~180mm) instead
         of relaying it out for print, so every one of those grids just gets
         squeezed down to unreadably narrow columns - which is what actually
         produces "clustered, not well aligned" text, not a font/spacing
         problem. Reusing the existing @media(max-width:900px) single-column
         overrides here (rather than duplicating separate print-specific
         values) fixes that directly.
         Backgrounds are also off by default in most browsers' print dialogs
         ("background graphics" unchecked) - forcing print-color-adjust
         keeps every card's background so cards stay visually separated on
         the page instead of running into each other. */
      *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;color-adjust:exact !important}
      .slw-noprint{display:none !important}
      .slw-pdf-btn{display:none !important}
      .slw-actions-see-all{display:none !important}
      .slw-page{background:#fff}
      .slw-shell{padding:0}

      .slw-report-summary-row,.slw-report-property-card,.slw-score-row,
      .slw-why-not-selling,.slw-report-two-col{grid-template-columns:1fr !important}
      .slw-thirty-day-grid{grid-template-columns:1fr 1fr !important}
      /* The executive summary/property card float-wrap (screen only) is a
         nice magazine effect at 1440px but print pages are much narrower -
         same reasoning as the mobile breakpoint stacking it, so just reuse
         that: float off, full width, stacked. The min-height that matches
         the property card's on-screen pixel height is also meaningless
         once the page width (and so the card's actual height) changes for
         print - drop it here for the same reason the mobile override does. */
      .slw-report-property-card{float:none !important;width:auto !important;margin-left:0 !important}
      .slw-report-summary-card{min-height:auto !important}

      /* Full recommendations only ever exist in the DOM while the modal is
         open - printing the underlying report page never had them at all.
         slw-noprint above already removes the dead "View full
         recommendation" button; this is its opposite, hidden on screen and
         shown only here, with the modal's own content component so the
         printed report actually contains the full detail. */
      .slw-print-recommendation{display:block !important}
      .slw-print-recommendation .slw-modal-body{border:none;padding:0;margin:0;width:auto;max-width:none}

      /* Every ExpandableText force-expands for print (see that component),
         so executive summary and evidence/impact/recommend can legitimately
         run to several paragraphs - same for each recommendation's full
         description below. break-inside:avoid on a card whose content can
         be genuinely longer than one page is self-defeating: the browser
         can't honour "never split this" for something taller than a page,
         so it was clipping the overflow instead of paginating it, which is
         the exact "executive summary text is being cut off" bug. Only cards
         with reliably bounded content (a photo+address, a gauge, a score
         bar list, a single short comparable/action line, a week's theme)
         keep break-inside:avoid; anything that force-expands is left to
         paginate normally. */
      .slw-report-property-card,.slw-score-gauge-card,.slw-score-bars-card,
      .slw-competition-card,.slw-actions-card,.slw-week-card,.slw-action-row,
      .slw-competitor-row,.slw-recommendation-callout{
        break-inside:avoid;page-break-inside:avoid
      }
      .slw-section-heading,.slw-report h1{break-after:avoid;page-break-after:avoid}

      /* One major section per page instead of one long continuous scroll -
         this is the actual difference between "a formatted report" and
         "a printout of the webpage": Saleability Score, Why your property
         may not be selling, the 30-day plan and the full recommendations
         each start clean on their own page. Executive summary/property
         snapshot stays with the page 1 title since together they're short
         and read as one intro, not a section of their own. */
      .slw-section-heading{break-before:page;page-break-before:always}
      .slw-report-head,.slw-report-summary-row{break-before:avoid;page-break-before:avoid}
    }

    @media (max-width: 900px){
      .slw-footer{flex-direction:column;align-items:center;text-align:center;padding:34px 20px}
      .slw-header{padding:14px 16px}
      .slw-logo-mark{width:137px;height:52px}
      .slw-nav{display:none}
      .slw-burger{display:flex}
      .slw-shell{width:100%;padding:0 14px}
      .slw-main{padding-bottom:46px}
      .slw-goback{padding-top:22px;font-size:11px;margin-left:2px}
      .slw-stepper-wrap{margin:34px -14px 32px;padding:0 14px}
      .slw-stepper{justify-content:flex-start;font-size:12px;gap:0}
      .slw-stepper li{gap:22px}
      .slw-step-sep{width:50px}
      .slw-hero{margin:56px auto 0;padding-bottom:28px}
      .slw-hero h1{font-size:39px;line-height:.94}
      .slw-hero-copy{font-size:15px;line-height:1.45;margin-top:20px}
      .slw-id-form{margin-top:26px}
      .slw-id-input{border-radius:10px;padding:14px 16px}
      .slw-id-hint{justify-content:flex-start;text-align:left;align-items:flex-start;line-height:1.35}
      .slw-stats{gap:0;justify-content:space-between;margin-top:30px}
      .slw-stats b{font-size:27px}
      .slw-stats span{font-size:12px}
      .slw-rating{justify-content:flex-start;flex-wrap:wrap;text-align:left;margin:26px 0 0;font-size:18px;gap:8px}
      .slw-rating b{flex-basis:100%}
      .slw-hero-image{margin:-70px -14px 0;height:380px}
      .slw-hero-image::before{height:150px;background:linear-gradient(180deg,#fff 0%,rgba(255,255,255,.94) 26%,rgba(255,255,255,.58) 62%,rgba(255,255,255,0) 100%)}
      .slw-hero-image::after{background-position:center -57px;background-size:cover}
      .slw-value-section{padding:32px 2px 36px}
      .slw-value-grid{grid-template-columns:1fr;gap:54px}
      .slw-value-grid svg{margin-bottom:58px}
      .slw-value-grid h3{font-size:30px}
      .slw-value-grid p{font-size:20px}
      .slw-value-section h2{font-size:31px;line-height:1.18;margin-bottom:44px}
      .slw-finding{padding:90px 0}

      .slw-confirm h1,.slw-details h1,.slw-payment h1,.slw-report h1{font-size:34px}
      .slw-confirm-card{grid-template-columns:1fr}
      .slw-confirm-image{min-height:220px}
      .slw-confirm-details{padding:24px}
      .slw-confirm-details h2{font-size:30px}
      .slw-confirm-facts{margin-bottom:28px;flex-direction:column;gap:14px}
      .slw-not-found{margin-top:32px}
      .slw-not-found-illustration{width:240px}
      .slw-not-found h1{font-size:34px}
      .slw-details-form{padding:24px 20px}

      .slw-assess-top{grid-template-columns:1fr;gap:16px}
      .slw-assess-property{grid-template-columns:1fr;margin-right:0;margin-bottom:16px}
      .slw-assess-property-info h2{font-size:31px;margin:0 0 18px}
      .slw-assess-image{min-height:182px}
      .slw-assess-facts{grid-template-columns:1fr 1fr;padding-top:0;border-top:0}
      .slw-assess-facts b{font-size:24px}
      .slw-assess-findings-grid{grid-template-columns:1fr;gap:28px}
      .slw-locked-grid{grid-template-columns:repeat(2,1fr)}
      .slw-locked-card{min-height:110px;gap:30px}
      .slw-unlock-cta{grid-template-columns:1fr;padding:10px;gap:14px}
      .slw-unlock-cta-copy{display:contents}
      .slw-unlock-cta-copy h2{font-size:26px;order:1;margin:10px 10px 0}
      .slw-unlock-cta-copy p{order:1;margin:0 10px 6px}
      .slw-unlock-cta-includes{order:2}
      .slw-price-box{order:3;padding:20px}
      .slw-price-box>div{align-items:flex-start}
      .slw-price-box b{font-size:34px}

      .slw-payment-grid{grid-template-columns:1fr}
      .slw-payment{padding-top:8px}
      .slw-payment h1{margin-bottom:28px}
      .slw-payment-summary{grid-template-columns:1fr;margin-left:0;margin-top:0;padding:12px}
      .slw-payment-image{min-height:190px;grid-row:auto}
      .slw-payment-breakdown{grid-column:auto}
      .slw-payment-summary h2{font-size:31px;margin-bottom:32px}
      .slw-pay-btn{max-width:none;margin-top:28px}

      .slw-report-property-card{float:none;width:auto;margin-left:0;grid-template-columns:1fr}
      .slw-report-summary-card{min-height:auto !important}
      .slw-report-image{height:180px;min-height:180px}
      .slw-report-property-card h2{font-size:31px;margin-bottom:28px}
      .slw-score-row{grid-template-columns:1fr}
      .slw-why-not-selling{grid-template-columns:1fr}
      .slw-why-card>div{flex-direction:column;gap:4px}
      .slw-why-label{flex-basis:auto}
      .slw-modal{margin-top:40px;height:calc(100vh - 40px);border-radius:20px 20px 0 0}
      .slw-modal-head{padding:28px 20px 0}
      .slw-modal-head h2{font-size:26px}
      .slw-modal-body{width:calc(100% - 32px);margin:20px auto 40px;padding:20px}
      .slw-report-two-col{grid-template-columns:1fr}
      .slw-thirty-day-grid{grid-template-columns:1fr 1fr}
      .slw-recommendation-callout{flex-direction:column;align-items:flex-start;gap:16px}
      .slw-recommendation-callout .slw-btn-black{width:100%}
      .slw-report-head{flex-direction:column;align-items:flex-start;gap:14px}
      .slw-pdf-btn{width:100%}
    }
  `}</style>
);
