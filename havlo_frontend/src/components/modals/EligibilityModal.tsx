import React, { useMemo, useState } from 'react';
import { ChevronDown, MessageCircle, Phone, X } from 'lucide-react';
import { api } from '../../lib/api';

type EligibilityStep = 'eligibility' | 'timeline' | 'details' | 'fit' | 'not-fit';

const WHATSAPP_NUMBER = '2349039861006';
const CALL_DISPLAY = '0903 986 1006';
const CALL_LINK = '+2349039861006';

const propertyOptions = ['Residential', 'Commercial', 'Investment', 'Not sure yet'];
const budgetOptions = ['Under £50,000', '£50,000 - £200,000', '£200,000 - £500,000', '£500,000+'];
const timelineOptions = ['Immediately', '1-3 months', '3-6 months', '6+ months', 'Just exploring'];

const EliSelectField = ({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) => (
  <label className="buk-field">
    <span>{label}</span>
    <div className="buk-select-wrap">
      <select value={value} onChange={(e) => onChange(e.target.value)} required>
        <option value="">Select</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={18} />
    </div>
  </label>
);

const EliTextField = ({
  label, value, onChange, placeholder, type = 'text',
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string;
}) => (
  <label className="buk-field">
    <span>{label}</span>
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required />
  </label>
);

interface EligibilityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EligibilityModal: React.FC<EligibilityModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState<EligibilityStep>('eligibility');
  const [propertyType, setPropertyType] = useState('');
  const [budget, setBudget] = useState('');
  const [timeline, setTimeline] = useState('');
  const [fullName, setFullName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const firstName = useMemo(() => fullName.trim().split(/\s+/)[0] || 'Buyer', [fullName]);
  const lastName = useMemo(() => fullName.trim().split(/\s+/).slice(1).join(' ') || 'Lead', [fullName]);

  const handleClose = () => {
    setStep('eligibility');
    setPropertyType('');
    setBudget('');
    setTimeline('');
    setFullName('');
    setWhatsapp('');
    setEmail('');
    setError('');
    onClose();
  };

  const openWhatsApp = () => {
    const text = encodeURIComponent(
      `Hi Havlo, I completed the UK property eligibility form. My name is ${fullName || 'a prospective buyer'}.`
    );
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  const submitLead = async () => {
    setSubmitting(true);
    setError('');
    const outcome = budget === 'Under £50,000' ? 'Not currently eligible' : 'Great fit';
    const nextStep: EligibilityStep = budget === 'Under £50,000' ? 'not-fit' : 'fit';
    try {
      await api.submitContactForm({
        first_name: firstName,
        last_name: lastName,
        email,
        phone_country_code: '+234',
        phone_number: whatsapp,
        country_of_residence: 'Nigeria',
        source: 'buyabroad-uk',
        message: [
          'Buy Abroad UK eligibility lead',
          `Outcome: ${outcome}`,
          `Looking to buy: ${propertyType}`,
          `Approximate budget: ${budget}`,
          `Timeline: ${timeline}`,
          `WhatsApp: ${whatsapp}`,
          `Source: /buyabroad/uk/listings`,
        ].join('\n'),
      });
    } catch (err) {
      console.warn('Buy Abroad lead logging failed', err);
    } finally {
      setStep(nextStep);
      setSubmitting(false);
    }
  };

  const renderForm = () => {
    if (step === 'fit' || step === 'not-fit') {
      const isFit = step === 'fit';
      return (
        <div className="buk-result">
          <div className="buk-result-emoji">{isFit ? '🎉' : '🙏'}</div>
          <h3>{isFit ? "You're a great fit." : "We're not the right fit right now."}</h3>
          <p>
            {isFit
              ? 'Your budget and timeline match exactly what we work with. Reach out now via WhatsApp or give us a call — your consultation is free.'
              : "Our advisory service is tailored for buyers with a budget of £50,000 or more. At this stage, we wouldn't be able to add the value you deserve. We wish you all the best — and if your budget changes, we'd love to hear from you."}
          </p>
          <button className="buk-whatsapp" type="button" onClick={openWhatsApp}>
            <MessageCircle size={18} /> Chat on WhatsApp
          </button>
          <a className="buk-call" href={`tel:${CALL_LINK}`}>
            <Phone size={18} /> Call {CALL_DISPLAY}
          </a>
          <button className="buk-learn" type="button" onClick={handleClose}>
            ← Back to listings
          </button>
          <p className="buk-secure">🔒 Your details are confidential. No spam, ever.</p>
        </div>
      );
    }

    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (step === 'eligibility') setStep('timeline');
          else if (step === 'timeline') setStep('details');
          else if (step === 'details') void submitLead();
        }}
      >
        <div className="buk-card-head">
          <h2>
            {step === 'timeline'
              ? 'When Are You Looking to Proceed?'
              : step === 'details'
              ? 'Almost There'
              : 'Check Your Eligibility'}
          </h2>
          <p>
            {step === 'timeline'
              ? 'Be honest — this helps us give you the right advice'
              : step === 'details'
              ? "Enter your details and we'll be in touch on WhatsApp"
              : 'Answer 3 quick questions, takes 30 seconds'}
          </p>
        </div>
        <div className="buk-divider" />

        {step === 'eligibility' && (
          <>
            <EliSelectField label="What are you looking to buy?" value={propertyType} onChange={setPropertyType} options={propertyOptions} />
            <EliSelectField label="What is your approximate budget?" value={budget} onChange={setBudget} options={budgetOptions} />
          </>
        )}
        {step === 'timeline' && (
          <EliSelectField label="Select your timeline" value={timeline} onChange={setTimeline} options={timelineOptions} />
        )}
        {step === 'details' && (
          <>
            <EliTextField label="Your full name" value={fullName} onChange={setFullName} placeholder="e.g. Amara Johnson" />
            <label className="buk-field">
              <span>WhatsApp number</span>
              <div className="buk-phone-wrap">
                <span aria-hidden="true">🇳🇬</span>
                <input
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="000 000 000 00"
                  required
                />
              </div>
            </label>
            <EliTextField label="Email address" value={email} onChange={setEmail} placeholder="e.g johndoe@email.com" type="email" />
          </>
        )}

        {error && <p className="buk-error">{error}</p>}

        <div className="buk-form-spacer" />
        <button className="buk-primary" type="submit" disabled={submitting}>
          {submitting ? 'Submitting...' : step === 'eligibility' ? 'Get Free Consultation →' : 'Continue →'}
        </button>
        {step !== 'eligibility' && (
          <button className="buk-back" type="button" onClick={() => setStep(step === 'details' ? 'timeline' : 'eligibility')}>
            ← Back
          </button>
        )}
        {step === 'eligibility' && <p className="buk-secure">🔒 Your details are confidential. No spam, ever.</p>}
      </form>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="buk-modal" role="dialog" aria-modal="true" aria-label="Buy Abroad consultation form">
      <div className="buk-modal-backdrop" onClick={handleClose} />
      <div className="buk-modal-card buk-form-card">
        <button className="buk-modal-close" type="button" onClick={handleClose} aria-label="Close consultation form">
          <X size={24} />
        </button>
        {renderForm()}
      </div>
      <style>{`
        .buk-modal { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 24px; }
        .buk-modal-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,.48); }
        .buk-modal-card { position: relative; width: min(541px, calc(100vw - 28px)); max-height: calc(100dvh - 32px); overflow-y: auto; scrollbar-gutter: stable; }
        .buk-modal-close { position: absolute; top: 14px; right: 14px; width: 36px; height: 36px; border: 0; border-radius: 999px; background: #f3f4f6; color: #111; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; z-index: 1; }
        .buk-form-card { background: #fff; border: 3px solid #050505; border-radius: 16px; padding: 32px; min-height: 560px; box-shadow: 6px 6px 0 #000; }
        .buk-card-head h2 { font-family: Inter, sans-serif; font-size: 27px; line-height: 1.15; font-weight: 800; margin: 0 0 10px; }
        .buk-card-head p { font-size: 20px; line-height: 1.25; margin: 0; }
        .buk-divider { border-top: 3px solid #111; margin: 18px 0 36px; }
        .buk-field { display: block; margin-bottom: 24px; }
        .buk-field span { display: block; margin-bottom: 10px; font-size: 12px; font-weight: 800; }
        .buk-field input, .buk-field select { width: 100%; height: 48px; border: 0; border-radius: 12px; background: #f3f4f6; padding: 0 16px; color: #333; font-size: 15px; appearance: none; box-sizing: border-box; }
        .buk-phone-wrap { display: grid; grid-template-columns: 50px 1fr; align-items: center; height: 48px; border-radius: 12px; background: #f3f4f6; overflow: hidden; }
        .buk-phone-wrap > span { height: 48px; display: inline-flex; align-items: center; justify-content: center; border-right: 3px solid #fff; font-size: 17px; }
        .buk-phone-wrap input { border-radius: 0; background: transparent; border: 0; padding: 0 14px; font-size: 15px; outline: none; }
        .buk-select-wrap { display: grid; grid-template-columns: 1fr 48px; align-items: center; background: #f0f0f2; border-radius: 12px; overflow: hidden; }
        .buk-select-wrap select { border-radius: 0; background: transparent; border: 0; }
        .buk-select-wrap svg { justify-self: center; border-left: 3px solid #fff; width: 48px; height: 48px; padding: 15px; }
        .buk-form-spacer { height: 92px; }
        .buk-primary, .buk-whatsapp, .buk-call { width: 100%; height: 48px; border: 0; border-radius: 12px; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 900; text-decoration: none; cursor: pointer; font-size: 15px; }
        .buk-primary, .buk-call { background: #050505; color: #fff; }
        .buk-whatsapp { background: #09cf5a; color: #fff; margin-top: 26px; }
        .buk-call { margin-top: 14px; }
        .buk-back { display: block; margin: 20px auto 0; border: 0; background: none; font-weight: 900; cursor: pointer; }
        .buk-secure { color: #777; text-align: center; margin: 16px 0 0; font-size: 14px; }
        .buk-error { color: #e53e3e; font-size: 13px; margin-bottom: 8px; }
        .buk-result { display: flex; flex-direction: column; align-items: flex-start; padding-top: 16px; }
        .buk-result-emoji { font-size: 42px; margin-bottom: 12px; }
        .buk-result h3 { font-family: "Plus Jakarta Sans", Inter, sans-serif; font-size: 22px; font-weight: 800; margin: 0 0 12px; }
        .buk-result p { font-size: 15px; line-height: 1.55; color: #555; margin: 0 0 6px; }
        .buk-learn { background: none; border: 0; font-size: 13px; font-weight: 700; color: #555; cursor: pointer; margin-top: 16px; padding: 0; }
        .buk-learn:hover { color: #111; }
      `}</style>
    </div>
  );
};
