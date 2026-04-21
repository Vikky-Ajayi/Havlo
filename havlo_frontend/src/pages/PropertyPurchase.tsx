import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useModal } from '../hooks/useModal';

type Country = { name: string; flag: string };
type Region = { name: string; intro: string; countries: Country[] };

const regions: Region[] = [
  {
    name: 'Europe',
    intro: 'Established markets, strong rental demand and a clear residency path for many nationalities.',
    countries: [
      { name: 'United Kingdom', flag: '🇬🇧' },
      { name: 'Spain', flag: '🇪🇸' },
      { name: 'Portugal', flag: '🇵🇹' },
      { name: 'France', flag: '🇫🇷' },
      { name: 'Italy', flag: '🇮🇹' },
      { name: 'Greece', flag: '🇬🇷' },
      { name: 'Germany', flag: '🇩🇪' },
      { name: 'Netherlands', flag: '🇳🇱' },
      { name: 'Switzerland', flag: '🇨🇭' },
      { name: 'Ireland', flag: '🇮🇪' },
      { name: 'Cyprus', flag: '🇨🇾' },
      { name: 'Malta', flag: '🇲🇹' },
    ],
  },
  {
    name: 'Middle East',
    intro: 'Tax-efficient ownership in fast-growing markets, with strong off-plan and luxury inventory.',
    countries: [
      { name: 'United Arab Emirates', flag: '🇦🇪' },
      { name: 'Saudi Arabia', flag: '🇸🇦' },
      { name: 'Qatar', flag: '🇶🇦' },
      { name: 'Bahrain', flag: '🇧🇭' },
      { name: 'Oman', flag: '🇴🇲' },
      { name: 'Kuwait', flag: '🇰🇼' },
      { name: 'Jordan', flag: '🇯🇴' },
      { name: 'Israel', flag: '🇮🇱' },
    ],
  },
  {
    name: 'Americas',
    intro: 'Diversified residential and commercial opportunities across North, Central and South America.',
    countries: [
      { name: 'United States', flag: '🇺🇸' },
      { name: 'Canada', flag: '🇨🇦' },
      { name: 'Mexico', flag: '🇲🇽' },
      { name: 'Brazil', flag: '🇧🇷' },
      { name: 'Argentina', flag: '🇦🇷' },
      { name: 'Colombia', flag: '🇨🇴' },
      { name: 'Chile', flag: '🇨🇱' },
      { name: 'Costa Rica', flag: '🇨🇷' },
      { name: 'Panama', flag: '🇵🇦' },
      { name: 'Dominican Republic', flag: '🇩🇴' },
    ],
  },
  {
    name: 'Asia & Pacific',
    intro: 'Dynamic urban centres, beach lifestyle markets and structured investment routes across Asia-Pacific.',
    countries: [
      { name: 'Singapore', flag: '🇸🇬' },
      { name: 'Japan', flag: '🇯🇵' },
      { name: 'South Korea', flag: '🇰🇷' },
      { name: 'Thailand', flag: '🇹🇭' },
      { name: 'Indonesia', flag: '🇮🇩' },
      { name: 'Malaysia', flag: '🇲🇾' },
      { name: 'Vietnam', flag: '🇻🇳' },
      { name: 'Philippines', flag: '🇵🇭' },
      { name: 'India', flag: '🇮🇳' },
      { name: 'Australia', flag: '🇦🇺' },
      { name: 'New Zealand', flag: '🇳🇿' },
      { name: 'Fiji', flag: '🇫🇯' },
    ],
  },
  {
    name: 'Africa',
    intro: 'High-growth and lifestyle markets with strong returns for early movers.',
    countries: [
      { name: 'South Africa', flag: '🇿🇦' },
      { name: 'Morocco', flag: '🇲🇦' },
      { name: 'Egypt', flag: '🇪🇬' },
      { name: 'Kenya', flag: '🇰🇪' },
      { name: 'Nigeria', flag: '🇳🇬' },
      { name: 'Ghana', flag: '🇬🇭' },
      { name: 'Tanzania', flag: '🇹🇿' },
      { name: 'Mauritius', flag: '🇲🇺' },
    ],
  },
];

export const PropertyPurchase: React.FC = () => {
  const { openModal } = useModal();

  return (
    <div className="flex flex-col w-full bg-white">
      {/* 1. Hero */}
      <section className="relative flex flex-col items-center pt-16 lg:pt-24 pb-16 lg:pb-24 px-6 lg:px-[100px] bg-gradient-to-b from-[#FF8FDD] via-[#FFC78A] to-[#FFD85C] overflow-hidden">
        <div className="relative z-10 flex flex-col items-center text-center max-w-[900px] mx-auto gap-6 lg:gap-10">
          <span className="font-body text-sm lg:text-lg font-medium uppercase tracking-[-0.36px] text-black">
            Property Purchase
          </span>
          <h1 className="font-display font-black tracking-[-1.2px] lg:tracking-[-1.6px] text-[#1F1F1E] text-[40px] sm:text-[52px] lg:text-[80px] leading-[1.05] lg:leading-[1.0]">
            Buy property in any country, with confidence
          </h1>
          <p className="font-body text-base lg:text-xl leading-[1.4] text-black max-w-[640px]">
            Browse our country directory by region, then start your purchase journey with a vetted local team.
          </p>
        </div>
      </section>

      {/* 2. Country directory grouped by region */}
      <section className="flex flex-col items-center bg-white py-16 lg:py-24 px-6 lg:px-[100px]">
        <div className="max-w-[1240px] mx-auto w-full flex flex-col gap-16 lg:gap-20">
          {regions.map((region) => (
            <div key={region.name} className="flex flex-col gap-6 lg:gap-8">
              <div className="flex flex-col gap-3 max-w-[760px]">
                <h2 className="font-display text-[28px] sm:text-[36px] lg:text-[44px] font-black leading-[1.1] text-[#040504]">
                  {region.name}
                </h2>
                <p className="font-body text-base lg:text-lg text-black/70">
                  {region.intro}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
                {region.countries.map((c) => (
                  <Link
                    key={c.name}
                    to="/countries"
                    className="group flex items-center justify-between gap-3 px-4 lg:px-5 py-4 rounded-xl bg-[#F9F8F9] border border-black/5 hover:border-[#A409D2]/40 hover:bg-white transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl shrink-0" aria-hidden="true">{c.flag}</span>
                      <span className="font-body text-sm lg:text-base font-medium text-[#1F1F1E] truncate">
                        {c.name}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-black/40 group-hover:text-[#A409D2] shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
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
