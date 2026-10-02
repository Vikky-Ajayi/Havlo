import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { readAgencyToken, storeAgencyToken } from './agentSession';
import { getAgencyShareToken, getAgentPortfolio, lookupAgent, openAgentProperty } from './api';
import { ShareSheet } from './ShareSheet';
import { formatGbp, formatReducedDate, type AgentPortfolio, type AgentPortfolioProperty } from './types';
import {
  BulbIcon,
  CheckIconGreen,
  Footer,
  HandshakeIcon,
  Header,
  HouseIcon,
  Spinner,
  WizardStyles,
} from './StaleProspectWizard';

// /check/agent: the estate agency's side of the prospect flow. Same page
// design as /check (StaleProspectWizard), but the agency enters the 5-digit
// code from its letter (or scans the QR) and sees every stale listing we
// found for it. Opening one makes the agency's own copy of that property and
// continues in the normal /check funnel with its token.

const STATUS_LABELS: Record<AgentPortfolioProperty['status'], string> = {
  new: 'New',
  opened: 'Viewed',
  in_progress: 'In progress',
  unlocked: 'Unlocked',
};

const AgentLanding = ({
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
    const next = value.replace(/\D/g, '').slice(0, 5);
    setCode(next);
    if (next.length === 5 && !loading) {
      window.setTimeout(() => onSubmit(next), 80);
    }
  };
  return (
    <>
      <section className="slw-hero">
        <h1>
          Your Listings Have Been Analysed. See{' '}
          <span className="slw-accent">What Could Be Holding</span> Them Back
        </h1>
        <p className="slw-hero-copy">
          We analysed the listings your agency is marketing that have been on the market the longest &mdash;
          their pricing against recent sales, presentation and competition &mdash; and prepared an independent
          assessment for each.
        </p>
        <form className="slw-id-form" onSubmit={handleSubmit}>
          <label className="slw-id-input">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#333E48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1M14 9h1M9 13h1M14 13h1M10 21v-4h4v4" />
            </svg>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Enter agency code"
              value={code}
              maxLength={5}
              onChange={(e) => handleCodeChange(e.target.value)}
            />
          </label>
          <p className="slw-id-hint">
            <span className="slw-info-dot">i</span> Your agency code is on the letter we sent to your office.
          </p>
          {error && <p className="slw-error">{error}</p>}
          <button type="submit" className="slw-btn-black slw-id-submit" disabled={loading} aria-label="Find my listings">
            {loading ? 'Searching…' : 'Find My Listings'}
          </button>
        </form>
        <h2 className="slw-discover-title">What you&rsquo;ll discover</h2>
        <ul className="slw-discover-grid">
          <li><CheckIconGreen /> Which of your listings buyers are passing over</li>
          <li><CheckIconGreen /> How each compares to recent sold prices</li>
          <li><CheckIconGreen /> Why each listing may have stalled</li>
          <li><CheckIconGreen /> Changes to put to your vendors</li>
          <li className="slw-discover-full"><CheckIconGreen /> A practical action plan for every property</li>
        </ul>
      </section>
      <div className="slw-hero-image">
        <div className="slw-hero-stats-card">
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
        </div>
      </div>
      <section className="slw-value-section">
        <h2>
          Listings that sit too long cost
          <br />
          you time and vendor trust.
          <br />
          Yours don&rsquo;t have to.
        </h2>
        <div className="slw-value-grid">
          <div>
            <HouseIcon />
            <h3>Spot What Buyers Notice</h3>
            <p>Uncover the issues that can reduce buyer interest in each of your stale listings.</p>
          </div>
          <div>
            <BulbIcon />
            <h3>Evidence For Your Vendors</h3>
            <p>Independent, data-backed findings to support the price and presentation changes you recommend.</p>
          </div>
          <div>
            <HandshakeIcon />
            <h3>Built To Work With You</h3>
            <p>Every assessment is designed to support your agency&rsquo;s work with its vendors.</p>
          </div>
        </div>
      </section>
    </>
  );
};

const ShareIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="18" cy="5" r="2.6" /><circle cx="6" cy="12" r="2.6" /><circle cx="18" cy="19" r="2.6" />
    <path d="M8.3 10.8l7.4-4.4M8.3 13.2l7.4 4.4" />
  </svg>
);

const AgentPortfolioView = ({
  portfolio,
  openingId,
  error,
  highlightId,
  onOpen,
  onShare,
}: {
  portfolio: AgentPortfolio;
  openingId: string;
  error: string;
  highlightId: string;
  onOpen: (prospectId: string) => void;
  onShare: (property: AgentPortfolioProperty) => void;
}) => {
  const name = portfolio.brand || portfolio.company_name;
  const count = portfolio.properties.length;
  const highlightRef = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightId]);
  return (
    <section className="slw-portfolio">
      <div className="slw-portfolio-head">
        {portfolio.logo_url && <img src={portfolio.logo_url} alt="" className="slw-portfolio-logo" />}
        <div>
          <h1>
            {name}: <span className="slw-accent">{count} stale {count === 1 ? 'listing' : 'listings'}</span>
          </h1>
          <p className="slw-confirm-copy">
            Select a property to see what may be holding it back and the recommendations you can take to your vendor.
          </p>
        </div>
      </div>
      {error && <p className="slw-error">{error}</p>}
      {count === 0 ? (
        <p className="slw-portfolio-empty">We don&rsquo;t have any stale listings for your agency right now.</p>
      ) : (
        <ul className="slw-portfolio-grid">
          {portfolio.properties.map((property) => (
            <li
              key={property.prospect_id}
              ref={property.prospect_id === highlightId ? highlightRef : undefined}
              className={`slw-portfolio-card${property.prospect_id === highlightId ? ' slw-portfolio-card-shared' : ''}`}
            >
              <div
                className="slw-portfolio-image"
                style={property.image_url ? { backgroundImage: `url(${property.image_url})` } : undefined}
              >
                <span className={`slw-portfolio-status slw-portfolio-status-${property.status}`}>
                  {STATUS_LABELS[property.status]}
                </span>
              </div>
              <div className="slw-portfolio-body">
                <h3>{property.property_address}</h3>
                <p className="slw-portfolio-meta">
                  {[
                    property.bedrooms ? `${property.bedrooms} bed` : '',
                    property.property_type || '',
                  ].filter(Boolean).join(' · ')}
                </p>
                <div className="slw-portfolio-figures">
                  <div>
                    <span>Asking price</span>
                    <b>{property.asking_price ? formatGbp(property.asking_price) : '—'}</b>
                  </div>
                  {property.reduced_date !== null && property.reduced_date !== undefined ? (
                    <div>
                      <span>Date reduced</span>
                      <b className="slw-hl">{formatReducedDate(property.reduced_date)}</b>
                    </div>
                  ) : (
                    <div>
                      <span>On the market</span>
                      <b className="slw-hl">{property.days_on_market} days</b>
                    </div>
                  )}
                </div>
                <div className="slw-portfolio-actions">
                  <button
                    type="button"
                    className="slw-btn-black slw-portfolio-open"
                    disabled={Boolean(openingId)}
                    onClick={() => onOpen(property.prospect_id)}
                  >
                    {openingId === property.prospect_id
                      ? 'Opening…'
                      : property.status === 'unlocked' ? 'View Full Report' : 'View Assessment'}
                  </button>
                  <button
                    type="button"
                    className="slw-portfolio-share"
                    aria-label={`Share ${property.property_address}`}
                    onClick={() => onShare(property)}
                  >
                    <ShareIcon />
                    <span>Share</span>
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export const AgentPortal = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [step, setStep] = useState<'booting' | 'landing' | 'finding' | 'not_found' | 'portfolio'>('booting');
  const [portfolio, setPortfolio] = useState<AgentPortfolio | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [openingId, setOpeningId] = useState('');
  // A shared link (?listing=<id>) highlights the listing it was shared from.
  const [highlightId] = useState(() => searchParams.get('listing') || '');
  const [sharing, setSharing] = useState<AgentPortfolioProperty | null>(null);
  const [shareToken, setShareToken] = useState('');
  const [shareError, setShareError] = useState('');

  const showPortfolio = (data: AgentPortfolio) => {
    storeAgencyToken(data.token);
    setPortfolio(data);
    setStep('portfolio');
    setSearchParams({ token: data.token }, { replace: true });
  };

  useEffect(() => {
    let cancelled = false;
    // ?code= comes from the agency-code field on /stale-listings/agents; it
    // wins over a token remembered from an earlier visit (which may belong
    // to another agency) but not over a token in the link itself.
    const code = searchParams.get('code');
    if (!searchParams.get('token') && code) {
      handleCode(code);
      return undefined;
    }
    const token = searchParams.get('token') || readAgencyToken();
    if (!token) {
      setStep('landing');
      return undefined;
    }
    getAgentPortfolio(token)
      .then((data) => { if (!cancelled) showPortfolio(data); })
      .catch(() => { if (!cancelled) setStep('landing'); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCode = async (code: string) => {
    setLoading(true);
    setError('');
    setStep('finding');
    try {
      showPortfolio(await lookupAgent(code));
    } catch {
      setStep('not_found');
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = async (prospectId: string) => {
    if (!portfolio) return;
    setOpeningId(prospectId);
    setError('');
    try {
      const { token } = await openAgentProperty({ token: portfolio.token, prospect_id: prospectId });
      navigate(`/check?token=${encodeURIComponent(token)}`);
    } catch {
      setError('We could not open that property just now. Please try again.');
      setOpeningId('');
    }
  };

  const handleShare = async (property: AgentPortfolioProperty) => {
    setSharing(property);
    setShareError('');
    if (shareToken || !portfolio) return;
    try {
      setShareToken((await getAgencyShareToken(portfolio.token)).token);
    } catch {
      setShareError('We could not create a share link just now. Please try again.');
    }
  };

  const shareName = portfolio ? portfolio.brand || portfolio.company_name : '';
  const shareUrl = sharing && shareToken
    ? `${window.location.origin}/check/agent?token=${encodeURIComponent(shareToken)}&listing=${encodeURIComponent(sharing.prospect_id)}`
    : null;

  return (
    <div className="slw-page slw-agent">
      <Header />
      <div className="slw-shell">
        <main className="slw-main">
          {(step === 'booting' || step === 'finding') && (
            <section className="slw-finding">
              <Spinner />
              <p>{step === 'finding' ? 'Finding your listings…' : 'Loading…'}</p>
            </section>
          )}
          {step === 'landing' && <AgentLanding onSubmit={handleCode} loading={loading} error={error} />}
          {step === 'not_found' && (
            <section className="slw-not-found">
              <img src="/stale-listings/property-not-found.png" alt="" className="slw-not-found-illustration" />
              <h1>We couldn&rsquo;t find your agency</h1>
              <p>Please check the agency code on your Havlo letter and try again.</p>
              <button type="button" className="slw-btn-black" onClick={() => setStep('landing')}>Try Again</button>
              <a href="mailto:myhavloservices@gmail.com" className="slw-help-link">Need help finding your agency code?</a>
            </section>
          )}
          {step === 'portfolio' && portfolio && (
            <AgentPortfolioView
              portfolio={portfolio}
              openingId={openingId}
              error={error}
              highlightId={highlightId}
              onOpen={handleOpen}
              onShare={handleShare}
            />
          )}
        </main>
      </div>
      {sharing && portfolio && (
        <ShareSheet
          url={shareUrl}
          title="Share this listing"
          subtitle={`Anyone with the link can see ${shareName}'s ${portfolio.properties.length} stale listings, with this one highlighted.`}
          text={`Havlo's assessment of ${sharing.property_address}, one of ${shareName}'s stale listings:`}
          error={shareError}
          onClose={() => setSharing(null)}
        />
      )}
      <Footer />
      <WizardStyles />
      <style>{`
        .slw-portfolio{padding:40px 0 64px}
        .slw-portfolio-head{display:flex;align-items:center;gap:22px;margin-bottom:28px}
        .slw-portfolio-head h1{font-family:'Right Grotesk','Bricolage Grotesque',sans-serif;font-weight:900;font-size:34px;line-height:1.05;letter-spacing:-0.03em;margin:0 0 12px;color:#202124}
        .slw-portfolio-head .slw-confirm-copy{margin:0}
        .slw-portfolio-logo{width:96px;height:64px;object-fit:contain;flex:none;border:1px solid #eee;border-radius:12px;padding:8px;background:#fff}
        .slw-portfolio-grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:22px}
        .slw-portfolio-card{border:1px solid #ececf0;border-radius:18px;overflow:hidden;background:#fff;display:flex;flex-direction:column}
        .slw-portfolio-image{position:relative;height:180px;background:#f3f1f7 center/cover no-repeat}
        .slw-portfolio-status{position:absolute;top:12px;left:12px;font-size:12px;font-weight:700;padding:5px 10px;border-radius:999px;background:#fff;color:#1f2024}
        .slw-portfolio-status-in_progress{background:#FFF4E5;color:#B14F0A}
        .slw-portfolio-status-unlocked{background:#E8F7EF;color:#0E7D4C}
        .slw-portfolio-body{padding:18px 18px 20px;display:flex;flex-direction:column;gap:10px;flex:1}
        .slw-portfolio-body h3{margin:0;font-family:'Inter',sans-serif;font-size:17px;font-weight:700;line-height:1.35;letter-spacing:-0.01em;color:#202124}
        .slw-portfolio-meta{margin:0;color:#667085;font-size:14px;min-height:18px}
        .slw-portfolio-figures{display:flex;gap:18px;margin-top:auto}
        .slw-portfolio-figures div{display:flex;flex-direction:column;gap:2px}
        .slw-portfolio-figures span{font-size:12px;color:#667085}
        .slw-portfolio-figures b{font-size:16px}
        .slw-portfolio-actions{display:flex;gap:10px;margin-top:6px}
        .slw-portfolio-open{flex:1;margin-top:0!important}
        .slw-portfolio-share{display:flex;align-items:center;gap:7px;background:#fff;border:1px solid #ddd;border-radius:7px;padding:0 16px;font-size:14px;font-weight:600;color:#111;cursor:pointer;font-family:inherit}
        .slw-portfolio-share:hover{border-color:#A409D2;color:#A409D2}
        .slw-portfolio-card-shared{border-color:#A409D2;box-shadow:0 0 0 3px rgba(164,9,210,.14)}
        .slw-portfolio-empty{color:#475467}
        @media (max-width:640px){
          .slw-portfolio{padding:24px 0 40px}
          .slw-portfolio-head{flex-direction:column;align-items:flex-start;gap:12px}
          .slw-portfolio-head h1{font-size:26px}
          .slw-portfolio-grid{grid-template-columns:1fr}
        }
      `}</style>
    </div>
  );
};
