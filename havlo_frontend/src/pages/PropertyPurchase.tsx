import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useModal } from '../hooks/useModal';
import { cn } from '../lib/utils';

const regions: { name: string; image: string; countries: string[] }[] = [
  {
    name: 'Europe',
    image: '/1.png',
    countries: [
      'United Kingdom', 'Spain', 'Portugal', 'France', 'Italy', 'Greece',
      'Germany', 'Netherlands', 'Switzerland', 'Ireland', 'Austria', 'Belgium',
      'Cyprus', 'Malta', 'Sweden', 'Norway', 'Denmark', 'Finland',
    ],
  },
  {
    name: 'Middle East',
    image: '/2.png',
    countries: ['United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Bahrain', 'Oman', 'Kuwait', 'Jordan', 'Israel'],
  },
  {
    name: 'Americas',
    image: '/3.png',
    countries: [
      'United States', 'Canada', 'Mexico', 'Brazil', 'Argentina',
      'Colombia', 'Chile', 'Costa Rica', 'Panama', 'Dominican Republic',
    ],
  },
  {
    name: 'Asia & Asia-Pacific',
    image: '/4.png',
    countries: [
      'Singapore', 'Japan', 'South Korea', 'Thailand', 'Indonesia',
      'Malaysia', 'Vietnam', 'Philippines', 'India', 'Australia', 'New Zealand',
    ],
  },
  {
    name: 'Africa',
    image: '/5.png',
    countries: ['South Africa', 'Morocco', 'Egypt', 'Kenya', 'Nigeria', 'Ghana', 'Tanzania', 'Mauritius'],
  },
  {
    name: 'Oceania',
    image: '/6.png',
    countries: ['Australia', 'New Zealand', 'Fiji'],
  },
];

export const PropertyPurchase: React.FC = () => {
  const { openModal } = useModal();
  const [activeRegion, setActiveRegion] = useState<string>(regions[0].name);
  const current = regions.find((r) => r.name === activeRegion) || regions[0];

  return (
    <div className="flex flex-col w-full bg-white">
      {/* 1. Hero */}
      <section className="relative flex flex-col items-center pt-16 lg:pt-24 pb-16 lg:pb-24 px-6 lg:px-[100px] bg-gradient-to-b from-[#FFB0E8] to-[#FEEAA0] overflow-hidden">
        <div className="relative z-10 flex flex-col items-center text-center max-w-[900px] mx-auto gap-6 lg:gap-10">
          <span className="font-body text-sm lg:text-lg font-medium uppercase tracking-[-0.36px] text-black">
            Property Purchase
          </span>
          <h1 className="font-display font-black tracking-[-1.2px] lg:tracking-[-1.6px] text-[#1F1F1E] text-[40px] sm:text-[52px] lg:text-[80px] leading-[1.05] lg:leading-[1.0]">
            Buy property in any country, with confidence
          </h1>
          <p className="font-body text-base lg:text-xl leading-[1.4] text-black max-w-[640px]">
            Browse the regions and countries we cover, then start your purchase journey with a vetted local team.
          </p>
        </div>
      </section>

      {/* 2. Regions tabs + countries grid */}
      <section className="flex flex-col items-center bg-white py-16 lg:py-24 px-6 lg:px-[100px]">
        <div className="max-w-[1240px] mx-auto w-full flex flex-col gap-10 lg:gap-14">
          <div className="flex flex-col gap-6">
            <h2 className="font-display text-[32px] sm:text-[40px] lg:text-[48px] font-black leading-[1.1] text-[#040504]">
              Browse by region
            </h2>
            <div className="flex flex-wrap gap-2 lg:gap-3">
              {regions.map((r) => (
                <button
                  key={r.name}
                  onClick={() => setActiveRegion(r.name)}
                  className={cn(
                    'px-4 lg:px-6 py-2.5 rounded-full font-body text-sm lg:text-base font-semibold transition-colors whitespace-nowrap',
                    activeRegion === r.name
                      ? 'bg-[#A409D2] text-white'
                      : 'bg-black/5 text-black hover:bg-black/10',
                  )}
                >
                  {r.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-stretch">
            <div className="lg:w-[40%] rounded-[24px] overflow-hidden bg-[#F9F8F9] aspect-[4/3] lg:aspect-auto">
              <img
                src={current.image}
                alt={current.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="lg:w-[60%] flex flex-col gap-6">
              <h3 className="font-display text-[28px] lg:text-[36px] font-black text-[#1F1F1E]">
                {current.name}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {current.countries.map((c) => (
                  <Link
                    key={c}
                    to={`/countries`}
                    className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-[#F9F8F9] border border-black/5 hover:border-[#A409D2]/40 transition-colors group"
                  >
                    <span className="font-body text-sm lg:text-base text-[#1F1F1E] truncate">
                      {c}
                    </span>
                    <ChevronRight className="w-4 h-4 text-black/40 group-hover:text-[#A409D2] shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. CTA */}
      <section className="flex flex-col items-center py-20 lg:py-24 px-6 lg:px-[100px] bg-[#F9F8F9]">
        <div className="flex flex-col items-center text-center max-w-[700px] mx-auto gap-6 lg:gap-8">
          <h2 className="font-display text-[32px] sm:text-[40px] lg:text-[48px] font-black leading-[1.1] text-black">
            Don't see your country?
          </h2>
          <p className="font-body text-base lg:text-lg text-black/70">
            We're constantly expanding. Tell us where you'd like to buy and we'll match you with a trusted partner.
          </p>
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
