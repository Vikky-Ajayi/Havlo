import React from 'react';
import { Check } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { HeroBackground } from '../components/shared/HeroBackground';
import { MarqueeStrip } from '../components/shared/MarqueeStrip';
import { useModal } from '../hooks/useModal';

const reachTiers = [
  {
    name: 'STARTER',
    price: '£1,500/mo',
    subtitle: 'For agents just starting global outreach',
    features: [
      'Listing on Havlo platform',
      'Basic international exposure',
      'Monthly performance summary',
      'Email support',
    ],
    recommended: false,
  },
  {
    name: 'GROWTH',
    price: '£3,500/mo',
    subtitle: 'For agencies expanding internationally',
    features: [
      'Everything in Starter',
      'Targeted ad campaigns',
      'Multi-region buyer matching',
      'Bi-weekly reporting',
      'Priority support',
    ],
    recommended: true,
  },
  {
    name: 'PREMIUM',
    price: '£7,000+/mo',
    subtitle: 'For high-volume agencies and developers',
    features: [
      'Everything in Growth',
      'Dedicated campaign manager',
      'Bespoke creative production',
      'Weekly strategy calls',
      'Co-branded marketing assets',
    ],
    recommended: false,
  },
];

const faqs = [
  {
    q: 'How quickly will my listings start receiving international interest?',
    a: 'Most agents see qualified enquiries within the first 2–4 weeks of going live, depending on the markets we target.',
  },
  {
    q: 'Do you replace my existing marketing channels?',
    a: 'No. Havlo complements your current channels by adding international exposure your local portals cannot reach.',
  },
  {
    q: 'Can I change tier later?',
    a: 'Yes. You can upgrade or downgrade at any time and we will pro-rate the difference.',
  },
  {
    q: 'Who handles the creative work?',
    a: 'On Growth and Premium, our team produces tailored creative. On Starter, you supply assets and we optimise them.',
  },
];

export const Marketing: React.FC = () => {
  const { openModal } = useModal();

  return (
    <div className="flex flex-col w-full bg-white">
      {/* 1. Hero */}
      <section className="relative flex flex-col items-center pt-16 lg:pt-24 pb-32 lg:pb-48 px-6 lg:px-[100px] bg-gradient-to-b from-[#FFB0E8] to-[#FEEAA0] overflow-hidden">
        <div className="relative z-10 flex flex-col items-center text-center max-w-[900px] mx-auto gap-6 lg:gap-10">
          <span className="font-body text-sm lg:text-lg font-medium uppercase tracking-[-0.36px] text-black">
            Havlo Marketing
          </span>
          <h1 className="font-display font-black tracking-[-1.2px] lg:tracking-[-1.6px] text-[#1F1F1E] text-[44px] sm:text-[56px] lg:text-[88px] leading-[1.05] lg:leading-[1.0]">
            Sell faster with international marketing built for agents
          </h1>
          <p className="font-body text-base lg:text-xl leading-[1.4] text-black max-w-[640px]">
            Reach high-intent buyers across borders with structured campaigns, transparent reporting, and a curated international network.
          </p>
          <Button
            onClick={() => openModal('create-account')}
            className="h-14 px-8 bg-black text-white rounded-[48px] font-body text-lg font-semibold hover:bg-black/90 transition-colors w-full sm:w-auto"
          >
            Get Started
          </Button>
        </div>
        <div className="absolute bottom-[-1px] left-0 right-0 h-[80px] z-20 pointer-events-none">
          <HeroBackground showTop={true} showBottom={false} className="h-full w-full" />
        </div>
      </section>

      {/* 2. Marquee Strip */}
      <MarqueeStrip />

      {/* 3. Choose your reach */}
      <section className="flex flex-col items-center bg-white py-20 lg:py-32 px-6 lg:px-[100px]">
        <div className="max-w-[1240px] mx-auto w-full flex flex-col gap-12 lg:gap-16">
          <div className="flex flex-col items-center text-center gap-6">
            <h2 className="font-display text-[36px] sm:text-[44px] lg:text-[56px] font-black leading-[1.1] text-[#040504]">
              Choose your reach
            </h2>
            <p className="max-w-[640px] font-body text-base lg:text-lg text-black/70">
              Three flexible tiers designed for the way modern agencies grow internationally.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reachTiers.map((tier) => (
              <div
                key={tier.name}
                className="flex flex-col p-6 rounded-[20px] border-[1.5px] border-black/10 relative bg-white"
              >
                <div className="flex justify-between items-center mb-6 min-h-[29px]">
                  <span className="font-display text-base lg:text-lg font-medium uppercase tracking-[-0.36px] text-black">
                    {tier.name}
                  </span>
                  {tier.recommended && (
                    <div className="bg-[#00BC67] px-2 py-1">
                      <span className="font-display text-xs lg:text-sm font-medium uppercase tracking-[-0.18px] text-white">
                        RECOMMENDED
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-3 mb-6">
                  <div className="font-display text-2xl lg:text-[28px] font-semibold tracking-[-0.56px] text-[#1F1F1E]">
                    {tier.price}
                  </div>
                  <div className="font-body text-sm font-normal tracking-[-0.28px] text-black/70">
                    {tier.subtitle}
                  </div>
                </div>
                <div className="flex flex-col gap-4 pt-4 border-t border-black/10">
                  {tier.features.map((f, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#149D4F] mt-1 shrink-0" />
                      <span className="font-body text-sm lg:text-base font-medium tracking-[-0.32px] text-black/70">
                        {f}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Everything you need to know */}
      <section className="flex flex-col items-center bg-[#F9F8F9] py-20 lg:py-32 px-6 lg:px-[100px]">
        <div className="max-w-[900px] mx-auto w-full flex flex-col gap-10 lg:gap-14">
          <h2 className="font-display text-[36px] sm:text-[44px] lg:text-[56px] font-black leading-[1.1] text-[#040504] text-center">
            Everything you need to know
          </h2>
          <div className="flex flex-col">
            {faqs.map((item, idx) => (
              <div key={idx} className="py-6 lg:py-8 border-t border-black/10 last:border-b">
                <h3 className="font-body text-lg lg:text-xl font-bold text-[#1F1F1E] mb-3">
                  {item.q}
                </h3>
                <p className="font-body text-base text-black/70 leading-[1.6]">
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Bottom CTA */}
      <section className="relative flex flex-col items-center py-20 lg:py-24 px-6 lg:px-[100px] bg-white overflow-hidden min-h-[400px] justify-center">
        <div className="relative z-20 flex flex-col items-center text-center max-w-[700px] mx-auto gap-10 lg:gap-14">
          <div className="flex flex-col items-center gap-6 lg:gap-8">
            <h2 className="font-display text-[36px] sm:text-[44px] font-black leading-[1.1] text-black">
              Your buyer may not be in your zip code
            </h2>
            <p className="font-body text-base lg:text-lg text-black leading-[1.5]">
              Open up to a global pool of qualified buyers and accelerate your sales pipeline.
            </p>
          </div>
          <Button
            onClick={() => openModal('create-account')}
            className="h-14 px-8 bg-[#A409D2] text-white rounded-[48px] font-body text-lg font-semibold hover:bg-[#A409D2]/90 transition-colors w-full sm:w-auto"
          >
            Get Started
          </Button>
        </div>
        <div className="absolute top-0 left-0 right-0 h-[300px] z-10 pointer-events-none">
          <HeroBackground showTop={true} showBottom={false} className="h-full w-full bg-[#F9F8F9]" />
        </div>
      </section>
    </div>
  );
};
