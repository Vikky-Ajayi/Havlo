import React from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, Quote } from 'lucide-react';
import { cn } from '../lib/utils';

const RelaunchHeroSection: React.FC = () => {
  const stats = [
    { value: "5×", label: "Areas of your listing we audit" },
    { value: "2wk", label: "Average time to first offers after relaunch" },
    { value: "100", label: "No disruption to your current sale process" },
  ];
  return (
    <section className="relative w-full min-h-[600px] lg:h-[750px] overflow-hidden">
      <img
        src="https://api.builder.io/api/v1/image/assets/TEMP/46673988b71a834a3489dd511265f99186cf5a29?width=2880"
        alt="Hero House"
        className="absolute inset-0 w-full h-full object-cover z-0"
        referrerPolicy="no-referrer"
      />
      <div
        className="absolute inset-0 z-[1]"
        style={{
          background: 'linear-gradient(to bottom, rgba(80, 40, 120, 0.75) 0%, rgba(60, 20, 100, 0.85) 60%, rgba(20, 0, 40, 0.95) 100%)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 lg:px-[100px] pt-20 pb-32 lg:pt-32 lg:pb-40 min-h-[600px] lg:h-[750px]">
        <div className="w-full max-w-[800px] flex flex-col items-center">
          <h1 className="font-display font-black text-white leading-[1.1] text-[36px] sm:text-[48px] lg:text-[64px] xl:text-[72px]">
            Sell Your Home Faster with Havlo Relaunch Assessment
          </h1>
          <p className="font-body mt-4 lg:mt-5 text-base lg:text-lg leading-[1.6] text-white/85 max-w-[540px]">
            Your home has been on the market too long. Get a data-driven, independent roadmap to selling faster — without switching agents.
          </p>
          <button className="mt-7 inline-flex items-center gap-2 bg-white text-[#111] px-8 py-3.5 rounded-full text-base font-medium transition-all duration-200 hover:bg-[#f0f0f0] active:scale-95">
            Get Started
            <ArrowUpRight size={18} />
          </button>
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
  return (
    <div className="flex flex-col w-full overflow-hidden bg-white">
      <RelaunchHeroSection />

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
            If your property has been listed for months without offers, one or more of these issues is likely holding you back.
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 max-w-7xl">
          {[
            { emoji: "📉", title: "Mispricing", desc: "Overpriced or misaligned with what buyers are willing to pay today" },
            { emoji: "📷", title: "Poor listing quality", desc: "Weak photos, thin descriptions, or no virtual tour discouraging clicks" },
            { emoji: "📡", title: "Limited exposure", desc: "Not reaching enough qualified buyers across portals and social media" },
            { emoji: "🏠", title: "Presentation gaps", desc: "Minor staging or improvement issues reducing in-person appeal" },
            { emoji: "📋", title: "No clear strategy", desc: "Relisting without a data-backed plan rarely produces different results" },
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
      </section>

      {/* 3. What You Get Section */}
      <section className="flex flex-col items-center gap-14 bg-[#F9F8F9] px-4 py-20 sm:px-10 lg:px-[100px]">
        <div className="flex flex-col items-center gap-6 text-center">
          <span className="font-body text-lg font-medium uppercase tracking-tight text-[#3A3C3E]">
            WHAT YOU GET
          </span>
          <h2 className="font-display text-[44px] font-black leading-[1.1] text-[#040504] sm:text-[56px]">
            What You Get With Relaunch Assessment
          </h2>
          <p className="max-w-[760px] font-body text-xl font-medium text-black/80">
            A thorough, independent evaluation covering every factor that affects how fast your home sells.
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 max-w-7xl">
          {[
            { num: "01", title: "Market & pricing analysis", desc: "Compare your home to recently sold and active listings. Identify price adjustments to attract buyers faster. Understand local market trends and buyer expectations." },
            { num: "02", title: "Listing quality audit", desc: "Professional evaluation of photos, descriptions, and virtual tours. Recommendations to improve online appeal and click-through. Suggestions your current agent can implement immediately." },
            { num: "03", title: "Marketing & exposure review", desc: "Audit of how your property is advertised across all channels. Strategies to maximise visibility to serious, qualified buyers." },
            { num: "04", title: "Actionable relaunch roadmap", desc: "Step-by-step plan covering pricing, listing, marketing, staging, and improvements. Designed for easy implementation by your current agent." },
            { num: "05", title: "Professional report & consultation", desc: "Detailed PDF report with charts, scoring, and actionable steps. An optional 30–60 minute call to review and walk you through each recommendation." },
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
      </section>

      {/* 4. How It Works Section */}
      <section className="flex w-full flex-col items-center justify-center bg-black px-4 py-20 sm:px-10 lg:px-[100px]">
        <div className="flex w-full max-w-7xl flex-col items-start justify-between gap-16 lg:flex-row">
          <div className="flex flex-col items-start gap-10 lg:w-1/2">
            <span className="font-body text-lg font-medium uppercase tracking-tight text-havlo-purple">
              HOW IT WORKS
            </span>
            <h2 className="font-display text-[44px] font-black leading-[1.1] text-white sm:text-[56px]">
              Simple four-step process
            </h2>
            <p className="max-w-[574px] font-body text-xl font-medium text-white/80">
              Entirely remote — no disruption to your current sale process or your current agent relationship.
            </p>
          </div>
          <div className="flex flex-col w-full lg:w-1/2 border-t border-white/10">
            {[
              "You provide your property details and current listing links.",
              "We conduct a comprehensive market and listing assessment remotely.",
              "Receive a premium report with visual analysis, scoring, and recommendations.",
              "Schedule a call to go over the report if you want personalized guidance"
            ].map((step, idx) => (
              <div key={idx} className="flex items-center border-b border-white/10 py-6">
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
            Why Relaunch Assessment?
          </h2>
          <p className="max-w-[760px] font-body text-xl font-medium text-white/80">
            Independent expertise that works with your existing agent — not against them.
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 max-w-7xl">
          {[
            "Independent, unbiased, and professional guidance you can trust",
            "Saves time, stress, and money from a prolonged listing",
            "Premium, actionable insights tailored specifically to your property",
            "Conducted by agents who actively sell in your area with local knowledge",
            "Works alongside your current agent — no switching required"
          ].map((item, idx) => (
            <div key={idx} className="flex items-start gap-4 rounded-[20px] bg-white/10 p-8">
              <div className="h-3 w-3 rounded-full bg-havlo-purple mt-2 shrink-0" />
              <p className="font-body text-lg font-medium leading-[1.5] text-white">{item}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Testimonial Section */}
      <section className="flex flex-col items-start gap-8 bg-[#F9F8F9] px-4 py-20 sm:px-10 lg:px-[100px]">
        <div className="max-w-7xl mx-auto w-full flex flex-col gap-8">
          <Quote size={56} className="text-havlo-purple fill-havlo-purple" />
          <h2 className="font-display text-[32px] font-medium leading-[1.2] text-[#1F1F1E] sm:text-[40px]">
            After following the Relaunch Assessment recommendations, our property attracted multiple offers in just 2 weeks. The process was clear, actionable, and saved us months of frustration.
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-4xl font-display text-[#1F1F1E]">-</span>
            <span className="font-body text-lg font-normal text-[#1F1F1E] uppercase tracking-wider">HOMEOWNER</span>
          </div>
        </div>
      </section>

      {/* 7. Final CTA Section */}
      <section className="relative flex flex-col items-center gap-8 bg-havlo-purple px-4 pb-24 pt-32 text-center">
        {/* Jagged Top Edge */}
        <div className="absolute top-0 left-0 w-full overflow-hidden leading-[0] pointer-events-none">
          <svg viewBox="0 0 1440 100" preserveAspectRatio="none" className="relative block w-full h-[100px] fill-[#F9F8F9]">
            <path d="M0,0 L1440,0 L1440,60 L1300,40 L1150,70 L1000,30 L850,60 L700,20 L550,50 L400,10 L250,40 L100,20 L0,50 Z" />
          </svg>
        </div>

        <div className="relative z-10 flex flex-col items-center gap-8">
          <h2 className="max-w-[750px] font-display text-[56px] font-black leading-[1.1] text-white sm:text-[80px]">
            Get your Relaunch Assessment today
          </h2>
          <p className="max-w-[678px] font-body text-xl font-medium text-white/80">
            A complete roadmap to finally get your property sold.
          </p>
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-baseline gap-2">
              <span className="font-body text-[40px] font-bold text-white">£1,999.99</span>
              <span className="font-body text-xl font-medium text-white/80">one-time fee</span>
            </div>
          </div>
          <div className="flex flex-col items-center gap-4">
            <button className="rounded-full bg-white px-8 py-4 font-body text-lg font-semibold text-black transition-all hover:bg-white/90 active:scale-95">
              Get Started
            </button>
            <p className="font-body text-sm font-medium text-white/70">
              Includes full PDF report + An optional 30–60 minute walkthrough call.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
