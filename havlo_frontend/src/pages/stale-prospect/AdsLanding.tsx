import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { getAdsSummary, requestUrlReminder, type AdsAudience, type AdsChannel, type AdsSummary, type ManualListingDetails } from './api';
import { formatGbp, reportReady, type ProspectPreview } from './types';
import { WatchRightmoveLinkVideo } from './RightmoveLinkVideo';

// Ads landing pages, Meta (/assess/seller, /assess/agent) and Google
// (/g/seller, /g/agent): the /check
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

const ReminderForm = ({ audience, channel }: { audience: AdsAudience; channel: AdsChannel }) => {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState('sending');
    try {
      await requestUrlReminder({ first_name: firstName.trim(), email: email.trim(), audience, channel });
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
            We&rsquo;ll send you a short reminder so you can return and add your Rightmove or Zoopla listing link when you have it.
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

/** For a Zoopla listing we couldn't read: the address and asking price,
 * typed in. Inline styles, because /sell shows it without AdsStyles. */
export const ManualDetailsFields = ({
  message,
  loading,
  onSubmit,
}: {
  message: string;
  loading: boolean;
  onSubmit: (details: ManualListingDetails) => void;
}) => {
  const [address, setAddress] = useState('');
  const [price, setPrice] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = Number(price.replace(/[^\d.]/g, ''));
    if (address.trim() && value) onSubmit({ address: address.trim(), price: value });
  };
  const field = {
    border: '1px solid #d9dde3', borderRadius: 10, padding: '12px 14px', font: 'inherit', fontSize: 15,
    background: '#fff', color: '#1F1F1E', minWidth: 0, boxSizing: 'border-box' as const,
  };
  return (
    <form
      onSubmit={submit}
      style={{ marginTop: 12, background: '#f8f5fb', border: '1px solid #eadcf3', borderRadius: 14, padding: 16, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10 }}
    >
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: '#334155' }}>{message}</p>
      <input
        type="text" autoComplete="street-address" placeholder="Property address, including postcode" aria-label="Property address"
        value={address} onChange={(e) => setAddress(e.target.value)} required minLength={6} maxLength={300} style={{ ...field, width: '100%' }}
      />
      <input
        type="text" inputMode="numeric" placeholder="Asking price, for example 450000" aria-label="Asking price in pounds"
        value={price} onChange={(e) => setPrice(e.target.value)} required style={{ ...field, width: '100%' }}
      />
      <button
        type="submit" disabled={loading}
        style={{ border: 0, borderRadius: 10, padding: '14px 20px', font: 'inherit', fontSize: 15, fontWeight: 700, background: '#0B0B0B', color: '#fff', cursor: 'pointer' }}
      >
        {loading ? 'Assessing…' : 'Continue with these details'}
      </button>
    </form>
  );
};

export const AdsListingForm = ({
  audience,
  channel = 'meta',
  onSubmit,
  loading,
  error,
  welcomeName,
  manual,
}: {
  audience: AdsAudience;
  channel?: AdsChannel;
  onSubmit: (listingUrl: string, manual?: ManualListingDetails) => void;
  loading: boolean;
  error: string;
  welcomeName?: string;
  /** Set when the Zoopla link just sent couldn't be read. */
  manual?: { url: string; message: string } | null;
}) => {
  // The form is rebuilt while the listing is being read: a Zoopla link we couldn't read comes back with it.
  const [url, setUrl] = useState(manual?.url ?? '');
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
            placeholder="Rightmove or Zoopla URL"
            aria-label="Rightmove or Zoopla URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
        </label>
        <button type="submit" className="slw-btn-black slw-ads-submit" disabled={loading}>
          {loading ? 'Assessing…' : text.button}
        </button>
      </form>
      {/* In place of the "Your property URL is the link to…" hint: the 15-second
          video shows where to find it (RightmoveLinkVideo.tsx). */}
      <WatchRightmoveLinkVideo onPasteLink={() => inputRef.current?.focus()} />
      {error && <p className="slw-error">{error}</p>}
      {manual && url.trim() === manual.url && (
        <ManualDetailsFields message={manual.message} loading={loading} onSubmit={(details) => onSubmit(url.trim(), details)} />
      )}
      <ReminderForm audience={audience} channel={channel} />
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
    /* /offer: a turning ring by each line still being checked. */
    .slw-ads-summary-list li.slw-ads-row-loading{display:flex;align-items:center;justify-content:space-between;gap:12px}
    .slw-row-spinner{flex:none;width:18px;height:18px;border-radius:50%;border:2.5px solid #EBD7F6;border-top-color:#A409D2;animation:slw-row-spin .8s linear infinite}
    @keyframes slw-row-spin{to{transform:rotate(360deg)}}
    @media (prefers-reduced-motion:reduce){.slw-row-spinner{animation-duration:2.4s}}
    /* /offer: the online-views line under the price. */
    .slw-views-notice{display:flex;align-items:flex-start;gap:8px;margin:10px 0 0;font-size:15px;line-height:1.45;font-weight:500;color:#8A08B4}
    .slw-views-notice svg{flex:none;margin-top:2px}
    .slw-views-notice b{font-weight:800;color:#A409D2}
    .slw-ads-finding{margin:20px 0 0;padding:14px 16px;border-left:3px solid #a409d2;background:#fbf7fd;border-radius:0 10px 10px 0}
    .slw-ads-finding b{display:block;font-size:14px;color:#202124;margin-bottom:6px}
    .slw-ads-finding p{margin:0;font-size:15px;line-height:1.5;color:#334155}
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

/** The /offer page's attention line under a property's price (Nov 2026 brief).
 * Always "over 200": the figure Rightmove gave for every listing's first days,
 * never a per-property count we can't see. */
export const ViewsNotice = ({ className = '' }: { className?: string }) => (
  <p className={`slw-views-notice ${className}`.trim()}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-7.5 11-7.5S23 12 23 12s-4 7.5-11 7.5S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
    <span>This property has had <b>over 200 online views</b> but may not be turning into as many viewings and offers as it could.</span>
  </p>
);

/** A small turning ring beside a line that's still being worked out. */
export const RowSpinner = () => <span className="slw-row-spinner" role="status" aria-label="Still checking" />;

/** Ads homeowners' Confirm Property step, before the details form: what the
 * assessment found, in brief. "See all findings" then asks for their
 * details. Every line comes from their report (or, for competition, the
 * homes for sale around it), and a line with nothing behind it is left out. */
export const AdsSellerSummary = ({
  prospect,
  access,
  totalFactors,
  onContinue,
  expert = false,
}: {
  prospect: ProspectPreview;
  access: { token?: string; code?: string };
  totalFactors: number;
  onContinue: () => void;
  /** The /offer page: the views line under the price, and a turning ring by
   * each line still being checked, so nobody leaves thinking it's stuck. */
  expert?: boolean;
}) => {
  const [summary, setSummary] = useState<AdsSummary | null>(null);
  const snapshot = prospect.listing_snapshot || {};
  const image = snapshot.image || (snapshot.images && snapshot.images[0]) || '';

  // The competing-listings count, and the rows from the report (written in
  // the background after the listing link), can still be on their way: ask
  // again until they're in, giving up after about three minutes. The wizard
  // refreshes `prospect` when the report lands, which asks once more.
  const reportPending = !reportReady(prospect);
  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    let handle: number | undefined;
    const load = async () => {
      try {
        const data = await getAdsSummary(access);
        if (cancelled) return;
        setSummary(data);
        const waiting = data.competition.status === 'pending' || data.report_status === 'pending';
        if (waiting && tries++ < 45) handle = window.setTimeout(load, 4000);
      } catch {
        if (!cancelled && tries++ < 3) handle = window.setTimeout(load, 4000);
      }
    };
    void load();
    return () => {
      cancelled = true;
      if (handle) window.clearTimeout(handle);
    };
  }, [access.token, access.code, reportPending]);

  const facts = [
    prospect.asking_price ? formatGbp(prospect.asking_price) : null,
    prospect.bedrooms ? plural(prospect.bedrooms, 'Bedroom', 'Bedrooms') : null,
    prospect.bathrooms ? plural(prospect.bathrooms, 'Bathroom', 'Bathrooms') : null,
  ].filter(Boolean);

  const rows: { label: string; text: ReactNode; pending?: boolean }[] = [];
  const analysing = <span className="slw-ads-pending">Analysing your listing…</span>;
  if (summary && (reportPending || (summary.report_status && summary.report_status !== 'ready'))) {
    rows.push({ label: 'Buyer Appeal', text: analysing, pending: true });
    rows.push({ label: 'Pricing Position', text: analysing, pending: true });
    rows.push({ label: 'Listing Presentation', text: analysing, pending: true });
  } else if (summary) {
    if (summary.buyer_appeal) rows.push({ label: 'Buyer Appeal', text: summary.buyer_appeal });
    if (summary.pricing) rows.push({ label: 'Pricing Position', text: summary.pricing });
    if (summary.presentation.count > 0) {
      rows.push({ label: 'Listing Presentation', text: `${plural(summary.presentation.count, 'opportunity', 'opportunities')} identified` });
    } else if (summary.presentation.status) {
      rows.push({ label: 'Listing Presentation', text: summary.presentation.status });
    }
  }
  if (summary) {
    const competition = summary.competition;
    if (competition.status === 'ready' && competition.count) {
      rows.push({
        label: 'Local Competition',
        text: `Your property is competing with ${competition.count} ${COMPETITION_BASIS[competition.basis || 'nearby'] || 'homes for sale nearby'}`,
      });
    } else if (competition.status === 'pending') {
      rows.push({ label: 'Local Competition', text: <span className="slw-ads-pending">Checking competing listings nearby…</span>, pending: true });
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
          {expert && <ViewsNotice />}
          <div className="slw-confirm-signals">
            <div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <path d="M12 9v4M12 17h.01" />
              </svg>
              {reportPending
                ? <span>We&rsquo;re checking the factors that may be affecting your sale</span>
                : <span>We found <b>{totalFactors} factors</b> that may be affecting your sale</span>}
            </div>
          </div>
          {summary === null ? (
            <div className="slw-ads-summary-loading"><div className="slw-spinner" /></div>
          ) : (
            <>
              {rows.length > 0 && (
                <>
                  <p className="slw-ads-summary-intro">
                    {reportPending ? 'Your assessment is checking:' : 'Your assessment identified potential issues across:'}
                  </p>
                  <ul className="slw-ads-summary-list">
                    {rows.map((row) => (
                      expert && row.pending ? (
                        <li key={row.label} className="slw-ads-row-loading">
                          <span><b>{row.label}</b> &mdash; {row.text}</span>
                          <RowSpinner />
                        </li>
                      ) : (
                        <li key={row.label}><b>{row.label}</b> &mdash; {row.text}</li>
                      )
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
          <div className="slw-ads-finding">
            <b>There may already be factors limiting buyer interest.</b>
            <p>
              See what we identified, what to improve, and the recommended actions that could increase your chances of a
              faster sale.
            </p>
          </div>
          <button type="button" className="slw-btn-black slw-ads-see-all" onClick={onContinue}>
            {reportPending ? 'See All Findings & Recommendations' : `See All ${totalFactors} Findings & Recommendations`} &rarr;
          </button>
        </div>
      </div>
    </section>
  );
};
