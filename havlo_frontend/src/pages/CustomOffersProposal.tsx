import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CustomOfferActions,
  CustomOfferChoiceCard,
  CustomOfferChip,
  CustomOfferFlowShell,
} from '../components/custom-offers/CustomOfferFlowUi';
import {
  CustomOfferDraft,
  CustomOfferStepAnswers,
  defaultCustomOfferDraft,
  mergeCustomOfferProperty,
  readCustomOfferDraft,
  writeCustomOfferDraft,
} from '../lib/customOffers';
import { usePageMeta } from '../hooks/usePageMeta';

const PROPOSAL_TYPE_OPTIONS = [
  {
    title: 'Standard Offer',
    description: 'A traditional property purchase proposal based primarily on price.',
  },
  {
    title: 'Flexible Completion',
    description: 'You are willing to adapt completion or moving timelines to suit the seller’s needs.',
  },
  {
    title: 'Chain-Free Purchase',
    description: 'You are not dependent on selling another property, helping reduce delays and transaction risk.',
  },
  {
    title: 'Cash Purchase',
    description: 'You intend to purchase without mortgage financing, often allowing for a faster and more certain transaction.',
  },
  {
    title: 'Delayed Completion',
    description: 'You are proposing a later completion date to provide additional flexibility for the seller.',
  },
  {
    title: 'Flexible Terms Proposal',
    description: 'A proposal that includes seller-friendly arrangements such as flexible timelines, reduced pressure, or tailored moving arrangements.',
  },
  {
    title: 'Rent-to-Buy Proposal',
    description: 'You would like to rent the property initially with the intention or option to purchase later.',
  },
  {
    title: 'Alternative Purchase Arrangement',
    description: 'A non-standard proposal involving flexible or creative purchase terms tailored to the seller’s situation.',
  },
  {
    title: 'Other',
    description: 'Any other proposal type not listed above.',
  },
];

const FLEXIBLE_TERMS = [
  'Flexible moving date',
  'Fast completion',
  'Delayed completion',
  'Rent-back period',
  'Reduced chain risk',
  'Other',
];

const BUYER_STATUS_OPTIONS = [
  'No, price unchanged since launch',
  'Chain-Free Buyer',
  'Cash Buyer',
  'Mortgage Buyer',
  'Investor',
  'Relocating Buyer',
  'Other',
];

const TIMING_OPTIONS = [
  'Immediately',
  'Within 2–4 Weeks',
  'Within 1–3 Months',
  'Flexible Timing',
];

const VIEWED_OPTIONS = ['YES', 'NO'];

const PRESENTATION_OPTIONS = [
  {
    title: 'Standard Offer',
    description: 'Structured, precise, business-like tone',
  },
  {
    title: 'Friendly & Personal',
    description: 'Warm, approachable, human connection',
  },
  {
    title: 'Direct & Concise',
    description: 'Clear, punchy, no fluff',
  },
  {
    title: 'Flexible & Collaborative',
    description: 'Open, adaptable, partnership-focused',
  },
];

const STEP_META = [
  {
    eyebrow: 'STEP 1 OF 6',
    title: 'Property Interest',
    subtitle: 'Tell us about the property you want to make a proposal on.',
  },
  {
    eyebrow: 'STEP 2 OF 6',
    title: 'Property Interest',
    subtitle: 'Tell us about the property you want to make a proposal on.',
  },
  {
    eyebrow: 'STEP 3 OF 6',
    title: 'Buyer Position',
    subtitle: 'Help the seller understand where you stand as a buyer.',
  },
  {
    eyebrow: 'STEP 4 OF 6',
    title: 'Proposal Presentation',
    subtitle: (
      <>
        <span className="co-proposal-subtitle-desktop">Help the seller understand where you stand as a buyer.</span>
        <span className="co-proposal-subtitle-mobile">Help us position your proposal in the most compelling way for the seller.</span>
      </>
    ),
  },
  {
    eyebrow: 'STEP 5 OF 6',
    title: 'Contact Information',
    subtitle: 'Your details are kept secure and only shared if both parties choose to engage.',
  },
  {
    eyebrow: 'STEP 6 OF 6',
    title: 'Confirmation',
    subtitle: 'Please confirm the following before submitting your proposal.',
  },
];

function updateAnswers(
  draft: CustomOfferDraft,
  updates: Partial<CustomOfferStepAnswers>,
): CustomOfferDraft {
  return {
    ...draft,
    answers: {
      ...draft.answers,
      ...updates,
    },
  };
}

export function CustomOffersProposal() {
  usePageMeta({
    title: 'CustomOffer Proposal | Havlo',
    description: 'Build your custom property proposal and present your terms professionally to the seller.',
  });

  const navigate = useNavigate();
  const [draft, setDraft] = useState<CustomOfferDraft>(defaultCustomOfferDraft());
  const [ready, setReady] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [stepError, setStepError] = useState('');

  useEffect(() => {
    const stored = readCustomOfferDraft();
    if (!stored || !stored.listingUrl) {
      navigate('/custom-offers', { replace: true });
      return;
    }
    setDraft(stored);
    setReady(true);
  }, [navigate]);

  useEffect(() => {
    if (!ready) return;
    writeCustomOfferDraft(draft);
  }, [draft, ready]);

  const mergedProperty = useMemo(
    () => mergeCustomOfferProperty(draft.property, draft.propertyOverrides),
    [draft.property, draft.propertyOverrides],
  );

  const setAnswer = (updates: Partial<CustomOfferStepAnswers>) => {
    setDraft((current) => updateAnswers(current, updates));
    setStepError('');
  };

  const toggleFlexibleTerm = (term: string) => {
    setDraft((current) => {
      const exists = current.answers.flexible_terms.includes(term);
      return updateAnswers(current, {
        flexible_terms: exists
          ? current.answers.flexible_terms.filter((item) => item !== term)
          : [...current.answers.flexible_terms, term],
      });
    });
    setStepError('');
  };

  const validateStep = () => {
    const answers = draft.answers;
    if (activeStep === 0) {
      if (draft.propertyNeedsReview && !mergedProperty.address.trim()) {
        setStepError('Please confirm the property address before continuing.');
        return false;
      }
      if (!answers.property_interest.trim()) {
        setStepError('Tell us what interests you most about this property.');
        return false;
      }
    }
    if (activeStep === 1) {
      if (!answers.proposal_type) {
        setStepError('Select the type of proposal you would like to submit.');
        return false;
      }
      if (!answers.proposed_offer.trim()) {
        setStepError('Describe your proposed offer or arrangement.');
        return false;
      }
      if (!answers.seller_consideration.trim()) {
        setStepError('Explain why the seller should consider your proposal.');
        return false;
      }
    }
    if (activeStep === 2) {
      if (!answers.buyer_status || !answers.proceed_timing || !answers.viewed_state) {
        setStepError('Answer all buyer position questions before continuing.');
        return false;
      }
    }
    if (activeStep === 3) {
      if (!answers.presentation_primary.trim() || !answers.presentation_risk.trim() || !answers.presentation_style) {
        setStepError('Complete every proposal presentation field before continuing.');
        return false;
      }
    }
    if (activeStep === 4) {
      if (!answers.full_name.trim() || !answers.email.trim() || !answers.phone.trim()) {
        setStepError('Enter your full name, email address, and phone number.');
        return false;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers.email)) {
        setStepError('Enter a valid email address.');
        return false;
      }
    }
    if (activeStep === 5) {
      if (!answers.confirm_responses_not_guaranteed || !answers.confirm_non_refundable || !answers.confirm_information_accurate) {
        setStepError('Confirm all three statements before continuing.');
        return false;
      }
    }
    return true;
  };

  const handleContinue = () => {
    if (!validateStep()) return;
    if (activeStep === STEP_META.length - 1) {
      navigate('/custom-offers/plan');
      return;
    }
    setActiveStep((step) => step + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    setStepError('');
    if (activeStep === 0) {
      navigate('/custom-offers');
      return;
    }
    setActiveStep((step) => step - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!ready) return null;

  return (
    <CustomOfferFlowShell
      eyebrow={STEP_META[activeStep].eyebrow}
      title={STEP_META[activeStep].title}
      subtitle={STEP_META[activeStep].subtitle}
      contentWidth={820}
    >
      <style>{`
        .co-proposal-subtitle-mobile { display: none; }
        .co-property-review-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 26px;
        }
        .co-property-review-grid .cof-textarea {
          grid-column: 1 / -1;
        }
        .co-chip-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }
        .co-confirm-grid {
          display: grid;
          gap: 10px;
        }
        @media (max-width: 768px) {
          .co-proposal-subtitle-desktop { display: none; }
          .co-proposal-subtitle-mobile { display: inline; }
          .co-property-review-grid {
            grid-template-columns: 1fr;
            gap: 10px;
            margin-bottom: 20px;
          }
          .co-chip-grid {
            gap: 10px;
          }
        }
      `}</style>

      {draft.propertyNeedsReview ? (
        <section className="cof-section">
          <label className="cof-field-label">Confirm the property details we found</label>
          <p className="cof-field-help">We scraped the listing link, but a few details need your confirmation before we present the proposal professionally.</p>
          <div className="co-property-review-grid">
            <input
              className="cof-input"
              placeholder="Property title"
              value={draft.propertyOverrides.title ?? mergedProperty.title}
              onChange={(event) => setDraft((current) => ({
                ...current,
                propertyOverrides: { ...current.propertyOverrides, title: event.target.value },
              }))}
            />
            <input
              className="cof-input"
              placeholder="Property address"
              value={draft.propertyOverrides.address ?? mergedProperty.address}
              onChange={(event) => setDraft((current) => ({
                ...current,
                propertyOverrides: { ...current.propertyOverrides, address: event.target.value },
              }))}
            />
            <input
              className="cof-input"
              placeholder="Listed price"
              value={draft.propertyOverrides.price ?? mergedProperty.price}
              onChange={(event) => setDraft((current) => ({
                ...current,
                propertyOverrides: { ...current.propertyOverrides, price: event.target.value },
              }))}
            />
            <input
              className="cof-input"
              placeholder="Property type"
              value={draft.propertyOverrides.property_type ?? mergedProperty.property_type}
              onChange={(event) => setDraft((current) => ({
                ...current,
                propertyOverrides: { ...current.propertyOverrides, property_type: event.target.value },
              }))}
            />
            <textarea
              className="cof-textarea"
              placeholder="Add or correct the property description if needed"
              value={draft.propertyOverrides.description ?? mergedProperty.description}
              onChange={(event) => setDraft((current) => ({
                ...current,
                propertyOverrides: { ...current.propertyOverrides, description: event.target.value },
              }))}
            />
          </div>
        </section>
      ) : null}

      {activeStep === 0 ? (
        <section className="cof-section">
          <label className="cof-field-label">What interests you most about this property?</label>
          <textarea
            className="cof-textarea"
            placeholder="e.g The Size, Location, potential for extension, proximity to schools"
            value={draft.answers.property_interest}
            onChange={(event) => setAnswer({ property_interest: event.target.value })}
          />
        </section>
      ) : null}

      {activeStep === 1 ? (
        <>
          <section className="cof-section">
            <label className="cof-field-label">What type of proposal would you like to submit?</label>
            <div className="cof-options-grid">
              {PROPOSAL_TYPE_OPTIONS.map((option) => (
                <CustomOfferChoiceCard
                  key={option.title}
                  selected={draft.answers.proposal_type === option.title}
                  title={option.title}
                  description={option.description}
                  onClick={() => setAnswer({ proposal_type: option.title })}
                />
              ))}
            </div>
          </section>

          <section className="cof-section">
            <label className="cof-field-label">What is your proposed offer or arrangement?</label>
            <textarea
              className="cof-textarea"
              placeholder="Describe your offer amount or arrangement details"
              value={draft.answers.proposed_offer}
              onChange={(event) => setAnswer({ proposed_offer: event.target.value })}
            />
          </section>

          <section className="cof-section">
            <label className="cof-field-label">Why should the seller consider your proposal?</label>
            <textarea
              className="cof-textarea"
              placeholder="Explain the flexibility, certainty, timing, or advantages behind your proposal"
              value={draft.answers.seller_consideration}
              onChange={(event) => setAnswer({ seller_consideration: event.target.value })}
            />
          </section>

          <section className="cof-section">
            <label className="cof-field-label">Are there any flexible terms you can offer the seller?</label>
            <p className="cof-field-help">Select all that apply</p>
            <div className="co-chip-grid">
              {FLEXIBLE_TERMS.map((term) => (
                <CustomOfferChip
                  key={term}
                  active={draft.answers.flexible_terms.includes(term)}
                  label={term}
                  onClick={() => toggleFlexibleTerm(term)}
                />
              ))}
            </div>
          </section>
        </>
      ) : null}

      {activeStep === 2 ? (
        <>
          <section className="cof-section">
            <label className="cof-field-label">What is your current buying position?</label>
            <div className="cof-options-grid">
              {BUYER_STATUS_OPTIONS.map((option) => (
                <CustomOfferChoiceCard
                  key={option}
                  selected={draft.answers.buyer_status === option}
                  title={option}
                  onClick={() => setAnswer({ buyer_status: option })}
                />
              ))}
            </div>
          </section>

          <section className="cof-section">
            <label className="cof-field-label">How quickly could you realistically proceed if the seller is interested?</label>
            <div className="cof-options-grid">
              {TIMING_OPTIONS.map((option) => (
                <CustomOfferChoiceCard
                  key={option}
                  selected={draft.answers.proceed_timing === option}
                  title={option}
                  onClick={() => setAnswer({ proceed_timing: option })}
                />
              ))}
            </div>
          </section>

          <section className="cof-section">
            <label className="cof-field-label">Have you viewed the property already?</label>
            <div className="cof-options-grid">
              {VIEWED_OPTIONS.map((option) => (
                <CustomOfferChoiceCard
                  key={option}
                  selected={draft.answers.viewed_state === option}
                  title={option}
                  onClick={() => setAnswer({ viewed_state: option })}
                />
              ))}
            </div>
          </section>
        </>
      ) : null}

      {activeStep === 3 ? (
        <>
          <section className="cof-section">
            <label className="cof-field-label">What would you like the homeowner to understand most about your proposal?</label>
            <p className="cof-field-help"><em>This helps us professionally position your interest to the seller</em></p>
            <textarea
              className="cof-textarea"
              placeholder="e.g. That we are serious, flexible, and can make the process as smooth as possible for them..."
              value={draft.answers.presentation_primary}
              onChange={(event) => setAnswer({ presentation_primary: event.target.value })}
            />
          </section>

          <section className="cof-section">
            <label className="cof-field-label">Is there anything about your situation that makes your proposal lower-risk or more convenient for the seller?</label>
            <textarea
              className="cof-textarea"
              placeholder="e.g. No chain, mortgage agreed in principle, flexible on moving date..."
              value={draft.answers.presentation_risk}
              onChange={(event) => setAnswer({ presentation_risk: event.target.value })}
            />
          </section>

          <section className="cof-section">
            <label className="cof-field-label">Would you like your proposal presented as:</label>
            <div className="cof-options-grid">
              {PRESENTATION_OPTIONS.map((option) => (
                <CustomOfferChoiceCard
                  key={option.title}
                  selected={draft.answers.presentation_style === option.title}
                  title={option.title}
                  description={option.description}
                  onClick={() => setAnswer({ presentation_style: option.title })}
                />
              ))}
            </div>
          </section>
        </>
      ) : null}

      {activeStep === 4 ? (
        <section className="cof-section">
          <div style={{ display: 'grid', gap: 26 }}>
            <div>
              <label className="cof-field-label">Full Name</label>
              <input
                className="cof-input"
                placeholder="e.g James Thompson"
                value={draft.answers.full_name}
                onChange={(event) => setAnswer({ full_name: event.target.value })}
              />
            </div>
            <div>
              <label className="cof-field-label">Email Address</label>
              <input
                className="cof-input"
                placeholder="e.g James@gmail.com"
                value={draft.answers.email}
                onChange={(event) => setAnswer({ email: event.target.value })}
              />
            </div>
            <div>
              <label className="cof-field-label">Phone Number</label>
              <input
                className="cof-input"
                placeholder="e.g +44 4949 4292 9292"
                value={draft.answers.phone}
                onChange={(event) => setAnswer({ phone: event.target.value })}
              />
            </div>
          </div>
        </section>
      ) : null}

      {activeStep === 5 ? (
        <section className="cof-section">
          <label className="cof-field-label">Please confirm:</label>
          <div className="co-confirm-grid">
            <CustomOfferChoiceCard
              selected={draft.answers.confirm_responses_not_guaranteed}
              title="I understand seller responses are not guaranteed."
              type="checkbox"
              onClick={() => setAnswer({ confirm_responses_not_guaranteed: !draft.answers.confirm_responses_not_guaranteed })}
            />
            <CustomOfferChoiceCard
              selected={draft.answers.confirm_non_refundable}
              title="I understand submission fees are non-refundable."
              type="checkbox"
              onClick={() => setAnswer({ confirm_non_refundable: !draft.answers.confirm_non_refundable })}
            />
            <CustomOfferChoiceCard
              selected={draft.answers.confirm_information_accurate}
              title="I confirm the information provided is accurate to the best of my knowledge."
              type="checkbox"
              onClick={() => setAnswer({ confirm_information_accurate: !draft.answers.confirm_information_accurate })}
            />
          </div>
        </section>
      ) : null}

      {stepError ? <div className="cof-error">{stepError}</div> : null}

      <CustomOfferActions onContinue={handleContinue} onBack={handleBack} />
    </CustomOfferFlowShell>
  );
}
