import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import { cn } from '../lib/utils';
import { ReviewCard } from '../components/shared/ReviewCard';
import { TrustpilotStars } from '../components/ui/TrustpilotStars';

const sellFasterReviews = [
  { title: 'Finally sold after months of no progress', content: 'Our property had been on the market for over 6 months with very little interest. Havlo Relaunch completely changed that and brought in serious buyers.', author: 'Ben, Reading' },
  { title: 'A real turnaround for our listing', content: 'We had almost given up after months of no offers. The relaunch strategy worked, and we finally secured a buyer.', author: 'Claire, Sheffield' },
  { title: 'Exactly what we needed after 6+ months', content: 'Havlo helped reposition our property and attract a completely new audience. The difference was immediate.', author: 'Marcus, Liverpool' },
  { title: 'Sold after being stuck for nearly a year', content: 'Our house had been listed for close to a year with no success. Havlo Relaunch gave it new life and helped us finally move forward.', author: 'Fiona, Oxford' },
  { title: 'New strategy, real results', content: 'The relaunch approach made all the difference. Better marketing, better positioning, and much stronger enquiries.', author: 'Ryan, Newcastle' },
  { title: 'From no interest to serious offers', content: 'We went from barely any viewings to genuine offers after using Havlo. The international exposure really worked.', author: 'Priya, Leicester' },
  { title: 'Helped us break through a stagnant market', content: 'Our property had gone stale on the market. Havlo Relaunch brought in fresh demand and the right kind of buyers.', author: 'Gareth, Cardiff' },
  { title: 'Professional and highly effective', content: 'The team clearly understood why our property wasn’t selling and fixed it. We saw results much faster than expected.', author: 'Nadia, Abu Dhabi' },
  { title: 'Great solution for slow-moving properties', content: 'If your property has been sitting unsold, this service is exactly what you need. It helped us secure a buyer after months of frustration.', author: 'Lewis, Glasgow' },
  { title: 'A fresh start that worked', content: 'Havlo gave our listing a proper relaunch with a clear strategy. It attracted new interest and ultimately led to a successful sale.', author: 'Sanjay, Slough' },
];

const saleAuditReviews = [
  { title: 'Gave us clarity we didn’t have before', content: 'We couldn’t understand why our property wasn’t selling. The Havlo assessment clearly identified the issues and gave us a solid plan to move forward.', author: 'Andrew, Guildford' },
  { title: 'Eye-opening and extremely helpful', content: 'The audit highlighted pricing and presentation issues we had completely overlooked. It gave us a clear direction and renewed confidence.', author: 'Rachel, Cambridge' },
  { title: 'Exactly what we needed', content: 'After months of no progress, the assessment showed us exactly what was holding the sale back. The recommendations were practical and easy to implement.', author: 'Tom, Brighton' },
  { title: 'Clear, honest and actionable advice', content: 'Havlo didn’t just guess—they provided real insights backed by data. It helped us understand our position in the market properly.', author: 'Louise, York' },
  { title: 'Helped us fix key issues quickly', content: 'We made a few key changes based on the audit, and the difference was immediate. Much more interest and better quality enquiries.', author: 'Chris, Milton Keynes' },
  { title: 'Finally understood why it wasn’t selling', content: 'The assessment broke everything down clearly—pricing, photos, and positioning. It all made sense once we saw it laid out properly.', author: 'Nina, Reading' },
  { title: 'Professional and insightful service', content: 'The level of detail in the report was impressive. It felt like a proper strategy rather than just general advice.', author: 'Hassan, Doha' },
  { title: 'A smart first step before relaunching', content: 'Before switching agents, this audit helped us get everything right. It saved us time and avoided repeating mistakes.', author: 'Emma, Chelmsford' },
  { title: 'Straightforward and effective', content: 'No fluff—just clear reasons why our property wasn’t selling and what to do next. Exactly what we needed.', author: 'Daniel, Southampton' },
  { title: 'Worth it for the clarity alone', content: 'Even before relaunching, the audit gave us a completely new perspective on how our property was being seen by buyers.', author: 'Priya, Harrow' },
];

interface ReviewCarouselProps {
  heading: string;
  subheading: string;
  reviews: { title: string; content: string; author: string }[];
}

const ReviewCarousel: React.FC<ReviewCarouselProps> = ({ heading, subheading, reviews }) => {
  const [index, setIndex] = useState(0);
  const [mobileIndex, setMobileIndex] = useState(0);
  const visible = [
    reviews[index % reviews.length],
    reviews[(index + 1) % reviews.length],
    reviews[(index + 2) % reviews.length],
  ];
  const next = () => setIndex((i) => (i + 3) % reviews.length);
  const prev = () => setIndex((i) => (i - 3 + reviews.length) % reviews.length);
  const nextMobile = () => setMobileIndex((i) => (i + 1) % reviews.length);
  const prevMobile = () => setMobileIndex((i) => (i - 1 + reviews.length) % reviews.length);

  return (
    <section className="flex flex-col w-full bg-white px-4 py-16 sm:px-10 lg:px-[100px]">
      <div className="mx-auto w-full max-w-7xl">
        {/* Desktop */}
        <div className="hidden lg:flex w-full items-start gap-10">
          <div className="flex shrink-0 flex-col items-start gap-4 text-left max-w-[280px]">
            <h2 className="font-body text-[32px] font-medium leading-tight tracking-[-0.8px] text-[#040504]">
              {heading}
            </h2>
            <TrustpilotStars className="h-[30px]" />
            <p className="font-body text-[16px] font-normal text-black/80">{subheading}</p>
          </div>
          <div className="flex flex-1 items-center gap-4">
            <button onClick={prev} aria-label="Previous reviews" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/15 bg-white text-black/70 hover:bg-black/5">
              <ChevronLeft size={18} />
            </button>
            <div className="grid flex-1 grid-cols-3 gap-4">
              {visible.map((r, i) => (
                <div key={`${index}-${i}`} className="rounded-xl bg-[#F5F5F3] p-5">
                  <ReviewCard title={r.title} content={r.content} author={r.author} time="" />
                </div>
              ))}
            </div>
            <button onClick={next} aria-label="Next reviews" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/15 bg-white text-black/70 hover:bg-black/5">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Mobile */}
        <div className="flex w-full flex-col items-center gap-6 lg:hidden">
          <div className="flex flex-col items-center gap-3 text-center">
            <h2 className="font-body text-[28px] font-medium leading-tight tracking-[-0.8px] text-[#040504]">
              {heading}
            </h2>
            <TrustpilotStars className="h-[26px]" />
          </div>
          <div className="flex w-full items-center gap-3">
            <button onClick={prevMobile} aria-label="Previous review" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-black/15">
              <ChevronLeft size={14} />
            </button>
            <div className="flex-1 rounded-xl bg-[#F5F5F3] p-5">
              <ReviewCard
                title={reviews[mobileIndex].title}
                content={reviews[mobileIndex].content}
                author={reviews[mobileIndex].author}
                time=""
              />
            </div>
            <button onClick={nextMobile} aria-label="Next review" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-black/15">
              <ChevronRight size={14} />
            </button>
          </div>
          <p className="font-body text-base font-normal text-black/80 text-center">{subheading}</p>
        </div>
      </div>
    </section>
  );
};

const RelaunchHeroSection: React.FC = () => {
  return (
    <section style={{ position: 'relative', width: '100%', height: '750px', overflow: 'hidden' }}>
      {/* 1. House Image — full bleed */}
      <img 
        src="https://api.builder.io/api/v1/image/assets/TEMP/46673988b71a834a3489dd511265f99186cf5a29?width=2880" 
        alt="Hero House"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center',
          zIndex: 0,
        }}
        referrerPolicy="no-referrer"
      />

      {/* 2. Purple Gradient Overlay */}
      <div 
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom, rgba(80, 40, 120, 0.75) 0%, rgba(60, 20, 100, 0.85) 60%, rgba(20, 0, 40, 0.95) 100%)',
          zIndex: 1,
        }}
      />

      {/* 3. Centered Text Block */}
      <div 
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '100%',
          maxWidth: '800px',
          textAlign: 'center',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '0 20px'
        }}
      >
        <h1 
          className="font-display"
          style={{
            fontWeight: 900,
            fontSize: '56px',
            lineHeight: 1.1,
            color: 'white',
          }}
        >
          Sell Your Home Faster with Havlo Relaunch Assessment
        </h1>
        <p
          className="font-body"
          style={{
            fontSize: '18px',
            color: 'rgba(255,255,255,0.85)',
            lineHeight: 1.6,
            maxWidth: '540px',
            margin: '16px auto 0',
          }}
        >
          Your home has been on the market too long. Get a data-driven, independent roadmap to selling faster — without switching agents.
        </p>
        <button
          className="transition-all duration-200 hover:bg-[#f0f0f0] active:scale-95"
          style={{
            marginTop: '28px',
            background: 'white',
            color: '#111',
            padding: '14px 32px',
            borderRadius: '9999px',
            fontSize: '16px',
            fontWeight: 500,
            border: 'none',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          Get Started
          <ArrowUpRight size={18} />
        </button>
      </div>

      {/* 4. Stats Bar — pinned to bottom */}
      <div 
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          background: 'transparent',
          height: '100px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          zIndex: 10,
          paddingBottom: '20px'
        }}
      >
        {[
          { value: "5×", label: "Areas of your listing we audit" },
          { value: "2wk", label: "Average time to first offers after relaunch" },
          { value: "100", label: "No disruption to your current sale process" },
        ].map((stat, idx) => (
          <div key={idx} className="text-center">
            <span style={{ fontSize: '20px', fontWeight: 800, color: '#c084fc', display: 'block' }}>
              {stat.value}
            </span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>
              {stat.label}
            </span>
          </div>
        ))}
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

      {/* 6b. Sell Faster Reviews */}
      <ReviewCarousel
        heading="Sell Faster reviews"
        subheading="Real stories from sellers who relaunched their listings with Havlo."
        reviews={sellFasterReviews}
      />

      {/* 6c. Property Sale Audit Reviews */}
      <ReviewCarousel
        heading="Property Sale Audit reviews"
        subheading="What homeowners say after their independent Havlo audit."
        reviews={saleAuditReviews}
      />

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
