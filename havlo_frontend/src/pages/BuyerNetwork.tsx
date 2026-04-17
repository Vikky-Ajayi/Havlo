import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Check, ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { HeroBackground } from '../components/shared/HeroBackground';
import { ReviewCard } from '../components/shared/ReviewCard';
import { TrustpilotStars } from '../components/ui/TrustpilotStars';
import { useModal } from '../hooks/useModal';
import { useHorizontalScroll } from '../hooks/useHorizontalScroll';

const buyerNetworkReviews = [
  { title: 'Opened up a completely new buyer market', content: 'Havlo helped us reach international buyers we simply couldn’t access through traditional portals. It added a powerful new dimension to our listings.', author: 'Oliver, London' },
  { title: 'Stronger demand from global buyers', content: 'We started receiving enquiries from serious overseas investors almost immediately. The quality of leads was noticeably higher.', author: 'Samantha, Manchester' },
  { title: 'A real boost beyond property portals', content: 'Using Havlo alongside Rightmove and Zoopla gave us a clear advantage. Our listings reached a much wider audience.', author: 'Daniel, Birmingham' },
  { title: 'Helped us sell faster', content: 'Properties that were sitting for months started gaining traction once we used the International Buyer Network. It made a real difference to our timelines.', author: 'James, Leeds' },
  { title: 'High-quality, ready-to-buy enquiries', content: 'The buyers introduced through Havlo were clearly qualified and serious. It saved us time filtering out low-intent leads.', author: 'Hannah, Bristol' },
  { title: 'Gave our agency a competitive edge', content: 'Havlo allowed us to offer something other agents couldn’t—access to international buyers. It’s been a great addition to our service.', author: 'Marcus, Liverpool' },
  { title: 'Perfect for high-value listings', content: 'For premium properties, this service is incredibly effective. It connects you with buyers who are actively looking to invest globally.', author: 'Charlotte, Oxford' },
  { title: 'Expanded our reach instantly', content: 'We were able to showcase our listings to a global audience without changing how we operate. Very easy to integrate into our process.', author: 'Ryan, Nottingham' },
  { title: 'More exposure, better results', content: 'The added international visibility helped generate more interest and ultimately led to quicker sales on several listings.', author: 'Amelia, Edinburgh' },
  { title: 'A smart addition for modern agents', content: 'Relying only on property portals is no longer enough. Havlo gave us access to a targeted international audience that delivers results.', author: 'Khalid, Dubai' },
];

export const BuyerNetwork: React.FC = () => {
  const { openModal } = useModal();
  const desktopReviews = useHorizontalScroll<HTMLDivElement>();
  const whyChooseItems = [
    {
      id: '01',
      title: 'Faster Sales',
      description: 'Give us your property listings and we\u2019ll amplify their reach to drive faster sales.',
    },
    {
      id: '02',
      title: 'Exclusive Network',
      description: 'Curated offshore buyers actively looking for premium properties.',
    },
    {
      id: '03',
      title: 'Premium Positioning',
      description: 'Offer clients a global marketing advantage and impress vendors.',
    },
    {
      id: '04',
      title: 'Data-Driven',
      description: 'Campaigns optimised for high-intent buyers with weekly reporting.',
    },
  ];

  const howItWorksSteps = [
    {
      id: 1,
      title: 'Submit your property',
      description: 'Send us the details of your listing and target market.',
    },
    {
      id: 2,
      title: 'We build a bespoke campaign',
      description: 'Havlo creates a tailored international campaign using multi-region targeting, high-quality creative, and lead capture funnels.',
    },
    {
      id: 3,
      title: 'Connect with ready-to-buy buyers',
      description: 'Your listing is promoted to our vetted network of offshore buyers actively looking to purchase in your region.',
    },
    {
      id: 4,
      title: 'Sell faster and impress vendors',
      description: 'With Havlo handling international exposure, agents close sales faster, attract higher-value instructions, and enhance their reputation.',
    },
  ];

  const packages = [
    {
      name: 'PARTNER',
      price: '£2,000/mo',
      subtitle: 'Up to 2 active properties',
      features: [
        'International buyer network access',
        'Strategy & campaign planning',
        'Monthly reporting',
        'Email support',
      ],
      recommended: false,
    },
    {
      name: 'GROWTH PARTNER',
      price: '£4,000/mo',
      subtitle: 'Up to 5 active properties',
      features: [
        'Everything in Partner',
        'Priority launches',
        'Co-branded marketing',
        'Weekly reporting',
        'Strategy calls',
      ],
      recommended: true,
    },
    {
      name: 'PRIVATE CLIENT PARTNER',
      price: '£7,500+/mo',
      subtitle: 'High-volume',
      features: [
        'Dedicated account manager',
        'Full creative suite',
        'White-label service',
        'Weekly strategy calls',
        'Vendor-winning support',
      ],
      recommended: false,
    },
  ];

  return (
    <div className="flex flex-col w-full bg-white">
      {/* 1. Hero Section */}
      <section className="relative flex flex-col items-center pt-24 pb-48 px-6 lg:px-[100px] bg-gradient-to-b from-[#FFB0E8] 50% to-[#FEEAA0] 100% overflow-hidden min-h-[630px]">
        <div className="relative z-10 flex flex-col items-center text-center max-w-[1144px] mx-auto">
          <motion.span 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-body text-lg font-normal uppercase tracking-[-0.36px] text-black mb-10"
            style={{ marginTop: '-18px' }}
          >
            INTERNATIONAL BUYER NETWORK
          </motion.span>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="font-display font-black tracking-[-1.6px] text-[#1F1F1E] mb-10 md:text-[64px] lg:text-[77px] text-[88px]"
            style={{ marginTop: '-10px' }}
          >
            Estate Agents, Sell Properties Faster with Havlo's International Buyer Network
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="font-body text-lg lg:text-xl font-normal leading-[1.3] tracking-[-0.36px] text-black max-w-[682px] mb-12"
            style={{ marginTop: '-14px' }}
          >
            Go beyond property portals. Connect your listings with a curated network of ready-to-buy offshore buyers and close deals faster.
          </motion.p>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-6"
          >
            <Button 
              onClick={() => openModal('create-account')}
              className="h-[56px] px-8 bg-black text-white rounded-[48px] font-body text-lg font-semibold tracking-[-0.36px] hover:bg-black/90 transition-colors"
              style={{ marginTop: '-10px' }}
            >
              GET STARTED TODAY
            </Button>
          </motion.div>
        </div>

        {/* Jagged Edge */}
        <div className="absolute bottom-[-1px] left-0 right-0 h-[90px] z-20 pointer-events-none">
          <HeroBackground 
            showTop={true}
            showBottom={false}
            className="h-full w-full"
          />
        </div>
      </section>

      {/* 2. Why estate agents choose Havlo */}
      <section className="flex flex-col items-center bg-white py-24 lg:py-32 px-6 lg:px-[100px]">
        <h2 className="font-display text-[48px] lg:text-[56px] font-black leading-[1.1] text-[#040504] text-center mb-16">
          Why estate agents choose Havlo
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 w-full max-w-[1240px] mx-auto">
          {whyChooseItems.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              viewport={{ once: true }}
              className="flex flex-col justify-between p-8 rounded-[20px] border border-[#F8F7F6] bg-[#F9F9F9] min-h-[227px]"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#F5D8FD] border border-[#F5D8FD]">
                <span className="font-display text-lg font-bold text-[#A409D2] tracking-[-0.36px]">{item.id}</span>
              </div>
              <div className="flex flex-col gap-6 mt-8">
                <h3 className="font-display text-2xl font-bold text-[#1F1F1E] tracking-[-0.48px]">{item.title}</h3>
                <p className="font-body text-base font-medium leading-[1.2] tracking-[-0.32px] text-black">
                  {item.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 3. How it works */}
      <section className="flex flex-col py-24 px-6 lg:px-[100px] bg-[#F9F8F9] overflow-hidden">
        <div className="max-w-[1040px] mx-auto w-full">
          <h2 className="font-display text-[44px] font-black leading-[1.1] text-[#050405] mb-12">
            How it works
          </h2>
          <div className="flex flex-col">
            {howItWorksSteps.map((step) => (
              <div key={step.id} className="flex items-start gap-4 py-8 border-b border-black/10 last:border-0">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#F5D8FD] border border-[#F5D8FD] shrink-0 mt-1">
                  <span className="font-display text-lg font-bold text-[#A409D2] tracking-[-0.36px]">{step.id}</span>
                </div>
                <div className="flex flex-col gap-4">
                  <h3 className="font-body text-lg font-bold text-black leading-[1.5] tracking-[-0.054px]">
                    {step.title}
                  </h3>
                  <p className="font-body text-lg font-normal text-black leading-[1.5] tracking-[-0.054px]">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Packages for estate agents */}
      <section className="flex flex-col py-24 px-6 lg:px-[100px] bg-white">
        <div className="max-w-[1240px] mx-auto w-full">
          <h2 className="font-display text-[44px] font-black leading-[1.1] text-[#050405] mb-14">
            Packages for estate agents
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {packages.map((pkg) => (
              <div 
                key={pkg.name}
                className="flex flex-col p-6 rounded-[20px] border-[1.5px] border-black/10 relative"
              >
                <div className="flex justify-between items-center mb-6 h-[29px]">
                  <span className="font-display text-lg font-medium uppercase tracking-[-0.36px] text-black">
                    {pkg.name}
                  </span>
                  {pkg.recommended && (
                    <div className="bg-[#00BC67] px-2 py-1">
                      <span className="font-display text-lg font-medium uppercase tracking-[-0.36px] text-white">
                        RECOMMENDED
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-3 mb-6">
                  <div className="font-display text-[28px] font-semibold tracking-[-0.56px] text-[#1F1F1E]">
                    {pkg.price}
                  </div>
                  <div className="font-body text-sm font-normal tracking-[-0.28px] text-black/70">
                    {pkg.subtitle}
                  </div>
                </div>
                <div className="flex flex-col gap-4 pt-4 border-t border-black/10">
                  {pkg.features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-[#149D4F]" />
                      <span className="font-body text-base font-medium tracking-[-0.32px] text-black/70">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* 5. What agents say */}
      <section className="flex flex-col py-24 px-6 lg:px-[100px] bg-[#F9F8F9] overflow-hidden">
        <div className="max-w-[1240px] mx-auto w-full flex flex-col items-center gap-14">
          <h2 className="font-display text-[44px] font-black leading-[1.1] text-[#050405] text-center">
            What agents say
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full">
            <div className="bg-white p-8 rounded-2xl flex flex-col gap-6">
              <Quote className="w-6 h-5 text-[#A409D2] fill-[#A409D2]" />
              <p className="font-display text-2xl font-medium leading-[1] tracking-[-0.48px] text-[#1F1F1E]">
                Since partnering with Havlo, our premium listings have sold faster and attracted international buyers we couldn't reach before.
              </p>
              <div className="flex items-center gap-3">
                <span className="font-display text-[40px] font-medium tracking-[-0.8px] text-[#1F1F1E]">-</span>
                <span className="font-body text-lg font-normal tracking-[-0.36px] text-[#1F1F1E]">
                  Top Estate Agent, London
                </span>
              </div>
            </div>
            <div className="bg-white p-8 rounded-2xl flex flex-col gap-6">
              <Quote className="w-6 h-5 text-[#A409D2] fill-[#A409D2]" />
              <p className="font-display text-2xl font-medium leading-[1] tracking-[-0.48px] text-[#1F1F1E]">
                "Havlo makes us look like a global agency. Our vendors love it."
              </p>
              <div className="flex items-center gap-3">
                <span className="font-display text-[40px] font-medium tracking-[-0.8px] text-[#1F1F1E]">-</span>
                <span className="font-body text-lg font-normal tracking-[-0.36px] text-[#1F1F1E]">
                  High-End Property Specialist, Dubai
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5b. Trustpilot reviews */}
      <section className="flex flex-col w-full bg-white px-4 py-16 sm:px-10 lg:px-[100px]">
        <div className="mx-auto flex w-full max-w-[1240px] flex-col lg:flex-row items-center gap-10">
          {/* Rated Block */}
          <div className="flex flex-col items-center lg:items-start gap-4 text-center lg:text-left max-w-[280px]">
            <h2 className="font-body text-[32px] lg:text-[40px] font-medium leading-none tracking-[-0.8px] text-[#040504]">
              Rated
            </h2>
            <TrustpilotStars className="h-[30px] lg:h-[36px]" />
            <p className="font-body text-[16px] font-normal text-black/80">
              Real stories from agents who grew their reach with Havlo.
            </p>
          </div>

          {/* Swipeable carousel */}
          <div className="relative flex flex-1 items-center gap-3 sm:gap-4 min-w-0 w-full">
            <button
              onClick={desktopReviews.scrollPrev}
              aria-label="Previous reviews"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/15 bg-white text-black/70 hover:bg-black/5"
            >
              <ChevronLeft size={18} />
            </button>
            <div
              ref={desktopReviews.containerRef}
              {...desktopReviews.dragHandlers}
              className="flex flex-1 gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar select-none cursor-grab active:cursor-grabbing"
            >
              {buyerNetworkReviews.map((r, i) => (
                <div
                  key={i}
                  className="snap-start shrink-0 basis-full sm:basis-[calc((100%-1rem)/2)] lg:basis-[calc((100%-2rem)/3)] min-w-[240px] rounded-xl bg-[#F5F5F3] p-5"
                >
                  <ReviewCard title={r.title} content={r.content} author={r.author} time="" />
                </div>
              ))}
            </div>
            <button
              onClick={desktopReviews.scrollNext}
              aria-label="Next reviews"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/15 bg-white text-black/70 hover:bg-black/5"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* 6. Bottom CTA Section */}
      <section className="relative flex flex-col items-center py-24 px-6 lg:px-[150px] bg-white overflow-hidden min-h-[400px] justify-center">
        <div className="relative z-20 flex flex-col items-center text-center max-w-[700px] mx-auto gap-14">
          <div className="flex flex-col items-center gap-8">
            <h2 className="font-display text-[44px] font-black leading-[1.1] text-black">
              Ready to Accelerate Your Property Sales?
            </h2>
            <p className="font-body text-lg font-normal leading-[1.5] tracking-[-0.054px] text-black">
              Join Havlo's International Buyer Network and offer your clients unmatched global exposure.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <Button 
              onClick={() => openModal('create-account')}
              className="h-[56px] px-8 bg-[#A409D2] text-white rounded-[48px] font-body text-lg font-semibold tracking-[-0.36px] hover:bg-[#A409D2]/90 transition-colors"
            >
              GET STARTED TODAY
            </Button>
          </div>
        </div>

        {/* Decorative Torn Edge Background */}
        <div className="absolute top-0 left-0 right-0 h-[400px] z-10 pointer-events-none">
          <HeroBackground 
            showTop={true}
            showBottom={false}
            className="h-full w-full bg-[#F9F8F9]" 
          />
        </div>
      </section>
    </div>
  );
};
