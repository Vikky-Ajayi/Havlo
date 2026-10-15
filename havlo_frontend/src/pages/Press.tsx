import React from 'react';
import { usePageMeta } from '../hooks/usePageMeta';

// The footer's "Press" page; laid out like About us (AboutUs.tsx).
export const Press: React.FC = () => {
  usePageMeta({
    title: 'Press | Havlo',
    description:
      "Havlo is a UK property intelligence and advisory platform that helps sellers and estate agents understand why a listing isn't moving, and what to do about it. Press enquiries: hello@heyhavlo.com.",
    canonical: 'https://www.heyhavlo.com/press',
  });

  return (
    <div className="flex w-full flex-col overflow-hidden bg-white text-[#050505]">
      <section className="bg-white px-6 pt-12 pb-16 sm:pt-16 sm:pb-20 lg:px-[100px] lg:pt-20 lg:pb-24">
        <h1 className="font-display text-[40px] font-black leading-[1.0] tracking-[-1px] text-[#0a0a0a] sm:text-[48px] lg:text-[56px]">
          Press
        </h1>

        <div className="mt-7 flex max-w-[900px] flex-col gap-5 font-body text-[15px] font-medium leading-[1.7] text-black/85 sm:text-base lg:text-[17px]">
          <p>
            Havlo is a UK property intelligence and advisory platform that helps sellers and estate agents understand why a
            listing isn't moving, and what to do about it.
          </p>
          <p>
            Our stale listing assessment combines in-house metrics with human review to diagnose underperforming listings and
            give clear, practical recommendations to get them sold. We work with independent agents, including those within
            some of the UK's largest estate chains, as well as homeowners whose properties have sat on the market too long.
          </p>
        </div>

        <h2 className="mt-12 font-body text-[22px] font-extrabold leading-[1.2] tracking-[-0.2px] text-[#0a0a0a] sm:text-[24px]">
          Press and feature enquiries
        </h2>
        <p className="mt-4 max-w-[900px] font-body text-[15px] font-medium leading-[1.7] text-black/85 sm:text-base lg:text-[17px]">
          For interviews, features, commentary on the UK property market, or press assets, contact us at{' '}
          <a href="mailto:hello@heyhavlo.com" className="font-bold text-[#a409d2] underline-offset-2 hover:underline">
            hello@heyhavlo.com
          </a>
          . We aim to respond within one working day.
        </p>
      </section>
    </div>
  );
};
