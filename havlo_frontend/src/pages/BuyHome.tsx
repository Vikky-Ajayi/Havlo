import React from 'react';
import { Check, ArrowRight, Circle } from 'lucide-react';
import { motion } from 'motion/react';
import { useModal } from '../hooks/useModal';

export const BuyHome: React.FC = () => {
  const { openModal } = useModal();
  return (
    <div className="flex flex-col w-full bg-white">
      {/* ===================== MOBILE (< md) ===================== */}
      {/* M1. Hero */}
      <section className="md:hidden relative bg-gradient-to-b from-[#FFB0E8] via-[#FFD7B5] to-[#FEEAA0] px-6 pt-12 pb-14">
        <div className="flex flex-col items-center text-center gap-6">
          <h1 className="font-display font-black tracking-[-1.2px] text-[#1F1F1E] text-[34px] leading-[1.05]">
            Buying a home abroad just got a whole lot easier.
          </h1>
          <p className="font-body text-base text-black/80 max-w-[300px]">
            Everything we charge, all in one peaceful place
          </p>
          <button
            onClick={() => openModal('create-account')}
            className="h-12 px-7 rounded-full bg-black text-white font-body text-base font-semibold transition-all hover:bg-black/90 active:scale-95"
          >
            Get Started Today
          </button>

          <div className="mt-6 flex items-center gap-3 self-stretch">
            <div className="shrink-0 w-11 h-11 rounded-2xl bg-[#A409D2] flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white">
                <path d="M3 11.5L12 4l9 7.5V20a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1v-8.5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="font-display font-bold text-[#1F1F1E] text-lg leading-tight text-left">
              Track everything in one place, on your dashboard
            </p>
          </div>
        </div>
      </section>

      {/* M2. What we offer */}
      <section className="md:hidden bg-white px-6 py-14">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <h2 className="font-display text-[34px] font-black leading-[1.05] tracking-[-0.8px] text-black">
              What we offer
            </h2>
            <p className="font-body text-base text-black/70">
              From sourcing to completion, we provide an end-to-end experience for buying property abroad.
            </p>
          </div>

          {/* Essential Access */}
          <div className="rounded-[20px] bg-[#FAEBFE] p-6 flex flex-col gap-5">
            <div className="self-start px-3 py-1.5 rounded-md bg-[#FFB0E8]">
              <span className="font-body text-xs font-semibold text-black">
                Essential Access · From £2000
              </span>
            </div>
            <h3 className="font-display text-[22px] font-bold text-[#1F1F1E] leading-tight">
              Expert mortgage advice & application service
            </h3>
            <p className="font-body text-xs font-semibold text-black/60 -mt-3">
              Starting from £2000
            </p>
            <ul className="flex flex-col gap-3">
              {[
                'Property search and shortlisting support',
                'Guidance on international ownership options',
                'Country-specific buying process overview',
                'Access to vetted local agents and partners',
                'Document checklist and timeline planning',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#00BC67] shrink-0 mt-0.5" />
                  <span className="font-body text-[15px] text-black leading-snug">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Essential Plus */}
          <div className="rounded-[20px] bg-[#FFF6D6] p-6 flex flex-col gap-5">
            <div className="self-start px-3 py-1.5 rounded-md bg-[#602FD3]">
              <span className="font-body text-xs font-semibold text-white">
                Essential Plus · Starting from £5000
              </span>
            </div>
            <h3 className="font-display text-[22px] font-bold text-[#1F1F1E] leading-tight">
              Property survey, legal work & more
            </h3>
            <p className="font-body text-xs font-semibold text-black/60 -mt-3">
              Starting from £5000
            </p>
            <ul className="flex flex-col gap-3">
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-[#00BC67] shrink-0 mt-0.5" />
                <span className="font-body text-[15px] font-bold text-black leading-snug">
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
                  <Check className="w-5 h-5 text-[#00BC67] shrink-0 mt-0.5" />
                  <span className="font-body text-[15px] text-black leading-snug">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* M3. How it works */}
      <section className="md:hidden px-6 py-14 bg-gradient-to-b from-[#9BD9FF] via-[#E8C0F4] to-[#FFB0E8]/60">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h2 className="font-display text-[34px] font-black leading-[1.05] tracking-[-0.8px] text-black">
              How it works
            </h2>
            <p className="font-body text-sm font-semibold text-black/60">
              What's your situation?
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-white border border-black/10">
              <div className="w-5 h-5 rounded-full border-2 border-black/30" />
              <span className="font-body text-sm font-semibold text-black/70">I'm buying</span>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-black">
              <div className="w-5 h-5 rounded-full bg-[#00BC67] flex items-center justify-center">
                <Check className="w-3 h-3 text-white" strokeWidth={3} />
              </div>
              <span className="font-body text-sm font-semibold text-white">
                I'm buying and selling
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-4">
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
                className="rounded-[18px] bg-white/60 backdrop-blur-sm p-5 flex flex-col gap-2 border border-white/40"
              >
                <h3 className="font-display text-lg font-black text-black leading-tight">
                  {step.title}
                </h3>
                <p className="font-body text-sm text-black/75 leading-snug">{step.desc}</p>
              </div>
            ))}
          </div>

          <button
            onClick={() => openModal('create-account')}
            className="self-center mt-2 h-12 px-7 rounded-full bg-black text-white font-body text-base font-semibold transition-all hover:bg-black/90 active:scale-95"
          >
            Get Started Today
          </button>
        </div>
      </section>

      {/* M4. Let's talk fees */}
      <section className="md:hidden bg-[#FEEAA0] px-6 py-14">
        <div className="flex flex-col gap-7">
          <div className="flex flex-col gap-3">
            <h2 className="font-display text-[34px] font-black leading-[1.0] tracking-[-0.8px] text-black">
              Let's talk fees
            </h2>
            <p className="font-body text-sm text-black/75">
              Our cost depends on your property price, but the fees start from around £2,000.
            </p>
          </div>

          <div className="rounded-[20px] bg-white p-5 flex flex-col gap-4">
            <label className="flex flex-col gap-2">
              <span className="font-body text-sm font-semibold text-black">
                Your property price
              </span>
              <div className="flex items-center rounded-lg border border-black/10 overflow-hidden">
                <div className="bg-black px-3 py-2.5 flex items-center justify-center">
                  <span className="font-display text-base text-white">£</span>
                </div>
                <input
                  type="text"
                  defaultValue="2000"
                  className="w-full font-body text-sm text-black/70 outline-none px-3 py-2.5"
                />
              </div>
            </label>

            <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-[#00FF8C]">
              <span className="font-body text-sm text-[#040405]">Your price</span>
              <span className="font-body text-sm font-bold text-[#040405]">£2,600</span>
            </div>

            <div className="flex flex-col gap-3">
              <h4 className="font-body text-sm font-semibold text-black">This includes:</h4>
              <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-black/5">
                <span className="font-body text-xs text-[#040405]">
                  All your conveyancing and legal work
                </span>
                <span className="font-body text-xs font-bold text-[#040405] whitespace-nowrap">
                  worth £1,610
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-black/5">
                <span className="font-body text-xs text-[#040405]">Property survey</span>
                <span className="font-body text-xs font-bold text-[#040405] whitespace-nowrap">
                  worth £432
                </span>
              </div>
            </div>

            <button className="self-start mt-1 rounded-full border border-black px-5 py-2.5 font-body text-sm font-semibold text-[#040405] transition-all hover:bg-black hover:text-white active:scale-95">
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
