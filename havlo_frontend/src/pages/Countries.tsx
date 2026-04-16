import React from 'react';
import { cn } from '../lib/utils';

const regions = [
  {
    name: 'Europe',
    countries: [
      { name: 'United Kingdom', description: 'Strong property rights and transparent legal system. Seen as a long-term store of value, especially during global uncertainty.', flag: 'gb' },
      { name: 'Spain', description: 'Coastal homes, rentals, lifestyle', flag: 'es' },
      { name: 'Portugal', description: 'Algarve, Lisbon, Porto', flag: 'pt' },
      { name: 'France', description: 'Provence, Paris, Côte d’Azur', flag: 'fr' },
      { name: 'Italy', description: 'Tuscany, Sicily, cities & villages', flag: 'it' },
      { name: 'Greece', description: 'Islands + Golden Visa appeal', flag: 'gr' },
      { name: 'Cyprus', description: 'Tax-friendly, expat-heavy', flag: 'cy' },
      { name: 'Turkey', description: 'Affordable + citizenship routes', flag: 'tr' },
      { name: 'Croatia', description: 'Adriatic coast popularity', flag: 'hr' },
      { name: 'Montenegro', description: 'Emerging Mediterranean hotspot', flag: 'me' },
      { name: 'Malta', description: 'Residency and EU access', flag: 'mt' },
      { name: 'Bulgaria', description: 'Low entry prices', flag: 'bg' },
      { name: 'Hungary', description: 'Budapest investment demand', flag: 'hu' },
      { name: 'Romania', description: 'Growth-focused investors', flag: 'ro' },
      { name: 'Poland', description: 'Strong rental markets', flag: 'pl' },
      { name: 'Czech Republic', description: 'Prague-led demand', flag: 'cz' },
      { name: 'Ireland', description: 'Stable market, UK-linked buyers', flag: 'ie' },
      { name: 'Germany', description: 'Capital preservation buyers', flag: 'de' },
      { name: 'Austria', description: 'Alpine lifestyle homes', flag: 'at' },
    ]
  },
  {
    name: 'Middle East',
    countries: [
      { name: 'United Arab Emirates (Dubai)', description: 'Freehold zones, strong yields', flag: 'ae' },
      { name: 'Saudi Arabia', description: 'New foreign ownership reforms', flag: 'sa' },
      { name: 'Oman', description: 'Integrated Tourism Complexes for expats', flag: 'om' },
    ]
  },
  {
    name: 'Americas',
    countries: [
      { name: 'United States', description: 'Florida, Texas, California', flag: 'us' },
      { name: 'Mexico', description: 'Beach + city markets', flag: 'mx' },
      { name: 'Canada', description: 'Lifestyle and stability buyers', flag: 'ca' },
      { name: 'Costa Rica', description: 'Eco-lifestyle homes', flag: 'cr' },
      { name: 'Panama', description: 'Retiree and expat appeal', flag: 'pa' },
      { name: 'Dominican Republic', description: 'Caribbean rental demand', flag: 'do' },
      { name: 'Brazil', description: 'Open foreign ownership', flag: 'br' },
      { name: 'Colombia', description: 'Medellín & coastal growth', flag: 'co' },
    ]
  },
  {
    name: 'Asia & Asia-Pacific',
    countries: [
      { name: 'Thailand', description: 'Condos + lifestyle buyers', flag: 'th' },
      { name: 'Indonesia (Bali)', description: 'Leasehold investment demand', flag: 'id' },
      { name: 'Philippines', description: 'Condo ownership for foreigners', flag: 'ph' },
      { name: 'Malaysia', description: 'MM2H-linked interest', flag: 'my' },
      { name: 'Vietnam', description: 'Emerging urban markets', flag: 'vn' },
      { name: 'Japan', description: 'Low prices outside Tokyo', flag: 'jp' },
      { name: 'Sri Lanka', description: 'Beachfront and resort projects', flag: 'lk' },
    ]
  },
  {
    name: 'Africa',
    countries: [
      { name: 'South Africa', description: 'Lifestyle + luxury homes', flag: 'za' },
      { name: 'Morocco', description: 'Marrakech & coastal demand', flag: 'ma' },
      { name: 'Egypt', description: 'Resort developments (Red Sea)', flag: 'eg' },
    ]
  },
  {
    name: 'Oceania',
    countries: [
      { name: 'Australia', description: 'Lifestyle, education-linked buyers', flag: 'au' },
    ]
  }
];

export const Countries: React.FC = () => {
  return (
    <div className="flex flex-col w-full bg-[#F8F7F7]">
      {/* 1. Hero Section */}
      <section className="flex flex-col items-center gap-8 px-4 py-20 text-center sm:px-10 lg:px-[100px]">
        <div className="flex flex-col items-center gap-6">
          <h1 className="font-display text-[56px] font-black leading-[1.1] text-[#040504] sm:text-[64px] tracking-tight">
            Where We Operate
          </h1>
          <p className="max-w-[652px] font-body text-[22px] font-normal leading-[1.2] text-black/80">
            We specialize in helping you purchase property across select international markets, with expert local knowledge and dedicated support.
          </p>
        </div>
      </section>

      {/* 2. Regions and Countries */}
      <div className="flex flex-col gap-20 px-4 pb-32 sm:px-10 lg:px-[100px]">
        {regions.map((region) => (
          <div key={region.name} className="flex flex-col gap-8">
            {/* Region Header */}
            <div className="flex items-center gap-4">
              <h2 className="font-display text-[32px] font-medium leading-[1.1] text-[#040504] whitespace-nowrap">
                {region.name}
              </h2>
              <div className="h-[1px] w-full bg-black/50" />
            </div>

            {/* Country Grid */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {region.countries.map((country) => (
                <div 
                  key={country.name} 
                  className="flex flex-col gap-6 rounded-[16px] border border-white/10 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-300 group"
                >
                  <div className="flex items-start justify-between">
                    <div className="h-10 w-10 overflow-hidden rounded-full shadow-sm border border-black/5">
                      <img 
                        src={`https://flagcdn.com/w80/${country.flag}.png`} 
                        alt={`${country.name} flag`}
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-4">
                    <h3 className="font-display text-2xl font-black leading-[1.1] text-[#040504]">
                      {country.name}
                    </h3>
                    <p className="font-body text-base font-normal leading-[1.4] text-black/70">
                      {country.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
