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
    title: 'Custom Offers',
    description:
      'Submit flexible or non-standard property proposals directly to homeowners and present your terms professionally when a standard offer alone does not tell the full story.',
    href: '/custom-offers',
    background: '#EBFFF6',
  },
  {
    title: 'Stale Listings',
    description:
      "Uncover why your property hasn't sold and get a clear, actionable plan to relaunch it successfully. We analyse pricing, presentation, and market positioning to identify obstacles and recommend the best steps to attract serious buyers.",
    href: '/stale-listings',
    background: '#EBF4FF',
  },
];

export const AboutUs: React.FC = () => {
  usePageMeta({
    title: 'About Us | Property Listing Intelligence & Advisory | Havlo',
    description:
      "Havlo is a property listing intelligence and advisory platform. We help sellers and estate agents understand why a property isn't selling, and exactly what to do about it.",
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
            Beyond the portals.
          </p>

          <div className="mt-7 flex flex-col gap-5 font-body text-[15px] font-medium leading-[1.7] text-black/85 sm:text-base lg:text-[17px]">
            <p>
              Havlo is a <span className="font-bold">property listing intelligence</span> and advisory platform. We help sellers and estate agents understand{' '}
              <span className="font-bold">why a property isn't selling</span>, and exactly what to do about it.
            </p>
            <p>
              A listing rarely stalls for one obvious reason. It's usually a mix of pricing, photos, description, timing and how the property stacks up against local competition. Our{' '}
              <span className="font-bold">stale listing assessment</span> looks at all of it. Using our own in-house metrics and a{' '}
              <span className="font-bold">human review of every listing</span>, we pinpoint what's holding a property back and give clear, practical recommendations to get it moving. Not just a score, but a plan you can act on.
            </p>
            <p>
              We work with <span className="font-bold">homeowners</span> whose properties have sat on the market too long, and with{' '}
              <span className="font-bold">independent agents</span>, including those within some of the UK's largest estate chains, who want a sharper edge on their slower stock.
            </p>
            <p>
              Alongside this, <span className="font-bold">Havlo Buy Abroad</span> helps international buyers find and purchase property in the UK, giving them guidance and support through a process that can feel complex from overseas.
            </p>
            <p>
              At Havlo, we believe every property deserves to be seen by the right buyer, and every buyer deserves a clear path to the right property.
            </p>
            <p>
              Havlo Ltd, registered in England and Wales (Company No. 15369975). Office:{' '}
              <span className="font-bold">2nd Floor, Berkeley Square, London, England, W1J 6BD.</span>
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
