import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ProductAccessModal } from '../product-access/ProductAccessModal';
import { clearProductAccessSession, readProductAccessSession } from '../../lib/productAccess';

const PURPLE = '#A409D2';

export function CustomOfferFlowShell(props: {
  eyebrow?: string;
  title?: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  contentWidth?: number;
  background?: string;
}) {
  const { eyebrow, title, subtitle, children, contentWidth = 820, background = '#F5F6F7' } = props;
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [accessEmail, setAccessEmail] = useState<string | null>(null);

  useEffect(() => {
    setAccessEmail(readProductAccessSession('custom-offers')?.email ?? null);
  }, []);

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = menuOpen || accessModalOpen ? 'hidden' : original;
    return () => {
      document.body.style.overflow = original;
    };
  }, [accessModalOpen, menuOpen]);

  const handleOpenPortal = () => {
    navigate('/custom-offers/portal');
    setMenuOpen(false);
  };

  const handleOpenSignIn = () => {
    setAccessModalOpen(true);
    setMenuOpen(false);
  };

  const handleSignOut = () => {
    clearProductAccessSession('custom-offers');
    setAccessEmail(null);
    setMenuOpen(false);
    navigate('/custom-offers');
  };

  return (
    <div style={{ minHeight: '100vh', background, fontFamily: 'Inter, sans-serif', color: '#111111' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap');
        .cof-root, .cof-root * { box-sizing: border-box; }
        .cof-header {
          background: #FFFFFF;
          border-bottom: 1px solid rgba(0, 0, 0, 0.08);
        }
        .cof-header-inner {
          max-width: 1440px;
          margin: 0 auto;
          height: 80px;
          padding: 0 52px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
        }
        .cof-logo {
          display: block;
          height: 54px;
          width: auto;
          flex-shrink: 0;
        }
        .cof-secure {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #111111;
          font-size: 16px;
          letter-spacing: -0.02em;
        }
        .cof-auth-row {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          margin-left: 18px;
        }
        .cof-auth-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 46px;
          padding: 0 20px;
          border-radius: 14px;
          border: 1px solid rgba(0, 0, 0, 0.12);
          background: #FFFFFF;
          color: #111111;
          font-size: 17px;
          font-weight: 600;
          letter-spacing: -0.02em;
          text-decoration: none;
          cursor: pointer;
        }
        .cof-menu-button {
          display: none;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border: 0;
          background: transparent;
          padding: 0;
          cursor: pointer;
        }
        .cof-drawer-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.42);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.25s ease;
          z-index: 80;
        }
        .cof-drawer-backdrop.is-open {
          opacity: 1;
          pointer-events: auto;
        }
        .cof-drawer {
          position: fixed;
          right: 0;
          top: 0;
          bottom: 0;
          width: min(280px, 82vw);
          background: #FFFFFF;
          box-shadow: -8px 0 24px rgba(0, 0, 0, 0.12);
          transform: translateX(100%);
          transition: transform 0.28s ease;
          z-index: 90;
          padding: 26px 24px 36px;
        }
        .cof-drawer.is-open {
          transform: translateX(0);
        }
        .cof-drawer-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 36px;
        }
        .cof-drawer-links {
          display: flex;
          flex-direction: column;
        }
        .cof-drawer-links a {
          color: #1A1A1A;
          text-decoration: none;
          font-size: 17px;
          font-weight: 600;
          padding: 14px 0;
          border-bottom: 1px solid rgba(0, 0, 0, 0.08);
        }
        .cof-page {
          max-width: ${contentWidth + 136}px;
          margin: 0 auto;
          padding: 34px 64px 84px;
        }
        .cof-intro {
          margin-bottom: 32px;
        }
        .cof-eyebrow {
          margin: 0 0 8px;
          color: ${PURPLE};
          font-size: 17px;
          font-weight: 700;
          letter-spacing: -0.02em;
          text-transform: uppercase;
        }
        .cof-title {
          margin: 0;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 33px;
          font-weight: 800;
          line-height: 1.14;
          letter-spacing: -0.05em;
          color: #191919;
        }
        .cof-subtitle {
          margin: 4px 0 0;
          max-width: 760px;
          color: #1F1F1F;
          font-size: 18px;
          line-height: 1.48;
          letter-spacing: -0.02em;
        }
        .cof-card {
          background: #FFFFFF;
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 14px;
          padding: 18px 20px;
        }
        .cof-field-label {
          display: block;
          margin: 0 0 10px;
          color: #111111;
          font-size: 20px;
          font-weight: 700;
          line-height: 1.32;
          letter-spacing: -0.03em;
        }
        .cof-field-help {
          margin: -2px 0 10px;
          color: #555555;
          font-size: 15px;
          line-height: 1.45;
          letter-spacing: -0.02em;
        }
        .cof-field-help em {
          color: #555555;
          font-style: italic;
        }
        .cof-section {
          padding: 30px 0 0;
          border-top: 1px solid rgba(0, 0, 0, 0.10);
        }
        .cof-section:first-of-type {
          padding-top: 0;
          border-top: 0;
        }
        .cof-options-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .cof-actions {
          display: flex;
          justify-content: flex-end;
          gap: 14px;
          margin-top: 40px;
        }
        .cof-actions--stack {
          display: none;
        }
        .cof-button {
          height: 48px;
          border-radius: 6px;
          font-size: 17px;
          font-weight: 500;
          letter-spacing: -0.02em;
          cursor: pointer;
          padding: 0 34px;
        }
        .cof-button-primary {
          border: 0;
          background: #000000;
          color: #FFFFFF;
        }
        .cof-button-secondary {
          border: 1px solid rgba(0, 0, 0, 0.20);
          background: #FFFFFF;
          color: #111111;
        }
        .cof-error {
          margin-top: 8px;
          color: #C02626;
          font-size: 14px;
          line-height: 1.45;
        }
        .cof-input,
        .cof-textarea {
          width: 100%;
          border: 1px solid rgba(0, 0, 0, 0.12);
          border-radius: 10px;
          background: #FFFFFF;
          color: #111111;
          font-size: 16px;
          font-family: 'Inter', sans-serif;
          padding: 20px 18px;
          outline: none;
        }
        .cof-textarea {
          min-height: 136px;
          resize: vertical;
        }
        .cof-input::placeholder,
        .cof-textarea::placeholder {
          color: #9B9B9B;
        }
        @media (max-width: 768px) {
          .cof-header-inner {
            height: 84px;
            padding: 0 18px;
          }
          .cof-logo {
            height: 48px;
          }
          .cof-secure {
            display: none;
          }
          .cof-auth-row {
            display: none;
          }
          .cof-menu-button {
            display: inline-flex;
          }
          .cof-page {
            padding: 22px 18px 60px;
          }
          .cof-intro {
            margin-bottom: 22px;
          }
          .cof-eyebrow {
            font-size: 15px;
            margin-bottom: 6px;
          }
          .cof-title {
            font-size: 30px;
            line-height: 1.08;
          }
          .cof-subtitle {
            margin-top: 4px;
            font-size: 17px;
            line-height: 1.45;
          }
          .cof-field-label {
            font-size: 18px;
            line-height: 1.35;
          }
          .cof-field-help {
            font-size: 15px;
          }
          .cof-options-grid {
            grid-template-columns: 1fr;
            gap: 10px;
          }
          .cof-actions {
            display: none;
          }
          .cof-actions--stack {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-top: 32px;
          }
          .cof-button {
            width: 100%;
            height: 54px;
            justify-content: center;
          }
          .cof-drawer {
            padding-top: 22px;
          }
        }
      `}</style>

      <header className="cof-header">
        <div className="cof-header-inner">
          <Link to="/custom-offers" aria-label="Go to Custom Offers home">
            <img className="cof-logo" src="/custom-offer-logo.png" alt="CustomOffer" />
          </Link>

          <div className="cof-secure">
            <span aria-hidden="true">🔒</span>
            <span>Secure assessment · SSL encrypted</span>
          </div>
          <div className="cof-auth-row">
            {accessEmail ? (
              <>
                <button type="button" className="cof-auth-button" onClick={handleOpenPortal}>
                  My submissions
                </button>
                <button type="button" className="cof-auth-button" onClick={handleSignOut}>
                  Sign out
                </button>
              </>
            ) : (
              <button type="button" className="cof-auth-button" onClick={handleOpenSignIn}>
                Sign in
              </button>
            )}
          </div>

          <button type="button" className="cof-menu-button" onClick={() => setMenuOpen(true)} aria-label="Open navigation menu">
            <HamburgerIcon />
          </button>
        </div>
      </header>

      <div className={`cof-drawer-backdrop${menuOpen ? ' is-open' : ''}`} onClick={() => setMenuOpen(false)} />
      <aside className={`cof-drawer${menuOpen ? ' is-open' : ''}`}>
        <div className="cof-drawer-top">
          <img className="cof-logo" src="/custom-offer-logo.png" alt="CustomOffer" />
          <button type="button" style={{ border: 0, background: 'transparent', padding: 4, cursor: 'pointer' }} onClick={() => setMenuOpen(false)} aria-label="Close navigation menu">
            <CloseIcon />
          </button>
        </div>
        <nav className="cof-drawer-links">
          <a href="/custom-offers#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>
          <a href="/custom-offers#faq" onClick={() => setMenuOpen(false)}>FAQ</a>
          <a href="/custom-offers#pricing" onClick={() => setMenuOpen(false)}>Pricing</a>
        </nav>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
          {accessEmail ? (
            <>
              <button type="button" className="cof-auth-button" onClick={handleOpenPortal}>
                My submissions
              </button>
              <button type="button" className="cof-auth-button" onClick={handleSignOut}>
                Sign out
              </button>
            </>
          ) : (
            <button type="button" className="cof-auth-button" onClick={handleOpenSignIn}>
              Sign in
            </button>
          )}
        </div>
      </aside>

      <div className="cof-root">
        <div className="cof-page">
          {(eyebrow || title || subtitle) ? (
            <div className="cof-intro">
              {eyebrow ? <p className="cof-eyebrow">{eyebrow}</p> : null}
              {title ? <h1 className="cof-title">{title}</h1> : null}
              {subtitle ? <p className="cof-subtitle">{subtitle}</p> : null}
            </div>
          ) : null}
          {children}
        </div>
      </div>
      <ProductAccessModal
        scope="custom-offers"
        isOpen={accessModalOpen}
        onClose={() => {
          setAccessModalOpen(false);
          setAccessEmail(readProductAccessSession('custom-offers')?.email ?? null);
        }}
      />
    </div>
  );
}

export function CustomOfferActions(props: {
  onContinue: () => void;
  onBack?: () => void;
  continueLabel?: string;
  backLabel?: string;
  continueDisabled?: boolean;
}) {
  const {
    onContinue,
    onBack,
    continueLabel = 'Continue',
    backLabel = 'Back',
    continueDisabled = false,
  } = props;

  const row = useMemo(
    () => (
      <>
        {onBack ? (
          <button type="button" className="cof-button cof-button-secondary" onClick={onBack}>
            {backLabel}
          </button>
        ) : null}
        <button type="button" className="cof-button cof-button-primary" onClick={onContinue} disabled={continueDisabled}>
          {continueLabel}
        </button>
      </>
    ),
    [backLabel, continueDisabled, continueLabel, onBack, onContinue],
  );

  return (
    <>
      <div className="cof-actions">{row}</div>
      <div className="cof-actions--stack">
        <button type="button" className="cof-button cof-button-primary" onClick={onContinue} disabled={continueDisabled}>
          {continueLabel}
        </button>
        {onBack ? (
          <button type="button" className="cof-button cof-button-secondary" onClick={onBack}>
            {backLabel}
          </button>
        ) : null}
      </div>
    </>
  );
}

export function CustomOfferChoiceCard(props: {
  selected: boolean;
  title: string;
  description?: string;
  onClick: () => void;
  type?: 'radio' | 'checkbox';
}) {
  const { selected, title, description, onClick, type = 'radio' } = props;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        minHeight: description ? 82 : 60,
        borderRadius: 12,
        border: `1.5px solid ${selected ? PURPLE : 'rgba(0, 0, 0, 0.10)'}`,
        background: '#FFFFFF',
        padding: description ? '14px 20px' : '0 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      {type === 'checkbox' ? <Checkbox selected={selected} /> : <Radio selected={selected} />}
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', color: '#111111', fontSize: 18, fontWeight: 500, lineHeight: 1.4, letterSpacing: '-0.02em' }}>{title}</span>
        {description ? (
          <span style={{ display: 'block', marginTop: 5, color: '#3C3C3C', fontSize: 15, lineHeight: 1.45, letterSpacing: '-0.02em' }}>
            {description}
          </span>
        ) : null}
      </span>
    </button>
  );
}

export function CustomOfferChip(props: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  const { active, label, onClick } = props;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        borderRadius: 999,
        border: `1.5px solid ${active ? PURPLE : 'rgba(0, 0, 0, 0.12)'}`,
        background: '#FFFFFF',
        color: active ? PURPLE : '#111111',
        padding: '13px 18px',
        fontSize: 16,
        fontWeight: 500,
        letterSpacing: '-0.02em',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

export function CustomOfferHouseArt({ illustration }: { illustration: 'blue' | 'orange' | 'teal' }) {
  const fill = illustration === 'blue' ? '#4A90D9' : illustration === 'orange' ? '#F5A623' : '#2ABFBF';
  const roof = illustration === 'blue' ? '#2D6BB5' : illustration === 'orange' ? '#D4831A' : '#1A9090';
  const door = illustration === 'blue' ? '#1A4A80' : illustration === 'orange' ? '#8B5209' : '#0D5A5A';
  const windowFill = illustration === 'blue' ? '#A8D4F5' : illustration === 'orange' ? '#FDE8BB' : '#AAEAEA';
  const windowInset = illustration === 'blue' ? '#7ABDE8' : illustration === 'orange' ? '#F5C870' : '#5DCFCF';
  const accent = illustration === 'blue' ? '#F5A623' : illustration === 'orange' ? '#E84393' : '#F5D742';

  return (
    <svg width="150" height="118" viewBox="0 0 157 122" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="18" y="52" width="121" height="70" rx="4" fill={fill} />
      <polygon points="78.5,8 8,55 149,55" fill={roof} />
      <rect x="64" y="72" width="29" height="50" rx="3" fill={door} />
      <rect x="30" y="65" width="22" height="22" rx="2" fill={windowFill} />
      <rect x="35" y="70" width="12" height="12" rx="1" fill={windowInset} />
      <rect x="105" y="65" width="22" height="22" rx="2" fill={windowFill} />
      <rect x="110" y="70" width="12" height="12" rx="1" fill={windowInset} />
      <circle cx="77" cy="97" r="3" fill={windowFill} />
      <rect x="14" y="50" width="5" height="8" rx="2" fill={accent} />
      <rect x="138" y="50" width="5" height="8" rx="2" fill={accent} />
      <rect x="52" y="30" width="12" height="20" rx="2" fill={fill} />
      <rect x="55" y="27" width="6" height="6" rx="1" fill={roof} />
      {illustration !== 'blue' ? <circle cx="120" cy="20" r="8" fill={accent} opacity="0.8" /> : null}
    </svg>
  );
}

export function CustomOfferSpinner({ label }: { label?: string }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <span
        style={{
          width: 16,
          height: 16,
          border: '2px solid rgba(255, 255, 255, 0.45)',
          borderTopColor: '#FFFFFF',
          borderRadius: '50%',
          display: 'inline-block',
          animation: 'cof-spin 0.8s linear infinite',
        }}
      />
      {label ? <span>{label}</span> : null}
      <style>{`@keyframes cof-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Radio({ selected }: { selected: boolean }) {
  return selected ? (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="9.25" stroke={PURPLE} strokeWidth="1.5" />
      <circle cx="12" cy="12" r="5.75" fill={PURPLE} />
    </svg>
  ) : (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="9.25" stroke="#BBBBBB" strokeWidth="1.5" />
    </svg>
  );
}

function Checkbox({ selected }: { selected: boolean }) {
  if (!selected) {
    return <Radio selected={false} />;
  }
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="11" fill="#16A34A" />
      <path d="M7.5 12.5L10.7 15.7L16.5 9.9" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HamburgerIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3 6H21M3 12H21M3 18H21" stroke="#1F1F1E" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M6.5 6.5L17.5 17.5" stroke="#111111" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M17.5 6.5L6.5 17.5" stroke="#111111" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
