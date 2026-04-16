import React from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { MarqueeStrip } from '../components/shared/MarqueeStrip';
import { ReviewCard } from '../components/shared/ReviewCard';
import { ServiceCard } from '../components/shared/ServiceCard';
import { DifferenceCard } from '../components/shared/DifferenceCard';
import { HeroSection } from '../components/shared/HeroSection';
import { HeroBackground } from '../components/shared/HeroBackground';
import { TrustpilotStars } from '../components/ui/TrustpilotStars';
import { useModal } from '../hooks/useModal';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

export const Home: React.FC = () => {
  const { openModal } = useModal();
  const [activeTab, setActiveTab] = React.useState<'BUYERS' | 'SELLERS' | 'AGENTS'>('BUYERS');
  
  const handleGetStarted = () => {
    openModal('create-account');
  };

  const tabs = [
    { id: 'BUYERS', label: 'BUYERS' },
    { id: 'SELLERS', label: 'SELLERS' },
    { id: 'AGENTS', label: 'AGENTS' },
  ] as const;

  return (
    <div className="flex flex-col w-full overflow-hidden bg-white">
      {/* 1. Hero Section */}
      <HeroSection 
        title="Property Done Smarter"
        subtitle="Buy, sell, or promote property with ease. From international purchases to connecting with serious buyers — we help you move faster."
        imageSrc="/Mask group.png"
        onButtonClick={handleGetStarted}
      />

      {/* 2. Marquee Strip */}
      <MarqueeStrip />

      {/* 3. As Seen In */}
      <section className="flex w-full flex-col items-center bg-white px-4 py-10 sm:px-10 lg:px-[100px] lg:py-14">
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
      <section className="flex w-full bg-white px-4 py-12 lg:py-20 sm:px-10 lg:px-[100px]">
        {/* Desktop: Excellent on left, carousel on right */}
        <div className="hidden w-full lg:flex items-center gap-10">
          {/* Left — Excellent block */}
          <div className="flex shrink-0 flex-col items-center gap-4 text-center">
            <h2 className="font-body text-[40px] font-medium leading-none tracking-[-0.8px] text-[#040504]">
              Excellent
            </h2>
            <TrustpilotStars className="h-[36px]" />
            <p className="font-body text-[18px] font-normal text-black">
              Based on <span className="font-bold underline">4,359 reviews</span>
            </p>
          </div>

          {/* Right — carousel */}
          <div className="flex flex-1 items-center gap-4">
            <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/15 bg-white text-black/70 hover:bg-black/5">
              <ChevronLeft size={18} />
            </button>

            <div className="grid flex-1 grid-cols-2 gap-4">
              {[0, 1].map((i) => (
                <div key={i} className="rounded-xl bg-[#F5F5F3] p-5">
                  <ReviewCard
                    title="Outstanding support for first time buyer"
                    content="As a first-time buyer, the mortgage process felt really overwhelming at the start, but Tembo made everything so much easier. From day one,"
                    author="Freeborn"
                    time="50 minutes ago"
                  />
                </div>
              ))}
            </div>

            <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/15 bg-white text-black/70 hover:bg-black/5">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Mobile: stacked */}
        <div className="flex w-full flex-col items-center gap-6 lg:hidden">
          <div className="flex flex-col items-center gap-3 text-center">
            <h2 className="font-body text-[32px] font-medium leading-none tracking-[-0.8px] text-[#040504]">
              Excellent
            </h2>
            <TrustpilotStars className="h-[30px]" />
          </div>

          <div className="flex w-full items-center gap-3">
            <button className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-black/15">
              <ChevronLeft size={14} />
            </button>
            <div className="flex-1 rounded-xl bg-[#F5F5F3] p-5">
              <ReviewCard
                title="Outstanding support for first time buyer"
                content="As a first-time buyer, the mortgage process felt really overwhelming at the start, but Tembo made everything so much easier. From day one,"
                author="Freeborn"
                time="50 minutes ago"
              />
            </div>
            <button className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-black/15">
              <ChevronRight size={14} />
            </button>
          </div>

          <p className="font-body text-base font-normal text-black">
            Based on <span className="font-bold underline">4,359 reviews</span>
          </p>
        </div>
      </section>

      {/* 5. Services Section */}
      <section className="flex flex-col items-center gap-10 lg:gap-14 bg-[#F9F9F8] px-3 lg:px-[100px] py-10 lg:py-20">
        <div className="flex flex-col items-center gap-10 text-center">
          <div className="flex flex-col items-center gap-10 lg:gap-10">
            <span className="font-body text-lg font-medium uppercase tracking-[-0.054px] text-[#3A3C3E]">
              WHAT WE OFFER
            </span>
            <h2 className="max-w-[630px] font-display text-[32px] lg:text-[48px] font-black leading-[1.1] text-[#040504] sm:text-[56px]">
              Simplifying every step of your property journey
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
                  <h3 className="font-display text-[32px] font-black leading-none text-black">For Buyers</h3>
                </div>
                <div className="flex flex-col gap-5">
                  <ServiceCard
                    title="Buy Property Abroad"
                    description="Expert advisory for acquiring residential and commercial property abroad. We handle the complexity so you don't have to."
                    href="/buy-abroad"
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
                  <h3 className="font-display text-[32px] font-black leading-none text-black">For Sellers</h3>
                </div>
                <div className="flex flex-col gap-5">
                  <ServiceCard
                    title="Elite Property Introductions"
                    description="Showcase your property to a curated list of ready-to-buy offshore buyers who are actively seeking."
                    href="/elite-property"
                    className="bg-white"
                  />
                  <ServiceCard
                    title="Sell Faster (Havlo Relaunch™)"
                    description="A dedicated programme helping slow to slow-to sell properties listed for over 6 months find their buyer."
                    href="/relaunch-assessment"
                    className="bg-white"
                  />
                  <ServiceCard
                    title="Property Sale Audit ( Havlo Relaunch Assessment)"
                    description="Uncover why your property hasn’t sold and get a clear, actionable plan to relaunch it successfully. We analyse pricing, presentation, and market positioning to identify obstacles and recommend the best steps to attract serious buyers."
                    href="/relaunch-assessment"
                    className="bg-white"
                  />
                </div>
              </div>
            )}
            {activeTab === 'AGENTS' && (
              <div className="flex flex-col gap-5 rounded-[24px] bg-[#CDC5F3] p-4 pt-6">
                <div className="border-b-[1.5px] border-black pb-3 text-center">
                  <h3 className="font-display text-[32px] font-black leading-none text-black">For Agents</h3>
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
          {/* For Buyers */}
          <div className="flex flex-col gap-5 rounded-[24px] bg-[#FFB0E8] p-4 pt-6">
            <div className="border-b-[1.5px] border-black pb-3 text-center">
              <h3 className="font-display text-[32px] font-black leading-none text-black">For Buyers</h3>
            </div>
            <div className="flex flex-1 flex-col gap-5">
              <ServiceCard
                title="Buy Property Abroad"
                description="Expert advisory for acquiring residential and commercial property abroad. We handle the complexity so you don't have to."
                href="/buy-abroad"
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

          {/* For Sellers */}
          <div className="flex flex-col gap-5 rounded-[24px] bg-[#9FD4E3] p-4 pt-6">
            <div className="border-b-[1.5px] border-black pb-3 text-center">
              <h3 className="font-display text-[32px] font-black leading-none text-black">For Sellers</h3>
            </div>
            <div className="flex flex-1 flex-col gap-5">
              <ServiceCard
                title="Elite Property Introductions"
                description="Showcase your property to a curated list of ready-to-buy offshore buyers who are actively seeking."
                href="/elite-property"
                className="bg-white h-[245px]"
              />
              <ServiceCard
                title="Sell Faster (Havlo Relaunch™)"
                description="A dedicated programme helping slow to slow-to sell properties listed for over 6 months find their buyer."
                href="/relaunch-assessment"
                className="bg-white h-[245px]"
              />
              <ServiceCard
                title="Property Sale Audit ( Havlo Relaunch Assessment)"
                description="Uncover why your property hasn’t sold and get a clear, actionable plan to relaunch it successfully. We analyse pricing, presentation, and market positioning to identify obstacles and recommend the best steps to attract serious buyers."
                href="/relaunch-assessment"
                className="flex-1 bg-white"
              />
            </div>
          </div>

          {/* For Agents */}
          <div className="flex flex-col gap-5 rounded-[24px] bg-[#CDC5F3] p-4 pt-6">
            <div className="border-b-[1.5px] border-black pb-3 text-center">
              <h3 className="font-display text-[32px] font-black leading-none text-black">For Agents</h3>
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
      <section className="flex flex-col items-center gap-10 bg-[#A409D2] px-3 lg:px-[100px] py-10 lg:py-20">
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
            description="From first inquiry to final handshake, our team navigates every legal, financial, and logistical detail alongside you."
          />
        </div>
      </section>

      {/* 7. Bottom CTA Section */}
      <section className="relative flex flex-col items-center bg-white pt-20 lg:pt-60 pb-10 lg:pb-24 overflow-hidden">
        <div className="relative z-20 flex max-w-[903px] flex-col items-center gap-8 px-4 text-center">
          <h2 className="font-display text-[48px] lg:text-[64px] font-black leading-none tracking-[-0.96px] lg:tracking-[-1.6px] text-black sm:text-[80px]">
            Ready to Start Your Property Journey?
          </h2>
          <p className="max-w-[678px] font-body text-base lg:text-xl font-medium leading-[1.5] tracking-[-0.32px] lg:tracking-[-0.4px] text-black/80">
            Get expert guidance and unbiased advice for your international property purchase. Let us make the process smooth and stress-free.
          </p>
          <div 
            onClick={handleGetStarted}
            className="inline-flex h-14 items-center justify-center gap-1 px-5 py-3 relative bg-[#000000] rounded-[48px] cursor-pointer hover:bg-black/90 transition-colors w-full lg:w-auto"
          >
            <div className="w-fit font-bold lg:font-semibold text-[#feffff] text-lg text-center tracking-[-0.36px] leading-[27px] whitespace-nowrap relative [font-family:'Inter',Helvetica]">
              Get started Today
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
