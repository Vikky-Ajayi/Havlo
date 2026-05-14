import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { usePageMeta } from '../hooks/usePageMeta';

const PURPLE = '#A409D2';

const PACKAGE_LABELS: Record<string, { name: string; turnaround: string }> = {
  quick_insight: { name: 'Quick Insight', turnaround: '48 hours' },
  professional_review: { name: 'Professional Review', turnaround: '24 hours (priority)' },
  premium_strategy: { name: 'Premium Strategy', turnaround: '12 hours (express)' },
};

const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 7V5C4 2.79086 5.79086 1 8 1C10.2091 1 12 2.79086 12 5V7M3.2 15H12.8C13.4627 15 14 14.4627 14 13.8V8.2C14 7.53726 13.4627 7 12.8 7H3.2C2.53726 7 2 7.53726 2 8.2V13.8C2 14.4627 2.53726 15 3.2 15Z" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const GreenBadgeIcon = () => (
  <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M60 8L72.5 16.5L87.5 14.5L94 28.5L107 36L105.5 51.5L115 63L105.5 74.5L107 90L94 97.5L87.5 111.5L72.5 109.5L60 118L47.5 109.5L32.5 111.5L26 97.5L13 90L14.5 74.5L5 63L14.5 51.5L13 36L26 28.5L32.5 14.5L47.5 16.5L60 8Z" fill="#D1FAE5" stroke="#6EE7B7" strokeWidth="2"/>
    <path d="M40 62L53 75L80 48" stroke="#059669" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

type PageState = 'loading' | 'verifying' | 'success' | 'failed' | 'no_ref';

export function StaleListingsComplete() {
  usePageMeta({
    title: 'Your Property Assessment is Confirmed | Havlo',
    description: 'Your listing review is confirmed. Our team is now preparing your personalised property assessment, pricing analysis, and action plan based on your submission.',
    canonical: 'https://www.heyhavlo.com/stale-listings/complete',
  });
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reference = searchParams.get('ref');

  const [pageState, setPageState] = useState<PageState>(reference ? 'loading' : 'no_ref');
  const [userEmail, setUserEmail] = useState('');
  const [planKey, setPlanKey] = useState('professional_review');
  const [pollCount, setPollCount] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const verifyAndFetch = async (ref: string) => {
    try {
      const result = await api.staleListingsVerifyPayment(ref);
      const { payment_status } = result as { payment_status: string; reference: string };

      if (payment_status === 'completed') {
        stopPolling();
        // Fetch full assessment for real email + package
        try {
          const assessment = await api.staleListingsGetReport(ref);
          const a = assessment as { email: string; package: string };
          setUserEmail(a.email || '');
          setPlanKey(a.package || 'professional_review');
        } catch {
          // non-fatal — reference and status are already confirmed
        }
        setPageState('success');
        return true;
      }
      if (payment_status === 'failed') {
        stopPolling();
        setPageState('failed');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    if (!reference) { setPageState('no_ref'); return; }

    setPageState('loading');
    verifyAndFetch(reference).then(done => {
      if (!done) {
        setPageState('verifying');
        let count = 0;
        pollRef.current = setInterval(async () => {
          count++;
          setPollCount(count);
          const resolved = await verifyAndFetch(reference);
          if (resolved || count >= 18) {
            stopPolling();
            if (!resolved) setPageState('verifying');
          }
        }, 5000);
      }
    });

    return stopPolling;
  }, [reference]);

  const pkg = PACKAGE_LABELS[planKey] || PACKAGE_LABELS.professional_review;

  return (
    <div style={{ minHeight: '100vh', background: '#F7F9F9', fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column', overflowX: 'hidden', width: '100%', boxSizing: 'border-box' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800&family=Inter:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .sl-c-secure-wrap { display: flex; }
        .sl-c-hamburger { display: none; }
        .sl-c-step-label { display: inline; }
        .sl-c-step-line { width: 80px; }
        @media (max-width: 640px) {
          .sl-c-navbar { padding: 0 20px !important; }
          .sl-c-stepper { padding: 16px 20px !important; }
          .sl-c-content { padding: 40px 20px !important; }
          .sl-c-secure-wrap { display: none !important; }
          .sl-c-hamburger { display: flex !important; }
          .sl-c-step-label { display: none !important; }
          .sl-c-step-line { width: 32px !important; margin: 0 8px !important; }
          .sl-c-done-btn { width: 100% !important; padding: 16px 24px !important; }
        }
      `}</style>

      {/* NAVBAR */}
      <header className="sl-c-navbar" style={{ display: 'flex', height: 80, padding: '0 56px', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F4F4F4', background: '#FFF', boxSizing: 'border-box', flexShrink: 0 }}>
        <button onClick={() => navigate('/stale-listings')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <img src="/stale-logo.png" alt="StaleListings" style={{ height: 40, width: 'auto', display: 'block', flexShrink: 0 }} />
        </button>
        {/* Desktop: secure badge */}
        <div className="sl-c-secure-wrap" style={{ alignItems: 'center', gap: 6 }}>
          <LockIcon />
          <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 16, color: '#000', letterSpacing: '-0.32px' }}>Secure assessment · SSL encrypted</span>
        </div>
        {/* Mobile: hamburger */}
        <button className="sl-c-hamburger" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, alignItems: 'center', justifyContent: 'center' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 6H21M3 12H21M3 18H21" stroke="#1F1F1E" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </header>

      {/* STEPPER */}
      <div className="sl-c-stepper" style={{ background: '#fff', borderBottom: '1px solid #F4F4F4', padding: '20px 56px', display: 'flex', justifyContent: 'center', alignItems: 'center', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {[
            { num: 1, label: 'Your property' },
            { num: 2, label: 'Choose Plan' },
            { num: 3, label: 'Completed' },
          ].map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: pageState === 'success' || i < 2 ? PURPLE : '#E0E0E0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14, color: '#fff' }}>{step.num}</span>
                </div>
                <span className="sl-c-step-label" style={{ fontFamily: 'Inter, sans-serif', fontWeight: step.num === 3 ? 600 : 400, fontSize: 14, color: '#000' }}>{step.label}</span>
              </div>
              {i < 2 && <div className="sl-c-step-line" style={{ width: 80, height: 1, background: PURPLE, margin: '0 20px' }} />}
            </div>
          ))}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="sl-c-content" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 56px', boxSizing: 'border-box' }}>
        <div style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40 }}>

          {/* ── NO REF ── */}
          {pageState === 'no_ref' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
              <h2 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: 26, margin: '0 0 10px' }}>Missing reference</h2>
              <p style={{ color: '#666', fontSize: 15, margin: '0 0 24px' }}>No assessment reference was found. Please complete the assessment form to get started.</p>
              <button onClick={() => navigate('/stale-listings')} style={{ background: '#020202', color: '#fff', border: 'none', borderRadius: 10, padding: '14px 32px', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                Back to StaleListings
              </button>
            </div>
          )}

          {/* ── LOADING / VERIFYING ── */}
          {(pageState === 'loading' || pageState === 'verifying') && (
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
              <div style={{ width: 64, height: 64, border: '4px solid #E5E7EB', borderTopColor: PURPLE, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <h2 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: 26, margin: 0, color: '#000' }}>
                {pageState === 'loading' ? 'Checking payment…' : 'Confirming your payment'}
              </h2>
              <p style={{ color: '#666', fontSize: 15, margin: 0, maxWidth: 380 }}>
                {pageState === 'loading'
                  ? 'Please wait while we verify your payment with our payment provider.'
                  : `We're confirming your payment with the payment provider. This usually takes a few seconds${pollCount > 3 ? ' — please stay on this page' : ''}.`}
              </p>
              {reference && (
                <p style={{ color: '#aaa', fontSize: 13 }}>Reference: <strong style={{ color: '#555' }}>{reference}</strong></p>
              )}
            </div>
          )}

          {/* ── PAYMENT FAILED ── */}
          {pageState === 'failed' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>❌</div>
              <h2 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: 26, margin: '0 0 10px', color: '#B91C1C' }}>Payment unsuccessful</h2>
              <p style={{ color: '#666', fontSize: 15, margin: '0 0 8px', maxWidth: 400 }}>
                Your payment could not be completed. No charge has been made to your account.
              </p>
              {reference && <p style={{ color: '#aaa', fontSize: 13, margin: '0 0 24px' }}>Reference: <strong style={{ color: '#555' }}>{reference}</strong></p>}
              <button onClick={() => navigate('/stale-listings/plan')} style={{ background: '#020202', color: '#fff', border: 'none', borderRadius: 10, padding: '14px 32px', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                Try again
              </button>
            </div>
          )}

          {/* ── SUCCESS ── */}
          {pageState === 'success' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center' }}>
                <GreenBadgeIcon />
                <h1 style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: 32, color: '#000', letterSpacing: '-0.5px', margin: 0 }}>
                  Assessment underway
                </h1>
                <p style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 16, color: '#444', lineHeight: '150%', margin: 0, maxWidth: 440 }}>
                  Your property is now undergoing a detailed market assessment. An experienced property specialist will review your listing, presentation, pricing, and buyer appeal before preparing your report.
                </p>
              </div>

              <div style={{ width: '100%', background: '#fff', borderRadius: 20, border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden', boxSizing: 'border-box' }}>
                {[
                  { label: 'Plan', value: pkg.name },
                  { label: 'Report delivery', value: pkg.turnaround },
                  { label: 'Sent to', value: userEmail || '—' },
                  { label: 'Reference', value: reference! },
                ].map((row, i, arr) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '20px 24px',
                    borderBottom: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                  }}>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 400, fontSize: 14, color: '#666' }}>{row.label}</span>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14, color: '#000', textAlign: 'right', maxWidth: 280 }}>{row.value}</span>
                  </div>
                ))}

                <div style={{ padding: '20px 24px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                  <button
                    onClick={() => navigate('/stale-listings')}
                    className="sl-c-done-btn"
                    style={{ display: 'flex', height: 52, padding: '16px 48px', justifyContent: 'center', alignItems: 'center', gap: 8, borderRadius: 10, background: '#020202', border: 'none', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 16, color: '#fff', cursor: 'pointer', letterSpacing: '-0.32px', margin: '0 auto' }}
                  >
                    Done
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
