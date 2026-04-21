import React from 'react';
import { Check, ArrowRight, Circle } from 'lucide-react';
import { motion } from 'motion/react';
import { useModal } from '../hooks/useModal';

export const BuyHome: React.FC = () => {
  const { openModal } = useModal();
  return (
    <div className="flex flex-col w-full bg-white">
      {/* ===================== MOBILE (< md) ===================== */}
      {/* M1. Hero — white BG, blurred colored circles, floating status cards */}
      <section className="md:hidden relative bg-[#FEFEFE] overflow-hidden">
        {/* Blurred colored gradient circles strip at top */}
        <div className="absolute inset-x-0 top-0 h-[140px] pointer-events-none overflow-hidden">
          <div className="flex justify-between items-center w-[120%] -ml-[10%] h-full opacity-60 blur-[60px]">
            <div className="w-[100px] h-[100px] rounded-full bg-[#F2D0B2]" />
            <div className="w-[100px] h-[100px] rounded-full bg-[#E6ECA2]" />
            <div className="w-[100px] h-[100px] rounded-full bg-[#D2F4B9]" />
            <div className="w-[100px] h-[100px] rounded-full bg-[#94E3DC]" />
            <div className="w-[100px] h-[100px] rounded-full bg-[#9BC3F0]" />
          </div>
        </div>

        <div className="relative z-10 px-4 pt-10 pb-12">
          {/* Headline block */}
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

          {/* Floating status cards stacked / overlapping */}
          <div className="relative mt-12 mb-8 h-[280px]">
            {/* Card 1: DONE */}
            <div className="absolute left-0 top-0 w-[210px] p-4 rounded-[18px] border border-black/10 bg-[#EBFFF6] shadow-[6px_2px_12px_rgba(0,0,0,0.05)] flex flex-col gap-5">
              <div className="self-start px-2.5 py-1 rounded-full bg-[#00BC67]">
                <span className="font-body text-[11px] font-medium text-black">DONE</span>
              </div>
              <p className="font-body text-xs text-black">Property sourced</p>
            </div>

            {/* Card 2: IN PROGRESS, rotated */}
            <div className="absolute left-[40%] top-[90px] w-[200px] p-4 rounded-[18px] border border-black/10 bg-[#FFEBF9] shadow-[6px_2px_12px_rgba(0,0,0,0.05)] flex flex-col gap-5 rotate-[4deg]">
              <div className="self-start px-2.5 py-1 rounded-full bg-[#FFB0E8]">
                <span className="font-body text-[11px] font-medium text-black">IN PROGRESS</span>
              </div>
              <p className="font-body text-xs text-black">Offer made</p>
            </div>

            {/* Card 3: COMING UP */}
            <div className="absolute left-[10%] top-[180px] w-[210px] p-4 rounded-[18px] border border-black/10 bg-white shadow-[6px_2px_12px_rgba(0,0,0,0.05)] flex flex-col gap-5">
              <div className="self-start px-2.5 py-1 rounded-full bg-black/10">
                <span className="font-body text-[11px] font-medium text-black">COMING UP</span>
              </div>
              <p className="font-body text-xs text-black">Purchase completed</p>
            </div>
          </div>

          {/* House icon + Track everything text */}
          <div className="flex items-start gap-4">
            <img
              src="https://api.builder.io/api/v1/image/assets/TEMP/1d39f7bca27c7f8b2a16a58e41c532146fcabcf1?width=894"
              alt="House"
              className="w-[120px] h-auto object-contain shrink-0"
              referrerPolicy="no-referrer"
            />
            <h2 className="font-display text-[#1F1F1E] text-[26px] font-extralight leading-[1] tracking-[-0.52px]">
              Track everything in one place, on your dashboard
            </h2>
          </div>
        </div>
      </section>

      {/* M2. What we offer — white BG, two cream cards */}
      <section className="md:hidden bg-[#FFFFFE] px-4 py-10">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-6">
            <h2 className="font-display text-[40px] font-medium leading-[1] tracking-[-0.8px] text-black">
              What we offer
            </h2>
            <p className="font-body text-base text-black leading-[1.4]">
              From search to completion, we provide an end-to-end experience for buying property abroad.
            </p>
          </div>

          {/* Essential Access — cream BG, pink tag */}
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
              {[
                'Property search and shortlisting support',
                'Guidance on international ownership options',
                'Country-specific buying process overview',
                'Access to vetted local agents and partners',
                'Document checklist and timeline planning',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <Check className="w-6 h-6 text-[#00BC67] shrink-0 mt-0.5" strokeWidth={2.5} />
                  <span className="font-body text-base text-black leading-[1.3]">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Essential Plus — cream BG, purple tag */}
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
              {[
                'End-to-end purchase coordination',
                'Negotiation and offer support',
                'Legal, tax, and financing guidance (via local experts)',
                'Ongoing liaison with agents, lawyers, and developers',
                'Support through completion and handover',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <Check className="w-6 h-6 text-[#00BC67] shrink-0 mt-0.5" strokeWidth={2.5} />
                  <span className="font-body text-base text-black leading-[1.3]">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* M3. How it works — blue→pink→yellow gradient, frosted cards */}
      <section
        className="md:hidden px-4 py-12"
        style={{
          background: 'linear-gradient(180deg, #9BD9FF 0%, #FFB0E8 50%, #FEEAA0 100%)',
        }}
      >
        <div className="flex flex-col items-center gap-10">
          <div className="flex flex-col items-center gap-4 text-center">
            <h2 className="font-display text-[40px] font-black leading-[1] tracking-[-0.8px] text-black">
              How it works
            </h2>
            <p className="font-body text-base font-medium text-black/60">
              What's your situation?
            </p>
          </div>

          {/* Toggle */}
          <div className="flex flex-col gap-3 w-full">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-white border border-black/10">
              <Circle className="w-6 h-6 text-black/40" strokeWidth={1.5} />
              <span className="font-body text-base font-medium text-black/80">I'm buying</span>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-black border-2 border-[#D46444]">
              <div className="w-6 h-6 rounded-full bg-[#00BC67] flex items-center justify-center">
                <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
              </div>
              <span className="font-body text-base font-medium text-white">
                I'm buying and selling
              </span>
            </div>
          </div>

          {/* Step cards (frosted glass) */}
          <div className="flex flex-col gap-6 w-full">
            {[
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
            ].map((step) => (
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

      {/* M4. Let's talk fees — dark card with white form inside */}
      <section className="md:hidden bg-white px-4 py-10">
        <div className="rounded-[28px] bg-[#040504] p-6 flex flex-col gap-8">
          <div className="flex flex-col gap-5">
            <h2 className="font-display text-[44px] font-medium leading-[1] tracking-[-0.88px] text-white">
              Let's talk fees
            </h2>
            <p className="font-body text-base text-white leading-[1.5]">
              Our cost depends on your property price, but the fees start from around £2,000.
            </p>
          </div>

          <div className="rounded-[24px] bg-white p-6 flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <label className="font-display text-xl font-medium text-black">
                Your property price
              </label>
              <div className="flex items-stretch rounded-lg border border-black/10 overflow-hidden">
                <div className="bg-black flex items-center justify-center min-w-[44px] px-3">
                  <span className="font-display text-xl text-white">£</span>
                </div>
                <input
                  type="text"
                  defaultValue="2000"
                  className="flex-1 font-body text-base text-black/60 outline-none px-3 py-2.5"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#00FF8C]">
              <span className="font-body text-base text-[#040405]">Your price</span>
              <span className="font-body text-base font-bold text-[#040405]">£2,600</span>
            </div>

            <div className="flex flex-col gap-4">
              <h4 className="font-display text-xl font-medium text-black">This includes:</h4>
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
        </div>
      </section>

      {/* ===================== DESKTOP (>= md) ===================== */}
      {/* 1. Hero Section */}
      <section className="hidden md:block relative w-full min-h-[960px] bg-[#FEFEFE] overflow-hidden">
        {/* Blurred Background Circles */}
        <div className="absolute top-[-35px] left-[107px] w-[1226px] h-[284px] blur-[125px] opacity-50 pointer-events-none z-0">
          <div className="flex justify-between items-center w-full h-full">
            <div className="w-[284px] h-[284px] rounded-full bg-[#F2D0B2]" />
            <div className="w-[284px] h-[284px] rounded-full bg-[#E6ECA2]" />
            <div className="w-[284px] h-[284px] rounded-full bg-[#D2F4B9]" />
            <div className="w-[284px] h-[284px] rounded-full bg-[#FFB0E6]" />
            <div className="w-[284px] h-[284px] rounded-full bg-[#9BC3F0]" />
          </div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center">
          <h1 className="max-w-[1000px] font-display text-[62px] md:text-[88px] font-black leading-[1] tracking-[-1.76px] text-[#1F1F1E]">
            Buying a home abroad just got a whole lot easier.
          </h1>
          <p className="mt-8 font-body text-lg md:text-xl text-black/80">
            Everything you need in one, peaceful place
          </p>
          <button 
            onClick={() => openModal('create-account')}
            className="mt-10 rounded-full bg-black px-8 py-4 font-body text-lg font-semibold text-white transition-all hover:bg-black/90 active:scale-95"
          >
            Get Started
          </button>

          {/* Floating Status Cards */}
          <div className="relative w-full mt-14 h-[400px]">
            {/* Done Card */}
            <div className="absolute left-[5%] top-[2%] w-[353px] p-10 flex flex-col gap-8 rounded-[32px] border border-black/10 bg-[#EBFFF6] shadow-[10px_4px_20px_0_rgba(0,0,0,0.05)]">
              <div className="flex items-center justify-center w-fit px-3 py-1.5 rounded-full bg-[#00BC67]">
                <span className="font-body text-sm font-medium text-black">DONE</span>
              </div>
              <p className="font-body text-lg text-black">Property sourced</p>
            </div>

            {/* In Progress Card */}
            <div className="absolute left-[25%] top-[20%] w-[353px] p-10 flex flex-col gap-8 rounded-[32px] border border-black/10 bg-[#FFEBF9] shadow-[10px_4px_20px_0_rgba(0,0,0,0.05)] rotate-[4deg]">
              <div className="flex items-center justify-center w-fit px-3 py-1.5 rounded-full bg-[#FFB0E8]">
                <span className="font-body text-sm font-medium text-black">IN PROGRESS</span>
              </div>
              <p className="font-body text-lg text-black">Offer made</p>
            </div>

            {/* Coming Up Card 1 */}
            <div className="absolute left-[45%] top-[25%] w-[353px] p-10 flex flex-col gap-8 rounded-[32px] border border-black/10 bg-white shadow-[10px_4px_20px_0_rgba(0,0,0,0.05)]">
              <div className="flex items-center justify-center w-fit px-3 py-1.5 rounded-full bg-black/10">
                <span className="font-body text-sm font-medium text-black">COMING UP</span>
              </div>
              <p className="font-body text-lg text-black">Purchase completed</p>
            </div>

            {/* Coming Up Card 2 */}
            <div className="absolute right-[5%] top-[3%] w-[353px] p-10 flex flex-col gap-8 rounded-[32px] border border-black/10 bg-white shadow-[10px_4px_20px_0_rgba(0,0,0,0.05)]">
              <div className="flex items-center justify-center w-fit px-3 py-1.5 rounded-full bg-black/10">
                <span className="font-body text-sm font-medium text-black">COMING UP</span>
              </div>
              <p className="font-body text-lg text-black">Get the keys!</p>
            </div>
          </div>

          {/* Dashboard Text & House Image */}
          <div className="relative w-full flex justify-between items-end mt-[-50px]">
            <img 
              src="https://api.builder.io/api/v1/image/assets/TEMP/1d39f7bca27c7f8b2a16a58e41c532146fcabcf1?width=894" 
              alt="House" 
              className="w-[447px] h-auto object-contain"
              referrerPolicy="no-referrer"
            />
            <h2 className="max-w-[700px] font-display text-[64px] md:text-[88px] font-extralight leading-[1] tracking-[-1.76px] text-[#1F1F1E] text-right">
              Track everything in one place, on your dashboard
            </h2>
          </div>
        </div>
      </section>

      {/* 2. What we offer Section */}
      <section className="w-full bg-[#FFFFFE] py-1 md:py-[84px] px-4 sm:px-10 lg:px-[100px]">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-12 items-start">
          <div className="lg:w-1/3 flex flex-col gap-10">
            <h2 className="font-display text-[64px] md:text-[80px] font-medium leading-[1] tracking-[-1.6px] text-black">
              What we offer
            </h2>
            <p className="font-body text-lg md:text-xl text-black leading-[1.7]">
              From search to completion, we provide an end-to-end experience for buying property abroad.
            </p>
          </div>

          <div className="lg:w-2/3 flex flex-col md:flex-row gap-6">
            {/* Essential Access Card */}
            <div className="flex-1 rounded-2xl bg-[#FBF3EA] p-6 md:p-8 flex flex-col gap-6 overflow-hidden">
              <div className="w-fit px-4 py-2 rounded-lg bg-[#FFB0E8]">
                <span className="font-body text-lg text-black">Essential Access- From $2000</span>
              </div>
              <h3 className="font-display text-2xl font-medium leading-[1] text-[#1F1F1E]">
                Expert mortgage advice & application service Starting from $2000
              </h3>
              <ul className="flex flex-col gap-4">
                {[
                  "Property search and shortlisting support",
                  "Guidance on international ownership options",
                  "Country-specific buying process overview",
                  "Access to vetted local agents and partners",
                  "Document checklist and timeline planning"
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className="w-6 h-6 text-[#00BC67] shrink-0" />
                    <span className="font-body text-lg text-black leading-[1.2]">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Essential Plus Card */}
            <div className="flex-1 rounded-2xl bg-[#FBF3EA] p-6 md:p-8 flex flex-col gap-6 overflow-hidden">
              <div className="w-fit px-4 py-2 rounded-lg bg-[#602FD3]">
                <span className="font-body text-lg text-white">Essential Plus- Starting from $5000</span>
              </div>
              <h3 className="font-display text-2xl font-medium leading-[1] text-[#1F1F1E]">
                Property survey, legal work & more
              </h3>
              <ul className="flex flex-col gap-4">
                <li className="flex items-start gap-3">
                  <Check className="w-6 h-6 text-[#00BC67] shrink-0" />
                  <span className="font-body text-lg text-black leading-[1.2] font-bold">Everything in Essential Access, plus:</span>
                </li>
                {[
                  "End-to-end purchase coordination",
                  "Negotiation and offer support",
                  "Legal, tax, and financing guidance (via local experts)",
                  "Ongoing liaison with agents, lawyers, and developers",
                  "Support through completion and handover"
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className="w-6 h-6 text-[#00BC67] shrink-0" />
                    <span className="font-body text-lg text-black leading-[1.2]">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 3. How it works Section */}
      <section className="w-full py-1 md:py-24 px-4 sm:px-10 lg:px-[100px] bg-gradient-to-b from-[#9BD9FF] via-[#FFB0E8] to-[#FFB0E8]/50 overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-col items-center text-center gap-12">
          <div className="flex flex-col gap-4">
            <h2 className="font-display text-[64px] md:text-[80px] font-black leading-[1] tracking-[-1.6px] text-black">
              How it works
            </h2>
            <p className="font-body text-lg font-medium text-black/60">
              What's your situation?
            </p>
          </div>

          {/* Toggle */}
          <div className="flex flex-col md:flex-row gap-6 w-full max-w-[800px]">
            <div className="flex-1 flex items-center gap-3 p-4 rounded-xl border border-black/10 bg-white">
              <div className="w-6 h-6 rounded-full border-2 border-black/20" />
              <span className="font-body text-base font-semibold text-black/60">I'm buying</span>
            </div>
            <div className="flex-1 flex items-center gap-3 p-4 rounded-xl border-2 border-[#D46444] bg-black">
              <div className="w-6 h-6 rounded-full bg-[#00BC67] flex items-center justify-center">
                <Check className="w-4 h-4 text-white" strokeWidth={3} />
              </div>
              <span className="font-body text-base font-semibold text-white">I'm buying and selling</span>
            </div>
          </div>

          {/* Timeline */}
          <div className="relative w-full max-w-5xl mt-20" style={{ minHeight: '1120px' }}>

            {/* SVG — z-index 10 so dots sit ON TOP of cards */}
            <div className="absolute left-1/2 -translate-x-1/2 top-0 pointer-events-none" style={{ zIndex: 10 }}>
              <svg width="239" height="1054" viewBox="0 0 239 1054" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10.0004 19C10.0004 19 185.281 63.7254 221.5 155C272.616 283.814 3.63292 313.572 25.0004 450.5C42.516 562.745 240.004 552.914 221.5 665C204.915 765.468 33.001 718.304 10.0004 817.5C-18.3503 939.77 184.5 1032.5 184.5 1032.5" stroke="black" strokeWidth="2"/>
                <circle cx="10" cy="19" r="18" fill="black"/>
                <circle cx="221.5" cy="155" r="18" fill="black"/>
                <circle cx="25" cy="450.5" r="18" fill="black"/>
                <circle cx="221.5" cy="665" r="18" fill="black"/>
                <circle cx="10" cy="817.5" r="18" fill="black"/>
                <circle cx="184.5" cy="1032.5" r="18" fill="black"/>
              </svg>
            </div>

            {/* Step 1 — Left, dot cy=19 */}
            <div className="absolute p-8 rounded-[24px] bg-white/30 backdrop-blur-[10px] flex flex-col gap-4 text-left"
                style={{ top: 0, left: 0, width: '44%', zIndex: 1 }}>
              <h3 className="font-display text-2xl font-black leading-tight text-black">Bespoke Consultation</h3>
              <p className="font-body text-lg font-semibold text-black/80 leading-snug">
                We begin with a personalised consultation to understand your property, goals, timeline, and target market.
              </p>
            </div>

            {/* Step 2 — Right, dot cy=155 */}
            <div className="absolute p-8 rounded-[24px] bg-white/30 backdrop-blur-[10px] flex flex-col gap-4 text-left"
                style={{ top: 125, right: 0, width: '44%', zIndex: 1 }}>
              <h3 className="font-display text-2xl font-black leading-tight text-black">Property Positioning & Valuation</h3>
              <p className="font-body text-lg font-semibold text-black/80 leading-snug">
                We assess market value and advise on pricing, positioning, and any preparation needed to maximise appeal.
              </p>
            </div>

            {/* Step 3 — Left, dot cy=450.5 */}
            <div className="absolute p-8 rounded-[24px] bg-white/30 backdrop-blur-[10px] flex flex-col gap-4 text-left"
                style={{ top: 415, left: 0, width: '44%', zIndex: 1 }}>
              <h3 className="font-display text-2xl font-black leading-tight text-black">Local Expert Representation</h3>
              <p className="font-body text-lg font-semibold text-black/80 leading-snug">
                We appoint vetted local agents, legal, and tax professionals to manage the sale in-market.
              </p>
            </div>

            {/* Step 4 — Right, dot cy=665 */}
            <div className="absolute p-8 rounded-[24px] bg-white/30 backdrop-blur-[10px] flex flex-col gap-4 text-left"
                style={{ top: 630, right: 0, width: '44%', zIndex: 1 }}>
              <h3 className="font-display text-2xl font-black leading-tight text-black">Marketing & Buyer Management</h3>
              <p className="font-body text-lg font-semibold text-black/80 leading-snug">
                Your property is marketed to qualified buyers, with viewings, enquiries, and offers handled on your behalf.
              </p>
            </div>

            {/* Step 5 — Left, dot cy=817.5 */}
            <div className="absolute p-8 rounded-[24px] bg-white/30 backdrop-blur-[10px] flex flex-col gap-4 text-left"
                style={{ top: 785, left: 0, width: '44%', zIndex: 1 }}>
              <h3 className="font-display text-2xl font-black leading-tight text-black">Offer Negotiation & Sale Progression</h3>
              <p className="font-body text-lg font-semibold text-black/80 leading-snug">
                We support negotiations and oversee contracts, due diligence, and buyer coordination through to exchange.
              </p>
            </div>

            {/* Step 6 — Right, dot cy=1032.5 */}
            <div className="absolute p-8 rounded-[24px] bg-white/30 backdrop-blur-[10px] flex flex-col gap-4 text-left"
                style={{ top: 1000, right: 0, width: '44%', zIndex: 1 }}>
              <h3 className="font-display text-2xl font-black leading-tight text-black">Completion & Post-Sale Support</h3>
              <p className="font-body text-lg font-semibold text-black/80 leading-snug">
                We guide you through completion and provide post-sale support, including fund transfers and reinvestment options.
              </p>
            </div>

          </div>

          <button 
            onClick={() => openModal('create-account')}
            className="mt-20 rounded-full bg-black px-8 py-4 font-body text-lg font-semibold text-white transition-all hover:bg-black/90 active:scale-95"
          >
            Get Started
          </button>
        </div>
      </section>

      {/* 4. Let's talk fees Section */}
      <section className="w-full bg-[#FFFFFE] py-1 md:py-24 px-4 sm:px-10 lg:px-[100px]">
        <div className="max-w-7xl mx-auto rounded-[32px] bg-[#040504] p-10 lg:p-20 flex flex-col lg:flex-row gap-16 items-center">
          <div className="lg:w-1/2 flex flex-col gap-10">
            <h2 className="font-display text-[64px] md:text-[88px] font-medium leading-[1] tracking-[-1.76px] text-white">
              Let's talk fees
            </h2>
            <p className="font-body text-lg md:text-xl text-white leading-[1.7]">
              Our cost depends on your property price, but the fees start from around £2,000.
            </p>
          </div>

          <div className="lg:w-1/2 w-full max-w-[600px] rounded-[32px] bg-white p-10 flex flex-col gap-10">
            <div className="flex flex-col gap-4">
              <label className="font-display text-2xl font-medium text-black">Your property price</label>
              <div className="flex items-center gap-4 rounded-lg border border-black/10 overflow-hidden">
                <div className="bg-black p-3 flex items-center justify-center min-w-[48px]">
                  <span className="font-display text-2xl text-white">£</span>
                </div>
                <input 
                  type="text" 
                  defaultValue="2000" 
                  className="w-full font-body text-lg text-black/50 outline-none py-2 px-4"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-[#00FF8C]">
              <span className="font-body text-lg text-[#040405]">Your price</span>
              <span className="font-body text-lg font-bold text-[#040405]">£2,600</span>
            </div>

            <div className="flex flex-col gap-6">
              <h4 className="font-display text-2xl font-medium text-black">This includes:</h4>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between p-4 rounded-xl bg-black/10">
                  <span className="font-body text-lg text-[#040405]">All your conveyancing and legal work</span>
                  <span className="font-body text-lg font-bold text-[#040405]">worth £1,610</span>
                </div>
                <div className="flex items-center justify-between p-4 rounded-xl bg-black/10">
                  <span className="font-body text-lg text-[#040405]">Property survey</span>
                  <span className="font-body text-lg font-bold text-[#040405]">worth £432</span>
                </div>
              </div>
            </div>

            <button className="w-fit rounded-full border border-black px-8 py-4 font-body text-lg font-semibold text-[#040405] transition-all hover:bg-black hover:text-white active:scale-95">
              Lock in your quote
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
