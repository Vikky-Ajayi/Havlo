import React, { useMemo, useState } from 'react';
import { Building2, ChevronDown, MessageCircle, Phone, Users, X } from 'lucide-react';
import { api } from '../lib/api';
import { usePageMeta } from '../hooks/usePageMeta';

type EligibilityStep = 'eligibility' | 'timeline' | 'details' | 'fit' | 'not-fit';

const WHATSAPP_NUMBER = '2349039861006';
const CALL_DISPLAY = '0903 986 1006';
const CALL_LINK = '+2349039861006';

const propertyOptions = ['Residential', 'Commercial', 'Investment', 'Not sure yet'];
const budgetOptions = ['Under £100,000', '£100,000 - £250,000', '£250,000 - £500,000', '£500,000+'];
const timelineOptions = ['Immediately', '1-3 months', '3-6 months', '6+ months', 'Just exploring'];

const featureStrip = [
  { icon: <Building2 size={20} />, text: 'UK property advisory service' },
  { icon: <Users size={20} />, text: 'Vetted agents, solicitors & conveyancers' },
  { icon: <MessageCircle size={20} />, text: 'Free consultation - no obligation' },
  { icon: <Phone size={20} />, text: 'WhatsApp-first support' },
];

const propertyCards = [
  {
    title: 'Residential',
    image: '/buyabroad-uk/residential.png',
    body: 'Buy a family home for personal use, diaspora visits, or children studying in the UK, or enter the high-value buy-to-let market with a reliable rental income stream.',
    tags: ['Buy-to-Let', 'HMO', 'Family Home', 'Student Let'],
    tone: 'green',
  },
  {
    title: 'Commercial',
    image: '/buyabroad-uk/commercial.png',
    body: 'Office blocks, retail units, and mixed-use developments offer longer leases, stronger covenants, and often higher returns than residential, ideal for capital deployment at scale.',
    tags: ['Office', 'Retail', 'Industrial', 'Mixed-Use'],
    tone: 'blue',
  },
  {
    title: 'Investment',
    image: '/buyabroad-uk/investment.png',
    body: 'Off-plan developments, property portfolios, and high-yield blocks, structured to maximise your sterling returns and protect your wealth against naira volatility.',
    tags: ['Off-plan', 'Portfolio', 'Development', 'Serviced Apts'],
    tone: 'purple',
  },
];

const testimonials = [
  {
    quote: 'I was nervous about buying from Lagos. I thought I’d have to be in London every week. We completed without me ever stepping on a plane. Incredible service.',
    author: 'Chukwumeka A.',
    meta: 'Lagos Island, bought 2-bed Manchester flat',
  },
  {
    quote: 'I wanted to invest my dollars somewhere safe. They found me a Birmingham HMO yielding 8.4% annually. The whole process took under 90 days.',
    author: 'Adaobi N.',
    meta: 'Abuja, HMO investment property',
  },
  {
    quote: 'My daughter is studying in Leeds next year. We bought a flat she’ll live in and that I’ll rent out after she graduates. Best financial decision we’ve made.',
    author: 'Biodun O.',
    meta: 'Port Harcourt, Leeds student property',
  },
];

const faqs = [
  ['Can Nigerians legally buy property in the UK?', 'Yes, completely. There are no restrictions on foreign nationals purchasing UK property, residential or commercial. You do not need a visa, residency, or UK bank account to buy.'],
  ['Do I need to travel to the UK to purchase?', 'No. With the right legal setup, the entire process can be completed remotely. We coordinate viewings, solicitors, and signing on your behalf via video and secure digital systems.'],
  ['Can I get a mortgage as a non-UK resident?', 'Yes, though the process is different. Several UK lenders offer non-resident mortgages. We work with specialist brokers who handle overseas applications regularly, including Nigerian buyers.'],
  ['How do I transfer money from Nigeria to the UK?', 'We guide you through compliant international transfer options, including FX specialists who offer better rates than high-street banks and understand CBN regulations.'],
  ['What taxes will I pay as a Nigerian buyer?', 'Stamp Duty Land Tax applies, with an overseas buyer surcharge of 2% on top of standard rates. Rental income is taxable in the UK, but deductions apply. We connect you with a UK tax advisor.'],
  ['What is the minimum budget to get started?', 'Our advisory service is for buyers with a minimum budget of £100,000. Properties in strong Northern UK cities like Birmingham, Manchester, and Leeds start from around this level. London entry points are typically £350,000+.'],
];

const SelectField = ({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) => (
  <label className="buk-field">
    <span>{label}</span>
    <div className="buk-select-wrap">
      <select value={value} onChange={(event) => onChange(event.target.value)} required>
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      <ChevronDown size={18} />
    </div>
  </label>
);

const TextField = ({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) => (
  <label className="buk-field">
    <span>{label}</span>
    <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required />
  </label>
);

export const BuyAbroadUk: React.FC = () => {
  usePageMeta({
    title: 'Buy UK Property from Nigeria | Havlo Buy Abroad',
    description: 'A dedicated advisory service for Nigerian buyers purchasing residential, commercial, and investment property in the UK.',
    canonical: 'https://www.heyhavlo.com/buyabroad/uk',
  });

  const [step, setStep] = useState<EligibilityStep>('eligibility');
  const [propertyType, setPropertyType] = useState('');
  const [budget, setBudget] = useState('');
  const [timeline, setTimeline] = useState('');
  const [fullName, setFullName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isConsultationOpen, setIsConsultationOpen] = useState(false);

  const firstName = useMemo(() => fullName.trim().split(/\s+/)[0] || 'Buyer', [fullName]);
  const lastName = useMemo(() => fullName.trim().split(/\s+/).slice(1).join(' ') || 'Lead', [fullName]);

  const openConsultation = () => {
    setStep('eligibility');
    setError('');
    setIsConsultationOpen(true);
  };

  const closeConsultation = () => {
    setIsConsultationOpen(false);
  };

  const openWhatsApp = () => {
    const text = encodeURIComponent(`Hi Havlo, I completed the UK property eligibility form. My name is ${fullName || 'a prospective buyer'}.`);
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  const submitLead = async () => {
    setSubmitting(true);
    setError('');
    const outcome = budget === 'Under £100,000' ? 'Not currently eligible' : 'Great fit';
    const nextStep = budget === 'Under £100,000' ? 'not-fit' : 'fit';

    try {
      await api.submitContactForm({
        first_name: firstName,
        last_name: lastName,
        email,
        phone_country_code: '+234',
        phone_number: whatsapp,
        country_of_residence: 'Nigeria',
        message: [
          'Buy Abroad UK eligibility lead',
          `Outcome: ${outcome}`,
          `Looking to buy: ${propertyType}`,
          `Approximate budget: ${budget}`,
          `Timeline: ${timeline}`,
          `WhatsApp: ${whatsapp}`,
          `Source: /buyabroad/uk`,
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
              : "Our advisory service is tailored for buyers with a budget of £100,000 (≈ ₦190m) or more. At this stage, we wouldn't be able to add the value you deserve. We wish you all the best — and if your budget changes, we'd love to hear from you."}
          </p>
          <button className="buk-whatsapp" type="button" onClick={openWhatsApp}>
            <MessageCircle size={18} /> Chat on WhatsApp
          </button>
          <a className="buk-call" href={`tel:${CALL_LINK}`}>
            <Phone size={18} /> Call {CALL_DISPLAY}
          </a>
          <button className="buk-learn" type="button" onClick={() => { closeConsultation(); document.getElementById('process')?.scrollIntoView({ behavior: 'smooth' }); }}>
            ⓘ Learn how the process works
          </button>
          <p className="buk-secure">🔒 Your details are confidential. No spam, ever.</p>
        </div>
      );
    }

    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (step === 'eligibility') {
            setStep('timeline');
          } else if (step === 'timeline') {
            setStep('details');
          } else if (step === 'details') {
            void submitLead();
          }
        }}
      >
        <div className="buk-card-head">
          <h2>{step === 'timeline' ? 'When Are You Looking to Proceed?' : step === 'details' ? 'Almost There' : 'Check Your Eligibility'}</h2>
          <p>{step === 'timeline' ? 'Be honest — this helps us give you the right advice' : step === 'details' ? "Enter your details and we'll be in touch on WhatsApp" : 'Answer 3 quick questions, takes 30 seconds'}</p>
        </div>
        <div className="buk-divider" />

        {step === 'eligibility' && (
          <>
            <SelectField label="What are you looking to buy?" value={propertyType} onChange={setPropertyType} options={propertyOptions} />
            <SelectField label="What is your approximate budget?" value={budget} onChange={setBudget} options={budgetOptions} />
          </>
        )}

        {step === 'timeline' && (
          <SelectField label="Select your timeline" value={timeline} onChange={setTimeline} options={timelineOptions} />
        )}

        {step === 'details' && (
          <>
            <TextField label="Your full name" value={fullName} onChange={setFullName} placeholder="Select" />
            <label className="buk-field">
              <span>WhatsApp number</span>
              <div className="buk-phone-wrap">
                <span aria-hidden="true">🇳🇬</span>
                <input
                  type="tel"
                  value={whatsapp}
                  onChange={(event) => setWhatsapp(event.target.value)}
                  placeholder="000 000 000 00"
                  required
                />
              </div>
            </label>
            <TextField label="Email address" value={email} onChange={setEmail} placeholder="e.g johndoe@email.com" type="email" />
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

  return (
    <div className="buk-page">
      <header className="buk-header">
        <a href="/" className="buk-logo" aria-label="Havlo home">
          <img src="/Havlo Black Transparent.png" alt="Havlo" />
          <span>Buy Abroad</span>
        </a>
        <button className="buk-header-cta" type="button" onClick={openConsultation}>Get Free Consultation</button>
        <button className="buk-menu" type="button" aria-label="Open menu">☰</button>
      </header>

      <main>
        <section className="buk-hero">
          <div className="buk-inner buk-hero-grid">
            <div className="buk-hero-copy">
              <h1>Own UK Property<br />from <span>Anywhere in Nigeria</span></h1>
              <p>Residential homes, commercial units, and investment properties, with a dedicated advisor guiding your search, negotiations, legal setup, and payment to completion.</p>
              <button className="buk-hero-cta" type="button" onClick={openConsultation}>Get Free Consultation</button>
              <div className="buk-trust">
                <strong>Excellent</strong>
                <span className="buk-stars">★★★★★</span>
                <b>Based on verified customer feedback</b>
              </div>
            </div>

            <aside className="buk-form-card buk-form-preview" aria-label="Eligibility form preview">
              <div className="buk-card-head">
                <h2>Check Your Eligibility</h2>
                <p>Answer 3 quick questions, takes 30 seconds</p>
              </div>
              <div className="buk-divider" />
              <div className="buk-preview-fields">
                <div className="buk-preview-field">
                  <span>What are you looking to buy?</span>
                  <button type="button" onClick={openConsultation}>Select <ChevronDown size={16} /></button>
                </div>
                <div className="buk-preview-field">
                  <span>What is your approximate budget?</span>
                  <button type="button" onClick={openConsultation}>Select <ChevronDown size={16} /></button>
                </div>
              </div>
              <button className="buk-primary" type="button" onClick={openConsultation}>Get Free Consultation →</button>
              <p className="buk-secure">🔒 Your details are confidential. No spam, ever.</p>
            </aside>
          </div>
        </section>

        <section className="buk-strip">
          <div className="buk-inner buk-strip-grid">
            {featureStrip.map((item) => (
              <div key={item.text} className="buk-strip-item">
                {item.icon}
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="buk-market">
          <div className="buk-inner">
            <h2>The UK remains one of the most stable property markets in the world</h2>
            <div className="buk-market-grid">
              <div>
                <p className="buk-section-lead">For Nigerian investors, the UK offers legal clarity, strong rental demand, and long-term capital growth, backed by a system you can trust even when you’re 4,000 miles away.</p>
                <p className="buk-market-body">The UK housing market has consistently outperformed inflation over 20 years. London alone has a structural undersupply of 30,000+ homes per year. For buy-to-let investors, average gross yields in cities like Birmingham, Manchester, and Leeds sit between 6-9%.</p>
                <p className="buk-market-body">And unlike many markets, the UK has no restrictions on foreign ownership. With Havlo Buy Abroad, you get a dedicated advisor who connects you to the right agent, solicitor, and conveyancer — and tells you exactly what to pay and how to pay it.</p>
              </div>
              <div className="buk-stats">
                <div className="buk-stat-item"><strong>£285bn</strong><span>UK property purchased by overseas buyers in the last 5 years</span></div>
                <div className="buk-stat-item"><strong>6-9%</strong><span>Average gross rental yields in major UK cities outside London</span></div>
                <div className="buk-stat-item"><strong>No cap</strong><span>Foreign nationals face zero ownership restrictions in the UK</span></div>
              </div>
            </div>
          </div>
        </section>

        <section className="buk-section">
          <div className="buk-inner">
            <span className="buk-eyebrow">WHAT YOU CAN BUY</span>
            <h2>Three paths into UK property — all managed for you</h2>
            <div className="buk-property-grid">
              {propertyCards.map((card) => (
                <article key={card.title} className="buk-property-card">
                  <img src={card.image} alt="" />
                  <div>
                    <h3>{card.title}</h3>
                    <p>{card.body}</p>
                    <div className={`buk-tags buk-tags-${card.tone}`}>
                      {card.tags.map((tag) => <span key={tag}>{tag}</span>)}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="process" className="buk-process">
          <div className="buk-inner">
            <span>THE PROCESS</span>
            <h2>Your advisor handles everything. You just decide.</h2>
            <div className="buk-process-grid">
              {[
                ['1', 'Free Consultation', 'Tell us your goals, budget, and preferred location. We’ll recommend the right property strategy for you.'],
                ['2', 'We Search & Shortlist', 'We match you with suitable properties and connect you directly to vetted UK estate agents.'],
                ['3', 'Negotiate & Structure', 'We guide you on pricing, negotiations, and secure payment structuring to ensure a smooth, compliant transaction.'],
                ['4', 'Legal Completion', 'We connect you with trusted UK legal experts and support you through every step until the deal is completed.'],
              ].map((stepItem, index) => (
                <React.Fragment key={stepItem[0]}>
                  <div className="buk-process-step">
                    <b>{stepItem[0]}</b>
                    <h3>{stepItem[1]}</h3>
                    <p>{stepItem[2]}</p>
                  </div>
                  {index < 3 && <img className="buk-arrow" src="/buyabroad-uk/process-arrow.png" alt="" />}
                </React.Fragment>
              ))}
            </div>
          </div>
        </section>

        <section className="buk-section buk-testimonials">
          <div className="buk-inner">
            <span className="buk-eyebrow">WHAT OUR BUYERS SAY</span>
            <h2>Nigerians buying UK property — without the stress</h2>
            <div className="buk-testimonial-grid">
              {testimonials.map((item) => (
                <article key={item.author} className="buk-tcard">
                  <div className="buk-quote">“</div>
                  <p className="buk-tcard-body">{item.quote}</p>
                  <div className="buk-rating">★★★★★</div>
                  <strong className="buk-tcard-name">{item.author}</strong>
                  <span className="buk-tcard-meta">{item.meta}</span>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="buk-section buk-faq">
          <div className="buk-inner">
            <span className="buk-eyebrow">COMMON QUESTIONS</span>
            <h2>Everything Nigerian buyers ask us</h2>
            <div className="buk-faq-grid">
              {faqs.map(([question, answer]) => (
                <article key={question}>
                  <h3>{question}</h3>
                  <p>{answer}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="buk-bottom-cta">
          <div className="buk-inner">
            <div className="buk-cta-card">
              <h2>Your UK property move starts<br />with one free call.</h2>
              <p>No commitment. A dedicated advisor will map out exactly what’s possible for your budget and goals.</p>
              <button type="button" onClick={openConsultation}>Get Free Consultation</button>
            </div>
          </div>
        </section>
      </main>

      <footer className="buk-footer">
        <div className="buk-inner">
          <a href="/" className="buk-logo">
            <img src="/Havlo Black Transparent.png" alt="Havlo" />
            <span>Buy Abroad</span>
          </a>
          <p>© 2026 Havlo Buy Abroad. A Havlo service</p>
          <nav>
            <a href="/privacy-policy">Privacy Policy</a>
            <a href="/terms">Terms</a>
            <a href="/contact-us">Contact</a>
          </nav>
        </div>
      </footer>

      {isConsultationOpen && (
        <div className="buk-modal" role="dialog" aria-modal="true" aria-label="Buy Abroad consultation form">
          <div className="buk-modal-backdrop" onClick={closeConsultation} />
          <div className="buk-modal-card buk-form-card">
            <button className="buk-modal-close" type="button" onClick={closeConsultation} aria-label="Close consultation form">
              <X size={24} />
            </button>
            {renderForm()}
          </div>
        </div>
      )}

      <style>{`
        .buk-page { min-height: 100vh; background: #fff; color: #1f1f1e; font-family: Inter, sans-serif; overflow-x: hidden; scrollbar-width: none; -ms-overflow-style: none; }
        .buk-page * { scrollbar-width: none; -ms-overflow-style: none; }
        .buk-page::-webkit-scrollbar, .buk-page *::-webkit-scrollbar { width: 0; height: 0; display: none; }
        .buk-inner { width: min(100% - 200px, 1240px); margin: 0 auto; }
        .buk-header { height: 80px; display: flex; align-items: center; justify-content: space-between; padding: 0 max(100px, calc((100vw - 1240px) / 2)); background: #fff; border-bottom: 1px solid #eee; position: sticky; top: 0; z-index: 30; }
        .buk-logo { display: inline-flex; flex-direction: column; align-items: center; text-decoration: none; color: #111; line-height: 1; }
        .buk-logo img { width: 136px; height: auto; display: block; }
        .buk-logo span { margin-top: 0; font-size: 16px; font-weight: 400; }
        .buk-header-cta { border: 0; border-radius: 12px; background: #050505; color: white; height: 48px; padding: 0 20px; font-weight: 800; cursor: pointer; }
        .buk-menu { display: none; border: 0; background: none; font-size: 24px; }
        .buk-hero { background: linear-gradient(90deg, #fff 0%, #fff 45%, #ffd3f2 100%); padding: 80px 0 72px; }
        .buk-hero-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 541px); gap: 42px; align-items: center; }
        .buk-hero-copy h1 { font-family: "Plus Jakarta Sans", Inter, sans-serif; font-size: clamp(36px, 4vw, 52px); line-height: 1.15; letter-spacing: -0.03em; font-weight: 800; margin: 0 0 24px; }
        .buk-hero-copy h1 span { color: #b100df; }
        .buk-hero-copy p { font-size: clamp(14px, 1.4vw, 16px); line-height: 1.55; margin: 0 0 26px; }
        .buk-hero-cta { height: 48px; border: 0; border-radius: 12px; background: #050505; color: #fff; padding: 0 26px; font-weight: 900; cursor: pointer; margin-bottom: 26px; }
        .buk-trust { display: flex; align-items: center; gap: 12px; font-size: 14px; }
        .buk-stars { color: #fff; background: #00b67a; letter-spacing: 2px; padding: 4px 6px; font-size: 18px; line-height: 1; }
        .buk-form-card { background: #fff; border: 3px solid #050505; border-radius: 16px; padding: 32px; min-height: 560px; box-shadow: 6px 6px 0 #000; }
        .buk-form-preview { width: 100%; display: flex; flex-direction: column; }
        .buk-card-head h2 { font-family: Inter, sans-serif; font-size: 27px; line-height: 1.15; font-weight: 800; margin: 0 0 10px; }
        .buk-card-head p { font-size: 20px; line-height: 1.25; margin: 0; }
        .buk-divider { border-top: 3px solid #111; margin: 18px 0 36px; }
        .buk-field { display: block; margin-bottom: 24px; }
        .buk-field span { display: block; margin-bottom: 10px; font-size: 12px; font-weight: 800; }
        .buk-field input, .buk-field select { width: 100%; height: 48px; border: 0; border-radius: 12px; background: #f3f4f6; padding: 0 16px; color: #333; font-size: 15px; appearance: none; }
        .buk-phone-wrap { display: grid; grid-template-columns: 50px 1fr; align-items: center; height: 48px; border-radius: 12px; background: #f3f4f6; overflow: hidden; }
        .buk-phone-wrap > span { height: 48px; display: inline-flex; align-items: center; justify-content: center; border-right: 3px solid #fff; font-size: 17px; }
        .buk-phone-wrap input { border-radius: 0; background: transparent; }
        .buk-select-wrap { display: grid; grid-template-columns: 1fr 48px; align-items: center; background: #f0f0f2; border-radius: 12px; overflow: hidden; }
        .buk-select-wrap select { border-radius: 0; background: transparent; }
        .buk-select-wrap svg { justify-self: center; border-left: 3px solid #fff; width: 48px; height: 48px; padding: 15px; }
        .buk-preview-fields { display: flex; flex-direction: column; gap: 30px; }
        .buk-preview-field span { display: block; margin-bottom: 10px; font-size: 12px; font-weight: 800; }
        .buk-preview-field button { width: 100%; height: 48px; border: 0; border-radius: 12px; background: #f3f4f6; display: flex; align-items: center; justify-content: space-between; padding: 0 0 0 16px; color: #777; font-size: 14px; cursor: pointer; overflow: hidden; }
        .buk-preview-field svg { width: 50px; height: 48px; padding: 15px; border-left: 3px solid #fff; color: #000; }
        .buk-form-preview .buk-primary { margin-top: auto; }
        .buk-form-spacer { height: 92px; }
        .buk-primary, .buk-whatsapp, .buk-call { width: 100%; height: 48px; border: 0; border-radius: 12px; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 900; text-decoration: none; cursor: pointer; }
        .buk-primary, .buk-call { background: #050505; color: #fff; }
        .buk-whatsapp { background: #09cf5a; color: #fff; margin-top: 26px; }
        .buk-call { margin-top: 14px; }
        .buk-back { display: block; margin: 20px auto 0; border: 0; background: none; font-weight: 900; cursor: pointer; }
        .buk-secure { color: #777; text-align: center; margin: 16px 0 0; font-size: 14px; }
        .buk-error { color: #b00020; font-size: 13px; font-weight: 700; }
        .buk-result { min-height: 515px; display: flex; flex-direction: column; justify-content: center; text-align: center; }
        .buk-result-emoji { font-size: 64px; margin-bottom: 28px; }
        .buk-result h3 { font-family: Inter, sans-serif; font-size: 27px; line-height: 1.15; font-weight: 800; margin: 0 0 14px; }
        .buk-result p { max-width: 476px; margin: 0 auto; font-size: 20px; line-height: 1.18; }
        .buk-learn { border: 0; background: transparent; color: #ff7a1a; font-weight: 800; margin-top: 22px; cursor: pointer; }
        .buk-modal { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 24px; }
        .buk-modal-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,.48); }
        .buk-modal-card { position: relative; width: min(541px, calc(100vw - 28px)); max-height: calc(100dvh - 32px); overflow-y: auto; scrollbar-gutter: stable; }
        .buk-modal-close { position: absolute; top: 14px; right: 14px; width: 36px; height: 36px; border: 0; border-radius: 999px; background: #f3f4f6; color: #111; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; z-index: 1; }
        .buk-strip { padding: 18px 0; background: #fff; border-bottom: 1px solid #eee; }
        .buk-strip-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
        .buk-strip-item { display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 800; }
        .buk-strip-item svg { color: #b100df; }
        .buk-market { background: #f4f4f4; padding: 72px 0; }
        .buk-market-grid { display: grid; grid-template-columns: 1.1fr .9fr; gap: 80px; align-items: start; margin-top: 14px; }
        .buk-market h2, .buk-section h2, .buk-process h2, .buk-bottom-cta h2 { font-family: "Plus Jakarta Sans", Inter, sans-serif; font-weight: 800; letter-spacing: -0.03em; margin: 0; }
        .buk-market h2 { font-size: 44px; line-height: 1.05; margin-bottom: 12px; }
        .buk-section-lead { color: #555; font-size: 15px; line-height: 1.5; margin: 0; }
        .buk-market-body { font-size: 15px; line-height: 1.65; color: #1a1a1a; margin: 0; }
        .buk-section-lead + .buk-market-body { margin-top: 40px; }
        .buk-market-body + .buk-market-body { margin-top: 32px; }
        .buk-stats { display: flex; flex-direction: column; }
        .buk-stat-item { border-left: 4px solid #8b00d4; padding: 4px 0 24px 22px; }
        .buk-stat-item:not(:last-child) { margin-bottom: 24px; }
        .buk-stat-item strong { display: block; font-family: "Clash Display Variable", "Clash Display", Inter, sans-serif; font-size: 36px; font-weight: 500; line-height: 1.2; letter-spacing: -0.01em; color: #111; margin-bottom: 6px; }
        .buk-stat-item span { color: #555; font-size: 14px; line-height: 1.45; }
        .buk-section { padding: 72px 0; }
        .buk-eyebrow { color: #b100df; font-family: "Plus Jakarta Sans", Inter, sans-serif; font-size: 24px; font-weight: 700; line-height: 1.2; letter-spacing: -0.03em; text-transform: uppercase; }
        .buk-section h2 { font-family: "Plus Jakarta Sans", Inter, sans-serif; font-size: 48px; font-weight: 600; line-height: 1.2; letter-spacing: -0.03em; margin: 10px 0 32px; }
        .buk-property-grid, .buk-testimonial-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
        .buk-property-card { border: 1px solid #e6e6e6; border-radius: 14px; background: #fff; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,.06); }
        .buk-property-card img { width: 100%; height: 190px; object-fit: cover; display: block; }
        .buk-property-card > div { padding: 20px 22px 22px; }
        .buk-property-card h3 { font-size: 19px; font-weight: 800; color: #111; margin: 0 0 8px; letter-spacing: -0.01em; }
        .buk-property-card p { font-size: 14px; line-height: 1.55; color: #444; margin: 0; }
        .buk-tags { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 16px; }
        .buk-tags span { font-size: 12px; font-weight: 600; border-radius: 999px; padding: 4px 12px; border: 1.5px solid transparent; }
        .buk-tags-green span { color: #006b3f; background: #ddf5ec; border-color: #b8e8d4; }
        .buk-tags-blue span { color: #1a4db5; background: #dbeafe; border-color: #bdd7fa; }
        .buk-tags-purple span { color: #7300aa; background: #f2e3fd; border-color: #ddb8f5; }
        .buk-process { background: #050807; color: #fff; padding: 72px 0; text-align: center; }
        .buk-process > .buk-inner > span { font-weight: 900; color: #bbb; }
        .buk-process h2 { font-size: 44px; line-height: 1; margin: 14px 0 54px; }
        .buk-process-grid { display: grid; grid-template-columns: 1fr 90px 1fr 90px 1fr 90px 1fr; gap: 12px; align-items: center; }
        .buk-process-step b { display: inline-flex; width: 24px; height: 24px; border-radius: 999px; align-items: center; justify-content: center; background: #b100df; margin-bottom: 12px; }
        .buk-process-step h3 { margin: 0 0 8px; font-size: 16px; font-weight: 1000; }
        .buk-process-step p { margin: 0; font-size: 13px; color: #ddd; line-height: 1.4; }
        .buk-arrow { width: 76px; justify-self: center; }
        .buk-testimonials { text-align: center; }
        .buk-testimonial-grid { text-align: left; }
        .buk-tcard { background: #f7f8fa !important; border: 1px solid #e8e9ec !important; border-radius: 16px !important; padding: 28px 28px 26px !important; display: flex; flex-direction: column; }
        .buk-quote { color: #8b00d4; font-size: 52px; line-height: 1; font-weight: 900; margin-bottom: 10px; font-family: Georgia, serif; letter-spacing: -2px; }
        .buk-tcard-body { font-size: 14px; line-height: 1.65; color: #1a1a1a; margin: 0 0 0; flex: 1; }
        .buk-rating { color: #f59e0b; font-size: 18px; margin: 20px 0 14px; letter-spacing: 3px; }
        .buk-tcard-name { display: block; font-size: 15px; font-weight: 800; color: #111; }
        .buk-tcard-meta { display: block; font-size: 13px; color: #888; margin-top: 3px; font-weight: 400; }
        .buk-faq { text-align: center; }
        .buk-faq-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 26px 44px; text-align: left; margin-top: 44px; }
        .buk-faq-grid article { border-bottom: 1px solid #e4e4e4; padding-bottom: 22px; }
        .buk-faq-grid h3 { font-size: 16px; font-weight: 1000; margin: 0 0 8px; }
        .buk-faq-grid p { font-size: 14px; line-height: 1.5; color: #333; margin: 0; }
        .buk-bottom-cta { padding: 60px 0 76px; }
        .buk-cta-card { background: #b100df url('/buyabroad-uk/abstract-bg.png') center/cover no-repeat; border-radius: 18px; padding: 54px 30px; text-align: center; color: #fff; }
        .buk-cta-card h2 { font-size: 42px; line-height: .95; }
        .buk-cta-card p { max-width: 520px; margin: 18px auto; color: rgba(255,255,255,.9); }
        .buk-cta-card button { height: 38px; border: 0; border-radius: 8px; padding: 0 22px; background: #fff; color: #111; font-weight: 900; cursor: pointer; }
        .buk-footer { padding: 24px 0; }
        .buk-footer .buk-inner { display: flex; align-items: center; justify-content: space-between; gap: 24px; }
        .buk-footer p { font-size: 13px; color: #555; margin: 0; }
        .buk-footer nav { display: flex; gap: 24px; }
        .buk-footer a { color: #111; font-size: 13px; font-weight: 800; text-decoration: none; }

        /* ── Mid desktop: tighten the grid before it collapses ── */
        @media (max-width: 1100px) {
          .buk-inner { width: min(100% - 80px, 1240px); }
          .buk-hero { padding: 60px 0 56px; }
          .buk-hero-grid { gap: 32px; }
          .buk-form-card { padding: 26px; min-height: 520px; box-shadow: 5px 5px 0 #000; }
          .buk-card-head h2 { font-size: 24px; }
          .buk-card-head p { font-size: 18px; }
        }

        /* ── Tablet / Mobile: collapse to single column ── */
        @media (max-width: 900px) {
          .buk-inner { width: min(100% - 40px, 620px); }
          .buk-header { height: 68px; padding: 0 20px; }
          .buk-logo img { width: 82px; }
          .buk-logo span { font-size: 11px; font-weight: 600; margin-top: -2px; }
          .buk-header-cta { display: none; }
          .buk-menu { display: block; }
          .buk-hero { padding: 36px 0 36px; background: linear-gradient(180deg, #fff 0%, #ffd3f2 100%); }
          .buk-hero-grid { display: flex; flex-direction: column; gap: 28px; }
          .buk-hero-copy h1 { font-size: clamp(28px, 8.5vw, 44px); line-height: 1.1; margin-bottom: 14px; }
          .buk-hero-copy p { font-size: 15px; line-height: 1.5; margin-bottom: 18px; }
          .buk-hero-cta { width: 100%; margin-bottom: 16px; }
          .buk-trust { flex-wrap: wrap; gap: 8px; font-size: 12px; }
          .buk-form-card { width: 100%; border-width: 3px; padding: 22px; min-height: 0; box-shadow: 4px 4px 0 #000; }
          .buk-form-preview { width: 100%; min-height: 0; }
          .buk-card-head h2 { font-size: 24px; line-height: 1.12; }
          .buk-card-head p { font-size: 15px; }
          .buk-divider { margin: 14px 0 22px; }
          .buk-preview-fields { gap: 22px; }
          .buk-form-spacer { height: 32px; }
          .buk-result { min-height: 0; padding: 24px 0; }
          .buk-result-emoji { font-size: 48px; margin-bottom: 18px; }
          .buk-result h3 { font-size: 24px; }
          .buk-result p { font-size: 16px; line-height: 1.35; }
          .buk-modal { padding: 14px; align-items: center; }
          .buk-modal-card { width: min(480px, calc(100vw - 20px)); max-height: calc(100dvh - 20px); }
          .buk-modal-close { top: 10px; right: 10px; }
          .buk-strip-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
          .buk-strip-item { font-size: 12px; align-items: flex-start; }
          .buk-market { padding: 44px 0; }
          .buk-market-grid { grid-template-columns: 1fr; gap: 24px; }
          .buk-market h2, .buk-section h2, .buk-process h2 { font-size: clamp(26px, 7vw, 36px); }
          .buk-section { padding: 48px 0; }
          .buk-property-grid, .buk-testimonial-grid, .buk-faq-grid { grid-template-columns: 1fr; }
          .buk-process-grid { grid-template-columns: 1fr; gap: 28px; }
          .buk-arrow { display: none; }
          .buk-process-step { max-width: 320px; margin: 0 auto; }
          .buk-cta-card { padding: 40px 20px; }
          .buk-cta-card h2 { font-size: 30px; }
          .buk-footer .buk-inner { flex-direction: column; text-align: center; }
        }

        /* ── Small mobile: sub-400px refinements ── */
        @media (max-width: 420px) {
          .buk-inner { width: calc(100% - 28px); }
          .buk-hero-copy h1 { font-size: clamp(26px, 8vw, 32px); }
          .buk-hero { padding: 28px 0 28px; }
          .buk-hero-cta { height: 44px; font-size: 14px; }
          .buk-form-card { padding: 18px; border-width: 2px; box-shadow: 3px 3px 0 #000; }
          .buk-card-head h2 { font-size: 21px; }
          .buk-card-head p { font-size: 13px; }
          .buk-divider { margin: 12px 0 18px; }
          .buk-preview-fields { gap: 18px; }
          .buk-primary { height: 44px; font-size: 14px; }
          .buk-trust { font-size: 11px; gap: 6px; }
          .buk-stars { font-size: 14px; }
        }
      `}</style>
    </div>
  );
};
