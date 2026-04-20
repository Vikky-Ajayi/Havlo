import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { AutoScrollReviews } from '../components/shared/AutoScrollReviews';
import { useModal } from '../hooks/useModal';

const auditReviews = [
  { title: 'Clarity we needed', content: 'After following the Property Sale Audit recommendations, our property attracted multiple offers in just 2 weeks. The process was clear, actionable, and saved us months of frustration.', author: 'Homeowner, Surrey' },
  { title: 'Finally understood why it wasn\'t selling', content: 'We\'d been on the market for 9 months with barely any viewings. The audit identified three clear issues we hadn\'t considered. Once we fixed them, we had an offer within 3 weeks.', author: 'Seller, Bristol' },
  { title: 'Independent and honest', content: 'Unlike our agent, Havlo gave us completely independent advice. No agenda, just clear recommendations. Worth every penny.', author: 'Homeowner, Manchester' },
  { title: 'Saved us from another price reduction', content: 'We were about to drop our price again. The audit showed pricing wasn\'t actually the core issue — it was the listing quality and lack of international exposure. Game changer.', author: 'Seller, London' },
  { title: 'Professional and detailed', content: 'The report was incredibly thorough. We had a clear action plan and our agent was happy to implement the changes. Sold within a month of relaunching.', author: 'Homeowner, Leeds' },
  { title: 'Worth it for the peace of mind alone', content: 'After 6 months of nothing, this audit gave us real confidence that we were doing the right things. The recommendations were specific, not generic.', author: 'Seller, Edinburgh' },
];

const RelaunchHeroSection: React.FC = () => {
  const { openModal } = useModal();
  const stats = [
    { value: "5×", label: "Areas of your listing we audit" },
    { value: "2wk", label: "Average time to first offers after relaunch" },
    { value: "100%", label: "No disruption to your current sale process" },
  ];
  return (
    <section className="relative w-full min-h-[600px] lg:h-[750px] overflow-hidden">
      <img
        src="https://api.builder.io/api/v1/image/assets/TEMP/46673988b71a834a3489dd511265f99186cf5a29?width=2880"
        alt="Hero House"
        className="absolute inset-0 w-full h-full object-cover z-0"
        referrerPolicy="no-referrer"
        loading="eager"
      />
      <div
        className="absolute inset-0 z-[1]"
        style={{
          background: 'linear-gradient(to bottom, rgba(80, 40, 120, 0.75) 0%, rgba(60, 20, 100, 0.85) 60%, rgba(20, 0, 40, 0.95) 100%)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 lg:px-[100px] pt-20 pb-32 lg:pt-32 lg:pb-40 min-h-[600px] lg:h-[750px]">
        <div className="w-full max-w-[800px] flex flex-col items-center">
          <h1 className="font-display font-black text-white leading-[1.1] text-[32px] sm:text-[44px] lg:text-[60px] xl:text-[68px]">
            Uncover What's Stopping Your Home from Selling with Havlo Property Sale Audit
          </h1>
          <p className="font-body mt-4 lg:mt-5 text-base lg:text-lg leading-[1.6] text-white/85 max-w-[540px]">
            Your home has been on the market too long. Get a data-driven, independent roadmap to selling faster — without switching agents.
          </p>
          <button
            onClick={() => openModal('create-account')}
            className="mt-7 inline-flex items-center gap-2 bg-white text-[#111] px-8 py-3.5 rounded-full text-base font-medium transition-all duration-200 hover:bg-[#f0f0f0] active:scale-95"
          >
            Start My Property Sale Audit
            <ArrowUpRight size={18} />
          </button>
          <p className="mt-3 font-body text-sm text-white/70 max-w-[480px]">
            Includes a comprehensive expert audit, a tailored action plan, and an optional 1:1 walkthrough to fix what's holding your sale back
          </p>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 w-full z-10 pb-6 lg:pb-5 px-6 lg:px-[100px]">
        <div className="grid grid-cols-3 gap-4 lg:flex lg:items-center lg:justify-around">
          {stats.map((stat, idx) => (
            <div key={idx} className="text-center">
              <span className="block text-base lg:text-xl font-extrabold text-[#c084fc]">
                {stat.value}
              </span>
              <span className="block text-[11px] lg:text-[13px] font-bold text-white leading-tight mt-1">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export const RelaunchAssessment: React.FC = () => {
  const { openModal } = useModal();
  return (
    <div className="flex flex-col w-full overflow-hidden bg-white">
      <RelaunchHeroSection />

      {/* Auto-scrolling reviews */}
      <div className="bg-white px-0 pt-2 pb-0">
        <AutoScrollReviews reviews={auditReviews} bgColor="#F5F5F3" />
      </div>

      {/* 2. The Problem Section */}
      <section className="flex flex-col items-center gap-14 bg-white px-4 py-20 sm:px-10 lg:px-[100px]">
        <div className="flex flex-col items-center gap-6 text-center">
          <span className="font-body text-lg font-medium uppercase tracking-tight text-[#3A3C3E]">
            THE PROBLEM
          </span>
          <h2 className="font-display text-[44px] font-black leading-[1.1] text-[#040504] sm:text-[56px]">
            Why homes stall on the market
          </h2>
          <p className="max-w-[760px] font-body text-xl font-medium text-black/80">
            If your property has been listed for months without offers, one or more of these issues is likely holding you back. These issues silently kill buyer interest — and most sellers never spot them.
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 max-w-7xl">
          {[
            { emoji: "📉", title: "Mispricing", desc: "Even small pricing mismatches can often push your property out of key search ranges, significantly reducing visibility and buyer interest." },
            { emoji: "📷", title: "Poor listing quality", desc: "Buyers typically decide within seconds whether to click or scroll — poor visuals and weak descriptions can kill interest before your property is even considered." },
            { emoji: "📡", title: "Limited exposure", desc: "If your listing isn't reaching the right buyers in the right places, demand often never builds — and without demand, offers don't come." },
            { emoji: "🏠", title: "Presentation gaps", desc: "Small presentation issues can often create doubt during viewings, lowering perceived value and reducing the likelihood of offers." },
            { emoji: "📋", title: "No clear strategy", desc: "Relisting without a clear strategy typically repeats the same mistakes, leading to more time on the market with no better results." },
          ].map((item, idx) => (
            <div key={idx} className="flex flex-col justify-between gap-12 rounded-[20px] bg-[#F9F9F9] p-8 border border-[#F8F7F6]">
              <span className="text-2xl">{item.emoji}</span>
              <div className="flex flex-col gap-4">
                <h3 className="font-display text-2xl font-bold text-[#1F1F1E]">{item.title}</h3>
                <p className="font-body text-base font-medium leading-[1.6] text-black/70">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="max-w-[760px] font-body text-base text-black/60 text-center">
          Over 80% of stalled listings suffer from at least two of these issues — our assessment pinpoints exactly what's holding your property back and how to fix it.
        </p>
      </section>

      {/* 3. What You Get Section */}
      <section className="flex flex-col items-center gap-14 bg-[#F9F8F9] px-4 py-20 sm:px-10 lg:px-[100px]">
        <div className="flex flex-col items-center gap-6 text-center">
          <span className="font-body text-lg font-medium uppercase tracking-tight text-[#3A3C3E]">
            WHAT YOU GET
          </span>
          <h2 className="font-display text-[44px] font-black leading-[1.1] text-[#040504] sm:text-[56px]">
            What You Get With Havlo Property Sale Audit
          </h2>
          <p className="max-w-[760px] font-body text-xl font-medium text-black/80">
            A thorough, independent evaluation covering every factor that affects how fast your home sells.
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 max-w-7xl">
          {[
            { num: "01", title: "Market & pricing analysis", desc: "Identify where your pricing is limiting visibility and demand — and uncover the adjustments needed to attract serious buyers faster." },
            { num: "02", title: "Listing quality audit", desc: "Pinpoint exactly what's causing buyers to scroll past your listing — and how to improve click-through and engagement immediately." },
            { num: "03", title: "Marketing & exposure review", desc: "Reveal where your listing is losing reach — and how to increase visibility among serious, qualified buyers." },
            { num: "04", title: "Actionable relaunch roadmap", desc: "Get a clear, step-by-step plan to relaunch your property with stronger positioning, better presentation, and increased buyer interest." },
            { num: "05", title: "Professional report & consultation", desc: "Receive a detailed, easy-to-follow action plan — with the option to walk through every recommendation with an expert." },
          ].map((item, idx) => (
            <div key={idx} className="flex flex-col gap-14 rounded-[20px] bg-white p-8 border border-[#F8F7F6]">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F5D8FD] text-[#A409D2] font-bold text-lg">
                {item.num}
              </div>
              <div className="flex flex-col gap-4">
                <h3 className="font-display text-2xl font-bold text-[#1F1F1E]">{item.title}</h3>
                <p className="font-body text-base font-medium leading-[1.6] text-black/70">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="max-w-[760px] font-body text-base text-black/60 text-center">
          Every extra week on the market can reduce leverage, weaken buyer perception, and lead to lower offers. This assessment is designed to fix the issues before they cost you far more.
        </p>
      </section>

      {/* 4. How It Works Section */}
      <section className="flex w-full flex-col items-center justify-center bg-black px-4 py-20 sm:px-10 lg:px-[100px]">
        <div className="flex w-full max-w-7xl flex-col items-start justify-between gap-16 lg:flex-row">
          <div className="flex flex-col items-start gap-10 lg:w-1/2">
            <span className="font-body text-lg font-medium uppercase tracking-tight text-havlo-purple">
              How it works
            </span>
            <h2 className="font-display text-[44px] font-black leading-[1.1] text-white sm:text-[56px]">
              A straightforward, expert-led process:
            </h2>
            <p className="max-w-[574px] font-body text-xl font-medium text-white/80">
              Entirely remote — no disruption to your current sale process or your current agent relationship.
            </p>
          </div>
          <div className="flex flex-col w-full lg:w-1/2 border-t border-white/10">
            {[
              "Share your property details and current listing — we take care of the rest.",
              "We conduct a comprehensive expert assessment of your pricing, listing quality, and market position.",
              "Receive a premium, easy-to-follow report with clear recommendations to improve interest and attract buyers.",
              "Optionally walk through your results with an expert and get guidance on implementing changes.",
            ].map((step, idx) => (
              <div key={idx} className="flex items-start gap-4 border-b border-white/10 py-6">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F5D8FD] text-[#A409D2] font-bold text-sm mt-0.5">
                  {idx + 1}
                </div>
                <span className="font-body text-lg font-normal text-white">{step}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Why Us Section */}
      <section className="flex flex-col items-center gap-14 bg-black px-4 py-20 sm:px-10 lg:px-[100px]">
        <div className="flex flex-col items-center gap-6 text-center">
          <span className="font-body text-lg font-medium uppercase tracking-tight text-white">
            WHY US
          </span>
          <h2 className="font-display text-[44px] font-black leading-[1.1] text-white sm:text-[56px]">
            Why Property Sale Audit?
          </h2>
          <p className="max-w-[760px] font-body text-xl font-medium text-white/80">
            Independent expertise that works with your existing agent — not against them.
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 max-w-7xl">
          {[
            { title: "Independent, unbiased, and professional guidance you can trust", sub: "Independent insight focused solely on getting your property sold — not tied to any agent or commission.", italic: false },
            { title: "Saves time, stress, and money", sub: "Helps you avoid prolonged time on the market, price reductions, and missed buyer demand.", italic: false },
            { title: "Premium, actionable insights", sub: "Clear, specific recommendations tailored to your property — not generic advice.", italic: false },
            { title: "Conducted by agents", sub: "Reviewed by professionals actively selling in your market, with real-time local insight.", italic: false },
            { title: "Works alongside your current agent", sub: "Designed to complement your current agent — no switching or disruption required.", italic: true },
          ].map((item, idx) => (
            <div key={idx} className="flex items-start gap-4 rounded-[20px] bg-white/10 p-8">
              <div className="h-3 w-3 rounded-full bg-havlo-purple mt-2 shrink-0" />
              <div className="flex flex-col gap-2">
                <p className="font-body text-lg font-semibold leading-[1.4] text-white">{item.title}</p>
                <p className={`font-body text-sm font-normal leading-[1.5] text-white/70 ${item.italic ? 'italic' : ''}`}>{item.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Final CTA Section */}
      <section className="relative flex flex-col items-center gap-8 bg-havlo-purple px-4 pb-24 pt-32 text-center">
        <div className="absolute top-0 left-0 w-full overflow-hidden leading-[0] pointer-events-none">
          <svg viewBox="0 0 1440 100" preserveAspectRatio="none" className="relative block w-full h-[100px] fill-black">
            <path d="M0,0 L1440,0 L1440,60 L1300,40 L1150,70 L1000,30 L850,60 L700,20 L550,50 L400,10 L250,40 L100,20 L0,50 Z" />
          </svg>
        </div>

        <div className="relative z-10 flex flex-col items-center gap-8">
          <h2 className="max-w-[750px] font-display text-[36px] sm:text-[56px] lg:text-[72px] font-black leading-[1.1] text-white">
            Get the Clarity You Need to Sell — Without Guesswork
          </h2>
          <p className="max-w-[678px] font-body text-xl font-medium text-white/80">
            A comprehensive expert assessment designed to identify exactly what's holding your sale back — and how to fix it.
          </p>
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-baseline gap-2">
              <span className="font-body text-[40px] font-bold text-white">£1,999.99</span>
              <span className="font-body text-xl font-medium text-white/80">one-time fee</span>
            </div>
          </div>
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={() => openModal('create-account')}
              className="rounded-full bg-white px-8 py-4 font-body text-lg font-semibold text-black transition-all hover:bg-white/90 active:scale-95"
            >
              Start My Property Sale Audit
            </button>
            <p className="font-body text-sm font-medium text-white/70 max-w-[560px]">
              Includes a comprehensive expert audit, a tailored action plan, and an optional 1:1 walkthrough call. Each assessment is handled individually — if we don't identify clear, actionable issues, we'll refund any fees paid.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
