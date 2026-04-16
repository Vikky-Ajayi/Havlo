import React from 'react';
import { motion } from 'motion/react';
import { HeroSection } from '../components/shared/HeroSection';
import { TrustpilotStars } from '../components/ui/TrustpilotStars';
import { ReviewCard } from '../components/shared/ReviewCard';
import { ChevronLeft, ChevronRight, Users, Globe, ChartLine, Star, ArrowRight } from 'lucide-react';
import { useModal } from '../hooks/useModal';
import { cn } from '../lib/utils';

export const EliteProperty: React.FC = () => {
  const { openModal } = useModal();
  return (
    <div className="flex flex-col w-full overflow-hidden bg-white">
      {/* 1. Hero Section */}
      <HeroSection 
        overline="Global Property Advisory"
        title="Sell Your Property to the World, Not Just Your Local Market"
        subtitle="Havlo connects your property directly with vetted foreign buyers actively looking to acquire real estate abroad—helping you achieve faster, more strategic sales."
        imageSrc="/Mask group2.png"
        buttonText="Access Global Buyers"
        onButtonClick={() => openModal('create-account')}
        secondaryButtonText="Submit Your Property"
        onSecondaryButtonClick={() => openModal('create-account')}
        titleStyle={{ marginTop: '39px', fontSize: '68px' }}
        overlineStyle={{ marginTop: '-59px' }}
        subtitleStyle={{ marginTop: '-20px' }}
        imageStyle={{ marginTop: '-50px' }}
        containerStyle={{ marginTop: '-25px' }}
      />

      {/* 2. What Makes Havlo Different */}
      <section className="flex w-full flex-col items-center justify-center bg-gradient-to-b from-[#FFB0E8] to-[#FEEAA0] px-4 py-20 sm:px-10 lg:px-[100px]">
        <div className="flex w-full max-w-7xl flex-col items-center justify-between gap-16 lg:flex-row">
          <div className="flex flex-col items-start gap-10 lg:w-1/2">
            <div className="flex items-center gap-3">
              <div className="h-0.5 w-7 rounded-full bg-black" />
              <span className="font-body text-2xl font-bold uppercase tracking-tight text-black">
                WHAT MAKES HAVLO DIFFERENT
              </span>
            </div>
            <h2 className="font-display text-[44px] font-black leading-[1.1] text-[#050405] sm:text-[56px]">
              We are not a real estate agent
            </h2>
            <p className="max-w-[534px] font-body text-lg leading-[1.5] text-black">
              Our role is to complement your agent's efforts by connecting your property with vetted international buyers—without disrupting your current sale process.
              <br /><br />
              We are a global advisory platform that accelerates property sales by introducing your asset to the right international buyers. Instead of listing and waiting, we proactively match your property with decision-makers.
            </p>
            <div className="flex w-full flex-col border-t border-black/10">
              {['Family Offices', 'International Investors', 'High-Net-Worth Individuals', 'Cross-border buyers seeking overseas assets'].map((item) => (
                <div key={item} className="flex items-center border-b border-black/10 py-6">
                  <span className="font-body text-lg font-normal text-black">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:w-1/2">
            <img 
              src="https://api.builder.io/api/v1/image/assets/TEMP/63649d57d6e3e12c788a2f6e27d7b29e97f4908c?width=1280" 
              alt="Global Network"
              className="w-full max-w-[640px] object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </section>

      {/* 3. Reviews Section */}
      <section className="flex w-full items-center bg-white px-4 py-20 sm:px-10 lg:px-[100px]">
        <div className="mx-auto flex w-full flex-col lg:flex-row items-center gap-10 lg:gap-8">
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

          {/* Desktop Reviews */}
          <div className="hidden lg:flex relative flex-1 items-center gap-8">
            <button className="h-8 w-8 items-center justify-center rounded-full border border-black/20 flex shrink-0">
              <ChevronLeft size={20} />
            </button>
            <div className="flex flex-1 gap-8 overflow-x-auto pb-4 no-scrollbar sm:overflow-visible">
              <ReviewCard
                title="Connected us to serious offshore buyers instantly"
                content="Our property had been on the market for months with little interest locally. Havlo introduced it to their curated list of offshore buyers, and we started receiving serious enquiries immediately. The property sold much faster than expected."
                author="James – Manchester"
                time=""
              />
              <ReviewCard
                title="Faster sale thanks to Havlo’s international network"
                content="We had a slow-moving property, but Havlo connected us with buyers overseas who were ready to act. Within weeks, we had multiple serious offers — far quicker than relying on traditional channels."
                author="Shah – London"
                time=""
              />
              <ReviewCard
                title="Havlo’s offshore buyers made all the difference"
                content="I had been struggling to get viewings locally. Once Havlo introduced my property to their curated offshore list, we received high-quality enquiries almost immediately. The property sold within a fraction of the time I expected."
                author="Jack – Birmingham"
                time=""
              />
            </div>
            <button className="h-8 w-8 items-center justify-center rounded-full border border-black/20 flex shrink-0">
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Mobile Reviews */}
          <div className="flex lg:hidden flex-col items-center gap-8 w-full" style={{ marginTop: '80px' }}>
            {/* Empty div to match nth-of-type(1) if needed, but usually the first child is the first card */}
            <div className="hidden" /> 
            
            <div style={{ marginTop: '-53px', marginLeft: '-58px' }}>
              <ReviewCard
                title="Connected us to serious offshore buyers instantly"
                content="Our property had been on the market for months with little interest locally. Havlo introduced it to their curated list of offshore buyers, and we started receiving serious enquiries immediately."
                author="James – Manchester"
                time=""
              />
            </div>
            <div style={{ marginRight: '-57px', marginTop: '-50px' }}>
              <ReviewCard
                title="Faster sale thanks to Havlo’s network"
                content="We had a slow-moving property, but Havlo connected us with buyers overseas who were ready to act. Within weeks, we had multiple serious offers."
                author="Shah – London"
                time=""
              />
            </div>
            <div style={{ marginLeft: '-51px', marginTop: '-53px' }}>
              <ReviewCard
                title="Havlo’s offshore buyers made all the difference"
                content="I had been struggling to get viewings locally. Once Havlo introduced my property to their curated offshore list, we received high-quality enquiries almost immediately."
                author="Jack – Birmingham"
                time=""
              />
            </div>
            <div style={{ marginRight: '-57px', marginTop: '-50px' }}>
              <ReviewCard
                title="Incredible results"
                content="The speed at which Havlo found buyers was impressive. We were skeptical at first but the results speak for themselves."
                author="Sarah – Leeds"
                time=""
              />
            </div>
            <div style={{ marginLeft: '-55px', marginTop: '-59px' }}>
              <ReviewCard
                title="Global reach is real"
                content="We reached buyers in Asia and the Middle East that our local agent simply couldn't access. Highly recommend."
                author="Robert – Bristol"
                time=""
              />
            </div>
            <div style={{ marginRight: '-20px', marginTop: '-50px' }}>
              <ReviewCard
                title="Seamless process"
                content="From submission to introduction, everything was handled professionally. A great addition to our sales strategy."
                author="Emily – Oxford"
                time=""
              />
            </div>
          </div>
        </div>
      </section>

      {/* 4. What We Do */}
      <section className="flex flex-col items-center gap-14 bg-[#FEFFFF] px-4 py-20 sm:px-10 lg:px-[100px]">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex items-center gap-3">
            <div className="h-0.5 w-7 rounded-full bg-black" />
            <span className="font-body text-2xl font-bold uppercase tracking-tight text-black">
              What We Do
            </span>
          </div>
          <h2 className="font-display text-[44px] font-black leading-[1.1] text-[#050405] sm:text-[56px]">
            Precision Access to Global Capital
          </h2>
          <p className="max-w-[440px] font-body text-lg leading-[1.2] text-black/80">
            Four pillars that set our approach apart from conventional property marketing.
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: "Direct Buyer Access",
              desc: "We connect your property with a curated network of offshore buyers already interested in acquiring property abroad.",
              icon: <Users className="text-havlo-purple" size={24} />,
            },
            {
              title: "Global Visibility That Matters",
              desc: "Your property is positioned in front of decision-makers—not lost on crowded listing platforms.",
              icon: <Globe className="text-havlo-purple" size={24} />,
            },
            {
              title: "Faster Path to Sale",
              desc: "By targeting active international buyers, we significantly increase the likelihood of quicker transactions.",
              icon: <ChartLine className="text-havlo-purple" size={24} />,
            },
            {
              title: "Strategic Positioning",
              desc: "We present your property in a way that resonates with global investors, not just local retail buyers.",
              icon: <Star className="text-havlo-purple" size={24} />,
            },
          ].map((item, idx) => (
            <div key={idx} className="flex flex-col gap-14 rounded-xl bg-[#F7F9F6] p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F7DEFC]">
                {item.icon}
              </div>
              <div className="flex flex-col gap-6">
                <h3 className="font-body text-[28px] font-bold leading-[1.2] text-black">
                  {item.title}
                </h3>
                <p className="font-body text-lg leading-[1.2] text-black/80">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Why Sellers Choose Havlo (Purple Section) */}
      <section className="relative flex flex-col items-center gap-14 bg-[#A409D2] px-4 pt-32 pb-48 sm:px-10 lg:px-[100px]">
        <div className="flex flex-col items-center gap-8 text-center">
          <div className="flex items-center gap-3">
            <div className="h-0.5 w-7 rounded-full bg-white" />
            <span className="font-body text-2xl font-bold uppercase tracking-tight text-white">
              Six Reasons We Deliver Results
            </span>
          </div>
          <h2 className="font-display text-[44px] font-black leading-[1.1] text-white sm:text-[56px]">
            Why Sellers Choose Havlo
          </h2>
        </div>

        <div className="grid w-full grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 max-w-7xl">
          {[
            { num: "01", title: "We Don't List. We Introduce.", desc: "Traditional agents rely on listings and passive exposure. We actively place your property in front of buyers already looking." },
            { num: "02", title: "Access to Capital-Rich Buyers", desc: "Our network includes family offices and international investors with immediate purchasing power." },
            { num: "03", title: "Borderless Demand Creation", desc: "We unlock demand beyond your domestic market, where pricing and appetite may be stronger." },
            { num: "04", title: "Advisory-Led Approach", desc: "We guide you on how to position your property to appeal to offshore buyers and maximise interest." },
            { num: "05", title: "Speed Through Targeting", desc: "More relevant exposure means fewer delays and a higher probability of serious offers." },
            { num: "06", title: "Discreet & Professional", desc: "We operate with confidentiality and precision, ideal for high-value or sensitive transactions." },
          ].map((item, idx) => (
            <div key={idx} className="flex flex-col gap-14 border-l-2 border-white p-5">
              <span className="font-body text-2xl font-bold text-white">{item.num}</span>
              <div className="flex flex-col gap-6">
                <h3 className="font-body text-2xl font-bold leading-[1.2] text-white">
                  {item.title}
                </h3>
                <p className="font-body text-lg leading-[1.2] text-white/90">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Concave Bottom Curve */}
        <div 
          className="absolute bottom-0 left-1/2 h-[221px] w-[1951px] -translate-x-1/2 translate-y-1/2 rounded-[100%] bg-white"
          style={{ boxShadow: '0 -20px 40px rgba(0,0,0,0.05)' }}
        />
      </section>

      {/* 6. Private International Buyer Advisory */}
      <section className="flex flex-col items-center gap-14 bg-white px-4 pt-40 pb-20 sm:px-10 lg:px-[100px]">
        <div className="flex w-full max-w-7xl flex-col gap-14">
          <div className="flex flex-col gap-8">
            <div className="flex items-center gap-3">
              <div className="h-0.5 w-7 rounded-full bg-havlo-purple" />
              <span className="font-body text-2xl font-bold uppercase tracking-tight text-havlo-purple">
                Private International Buyer Advisory
              </span>
            </div>
            <h2 className="font-display text-[44px] font-black leading-[1.1] text-[#050405] sm:text-[56px]">
              For Homeowners Seeking Faster Sales
            </h2>
            <p className="max-w-5xl font-body text-lg leading-[1.5] text-black">
              For homeowners seeking faster sales through international exposure. We work with a select number of clients to position and introduce their property to our curated network of offshore purchasers—beyond the reach of traditional local market exposure.
            </p>
          </div>

          <div className="flex flex-col overflow-hidden rounded-xl bg-[#F6F8F6] lg:flex-row">
            {/* Investment Breakdown */}
            <div className="flex flex-col gap-6 p-8 lg:w-1/2 border-r border-black/5">
              <div className="flex flex-col gap-5 border-b border-black/5 pb-6">
                <span className="font-body text-xl font-normal text-black uppercase">TOTAL ADVISORY INVESTMENT</span>
                <span className="font-display text-[44px] font-medium text-havlo-purple">£20,000</span>
                <p className="font-body text-xl font-normal text-black">Structured to align commitment and delivery:</p>
              </div>

              <div className="flex flex-col gap-6">
                {/* Stage 1 */}
                <div className="flex flex-col border border-black/10 rounded-lg overflow-hidden">
                  <div className="flex flex-col gap-4 bg-white p-8 border-b border-black/5">
                    <span className="font-body text-lg font-bold uppercase text-black/40">STAGE 1 - ENGAGEMENT</span>
                    <div className="flex flex-col">
                      <span className="font-body text-[32px] font-medium text-[#A409D3]">£5,000</span>
                      <span className="font-body text-xl font-normal text-black">Private Mandate Fee</span>
                    </div>
                  </div>
                  <div className="bg-[#F4F3F1] p-8">
                    <p className="font-body text-lg leading-[1.5] text-black">
                      Paid upfront. Initiates your engagement — covering positioning strategy, buyer targeting, and preparation for international introduction.
                    </p>
                  </div>
                </div>

                {/* Stage 2 */}
                <div className="flex flex-col border border-black/10 rounded-lg overflow-hidden">
                  <div className="flex flex-col gap-4 bg-[#1E002A] p-8 border-b border-black/5">
                    <span className="font-body text-lg font-bold uppercase text-white/70">STAGE 2 - SUCCESS</span>
                    <div className="flex flex-col">
                      <span className="font-body text-[32px] font-medium text-[#00BC67]">£15,000</span>
                      <span className="font-body text-xl font-normal text-white">Success Advisory Fee</span>
                    </div>
                  </div>
                  <div className="bg-black p-8">
                    <p className="font-body text-lg leading-[1.5] text-white">
                      Payable upon the buyer's confirmed commitment or the successful closing of the sale.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Lists */}
            <div className="flex flex-col gap-12 p-8 lg:w-1/2">
              <div className="flex flex-col gap-8">
                <span className="font-body text-xl font-medium uppercase text-havlo-purple">What this enables</span>
                <ul className="flex flex-col">
                  {[
                    "Direct access to a vetted international buyer network",
                    "Strategic positioning tailored to offshore demand",
                    "Discreet, off-market exposure",
                    "Introductions designed to attract serious, qualified purchasers"
                  ].map((item, idx) => (
                    <li key={idx} className="border-t border-black/10 py-6 font-body text-lg text-black flex items-center gap-3">
                      <div className="h-1.5 w-1.5 rounded-full bg-black shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex flex-col gap-8">
                <span className="font-body text-xl font-medium uppercase text-havlo-purple">Who This Is For</span>
                <ul className="flex flex-col">
                  {[
                    "Homeowners with property valued at £1,000,000+",
                    "Sellers seeking access to international capital",
                    "Those prioritising discretion, control, and strategic positioning",
                    "Sellers seeking faster sale of their property.",
                    "Sellers who's property has been on the market for over 12 months."
                  ].map((item, idx) => (
                    <li key={idx} className="border-t border-black/10 py-6 font-body text-lg text-black flex items-center gap-3">
                      <div className="h-1.5 w-1.5 rounded-full bg-black shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-8 border-t border-black/10 pt-14 lg:flex-row">
            <div className="flex flex-col gap-8 lg:w-2/3">
              <h3 className="font-display text-[44px] font-black leading-[1.1] text-[#050405]">
                Request a Private Consultation
              </h3>
              <p className="font-body text-lg leading-[1.5] text-black">
                If your property meets our criteria, we’ll outline how it would be positioned and introduced to our international buyer network.
              </p>
            </div>
            <button 
              onClick={() => openModal('create-account')}
              className="flex items-center gap-3 rounded-full bg-havlo-purple px-8 py-4 font-body text-lg font-medium uppercase text-white transition-all hover:bg-havlo-purple-dark"
            >
              BEGIN YOUR CONSULTATION
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* 7. How It Works */}
      <section className="flex flex-col items-center gap-14 bg-[#FEFFFF] px-4 py-20 sm:px-10 lg:px-[100px]">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex items-center gap-3">
            <div className="h-0.5 w-7 rounded-full bg-black" />
            <span className="font-body text-2xl font-bold uppercase tracking-tight text-black">
              HOW IT WORKS
            </span>
          </div>
          <h2 className="font-display text-[44px] font-black leading-[1.1] text-[#050405] sm:text-[56px]">
            Four steps to Global Buyers
          </h2>
          <p className="max-w-[440px] font-body text-lg leading-[1.2] text-black/80">
            A highly efficient, results-driven process crafted to showcase your property to qualified international buyers fast, focused, and with maximum impact.
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 max-w-7xl">
          {[
            { step: "1", title: "Submit Your Property", desc: "Share key details about your asset." },
            { step: "2", title: "Engagement & Offers", desc: "Interested buyers engage directly with you or your agent, increasing chances of faster deal flow." },
            { step: "3", title: "Buyer Matching", desc: "We strategically present your property to a curated network of international buyers who have already expressed a clear intent to invest in overseas opportunities, ensuring targeted exposure and higher-quality enquiries." },
            { step: "4", title: "Close with Your Preferred Parties", desc: "We facilitate exposure and introductions - you retain control over negotiations and executions." },
          ].map((item, idx) => (
            <div key={idx} className="flex flex-col gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-black/10 bg-gradient-to-br from-[#FFB0E8] to-white font-body text-base font-normal">
                {item.step}
              </div>
              <div className="flex flex-col gap-3">
                <h3 className="font-body text-2xl font-bold leading-[1.2] text-black">
                  {item.title}
                </h3>
                <p className="font-body text-lg leading-[1.2] text-black/80">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex w-full max-w-7xl flex-col gap-8 rounded-3xl bg-[#F7F9F6] p-8">
          <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
            <div className="flex flex-col gap-8">
              <div className="flex items-center gap-3">
                <div className="h-0.5 w-7 rounded-full bg-black" />
                <span className="font-body text-2xl font-bold uppercase tracking-tight text-black">
                  Who This Is For
                </span>
              </div>
              <div className="flex flex-wrap gap-4">
                {[
                  "Limited Local Demand Markets",
                  "High-Value or Unique Assets",
                  "Property Owners Seeking Faster Sales",
                  "International Capital Seekers"
                ].map((tag) => (
                  <div key={tag} className="rounded-full border border-havlo-purple px-5 py-3 font-body text-lg font-medium text-havlo-purple">
                    {tag}
                  </div>
                ))}
              </div>
            </div>
            <button 
              onClick={() => openModal('create-account')}
              className="flex items-center gap-3 rounded-full bg-black px-8 py-4 font-body text-lg font-medium uppercase text-white transition-all hover:bg-black/90"
            >
              SUBMIT YOUR PROPERTY
              <ArrowRight size={18} />
            </button>
          </div>
          <p className="font-body text-lg leading-[1.2] text-black">
            <span className="font-bold">Havlo</span> is not a <span className="font-bold">brokerage</span>. We are a global connector of property and capital, designed to bring your asset directly to buyers who are already looking beyond their borders. We complements your agent’s efforts by introducing your property to buyers beyond their reach, helping you sell faster and more strategically.”
          </p>
        </div>
      </section>

      {/* 8. Tap Into Global Demand */}
      <section className="flex flex-col items-center gap-8 bg-white px-4 py-20 text-center">
        <h2 className="font-display text-[44px] font-black leading-[1.1] text-[#050405] sm:text-[56px]">
          Tap Into Global Demand
        </h2>
        <p className="max-w-[552px] font-body text-xl font-medium text-black/80">
          Stop waiting for buyers to find your property—put it directly in front of them.
        </p>
        <button 
          onClick={() => openModal('create-account')}
          className="flex items-center gap-3 rounded-full bg-black px-8 py-4 font-body text-lg font-medium uppercase text-white transition-all hover:bg-black/90"
        >
          Reach Global Buyers
          <ArrowRight size={18} />
        </button>
      </section>
    </div>
  );
};
