import React from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { MarqueeStrip } from '../components/shared/MarqueeStrip';
import { AutoScrollReviews } from '../components/shared/AutoScrollReviews';
import { ServiceCard } from '../components/shared/ServiceCard';
import { DifferenceCard } from '../components/shared/DifferenceCard';
import { HeroSection } from '../components/shared/HeroSection';
import { HeroBackground } from '../components/shared/HeroBackground';
import { TrustpilotStars } from '../components/ui/TrustpilotStars';
import { useModal } from '../hooks/useModal';
import { usePageMeta } from '../hooks/usePageMeta';
import { cn } from '../lib/utils';

const homeReviews = [
  {
    title: 'Great experience buying abroad',
    content: 'I was looking to purchase property overseas for months with no success. Havlo connected me with genuine opportunities and made the whole process simple and efficient.',
    author: 'Daniel, London',
  },
  {
    title: 'Found my investment property internationally',
    content: 'Havlo helped me find a great investment property abroad that I would never have discovered through traditional channels. Smooth and professional experience.',
    author: 'Amir, Dubai',
  },
  {
    title: 'Sold my £7M property offshore',
    content: 'We had a £7m property sitting without serious interest locally. Havlo introduced us to offshore buyers and helped us secure a successful sale.',
    author: 'James, Surrey',
  },
  {
    title: 'Finally sold after 6 months on market',
    content: 'Our home had been listed for over 6 months with very little traction. Havlo repositioned it internationally and we quickly saw real interest.',
    author: 'Olivia, Bristol',
  },
  {
    title: 'Sold after 18 months of no results',
    content: 'After 18 months struggling on property portals, Havlo completely changed our outcome. The international exposure brought the right buyer.',
    author: 'Richard, Manchester',
  },
  {
    title: 'Havlo assessment was a game changer',
    content: 'The Property Sale Audit showed us exactly why our home wasn’t selling. Once we followed the recommendations, everything improved.',
    author: 'Sophie, Leeds',
  },
  {
    title: 'Clear insight into why my property wasn’t selling',
    content: 'The Havlo assessment gave us clarity on pricing and positioning issues we hadn’t considered. It completely reshaped our strategy.',
    author: 'Matthew, Birmingham',
  },
  {
    title: 'Helped us reach global buyers',
    content: 'As estate agents, Havlo helped us reach international buyers beyond Rightmove and Zoopla. It added a powerful new channel for us.',
    author: 'Laura, London',
  },
  {
    title: 'Faster sales through international exposure',
    content: 'Once we started using Havlo, our listings gained much more traction and sold significantly faster than before.',
    author: 'Thomas, Edinburgh',
  },
  {
    title: 'High-quality international leads',
    content: 'The quality of enquiries improved dramatically. We were speaking to serious, qualified international buyers rather than time-wasters.',
    author: 'Hannah, London',
  },
  {
    title: 'A real competitive advantage for our agency',
    content: 'Havlo gave our estate agency a clear edge in the market. It opened up a global buyer audience we couldn’t reach before.',
    author: 'Andrew, Cardiff',
  },
  {
    title: 'Helped me buy with confidence abroad',
    content: 'I felt guided throughout the entire process of buying overseas. Havlo made international property search much more accessible.',
    author: 'Natalie, Manchester',
  },
];

export const Home: React.FC = () => {
  usePageMeta({
    title: 'Havlo - Buy, Sell & Manage International Property',
    description: 'Havlo helps you buy, sell, and manage properties across multiple countries. Get expert support, end-to-end guidance, and a seamless international real estate experience.',
    canonical: 'https://www.heyhavlo.com/',
  });
  const { openModal } = useModal();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = React.useState<'BUYERS' | 'SELLERS' | 'AGENTS'>('SELLERS');

  const handleGetStarted = () => {
    openModal('create-account');
  };

  const tabs = [
    { id: 'SELLERS', label: 'SELLERS' },
    { id: 'BUYERS', label: 'BUYERS' },
    { id: 'AGENTS', label: 'AGENTS' },
  ] as const;

  return (
    <div className="flex flex-col w-full overflow-hidden bg-white pb-20">
      {/* 1. Hero Section */}
      <HeroSection 
        title="A Smarter Way to Sell, Buy, and Market Property Globally."
        subtitle="Combining data-driven strategy, strategic exposure, and international buyer access to help you achieve better outcomes, faster."
        imageSrc="/Mask group.png"
        titleStyle={{ fontSize: '72px', lineHeight: '1.0' }}
        customActions={
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-[700px] px-4 sm:px-6 lg:px-0 mb-12 sm:pb-0">
              <button
                onClick={() => navigate('/property-audit')}
                className="w-full sm:w-auto transition-all duration-200 hover:bg-black/90 active:scale-95 bg-black text-white px-6 py-3 sm:py-4 rounded-full text-sm sm:text-base font-semibold border border-black cursor-pointer sm:h-14 whitespace-nowrap"
              >
                Sell My Property Faster
              </button>

              <div className="flex flex-row flex-wrap items-center justify-center gap-2 sm:gap-3 w-full sm:w-auto">
                <button
                  onClick={() => navigate('/buy-property-abroad')}
                  className="w-full sm:w-auto transition-all duration-200 hover:bg-black hover:text-white active:scale-95 bg-white text-black px-6 py-3 sm:py-4 rounded-full text-sm sm:text-base font-semibold border border-black cursor-pointer sm:h-14 whitespace-nowrap"
                >
                  Buy Property Abroad
                </button>

                {/* <button
                  onClick={() => navigate('/buyer-network')}
                  className="w-full sm:w-auto transition-all duration-200 hover:bg-black hover:text-white active:scale-95 bg-white text-black px-6 py-3 sm:py-4 rounded-full text-sm sm:text-base font-semibold border border-black cursor-pointer sm:h-14 whitespace-nowrap"
                >
                  For Estate Agents
                </button> */}
              
            </div>
          </div>
        }
      />

      {/* 2. Marquee Strip */}
      <MarqueeStrip />

      {/* 3. As Seen In */}
      <section className="flex w-full flex-col items-center bg-white px-4 sm:px-10 lg:px-[100px] lg:py-[60px] py-10 my-0 pt-[20px] pb-[20px]">
        <span className="font-body text-xs font-medium uppercase tracking-[0.25em] text-black/50">
          As seen in
        </span>
        <div className="mt-7 flex w-full flex-wrap items-center justify-center gap-x-10 gap-y-6 lg:mt-10 lg:gap-x-16">
          <img
            src="/press-logos/the-times.svg"
            alt="The Times & The Sunday Times"
            className="h-10 w-auto object-contain lg:h-12"
            loading="lazy"
          />
          <img
            src="/press-logos/the-guardian.svg"
            alt="The Guardian"
            className="h-5 w-auto object-contain lg:h-6"
            loading="lazy"
          />
          <img
            src="/press-logos/the-telegraph.svg"
            alt="The Daily Telegraph"
            className="h-7 w-auto object-contain lg:h-8"
            loading="lazy"
          />
          <img
            src="/press-logos/daily-mail.svg"
            alt="Daily Mail"
            className="h-8 w-auto object-contain lg:h-10"
            loading="lazy"
          />
          <img
            src="/press-logos/the-spectator.svg"
            alt="The Spectator"
            className="h-9 w-auto object-contain lg:h-10"
            loading="lazy"
          />
        </div>
      </section>

      {/* 4. Reviews Section */}
      <section className="w-full bg-white px-4 lg:pt-4 sm:px-6 lg:px-10 py-0 my-0">
        <AutoScrollReviews
          reviews={homeReviews}
          bgColor="#F5F5F3"
          header={
            <>
              <h2 className="font-body text-[28px] lg:text-[36px] font-medium leading-none tracking-[-0.8px] text-[#040504]">Rated</h2>
              <TrustpilotStars className="h-[28px] lg:h-[32px]" />
              <p className="font-body text-[14px] lg:text-[16px] font-normal text-black">
                Rated Excellent based on over <span className="font-bold underline">1,000 customer reviews.</span>
              </p>
            </>
          }
        />
      </section>

      {/* 5. Services Section */}
      <section className="flex flex-col items-center gap-10 lg:gap-14 bg-[#F9F9F8] px-3 lg:px-[100px] py-10 my-0">
        <div className="flex flex-col items-center gap-10 text-center">
          <div className="flex flex-col items-center gap-10 lg:gap-10">
            <span className="font-body text-lg font-medium uppercase tracking-[-0.054px] text-[#3A3C3E]">
              OUR PROPERTY SOLUTIONS
            </span>
            <h2 className="max-w-[630px] font-display text-[32px] lg:text-[48px] font-black leading-[1.1] text-[#040504] sm:text-[56px]">
              How We Help You Move Property Faster.
            </h2>
          </div>
        </div>

        {/* Mobile Tabs */}
        <div className="flex lg:hidden w-full flex-col items-center gap-8">
          <div className="flex w-full items-start gap-8 border-b border-black/10">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex-1 pb-6 text-center font-body text-xl font-semibold tracking-[-0.8px] transition-all",
                  activeTab === tab.id 
                    ? "border-b-2 border-black text-black" 
                    : "text-black/50"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="w-full">
            {activeTab === 'BUYERS' && (
              <div className="flex flex-col gap-5 rounded-[24px] bg-[#FFB0E8] p-4 pt-6">
                <div className="border-b-[1.5px] border-black pb-3 text-center">
                  <h3 className="font-display text-[32px] font-black leading-none text-black text-left">For Buyers</h3>
                </div>
                <div className="flex flex-col gap-5">
                  <ServiceCard
                    title="Buy Property Abroad"
                    description="Expert advisory for acquiring residential and commercial property abroad. We handle the complexity so you don't have to."
                    href="/buy-property-abroad"
                    className="bg-white"
                  />
                  <ServiceCard
                    title="Property Matching"
                    description="Get matched to the right property and enjoy discounted legal fees when buying through our nominated agent."
                    href="/property-matching"
                    className="bg-white"
                  />
                </div>
              </div>
            )}
            {activeTab === 'SELLERS' && (
              <div className="flex flex-col gap-5 rounded-[24px] bg-[#9FD4E3] p-4 pt-6">
                <div className="border-b-[1.5px] border-black pb-3 text-center">
                  <h3 className="font-display text-[32px] font-black leading-none text-black text-left">For Sellers</h3>
                </div>
                <div className="flex flex-col gap-5">
                  <ServiceCard
                    title="Sell Faster (Havlo Relaunch™)"
                    description="A dedicated programme helping slow-to-sell properties listed for over 6 months find their buyer"
                    href="/sell-your-property"
                    className="bg-white"
                  />
                  <ServiceCard
                    title="Property Sale Audit"
                    description="Uncover why your property hasn’t sold and get a clear, actionable plan to relaunch it successfully. We analyse pricing, presentation, and market positioning to identify obstacles and recommend the best steps to attract serious buyers."
                    href="/property-audit"
                    className="bg-white"
                  />
                  <ServiceCard
                    title="Elite Property Introductions"
                    description="Showcase your property to a curated list of ready-to-buy offshore buyers who are actively seeking."
                    href="/elite-property"
                    className="bg-white"
                  />
                </div>
              </div>
            )}
            {activeTab === 'AGENTS' && (
              <div className="flex flex-col gap-5 rounded-[24px] bg-[#CDC5F3] p-4 pt-6">
                <div className="border-b-[1.5px] border-black pb-3 text-center">
                  <h3 className="font-display text-[32px] font-black leading-none text-black text-left">For Agents</h3>
                </div>
                <div className="flex flex-col gap-5">
                  <ServiceCard
                    title="International Buyer Network"
                    description="Sell properties faster by going beyond property portals and connecting listings with a curated network of qualified, ready-to-buy international buyers."
                    href="/buyer-network"
                    className="bg-white"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Desktop Grid */}
        <div className="hidden lg:grid w-full grid-cols-3 gap-5">
          {/* For Sellers */}
          <div className="flex flex-col gap-5 rounded-[24px] bg-[#9FD4E3] p-4 pt-6">
            <div className="border-b-[1.5px] border-black pb-3 text-center">
              <h3 className="font-display text-[32px] font-black leading-none text-black text-left">For Sellers</h3>
            </div>
            <div className="flex flex-1 flex-col gap-5">
              <ServiceCard
                title="Sell Faster (Havlo Relaunch™)"
                description="A dedicated programme helping slow-to-sell properties listed for over 6 months find their buyer"
                href="/sell-your-property"
                className="flex-1 bg-white"
              />
              <ServiceCard
                title="Property Sale Audit"
                description="Uncover why your property hasn’t sold and get a clear, actionable plan to relaunch it successfully. We analyse pricing, presentation, and market positioning to identify obstacles and recommend the best steps to attract serious buyers."
                href="/property-audit"
                className="flex-[2] bg-white"
              />
              <ServiceCard
                title="Elite Property Introductions"
                description="Showcase your property to a curated list of ready-to-buy offshore buyers who are actively seeking."
                href="/elite-property"
                className="bg-white"
              />
            </div>
          </div>

          {/* For Buyers */}
          <div className="flex flex-col gap-5 rounded-[24px] bg-[#FFB0E8] p-4 pt-6">
            <div className="border-b-[1.5px] border-black pb-3 text-center">
              <h3 className="font-display text-[32px] font-black leading-none text-black text-left">For Buyers</h3>
            </div>
            <div className="flex flex-1 flex-col gap-5">
              <ServiceCard
                title="Buy Property Abroad"
                description="Expert advisory for acquiring residential and commercial property abroad. We handle the complexity so you don't have to."
                href="/buy-property-abroad"
                className="flex-1 bg-white"
              />
              <ServiceCard
                title="Property Matching"
                description="Get matched to the right property and enjoy discounted legal fees when buying through our nominated agent."
                href="/property-matching"
                className="flex-1 bg-white"
              />
            </div>
          </div>

          {/* For Agents */}
          <div className="flex flex-col gap-5 rounded-[24px] bg-[#CDC5F3] p-4 pt-6">
            <div className="border-b-[1.5px] border-black pb-3 text-center">
              <h3 className="font-display text-[32px] font-black leading-none text-black text-left">For Agents</h3>
            </div>
            <div className="flex flex-1 flex-col gap-5">
              <ServiceCard
                title="International Buyer Network"
                description="Sell properties faster by going beyond property portals and connecting listings with a curated network of qualified, ready-to-buy international buyers."
                href="/buyer-network"
                className="flex-1 bg-white"
              />
              <div className="flex-1" />
            </div>
          </div>
        </div>
      </section>

      {/* 6. The Havlo Difference */}
      <section className="flex flex-col items-center gap-10 bg-[#A409D2] px-3 lg:px-[100px] py-10 my-0">
        <h2 className="w-full text-center font-display text-[32px] lg:text-[48px] font-black leading-[1.1] text-white sm:text-[56px]">
          The Havlo Difference
        </h2>
        <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <DifferenceCard
            number="01"
            title="Results-Driven Approach"
            description="Thousands of property owners have trusted Havlo, backed by a track record of successful transactions that speak for themselves."
          />
          <DifferenceCard
            number="02"
            title="Global Network, Local Insight"
            description="We combine international reach with deep local knowledge — giving you an edge no matter where the deal takes place."
          />
          <DifferenceCard
            number="03"
            title="End-to-End Support"
            description="From first inquiry to final handshake, our team stays with you throughout the process, ensuring everything moves smoothly from start to finish."
          />
        </div>
      </section>

      {/* 7. Bottom CTA Section */}
      <section className="relative flex flex-col items-center bg-white lg:pt-60 lg:pb-24 overflow-hidden py-10 my-0">
        <div className="relative z-20 flex max-w-[903px] flex-col items-center gap-8 px-4 text-center">
          <h2 className="font-display text-[36px] sm:text-[56px] md:text-[64px] lg:text-[80px] font-black leading-tight lg:leading-none tracking-[-0.96px] lg:tracking-[-1.6px] text-black">
            Ready to Take the Next Step?
          </h2>
          <p className="max-w-[678px] font-body text-base lg:text-xl font-medium leading-[1.5] tracking-[-0.32px] lg:tracking-[-0.4px] text-black/80">
            Whether you're selling, buying, or expanding your reach, Havlo connects you with the strategy and exposure to achieve better results.
          </p>
          <div 
            onClick={handleGetStarted}
            className="inline-flex h-10 sm:h-14 items-center justify-center gap-1 px-5 py-3 relative bg-[#000000] rounded-[48px] cursor-pointer hover:bg-black/90 transition-colors w-full lg:w-auto"
          >
            <div className="w-fit font-bold lg:font-semibold text-[#feffff] text-lg text-center tracking-[-0.36px] leading-[27px] whitespace-nowrap relative [font-family:'Inter',Helvetica]">
              Explore Our Services
            </div>
          </div>
        </div>

        {/* Decorative Torn Edge Background */}
        <div className="absolute top-0 left-0 right-0 h-[200px] lg:h-[400px] z-10">
          <HeroBackground 
            showTop={true}
            showBottom={false}
            className="h-full w-full bg-[#A409D2]" 
          />
        </div>
      </section>
    </div>
  );
};
