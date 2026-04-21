import React, { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { HeroBackground } from '../components/shared/HeroBackground';
import { useModal } from '../hooks/useModal';

const offers = [
  'Bespoke consultation tailored to your goals',
  'Property positioning, valuation and pricing strategy',
  'Local expert representation in your target country',
  'End-to-end marketing and qualified buyer management',
  'Dedicated completion and post-sale support',
];

const howItWorks = [
  {
    title: 'Bespoke Consultation',
    desc: 'A dedicated advisor takes time to understand your goals, budget and ideal timeline before we recommend a strategy.',
  },
  {
    title: 'Property Positioning & Valuation',
    desc: 'We position your property — or your purchase brief — with sharp pricing and presentation built for the target market.',
  },
  {
    title: 'Local Expert Representation',
    desc: 'You get a vetted on-the-ground partner in-country who handles meetings, viewings and negotiations on your behalf.',
  },
  {
    title: 'Marketing & Buyer Management',
    desc: 'High-impact creative, targeted exposure and tight buyer qualification — only serious enquiries reach you.',
  },
  {
    title: 'Completion & Post-Sale Support',
    desc: 'We coordinate paperwork, legal handover and post-completion logistics so the close is calm and clean.',
  },
];

export const CompleteHomeBuying: React.FC = () => {
  const { openModal } = useModal();
  const [propertyPrice, setPropertyPrice] = useState('');
  const calculatedPrice = useMemo(() => {
    const cleaned = propertyPrice.replace(/,/g, '').trim();
    if (!cleaned) return '—';
    const num = Number(cleaned);
    if (Number.isNaN(num)) return '—';
    const val = num * 0.05;
    const hasPence = Math.abs(val - Math.trunc(val)) > 0;
    return val.toLocaleString('en-GB', {
      minimumFractionDigits: hasPence ? 2 : 0,
      maximumFractionDigits: hasPence ? 2 : 0,
    });
  }, [propertyPrice]);

  return (
    <div className="flex flex-col w-full bg-white">
      {/* 1. Hero */}
      <section className="relative flex flex-col items-center pt-[68px] lg:pt-24 pb-32 lg:pb-48 px-6 lg:px-[100px] bg-gradient-to-b from-[#FFB0E8] to-[#FEEAA0] overflow-hidden">
        <div className="relative z-10 flex flex-col items-center text-center max-w-[900px] mx-auto gap-6 lg:gap-10">
          <span className="font-body text-sm lg:text-lg font-medium uppercase tracking-[-0.36px] text-black">
            Complete Home Buying Experience
          </span>
          <h1 className="font-display font-black tracking-[-1.2px] lg:tracking-[-1.6px] text-[#1F1F1E] text-[40px] sm:text-[52px] lg:text-[80px] leading-[1.05] lg:leading-[1.0]">
            Buying a home abroad just got a whole lot easier
          </h1>
          <p className="font-body text-base lg:text-xl leading-[1.4] text-black max-w-[640px]">
            Everything you need from a single team — strategy, search, in-country representation, and completion.
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
            <Button
              onClick={() => openModal('create-account')}
              className="h-14 px-8 bg-black text-white rounded-[48px] font-body text-lg font-semibold hover:bg-black/90 transition-colors"
            >
              Get Started
            </Button>
            <Button
              onClick={() => openModal('create-account')}
              className="h-14 px-8 bg-white text-black border border-black rounded-[48px] font-body text-lg font-semibold hover:bg-black/5 transition-colors"
            >
              Track everything in your dashboard
            </Button>
          </div>
        </div>
        <div className="absolute bottom-[-1px] left-0 right-0 h-[80px] z-20 pointer-events-none">
          <HeroBackground showTop={true} showBottom={false} className="h-full w-full" />
        </div>
      </section>

      {/* 2. What we offer */}
      <section className="flex flex-col items-center bg-white py-[84px] lg:py-32 px-6 lg:px-[100px]">
        <div className="max-w-[1100px] mx-auto w-full flex flex-col gap-10 lg:gap-14">
          <div className="flex flex-col gap-4">
            <span className="font-body text-sm font-bold uppercase tracking-[0.1em] text-[#A409D2]">
              What we offer
            </span>
            <h2 className="font-display text-[36px] sm:text-[44px] lg:text-[56px] font-black leading-[1.1] text-[#040504]">
              A complete service from £4,500
            </h2>
            <p className="font-body text-base lg:text-lg text-black/70 max-w-[640px]">
              One transparent fee covers every stage of the journey — no hidden costs, no surprises.
            </p>
          </div>
          <ul className="flex flex-col">
            {offers.map((item, idx) => (
              <li
                key={idx}
                className="py-5 lg:py-6 border-t border-black/10 last:border-b flex items-start gap-3"
              >
                <Check className="w-5 h-5 text-[#149D4F] mt-1 shrink-0" />
                <span className="font-body text-base lg:text-lg text-[#1F1F1E]">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 3. How it works */}
      <section className="flex flex-col bg-[#A409D2] py-[68px] lg:py-32 px-6 lg:px-[100px]">
        <div className="max-w-[1100px] mx-auto w-full flex flex-col gap-8 lg:gap-14">
          <h2 className="font-display text-[36px] sm:text-[44px] lg:text-[56px] font-black leading-[1.1] text-white">
            How it works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6">
            {howItWorks.map((step, idx) => (
              <div
                key={idx}
                className="flex flex-col gap-5 p-6 lg:p-8 rounded-[20px] bg-white border border-black/5"
              >
                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-[#F5D8FD]">
                  <span className="font-display text-base font-bold text-[#A409D2]">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                </div>
                <h3 className="font-display text-xl lg:text-2xl font-bold text-[#1F1F1E] leading-tight">
                  {step.title}
                </h3>
                <p className="font-body text-sm lg:text-base text-black/70 leading-[1.6]">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Let's talk fees */}
      <section className="flex flex-col items-center bg-white py-[84px] lg:py-32 px-6 lg:px-[100px]">
        <div className="max-w-[700px] mx-auto w-full flex flex-col items-center text-center gap-8 lg:gap-10 p-8 lg:p-12 rounded-[24px] bg-[#FAEBFE]">
          <h2 className="font-display text-[32px] sm:text-[40px] lg:text-[48px] font-black leading-[1.1] text-[#040504]">
            Let's talk fees
          </h2>
          <div className="w-full max-w-[520px] space-y-4 text-left">
            <label className="block font-body text-base font-semibold text-black">Your property price</label>
            <div className="flex items-center gap-3 rounded-lg border border-black/10 bg-white px-4 py-3">
              <span className="font-display text-2xl text-black">£</span>
              <input
                type="text"
                value={propertyPrice}
                onChange={(e) => setPropertyPrice(e.target.value)}
                className="w-full bg-transparent font-body text-base text-black outline-none"
                placeholder="Enter price"
              />
            </div>
            <div className="rounded-lg bg-[#00FF8C] px-4 py-3 font-body text-base font-semibold text-[#040405]">
              Your price: {calculatedPrice === '—' ? '—' : `£${calculatedPrice}`}
            </div>
          </div>
          <Button
            onClick={() => openModal('create-account')}
            className="h-14 px-8 bg-black text-white rounded-[48px] font-body text-lg font-semibold hover:bg-black/90 transition-colors w-full sm:w-auto"
          >
            Get Started
          </Button>
        </div>
      </section>
    </div>
  );
};
