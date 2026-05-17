import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CustomOfferFlowShell } from '../components/custom-offers/CustomOfferFlowUi';
import {
  CustomOfferStatusResponse,
  customOfferStatusLabel,
  mergeCustomOfferProperty,
  prettyPlatform,
} from '../lib/customOffers';
import { api } from '../lib/api';
import { usePageMeta } from '../hooks/usePageMeta';

export function CustomOffersStatus() {
  usePageMeta({
    title: 'CustomOffer Status | Havlo',
    description: 'Track the status of your CustomOffer proposal and review the details you submitted.',
  });

  const { reference = '' } = useParams<{ reference: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<CustomOfferStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!reference) {
      setError('No proposal reference was provided.');
      setLoading(false);
      return;
    }
    api.customOffersStatus(reference)
      .then((result) => {
        setData(result);
        setLoading(false);
      })
      .catch((statusError) => {
        setError(statusError instanceof Error ? statusError.message : 'Unable to load this proposal.');
        setLoading(false);
      });
  }, [reference]);

  const mergedProperty = useMemo(
    () => (data ? mergeCustomOfferProperty(data.property, data.property_overrides) : null),
    [data],
  );

  return (
    <CustomOfferFlowShell background="#F5F6F7" contentWidth={1160}>
      <style>{`
        .co-status-grid {
          display: grid;
          grid-template-columns: minmax(320px, 360px) minmax(0, 1fr);
          gap: 20px;
        }
        .co-status-card {
          background: #FFFFFF;
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 18px;
          overflow: hidden;
        }
        .co-status-hero {
          display: grid;
          grid-template-columns: minmax(240px, 320px) minmax(0, 1fr);
          gap: 20px;
          padding: 20px;
          margin-bottom: 20px;
          background: #FFFFFF;
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 18px;
        }
        .co-status-image {
          width: 100%;
          aspect-ratio: 4 / 3;
          object-fit: cover;
          display: block;
          border-radius: 14px;
          background: #EDEFF1;
        }
        .co-status-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          color: #555555;
          font-size: 13px;
          font-weight: 600;
        }
        .co-status-heading {
          margin: 0 0 10px;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 31px;
          font-weight: 800;
          line-height: 1.08;
          letter-spacing: -0.05em;
        }
        .co-status-copy {
          margin: 0;
          color: #333333;
          font-size: 15px;
          line-height: 1.52;
        }
        .co-status-pill-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 14px;
        }
        .co-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          border-radius: 999px;
          background: #F4F4F4;
          color: #111111;
          font-size: 13px;
          font-weight: 700;
        }
        .co-status-section {
          padding: 18px 20px;
          border-top: 1px solid rgba(0, 0, 0, 0.06);
        }
        .co-status-section:first-child {
          border-top: 0;
        }
        .co-status-section h2 {
          margin: 0 0 12px;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 21px;
          font-weight: 800;
          line-height: 1.12;
          letter-spacing: -0.04em;
        }
        .co-status-step {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          color: #111111;
          font-size: 15px;
          line-height: 1.48;
          margin-bottom: 10px;
        }
        .co-status-note {
          background: #FAFAFA;
          border-radius: 14px;
          padding: 16px 18px;
          color: #3A3A3A;
          font-size: 14px;
          line-height: 1.55;
        }
        .co-status-data-grid {
          display: grid;
          gap: 12px;
        }
        .co-status-data-grid strong {
          display: block;
          margin-bottom: 4px;
          color: #111111;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: -0.02em;
        }
        .co-status-data-grid span,
        .co-status-data-grid p {
          margin: 0;
          color: #333333;
          font-size: 14px;
          line-height: 1.5;
        }
        .co-status-answers {
          display: grid;
          gap: 16px;
        }
        .co-status-answer-card {
          padding: 16px 18px;
          border-radius: 14px;
          background: #FAFAFA;
        }
        .co-status-answer-card strong {
          display: block;
          margin-bottom: 6px;
          color: #111111;
          font-size: 14px;
          font-weight: 700;
        }
        .co-status-answer-card p {
          margin: 0;
          color: #333333;
          font-size: 14px;
          line-height: 1.52;
        }
        @media (max-width: 900px) {
          .co-status-grid {
            grid-template-columns: 1fr;
          }
          .co-status-hero {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {loading ? (
        <div style={{ minHeight: 420, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(0, 0, 0, 0.10)', borderTopColor: '#111111', animation: 'co-status-spin 0.8s linear infinite', margin: '0 auto 14px' }} />
            <p style={{ margin: 0, color: '#555555', fontSize: 15 }}>Loading your proposal status...</p>
            <style>{`@keyframes co-status-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        </div>
      ) : null}

      {!loading && error ? (
        <div style={{ minHeight: 420, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', maxWidth: 420 }}>
            <h1 style={{ margin: '0 0 10px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 28, fontWeight: 800 }}>Proposal not found</h1>
            <p style={{ margin: '0 0 18px', color: '#555555', fontSize: 15, lineHeight: 1.48 }}>{error}</p>
            <button
              type="button"
              onClick={() => navigate('/custom-offers')}
              style={{ height: 44, borderRadius: 6, border: 0, background: '#000000', color: '#FFFFFF', padding: '0 24px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
            >
              Back to CustomOffer
            </button>
          </div>
        </div>
      ) : null}

      {!loading && data && mergedProperty ? (
        <>
          <section className="co-status-hero">
            <div>
              {mergedProperty.image ? (
                <img className="co-status-image" src={mergedProperty.image} alt={mergedProperty.address || mergedProperty.title || 'Property'} />
              ) : (
                <div className="co-status-image" />
              )}
            </div>
            <div>
              <div className="co-status-kicker">Dashboard</div>
              <h1 className="co-status-heading">Offer proposal made in regard to {mergedProperty.address || mergedProperty.title || 'the selected property'}</h1>
              <p className="co-status-copy">
                Your proposal has been securely delivered for homeowner review. The seller will now have the opportunity to privately review your interest, proposed terms, and buyer position. If they are interested in exploring your proposal further, they may contact you directly or continue through their estate agent or solicitor.
              </p>
              <div className="co-status-pill-row">
                <span className="co-status-pill">Submitted via {prettyPlatform(data.listing_platform)} listing</span>
                <span className="co-status-pill">{customOfferStatusLabel(data.proposal_status)}</span>
                <span className="co-status-pill">{data.plan_name}</span>
              </div>
            </div>
          </section>

          <div className="co-status-grid">
            <div className="co-status-card">
              <div className="co-status-section">
                <h2>Proposal Status</h2>
                <div className="co-status-step"><StatusCheck /> <span>Submitted</span></div>
                <div className="co-status-step"><StatusCheck /> <span>Seller Outreach Initiated</span></div>
                <div className="co-status-step"><StatusCheck /> <span>{customOfferStatusLabel(data.proposal_status)}</span></div>
              </div>
              <div className="co-status-section">
                <h2>Please note</h2>
                <div className="co-status-note">
                  Some homeowners may take 7–21 days to review and consider proposals. Some sellers may temporarily overlook your proposal but revisit it later if existing offers fall through, interest slows down, or market conditions change. Seller responses are not guaranteed. Submission fees are non-refundable. You will be notified if the homeowner chooses to engage.
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 20 }}>
              <div className="co-status-card">
                <div className="co-status-section">
                  <h2>Your Proposal</h2>
                  <div className="co-status-data-grid">
                    <div>
                      <strong>Property</strong>
                      <span>{mergedProperty.address || mergedProperty.title || 'Selected property'}</span>
                    </div>
                    <div>
                      <strong>Buyer Status</strong>
                      <span>{data.answers.buyer_status || 'Not provided'}</span>
                    </div>
                    <div>
                      <strong>Proposal Type</strong>
                      <span>{data.answers.proposal_type || 'Not provided'}</span>
                    </div>
                    <div>
                      <strong>Presentation</strong>
                      <span>{data.plan_name}</span>
                    </div>
                    <div>
                      <strong>Submitted</strong>
                      <span>{new Date(data.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="co-status-card">
                <div className="co-status-section">
                  <h2>Questions &amp; Responses</h2>
                  <div className="co-status-answers">
                    <div className="co-status-answer-card">
                      <strong>What interests you most about this property?</strong>
                      <p>{data.answers.property_interest || 'Not provided'}</p>
                    </div>
                    <div className="co-status-answer-card">
                      <strong>Why should the seller consider your proposal?</strong>
                      <p>{data.answers.seller_consideration || 'Not provided'}</p>
                    </div>
                    <div className="co-status-answer-card">
                      <strong>What would you like the homeowner to understand most?</strong>
                      <p>{data.answers.presentation_primary || 'Not provided'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </CustomOfferFlowShell>
  );
}

function StatusCheck() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#16A34A" />
      <path d="M7.5 12.5L10.7 15.7L16.5 9.9" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
