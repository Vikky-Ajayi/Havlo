import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CustomOfferFlowShell } from '../components/custom-offers/CustomOfferFlowUi';
import { api } from '../lib/api';
import { clearCustomOfferDraft } from '../lib/customOffers';
import { usePageMeta } from '../hooks/usePageMeta';

type PageState = 'loading' | 'verifying' | 'success' | 'failed' | 'missing';

export function CustomOffersComplete() {
  usePageMeta({
    title: 'CustomOffer Submission | Havlo',
    description: 'We are confirming your CustomOffer submission and secure payment.',
  });

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reference = searchParams.get('ref') || '';
  const [pageState, setPageState] = useState<PageState>(reference ? 'loading' : 'missing');
  const [pollCount, setPollCount] = useState(0);
  const [longWait, setLongWait] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => {
    if (!reference) {
      setPageState('missing');
      return;
    }

    setPageState('loading');
    setPollCount(0);
    setLongWait(false);
    let cancelled = false;

    const verify = async () => {
      try {
        const result = await api.customOffersVerifyPayment(reference);
        if (!cancelled && result.payment_status === 'completed') {
          clearCustomOfferDraft();
          stopPolling();
          setPageState('success');
          return true;
        }
        if (!cancelled && result.payment_status === 'failed') {
          stopPolling();
          setPageState('failed');
          return true;
        }
      } catch {
        if (cancelled) return true;
      }
      return false;
    };

    const scheduleVerify = (delayMs: number, nextCount: number) => {
      pollRef.current = setTimeout(async () => {
        if (cancelled) return;
        setPollCount(nextCount);
        if (nextCount >= 18) {
          setLongWait(true);
        }
        const resolved = await verify();
        if (!resolved && !cancelled) {
          setPageState('verifying');
          scheduleVerify(nextCount >= 18 ? 7000 : 4000, nextCount + 1);
        }
      }, delayMs);
    };

    verify().then((done) => {
      if (!done && !cancelled) {
        setPageState('verifying');
        scheduleVerify(4000, 1);
      }
    });

    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [reference]);

  return (
    <CustomOfferFlowShell
      eyebrow={pageState === 'success' ? 'STEP 1 OF 6' : undefined}
      title={pageState === 'success' ? 'Confirmation' : undefined}
      subtitle={pageState === 'success' ? 'Please confirm the following before submitting your proposal.' : undefined}
      contentWidth={820}
      background={pageState === 'success' ? '#F4F5F6' : '#F5F6F7'}
    >
      <style>{`
        .co-complete-wrap {
          min-height: 520px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .co-complete-loader {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          text-align: center;
          color: #111111;
        }
        .co-complete-loader-ring {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 3px solid rgba(0, 0, 0, 0.12);
          border-top-color: #111111;
          animation: co-complete-spin 0.8s linear infinite;
        }
        .co-complete-modal-backdrop {
          margin-top: 6px;
          position: relative;
          min-height: 460px;
        }
        .co-complete-dim {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.35);
          border-radius: 18px;
        }
        .co-complete-base {
          padding: 22px 0 0;
        }
        .co-complete-checks {
          display: grid;
          gap: 12px;
        }
        .co-complete-check {
          min-height: 78px;
          border: 1.5px solid rgba(0, 0, 0, 0.12);
          border-radius: 10px;
          background: #FFFFFF;
          padding: 18px 20px;
          display: flex;
          align-items: center;
          gap: 12px;
          color: #111111;
          font-size: 17px;
          line-height: 1.4;
        }
        .co-complete-check.is-active {
          border-color: #16A34A;
        }
        .co-complete-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 34px;
        }
        .co-complete-actions button {
          height: 48px;
          border-radius: 6px;
          font-size: 17px;
          font-weight: 500;
          padding: 0 34px;
        }
        .co-complete-actions .secondary {
          border: 1px solid rgba(0, 0, 0, 0.20);
          background: #FFFFFF;
        }
        .co-complete-actions .primary {
          border: 0;
          background: #000000;
          color: #FFFFFF;
        }
        .co-complete-modal {
          position: absolute;
          left: 50%;
          top: 34px;
          transform: translateX(-50%);
          width: min(430px, calc(100% - 32px));
          border-radius: 18px;
          background: #FFFFFF;
          box-shadow: 0 18px 60px rgba(0, 0, 0, 0.18);
          padding: 30px 32px 26px;
          text-align: center;
          z-index: 1;
        }
        .co-complete-modal h2 {
          margin: 6px 0 10px;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 30px;
          font-weight: 800;
          line-height: 1.1;
          letter-spacing: -0.05em;
        }
        .co-complete-modal p {
          margin: 0 0 18px;
          color: #1F1F1F;
          font-size: 17px;
          line-height: 1.45;
        }
        .co-complete-modal button {
          min-width: 102px;
          height: 48px;
          border-radius: 6px;
          border: 0;
          background: #000000;
          color: #FFFFFF;
          font-size: 17px;
          font-weight: 500;
          cursor: pointer;
        }
        @keyframes co-complete-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .co-complete-wrap {
            min-height: 420px;
          }
          .co-complete-modal-backdrop {
            min-height: 360px;
          }
          .co-complete-modal {
            top: 12px;
            width: calc(100% - 32px);
            padding: 26px 22px 22px;
          }
          .co-complete-modal h2 {
            font-size: 27px;
          }
          .co-complete-actions {
            flex-direction: column;
          }
        }
      `}</style>

      {pageState === 'missing' ? (
        <div className="co-complete-wrap">
          <div className="co-complete-loader">
            <h2 style={{ margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 28, fontWeight: 800 }}>Missing reference</h2>
            <p style={{ margin: 0, color: '#555555', fontSize: 15 }}>We could not find the CustomOffer submission reference for this payment return.</p>
          </div>
        </div>
      ) : null}

      {(pageState === 'loading' || pageState === 'verifying') ? (
        <div className="co-complete-wrap">
          <div className="co-complete-loader">
            <div className="co-complete-loader-ring" />
            <h2 style={{ margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 28, fontWeight: 800 }}>
              {pageState === 'loading' ? 'Checking payment...' : 'Confirming your payment'}
            </h2>
            <p style={{ margin: 0, color: '#555555', fontSize: 15, maxWidth: 420 }}>
              {pageState === 'loading'
                ? 'Please wait while we verify your secure payment and proposal submission.'
                : longWait
                  ? 'This is taking a little longer than usual. We are still checking with the payment provider and will update this page automatically.'
                  : `We are waiting for final confirmation from the payment provider. Attempt ${pollCount} and counting.`}
            </p>
            {pageState === 'verifying' && longWait ? (
              <button
                type="button"
                onClick={() => {
                  setPageState('loading');
                  api.customOffersVerifyPayment(reference)
                    .then((result) => {
                      if (result.payment_status === 'completed') {
                        clearCustomOfferDraft();
                        setPageState('success');
                      } else if (result.payment_status === 'failed') {
                        setPageState('failed');
                      } else {
                        setPageState('verifying');
                      }
                    })
                    .catch(() => setPageState('verifying'));
                }}
                style={{ marginTop: 8, height: 44, borderRadius: 999, border: '1px solid rgba(0, 0, 0, 0.12)', background: '#FFFFFF', padding: '0 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                Check again now
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {pageState === 'failed' ? (
        <div className="co-complete-wrap">
          <div className="co-complete-loader">
            <h2 style={{ margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 28, fontWeight: 800 }}>Payment unsuccessful</h2>
            <p style={{ margin: 0, color: '#555555', fontSize: 15, maxWidth: 420 }}>
              Your payment has not been confirmed. Please try again from the plans page or contact support if the issue persists.
            </p>
            <button
              type="button"
              onClick={() => navigate('/custom-offers/plan')}
              style={{ marginTop: 14, height: 44, borderRadius: 6, border: 0, background: '#000000', color: '#FFFFFF', padding: '0 28px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
            >
              Return to plans
            </button>
          </div>
        </div>
      ) : null}

      {pageState === 'success' ? (
        <div className="co-complete-modal-backdrop">
          <div className="co-complete-base">
            <label className="cof-field-label">Please confirm:</label>
            <div className="co-complete-checks">
              <div className="co-complete-check is-active">
                <CheckIcon />
                <span>I understand seller responses are not guaranteed.</span>
              </div>
              <div className="co-complete-check">
                <EmptyCircle />
                <span>I understand submission fees are non-refundable.</span>
              </div>
              <div className="co-complete-check">
                <EmptyCircle />
                <span>I confirm the information provided is accurate to the best of my knowledge.</span>
              </div>
            </div>
            <div className="co-complete-actions">
              <button type="button" className="secondary" onClick={() => navigate('/custom-offers/plan')}>Back</button>
              <button type="button" className="primary" disabled>Continue</button>
            </div>
          </div>
          <div className="co-complete-dim" />
          <div className="co-complete-modal">
            <SuccessBadge />
            <h2>Proposal Submitted</h2>
            <p>Your proposal has been securely delivered for homeowner review. You&apos;ll be notified if the seller chooses to engage.</p>
            <button type="button" onClick={() => navigate(`/custom-offers/status/${encodeURIComponent(reference)}`)}>Done</button>
          </div>
        </div>
      ) : null}
    </CustomOfferFlowShell>
  );
}

function CheckIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#16A34A" />
      <path d="M7.5 12.5L10.7 15.7L16.5 9.9" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EmptyCircle() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="12" cy="12" r="9.25" stroke="#BBBBBB" strokeWidth="1.5" />
    </svg>
  );
}

function SuccessBadge() {
  return (
    <svg width="118" height="118" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M60 8L72.5 16.5L87.5 14.5L94 28.5L107 36L105.5 51.5L115 63L105.5 74.5L107 90L94 97.5L87.5 111.5L72.5 109.5L60 118L47.5 109.5L32.5 111.5L26 97.5L13 90L14.5 74.5L5 63L14.5 51.5L13 36L26 28.5L32.5 14.5L47.5 16.5L60 8Z" fill="#DDF8E8" />
      <path d="M45 61L56 72L78 50" stroke="#1AA257" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M44 20L44 19" stroke="#A4E3BD" strokeWidth="8" strokeLinecap="round" />
      <path d="M75 15L75 14" stroke="#A4E3BD" strokeWidth="8" strokeLinecap="round" />
    </svg>
  );
}
