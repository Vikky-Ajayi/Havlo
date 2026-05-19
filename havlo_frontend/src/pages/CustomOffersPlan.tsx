import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CustomOfferActions,
  CustomOfferFlowShell,
  CustomOfferHouseArt,
  CustomOfferSpinner,
} from '../components/custom-offers/CustomOfferFlowUi';
import { api } from '../lib/api';
import {
  CUSTOM_OFFER_PLANS,
  CustomOfferDraft,
  CustomOfferPlanId,
  mergeCustomOfferProperty,
  readCustomOfferDraft,
  writeCustomOfferDraft,
} from '../lib/customOffers';
import { usePageMeta } from '../hooks/usePageMeta';

const VERIFY_BULLETS = [
  'Priority seller communication',
  'Professionally prepared proposal',
  'Secure homeowner presentation',
];

export function CustomOffersPlan() {
  usePageMeta({
    title: 'Choose Your Custom Offer Plan | Havlo',
    description: 'Select the CustomOffer plan that will professionally prepare and present your proposal to the seller.',
  });

  const navigate = useNavigate();
  const [draft, setDraft] = useState<CustomOfferDraft | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<CustomOfferPlanId>('standout');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const stored = readCustomOfferDraft();
    if (!stored || !stored.listingUrl) {
      navigate('/custom-offers', { replace: true });
      return;
    }
    setDraft(stored);
    setSelectedPlan(stored.selectedPlan || 'standout');
  }, [navigate]);

  useEffect(() => {
    if (!draft) return;
    const nextDraft = { ...draft, selectedPlan };
    setDraft(nextDraft);
    writeCustomOfferDraft(nextDraft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlan]);

  const mergedProperty = useMemo(
    () => (draft ? mergeCustomOfferProperty(draft.property, draft.propertyOverrides) : null),
    [draft],
  );

  const handleCheckout = async () => {
    if (!draft || !mergedProperty) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.customOffersSubmit({
        listing_url: draft.listingUrl,
        property_snapshot: draft.property,
        property_overrides: draft.propertyOverrides,
        proposal_data: draft.answers,
        plan_id: selectedPlan,
        redirect_url: `${window.location.origin}/custom-offers/complete`,
      });
      const checkoutUrl = response.checkout_url?.trim();
      if (!checkoutUrl) {
        throw new Error('Unable to create a secure SumUp checkout right now. Please try again in a moment.');
      }
      window.location.href = checkoutUrl;
      return;
    } catch (submitError) {
      setLoading(false);
      setError(submitError instanceof Error ? submitError.message : 'Unable to start payment right now.');
    }
  };

  if (!draft || !mergedProperty) return null;

  return (
    <CustomOfferFlowShell
      eyebrow="FINAL STEP"
      title="Choose Your Submission Plan"
      subtitle="Select the plan that best fits how you want your proposal prepared and professionally presented to the homeowner."
      contentWidth={1160}
    >
      <style>{`
        .co-plan-summary {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          padding: 18px 20px;
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 16px;
          background: #FFFFFF;
          margin-bottom: 28px;
        }
        .co-plan-summary h2 {
          margin: 0 0 6px;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 21px;
          font-weight: 800;
          letter-spacing: -0.04em;
          line-height: 1.1;
        }
        .co-plan-summary p {
          margin: 0;
          color: #444444;
          font-size: 14px;
          line-height: 1.45;
        }
        .co-plan-summary-tag {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .co-plan-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          border-radius: 999px;
          background: #F5F5F5;
          color: #111111;
          font-size: 13px;
          font-weight: 600;
        }
        .co-plan-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
        }
        .co-plan-card {
          position: relative;
          background: #FFFFFF;
          border-radius: 22px;
          padding: 22px 20px 18px;
          display: flex;
          flex-direction: column;
          gap: 18px;
          cursor: pointer;
          min-height: 100%;
        }
        .co-plan-badge {
          position: absolute;
          top: 12px;
          right: 16px;
          padding: 5px 9px;
          border-radius: 999px;
          background: #FF5C67;
          color: #FFFFFF;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: -0.01em;
        }
        .co-plan-title {
          margin: 0;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.05em;
          line-height: 1;
        }
        .co-plan-tagline {
          margin-top: 14px;
          color: #2B2B2B;
          font-size: 14px;
          line-height: 1.45;
          min-height: 40px;
        }
        .co-plan-intro {
          color: #2B2B2B;
          font-size: 13px;
          line-height: 1.45;
          font-weight: 600;
        }
        .co-plan-list {
          display: grid;
          gap: 9px;
          margin: 0;
          padding: 0;
          list-style: none;
        }
        .co-plan-list li {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          color: #1B1B1B;
          font-size: 14px;
          line-height: 1.4;
        }
        .co-plan-price {
          margin-top: auto;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 30px;
          font-weight: 800;
          letter-spacing: -0.05em;
          line-height: 1;
          text-align: center;
        }
        @media (max-width: 1024px) {
          .co-plan-grid {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 768px) {
          .co-plan-summary {
            flex-direction: column;
            gap: 14px;
            margin-bottom: 22px;
          }
          .co-plan-summary-tag {
            justify-content: flex-start;
          }
          .co-plan-card {
            border-radius: 18px;
          }
          .co-plan-title {
            font-size: 26px;
          }
        }
      `}</style>

      <div className="co-plan-summary">
        <div>
          <h2>{mergedProperty.address || mergedProperty.title || 'Your chosen property'}</h2>
          <p>{draft.listingUrl}</p>
        </div>
        <div className="co-plan-summary-tag">
          {mergedProperty.price ? <span className="co-plan-pill">{mergedProperty.price}</span> : null}
          {mergedProperty.platform ? <span className="co-plan-pill">{mergedProperty.platform}</span> : null}
          {VERIFY_BULLETS.map((item) => (
            <span key={item} className="co-plan-pill">{item}</span>
          ))}
        </div>
      </div>

      <div className="co-plan-grid">
        {CUSTOM_OFFER_PLANS.map((plan) => {
          const isSelected = selectedPlan === plan.id;
          return (
            <article
              key={plan.id}
              className="co-plan-card"
              onClick={() => setSelectedPlan(plan.id)}
              style={{
                border: `3px solid ${isSelected ? '#A409D2' : plan.borderColor}`,
                boxShadow: isSelected ? '0 0 0 1px rgba(164, 9, 210, 0.08)' : 'none',
              }}
            >
              {plan.badge ? <div className="co-plan-badge">{plan.badge}</div> : null}

              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
                <CustomOfferHouseArt illustration={plan.illustration} />
              </div>

              <div>
                <h3 className="co-plan-title">{plan.name}</h3>
                <div className="co-plan-tagline">{plan.tagline}</div>
              </div>

              {plan.intro ? <div className="co-plan-intro">{plan.intro}</div> : null}

              <ul className="co-plan-list">
                {plan.items.map((item) => (
                  <li key={item}>
                    <span style={{ color: '#16A34A', lineHeight: 1 }}>✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="co-plan-price">{plan.price}</div>
            </article>
          );
        })}
      </div>

      {error ? <div className="cof-error">{error}</div> : null}

      <CustomOfferActions
        onBack={() => navigate('/custom-offers/proposal')}
        onContinue={handleCheckout}
        continueLabel={loading ? 'Preparing payment...' : 'Continue to payment'}
        continueDisabled={loading}
      />

      {loading ? (
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', color: '#111111', fontSize: 14, fontWeight: 600 }}>
          <CustomOfferSpinner label="Creating your secure checkout" />
        </div>
      ) : null}
    </CustomOfferFlowShell>
  );
}
