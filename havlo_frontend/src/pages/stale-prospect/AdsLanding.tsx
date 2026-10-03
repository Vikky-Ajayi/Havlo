import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { requestUrlReminder, type AdsAudience } from './api';

// Meta-ads landing pages (/assess/seller and /assess/agent): the /check
// wizard with the property-code box swapped for the listing link, and an
// "email me a reminder" option for visitors without the link to hand
// (app/services/ads_funnel.py, ads_nurture.py on the backend).

export const ADS_COPY: Record<AdsAudience, { heading: ReactNode; copy: string; placeholder: string; button: string }> = {
  owner: {
    heading: (
      <>
        See <span className="slw-accent">What Could Be Holding</span> Back Your Property&rsquo;s Sale
      </>
    ),
    copy:
      'Paste your Rightmove listing link. We’ll analyse your property’s market positioning, listing presentation and buyer appeal to identify potential barriers to sale — and the changes that could help.',
    placeholder: 'Paste your Rightmove listing link',
    button: 'Assess My Property',
  },
  agent: {
    heading: (
      <>
        See <span className="slw-accent">What Could Be Holding</span> Back Your Listing
      </>
    ),
    copy:
      'Paste the Rightmove link for an instruction that’s taking longer than expected. We’ll analyse its market position, presentation and buyer appeal, and show you what’s worth reviewing before your next vendor conversation.',
    placeholder: 'Paste the Rightmove listing link',
    button: 'Assess This Listing',
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
            We&rsquo;ll send you a short reminder so you can return and add your Rightmove, Zoopla, OnTheMarket or other
            online property listing link when you have it.
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
      <form id="listing-link" className="slw-ads-form" onSubmit={submit}>
        <label className="slw-id-input slw-ads-input">
          <LinkIcon />
          <input
            ref={inputRef}
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder={text.placeholder}
            aria-label={text.placeholder}
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
        <span className="slw-info-dot">i</span> Open the property on Rightmove, then copy the link from your browser&rsquo;s address bar.
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
    .slw-ads-form-wrap{margin:24px auto 0;max-width:600px}
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
    @media (max-width:640px){
      .slw-ads-form{flex-direction:column}
      .slw-ads-submit{width:100%;padding:15px 22px}
    }
  `}</style>
);
