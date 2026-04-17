import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { MarqueeStrip } from '../components/shared/MarqueeStrip';
import { HeroSection } from '../components/shared/HeroSection';
import { ReviewCard } from '../components/shared/ReviewCard';
import { TrustpilotStars } from '../components/ui/TrustpilotStars';
import { ChevronLeft, ChevronRight, Globe } from 'lucide-react';
import { cn } from '../lib/utils';
import { useModal } from '../hooks/useModal';

export const BuyAbroad: React.FC = () => {
  const navigate = useNavigate();
  const { openModal } = useModal();
  const [activeTab, setActiveTab] = useState('High-Value Investors');

  const handleGetStarted = () => {
    navigate('/get-started');
  };

  const tabs = [
    'High-Value Investors',
    'Rental & Capital Buyers',
    'Residency Investors',
    'Ready-to-Purchase Buyers',
  ];

  const tabContent: Record<string, { id: string; title: string; description: string; threshold: string }> = {
    'High-Value Investors': {
      id: '01',
      title: 'Investors Deploying $100K+',
      description: 'Serious capital allocators seeking structured, high-yield real estate with clear return profiles and risk-managed entry points.',
      threshold: 'MINIMUM THRESHOLD APPLIES',
    },
    'Rental & Capital Buyers': {
      id: '02',
      title: 'Yield-Focused Buyers',
      description: 'Investors looking for high-rental-yield properties in emerging markets with strong capital appreciation potential.',
      threshold: 'MARKET ANALYSIS INCLUDED',
    },
    'Residency Investors': {
      id: '03',
      title: 'Residency by Investment',
      description: 'Individuals seeking to secure residency or citizenship through strategic real estate acquisitions in select jurisdictions.',
      threshold: 'LEGAL ADVISORY AVAILABLE',
    },
    'Ready-to-Purchase Buyers': {
      id: '04',
      title: 'Immediate Action Buyers',
      description: 'Buyers with liquid capital ready to move quickly on prime opportunities in competitive international markets.',
      threshold: 'FAST-TRACK PROCESSING',
    },
  };

  const regions = [
    { name: 'Europe', countries: 'United Kingdom, Spain, Portugal', icon: '/1.png' },
    { name: 'Middle East', countries: 'UAE, Saudi Arabia, Oman', icon: '/2.png' },
    { name: 'Americas', countries: 'United states, Mexico, Canada', icon: '/3.png' },
    { name: 'Asia & Asia-Pacific', countries: 'Thailand, Indonesia, Japan', icon: '/4.png' },
    { name: 'Africa', countries: 'South Africa, Morocco, Egypt', icon: '/5.png' },
    { name: 'Oceania', countries: 'Australia', icon: '/6.png' },
  ];

  const helpSteps = [
    {
      id: '01',
      title: 'Need help buying a property abroad? We can help.',
      description: 'Need help buying a property abroad? We can help.',
    },
    {
      id: '02',
      title: 'We do your legal work and survey too',
      description: 'For a competitive price, we can help you with every aspect of buying a home abroad.',
    },
    {
      id: '03',
      title: 'A friendly team by your side',
      description: 'A dedicated case manager assigned to guide you through the process from start to finish',
    },
  ];

  return (
    <div className="flex flex-col w-full overflow-hidden bg-white">
      {/* 1. Hero Section */}
      <HeroSection 
        title="A Smoother Way to Buy Property Overseas"
        subtitle="Your property search, survey, legal work and purchase - all done in one peaceful place."
        imageSrc="/Mask group2.png"
        onButtonClick={handleGetStarted}
      />

      {/* 2. Marquee Strip */}
      <MarqueeStrip />

      {/* 3. Reviews Section */}
      <section className="flex w-full items-center bg-white px-4 py-20 sm:px-10 lg:px-[100px]">
        <div className="mx-auto flex w-full flex-col lg:flex-row items-center gap-10">
          {/* Excellent Block */}
          <div className="flex flex-col items-center lg:items-start gap-5 text-center lg:text-left min-w-[200px]">
            <div className="flex flex-col items-center lg:items-start gap-3">
              <h2 className="font-body text-[40px] font-medium leading-none tracking-[-0.8px] text-[#040504]">
                Excellent
              </h2>
              <TrustpilotStars className="h-[45px]" />
            </div>
            <p className="font-body text-[22px] font-normal text-black">
              Based on <span className="font-bold underline">4,359 reviews</span>
            </p>
          </div>

          <div className="relative flex flex-1 items-center gap-8">
            <button className="flex h-12 w-12 items-center justify-center rounded-full border border-black/10 hover:bg-black/5 transition-colors">
              <ChevronLeft className="h-6 w-6" />
            </button>
            <div className="flex flex-1 gap-8">
              <ReviewCard
                title="Outstanding support for first time buyer"
                content="As a first-time buyer, the mortgage process felt really overwhelming at the start, but Tembo made everything so much easier. From day one,"
                author="Freeborn"
                time="50 minutes ago"
              />
              <ReviewCard
                title="Outstanding support for first time buyer"
                content="As a first-time buyer, the mortgage process felt really overwhelming at the start, but Tembo made everything so much easier. From day one,"
                author="Freeborn"
                time="50 minutes ago"
              />
              <ReviewCard
                title="Outstanding support for first time buyer"
                content="As a first-time buyer, the mortgage process felt really overwhelming at the start, but Tembo made everything so much easier. From day one,"
                author="Freeborn"
                time="50 minutes ago"
              />
            </div>
            <button className="flex h-12 w-12 items-center justify-center rounded-full border border-black/10 hover:bg-black/5 transition-colors">
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>
        </div>
      </section>

      {/* 4. Who This Is For Section */}
      <section className="relative flex flex-col items-start gap-14 bg-black px-4 py-24 sm:px-10 lg:px-[100px]">
        <div className="flex flex-col items-start gap-6 text-left w-full mx-auto">
          <h2 className="font-display text-[48px] font-black leading-[1.1] text-white sm:text-[64px]">
            Who This Is For
          </h2>
          <p className="max-w-[500px] font-body text-base font-normal text-white/70">
            We work exclusively with a select group of investors and buyers who meet a clear set of criteria — and are ready to move.
          </p>
        </div>

        {/* Tabs Container */}
        <div className="w-full mx-auto">
          <div className="inline-flex items-center gap-1 rounded-full bg-white/5 p-1.5">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-6 py-2.5 rounded-full font-body text-sm font-semibold transition-all whitespace-nowrap",
                  activeTab === tab
                    ? "bg-[#A409D2] text-white"
                    : "text-white/50 hover:text-white/80"
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content Card */}
        <div className="w-full mx-auto border border-white/10 rounded-[4px] bg-black overflow-hidden flex flex-col">
          <div className="flex flex-col lg:flex-row">
            <div className="lg:w-[45%] h-[400px] lg:h-[500px]">
              <img
                src="/image 3.png"
                alt="Modern Architecture"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="lg:w-[55%] p-10 lg:p-20 flex flex-col justify-center gap-8">
              <div className="flex flex-col gap-4">
                <span className="font-display text-[32px] font-black text-white/90">
                  — {tabContent[activeTab].id}
                </span>
                <h3 className="font-display text-[40px] font-black leading-tight text-white">
                  {tabContent[activeTab].title}
                </h3>
                <p className="font-body text-lg text-white/60 leading-relaxed max-w-[480px]">
                  {tabContent[activeTab].description}
                </p>
                <span className="mt-4 font-body text-xs font-bold uppercase tracking-[0.1em] text-white/40">
                  {tabContent[activeTab].threshold}
                </span>
              </div>
            </div>
          </div>
          
          {/* Card Footer */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-6 border-t border-white/10 p-8 lg:px-12">
            <p className="font-body text-base text-white/70">
              Not sure if you qualify? Let's have a private conversation.
            </p>
            <button className="flex items-center gap-2 font-body text-sm font-bold uppercase tracking-[0.1em] text-[#A409D2] hover:opacity-80 transition-opacity">
              SCHEDULE A CONSULTATION <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Wavy Bottom Edge */}
        <div className="absolute bottom-0 left-0 w-full h-16 bg-[#F4E8F9]" style={{ clipPath: 'polygon(0 100%, 100% 100%, 100% 0, 95% 40%, 90% 10%, 85% 50%, 80% 20%, 75% 60%, 70% 30%, 65% 70%, 60% 40%, 55% 80%, 50% 50%, 45% 90%, 40% 60%, 35% 100%, 30% 70%, 25% 90%, 20% 60%, 15% 80%, 10% 50%, 5% 70%, 0 40%)' }} />
      </section>

      {/* 5. Where We Operate Section */}
      <section className="flex flex-col items-center gap-14 bg-[#F9F9F8] px-4 py-24 sm:px-10 lg:px-[100px]">
        <div className="flex flex-col items-center gap-6 text-center">
          <h2 className="font-display text-[48px] font-black leading-[1.1] text-black sm:text-[56px]">
            Where We Operate
          </h2>
          <p className="max-w-[600px] font-body text-lg font-medium text-black/70">
            We specialize in helping you purchase property across select international markets, with expert local knowledge and dedicated support.
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {regions.map((region) => (
            <div key={region.name} className="flex flex-col gap-6 rounded-[24px] bg-white p-8 shadow-sm hover:shadow-md transition-shadow">
              <div className="h-12 w-12 flex items-center justify-center overflow-hidden">
                <img 
                  src={region.icon} 
                  alt={region.name} 
                  className="h-full w-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="font-display text-2xl font-black text-black">
                  {region.name}
                </h3>
                <p className="font-body text-base text-black/60">
                  {region.countries}
                </p>
              </div>
            </div>
          ))}
        </div>

        <Link to="/countries">
          <Button className="h-14 px-10 rounded-full bg-black text-white hover:bg-black/90 transition-colors text-lg font-semibold">
            View All
          </Button>
        </Link>
      </section>

      {/* 6. Purple Help Section */}
      <section className="relative flex flex-col items-center gap-16 bg-[#A409D2] px-4 pt-32 pb-48 sm:px-10 lg:px-[100px] overflow-hidden" style={{ borderRadius: '0 0 50% 50% / 0 0 60px 60px' }}>
        {/* Top Accent Bar */}
        <div className="absolute top-0 left-0 w-full h-10 bg-[#F4E8F9]" />

        <div className="flex flex-col items-center gap-6 text-center z-10">
          <h2 className="max-w-[900px] font-display text-[56px] font-black leading-[1.05] text-white sm:text-[72px] tracking-tight">
            Need help buying a property<br className="hidden sm:block" /> abroad? We can help.
          </h2>
          <p className="max-w-[600px] font-body text-xs font-bold text-white/70 uppercase tracking-[0.2em]">
            Get unbiased property purchase advice from our expert team who understand the complexities of international real estate.
          </p>
        </div>

        <div className="flex flex-col w-full max-w-[1100px] gap-8 z-10">
          {helpSteps.map((step, index) => (
            <div 
              key={step.id} 
              className={cn(
                "flex flex-col sm:flex-row items-start gap-6 rounded-[24px] bg-white/15 p-8 text-white w-full sm:max-w-[540px] backdrop-blur-md border border-white/10",
                index === 1 ? "sm:self-center lg:self-end" : "sm:self-start"
              )}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#A409D2] font-display text-sm font-black">
                {step.id}
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="font-display text-[26px] font-black leading-tight">
                  {step.title}
                </h3>
                <p className="font-body text-[15px] text-white/80 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 7. CTA Section */}
      <section className="flex flex-col items-center gap-10 bg-white px-4 py-24 sm:px-10 lg:px-[100px]">
        <div className="flex flex-col items-center gap-6 text-center">
          <h2 className="max-w-[800px] font-display text-[48px] font-black leading-[1.1] text-black sm:text-[64px]">
            Ready to Start Your Property Journey?
          </h2>
          <p className="max-w-[700px] font-body text-lg font-medium text-black/70">
            Get expert guidance and unbiased advice for your international property purchase. Let us make the process smooth and stress-free.
          </p>
        </div>
        <Button 
          onClick={handleGetStarted}
          className="h-14 px-10 rounded-full bg-black text-white hover:bg-black/90 transition-colors text-lg font-semibold"
        >
          Get Started
        </Button>
      </section>
    </div>
  );
};
