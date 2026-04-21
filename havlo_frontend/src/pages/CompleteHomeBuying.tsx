import React, { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useModal } from '../hooks/useModal';

type Situation = 'buying' | 'buying-selling';

const essentialAccess = [
  'Property search and shortlisting support',
  'Guidance on international ownership options',
  'Country-specific buying process overview',
  'Access to vetted local agents and partners',
  'Document checklist and timeline planning',
];

const essentialPlus = [
  'Everything in Essential Access, plus:',
  'Negotiation and offer support',
  'Legal, tax, and financing guidance (via local experts)',
  'Ongoing liaison with agents, lawyers, and developers',
  'Support through completion and handover',
];

const stepsBuying = [
  {
    title: 'Bespoke Consultation',
    desc: 'We begin with a personalised consultation to understand your goals, timeline, and target market.',
  },
  {
    title: 'Property Positioning & Valuation',
    desc: 'We assess market value and advise on pricing, positioning, and any preparation needed to maximise appeal.',
  },
  {
    title: 'Local Expert Representation',
    desc: 'We appoint vetted local agents, legal, and tax professionals to manage the sale in-market.',
  },
  {
    title: 'Marketing & Buyer Management',
    desc: 'Your property is marketed to qualified buyers, with viewings, enquiries, and offers handled on your behalf.',
  },
  {
    title: 'Offer Negotiation & Sale Progression',
    desc: 'We support negotiations and oversee contracts, due diligence, and buyer coordination through to exchange.',
  },
  {
    title: 'Completion & Post-Sale Support',
    desc: 'We guide you through completion and provide post-sale support, including fund transfers and reinvestment options.',
  },
];

const stepsBuyingSelling = [
  {
    title: 'Discovery & Strategy',
    desc: 'We map both the sale of your current home and the search for your next, aligning timelines and budgets.',
  },
  {
    title: 'Sale Positioning & Valuation',
    desc: 'We position your existing property for the strongest sale price while preparing your buying brief.',
  },
  {
    title: 'Dual Local Representation',
    desc: 'Vetted agents and legal partners on both sides — one team selling, one team sourcing your next home.',
  },
  {
    title: 'Marketing & Buyer Management',
    desc: 'High-impact marketing for the sale and tight buyer qualification so only serious enquiries reach you.',
  },
  {
    title: 'Synchronised Negotiation',
    desc: 'We negotiate sale and purchase together, protecting your chain and minimising overlap risk.',
  },
  {
    title: 'Completion & Move-In Support',
    desc: 'Coordinated handover, paperwork, and fund transfers so completion on both sides feels effortless.',
  },
];

const heroBadges = [
  { label: 'DONE', text: 'Property sourced', tone: 'done' as const },
  { label: 'IN PROGRESS', text: 'Offer received', tone: 'progress' as const },
  { label: 'COMING UP', text: 'Purchase completed', tone: 'coming' as const },
];

const includesRows = [
  { label: 'All your conveyancing and legal work', value: 'worth £1,610' },
  { label: 'Property survey', value: 'worth £432' },
];

export const CompleteHomeBuying: React.FC = () => {
  const { openModal } = useModal();
  const [situation, setSituation] = useState<Situation>('buying');
  const [propertyPrice, setPropertyPrice] = useState('');

  const calculatedPrice = useMemo(() => {
    const cleaned = propertyPrice.replace(/,/g, '').trim();
    if (!cleaned) return '';
    const num = Number(cleaned);
    if (Number.isNaN(num)) return '';
    const val = Math.max(2000, num * 0.05);
    return val.toLocaleString('en-GB', { maximumFractionDigits: 0 });
  }, [propertyPrice]);

  const steps = situation === 'buying' ? stepsBuying : stepsBuyingSelling;

  return (
    <div className="flex flex-col w-full bg-white">
      {/* 1. Hero */}
      <section className="relative bg-gradient-to-b from-[#FFB0E8] via-[#FFD7B5] to-[#FEEAA0] px-6 lg:px-[100px] pt-16 lg:pt-24 pb-16 lg:pb-24">
        <div className="max-w-[1240px] mx-auto flex flex-col items-center gap-10 lg:gap-14">
          <div className="flex flex-col items-center text-center gap-5 lg:gap-7 max-w-[900px]">
            <h1 className="font-display font-black tracking-[-1.2px] lg:tracking-[-2px] text-[#1F1F1E] text-[40px] sm:text-[56px] lg:text-[72px] leading-[1.05]">
              Buying a home abroad just got a whole lot easier.
            </h1>
            <p className="font-body text-base lg:text-lg text-black/80 max-w-[560px]">
              Everything we charge, all in one peaceful place
            </p>
            <Button
              onClick={() => openModal('create-account')}
              className="h-14 px-8 bg-black text-white rounded-[48px] font-body text-base lg:text-lg font-semibold hover:bg-black/90 transition-colors"
            >
              Get Started Today
            </Button>
          </div>

          {/* Dashboard preview row */}
          <div className="w-full grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 lg:gap-10 items-center">
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch gap-3 lg:gap-4 w-full">
              {heroBadges.map((b) => (
                <div
                  key={b.label}
                  className="flex-1 min-w-[180px] flex items-center gap-3 rounded-[20px] bg-white/85 backdrop-blur-sm border border-black/5 px-4 py-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                >
                  <span
                    className={
                      'font-body text-[10px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full whitespace-nowrap ' +
                      (b.tone === 'done'
                        ? 'bg-[#D8F8E4] text-[#149D4F]'
                        : b.tone === 'progress'
                        ? 'bg-[#FAD8F4] text-[#A409D2]'
                        : 'bg-black/10 text-black/60')
                    }
                  >
                    {b.label}
                  </span>
                  <span className="font-body text-sm lg:text-[15px] text-[#1F1F1E] truncate">
                    {b.text}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-4 lg:max-w-[320px]">
              <div className="shrink-0 w-12 h-12 lg:w-14 lg:h-14 rounded-2xl bg-[#A409D2] flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 lg:w-7 lg:h-7 text-white">
                  <path d="M3 11.5L12 4l9 7.5V20a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1v-8.5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="font-display font-bold text-[#1F1F1E] text-xl lg:text-2xl leading-tight">
                Track everything in one place, on your dashboard
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. What we offer */}
      <section className="bg-white px-6 lg:px-[100px] py-20 lg:py-28">
        <div className="max-w-[1240px] mx-auto flex flex-col gap-10 lg:gap-14">
          <div className="flex flex-col gap-4 max-w-[680px]">
            <h2 className="font-display text-[36px] sm:text-[44px] lg:text-[56px] font-black leading-[1.1] text-[#040504]">
              What we offer
            </h2>
            <p className="font-body text-base lg:text-lg text-black/70">
              From sourcing to completion, we provide an end-to-end experience for buying property abroad.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6">
            {/* Essential Access card */}
            <div className="rounded-[24px] bg-[#FAEBFE] p-6 lg:p-10 flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <span className="font-body text-xs font-bold uppercase tracking-[0.12em] text-[#A409D2]">
                  Essential Access · from £2000
                </span>
                <h3 className="font-display text-[24px] lg:text-[28px] font-bold text-[#1F1F1E] leading-tight">
                  Expert mortgage advice & application service
                </h3>
                <p className="font-body text-sm text-black/60">Starting from £2000</p>
              </div>
              <ul className="flex flex-col gap-3">
                {essentialAccess.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-[#149D4F] mt-0.5 shrink-0" />
                    <span className="font-body text-sm lg:text-base text-[#1F1F1E]">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Essential Plus card */}
            <div className="rounded-[24px] bg-[#FFF6D6] p-6 lg:p-10 flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <span className="font-body text-xs font-bold uppercase tracking-[0.12em] text-[#B8860B]">
                  Essential Plus · Starting from £5000
                </span>
                <h3 className="font-display text-[24px] lg:text-[28px] font-bold text-[#1F1F1E] leading-tight">
                  Expert mortgage advice, legal work & support
                </h3>
                <p className="font-body text-sm text-black/60">Starting from £5000</p>
              </div>
              <ul className="flex flex-col gap-3">
                {essentialPlus.map((item, idx) => (
                  <li key={item} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-[#149D4F] mt-0.5 shrink-0" />
                    <span
                      className={
                        'font-body text-sm lg:text-base text-[#1F1F1E] ' +
                        (idx === 0 ? 'font-semibold' : '')
                      }
                    >
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 3. How it works */}
      <section className="px-6 lg:px-[100px] py-20 lg:py-28 bg-gradient-to-b from-[#E5E9FF] via-[#F0E6FF] to-[#FCE9FF]">
        <div className="max-w-[1240px] mx-auto flex flex-col gap-10 lg:gap-14">
          <div className="flex flex-col items-center text-center gap-6">
            <h2 className="font-display text-[36px] sm:text-[44px] lg:text-[56px] font-black leading-[1.1] text-[#040504]">
              How it works
            </h2>
            <p className="font-body text-sm lg:text-base text-black/60 uppercase tracking-[0.16em] font-semibold">
              What's your situation?
            </p>
            <div className="inline-flex p-1.5 rounded-full bg-white border border-black/10 shadow-sm">
              {(
                [
                  { id: 'buying', label: "I'm buying" },
                  { id: 'buying-selling', label: "I'm buying and selling" },
                ] as { id: Situation; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setSituation(opt.id)}
                  className={
                    'px-5 lg:px-6 h-11 rounded-full font-body text-sm lg:text-base font-semibold transition-colors ' +
                    (situation === opt.id
                      ? 'bg-black text-white'
                      : 'text-black/70 hover:text-black')
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Zigzag layout */}
          <div className="relative">
            {/* Decorative dotted curve (desktop only) */}
            <svg
              aria-hidden
              className="hidden lg:block absolute inset-0 w-full h-full pointer-events-none"
              preserveAspectRatio="none"
              viewBox="0 0 1000 1200"
            >
              <path
                d="M 240 120 C 600 120, 600 320, 760 320 C 920 320, 380 520, 240 520 C 100 520, 920 720, 760 720 C 600 720, 600 920, 240 920 C 80 920, 920 1080, 760 1080"
                stroke="#A409D2"
                strokeWidth="2"
                strokeDasharray="4 8"
                fill="none"
                opacity="0.4"
              />
            </svg>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-y-12 lg:gap-x-10 relative">
              {steps.map((step, idx) => (
                <div
                  key={step.title}
                  className={
                    'relative rounded-[20px] bg-white p-6 lg:p-7 shadow-[0_4px_16px_rgba(0,0,0,0.04)] border border-black/5 ' +
                    (idx % 2 === 1 ? 'lg:mt-16' : '')
                  }
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-[#A409D2] flex items-center justify-center">
                      <span className="font-display text-sm font-bold text-white">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <h3 className="font-display text-lg lg:text-xl font-bold text-[#1F1F1E] leading-tight">
                      {step.title}
                    </h3>
                  </div>
                  <p className="font-body text-sm lg:text-[15px] text-black/70 leading-[1.6]">
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-center">
            <Button
              onClick={() => openModal('create-account')}
              className="h-14 px-8 bg-black text-white rounded-[48px] font-body text-base lg:text-lg font-semibold hover:bg-black/90 transition-colors"
            >
              Get Started Today
            </Button>
          </div>
        </div>
      </section>

      {/* 4. Let's talk fees */}
      <section className="bg-[#1F1F1E] px-6 lg:px-[100px] py-20 lg:py-28">
        <div className="max-w-[1240px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-10 lg:gap-16 items-start">
          <div className="flex flex-col gap-5 lg:gap-6">
            <h2 className="font-display text-[40px] sm:text-[52px] lg:text-[72px] font-black leading-[1.0] text-white">
              Let's talk fees
            </h2>
            <p className="font-body text-base lg:text-lg text-white/70 max-w-[460px]">
              Our cost depends on your property price, but they start from around £2,000.
            </p>
          </div>

          <div className="rounded-[24px] bg-white p-6 lg:p-8 flex flex-col gap-5">
            <label className="flex flex-col gap-2">
              <span className="font-body text-sm font-semibold text-black/70">
                Your property price
              </span>
              <div className="flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-3 focus-within:border-black/40 transition-colors">
                <span className="font-body text-base text-black/60">£</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={propertyPrice}
                  onChange={(e) => setPropertyPrice(e.target.value)}
                  placeholder="Enter price"
                  className="w-full bg-transparent font-body text-base text-black outline-none"
                />
              </div>
            </label>

            <div className="rounded-xl bg-[#00FF8C] px-4 py-3 flex items-center justify-between">
              <span className="font-body text-sm font-semibold text-[#040405]">
                Your price
              </span>
              <span className="font-display text-lg font-bold text-[#040405]">
                £{calculatedPrice || '—'}
              </span>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <span className="font-body text-sm font-semibold text-black/70">
                This includes:
              </span>
              {includesRows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-4 py-2 border-b border-black/5 last:border-b-0"
                >
                  <span className="font-body text-sm text-[#1F1F1E]">{row.label}</span>
                  <span className="font-body text-sm font-semibold text-black/60 whitespace-nowrap">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            <Button
              onClick={() => openModal('create-account')}
              className="mt-2 h-12 px-6 bg-black text-white rounded-full font-body text-base font-semibold hover:bg-black/90 transition-colors w-full"
            >
              Lock in your quote
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};
