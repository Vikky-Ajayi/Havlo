import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { CountryCodeSelect } from '../../components/shared/CountryCodeSelect';
import { REVIEW_COPIES, ReviewStars, staleListingsReviews } from '../../components/shared/StaleListingsReviews';
import { getAdsSummary, type AdsSummary } from './api';
import { formatGbp, formatReducedDate, prospectPrice, type ProspectPreview } from './types';

// The analyst-review funnel (/review/seller, /review/agent): an analyst-reviewed report
// instead of an instant one. After the listing link: Initial scan → Your
// details → Preview & pay → Analyst review (the report is held for up to 48
// hours, app/services/analyst_review.py) → Full report, opened from the
// "your report is ready" email. StaleProspectWizard drives the steps; these
// are the screens.
//
// Parts of the design wait for real content and are left out until then:
// the analyst's name and photo, the Trustpilot score, customer quotes, a
// sample report to link to, and the Forbes press mention.

const PURPLE = '#A409D2';

export const REVIEW_STEPS = ['Add listing link', 'Initial scan', 'Your details', 'Preview & pay', 'Analyst review', 'Full report'];

const CheckIcon = ({ color = '#16A34A', size = 16 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4.5 12.5l5 5L19.5 7" />
  </svg>
);

const ClockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C2410C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={PURPLE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

/** The /g/ funnel's own stepper: done steps ticked, the current one purple. */
export const ReviewStepper = ({ active }: { active: number }) => (
  <div className="rv-stepper-wrap slw-noprint">
    <ol className="rv-stepper">
      {REVIEW_STEPS.map((label, i) => (
        <li key={label} className={i < active ? 'rv-done' : i === active ? 'rv-active' : ''}>
          {i < active ? <CheckIcon /> : <i className="rv-dot" />}
          <span>{label === 'Full report' && active === 3 ? 'Full report in 48 hrs' : label}</span>
        </li>
      ))}
    </ol>
  </div>
);

const propertyImage = (prospect: ProspectPreview) => {
  const snapshot = prospect.listing_snapshot || {};
  return snapshot.image || (snapshot.images && snapshot.images[0]) || '';
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "LN1 2BJ" from the end of the address, or null. */
export function postcodeOf(address: string): string | null {
  const match = /([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\s*\.?$/i.exec((address || '').trim());
  return match ? match[1].toUpperCase() : null;
}

/** Days on the market, or when the price was reduced. */
const MarketTime = ({ prospect }: { prospect: ProspectPreview }) => {
  if (prospect.reduced_date != null) {
    return prospect.reduced_date
      ? <>Price reduced on <b className="rv-orange">{formatReducedDate(prospect.reduced_date)}</b></>
      : <>Price <b className="rv-orange">recently reduced</b></>;
  }
  if (!prospect.listing_duration_days) return null;
  return <><b className="rv-orange">{prospect.listing_duration_days} days</b> on the market</>;
};

/** The headline count of possible factors (the same figure as /check). */
export const reviewFactorCount = (prospect: ProspectPreview, lockedCount: number) =>
  (prospect.preview?.key_issues || []).length + lockedCount;

// ── Step: Initial scan ──────────────────────────────────────────────────────

export const ReviewScanStep = ({
  prospect,
  access,
  totalFactors,
  onContinue,
  onChangeLink,
}: {
  prospect: ProspectPreview;
  access: { token?: string; code?: string };
  totalFactors: number;
  onContinue: () => void;
  onChangeLink: () => void;
}) => {
  const [summary, setSummary] = useState<AdsSummary | null>(null);
  const image = propertyImage(prospect);
  const isAgent = prospect.audience === 'agent';

  // The competing-listings count can still be on its way: ask again for a
  // little while, then leave that line to the analyst.
  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    let handle: number | undefined;
    const load = async () => {
      try {
        const data = await getAdsSummary(access);
        if (cancelled) return;
        setSummary(data);
        if (data.competition.status === 'pending' && tries++ < 15) handle = window.setTimeout(load, 4000);
      } catch {
        if (!cancelled && tries++ < 3) handle = window.setTimeout(load, 4000);
      }
    };
    void load();
    return () => {
      cancelled = true;
      if (handle) window.clearTimeout(handle);
    };
  }, [access.token, access.code]);

  const facts = [
    prospect.asking_price ? formatGbp(prospect.asking_price) : null,
    prospect.bedrooms ? plural(prospect.bedrooms, 'bedroom', 'bedrooms') : null,
    prospect.bathrooms ? plural(prospect.bathrooms, 'bathroom', 'bathrooms') : null,
  ].filter(Boolean);

  const analystWillCheck = 'Your analyst will check this';
  const presentation = summary?.presentation;
  const competition = summary?.competition;
  const rows: { label: string; text: ReactNode }[] = [
    { label: 'Buyer appeal', text: summary?.buyer_appeal || analystWillCheck },
    { label: 'Pricing position', text: summary?.pricing || analystWillCheck },
    {
      label: 'Listing presentation',
      text: presentation && presentation.count > 0
        ? plural(presentation.count, 'possible improvement', 'possible improvements')
        : presentation?.status || analystWillCheck,
    },
    {
      label: 'Local competition',
      text: competition?.status === 'ready' && competition.count
        ? `${plural(competition.count, 'similar home', 'similar homes')} for sale nearby`
        : analystWillCheck,
    },
  ];
  const marketTime = <MarketTime prospect={prospect} />;

  return (
    <section className="rv-scan">
      <h1 className="rv-h1">{isAgent ? 'Is this the listing?' : 'Is this your property?'}</h1>
      <p className="rv-lede">
        Here&rsquo;s what our first scan picked up. A Havlo property analyst checks every point before you get your report.
      </p>
      <div className="rv-card rv-scan-card">
        <div className="rv-scan-image" style={image ? { backgroundImage: `url(${image})` } : undefined} />
        <div className="rv-scan-body">
          <h2>{prospect.property_address}</h2>
          {facts.length > 0 && <p className="rv-facts">{facts.join(' · ')}</p>}
          <div className="rv-signals">
            {prospect.listing_duration_days || prospect.reduced_date != null ? (
              <div><ClockIcon /><span>{marketTime}</span></div>
            ) : null}
            <div><SearchIcon /><span>Our initial scan flagged <b className="rv-purple">{plural(totalFactors, 'possible factor', 'possible factors')}</b></span></div>
          </div>
          {summary === null ? (
            <div className="rv-rows-loading"><div className="slw-spinner" /></div>
          ) : (
            <ul className="rv-rows">
              {rows.map((row) => (
                <li key={row.label}><b>{row.label}</b><span className="rv-sep">&middot;</span>{row.text}</li>
              ))}
            </ul>
          )}
          <p className="rv-note">
            {isAgent
              ? 'Listings that sit unsold usually have a few fixable reasons. Your report shows what they are and what to take to your vendor.'
              : 'Homes that sit unsold usually have a few fixable reasons. Your report shows what they are and what to do about each one.'}
          </p>
          <button type="button" className="rv-btn" onClick={onContinue}>
            {isAgent ? 'Yes, that’s the listing. Continue' : 'Yes, that’s my property. Continue'} &rarr;
          </button>
          <div className="rv-scan-foot">
            <button type="button" className="rv-link" onClick={onChangeLink}>
              {isAgent ? 'Not the right listing? Change the link' : 'Not your property? Change the link'}
            </button>
            <span>Free preview now. Full analyst-reviewed report from {formatGbp(99)}.</span>
          </div>
        </div>
      </div>
    </section>
  );
};

// ── Step: Your details ──────────────────────────────────────────────────────

// The same press logos as the Stale Listings home page (public/press-logos).
const PRESS_LOGOS = [
  { alt: 'The Times', src: '/press-logos/the-times.svg' },
  { alt: 'The Guardian', src: '/press-logos/the-guardian.svg' },
  { alt: 'Daily Mail', src: '/press-logos/daily-mail.svg' },
];

const PressStrip = () => (
  <div className="rv-press">
    <span>As featured in</span>
    <div className="rv-press-logos">
      {PRESS_LOGOS.map((logo) => <img key={logo.src} src={logo.src} alt={logo.alt} />)}
    </div>
  </div>
);

/** The number as typed, without the country code if they typed that too
 * (it's already chosen in the dropdown beside the box). */
function withoutDialCode(mobile: string, dialCode: string): string {
  const digits = dialCode.replace(/\D/g, '');
  const text = mobile.trim();
  return digits ? text.replace(new RegExp(`^(\\+|00)${digits}\\s*`), '') : text;
}

export const ReviewDetailsStep = ({
  prospect,
  totalFactors,
  onSubmit,
  loading,
  error,
  initial,
}: {
  prospect: ProspectPreview;
  totalFactors: number;
  onSubmit: (fields: { full_name: string; email: string; mobile_number: string; marketing_opt_in: boolean }) => void;
  loading: boolean;
  error: string;
  initial?: { first_name?: string; email?: string };
}) => {
  const image = propertyImage(prospect);
  const [fullName, setFullName] = useState(initial?.first_name || '');
  const [email, setEmail] = useState(initial?.email || '');
  const [dialCode, setDialCode] = useState('+44');
  const [mobile, setMobile] = useState('');
  const [tips, setTips] = useState(false);
  const facts = [
    prospect.asking_price ? formatGbp(prospect.asking_price) : null,
    prospect.bedrooms ? `${prospect.bedrooms} bed` : null,
    prospect.bathrooms ? `${prospect.bathrooms} bath` : null,
  ].filter(Boolean);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({
      full_name: fullName.trim(),
      email: email.trim(),
      mobile_number: `${dialCode} ${withoutDialCode(mobile, dialCode)}`,
      marketing_opt_in: tips,
    });
  };

  return (
    <section className="rv-card rv-details">
      <aside className="rv-details-side">
        <div className="rv-details-image" style={image ? { backgroundImage: `url(${image})` } : undefined} />
        <div className="rv-details-prop">
          <h3>{prospect.property_address}</h3>
          {facts.length > 0 && <p>{facts.join(' · ')}</p>}
          {(prospect.listing_duration_days || prospect.reduced_date != null) ? <p><MarketTime prospect={prospect} /></p> : null}
          <p><b className="rv-purple">{plural(totalFactors, 'possible factor', 'possible factors')}</b> flagged</p>
        </div>
      </aside>
      <form className="rv-details-form" onSubmit={submit}>
        <h1 className="rv-h1 rv-h1-left">Where should we send your preview and report?</h1>
        <label className="rv-field">
          <span>Name</span>
          <input type="text" autoComplete="name" placeholder="Your full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </label>
        <label className="rv-field">
          <span>Email</span>
          <input type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="rv-field">
          <span>Mobile number</span>
          <div className="rv-phone">
            <CountryCodeSelect value={dialCode} onChange={setDialCode} className="rv-phone-code" buttonClassName="rv-phone-code-btn" />
            <input type="tel" autoComplete="tel-national" placeholder="07700 900123" value={mobile} onChange={(e) => setMobile(e.target.value)} required minLength={9} />
          </div>
          <small>So we can text you a link to your listing dashboard when your report is ready.</small>
        </label>
        <label className="rv-check">
          <input type="checkbox" checked={tips} onChange={(e) => setTips(e.target.checked)} />
          <span>Send me occasional tips on selling faster (you can unsubscribe anytime).</span>
        </label>
        {error && <p className="slw-error">{error}</p>}
        <button type="submit" className="rv-btn" disabled={loading}>
          {loading ? 'Saving…' : 'Show my free preview'}
        </button>
        <p className="rv-privacy">
          <LockIcon />
          We only use these to send your preview and report. No spam, and we never share your details.
        </p>
        <PressStrip />
      </form>
    </section>
  );
};

// ── Step: Preview & pay ─────────────────────────────────────────────────────

const ANALYST_CHECKS_OWNER: [string, string][] = [
  ['Your price', ' against genuinely similar homes that have sold, not just your postcode'],
  ['Your photos and description', ', and how buyers see your listing online'],
  ['The competition', ' buyers are comparing you with right now'],
  ['Portal performance', ' and how visible your listing is'],
  ['A 30-day action plan', ' you can share with your agent or do yourself'],
];
const ANALYST_CHECKS_AGENT: [string, string][] = [
  ['The asking price', ' against genuinely similar homes that have sold, not just the postcode'],
  ['The photos and description', ', and how buyers see the listing online'],
  ['The competition', ' buyers are comparing it with right now'],
  ['Portal performance', ' and how visible the listing is'],
  ['A 30-day action plan', ' to take to your vendor'],
];

// A preview of this property's own report, laid out as the full report is:
// the cover, the first scan's findings and the start of its action plan.
// Everything here is already in the free preview.
const SamplePanels = ({ prospect, totalFactors }: { prospect: ProspectPreview; totalFactors: number }) => {
  const preview = prospect.preview || {};
  const findings = (preview.key_issues || []).filter((f) => f.title).slice(0, 3);
  const steps = (preview.recommendations || []).filter((r) => r.title).slice(0, 4);
  const score = preview.overall_score;
  const postcode = postcodeOf(prospect.property_address);
  const facts = [
    prospect.asking_price ? formatGbp(prospect.asking_price) : null,
    prospect.listing_duration_days ? `${prospect.listing_duration_days} days on the market` : null,
  ].filter(Boolean);
  const moreFindings = Math.max(totalFactors - findings.length, 0);
  return (
    <div className="rv-sample-grid">
      <figure>
        <div className="rv-sample rv-sample-cover">
          <b>HAVLO</b>
          <div>
            <small>Listing assessment</small>
            <strong>{prospect.property_address.replace(/\.$/, '')}</strong>
            {facts.length > 0 && <small className="rv-sample-facts">{facts.join(' · ')}</small>}
          </div>
          <div className="rv-sample-cover-foot">
            {score != null && <span><b>{score}</b>/100 saleability score</span>}
            <small>Reviewed by your Havlo analyst{postcode ? ` · Prepared for ${postcode}` : ''}</small>
          </div>
        </div>
        <figcaption>Your personalised report</figcaption>
      </figure>
      <figure>
        <div className="rv-sample">
          <b className="rv-sample-title">Findings</b>
          {findings.map((f, i) => (
            <div className="rv-sample-finding" key={f.title}>
              <strong>{f.title}</strong>
              {f.description && <p>{f.description}</p>}
            </div>
          ))}
          {moreFindings > 0 && <small className="rv-sample-more">+ {plural(moreFindings, 'more factor', 'more factors')} for your analyst to check</small>}
        </div>
        <figcaption>Each finding explained in plain English</figcaption>
      </figure>
      <figure>
        <div className="rv-sample">
          <b className="rv-sample-title">30-day action plan</b>
          {steps.map((step, n) => (
            <div className="rv-sample-step" key={step.title}>
              <span>{n + 1}</span>
              <div>
                <strong>{step.title}</strong>
                {step.description && <p>{step.description}</p>}
              </div>
            </div>
          ))}
        </div>
        <figcaption>Step-by-step plan to share with your agent</figcaption>
      </figure>
    </div>
  );
};

// "Trusted by sellers and agents": the /stale-listings reviews, scrolling
// the same way (paused on hover, still for reduced motion).
const TrustedReviews = () => (
  <section className="rv-trusted">
    <h2 className="rv-h2">Trusted by sellers and agents</h2>
    <p className="rv-muted">Havlo has worked with independent agents from some of the UK&rsquo;s big estate agency chains.</p>
    <div className="rv-reviews-viewport">
      <div
        className="rv-reviews-track"
        style={{ '--rv-copies': REVIEW_COPIES, '--rv-reviews-duration': `${staleListingsReviews.length * 10}s` } as CSSProperties}
      >
        {Array.from({ length: REVIEW_COPIES }, (_, copy) => staleListingsReviews.map(({ role, quote, tag }) => (
          <article key={`${copy}-${quote[0]}`} className="rv-review" aria-hidden={copy > 0 || undefined}>
            <ReviewStars />
            <p className="rv-review-role">{role}</p>
            <p className="rv-review-quote">{quote.join(' ')}</p>
            <p className="rv-review-tag">{tag}</p>
          </article>
        )))}
      </div>
    </div>
  </section>
);

export const ReviewPreviewPayStep = ({
  prospect,
  totalFactors,
  onPay,
  onApplyPromo,
  loading,
  error,
}: {
  prospect: ProspectPreview;
  totalFactors: number;
  onPay: () => void;
  onApplyPromo: (code: string) => void;
  loading: boolean;
  error: string;
}) => {
  const [promoOpen, setPromoOpen] = useState(false);
  const [promo, setPromo] = useState('');
  const image = propertyImage(prospect);
  const isAgent = prospect.audience === 'agent';
  const price = formatGbp(prospectPrice(prospect));
  const finding = (prospect.preview?.key_issues || []).find((f) => f.title || f.description);
  const postcode = postcodeOf(prospect.property_address);
  const size = [
    prospect.bedrooms ? `${prospect.bedrooms} bed` : null,
    prospect.bathrooms ? `${prospect.bathrooms} bath` : null,
  ].filter(Boolean).join(' · ');
  const checks = isAgent ? ANALYST_CHECKS_AGENT : ANALYST_CHECKS_OWNER;

  const submitPromo = (e: FormEvent) => {
    e.preventDefault();
    if (promo.trim()) onApplyPromo(promo.trim());
  };

  return (
    <section className="rv-preview">
      <div className="rv-preview-head">
        <h1 className="rv-h1 rv-h1-left">Your listing is ready for expert review</h1>
        <p>
          Our initial scan flagged {plural(totalFactors, 'possible factor', 'possible factors')} that could be slowing
          {isAgent ? ' this sale' : ' your sale'}. A Havlo property analyst will now check each one against
          {isAgent ? ' the listing and the' : ' your listing and your'} local market, then send you a clear report with what to change.
        </p>
      </div>

      <div className="rv-preview-grid">
        <div className="rv-preview-main">
          <div className="rv-card rv-prop">
            <div className="rv-prop-image" style={image ? { backgroundImage: `url(${image})` } : undefined} />
            <div className="rv-prop-body">
              <h2>{prospect.property_address}</h2>
              <div className="rv-prop-facts">
                {prospect.asking_price ? <div><span>Asking price</span><b>{formatGbp(prospect.asking_price)}</b></div> : null}
                {prospect.reduced_date != null ? (
                  <div><span>Price reduced</span><b className="rv-orange">{prospect.reduced_date ? formatReducedDate(prospect.reduced_date) : 'Recently'}</b></div>
                ) : prospect.listing_duration_days ? (
                  <div><span>On the market</span><b className="rv-orange">{prospect.listing_duration_days} days</b></div>
                ) : null}
                {size && <div><span>Size</span><b>{size}</b></div>}
              </div>
              <p className="rv-prop-flag">
                <SearchIcon />
                <span>Initial scan flagged <b className="rv-purple">{plural(totalFactors, 'possible factor', 'possible factors')}</b> for your analyst to verify</span>
              </p>
            </div>
          </div>

          {finding && (
            <div className="rv-card rv-finding">
              <span className="rv-pill">Free preview finding</span>
              {finding.title && <h3>{finding.title}</h3>}
              {finding.description && <p>{finding.description}</p>}
            </div>
          )}

          <div className="rv-card rv-checks">
            <h3>What your analyst will check</h3>
            <p className="rv-muted">Every finding is checked by an analyst before it reaches you.</p>
            <ul>
              {checks.map(([bold, rest]) => (
                <li key={bold}><CheckIcon color={PURPLE} /><span><b>{bold}</b>{rest}</span></li>
              ))}
            </ul>
          </div>

          <h3 className="rv-subhead">What happens next</h3>
          <div className="rv-next">
            <div><b>1</b><strong>Pay securely today</strong><span>One-off payment. No subscription.</span></div>
            <div><b>2</b><strong>Your analyst reviews it</strong><span>Every factor checked against your local market.</span></div>
            <div><b>3</b><strong>Report in your inbox</strong><span>Within 48 hours, ready to share.</span></div>
          </div>
        </div>

        <aside className="rv-card rv-price">
          <span className="rv-eyebrow">Analyst-reviewed report</span>
          <div className="rv-price-figure"><b>{price}</b><span>one-off</span></div>
          <ul className="rv-price-list">
            <li><ClockIcon />Delivered within 48 hours</li>
            <li><CheckIcon color="#475467" />All {totalFactors} factors checked and explained</li>
            <li><CheckIcon color="#475467" />{isAgent ? 'Evidence for your next vendor conversation' : 'Works alongside your estate agent'}</li>
          </ul>
          {error && <p className="slw-error">{error}</p>}
          <button type="button" className="rv-btn" onClick={onPay} disabled={loading}>
            {loading ? 'Processing…' : <>Get my analyst-reviewed report &ndash; {price}</>}
          </button>
          {promoOpen ? (
            <form className="rv-promo" onSubmit={submitPromo}>
              <input
                type="text"
                placeholder="Promo code"
                value={promo}
                onChange={(e) => setPromo(e.target.value.toUpperCase())}
                autoCapitalize="characters"
                autoFocus
              />
              <button type="submit" disabled={loading || !promo.trim()}>Apply</button>
            </form>
          ) : (
            <button type="button" className="rv-link rv-promo-link" onClick={() => setPromoOpen(true)}>Have a promo code?</button>
          )}
          <div className="rv-guarantee">
            <ShieldIcon />
            <p>
              <b>Money-back guarantee.</b> If your report doesn&rsquo;t give you at least one change worth making,
              we&rsquo;ll refund you in full.
            </p>
          </div>
          <p className="rv-secure">Secure checkout{postcode ? <> &middot; Prepared only for {postcode}</> : null}</p>
          <div className="rv-price-press"><PressStrip /></div>
        </aside>
      </div>

      <div className="rv-sample-head">
        <div>
          <h2 className="rv-h2">See exactly what you&rsquo;ll get</h2>
          <p className="rv-muted">A preview of your report. Your analyst checks and completes every section.</p>
        </div>
      </div>
      <SamplePanels prospect={prospect} totalFactors={totalFactors} />

      <TrustedReviews />

      <div className="rv-banner">
        <div>
          <h2 className="rv-h2">{isAgent ? 'Take it to your vendor' : 'Keep your estate agent'}</h2>
          <p>
            {isAgent
              ? 'An independent view of why the listing has stalled, with evidence for the changes you recommend.'
              : 'Havlo works alongside your agent, not instead of them. Share your report with them, or make the changes yourself.'}
          </p>
        </div>
        <button type="button" onClick={onPay} disabled={loading}>Get my report &ndash; {price}</button>
      </div>
    </section>
  );
};

// ── Step: Analyst review (paid, report held) ────────────────────────────────

function formatDue(iso?: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const day = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const time = date.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(' ', '');
  return `${day}, ${time}`;
}

export const ReviewInProgressStep = ({ prospect, totalFactors }: { prospect: ProspectPreview; totalFactors: number }) => {
  const due = formatDue(prospect.analyst_review_due_at);
  return (
    <section className="rv-progress">
      <svg className="rv-progress-icon" width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <circle cx="32" cy="32" r="32" fill="#F5ECFA" />
        <circle cx="29" cy="29" r="11" stroke={PURPLE} strokeWidth="3.5" />
        <path d="m37.5 37.5 8 8" stroke={PURPLE} strokeWidth="3.5" strokeLinecap="round" />
      </svg>
      <h1 className="rv-h1">Your analyst is on it</h1>
      <p className="rv-lede">
        Payment received, thank you. A Havlo property analyst is now checking all {totalFactors} factors against{' '}
        {prospect.audience === 'agent' ? 'the listing' : 'your listing'} and the local market for {prospect.property_address.replace(/\.$/, '')}.
      </p>
      <div className="rv-card rv-due">
        <span className="rv-eyebrow">Your report will be ready by</span>
        <b>{due || 'within 48 hours'}</b>
        <p>We&rsquo;ll email you a link to it the moment it&rsquo;s ready. You can close this page.</p>
      </div>
      <ol className="rv-timeline">
        <li className="rv-done"><CheckIcon /><div><b>Payment received</b><span>One-off, no subscription.</span></div></li>
        <li className="rv-active"><i className="rv-dot" /><div><b>Analyst review</b><span>Every factor checked by a person.</span></div></li>
        <li><i className="rv-dot" /><div><b>Report in your inbox</b><span>{due ? `By ${due}.` : 'Within 48 hours.'}</span></div></li>
      </ol>
    </section>
  );
};

export const ReviewStyles = () => (
  <style>{`
    /* Headings: the /stale-listings home page's type (Plus Jakarta Sans ExtraBold). */
    .rv-h1{font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;font-size:48px;line-height:110%;letter-spacing:-0.03em;color:#1F1F1E;margin:0;text-align:center}
    .rv-h1-left{text-align:left}
    .rv-h2{font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;font-size:34px;line-height:44px;letter-spacing:-0.03em;color:#1F1F1E;margin:0}
    .rv-lede{max-width:760px;margin:16px auto 0;text-align:center;font-size:18px;line-height:1.55;color:#334155}
    .rv-muted{color:#667085;font-size:14px;margin:6px 0 0}
    .rv-purple{color:${PURPLE}}
    .rv-orange{color:#C2410C}
    .rv-card{background:#fff;border:1px solid #E4E7EC;border-radius:18px}
    .rv-btn{display:block;width:100%;background:#111;color:#fff;border:none;border-radius:12px;padding:17px 22px;font:inherit;font-size:17px;font-weight:700;cursor:pointer}
    .rv-btn:disabled{opacity:.6;cursor:default}
    .rv-link{background:none;border:none;padding:0;font:inherit;color:${PURPLE};text-decoration:underline;cursor:pointer}

    .rv-stepper-wrap{overflow-x:auto;margin:22px 0 36px;-ms-overflow-style:none;scrollbar-width:none}
    .rv-stepper-wrap::-webkit-scrollbar{display:none}
    .rv-stepper{display:flex;gap:28px;list-style:none;margin:0;padding:0;white-space:nowrap;font-size:14.5px;font-weight:600;color:#667085}
    .rv-stepper li{display:flex;align-items:center;gap:9px}
    .rv-stepper .rv-done{color:#111}
    .rv-stepper .rv-active{color:${PURPLE}}
    .rv-dot{display:inline-block;width:9px;height:9px;border-radius:50%;border:1.5px solid #98A2B3;flex:none}
    .rv-active .rv-dot{background:${PURPLE};border-color:${PURPLE};width:10px;height:10px}

    .rv-scan .rv-lede{margin-bottom:34px}
    .rv-scan-card{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7.5fr);overflow:hidden}
    .rv-scan-image,.rv-details-image,.rv-prop-image{background:#EEF0F3 center/cover no-repeat}
    .rv-scan-image{min-height:420px}
    .rv-scan-body{padding:32px}
    /* Addresses are set in Inter, as in the design, not the heading type. */
    .slw-page.slw-ads .rv-scan-body h2,.slw-page.slw-ads .rv-details-prop h3,.slw-page.slw-ads .rv-prop-body h2{font-family:'Inter',sans-serif;letter-spacing:-0.01em;line-height:1.3}
    .slw-page.slw-ads .rv-scan-body h2{font-weight:500;line-height:1.2}
    .slw-page.slw-ads .rv-details-prop h3,.slw-page.slw-ads .rv-prop-body h2{font-weight:600}
    .slw-page.slw-ads .rv-h1{line-height:110%}
    .rv-scan-body h2{font-size:30px;line-height:1.2;font-weight:500;color:#111;margin:0;letter-spacing:-0.01em}
    .rv-facts{margin:16px 0 0;font-weight:700;color:#111}
    .rv-signals{margin:18px 0 0;padding:14px 16px;background:#FAF5FD;border:1px solid #E9D5F5;border-radius:12px;display:grid;gap:10px;font-size:16px;color:#1f2024}
    .rv-signals div{display:flex;align-items:center;gap:10px}
    .rv-rows{list-style:none;margin:18px 0 0;padding:0;display:grid;gap:10px}
    .rv-rows li{background:#F5F6F8;border-radius:10px;padding:12px 14px;font-size:15px;color:#475467}
    .rv-rows b{color:#111}
    .rv-sep{margin:0 5px}
    .rv-rows-loading{display:flex;justify-content:center;padding:26px 0}
    .rv-note{margin:18px 0 0;background:#FAFAFC;border-radius:10px;padding:16px;font-size:15px;line-height:1.6;color:#344054}
    .rv-scan .rv-btn{margin-top:18px}
    .rv-scan-foot{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:14px;font-size:14px;color:#344054}

    /* No overflow:hidden here: it would clip the country-code dropdown.
       The photo's column rounds its own corners instead. */
    .rv-details{display:grid;grid-template-columns:minmax(0,4fr) minmax(0,8fr);margin-top:8px}
    .rv-details-side{overflow:hidden;border-radius:17px 0 0 17px}
    /* The photo stretches so the left column is as tall as the form. */
    .rv-details-side{display:flex;flex-direction:column}
    .rv-details-image{flex:1 1 auto;min-height:360px}
    .rv-details-prop{padding:22px 24px}
    .rv-details-prop h3{margin:0 0 12px;font-size:18px;line-height:1.35;font-weight:600;color:#111}
    .rv-details-prop p{margin:4px 0;color:#475467;font-size:15px}
    .rv-details-form{padding:36px}
    .rv-details-form .rv-h1{font-size:40px;margin-bottom:22px}
    .rv-field{display:block;margin-bottom:16px}
    .rv-field>span{display:block;font-size:14px;font-weight:700;color:#111;margin-bottom:8px}
    .rv-field input{width:100%;box-sizing:border-box;border:1px solid #E4E7EC;background:#F5F6F8;border-radius:10px;padding:15px 16px;font:inherit;font-size:16px;color:#111;outline:none}
    .rv-field input:focus{border-color:${PURPLE};background:#fff}
    .rv-field small{display:block;margin-top:8px;color:#475467;font-size:13px}
    .rv-phone{display:flex;gap:8px}
    .rv-phone-code{flex:none}
    .rv-phone .rv-phone-code-btn{height:100%;min-height:52px;box-sizing:border-box;padding:0 12px;border:1px solid #E4E7EC;background:#F5F6F8;border-radius:10px;font-size:15px;font-weight:700}
    .rv-phone input{flex:1;min-width:0}
    .rv-check{display:flex;align-items:flex-start;gap:10px;font-size:14px;color:#344054;margin:4px 0 18px;cursor:pointer}
    .rv-check input{width:18px;height:18px;margin:1px 0 0;accent-color:#111;flex:none}
    .rv-privacy{display:flex;align-items:center;gap:8px;margin:16px 0 0;font-size:13px;color:#475467}
    .rv-privacy svg{flex:none}
    .rv-press{display:flex;align-items:center;gap:18px;margin-top:22px;padding-top:18px;border-top:1px solid #EAECF0}
    .rv-press span{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#475467}
    .rv-press-logos{display:flex;align-items:center;gap:22px;flex-wrap:wrap}
    .rv-press img{height:22px;width:auto;max-width:130px;object-fit:contain}

    .rv-preview-head{max-width:760px}
    .rv-preview-head p{margin:14px 0 0;font-size:17px;line-height:1.6;color:#344054}
    .rv-preview-grid{display:grid;grid-template-columns:minmax(0,7fr) minmax(0,4.4fr);gap:26px;margin-top:30px;align-items:start}
    .rv-preview-main{display:grid;gap:22px}
    .rv-prop{display:grid;grid-template-columns:200px minmax(0,1fr);overflow:hidden}
    .rv-prop-image{min-height:200px}
    .rv-prop-body{padding:20px 22px}
    .rv-prop-body h2{margin:0;font-size:20px;line-height:1.3;font-weight:600;color:#111}
    .rv-prop-facts{display:flex;gap:28px;flex-wrap:wrap;margin-top:14px}
    .rv-prop-facts span{display:block;font-size:12px;color:#667085}
    .rv-prop-facts b{font-size:20px;color:#111}
    .rv-prop-facts b.rv-orange{color:#C2410C}
    .rv-prop-flag{display:flex;align-items:flex-start;gap:8px;margin:14px 0 0;padding:10px 12px;background:#FAF5FD;border-radius:10px;font-size:14px;color:#1f2024}
    .rv-prop-flag svg{flex:none;margin-top:1px}
    .rv-finding{padding:22px}
    .rv-pill{display:inline-block;background:#111;color:#fff;border-radius:999px;padding:4px 10px;font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}
    .rv-finding h3{margin:14px 0 8px;font-size:19px;color:#111}
    .rv-finding p{margin:0;font-size:15px;line-height:1.65;color:#344054}
    .rv-checks{padding:22px}
    .rv-checks h3{margin:0;font-size:19px;color:#111}
    .rv-checks ul{list-style:none;margin:16px 0 0;padding:0;display:grid;gap:12px}
    .rv-checks li{display:flex;gap:10px;font-size:15px;color:#344054;line-height:1.45}
    .rv-checks li svg{flex:none;margin-top:3px}
    .rv-checks b{color:#111}
    .rv-subhead{margin:6px 0 0;font-size:20px;color:#1F1F1E}
    .rv-next{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
    .rv-next div{background:#F5F6F8;border-radius:14px;padding:18px;display:flex;flex-direction:column;gap:6px}
    .rv-next b{font-family:'Plus Jakarta Sans',sans-serif;font-size:26px;font-weight:800;letter-spacing:-0.03em;color:${PURPLE}}
    .rv-next strong{font-size:17px;color:#111;line-height:1.25}
    .rv-next span{font-size:13.5px;color:#475467;line-height:1.45}
    .rv-price{padding:24px;position:sticky;top:20px;box-shadow:0 12px 32px rgba(16,24,40,.06)}
    .rv-eyebrow{display:block;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#475467}
    .rv-price-figure{display:flex;align-items:baseline;gap:8px;margin:8px 0 18px}
    .rv-price-figure b{font-family:'Plus Jakarta Sans',sans-serif;font-size:48px;font-weight:800;letter-spacing:-0.03em;color:#1F1F1E;line-height:1}
    .rv-price-figure span{color:#475467;font-size:14px}
    .rv-price-list{list-style:none;margin:0 0 18px;padding:0;display:grid;gap:10px;font-size:15px;color:#1f2024}
    .rv-price-list li{display:flex;align-items:center;gap:10px}
    .rv-price-list svg{flex:none}
    .rv-promo-link{display:block;margin:12px auto 0;font-size:14px}
    .rv-promo{display:flex;gap:8px;margin-top:12px}
    .rv-promo input{flex:1;min-width:0;border:1px solid #D0D5DD;border-radius:10px;padding:11px 12px;font:inherit;font-size:15px}
    .rv-promo button{border:none;background:#F2F4F7;border-radius:10px;padding:0 16px;font:inherit;font-weight:700;cursor:pointer}
    .rv-guarantee{display:flex;gap:10px;margin-top:16px;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:14px;font-size:14px;line-height:1.5;color:#14532D}
    .rv-guarantee svg{flex:none;margin-top:2px}
    .rv-guarantee p{margin:0}
    .rv-secure{margin:14px 0 0;text-align:center;font-size:13px;color:#475467}
    .rv-price-press .rv-press{margin-top:16px;flex-direction:column;align-items:flex-start;gap:12px}
    .rv-price-press .rv-press-logos{gap:18px}
    .rv-price-press .rv-press img{height:18px}

    .rv-sample-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin:64px 0 18px}
    .rv-sample-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}
    .rv-sample-grid figure{margin:0}
    .rv-sample-grid figcaption{margin-top:10px;font-size:13.5px;color:#475467}
    .rv-sample{height:340px;overflow:hidden;box-sizing:border-box;border:1px solid #E4E7EC;border-radius:14px;padding:18px;background:#fff;display:flex;flex-direction:column;gap:10px}
    .rv-sample-cover{background:#111;border-color:#111;color:#fff;justify-content:space-between}
    .rv-sample-cover b{font-size:18px;letter-spacing:.04em}
    .rv-sample-cover small{display:block;font-size:12px;color:#D0D5DD}
    .rv-sample.rv-sample-cover strong{display:block;margin-top:6px;font-family:'Plus Jakarta Sans',sans-serif;font-size:22px;font-weight:800;letter-spacing:-0.03em;line-height:1.15;color:#fff}
    .rv-sample-cover .rv-sample-facts{margin-top:10px}
    .rv-sample-cover-foot span{display:block;font-size:13px;color:#D0D5DD;margin-bottom:8px}
    .rv-sample-cover-foot span b{font-size:22px;color:#fff;letter-spacing:0}
    .rv-sample-title{font-size:14px;color:#111}
    .rv-sample-finding{border:1px solid #EAECF0;border-radius:10px;padding:10px 12px}
    .rv-sample strong{display:block;font-size:13px;color:#111;line-height:1.3}
    .rv-sample p{margin:4px 0 0;font-size:12px;line-height:1.45;color:#475467;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .rv-sample-more{font-size:12px;font-weight:700;color:${PURPLE}}
    .rv-sample-step{display:flex;align-items:flex-start;gap:10px}
    .rv-sample-step span{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:#F5ECFA;color:${PURPLE};font-size:11px;font-weight:800;flex:none}
    .rv-trusted{margin-top:64px}
    .rv-trusted .rv-muted{margin-top:8px}
    .rv-reviews-viewport{margin-top:22px;overflow:hidden;border-radius:14px}
    .rv-reviews-track{display:flex;width:max-content;animation:rv-reviews-scroll var(--rv-reviews-duration,30s) linear infinite}
    .rv-reviews-viewport:hover .rv-reviews-track{animation-play-state:paused}
    @keyframes rv-reviews-scroll{from{transform:translate3d(0,0,0)}to{transform:translate3d(calc(-100% / var(--rv-copies)),0,0)}}
    .rv-review{flex:none;display:flex;flex-direction:column;width:340px;min-height:260px;box-sizing:border-box;margin-right:20px;padding:20px;border-radius:12px;background:#F2F3F7}
    .rv-review svg{flex:none}
    .rv-review-role{margin:12px 0 0;font-weight:600;font-size:15px;color:#191E32}
    .rv-review-quote{flex:1;margin:10px 0 0;font-size:15px;line-height:1.55;color:#24262B}
    .rv-review-tag{margin:14px 0 0;font-weight:600;font-size:14px;color:#191E32}
    @media (prefers-reduced-motion:reduce){
      .rv-reviews-track{animation:none}
      .rv-review[aria-hidden]{display:none}
      .rv-reviews-viewport{overflow-x:auto}
    }
    .rv-banner{display:flex;align-items:center;justify-content:space-between;gap:24px;margin-top:56px;background:#111;color:#fff;border-radius:18px;padding:32px}
    .slw-page.slw-ads .rv-banner .rv-h2{color:#fff}
    .rv-banner p{margin:10px 0 0;color:#D0D5DD;font-size:15px;line-height:1.55}
    .rv-banner button{flex:none;background:#fff;color:#111;border:none;border-radius:10px;padding:15px 22px;font:inherit;font-weight:700;cursor:pointer}

    .rv-progress{max-width:720px;margin:0 auto;text-align:center}
    .rv-progress-icon{display:block;margin:0 auto 18px}
    .slw-shell>.rv-stepper-wrap:first-child{margin-top:48px}
    .rv-due{margin:28px auto 0;padding:22px;max-width:460px}
    .rv-due b{display:block;margin-top:6px;font-size:22px;color:#111}
    .rv-due p{margin:10px 0 0;font-size:14.5px;color:#475467;line-height:1.5}
    .rv-timeline{list-style:none;margin:30px auto 0;padding:0;max-width:420px;text-align:left;display:grid;gap:16px}
    .rv-timeline li{display:flex;gap:12px;align-items:flex-start;color:#667085}
    .rv-timeline li svg,.rv-timeline .rv-dot{margin-top:4px;flex:none}
    .rv-timeline b{display:block;color:#111;font-size:15.5px}
    .rv-timeline span{font-size:14px}
    .rv-timeline .rv-active b{color:${PURPLE}}

    @media (max-width:1024px){
      .rv-preview-grid{grid-template-columns:1fr}
      .rv-price{position:static}
    }
    @media (max-width:820px){
      .rv-h1{font-size:34px}
      .rv-details-form .rv-h1{font-size:30px}
      .rv-lede{font-size:16px}
      .rv-scan-card,.rv-details{grid-template-columns:1fr}
      .rv-scan-image{min-height:240px}
      .rv-details-image{flex:none;min-height:0;height:220px}
      .rv-details-side{border-radius:17px 17px 0 0}
      .rv-scan-body,.rv-details-form{padding:22px 18px}
      .rv-scan-body h2{font-size:22px}
      .rv-prop{grid-template-columns:1fr}
      .rv-prop-image{min-height:180px}
      .rv-next,.rv-sample-grid{grid-template-columns:1fr}
      .rv-sample{height:auto;min-height:220px}
      .rv-review{width:280px;min-height:240px;margin-right:14px}
      .rv-banner{flex-direction:column;align-items:stretch;padding:24px}
      .rv-scan-foot{flex-direction:column}
      .rv-stepper{font-size:12.5px;gap:20px}
    }
  `}</style>
);
