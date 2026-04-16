import React from 'react';
import { motion } from 'motion/react';
import { Button } from '../components/ui/Button';
import { Globe, Shield, Lightbulb } from 'lucide-react';
import { cn } from '../lib/utils';

export const AboutUs: React.FC = () => {
  return (
    <div className="flex flex-col w-full overflow-hidden bg-white">
      {/* 1. Hero Section */}
      <section className="relative flex min-h-[750px] w-full flex-col items-center justify-start gap-12 bg-gradient-to-b from-[#FFB0E8] to-[#FEEAA0] px-4 pt-6 pb-20 text-center sm:px-10 lg:px-[100px]">
        <div className="flex max-w-[1137px] flex-col items-center gap-10">
          <span className="font-body text-[16.7px] font-medium uppercase tracking-[-0.054px] text-black">
            About Us
          </span>
          <h1 className="max-w-[1046px] font-display text-[52px] font-black leading-[1.1] tracking-[-1.6px] text-[#1F1F1E] sm:text-[74.4px]">
            Making property abroad simpler, safer, transparent
          </h1>
          <p className="max-w-[817px] font-body text-[16.7px] leading-[1.7] tracking-[-0.054px] text-black">
            Havlo was created to remove the barriers that make owning property in another country feel complex and overwhelming. We're here to make it exciting again
          </p>
        </div>

        {/* Mission Card integrated into Hero */}
        <div className="mx-auto w-full max-w-[1258px] z-10 text-left">
          <div className="flex flex-col items-start gap-10 rounded-[12px] bg-[#FEFFFF] p-10 shadow-sm sm:p-14">
            <div className="flex h-[62px] w-[78px] items-center justify-center rounded-r-[32px] bg-[#017955]">
              <QuoteIcon />
            </div>
            <div className="flex flex-col gap-10">
              <h2 className="font-display text-[40px] font-medium leading-none tracking-[-0.8px] text-[#1F1F1E]">
                Why Havlo Exists
              </h2>
              <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
                <p className="font-body text-lg leading-[1.7] tracking-[-0.054px] text-black">
                  We understand that owning property in another country can be exciting — but also complex. Different laws, unfamiliar markets, distance, and ongoing management challenges often stand in the way. Our mission is simple: make owning property abroad feel as natural and straightforward as owning property at home.
                </p>
                <p className="font-body text-lg leading-[1.7] tracking-[-0.054px] text-black">
                  Havlo exists to remove those barriers. We combine deep local expertise with a global platform, giving you the confidence to make informed decisions and stay in control — no matter where you are in the world.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Values Section */}
      <section className="relative flex flex-col items-center gap-14 bg-[#FEFFFF] px-4 pt-32 pb-48 sm:px-10 lg:px-[100px]">
        <div className="flex flex-col items-center gap-10 text-center z-10">
          <h2 className="font-display text-[48px] font-medium leading-none tracking-[-1.12px] text-[#1F1F1E] sm:text-[56px]">
            Built Around Your Goals
          </h2>
          <p className="max-w-[881px] font-body text-base leading-[1.9] tracking-[-0.048px] text-black">
            Whether you're buying a second home, investing for the long term, or managing an overseas property, we start by understanding your purpose. This allows us to offer guidance and solutions that truly fit your needs.
          </p>
        </div>

        <div className="grid w-full grid-cols-1 lg:grid-cols-3 z-10">
          <ValueCard
            number="I"
            title="Purpose-Driven"
            description="Every recommendation is tailored to your specific goals and circumstances. No generic advice, just guidance that fits your life."
          />
          <ValueCard
            number="II"
            title="Transparent Always"
            description="We believe in complete transparency. You'll always understand the process, costs, and implications of every decision."
          />
          <ValueCard
            number="III"
            title="Trust First"
            description="Building lasting relationships through honesty, reliability, and acting in your best interest — always."
          />
        </div>
      </section>

      {/* 4. Lifecycle Section */}
      <section className="relative flex flex-col items-start gap-14 bg-[#040504] px-4 pt-40 pb-20 sm:px-10 lg:px-[100px]">
        {/* Curved Transition from White Section */}
        <div className="absolute top-[120px] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1951px] h-[463px] z-0 pointer-events-none">
          <svg width="1951" height="463" viewBox="0 0 1951 463" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="975.5" cy="231.5" rx="975.5" ry="231.5" fill="#040504"/>
          </svg>
        </div>
        <div className="grid w-full grid-cols-1 gap-14 lg:grid-cols-2 z-10">
          <div className="flex flex-col justify-start gap-10">
            <h2 className="max-w-[600px] font-display text-[56px] font-medium leading-none tracking-[-1.28px] text-white sm:text-[64px]">
              From Purchase to Ongoing Management
            </h2>
            <p className="max-w-[562px] font-body text-lg leading-[1.7] tracking-[-0.054px] text-white">
              Havlo supports you through the full lifecycle of owning property abroad. We're with you every step of the way.
            </p>
          </div>

          <div className="flex flex-col gap-5">
            <LifecycleCard
              title="Buying Property"
              description="Find and purchase property anywhere in the world with expert guidance on pricing, positioning, and local requirements."
            />
            <LifecycleCard
              title="Ownership Options"
              description="Explore flexible ownership models including full ownership, shared ownership, fractional ownership, and co-investment opportunities."
            />
            <LifecycleCard
              title="Property Management"
              description="Comprehensive overseas management including tenant sourcing, maintenance, rent collection, and ongoing value preservation."
            />
            <LifecycleCard
              title="Selling Support"
              description="When you're ready to sell, we connect you with qualified buyers and guide you through a smooth, efficient selling process."
            />
          </div>
        </div>
      </section>

      {/* 5. Partner Section */}
      <section className="flex flex-col items-center gap-14 bg-[#FEFFFF] px-4 py-32 sm:px-10 lg:px-[100px]">
        <div className="flex flex-col items-center gap-10 text-center">
          <h2 className="font-display text-[48px] font-medium leading-none tracking-[-1.12px] text-[#1F1F1E] sm:text-[56px]">
            Your Trusted Partner Abroad
          </h2>
          <p className="max-w-[881px] font-body text-lg leading-[1.7] tracking-[-0.054px] text-black">
            Havlo acts as your reliable partner on the ground, helping you protect your investment, reduce risk, and manage your property with confidence — even from thousands of miles away.
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-5 lg:grid-cols-3">
          <PartnerCard
            icon={<Globe className="w-14 h-14 text-[#0EA5E9]" />}
            title="Global Reach"
            description="Local expertise in markets worldwide, backed by a unified platform that keeps everything simple."
            bgColor="bg-[#E0F2FE]"
          />
          <PartnerCard
            icon={<Shield className="w-14 h-14 text-[#EF4444]" />}
            title="Risk Reduction"
            description="Navigate complex regulations, legal requirements, and market conditions with expert guidance."
            bgColor="bg-[#FEE2E2]"
          />
          <PartnerCard
            icon={<Lightbulb className="w-14 h-14 text-[#EAB308]" />}
            title="Informed Decisions"
            description="Access to market insights, data, and professional advice so you always make confident choices."
            bgColor="bg-[#FEF9C3]"
          />
        </div>
      </section>

      {/* 6. Bottom CTA Section */}
      <section className="flex flex-col items-center bg-[#FAEFFC] px-4 py-32 sm:px-10 lg:px-[100px]">
        <div className="flex flex-col items-center gap-14 text-center">
          <div className="flex max-w-[929px] flex-col items-center gap-10">
            <h2 className="font-display text-[56px] font-medium leading-[1.1] tracking-[-1.44px] text-[#1F1F1E] sm:text-[72px]">
              With Havlo, owning property abroad feels simple
            </h2>
            <p className="max-w-[881px] font-body text-lg leading-[1.7] tracking-[-0.054px] text-black">
              Join thousands of property owners who trust Havlo to guide their international property journey. Start with a conversation about your goals.
            </p>
          </div>
          <Button variant="primary" className="h-14 rounded-[48px] px-10 text-lg font-semibold bg-black text-white hover:bg-black/90">
            Talk to our Team
          </Button>
        </div>
      </section>
    </div>
  );
};

const ValueCard = ({ number, title, description }: { number: string; title: string; description: string }) => (
  <div className="flex min-h-[444px] h-full flex-col items-start gap-14 border border-black/10 p-10 sm:p-14">
    <span className="font-body text-[56px] font-medium italic leading-none tracking-[-1.12px] text-[#D46444]">
      {number}
    </span>
    <div className="flex flex-col gap-8">
      <h3 className="font-display text-[32px] font-medium leading-none tracking-[-0.64px] text-[#1F1F1E]">
        {title}
      </h3>
      <p className="font-body text-lg leading-[1.7] tracking-[-0.054px] text-black">
        {description}
      </p>
    </div>
  </div>
);

const LifecycleCard = ({ title, description }: { title: string; description: string }) => (
  <div className="flex w-full flex-col items-start gap-14 rounded-[16px] bg-white/10 backdrop-blur-sm p-8 sm:p-10 border border-white/10">
    <div className="flex flex-col gap-8">
      <h3 className="font-display text-[32px] font-medium leading-none tracking-[-0.64px] text-white">
        {title}
      </h3>
      <p className="font-body text-lg leading-[1.7] tracking-[-0.054px] text-white/80">
        {description}
      </p>
    </div>
  </div>
);

const PartnerCard = ({ icon, title, description, bgColor }: { icon: React.ReactNode; title: string; description: string; bgColor: string }) => (
  <div className="flex flex-col items-start gap-14 rounded-[16px] bg-[#F9F9F8] p-10 sm:p-14">
    <div className={cn("flex h-20 w-20 items-center justify-center rounded-2xl", bgColor)}>
      {icon}
    </div>
    <div className="flex flex-col gap-8">
      <h3 className="font-display text-[32px] font-medium leading-none tracking-[-0.64px] text-[#1F1F1E]">
        {title}
      </h3>
      <p className="font-body text-lg leading-[1.7] tracking-[-0.054px] text-black">
        {description}
      </p>
    </div>
  </div>
);

const QuoteIcon = () => (
  <svg width="40" height="32" viewBox="0 0 40 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3.4623 27.3786C1.2095 24.9858 0 22.3021 0 17.9518C0 10.2966 5.3739 3.4353 13.1888 0.043L15.142 3.0569C7.8476 7.0026 6.4216 12.1229 5.8529 15.3512C7.0274 14.7432 8.565 14.531 10.072 14.671C14.0177 15.0362 17.1279 18.2755 17.1279 22.3021C17.1279 24.3324 16.3214 26.2795 14.8858 27.7152C13.4502 29.1508 11.503 29.9573 9.4727 29.9573C8.3499 29.9476 7.2403 29.7147 6.2084 29.2719C5.1765 28.8292 4.243 28.1856 3.4623 27.3786ZM25.3343 27.3786C23.0815 24.9858 21.872 22.3021 21.872 17.9518C21.872 10.2966 27.2459 3.4353 35.0608 0.043L37.014 3.0569C29.7197 23.0026 28.2936 28.1229 27.7249 31.3512C28.8995 30.7432 30.4371 30.531 31.944 30.671C35.8898 31.0362 38.9999 34.2755 38.9999 38.3021C38.9999 40.3324 38.1934 42.2795 36.7578 43.7152C35.3222 45.1508 33.375 45.9573 31.3448 45.9573C30.2219 45.9476 29.1123 45.7147 28.0804 45.2719C27.0485 44.8292 26.115 44.1856 25.3343 43.3786Z" fill="#FEC8E0" />
  </svg>
);
