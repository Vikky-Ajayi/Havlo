import React from 'react';
import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { HeroBackground } from '../components/shared/HeroBackground';
import { AutoScrollReviews } from '../components/shared/AutoScrollReviews';
import { useModal } from '../hooks/useModal';
import { usePageMeta } from '../hooks/usePageMeta';

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

  // Pricing tiers — kept in sync with the dashboard view at
  // src/pages/DashboardBuyerNetwork.tsx so the public marketing page and
  // the in-app subscribe view show identical packages.
  const packages: Array<{
    id: string;
    name: string;
    description: string;
    price: string;
    priceLabel: string;
    features: string[];
    outcome: string;
    isPopular?: boolean;
    isNetwork?: boolean;
  }> = [
    {
      id: 'starter',
      name: 'STARTER',
      description: 'Activate international buyer demand on selected listings.',
      price: '£295',
      priceLabel: '/ branch / month',
      features: [
        'Launch up to 2 properties to global audiences',
        'Initial demand activation across international markets',
        'Capture and manage qualified buyer enquiries',
        'Real-time visibility into buyer demand',
      ],
      outcome: 'Early-stage demand and consistent enquiry flow to build momentum.',
    },
    {
      id: 'growth',
      name: 'GROWTH',
      description: 'Designed to generate sustained demand and buyer competition.',
      price: '£495',
      priceLabel: '/ branch / month',
      features: [
        'Launch up to 5 properties across multiple international markets',
        'Expanded global exposure to high-intent buyers',
        'Priority launch positioning',
        'Co-branded launch assets to strengthen vendor perception',
      ],
      outcome:
        'Consistent enquiry flow with increasing buyer competition and stronger negotiating leverage.',
      isPopular: true,
    },
    {
      id: 'network',
      name: 'NETWORK',
      description: 'Scale demand generation across your entire network.',
      price: '£199',
      priceLabel: '/ branch / month',
      features: [
        'Unlimited property launches',
        'Network-wide demand visibility',
        'Centralised reporting for performance tracking',
        'Rollout and onboarding support',
      ],
      outcome: 'Scalable demand generation across multiple listings and branches.',
      isNetwork: true,
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

      {/* 4. Packages for estate agents */}
      <section className="flex flex-col px-6 lg:px-[100px] bg-white py-10 my-0">
        <div className="max-w-[1240px] mx-auto w-full">
          <p className="font-display text-[22px] font-bold text-[#1F1F1E] mb-2">
            One Additional Sale Typically Covers Your Investment
          </p>
          <p className="font-body text-base text-black/60 mb-10 max-w-[680px]">
            Designed to deliver qualified international buyers — not just more exposure. For most agents, a single completed deal offsets the cost of the campaign.
          </p>
          <h2 className="font-display text-[44px] font-black leading-[1.1] text-[#050405] mb-14">
            Packages for estate agents
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {packages.map((pkg) => {
              const ringClass = pkg.isPopular
                ? 'border-[2px] border-[#A409D2]'
                : 'border border-black/10';
              const accentText = pkg.isNetwork
                ? 'text-[#149D4F]'
                : 'text-[#A409D2]';
              const outcomeBg = pkg.isNetwork
                ? 'bg-[#149D4F]/10'
                : 'bg-[#A409D2]/10';
              const ctaLabel = pkg.isNetwork
                ? 'Request Partnership'
                : 'Launch my Properties';
              return (
                <div
                  key={pkg.id}
                  className={`flex flex-col rounded-[14px] bg-white p-6 ${ringClass}`}
                >
                  <div className="flex flex-1 flex-col">
                    <div className="mb-4 flex items-start justify-between gap-2">
                      <h4 className="font-display text-[18px] font-extrabold tracking-tight text-black">
                        {pkg.name}
                      </h4>
                      {pkg.isPopular && (
                        <span className="rounded bg-[#A409D2] px-2 py-1 font-display text-[11px] font-bold uppercase tracking-tight text-white">
                          MOST POPULAR
                        </span>
                      )}
                    </div>

                    <div className="mb-2">
                      {pkg.isNetwork && (
                        <p className="mb-1 font-display text-[12px] font-bold uppercase tracking-tight text-black/60">
                          FROM
                        </p>
                      )}
                      <p
                        className={`font-display text-[36px] font-black leading-none tracking-tight ${accentText}`}
                      >
                        {pkg.price}
                      </p>
                      <p className="mt-1 font-body text-[13px] font-medium text-black/65">
                        {pkg.priceLabel}
                      </p>
                    </div>

                    <p
                      className={`mt-4 mb-5 font-display text-[14px] font-bold leading-snug ${accentText}`}
                    >
                      {pkg.description}
                    </p>

                    <ul className="mb-5 space-y-3">
                      {pkg.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="w-4 h-4 mt-[3px] flex-shrink-0 text-[#149D4F]" />
                          <span className="font-body text-[14px] leading-snug text-black/85">
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <div className={`mt-auto rounded-[8px] p-3 ${outcomeBg}`}>
                      <p className={`font-display text-[13px] font-bold ${accentText}`}>
                        Typical outcome:
                      </p>
                      <p className="mt-1 font-body text-[13px] leading-snug text-black/75">
                        {pkg.outcome}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => openModal('create-account')}
                    className="mt-5 w-full rounded-md bg-black px-4 py-3 font-body text-[14px] font-semibold tracking-tight text-white hover:bg-black/90"
                  >
                    {ctaLabel}
                  </button>
                </div>
              );
            })}
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
