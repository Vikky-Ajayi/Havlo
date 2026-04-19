import React, { useState } from 'react';
import { Check, Plus, Minus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { MarqueeStrip } from '../components/shared/MarqueeStrip';
import { HeroBackground } from '../components/shared/HeroBackground';
import { useModal } from '../hooks/useModal';
import { cn } from '../lib/utils';

const heroStats = [
  { value: '30+', label: 'countries reached' },
  { value: '£1B+', label: 'in commission deals' },
];

const problemPoints = [
  'Most agents only market locally — relying on a handful of UK portals and their own database to find a buyer.',
  'Meanwhile, the buyer for your property may already be living abroad: a returning expat, a foreign investor, or a relocator searching from another country.',
  'Without an international layer, you are quietly cutting yourself off from the part of the market most likely to pay your price.',
];

const problemStats = [
  {
    value: '£3,000+',
    label: 'wasted on average per listing on portal upgrades and re-listings before a sale.',
  },
  {
    value: '30+',
    label: 'countries actively searching for UK property right now — most of them never see your listing.',
  },
];

const howItWorks = [
  {
    step: '01',
    title: 'Strategy briefing',
    desc: 'We map your property, target buyer, and the international markets most likely to convert.',
  },
  {
    step: '02',
    title: 'Creative & positioning',
    desc: 'We package your home for an international audience — copy, imagery, and pricing narrative.',
  },
  {
    step: '03',
    title: 'Targeted distribution',
    desc: 'Your listing is placed in front of vetted international buyers and partner agencies.',
  },
  {
    step: '04',
    title: 'Qualified enquiries',
    desc: 'You receive serious, qualified enquiries with transparent reporting on what is working.',
  },
];

const reachTiers = [
  {
    name: 'GLOBAL',
    price: '£2,500',
    period: 'one-off',
    subtitle: 'Get your property in front of international buyers, fast.',
    features: [
      'Listing translated for international audiences',
      'Distribution to 10+ partner countries',
      'Monthly performance summary',
      'Email support',
    ],
    recommended: false,
  },
  {
    name: 'GLOBAL+',
    price: '£3,500',
    period: 'one-off',
    subtitle: 'Our most popular tier for sellers who want active outreach.',
    features: [
      'Everything in Global',
      'Targeted ad campaigns in 5 priority markets',
      'Buyer-matching against our private network',
      'Bi-weekly reporting & call',
      'Priority support',
    ],
    recommended: true,
  },
  {
    name: 'WORLDWIDE',
    price: '£5,000',
    period: 'one-off',
    subtitle: 'Maximum visibility across every region we operate in.',
    features: [
      'Everything in Global+',
      'Distribution across all partner countries',
      'Bespoke creative production',
      'Dedicated account manager',
      'Weekly strategy reviews',
    ],
    recommended: false,
  },
  {
    name: 'PRIVATE CLIENT',
    price: '£8,000',
    period: 'one-off',
    subtitle: 'A discreet, white-glove campaign for prime and super-prime homes.',
    features: [
      'Everything in Worldwide',
      'Off-market introductions to UHNW buyers',
      'Confidential, name-blind marketing',
      'Concierge viewings & travel coordination',
      'Direct line to a senior strategist',
    ],
    recommended: false,
  },
];

const faqs = [
  {
    q: 'How quickly will my property start receiving international enquiries?',
    a: 'Most sellers see qualified enquiries within the first 2–4 weeks of going live, depending on the markets we target and the price band of the property.',
  },
  {
    q: 'Do you replace my existing estate agent?',
    a: 'No. Havlo works alongside your existing agent — adding international exposure your local portals cannot reach. Your agent still handles viewings and the sale itself.',
  },
  {
    q: 'How are the fees structured?',
    a: 'Each tier is a one-off campaign fee paid upfront — no commission, no surprise charges. You can upgrade between tiers at any time and we pro-rate the difference.',
  },
  {
    q: 'Do international buyers actually buy UK property?',
    a: 'Yes. Returning expats, relocators, and foreign investors collectively account for a meaningful share of UK transactions every year — especially in the £500k+ market.',
  },
  {
    q: 'What kind of properties do you work with?',
    a: 'We work with everything from family homes that have been on the market for a while, through to prime and super-prime listings that benefit from a discreet international campaign.',
  },
  {
    q: 'Is there a minimum property value?',
    a: 'No strict minimum — but the international model tends to deliver the strongest results on properties priced from £400k upwards.',
  },
];

export const Marketing: React.FC = () => {
  const { openModal } = useModal();
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handleGetStarted = () => openModal('create-account');
  const handleStrategyCall = () => navigate('/contact');

  return (
    <div className="flex flex-col w-full bg-white">
      {/* 1. Hero */}
      <section className="relative flex flex-col items-center overflow-hidden pt-20 lg:pt-28 pb-24 lg:pb-40 px-6 lg:px-[100px]">
        {/* Background image with dark overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src="/Mask group2.png"
            alt=""
            className="h-full w-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/40 to-black/70" />
        </div>

        <div className="relative z-10 flex flex-col items-center text-center max-w-[1100px] mx-auto gap-6 lg:gap-8">
          <span className="font-body text-xs lg:text-sm font-semibold uppercase tracking-[0.25em] text-white/80">
            Havlo Marketing
          </span>
          <h1 className="font-display font-black text-white tracking-[-1.2px] lg:tracking-[-1.6px] text-[44px] sm:text-[64px] lg:text-[96px] leading-[1.02]">
            Your property. <br className="hidden sm:block" />
            The world's buyers.
          </h1>
          <p className="font-body text-base lg:text-xl leading-[1.5] text-white/85 max-w-[700px]">
            Reach high-intent international buyers with a structured campaign, transparent reporting, and a curated global network — built for agents and sellers who want the best buyer, not just the nearest one.
          </p>

          {/* Stat badges */}
          <div className="flex flex-wrap justify-center items-stretch gap-3 sm:gap-4 mt-2">
            {heroStats.map((s) => (
              <div
                key={s.label}
                className="flex items-center gap-3 rounded-full border border-white/30 bg-white/10 backdrop-blur-md px-5 py-2.5"
              >
                <span className="font-display text-lg lg:text-xl font-black text-white tracking-[-0.4px]">
                  {s.value}
                </span>
                <span className="font-body text-xs lg:text-sm font-semibold uppercase tracking-[0.12em] text-white/80">
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          <Button
            onClick={handleGetStarted}
            className="mt-6 h-14 px-10 bg-white text-black rounded-[48px] font-body text-lg font-bold hover:bg-white/90 transition-colors w-full sm:w-auto"
          >
            Get Started
          </Button>
        </div>

        {/* Torn-edge fade into next white section */}
        <div className="absolute bottom-[-1px] left-0 right-0 h-[80px] z-20 pointer-events-none">
          <HeroBackground showTop={true} showBottom={false} className="h-full w-full" />
        </div>
      </section>

      {/* 2. Marquee */}
      <MarqueeStrip />

      {/* 3. The Problem */}
      <section className="bg-white py-20 lg:py-32 px-6 lg:px-[100px]">
        <div className="max-w-[1240px] mx-auto w-full">
          {/* Eyebrow */}
          <div className="flex items-center gap-3 mb-6">
            <span className="block h-[2px] w-7 bg-black/70" />
            <span className="font-body text-xs lg:text-sm font-semibold uppercase tracking-[0.25em] text-black/70">
              The Problem
            </span>
          </div>

          <h2 className="font-display text-[34px] sm:text-[44px] lg:text-[56px] font-black leading-[1.05] text-[#040504] max-w-[820px]">
            Your agent is only speaking to local buyers.
          </h2>

          <p className="mt-6 font-body text-base lg:text-lg leading-[1.6] text-black/70 max-w-[640px]">
            Mortgage launchers, holidaymakers, and lone Dubai investors quietly outbid the local market every week — but they will never see a listing that lives on UK portals alone.
          </p>

          <div className="mt-12 lg:mt-16 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
            {/* Left: paragraphs */}
            <div className="flex flex-col">
              {problemPoints.map((p, i) => (
                <div
                  key={i}
                  className="flex gap-4 py-7 border-t border-black/10 last:border-b"
                >
                  <span className="font-display text-sm font-semibold text-black/40 tracking-[-0.2px] shrink-0 w-6">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="font-body text-base lg:text-lg leading-[1.55] text-black/80">
                    {p}
                  </p>
                </div>
              ))}
            </div>

            {/* Right: stat card */}
            <div className="rounded-[24px] bg-[#F5F4F1] p-6 lg:p-8 flex flex-col gap-5">
              {problemStats.map((s) => (
                <div
                  key={s.value}
                  className="rounded-[18px] bg-white p-6 lg:p-7 flex flex-col gap-3"
                >
                  <div className="font-display text-[40px] lg:text-[56px] font-black leading-none text-[#040504] tracking-[-1.2px]">
                    {s.value}
                  </div>
                  <p className="font-body text-sm lg:text-base text-black/70 leading-[1.5]">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 4. How it works (magenta band) */}
      <section className="bg-[#A409D2] py-20 lg:py-32 px-6 lg:px-[100px]">
        <div className="max-w-[1240px] mx-auto w-full flex flex-col gap-12 lg:gap-16">
          <div className="flex flex-col gap-5 max-w-[820px]">
            <div className="flex items-center gap-3">
              <span className="block h-[2px] w-7 bg-white/70" />
              <span className="font-body text-xs lg:text-sm font-semibold uppercase tracking-[0.25em] text-white/80">
                How it works
              </span>
            </div>
            <h2 className="font-display text-[34px] sm:text-[44px] lg:text-[56px] font-black leading-[1.05] text-white">
              From briefing to international enquiries in weeks.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {howItWorks.map((s) => (
              <div
                key={s.step}
                className="rounded-[20px] bg-white/10 backdrop-blur-sm border border-white/15 p-6 lg:p-7 flex flex-col gap-4 min-h-[240px]"
              >
                <span className="font-display text-2xl font-black text-white/70 tracking-[-0.4px]">
                  {s.step}
                </span>
                <h3 className="font-display text-xl lg:text-2xl font-black text-white leading-[1.15]">
                  {s.title}
                </h3>
                <p className="font-body text-sm lg:text-[15px] text-white/85 leading-[1.55]">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Choose your reach (pricing) */}
      <section className="bg-white py-20 lg:py-32 px-6 lg:px-[100px]">
        <div className="max-w-[1280px] mx-auto w-full flex flex-col gap-12 lg:gap-16">
          <div className="flex flex-col items-center text-center gap-5">
            <span className="font-body text-xs lg:text-sm font-semibold uppercase tracking-[0.25em] text-black/70">
              Pricing
            </span>
            <h2 className="font-display text-[36px] sm:text-[44px] lg:text-[56px] font-black leading-[1.1] text-[#040504]">
              Choose your reach
            </h2>
            <p className="max-w-[640px] font-body text-base lg:text-lg text-black/70">
              Four flexible tiers designed for the way modern sellers and agents grow internationally.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {reachTiers.map((tier) => (
              <div
                key={tier.name}
                className={cn(
                  'relative flex flex-col p-6 lg:p-7 rounded-[20px] border-[1.5px] bg-white',
                  tier.recommended
                    ? 'border-[#A409D2] shadow-[0_8px_40px_-12px_rgba(164,9,210,0.35)]'
                    : 'border-black/10'
                )}
              >
                {tier.recommended && (
                  <div className="absolute -top-3 right-6 bg-[#A409D2] px-3 py-1 rounded-full">
                    <span className="font-display text-[11px] font-bold uppercase tracking-[0.12em] text-white">
                      Recommended
                    </span>
                  </div>
                )}

                <span className="font-display text-base font-bold uppercase tracking-[0.08em] text-black mb-5">
                  {tier.name}
                </span>

                <div className="flex items-baseline gap-2 mb-2">
                  <span className="font-display text-[32px] lg:text-[40px] font-black tracking-[-1px] text-[#1F1F1E]">
                    {tier.price}
                  </span>
                  <span className="font-body text-sm text-black/55">{tier.period}</span>
                </div>
                <p className="font-body text-sm text-black/70 leading-[1.5] mb-6 min-h-[60px]">
                  {tier.subtitle}
                </p>

                <div className="flex flex-col gap-3 pt-5 border-t border-black/10 flex-grow">
                  {tier.features.map((f, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#149D4F] mt-1 shrink-0" />
                      <span className="font-body text-sm font-medium text-black/75 leading-[1.5]">
                        {f}
                      </span>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={handleGetStarted}
                  className={cn(
                    'mt-6 h-12 px-5 rounded-[48px] font-body text-base font-semibold transition-colors',
                    tier.recommended
                      ? 'bg-[#A409D2] text-white hover:bg-[#A409D2]/90'
                      : 'bg-black text-white hover:bg-black/90'
                  )}
                >
                  Get Started
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. FAQ */}
      <section className="bg-[#F9F8F9] py-20 lg:py-32 px-6 lg:px-[100px]">
        <div className="max-w-[900px] mx-auto w-full flex flex-col gap-10 lg:gap-14">
          <div className="flex flex-col items-center text-center gap-4">
            <span className="font-body text-xs lg:text-sm font-semibold uppercase tracking-[0.25em] text-black/70">
              Common questions
            </span>
            <h2 className="font-display text-[34px] sm:text-[44px] lg:text-[56px] font-black leading-[1.1] text-[#040504]">
              Everything you need to know
            </h2>
          </div>

          <div className="flex flex-col">
            {faqs.map((item, idx) => {
              const isOpen = openFaq === idx;
              const btnId = `faq-trigger-${idx}`;
              const panelId = `faq-panel-${idx}`;
              return (
                <div key={idx} className="border-t border-black/10 last:border-b">
                  <h3>
                    <button
                      type="button"
                      id={btnId}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      className="w-full flex items-center justify-between gap-4 py-6 lg:py-7 text-left font-body text-lg lg:text-xl font-bold text-[#1F1F1E] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A409D2] focus-visible:rounded-md"
                    >
                      <span>{item.q}</span>
                      <span aria-hidden="true" className="shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-black/5 text-black">
                        {isOpen ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      </span>
                    </button>
                  </h3>
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={btnId}
                    hidden={!isOpen}
                  >
                    <p className="font-body text-base text-black/70 leading-[1.65] pb-6 lg:pb-8 pr-12">
                      {item.a}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 7. Bottom CTA */}
      <section className="relative flex flex-col items-center py-24 lg:py-32 px-6 lg:px-[100px] bg-white overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[260px] lg:h-[320px] z-10 pointer-events-none">
          <HeroBackground
            showTop={true}
            showBottom={false}
            className="h-full w-full bg-[#F9F8F9]"
          />
        </div>

        <div className="relative z-20 flex flex-col items-center text-center max-w-[760px] mx-auto gap-8 lg:gap-10">
          <h2 className="font-display text-[36px] sm:text-[48px] lg:text-[64px] font-black leading-[1.05] text-black tracking-[-1.2px]">
            Your buyer may not be in the UK.
          </h2>
          <p className="font-body text-base lg:text-lg text-black/75 leading-[1.55] max-w-[560px]">
            Open up to a global pool of qualified buyers and accelerate your sale — without changing agent.
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
            <Button
              onClick={handleGetStarted}
              className="h-14 px-8 bg-[#A409D2] text-white rounded-[48px] font-body text-lg font-semibold hover:bg-[#A409D2]/90 transition-colors w-full sm:w-auto"
            >
              Get Started
            </Button>
            <Button
              onClick={handleStrategyCall}
              className="h-14 px-8 bg-transparent border border-black text-black rounded-[48px] font-body text-lg font-semibold hover:bg-black/5 transition-colors w-full sm:w-auto"
            >
              Book a strategy call
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};
