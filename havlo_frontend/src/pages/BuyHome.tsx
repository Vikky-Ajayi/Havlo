import React from 'react';
import { Check } from 'lucide-react';
import { useModal } from '../hooks/useModal';

const HOUSE_IMG =
  'https://api.builder.io/api/v1/image/assets/TEMP/1d39f7bca27c7f8b2a16a58e41c532146fcabcf1?width=894';

const ESSENTIAL_ACCESS = [
  'Property search and shortlisting support',
  'Guidance on international ownership options',
  'Country-specific buying process overview',
  'Access to vetted local agents and partners',
  'Document checklist and timeline planning',
];

const ESSENTIAL_PLUS = [
  'End-to-end purchase coordination',
  'Negotiation and offer support',
  'Legal, tax, and financing guidance (via local experts)',
  'Ongoing liaison with agents, lawyers, and developers',
  'Support through completion and handover',
];

const STEPS = [
  {
    title: 'Bespoke Consultation',
    desc: 'We begin with a personalised consultation to understand your property, goals, timeline, and target market.',
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

const FeesPanel: React.FC<{ variant: 'mobile' | 'desktop' }> = ({ variant }) => {
  const [price, setPrice] = React.useState('');
  const numericPrice = Number(price) || 0;
  const calculated = Math.round(numericPrice * 0.05);
  const isDesktop = variant === 'desktop';

  return (
    <div
      className={
        isDesktop
          ? 'rounded-[24px] bg-white p-10 flex flex-col gap-8'
          : 'rounded-[24px] bg-white p-6 flex flex-col gap-6'
      }
    >
      <div className="flex flex-col gap-3">
        <label
          className={
            isDesktop
              ? 'font-display text-2xl font-medium text-black'
              : 'font-display text-xl font-medium text-black'
          }
        >
          Your property price
        </label>
        <div className="flex items-stretch rounded-lg border border-black/10 overflow-hidden">
          <div className="bg-black flex items-center justify-center min-w-[48px] px-3">
            <span className="font-display text-xl text-white">£</span>
          </div>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="2000"
            className="flex-1 font-body text-base text-black/60 outline-none px-3 py-3"
          />
        </div>
      </div>

      <div className="flex items-center justify-between p-4 rounded-xl bg-[#00FF8C]">
        <span className="font-body text-base text-[#040405]">Your price</span>
        <span className="font-body text-base font-bold text-[#040405]">
          £{calculated.toLocaleString()}
        </span>
      </div>

      <div className="flex flex-col gap-4">
        <h4
          className={
            isDesktop
              ? 'font-display text-2xl font-medium text-black'
              : 'font-display text-xl font-medium text-black'
          }
        >
          This includes:
        </h4>
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-black/10">
            <span className="font-body text-sm text-[#040405]">
              All your conveyancing and legal work
            </span>
            <span className="font-body text-sm font-bold text-[#040405] whitespace-nowrap">
              worth £1,610
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-black/10">
            <span className="font-body text-sm text-[#040405]">Property survey</span>
            <span className="font-body text-sm font-bold text-[#040405] whitespace-nowrap">
              worth £432
            </span>
          </div>
        </div>
      </div>

      <button className="self-start rounded-full border border-black px-6 py-3 font-body text-base font-semibold text-[#040405] transition-all hover:bg-black hover:text-white active:scale-95">
        Lock in your quote
      </button>
    </div>
  );
};

export const BuyHome: React.FC = () => {
  const { openModal } = useModal();

  return (
    <div className="flex flex-col w-full bg-white">
      {/* ============================================================ */}
      {/* MOBILE / TABLET LAYOUT (< lg) */}
      {/* ============================================================ */}

      {/* M1. Hero */}
      <section className="lg:hidden relative bg-[#FEFEFE] overflow-hidden py-10 my-0">
        <div className="absolute inset-x-0 top-0 h-[220px] pointer-events-none overflow-hidden [mask-image:linear-gradient(to_bottom,black,transparent)]">
          <div className="flex justify-between items-center w-[130%] -ml-[15%] h-full opacity-70 blur-[90px]">
            <div className="w-[100px] h-[100px] rounded-full bg-[#F2D0B2]" />
            <div className="w-[100px] h-[100px] rounded-full bg-[#E6ECA2]" />
            <div className="w-[100px] h-[100px] rounded-full bg-[#D2F4B9]" />
            <div className="w-[100px] h-[100px] rounded-full bg-[#94E3DC]" />
            <div className="w-[100px] h-[100px] rounded-full bg-[#9BC3F0]" />
          </div>
        </div>

        <div className="relative z-10 px-4 pt-10 pb-12">
          <div className="flex flex-col items-center gap-6 text-center">
            <h1 className="font-display text-[#1F1F1E] text-[38px] font-black leading-[1] tracking-[-0.76px]">
              Buying a home abroad just got a whole lot easier.
            </h1>
            <p className="font-body text-base font-medium text-black leading-[1.4]">
              Everything you need in one, peaceful place
            </p>
            <button
              onClick={() => openModal('create-account')}
              className="w-full h-14 px-5 rounded-[48px] bg-black text-white font-body text-lg font-semibold transition-all hover:bg-black/90 active:scale-95"
            >
              Get started Today
            </button>
          </div>

          <div className="relative mt-12 mb-8 h-[280px]">
            <div className="absolute left-0 top-0 w-[210px] p-4 rounded-[18px] border border-black/10 bg-[#EBFFF6] shadow-[6px_2px_12px_rgba(0,0,0,0.05)] flex flex-col gap-5">
              <div className="self-start px-2.5 py-1 rounded-full bg-[#00BC67]">
                <span className="font-body text-[11px] font-medium text-black">DONE</span>
              </div>
              <p className="font-body text-xs text-black">Property sourced</p>
            </div>

            <div className="absolute left-[40%] top-[90px] w-[200px] p-4 rounded-[18px] border border-black/10 bg-[#FFEBF9] shadow-[6px_2px_12px_rgba(0,0,0,0.05)] flex flex-col gap-5 rotate-[4deg]">
              <div className="self-start px-2.5 py-1 rounded-full bg-[#FFB0E8]">
                <span className="font-body text-[11px] font-medium text-black">IN PROGRESS</span>
              </div>
              <p className="font-body text-xs text-black">Offer made</p>
            </div>

            <div className="absolute left-[10%] top-[180px] w-[210px] p-4 rounded-[18px] border border-black/10 bg-white shadow-[6px_2px_12px_rgba(0,0,0,0.05)] flex flex-col gap-5">
              <div className="self-start px-2.5 py-1 rounded-full bg-black/10">
                <span className="font-body text-[11px] font-medium text-black">COMING UP</span>
              </div>
              <p className="font-body text-xs text-black">Purchase completed</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <img
              src={HOUSE_IMG}
              alt="House"
              className="w-[120px] h-auto object-contain shrink-0"
              referrerPolicy="no-referrer"
            />
            <h2 className="font-display text-[#1F1F1E] text-[26px] font-extralight leading-[1] tracking-[-0.52px] text-right max-w-[260px] ml-auto">
              Track everything in one place, on your dashboard
            </h2>
          </div>
        </div>
      </section>

      {/* M2. What we offer */}
      <section className="lg:hidden bg-[#FFFFFE] px-4 py-10 my-0">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
          <div className="flex flex-col gap-6">
            <h2 className="font-display text-[40px] font-medium leading-[1] tracking-[-0.8px] text-black">
              What we offer
            </h2>
            <p className="font-body text-base text-black leading-[1.4]">
              From search to completion, we provide an end-to-end experience for buying property abroad.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <div className="rounded-2xl bg-[#FBF3EA] p-6 flex flex-col gap-6">
              <div className="self-start px-3 py-2.5 rounded-lg bg-[#FFB0E8]">
                <span className="font-body text-base font-normal text-black">
                  Essential Access — From $2000
                </span>
              </div>
              <h3 className="font-display text-2xl font-medium leading-[1.1] text-[#1F1F1E]">
                Expert mortgage advice & application service Starting from $2000
              </h3>
              <ul className="flex flex-col gap-4">
                {ESSENTIAL_ACCESS.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Check className="w-6 h-6 text-[#00BC67] shrink-0 mt-0.5" strokeWidth={2.5} />
                    <span className="font-body text-base text-black leading-[1.3]">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl bg-[#FBF3EA] p-6 flex flex-col gap-6">
              <div className="self-start px-3 py-2.5 rounded-lg bg-[#602FD3]">
                <span className="font-body text-base font-normal text-white">
                  Essential Plus — Starting from $5000
                </span>
              </div>
              <h3 className="font-display text-2xl font-medium leading-[1.1] text-[#1F1F1E]">
                Property survey, legal work & more
              </h3>
              <ul className="flex flex-col gap-4">
                <li className="flex items-start gap-3">
                  <Check className="w-6 h-6 text-[#00BC67] shrink-0 mt-0.5" strokeWidth={2.5} />
                  <span className="font-body text-base font-bold text-black leading-[1.3]">
                    Everything in Essential Access, plus:
                  </span>
                </li>
                {ESSENTIAL_PLUS.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Check className="w-6 h-6 text-[#00BC67] shrink-0 mt-0.5" strokeWidth={2.5} />
                    <span className="font-body text-base text-black leading-[1.3]">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* M3. How it works */}
      <section
        className="lg:hidden px-4 py-10 my-0"
        style={{ background: 'linear-gradient(180deg, #9BD9FF 0%, #FFB0E8 50%, #FEEAA0 100%)' }}
      >
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-10">
          <div className="flex flex-col items-center gap-4 text-center">
            <h2 className="font-display text-[40px] font-black leading-[1] tracking-[-0.8px] text-black">
              How it works
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
            {STEPS.map((step) => (
              <div
                key={step.title}
                className="rounded-3xl p-6 flex flex-col gap-6 bg-white/30 backdrop-blur-[10px]"
              >
                <h3 className="font-display text-[28px] font-black text-black leading-[1] tracking-[-0.56px]">
                  {step.title}
                </h3>
                <p className="font-body text-base font-semibold text-black/80 leading-[1.4]">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>

          <button
            onClick={() => openModal('create-account')}
            className="mt-2 h-14 px-6 rounded-[48px] bg-black text-white font-body text-lg font-semibold transition-all hover:bg-black/90 active:scale-95"
          >
            Get started Today
          </button>
        </div>
      </section>

      {/* M4. Let's talk fees */}
      <section className="lg:hidden bg-white px-4 py-10 my-0">
        <div className="mx-auto w-full max-w-5xl rounded-[28px] bg-[#040504] p-6 flex flex-col gap-8">
          <div className="flex flex-col gap-5">
            <h2 className="font-display text-[44px] font-medium leading-[1] tracking-[-0.88px] text-white">
              Let's talk fees
            </h2>
            <p className="font-body text-base text-white leading-[1.5]">
              Our cost depends on your property price, but the fees start from around £2,000.
            </p>
          </div>
          <FeesPanel variant="mobile" />
        </div>
      </section>

      {/* ============================================================ */}
      {/* DESKTOP LAYOUT (lg+) — Figma replica */}
      {/* ============================================================ */}

      {/* D1. Hero */}
      <section className="hidden lg:block relative bg-[#FEFEFE] overflow-hidden">
        {/* Blurred colored ellipses strip at top */}
        <div className="absolute top-[-35px] left-1/2 -translate-x-1/2 w-[1226px] h-[284px] pointer-events-none z-0">
          <div className="flex justify-between items-center w-full h-full blur-[125px] opacity-60">
            <div className="w-[284px] h-[284px] rounded-full bg-[#F2D0B2]" />
            <div className="w-[284px] h-[284px] rounded-full bg-[#E6ECA2]" />
            <div className="w-[284px] h-[284px] rounded-full bg-[#D2F4B9]" />
            <div className="w-[284px] h-[284px] rounded-full bg-[#FFB0E6]" />
            <div className="w-[284px] h-[284px] rounded-full bg-[#9BC3F0]" />
          </div>
        </div>

        <div className="relative z-10 mx-auto w-full max-w-[1440px] px-[100px] pt-[105px] pb-0 min-h-[880px]">
          {/* Headline block */}
          <div className="flex flex-col items-center gap-6 text-center">
            <h1 className="font-display text-[#1F1F1E] text-[88px] font-black leading-[0.95] tracking-[-1.76px] max-w-[1144px]">
              Buying a home abroad just got a whole lot easier.
            </h1>
            <p className="font-body text-lg text-black leading-[1.4]">
              Everything you need in one, peaceful place
            </p>
            <button
              onClick={() => openModal('create-account')}
              className="h-14 px-8 rounded-[48px] bg-black text-white font-body text-lg font-semibold transition-all hover:bg-black/90 active:scale-95"
            >
              Get started Today
            </button>
          </div>

          {/* Floating status cards (fixed-width design canvas) */}
          <div className="relative mx-auto mt-10 h-[280px]" style={{ width: '1240px', maxWidth: '100%' }}>
            {/* Card 1: DONE — top-left */}
            <div className="absolute left-[2%] top-0 w-[300px] p-6 flex flex-col gap-6 rounded-[28px] border border-black/10 bg-[#EBFFF6] shadow-[10px_4px_20px_rgba(0,0,0,0.05)]">
              <div className="self-start px-4 py-2 rounded-full bg-[#00BC67]">
                <span className="font-body text-sm font-medium text-black">DONE</span>
              </div>
              <p className="font-body text-base text-black">Property sourced</p>
            </div>

            {/* Card 2: IN PROGRESS — rotated, middle-left */}
            <div className="absolute left-[26%] top-[120px] w-[310px] p-6 flex flex-col gap-6 rounded-[28px] border border-black/10 bg-[#FFEBF9] shadow-[10px_4px_20px_rgba(0,0,0,0.05)] rotate-[4deg] z-10">
              <div className="self-start px-4 py-2.5 rounded-full bg-[#FFB0E8]">
                <span className="font-body text-sm font-medium text-black">IN PROGRESS</span>
              </div>
              <p className="font-body text-base text-black">Offer made</p>
            </div>

            {/* Card 3: COMING UP — Purchase completed */}
            <div className="absolute left-[52%] top-[90px] w-[300px] p-6 flex flex-col gap-6 rounded-[28px] border border-black/10 bg-white shadow-[10px_4px_20px_rgba(0,0,0,0.05)]">
              <div className="self-start px-4 py-2 rounded-full bg-black/10">
                <span className="font-body text-sm font-medium text-black">COMING UP</span>
              </div>
              <p className="font-body text-base text-black">Purchase completed</p>
            </div>

            {/* Card 4: COMING UP — Get the keys! */}
            <div className="absolute right-[1%] top-[-10px] w-[300px] p-6 flex flex-col gap-6 rounded-[28px] border border-black/10 bg-white shadow-[10px_4px_20px_rgba(0,0,0,0.05)]">
              <div className="self-start px-4 py-2 rounded-full bg-black/10">
                <span className="font-body text-sm font-medium text-black">COMING UP</span>
              </div>
              <p className="font-body text-base text-black">Get the keys!</p>
            </div>
          </div>

          {/* Bottom row: house image + dashboard text */}
          <div className="relative flex justify-between items-end mt-2 pb-0">
            <img
              src={HOUSE_IMG}
              alt="House"
              className="w-[447px] h-auto object-contain"
              referrerPolicy="no-referrer"
            />
            <h2 className="font-display text-[#1F1F1E] text-[80px] font-extralight leading-[0.95] tracking-[-1.6px] text-right max-w-[700px] pb-6">
              Track everything in one place, on your dashboard
            </h2>
          </div>
        </div>
      </section>

      {/* D2. What we offer */}
      <section className="hidden lg:block bg-[#FFFFFE]">
        <div className="mx-auto w-full max-w-[1440px] px-[100px] py-20">
          <div className="flex justify-between items-start gap-12">
            {/* Left: title + description */}
            <div className="flex flex-col gap-6 w-[481px] shrink-0 pt-2">
              <h2 className="font-display text-[80px] font-medium leading-[0.95] tracking-[-1.6px] text-black">
                What we offer
              </h2>
              <p className="font-body text-lg text-black leading-[1.4] max-w-[420px]">
                From search to completion, we provide an end-to-end experience for buying property abroad.
              </p>
            </div>

            {/* Right: two cream cards */}
            <div className="flex gap-6 flex-1">
              {/* Essential Access */}
              <div className="rounded-2xl bg-[#FBF3EA] p-6 flex flex-col gap-6 flex-1 max-w-[352px]">
                <div className="self-start px-3 py-2.5 rounded-lg bg-[#FFB0E8]">
                  <span className="font-body text-base font-normal text-black">
                    Essential Access — From $2000
                  </span>
                </div>
                <h3 className="font-display text-2xl font-medium leading-[1.15] text-[#1F1F1E]">
                  Expert mortgage advice & application service Starting from $2000
                </h3>
                <ul className="flex flex-col gap-4">
                  {ESSENTIAL_ACCESS.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <Check className="w-6 h-6 text-[#00BC67] shrink-0 mt-0.5" strokeWidth={2.5} />
                      <span className="font-body text-base text-black leading-[1.3]">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Essential Plus */}
              <div className="rounded-2xl bg-[#FBF3EA] p-6 flex flex-col gap-6 flex-1 max-w-[352px]">
                <div className="self-start px-3 py-2.5 rounded-lg bg-[#602FD3]">
                  <span className="font-body text-base font-normal text-white">
                    Essential Plus — Starting from $5000
                  </span>
                </div>
                <h3 className="font-display text-2xl font-medium leading-[1.15] text-[#1F1F1E]">
                  Property survey, legal work & more
                </h3>
                <ul className="flex flex-col gap-4">
                  <li className="flex items-start gap-3">
                    <Check className="w-6 h-6 text-[#00BC67] shrink-0 mt-0.5" strokeWidth={2.5} />
                    <span className="font-body text-base font-bold text-black leading-[1.3]">
                      Everything in Essential Access, plus:
                    </span>
                  </li>
                  {ESSENTIAL_PLUS.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <Check className="w-6 h-6 text-[#00BC67] shrink-0 mt-0.5" strokeWidth={2.5} />
                      <span className="font-body text-base text-black leading-[1.3]">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* D3. How it works — zigzag with curved connector line */}
      <section
        id="how-it-works"
        className="hidden lg:block scroll-mt-20"
        style={{ background: 'linear-gradient(180deg, #9BD9FF 0%, #FFB0E8 50%, #FEEAA0 100%)' }}
      >
        <div className="mx-auto w-full max-w-[1440px] px-[100px] pt-24 pb-20">
          <div className="flex flex-col items-center gap-3 text-center">
            <h2 className="font-display text-[80px] font-black leading-[0.95] tracking-[-1.6px] text-black">
              How it works
            </h2>
          </div>

          {/* Zigzag steps with center curved line */}
          <div className="relative mt-16 mx-auto w-full max-w-[1240px] h-[1320px]">
            {/* SVG snake connecting all 6 cards — spans full container so we can
                anchor dots exactly at each card's inner edge & vertical centre.
                Card centres (y): 104.5, 304.5, 544.5, 744.5, 984.5, 1184.5
                Left-card right edge x = 479, right-card left edge x = 719.
                Each cubic uses vertical control handles for a smooth S-snake. */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 1240 1320"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="none"
            >
              <path
                d="M 479 104.5
                   C 479 204.5, 719 204.5, 719 304.5
                   C 719 404.5, 479 444.5, 479 544.5
                   C 479 644.5, 719 644.5, 719 744.5
                   C 719 844.5, 479 884.5, 479 984.5
                   C 479 1084.5, 719 1084.5, 719 1184.5"
                stroke="#1F1F1E"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
              />
              <circle cx="479" cy="104.5" r="14" fill="#1F1F1E" />
              <circle cx="719" cy="304.5" r="14" fill="#1F1F1E" />
              <circle cx="479" cy="544.5" r="14" fill="#1F1F1E" />
              <circle cx="719" cy="744.5" r="14" fill="#1F1F1E" />
              <circle cx="479" cy="984.5" r="14" fill="#1F1F1E" />
              <circle cx="719" cy="1184.5" r="14" fill="#1F1F1E" />
            </svg>

            {/* Step 1: Bespoke Consultation — top left */}
            <div className="absolute left-0 top-0 w-[479px] h-[209px] rounded-2xl bg-white p-10 flex flex-col gap-4 shadow-sm">
              <h3 className="font-display text-[32px] font-black text-black leading-[1] tracking-[-0.64px]">
                {STEPS[0].title}
              </h3>
              <p className="font-body text-xl font-semibold text-black leading-[1.25]">
                {STEPS[0].desc}
              </p>
            </div>

            {/* Step 2: Property Positioning & Valuation — right, slightly lower */}
            <div className="absolute right-0 top-[200px] w-[521px] h-[209px] rounded-2xl bg-white p-10 flex flex-col gap-4 shadow-sm">
              <h3 className="font-display text-[32px] font-black text-black leading-[1] tracking-[-0.64px]">
                {STEPS[1].title}
              </h3>
              <p className="font-body text-xl font-semibold text-black leading-[1.25]">
                {STEPS[1].desc}
              </p>
            </div>

            {/* Step 3: Local Expert Representation — left */}
            <div className="absolute left-0 top-[440px] w-[479px] h-[209px] rounded-2xl bg-white p-10 flex flex-col gap-4 shadow-sm">
              <h3 className="font-display text-[32px] font-black text-black leading-[1] tracking-[-0.64px]">
                {STEPS[2].title}
              </h3>
              <p className="font-body text-xl font-semibold text-black leading-[1.25]">
                {STEPS[2].desc}
              </p>
            </div>

            {/* Step 4: Marketing & Buyer Management — right */}
            <div className="absolute right-0 top-[640px] w-[521px] h-[209px] rounded-2xl bg-white p-10 flex flex-col gap-4 shadow-sm">
              <h3 className="font-display text-[32px] font-black text-black leading-[1] tracking-[-0.64px]">
                {STEPS[3].title}
              </h3>
              <p className="font-body text-xl font-semibold text-black leading-[1.25]">
                {STEPS[3].desc}
              </p>
            </div>

            {/* Step 5: Offer Negotiation & Sale Progression — left */}
            <div className="absolute left-0 top-[880px] w-[479px] h-[209px] rounded-2xl bg-white p-10 flex flex-col gap-4 shadow-sm">
              <h3 className="font-display text-[32px] font-black text-black leading-[1] tracking-[-0.64px]">
                {STEPS[4].title}
              </h3>
              <p className="font-body text-xl font-semibold text-black leading-[1.25]">
                {STEPS[4].desc}
              </p>
            </div>

            {/* Step 6: Completion & Post-Sale Support — right */}
            <div className="absolute right-0 top-[1080px] w-[521px] h-[209px] rounded-2xl bg-white p-10 flex flex-col gap-4 shadow-sm">
              <h3 className="font-display text-[32px] font-black text-black leading-[1] tracking-[-0.64px]">
                {STEPS[5].title}
              </h3>
              <p className="font-body text-xl font-semibold text-black leading-[1.25]">
                {STEPS[5].desc}
              </p>
            </div>
          </div>

          {/* Get started button at bottom */}
          <div className="mt-20 flex justify-center">
            <button
              onClick={() => openModal('create-account')}
              className="h-14 px-8 rounded-[48px] bg-black text-white font-body text-lg font-semibold transition-all hover:bg-black/90 active:scale-95"
            >
              Get started Today
            </button>
          </div>
        </div>
      </section>

      {/* D4. Let's talk fees */}
      <section className="hidden lg:block bg-white">
        <div className="mx-auto w-full max-w-[1440px] px-[100px] py-20">
          <div className="rounded-[28px] bg-[#040504] p-10 flex gap-12 items-stretch">
            {/* Left: title + description */}
            <div className="flex flex-col gap-6 w-[396px] shrink-0 justify-start pt-2">
              <h2 className="font-display text-[88px] font-medium leading-[0.95] tracking-[-1.76px] text-white">
                Let's talk fees
              </h2>
              <p className="font-body text-lg text-white leading-[1.5] max-w-[360px]">
                Our cost depends on your property price, but the fees start from around £2,000.
              </p>
            </div>
            {/* Right: white form panel */}
            <div className="flex-1">
              <FeesPanel variant="desktop" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
