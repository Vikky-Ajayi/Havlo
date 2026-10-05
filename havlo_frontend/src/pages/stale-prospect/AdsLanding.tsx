import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { getAdsSummary, requestUrlReminder, type AdsAudience, type AdsSummary } from './api';
import { formatGbp, type ProspectPreview } from './types';

// Meta-ads landing pages (/assess/seller and /assess/agent): the /check
// wizard with the property-code box swapped for the listing link, and an
// "email me a reminder" option for visitors without the link to hand
// (app/services/ads_funnel.py, ads_nurture.py on the backend).

// Wording from the landing-page brief (meta_ad_landing_funnel), with the
// portal list cut to Rightmove: it's the only site we read listings from.
type AdsCopy = {
  heading: ReactNode;
  copy: string;
  button: string;
  discover: string[];
  value?: { heading: ReactNode; cards: { title: string; text: string }[] };
};

const DISCOVER_COMMON = [
  'What’s weakening your buyer appeal',
  'How you compare to competing listings',
  'Why it may have remained unsold',
  'Changes that could improve its chances',
  'A practical 30-day action plan',
];

export const ADS_COPY: Record<AdsAudience, AdsCopy> = {
  owner: {
    heading: (
      <>
        Has Your Property Been on the Market <span className="slw-accent">Too Long?</span>
      </>
    ),
    copy: 'See what could be holding back your sale and what you could change to improve your chances.',
    button: 'Assess My Property',
    discover: [...DISCOVER_COMMON, 'Works with your current estate agent'],
  },
  agent: {
    heading: (
      <>
        Got a Property That&rsquo;s Taking Too Long to Sell?<br />
        See <span className="slw-accent">What Could Be Holding</span> It Back
      </>
    ),
    copy:
      'See what may be stopping the property from selling, where it’s losing ground to competing listings, and the practical changes that could help get the sale moving again.',
    button: 'Assess This Listing',
    discover: [...DISCOVER_COMMON, 'Insights for your next vendor conversation'],
    value: {
      heading: <>Stale Listings Put Instructions at Risk. Get Ahead of the Conversation.</>,
      cards: [
        {
          title: 'Spot What Buyers Notice',
          text: 'Identify potential issues affecting buyer interest before they become bigger barriers to the sale.',
        },
        {
          title: 'Strengthen Vendor Conversations',
          text: 'Use independent, data-informed insights to support pricing, presentation and marketing conversations with your vendor.',
        },
        {
          title: 'Protect Your Instructions',
          text: 'Demonstrate proactive action and give vendors clearer reasons to continue working with your agency.',
        },
      ],
    },
  },
};

const LinkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#333E48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const ReminderForm = ({ audience }: { audience: AdsAudience }) => {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState('sending');
    try {
      await requestUrlReminder({ first_name: firstName.trim(), email: email.trim(), audience });
      setState('sent');
    } catch {
      setState('error');
    }
  };

  if (state === 'sent') {
    return (
      <div className="slw-ads-reminder slw-ads-reminder-done" role="status">
        <b>Reminder on its way.</b> We&rsquo;ve emailed {email.trim()} a link back to this page, so you can add your
        property link whenever you have it.
      </div>
    );
  }

  return (
    <div className="slw-ads-reminder">
      {!open ? (
        <p className="slw-ads-reminder-prompt">
          Don&rsquo;t have your property link right now?{' '}
          <button type="button" className="slw-ads-linkbtn" onClick={() => setOpen(true)}>Email me a reminder</button>
        </p>
      ) : (
        <form className="slw-ads-reminder-form" onSubmit={submit}>
          <p className="slw-ads-reminder-copy">
            We&rsquo;ll send you a short reminder so you can return and add your Rightmove listing link when you have it.
          </p>
          <div className="slw-ads-reminder-fields">
            <input type="text" placeholder="First name" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            <input type="email" placeholder="Email address" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <button type="submit" className="slw-btn-black" disabled={state === 'sending'}>
              {state === 'sending' ? 'Sending…' : 'Email me a reminder'}
            </button>
          </div>
          {state === 'error' && <p className="slw-error">We couldn&rsquo;t set that up. Please check your email address and try again.</p>}
        </form>
      )}
    </div>
  );
};

export const AdsListingForm = ({
  audience,
  onSubmit,
  loading,
  error,
  welcomeName,
}: {
  audience: AdsAudience;
  onSubmit: (listingUrl: string) => void;
  loading: boolean;
  error: string;
  welcomeName?: string;
}) => {
  const [url, setUrl] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const text = ADS_COPY[audience];

  // Reminder emails link to #listing-link: put the visitor straight in the box.
  useEffect(() => {
    if (window.location.hash === '#listing-link' || welcomeName) inputRef.current?.focus();
  }, [welcomeName]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (url.trim()) onSubmit(url.trim());
  };

  return (
    <div className="slw-ads-form-wrap">
      {welcomeName && (
        <p className="slw-ads-welcome">Welcome back, {welcomeName}. Paste your property link below to continue.</p>
      )}
      <p className="slw-ads-form-label">Paste your property listing to get started</p>
      <form id="listing-link" className="slw-ads-form" onSubmit={submit}>
        <label className="slw-id-input slw-ads-input">
          <LinkIcon />
          <input
            ref={inputRef}
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="Rightmove URL"
            aria-label="Rightmove URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
        </label>
        <button type="submit" className="slw-btn-black slw-ads-submit" disabled={loading}>
          {loading ? 'Assessing…' : text.button}
        </button>
      </form>
      <p className="slw-id-hint slw-ads-hint">
        <span className="slw-info-dot">i</span> Your property URL is the link to your property listing on Rightmove.
      </p>
      {error && <p className="slw-error">{error}</p>}
      <ReminderForm audience={audience} />
    </div>
  );
};

const ANALYSING_MESSAGES = [
  'Reading the listing…',
  'Looking at how it’s presented to buyers…',
  'Comparing it with the homes buyers can see nearby…',
  'Preparing your assessment preview…',
];

/** Shown while a listing is read and assessed (up to a minute). */
export const AdsAnalysingStep = () => {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const handle = window.setInterval(() => setIndex((i) => Math.min(i + 1, ANALYSING_MESSAGES.length - 1)), 7000);
    return () => window.clearInterval(handle);
  }, []);
  return (
    <section className="slw-finding" aria-live="polite">
      <div className="slw-spinner" />
      <p>{ANALYSING_MESSAGES[index]}</p>
      <small className="slw-ads-wait">This usually takes under a minute.</small>
    </section>
  );
};

export const AdsStyles = () => (
  <style>{`
    /* Hero type matches /stale-listings/seller (StaleListingsLanding.tsx):
       Plus Jakarta Sans ExtraBold heading, Inter copy, same sizes at each
       breakpoint. Scoped to the ads pages; /check keeps its own. */
    .slw-page .slw-hero h1{font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;font-size:56px;line-height:110%;letter-spacing:-0.03em;color:#1F1F1E}
    .slw-page .slw-hero-copy{font-family:'Inter',sans-serif;font-weight:400;font-size:16px;line-height:150%;letter-spacing:-0.02em;color:#000}
    @media (max-width:1024px){.slw-page .slw-hero h1{font-size:38px}}
    @media (max-width:768px){.slw-page .slw-hero h1{font-size:36px;line-height:120%}}
    .slw-ads-form-wrap{margin:24px auto 0;max-width:600px}
    .slw-ads-form-label{margin:0 0 10px;font-family:'Inter',sans-serif;font-size:15px;font-weight:700;color:#202124}
    .slw-ads-welcome{margin:0 0 12px;font-size:15px;font-weight:600;color:#202124}
    .slw-ads-form{display:flex;gap:10px;align-items:stretch}
    .slw-ads-input{flex:1;min-width:0}
    .slw-ads-input input{min-width:0}
    .slw-ads-submit{flex:none;width:auto;white-space:nowrap;padding:0 22px;border-radius:12px}
    .slw-ads-hint{white-space:normal}
    .slw-ads-reminder{margin:18px auto 0;font-size:14px;color:#334155}
    .slw-ads-reminder-prompt{margin:0}
    .slw-ads-linkbtn{background:none;border:none;padding:0;font:inherit;font-weight:700;color:#a409d2;text-decoration:underline;cursor:pointer}
    .slw-ads-reminder-form{background:#f8f5fb;border:1px solid #eadcf3;border-radius:14px;padding:16px;text-align:left}
    .slw-ads-reminder-copy{margin:0 0 12px;font-size:13px;line-height:1.5;color:#475467}
    .slw-ads-reminder-fields{display:flex;gap:8px;flex-wrap:wrap}
    .slw-ads-reminder-fields input{flex:1 1 160px;min-width:0;border:1px solid #d9dde3;border-radius:10px;padding:12px 14px;font:inherit;font-size:15px;background:#fff}
    .slw-ads-reminder-fields .slw-btn-black{flex:1 1 100%;border-radius:10px}
    .slw-ads-reminder-done{background:#ecfdf3;border:1px solid #abefc6;border-radius:14px;padding:14px 16px;color:#065f46;line-height:1.5}
    .slw-ads-wait{color:#98a2b3;font-size:13px}
    .slw-ads-facts{margin:8px 0 0;font-size:16px;font-weight:600;color:#202124}
    .slw-ads-summary .slw-confirm-signals{margin-top:18px}
    .slw-ads-summary-loading{display:flex;justify-content:center;padding:28px 0}
    .slw-ads-summary-intro{margin:22px 0 10px;font-size:15px;font-weight:600;color:#202124}
    .slw-ads-summary-list{list-style:none;margin:0;padding:0;display:grid;gap:10px}
    .slw-ads-summary-list li{font-size:15px;line-height:1.45;color:#475467;padding:12px 14px;background:#f8f9fb;border-radius:10px}
    .slw-ads-summary-list b{color:#202124}
    .slw-ads-pending{color:#98a2b3}
    .slw-ads-finding{margin:20px 0 0;padding:14px 16px;border-left:3px solid #a409d2;background:#fbf7fd;border-radius:0 10px 10px 0}
    .slw-ads-finding b{display:block;font-size:14px;color:#202124;margin-bottom:6px}
    .slw-ads-finding p{margin:0;font-style:italic;font-size:15px;line-height:1.5;color:#334155}
    .slw-ads-see-all{margin-top:24px;width:100%}
    @media (max-width:640px){
      .slw-ads-form{flex-direction:column}
      .slw-ads-submit{width:100%;padding:15px 22px}
    }
  `}</style>
);

const COMPETITION_BASIS: Record<string, string> = {
  similar: 'similar listings',
  same_type: 'listings of the same type',
  nearby: 'homes for sale nearby',
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Ads homeowners' Confirm Property step, before the details form: what the
 * assessment found, in brief. "See all findings" then asks for their
 * details. Every line comes from their report (or, for competition, the
 * homes for sale around it), and a line with nothing behind it is left out. */
export const AdsSellerSummary = ({
  prospect,
  access,
  totalFactors,
  onContinue,
}: {
  prospect: ProspectPreview;
  access: { token?: string; code?: string };
  totalFactors: number;
  onContinue: () => void;
}) => {
  const [summary, setSummary] = useState<AdsSummary | null>(null);
  const snapshot = prospect.listing_snapshot || {};
  const image = snapshot.image || (snapshot.images && snapshot.images[0]) || '';

  // The competing-listings count can still be on its way: ask again until
  // it's in, giving up after about three minutes.
  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    let handle: number | undefined;
    const load = async () => {
      try {
        const data = await getAdsSummary(access);
        if (cancelled) return;
        setSummary(data);
        if (data.competition.status === 'pending' && tries++ < 45) handle = window.setTimeout(load, 4000);
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
    prospect.bedrooms ? plural(prospect.bedrooms, 'Bedroom', 'Bedrooms') : null,
    prospect.bathrooms ? plural(prospect.bathrooms, 'Bathroom', 'Bathrooms') : null,
  ].filter(Boolean);

  const rows: { label: string; text: ReactNode }[] = [];
  if (summary) {
    if (summary.buyer_appeal) rows.push({ label: 'Buyer Appeal', text: summary.buyer_appeal });
    if (summary.pricing) rows.push({ label: 'Pricing Position', text: summary.pricing });
    if (summary.presentation.count > 0) {
      rows.push({ label: 'Listing Presentation', text: `${plural(summary.presentation.count, 'opportunity', 'opportunities')} identified` });
    } else if (summary.presentation.status) {
      rows.push({ label: 'Listing Presentation', text: summary.presentation.status });
    }
    const competition = summary.competition;
    if (competition.status === 'ready' && competition.count) {
      rows.push({
        label: 'Local Competition',
        text: `Your property is competing with ${competition.count} ${COMPETITION_BASIS[competition.basis || 'nearby'] || 'homes for sale nearby'}`,
      });
    } else if (competition.status === 'pending') {
      rows.push({ label: 'Local Competition', text: <span className="slw-ads-pending">Checking competing listings nearby…</span> });
    } else if (competition.fallback) {
      rows.push({ label: 'Local Competition', text: competition.fallback });
    }
  }

  return (
    <section className="slw-confirm">
      <h1>We Found Your Property</h1>
      <p className="slw-confirm-copy">
        See what may be holding your property back. Share our recommendations with your agent or implement them yourself.
      </p>
      <div className="slw-confirm-card">
        <div className="slw-confirm-image" style={image ? { backgroundImage: `url(${image})` } : undefined} />
        <div className="slw-confirm-details slw-ads-summary">
          <h2>{prospect.property_address}</h2>
          {facts.length > 0 && <p className="slw-ads-facts">{facts.join(' · ')}</p>}
          <div className="slw-confirm-signals">
            <div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <path d="M12 9v4M12 17h.01" />
              </svg>
              <span>We found <b>{totalFactors} factors</b> that may be affecting your sale</span>
            </div>
          </div>
          {summary === null ? (
            <div className="slw-ads-summary-loading"><div className="slw-spinner" /></div>
          ) : (
            <>
              {rows.length > 0 && (
                <>
                  <p className="slw-ads-summary-intro">Your assessment identified potential issues across:</p>
                  <ul className="slw-ads-summary-list">
                    {rows.map((row) => (
                      <li key={row.label}><b>{row.label}</b> &mdash; {row.text}</li>
                    ))}
                  </ul>
                </>
              )}
              {summary.finding && (
                <div className="slw-ads-finding">
                  <b>One finding:</b>
                  <p>{summary.finding}</p>
                </div>
              )}
            </>
          )}
          <button type="button" className="slw-btn-black slw-ads-see-all" onClick={onContinue}>
            See All {totalFactors} Findings &rarr;
          </button>
        </div>
      </div>
    </section>
  );
};
