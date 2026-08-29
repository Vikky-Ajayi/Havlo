import React from 'react';
import { cn } from '../lib/utils';
import { usePageMeta } from '../hooks/usePageMeta';
import { GEO_REGIONS as regions } from '../lib/geoCountries';

export const Countries: React.FC = () => {
  usePageMeta({
    title: 'International Property Markets by Country | Havlo',
    description: 'Explore property markets across Europe, the Middle East, Asia, and the Americas. Havlo connects buyers with vetted experts in over 40 countries worldwide.',
    canonical: 'https://www.heyhavlo.com/countries',
  });
  return (
    <div className="flex flex-col w-full bg-[#F8F7F7]">
      {/* 1. Hero Section */}
      <section className="flex flex-col items-center gap-8 px-4 text-center sm:px-10 lg:px-[100px] py-10 my-0">
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
