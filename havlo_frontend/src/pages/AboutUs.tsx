import React from 'react';
import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';

type ServiceCard = {
  title: string;
  description: string;
  href: string;
  background: string;
};

const serviceCards: ServiceCard[] = [
  {
    title: 'Buy Property Abroad',
    description:
      "Expert advisory for acquiring residential and commercial property abroad. We handle the complexity so you don't have to.",
    href: '/buy-property-abroad',
    background: '#FFEBF9',
  },
  {
    title: 'Property Matching',
    description:
      'Get matched to the right property and enjoy discounted legal fees when buying through our nominated agent.',
    href: '/property-matching',
    background: '#EBFFF6',
  },
  {
    title: 'Elite Property Introductions',
    description:
      'Showcase your property to a curated list of ready-to-buy offshore buyers who are actively seeking.',
    href: '/elite-property',
    background: '#FFFEEB',
  },
  {
    title: 'Sell Faster (Havlo Relaunch\u2122)',
    description:
      'A dedicated programme helping slow-to-sell properties listed for over 6 months find their buyer.',
    href: '/sell-your-property',
    background: '#EBF4FF',
  },
  {
    title: 'Property Sale Audit (Havlo Relaunch Assessment)',
    description:
      "Uncover why your property hasn't sold and get a clear, actionable plan to relaunch it successfully. We analyse pricing, presentation, and market positioning to identify obstacles and recommend the best steps to attract serious buyers.",
    href: '/property-audit',
    background: '#FDECEE',
  },
  {
    title: 'International Buyer Network',
    description:
      'Sell properties faster by going beyond property portals and connecting listings with a curated network of qualified, ready-to-buy international buyers.',
    href: '/buyer-network',
    background: '#FFEBF9',
  },
];

export const AboutUs: React.FC = () => {
  usePageMeta({
    title: 'About Us | Trusted Global Property Experts | Havlo',
    description:
      "Havlo is a property exposure and advisory platform helping buyers discover and access real estate opportunities abroad with confidence. Learn about Havlo's mission, values, and expertise in international real estate.",
    canonical: 'https://www.heyhavlo.com/about-us',
  });

  return (
    <div className="flex w-full flex-col overflow-hidden bg-white text-[#050505]">
      {/* INTRO SECTION */}
      <section className="bg-white px-6 pt-12 pb-10 sm:pt-16 lg:px-[100px] lg:pt-20 lg:pb-14">
        <div>
          <h1 className="font-display text-[40px] font-black leading-[1.0] tracking-[-1px] text-[#0a0a0a] sm:text-[48px] lg:text-[56px]">
            About us
          </h1>

          <p className="mt-6 font-body text-lg font-semibold leading-[1.4] text-black sm:text-xl lg:text-[22px]">
            Beyond borders. Beyond portals.
          </p>

          <div className="mt-7 flex flex-col gap-5 font-body text-[15px] font-medium leading-[1.7] text-black/85 sm:text-base lg:text-[17px]">
            <p>
              Havlo is a <span className="font-bold">property exposure</span> and advisory platform helping buyers discover and{' '}
              <span className="font-bold">access real estate opportunities abroad</span> with confidence. We connect{' '}
              <span className="font-bold">international property listings</span> with a global audience of{' '}
              <span className="font-bold">motivated buyers</span>, making it easier to explore, compare, and act on opportunities beyond your local market. Whether you're looking for a second home, an{' '}
              <span className="font-bold">investment property</span>, or a move overseas, Havlo brings clarity to a process that can often feel complex and fragmented.
            </p>
            <p>
              Our platform is built to <span className="font-bold">give buyers better access to international property markets</span>, while helping sellers and agents reach{' '}
              <span className="font-bold">qualified overseas demand</span>. Alongside exposure, we provide advisory support to help users understand markets, navigate cross-border purchasing, and make more informed decisions.
            </p>
            <p>
              At Havlo, we believe buying property abroad should be{' '}
              <span className="font-bold">simple, transparent, and accessible,</span> not limited by geography.
            </p>
            <p>
              Havlo is a trading style of Sprint Technologies Ltd, 2nd Floor,{' '}
              <span className="font-bold">Berkeley Square, London, England, W1J 6BD.</span> Registered in England and Wales with Company No. 14949509. VAT Registration Number: 511860708.
            </p>
          </div>
        </div>
      </section>

      {/* SERVICE CARDS GRID */}
      <section className="bg-white px-6 pb-16 sm:pb-20 lg:px-[100px] lg:pb-24">
        <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {serviceCards.map((card) => (
            <div
              key={card.title}
              className="flex min-h-[300px] flex-col p-7 sm:p-8"
              style={{ backgroundColor: card.background }}
            >
              <h3 className="font-body text-[22px] font-extrabold leading-[1.2] tracking-[-0.2px] text-[#0a0a0a] sm:text-[24px]">
                {card.title}
              </h3>
              <p className="mt-4 flex-1 font-body text-[14px] font-medium leading-[1.6] text-black/75 sm:text-[15px]">
                {card.description}
              </p>
              <Link
                to={card.href}
                className="mt-6 font-body text-[13px] font-extrabold uppercase tracking-[0.12em] text-[#a409d2] transition hover:text-[#7a06a0]"
              >
                Learn more →
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
