import React from 'react';
import { Link } from 'react-router-dom';

export const AboutUs: React.FC = () => {
  return (
    <div className="flex flex-col w-full overflow-hidden bg-white">
      <section className="bg-gradient-to-b from-[#FF8FDD] via-[#FFC78A] to-[#FFD85C] px-4 sm:px-10 lg:px-[100px] py-10 my-0">
        <div className="mx-auto max-w-[1100px] space-y-8">
          <h1 className="font-display text-[40px] font-black leading-[1.05] tracking-[-1px] text-[#1F1F1E] sm:text-[60px] lg:text-[72px]">
            Beyond borders. Beyond portals.
          </h1>
          <p className="font-body text-base font-normal leading-[1.7] text-black">
            Havlo is a property exposure and advisory platform helping buyers discover and access real estate opportunities abroad with confidence. We connect international property listings with a global audience of motivated buyers, making it easier to explore, compare, and act on opportunities beyond your local market. Whether you're looking for a second home, an investment property, or a move overseas, Havlo brings clarity to a process that can often feel complex and fragmented.
          </p>
          <p className="font-body text-base font-normal leading-[1.7] text-black">
            Our platform is built to give buyers better access to international property markets, while helping sellers and agents reach qualified overseas demand. Alongside exposure, we provide advisory support to help users understand markets, navigate cross-border purchasing, and make more informed decisions.
          </p>
          <p className="font-body text-base font-normal leading-[1.7] text-black">
            At Havlo, we believe buying property abroad should be simple, transparent, and accessible, not limited by geography.
          </p>
          <p className="font-body text-base font-normal leading-[1.7] text-black">
            Havlo is a trading style of Sprint Technologies Ltd, 2nd Floor, Berkeley Square, London, England, W1J 6BD. Registered in England and Wales with Company No. 14949509. VAT Registration Number: 511860708.
          </p>
        </div>
      </section>

      <section className="bg-[#F9F9F8] px-4 sm:px-10 lg:px-[100px] py-10 my-0">
        <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[
            { title: 'Buy Property Abroad', description: "Expert advisory for acquiring residential and commercial property abroad. We handle the complexity so you don't have to.", href: '/buy-abroad' },
            { title: 'Property Matching', description: 'Get matched to the right property and enjoy discounted legal fees when buying through our nominated agent.', href: '/property-matching' },
            { title: 'Elite Property Introductions', description: 'Showcase your property to a curated list of ready-to-buy offshore buyers who are actively seeking.', href: '/elite-property' },
            { title: 'Sell Faster (Havlo Relaunch™)', description: 'A dedicated programme helping slow-to-sell properties listed for over 6 months find their buyer.', href: '/sell-faster' },
            { title: 'Property Sale Audit (Havlo Relaunch Assessment)', description: "Uncover why your property hasn't sold and get a clear, actionable plan to relaunch it successfully. We analyse pricing, presentation, and market positioning to identify obstacles and recommend the best steps to attract serious buyers.", href: '/property-audit' },
            { title: 'International Buyer Network', description: 'Sell properties faster by going beyond property portals and connecting listings with a curated network of qualified, ready-to-buy international buyers.', href: '/buyer-network' },
          ].map((card) => (
            <div key={card.title} className="flex min-h-[280px] flex-col rounded-[16px] border border-black/10 bg-white p-8">
              <h3 className="font-display text-[30px] font-medium leading-[1.1] tracking-[-0.4px] text-[#1F1F1E]">
                {card.title}
              </h3>
              <p className="mt-6 flex-1 font-body text-base font-normal leading-[1.7] text-black">
                {card.description}
              </p>
              <Link to={card.href} className="mt-6 font-body text-base font-normal uppercase tracking-[0.04em] text-black hover:opacity-70">
                LEARN MORE →
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
