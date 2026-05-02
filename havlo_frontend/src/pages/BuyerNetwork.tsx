import React from 'react';
import { motion } from 'motion/react';
import { Check, X } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { HeroBackground } from '../components/shared/HeroBackground';
import { AutoScrollReviews } from '../components/shared/AutoScrollReviews';
import { useModal } from '../hooks/useModal';
import { usePageMeta } from '../hooks/usePageMeta';

const portalCons = [
  'Listings go stale over time, losing visibility and momentum',
  'Relies on the same pool of active buyers who have already seen the property',
  'Price reductions become the only lever to generate interest',
  '"Seen it before" effect kills buyer engagement',
  'Competes directly with newer, more attractive listings',
  'Limited control—wait and hope for enquiries',
  'Vendors lose confidence when properties sit unsold',
  'Agents risk losing instructions on slow-moving stock',
  'Exposure declines over time in portal algorithms',
  'Reactive approach: respond to demand that may never come',
];

const havloPros = [
  'Relaunches stale properties with fresh campaigns that reignite interest',
  'Targets new audiences who haven\'t seen or considered the property before',
  'Generates demand without immediately cutting price',
  'Repositions the property as a new opportunity, not old stock',
  'Creates a standout campaign that separates it from portal noise',
  'Proactive outreach that drives enquiries on demand',
  'Demonstrates a clear action plan, restoring vendor confidence',
  'Helps agents retain instructions and recover deals',
  'Fresh visibility across multiple channels—not just portals',
  'Strategic approach: create demand where none exists',
];

const agentReviews = [
  { title: 'Opened up a completely new buyer market', content: 'Havlo helped us reach international buyers we simply couldn\'t access through traditional portals. It added a powerful new dimension to our listings.', author: 'Oliver, London' },
  { title: 'Stronger demand from global buyers', content: 'We started receiving enquiries from serious overseas investors almost immediately. The quality of leads was noticeably higher.', author: 'Samantha, Manchester' },
  { title: 'A real boost beyond property portals', content: 'Using Havlo alongside Rightmove and Zoopla gave us a clear advantage. Our listings reached a much wider audience.', author: 'Daniel, Birmingham' },
  { title: 'Helped us sell faster', content: 'Properties that were sitting for months started gaining traction once we used the International Buyer Network. It made a real difference to our timelines.', author: 'James, Leeds' },
  { title: 'High-quality, ready-to-buy enquiries', content: 'The buyers introduced through Havlo were clearly qualified and serious. It saved us time filtering out low-intent leads.', author: 'Hannah, Bristol' },
  { title: 'Gave our agency a competitive edge', content: 'Havlo allowed us to offer something other agents couldn\'t-access to international buyers. It\'s been a great addition to our service.', author: 'Marcus, Liverpool' },
  { title: 'Perfect for high-value listings', content: 'For premium properties, this service is incredibly effective. It connects you with buyers who are actively looking to invest globally.', author: 'Charlotte, Oxford' },
  { title: 'Expanded our reach instantly', content: 'We were able to showcase our listings to a global audience without changing how we operate. Very easy to integrate into our process.', author: 'Ryan, Nottingham' },
  { title: 'More exposure, better results', content: 'The added international visibility helped generate more interest and ultimately led to quicker sales on several listings.', author: 'Amelia, Edinburgh' },
  { title: 'A smart addition for modern agents', content: 'Relying only on property portals is no longer enough. Havlo gave us access to a targeted international audience that delivers results.', author: 'Khalid, Dubai' },
];

export const BuyerNetwork: React.FC = () => {
  usePageMeta({
    title: "Access a Global Buyer Network for Your Property | Havlo",
    description: "Connect your property to a curated network of qualified global buyers with Havlo. Reach serious investors, increase visibility, and close deals faster.",
    canonical: 'https://www.heyhavlo.com/buyer-network',
  });
  const { openModal } = useModal();
  const whyChooseItems = [
    {
      id: '01',
      title: 'Faster Sales',
      description: 'Close listings up to 30–50% faster by reaching buyers beyond UK portals.',
    },
    {
      id: '02',
      title: 'Exclusive Network',
      description: 'Access vetted buyers across 30+ countries actively searching for UK property.',
    },
    {
      id: '03',
      title: 'Premium Positioning',
      description: 'Attract higher-value buyers and win more instructions with global exposure.',
    },
    {
      id: '04',
      title: 'Data-Driven',
      description: 'Track performance with weekly reporting and real buyer engagement data.',
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
      description: 'Your listing is placed directly in front of vetted international buyers actively searching in your price range.',
    },
    {
      id: 4,
      title: 'Sell faster and impress vendors',
      description: 'With Havlo handling international exposure, agents close sales faster, attract higher-value instructions, and enhance their reputation.',
    },
  ];

  return (
    <div className="flex flex-col w-full bg-white">
      {/* 1. Hero Section */}
      <section className="relative flex flex-col items-center px-6 lg:px-[100px] bg-gradient-to-b from-[#FF8FDD] via-[#FFC78A] to-[#FFD85C] overflow-hidden md:min-h-[680px] py-10 my-0 pb-[126px] lg:pb-10">
        <div className="relative z-10 flex flex-col items-center text-center max-w-[1144px] mx-auto">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="font-display font-black tracking-[-1.2px] lg:tracking-[-1.6px] text-[#1F1F1E] mb-6 lg:mb-10 text-[40px] sm:text-[56px] md:text-[64px] lg:text-[80px] leading-[1.05] lg:leading-[1.0]"
          >
            Your Listings Aren't Reaching the Right Buyers. We Fix That.
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="font-body text-lg lg:text-xl font-normal leading-[1.3] tracking-[-0.36px] text-black max-w-[682px] mb-8"
          >
            Access a curated network of vetted international buyers actively looking for UK property — so you can sell faster and win more instructions.
          </motion.p>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col items-center gap-3 pt-[70px]"
          >
            <Button 
              onClick={() => openModal('create-account')}
              className="h-10 sm:h-[56px] w-full sm:w-auto px-8 bg-black text-white rounded-[48px] font-body text-sm sm:text-lg font-semibold tracking-[-0.36px] hover:bg-black/90 transition-colors"
            >
              Join the International Buyer Network
            </Button>
            <p className="font-body text-sm text-black/60">
              Built for agents who want more than portal exposure.
            </p>
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

      {/* Auto-scrolling reviews */}
      <div className="bg-white px-0 pt-0 pb-0">
        <AutoScrollReviews reviews={agentReviews} bgColor="#F5F5F3" />
      </div>

      {/* 2. Why estate agents choose Havlo */}
      <section className="flex flex-col items-center bg-white lg:py-32 px-6 lg:px-[100px] py-10 my-0">
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
      <section className="flex flex-col px-6 lg:px-[100px] bg-[#F9F8F9] overflow-hidden py-10 my-0">
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

      {/* 4. Why Havlo vs Traditional Property Portals */}
      <section className="bg-[#f9f9f8] px-6 py-14 lg:px-[100px] lg:py-[100px]">
        <div>
          <div className="mb-10 text-center lg:mb-12">
            <h2 className="font-display text-[30px] font-black leading-[1.05] tracking-[-0.8px] text-black sm:text-[42px] lg:text-[50px]">
              Why Havlo vs Traditional
              <br className="hidden sm:block" /> Property Portals
            </h2>
            <p className="mt-4 font-body text-sm font-medium leading-[1.55] text-black/65 sm:text-base">
              Most properties rely on passive listing platforms such as:
            </p>
            <div className="mt-6 flex items-center justify-center">
              <img
                src="/portal-logos/portal-logos-grey.png"
                alt="Rightmove, Zoopla, OnTheMarket"
                className="h-7 w-auto max-w-full object-contain sm:h-9"
                loading="lazy"
              />
            </div>
          </div>

          <div className="mx-auto grid max-w-[760px] gap-5 md:grid-cols-2">
            <div className="rounded-[28px] border-2 border-[#ff8ce7] bg-white p-6 sm:p-7 lg:p-8">
              <h3 className="font-body text-[18px] font-extrabold leading-none tracking-[-0.2px] text-black sm:text-[20px]">
                Traditional portals
              </h3>
              <ul className="mt-5 flex flex-col gap-3.5">
                {portalCons.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-[#e85b6f]" strokeWidth={3} />
                    <span className="font-body text-[13px] font-medium leading-[1.5] text-black/75 sm:text-sm">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-[28px] border-2 border-[#7dd3e8] bg-white p-6 sm:p-7 lg:p-8">
              <h3 className="font-body text-[18px] font-extrabold leading-none tracking-[-0.2px] text-black sm:text-[20px]">
                Havlo
              </h3>
              <ul className="mt-5 flex flex-col gap-3.5">
                {havloPros.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#22c55e] text-white">
                      <Check className="h-2.5 w-2.5" strokeWidth={4} />
                    </span>
                    <span className="font-body text-[13px] font-medium leading-[1.5] text-black/80 sm:text-sm">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Bottom CTA Section */}
      <section className="relative flex flex-col items-center px-6 lg:px-[150px] bg-white overflow-hidden md:min-h-[400px] justify-center py-10 my-0 pt-[20px]">
        <div className="relative z-20 flex flex-col items-center text-center max-w-[700px] mx-auto gap-14">
          <div className="flex flex-col items-center gap-8">
            <h2 className="font-display text-[44px] font-black leading-[1.1] text-black">
              Start Reaching Buyers Your Listings Are Missing
            </h2>
            <p className="font-body text-lg font-normal leading-[1.5] tracking-[-0.054px] text-black">
              Join Havlo's International Buyer Network and offer your clients unmatched global exposure.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <Button 
              onClick={() => openModal('create-account')}
              className="h-10 sm:h-[56px] w-full sm:w-auto px-8 bg-[#A409D2] text-white rounded-[48px] font-body text-sm sm:text-lg font-semibold tracking-[-0.36px] hover:bg-[#A409D2]/90 transition-colors"
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
            className="h-full w-full bg-white" 
          />
        </div>
      </section>
    </div>
  );
};
